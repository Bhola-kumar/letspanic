import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface Participant {
  user_id: string;
  stream?: MediaStream;
}

export function useVoiceRoom(conversationId: string | null, userId: string | undefined) {
  const [inAudioRoom, setInAudioRoom] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState<string | null>(null);
  const [selectedOutput, setSelectedOutput] = useState<string | null>(null);
  
  // Track the current active room ID (either from prop or manual join)
  const [activeRoomId, setActiveRoomId] = useState<string | null>(conversationId);

  // Sync prop changes to active room, but only if we aren't manually joined to another?
  useEffect(() => {
    if (conversationId) setActiveRoomId(conversationId);
  }, [conversationId]);

  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  const iceCandidatesQueue = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const reconnectAttempts = useRef<Record<string, number>>({});
  const reconnectTimer = useRef<Record<string, any>>({});
  const { toast } = useToast();

  const cleanup = useCallback(() => {
    console.log("Cleaning up voice room connections...");
    
    // Clear reconnect timers
    Object.values(reconnectTimer.current).forEach((t) => {
      if (t) {
        try { clearTimeout(t); } catch (_) {}
      }
    });
    reconnectTimer.current = {};

    // Close all peer connections
    Object.values(peerConnections.current).forEach(pc => pc.close());
    peerConnections.current = {};
    iceCandidatesQueue.current = {};

    // Stop local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setParticipants([]);

    // Remove Supabase channel
    if (channelRef.current) {
      console.log("Removing Supabase channel...");
      try { supabase.removeChannel(channelRef.current); } catch (e) { console.warn(e); }
      channelRef.current = null;
    }
    // Close any shared AudioContext created during joins
    try {
      const g = (window as any).__letspanicAudioContext as AudioContext | undefined;
      if (g) {
        if (g.state !== 'closed') {
          g.close().catch((e: any) => console.warn('Error closing shared AudioContext', e));
        }
        try { delete (window as any).__letspanicAudioContext; } catch (e) { (window as any).__letspanicAudioContext = undefined; }
        console.log('Shared AudioContext closed and cleared');
      }
    } catch (e) {
      console.warn('Error during shared AudioContext shutdown', e);
    }
    
    // Only reset inAudioRoom if we are fully cleaning up (not just switching)
    // But cleanup is called on unmount too.
    setInAudioRoom(false);
  }, []);

  const addIceCandidate = useCallback(async (senderId: string, candidate: RTCIceCandidateInit) => {
    const pc = peerConnections.current[senderId];
    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("Error adding ice candidate:", e);
      }
    } else {
      if (!iceCandidatesQueue.current[senderId]) iceCandidatesQueue.current[senderId] = [];
      iceCandidatesQueue.current[senderId].push(candidate);
    }
  }, []);

  const processIceQueue = useCallback(async (senderId: string) => {
    const pc = peerConnections.current[senderId];
    const candidates = iceCandidatesQueue.current[senderId] || [];
    if (pc && pc.remoteDescription) {
      for (const candidate of candidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("Error adding queued ice candidate:", e);
        }
      }
      delete iceCandidatesQueue.current[senderId];
    }
  }, []);

  const createPeerConnection = useCallback((targetUserId: string, stream: MediaStream) => {
    if (peerConnections.current[targetUserId]) {
      console.log(`PeerConnection for ${targetUserId} already exists`);
      return peerConnections.current[targetUserId];
    }

    console.log(`Creating PeerConnection for ${targetUserId}`);
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" }
      ]
    });

    stream.getTracks().forEach(track => {
      console.log(`Adding track to PC for ${targetUserId}`, track.kind, track.id);
      pc.addTrack(track, stream);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "ice-candidate",
          payload: { target: targetUserId, sender: userId, candidate: event.candidate }
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE Connection State with ${targetUserId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
        console.warn(`Connection with ${targetUserId} failed/disconnected`);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection State with ${targetUserId}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.warn(`Peer connection state is ${pc.connectionState} for ${targetUserId}`);
      }
    };

    pc.ontrack = (event) => {
      try {
        console.log(`[WebRTC] Received remote track from ${targetUserId}`, event.track.kind, event.track.id);

        const incomingTrack = event.track;

        setParticipants(prev => {
          const exists = prev.find(p => p.user_id === targetUserId);
          if (exists && exists.stream) {
            // If a stream already exists for this participant, add the incoming track to it
            try {
              const rs = exists.stream;
              const existingIds = rs.getTracks().map(t => t.id);
              if (!existingIds.includes(incomingTrack.id)) {
                rs.addTrack(incomingTrack);
              }
              console.log(`[WebRTC] Added incoming track to existing stream for ${targetUserId}`);
              return prev.map(p => p.user_id === targetUserId ? { ...p, stream: rs } : p);
            } catch (e) {
              console.warn('Failed to append track to existing stream', e);
            }
          }

          // Otherwise create a new MediaStream from provided streams or the single track
          const newStream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([incomingTrack]);
          const audioTracks = newStream.getAudioTracks();
          console.log(`[WebRTC] Remote stream tracks for ${targetUserId}:`, audioTracks.map(t => ({ id: t.id, enabled: t.enabled, kind: t.kind })));
          // Replace or add participant
          const filtered = prev.filter(p => p.user_id !== targetUserId);
          return [...filtered, { user_id: targetUserId, stream: newStream }];
        });
      } catch (e) {
        console.error('Error handling ontrack event', e);
      }
    };

    peerConnections.current[targetUserId] = pc;
    return pc;
  }, [userId]);

  const initChannel = useCallback((stream: MediaStream | null, targetRoomId: string) => {
    if (!targetRoomId || !userId) return null;
    console.log("Initializing voice channel for conversation:", targetRoomId);

    if (channelRef.current) {
        try { supabase.removeChannel(channelRef.current); } catch (e) {}
    }

    const channel = supabase.channel(`voice-${targetRoomId}`, { 
        config: { broadcast: { self: false } } 
    });

    channel
      .on("broadcast", { event: "join-request" }, async ({ payload }) => {
        const { sender } = payload;
        console.log(`Received join-request from ${sender}`);
        if (sender !== userId && stream) {
          const pc = createPeerConnection(sender, stream);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          console.log(`Sending offer to ${sender}`);
          channel.send({ type: "broadcast", event: "offer", payload: { target: sender, sender: userId, offer } });
        }
      })
      .on("broadcast", { event: "offer" }, async ({ payload }) => {
        const { target, sender, offer } = payload;
        if (target === userId && stream) {
          console.log(`Received offer from ${sender}`);
          const pc = createPeerConnection(sender, stream);
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          await processIceQueue(sender);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          console.log(`Sending answer to ${sender}`);
          channel.send({ type: "broadcast", event: "answer", payload: { target: sender, sender: userId, answer } });
        }
      })
      .on("broadcast", { event: "answer" }, async ({ payload }) => {
        const { target, sender, answer } = payload;
        if (target === userId) {
          console.log(`Received answer from ${sender}`);
          const pc = peerConnections.current[sender];
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            await processIceQueue(sender);
          }
        }
      })
      .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
        const { target, sender, candidate } = payload;
        if (target === userId) {
          await addIceCandidate(sender, candidate);
        }
      })
      .on("broadcast", { event: "leave" }, ({ payload }) => {
        const { sender } = payload;
        console.log(`Participant ${sender} left the room`);
        if (peerConnections.current[sender]) {
          peerConnections.current[sender].close();
          delete peerConnections.current[sender];
          delete iceCandidatesQueue.current[sender];
          setParticipants(prev => prev.filter(p => p.user_id !== sender));
        }
      })
      .subscribe(async (status) => {
        console.log(`Voice channel status: ${status}`);
        if (status === "SUBSCRIBED") {
          console.log("Broadcasting join-request...");
          reconnectAttempts.current[targetRoomId] = 0;
          channel.send({ type: "broadcast", event: "join-request", payload: { sender: userId } });
        } else if (status === "CLOSED") {
            console.error("Voice channel closed for conversation:", targetRoomId);
            const attempts = reconnectAttempts.current[targetRoomId] || 0;
            if (attempts < 3) {
              reconnectAttempts.current[targetRoomId] = attempts + 1;
              reconnectTimer.current[targetRoomId] = setTimeout(() => {
                console.log("Attempting to re-init voice channel", targetRoomId);
                initChannel(localStreamRef.current, targetRoomId);
              }, 1500 * (attempts + 1));
            }
        }
      });

    channelRef.current = channel;
    return channel;
  }, [userId, createPeerConnection, addIceCandidate, processIceQueue]);

  const handleJoin = useCallback(async (deviceId?: string, overrideRoomId?: string) => {
    const targetId = overrideRoomId || activeRoomId;
    
    if (!targetId || !userId) {
        console.warn("Cannot join room: Missing conversation ID or User ID", { targetId, userId });
        return;
    }

    // If switching rooms, update active ID
    if (overrideRoomId && overrideRoomId !== activeRoomId) {
        setActiveRoomId(overrideRoomId);
    }

    try {
      console.log("Requesting microphone access...");
      const constraints: MediaStreamConstraints = deviceId
        ? { audio: { deviceId: { exact: deviceId } } as any }
        : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      localStreamRef.current = stream;
      // Do not setInAudioRoom(true) yet? No, we should.
      setInAudioRoom(true);
      console.log("Microphone access granted.");

      // Ensure a resumed/shared AudioContext exists (user gesture: join/accept)
      try {
        const g = window as any;
        if (!g.__letspanicAudioContext) {
          g.__letspanicAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (g.__letspanicAudioContext.state === 'suspended') {
          await g.__letspanicAudioContext.resume();
        }
      } catch (e) {
        console.warn('Failed to init/resume shared AudioContext', e);
      }

      initChannel(stream, targetId);

    } catch (error: any) {
      console.error("Error joining voice room:", error);
      toast({ 
        title: "Microphone Access Error", 
        description: "Please allow microphone access to join voice channels.", 
        variant: "destructive" 
      });
    }
  }, [activeRoomId, userId, initChannel, toast]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        console.log(`Microphone ${audioTrack.enabled ? "unmuted" : "muted"}`);
      }
    }
  }, []);

  const leaveRoom = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.send({ type: "broadcast", event: "leave", payload: { sender: userId } });
    }
    cleanup();
  }, [userId, cleanup]);

  useEffect(() => {
    let mounted = true;
    const loadDevices = async () => {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter(d => d.kind === "audioinput");
        const outputs = devices.filter(d => d.kind === "audiooutput");
        
        if (mounted) {
          setAudioInputs(inputs);
          setAudioOutputs(outputs);
          
          if (inputs.length > 0 && !selectedInput) {
            setSelectedInput(inputs[0].deviceId);
          }
           // Use default output if available and none selected
          if (outputs.length > 0 && !selectedOutput) {
             // Try to find the "default" one or just the first
             const defaultOutput = outputs.find(d => d.deviceId === 'default') || outputs[0];
             setSelectedOutput(defaultOutput.deviceId);
          }
        }
      } catch (e) {
        console.error("Error loading devices", e);
      }
    };
    loadDevices();
    navigator.mediaDevices?.addEventListener('devicechange', loadDevices);
    return () => {
      mounted = false;
      navigator.mediaDevices?.removeEventListener('devicechange', loadDevices);
    };
  }, [selectedInput]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const switchDevice = useCallback(async (deviceId: string) => {
    setSelectedInput(deviceId);
    if (inAudioRoom) {
      // Re-join with new device
      leaveRoom();
      setTimeout(() => handleJoin(deviceId), 100);
    }
  }, [inAudioRoom, leaveRoom, handleJoin]);

  const switchOutput = useCallback((deviceId: string) => {
      setSelectedOutput(deviceId);
      // We don't need to rejoin for output, just state update which propagates to <ParticipantAudio>
  }, []);

  return {
    inAudioRoom,
    participants,
    isMuted,
    joinRoom: handleJoin,
    leaveRoom,
    toggleMute,
    audioInputs,
    audioOutputs,
    selectedInput,
    selectedOutput,
    switchDevice,
    switchOutput
  };
}
