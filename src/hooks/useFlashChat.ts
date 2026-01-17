import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/supabase";

export type FlashMessage = {
  id: string;
  content: string;
  sender_id: string;
  sender: Profile;
  message_type: "text" | "image" | "file";
  file_url?: string;
  file_name?: string;
  created_at: string;
};

export function useFlashChat(
  conversationId: string | null,
  userId: string | undefined,
  userProfile: Profile | null,
  enabled: boolean,
  setEnabled: (enabled: boolean) => void
) {
  const [flashMessages, setFlashMessages] = useState<FlashMessage[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Clear flash messages when mode changes or conversation changes
  useEffect(() => {
    if (!enabled) {
      setFlashMessages([]);
    }
  }, [enabled, conversationId]);

  // Subscribe to flash chat channel for real-time ephemeral messages
  useEffect(() => {
    if (!conversationId || !userId) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const channel = supabase.channel(`flash-${conversationId}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on("broadcast", { event: "flash_message" }, (payload) => {
        const msg = payload.payload as FlashMessage;
        setFlashMessages((prev) => [...prev, msg]);
      })
      .on("broadcast", { event: "flash_mode_toggle" }, (payload) => {
        const { enabled: newEnabled, senderId } = payload.payload;
        console.log(`Received flash toggle: ${newEnabled} from ${senderId}`);
        if (senderId !== userId) {
          setEnabled(newEnabled);
        }
      })
      .on("broadcast", { event: "request_flash_status" }, (payload) => {
        // If I am the one who enabled it (or just anyone who knows the state), response
        // Only respond if we have flash enabled, to avoid storm. 
        // Or if we are the "owner" conceptually? For peer-to-peer, anyone can reply.
        // Let's have anyone with enabled=true reply.
        if (enabled && payload.payload.requesterId !== userId) {
             channel.send({
                type: "broadcast",
                event: "flash_mode_sync",
                payload: { enabled: true, senderId: userId },
             });
        }
      })
      .on("broadcast", { event: "flash_mode_sync" }, (payload) => {
         const { enabled: syncEnabled, senderId } = payload.payload;
         if (senderId !== userId && syncEnabled && !enabled) {
             setEnabled(true);
         }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
             // Request current status on join
             channel.send({
                type: "broadcast",
                event: "request_flash_status",
                payload: { requesterId: userId },
             });
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, userId, setEnabled]);

  const sendFlashMessage = useCallback(
    async (content: string) => {
      if (!conversationId || !userId || !userProfile || !channelRef.current) {
        throw new Error("Cannot send flash message");
      }

      const msg: FlashMessage = {
        id: crypto.randomUUID(),
        content,
        sender_id: userId,
        sender: userProfile,
        message_type: "text",
        created_at: new Date().toISOString(),
      };

      await channelRef.current.send({
        type: "broadcast",
        event: "flash_message",
        payload: msg,
      });
    },
    [conversationId, userId, userProfile]
  );

  const toggleFlashMode = useCallback(
    async (newState: boolean) => {
      if (!channelRef.current || !userId) return;
      
      setEnabled(newState);
      await channelRef.current.send({
        type: "broadcast",
        event: "flash_mode_toggle",
        payload: { enabled: newState, senderId: userId },
      });
    },
    [userId, setEnabled]
  );

  const clearFlashMessages = useCallback(() => {
    setFlashMessages([]);
  }, []);

  return {
    flashMessages,
    sendFlashMessage,
    toggleFlashMode,
    clearFlashMessages,
  };
}
