
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export type CallState = 'idle' | 'outgoing' | 'incoming' | 'connected' | 'ending';

export interface CallData {
  conversationId: string;
  roomId: string; // Unique ID for the voice session (isolated from conversation/group ID)
  otherUser: Profile; // The person you are calling OR function calling you
  isInitiator: boolean;
}

export function useCallSystem(userId: string | undefined, userProfile: Profile | null) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [callData, setCallData] = useState<CallData | null>(null);
  const { toast } = useToast();

  // Refs for checking state inside event listeners without re-subscribing
  const callStateRef = useRef<CallState>('idle');
  const callDataRef = useRef<CallData | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Sync refs with state
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    callDataRef.current = callData;
  }, [callData]);

  // Audio Context for Ringtone
  const audioContextTef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const playRingtone = useCallback(() => {
    try {
        if (!audioContextTef.current) {
            audioContextTef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioContextTef.current;
        
        // Create oscillator
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 1); // Sweep up

        // Pulsing effect
        const lfo = ctx.createOscillator();
        lfo.type = 'square';
        lfo.frequency.value = 4; // 4Hz pulse
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.5;
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        
        oscillatorRef.current = osc;
        gainNodeRef.current = gain;
        
        // Loop the "ring"
        osc.onended = () => {
             // Basic loop handled by just letting it run or re-triggering? 
             // Oscillator doesn't loop naturally. Let's make a beeping interval instead for simplicity.
        };

    } catch (e) {
        console.error("Error playing ringtone", e);
    }
  }, []);

  const stopRingtone = useCallback(() => {
      if (oscillatorRef.current) {
          try { oscillatorRef.current.stop(); } catch(e) {}
          oscillatorRef.current.disconnect();
          oscillatorRef.current = null;
      }
      if (gainNodeRef.current) {
          gainNodeRef.current.disconnect();
          gainNodeRef.current = null;
      }
  }, []);

  // Use an interval for the "Ring-Ring" pattern instead of continuous tone
  const ringIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRinging_Pattern = useCallback(() => {
    if (ringIntervalRef.current) return;
    
    const playBeep = () => {
       if (!audioContextTef.current) {
           audioContextTef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
       }
       const ctx = audioContextTef.current;
       const osc = ctx.createOscillator();
       const gain = ctx.createGain();
       
       osc.connect(gain);
       gain.connect(ctx.destination);
       
       osc.frequency.value = 440;
       gain.gain.setValueAtTime(0.1, ctx.currentTime);
       
       osc.start();
       osc.stop(ctx.currentTime + 1); // 1 second beep
    };

    playBeep(); // Immediate
    ringIntervalRef.current = setInterval(playBeep, 3000); // Repeat every 3s
  }, []);

  const stopRinging_Pattern = useCallback(() => {
      if (ringIntervalRef.current) {
          clearInterval(ringIntervalRef.current);
          ringIntervalRef.current = null;
      }
  }, []);

  // Subscribe to my own signaling channel to receive calls
  useEffect(() => {
    if (!userId) return;

    console.log(`Subscribing to signaling channel: calls:${userId}`);
    const channel = supabase.channel(`calls:${userId}`)
      .on('broadcast', { event: 'invite' }, async ({ payload }) => {
        console.log('Received call invite:', payload);
        if (callStateRef.current !== 'idle') {
          // Busy
          return;
        }

        const { data: callerProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', payload.caller_id)
          .single();

        if (callerProfile) {
          setCallData({
            conversationId: payload.conversation_id,
            roomId: payload.room_id || payload.conversation_id, // Fallback for backward compat
            otherUser: callerProfile as Profile,
            isInitiator: false,
          });
          setCallState('incoming');
          startRinging_Pattern();
        }
      })
      .on('broadcast', { event: 'accept' }, ({ payload }) => {
        console.log('Call accepted by:', payload);
        // Check ref for current state
        if (callStateRef.current === 'outgoing' && callDataRef.current?.conversationId === payload.conversation_id) {
          setCallState('connected');
          startTimeRef.current = Date.now();
          stopRinging_Pattern();
        }
      })
      .on('broadcast', { event: 'reject' }, ({ payload }) => {
        console.log('Call rejected by:', payload);
        if (callStateRef.current === 'outgoing' && callDataRef.current?.conversationId === payload.conversation_id) {
          setCallState('idle');
          setCallData(null);
          stopRinging_Pattern();
          toast({ description: "Call declined" });
        }
      })
      .on('broadcast', { event: 'cancel' }, ({ payload }) => {
        console.log('Call cancelled by caller');
        if (callStateRef.current === 'incoming' && callDataRef.current?.conversationId === payload.conversation_id) {
          setCallState('idle');
          setCallData(null);
          stopRinging_Pattern();
          toast({ description: "Call missed" });
        }
      })
      .on('broadcast', { event: 'end' }, ({ payload }) => {
         console.log('Call ended by peer');
         if (callDataRef.current?.conversationId === payload.conversation_id) {
            setCallState('idle');
            setCallData(null);
            stopRinging_Pattern(); 
            toast({ description: "Call ended" });
         }
      })
      .subscribe();

    return () => {
      console.log("Unsubscribing from signaling channel");
      stopRinging_Pattern();
      supabase.removeChannel(channel);
    };
  }, [userId]); // Only depend on userId!

  const initiateCall = async (conversationId: string, targetUser: Profile) => {
    if (!userId || !userProfile) return;
    
    const roomId = crypto.randomUUID();

    setCallData({
      conversationId,
      roomId,
      otherUser: targetUser,
      isInitiator: true,
    });
    setCallState('outgoing');
    startRinging_Pattern(); // Ringing for caller too (calling tone)

    // Send invite
    // We send to the target's channel
    const channel = supabase.channel(`calls:${targetUser.user_id}`);
    channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            channel.send({
              type: 'broadcast',
              event: 'invite',
              payload: {
                conversation_id: conversationId,
                room_id: roomId,
                caller_id: userId,
              },
            });
            // We can unsubscribe from the *target's* channel after sending? 
            // Or keep it? Usually better to just send and let it go.
             supabase.removeChannel(channel); 
        }
    });
  };

  const acceptCall = async () => {
    if (!callData || !userId) return;
    
    setCallState('connected');
    startTimeRef.current = Date.now();
    stopRinging_Pattern();

    // To send 'accept', we need to send to the CALLER's channel.
    // In initiateCall, we set otherUser = targetUser.
    // In incoming invite, we set otherUser = callerProfile.
    // So callData.otherUser.user_id is always the *remote* party.
    const targetId = callData.otherUser.user_id;

    const channel = supabase.channel(`calls:${targetId}`);
    channel.subscribe((status) => {
       if (status === 'SUBSCRIBED') {
         channel.send({
           type: 'broadcast',
           event: 'accept',
           payload: {
             conversation_id: callData.conversationId,
             responder_id: userId,
           },
         });
         supabase.removeChannel(channel);
       }
    });
  };

  const logCall = async (status: 'ended' | 'missed' | 'declined', duration: number = 0) => {
      const cid = callDataRef.current?.conversationId;
      if (!cid || !userId) return;

      try {
          // Format duration text
          let durationText = "";
          if (duration > 0) {
              const mins = Math.floor(duration / 60);
              const secs = Math.floor(duration % 60);
              durationText = `${mins}:${secs.toString().padStart(2, '0')}`;
          }

          let content = "";
          if (status === 'ended') content = JSON.stringify({ type: 'call_log', status: 'ended', duration: durationText });
          if (status === 'missed') content = JSON.stringify({ type: 'call_log', status: 'missed' });
          if (status === 'declined') content = JSON.stringify({ type: 'call_log', status: 'declined' });

          await supabase.from('messages').insert({
              conversation_id: cid,
              sender_id: userId,
              content: content,
              message_type: 'system' // Using system type
          });
      } catch (e) {
          console.error("Failed to log call:", e);
      }
  };

  const endCall = async () => {
      if (!callData || !userId) return;
      stopRinging_Pattern();
      
      // Calculate duration if connected
      let duration = 0;
      if (callState === 'connected' && startTimeRef.current) {
          duration = (Date.now() - startTimeRef.current) / 1000;
      }
      
      // Log the call locally before resetting state
      // Only log if WE end it.
      await logCall('ended', duration);

      const targetId = callData.otherUser.user_id;

      const channel = supabase.channel(`calls:${targetId}`);
      channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            channel.send({
                type: 'broadcast',
                event: 'end',
                payload: {
                  conversation_id: callData.conversationId,
                },
              });
             supabase.removeChannel(channel);
          }
      });
      
      setCallState('idle');
      setCallData(null);
      startTimeRef.current = null;
  };
 
  const cancelCall = async () => {
    if (!callData || !userId) return;
    stopRinging_Pattern();
    
    // Caller cancelled -> Missed call for receiver
    await logCall('missed');
    
    const targetId = callData.otherUser.user_id;

    const channel = supabase.channel(`calls:${targetId}`);
    channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            channel.send({
              type: 'broadcast',
              event: 'cancel',
              payload: {
                conversation_id: callData.conversationId,
              },
            });
            supabase.removeChannel(channel);
        }
    });

    setCallState('idle');
    setCallData(null);
  };

  const declineCall = async () => {
    if (!callData || !userId) return;
    
    stopRinging_Pattern();
    
    // Receiver declined -> Log it
    await logCall('declined');

    const targetId = callData.otherUser.user_id;

    const channel = supabase.channel(`calls:${targetId}`);
    channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            channel.send({
              type: 'broadcast',
              event: 'reject',
              payload: {
                conversation_id: callData.conversationId,
                responder_id: userId,
              },
            });
            supabase.removeChannel(channel);
        }
    });

    setCallState('idle');
    setCallData(null);
  };

  return {
    callState,
    callData,
    initiateCall,
    acceptCall,
    declineCall,
    cancelCall,
    endCall
  };
}
