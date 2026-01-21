
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export type CallState = 'idle' | 'outgoing' | 'incoming' | 'connected' | 'ending';

export interface CallData {
  conversationId: string;
  otherUser: Profile; // The person you are calling OR function calling you
  isInitiator: boolean;
}

export function useCallSystem(userId: string | undefined, userProfile: Profile | null) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [callData, setCallData] = useState<CallData | null>(null);
  const { toast } = useToast();
  
  // Ref to hold the sound effect
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize ringtone
    ringtoneRef.current = new Audio('/sounds/ringtone.mp3'); 
    // You might need to add a cleanup or actual sound file later.
    // For now we'll just log "ringing".
  }, []);

  const playRingtone = () => {
    // ringtoneRef.current?.play().catch(e => console.log("Audio play failed", e));
    console.log("Playing ringtone...");
  };

  const stopRingtone = () => {
    // ringtoneRef.current?.pause();
    // if (ringtoneRef.current) ringtoneRef.current.currentTime = 0;
    console.log("Stopping ringtone...");
  };

  // Subscribe to my own signaling channel to receive calls
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(`calls:${userId}`)
      .on('broadcast', { event: 'invite' }, async ({ payload }) => {
        console.log('Received call invite:', payload);
        if (callState !== 'idle') {
          // Busy: Automatically reject or just ignore?
          // Let's send a 'busy' signal back maybe?
          return;
        }

        // Fetch caller profile
        const { data: callerProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', payload.caller_id)
          .single();

        if (callerProfile) {
          setCallData({
            conversationId: payload.conversation_id,
            otherUser: callerProfile as Profile,
            isInitiator: false,
          });
          setCallState('incoming');
          playRingtone();
        }
      })
      .on('broadcast', { event: 'accept' }, ({ payload }) => {
        console.log('Call accepted by:', payload);
        if (callState === 'outgoing' && callData?.conversationId === payload.conversation_id) {
          setCallState('connected');
          stopRingtone();
        }
      })
      .on('broadcast', { event: 'reject' }, ({ payload }) => {
        console.log('Call rejected by:', payload);
        if (callState === 'outgoing' && callData?.conversationId === payload.conversation_id) {
          setCallState('idle');
          setCallData(null);
          stopRingtone();
          toast({ description: "Call declined" });
        }
      })
      .on('broadcast', { event: 'cancel' }, ({ payload }) => {
        console.log('Call cancelled by caller');
        if (callState === 'incoming' && callData?.conversationId === payload.conversation_id) {
          setCallState('idle');
          setCallData(null);
          stopRingtone();
          toast({ description: "Call missed" });
        }
      })
      .on('broadcast', { event: 'end' }, ({ payload }) => {
         console.log('Call ended by peer');
         // Only end if it's the current call
         if (callData?.conversationId === payload.conversation_id) {
            setCallState('idle'); // Or 'ending' -> 'idle'
            setCallData(null);
            stopRingtone(); 
            toast({ description: "Call ended" });
         }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, callState, callData, toast]);

  const initiateCall = async (conversationId: string, targetUser: Profile) => {
    if (!userId || !userProfile) return;
    
    setCallData({
      conversationId,
      otherUser: targetUser,
      isInitiator: true,
    });
    setCallState('outgoing');
    // sound? "Calling..." sound

    // Send invite
    await supabase.channel(`calls:${targetUser.user_id}`).subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            supabase.channel(`calls:${targetUser.user_id}`).send({
              type: 'broadcast',
              event: 'invite',
              payload: {
                conversation_id: conversationId,
                caller_id: userId,
              },
            });
        }
    });
  };

  const acceptCall = async () => {
    if (!callData || !userId) return;
    
    setCallState('connected');
    stopRingtone();

    // Notify caller
    await supabase.channel(`calls:${callData.otherUser.user_id}`).subscribe((status) => {
       if (status === 'SUBSCRIBED') {
         supabase.channel(`calls:${callData.otherUser.user_id}`).send({
           type: 'broadcast',
           event: 'accept',
           payload: {
             conversation_id: callData.conversationId,
             responder_id: userId,
           },
         });
       }
    });
  };

  const declineCall = async () => {
    if (!callData || !userId) return;
    
    stopRingtone();
    
    // Notify caller
    await supabase.channel(`calls:${callData.otherUser.user_id}`).subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            supabase.channel(`calls:${callData.otherUser.user_id}`).send({
              type: 'broadcast',
              event: 'reject',
              payload: {
                conversation_id: callData.conversationId,
                responder_id: userId,
              },
            });
        }
    });

    setCallState('idle');
    setCallData(null);
  };

  const cancelCall = async () => {
    if (!callData || !userId) return;
    
    // Notify callee
    await supabase.channel(`calls:${callData.otherUser.user_id}`).subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            supabase.channel(`calls:${callData.otherUser.user_id}`).send({
              type: 'broadcast',
              event: 'cancel',
              payload: {
                conversation_id: callData.conversationId,
              },
            });
        }
    });

    setCallState('idle');
    setCallData(null);
  };

  const endCall = async () => {
      if (!callData || !userId) return;

      // Notify other party
      await supabase.channel(`calls:${callData.otherUser.user_id}`).subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            supabase.channel(`calls:${callData.otherUser.user_id}`).send({
                type: 'broadcast',
                event: 'end',
                payload: {
                  conversation_id: callData.conversationId,
                },
              });
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
