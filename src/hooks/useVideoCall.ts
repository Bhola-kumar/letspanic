import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface VideoCallState {
  inCall: boolean;
  isCalling: boolean;
  isReceivingCall: boolean;
  callerId: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
}

export function useVideoCall(conversationId: string | null, userId: string | undefined) {
  const [state, setState] = useState<VideoCallState>({
    inCall: false,
    isCalling: false,
    isReceivingCall: false,
    callerId: null,
    localStream: null,
    remoteStream: null,
    isMuted: false,
    isVideoOff: false,
  });

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const { toast } = useToast();

  const cleanup = useCallback(() => {
    console.log("[VideoCall] Cleaning up...");
    
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (channelRef.current) {
      try { supabase.removeChannel(channelRef.current); } catch (e) {}
      channelRef.current = null;
    }

    setState({
      inCall: false,
      isCalling: false,
      isReceivingCall: false,
      callerId: null,
      localStream: null,
      remoteStream: null,
      isMuted: false,
      isVideoOff: false,
    });
  }, []);

  const createPeerConnection = useCallback((stream: MediaStream) => {
    console.log("[VideoCall] Creating peer connection...");
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ]
    });

    stream.getTracks().forEach(track => {
      console.log(`[VideoCall] Adding track: ${track.kind}`);
      pc.addTrack(track, stream);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "ice-candidate",
          payload: { sender: userId, candidate: event.candidate }
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[VideoCall] ICE state: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
        toast({
          title: "Call Quality Issue",
          description: "Connection is unstable. You may experience issues.",
          variant: "destructive"
        });
      }
    };

    pc.ontrack = (event) => {
      console.log(`[VideoCall] Received remote track: ${event.track.kind}`);
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      setState(prev => ({ ...prev, remoteStream }));
    };

    peerConnection.current = pc;
    return pc;
  }, [userId, toast]);

  const initChannel = useCallback(() => {
    if (!conversationId || !userId) return;
    
    console.log("[VideoCall] Initializing channel for:", conversationId);

    if (channelRef.current) {
      try { supabase.removeChannel(channelRef.current); } catch (e) {}
    }

    const channel = supabase.channel(`video-call-${conversationId}`, {
      config: { broadcast: { self: false } }
    });

    channel
      .on("broadcast", { event: "call-request" }, async ({ payload }) => {
        const { sender } = payload;
        if (sender !== userId && !state.inCall && !state.isCalling) {
          console.log(`[VideoCall] Incoming call from ${sender}`);
          setState(prev => ({
            ...prev,
            isReceivingCall: true,
            callerId: sender
          }));
          toast({
            title: "Incoming Video Call",
            description: "Someone is calling you!",
          });
        }
      })
      .on("broadcast", { event: "call-accepted" }, async ({ payload }) => {
        const { sender, answer } = payload;
        if (sender !== userId && peerConnection.current) {
          console.log(`[VideoCall] Call accepted, setting remote description`);
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
          setState(prev => ({ ...prev, inCall: true, isCalling: false }));
        }
      })
      .on("broadcast", { event: "call-rejected" }, ({ payload }) => {
        if (payload.sender !== userId) {
          console.log(`[VideoCall] Call rejected`);
          toast({
            title: "Call Rejected",
            description: "The other user declined the call.",
          });
          cleanup();
        }
      })
      .on("broadcast", { event: "call-ended" }, ({ payload }) => {
        if (payload.sender !== userId) {
          console.log(`[VideoCall] Call ended by remote`);
          toast({
            title: "Call Ended",
            description: "The call has ended.",
          });
          cleanup();
        }
      })
      .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
        const { sender, candidate } = payload;
        if (sender !== userId && peerConnection.current) {
          try {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error("[VideoCall] Error adding ICE candidate:", e);
          }
        }
      })
      .on("broadcast", { event: "offer" }, async ({ payload }) => {
        const { sender, offer } = payload;
        if (sender !== userId && localStreamRef.current) {
          console.log(`[VideoCall] Received offer from ${sender}`);
          const pc = createPeerConnection(localStreamRef.current);
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          channel.send({
            type: "broadcast",
            event: "call-accepted",
            payload: { sender: userId, answer }
          });

          setState(prev => ({ 
            ...prev, 
            inCall: true, 
            isReceivingCall: false,
            callerId: null 
          }));
        }
      })
      .subscribe((status) => {
        console.log(`[VideoCall] Channel status: ${status}`);
      });

    channelRef.current = channel;
  }, [conversationId, userId, state.inCall, state.isCalling, createPeerConnection, cleanup, toast]);

  // Initialize channel when conversation changes
  useEffect(() => {
    if (conversationId && userId) {
      initChannel();
    }
    return () => {
      if (channelRef.current) {
        try { supabase.removeChannel(channelRef.current); } catch (e) {}
        channelRef.current = null;
      }
    };
  }, [conversationId, userId]);

  const startCall = useCallback(async () => {
    if (!conversationId || !userId) return;

    try {
      console.log("[VideoCall] Starting call...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      localStreamRef.current = stream;
      setState(prev => ({ ...prev, localStream: stream, isCalling: true }));

      // Make sure channel is initialized
      if (!channelRef.current) {
        initChannel();
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for subscription
      }

      const pc = createPeerConnection(stream);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send call request first
      channelRef.current?.send({
        type: "broadcast",
        event: "call-request",
        payload: { sender: userId }
      });

      // Then send offer
      setTimeout(() => {
        channelRef.current?.send({
          type: "broadcast",
          event: "offer",
          payload: { sender: userId, offer }
        });
      }, 100);

      toast({
        title: "Calling...",
        description: "Waiting for the other person to answer.",
      });

    } catch (error: any) {
      console.error("[VideoCall] Error starting call:", error);
      toast({
        title: "Camera/Mic Access Required",
        description: "Please allow camera and microphone access to make video calls.",
        variant: "destructive"
      });
      cleanup();
    }
  }, [conversationId, userId, createPeerConnection, initChannel, cleanup, toast]);

  const acceptCall = useCallback(async () => {
    if (!state.callerId) return;

    try {
      console.log("[VideoCall] Accepting call...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      localStreamRef.current = stream;
      setState(prev => ({ ...prev, localStream: stream }));

      // The offer handler will take care of the rest
    } catch (error: any) {
      console.error("[VideoCall] Error accepting call:", error);
      toast({
        title: "Camera/Mic Access Required",
        description: "Please allow camera and microphone access to accept video calls.",
        variant: "destructive"
      });
      rejectCall();
    }
  }, [state.callerId, toast]);

  const rejectCall = useCallback(() => {
    console.log("[VideoCall] Rejecting call...");
    channelRef.current?.send({
      type: "broadcast",
      event: "call-rejected",
      payload: { sender: userId }
    });
    setState(prev => ({
      ...prev,
      isReceivingCall: false,
      callerId: null
    }));
  }, [userId]);

  const endCall = useCallback(() => {
    console.log("[VideoCall] Ending call...");
    channelRef.current?.send({
      type: "broadcast",
      event: "call-ended",
      payload: { sender: userId }
    });
    cleanup();
  }, [userId, cleanup]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setState(prev => ({ ...prev, isMuted: !audioTrack.enabled }));
      }
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setState(prev => ({ ...prev, isVideoOff: !videoTrack.enabled }));
      }
    }
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    ...state,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
  };
}
