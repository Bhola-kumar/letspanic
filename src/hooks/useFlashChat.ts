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
  enabled: boolean
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
    if (!conversationId || !userId || !enabled) {
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
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, userId, enabled]);

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

  const clearFlashMessages = useCallback(() => {
    setFlashMessages([]);
  }, []);

  return {
    flashMessages,
    sendFlashMessage,
    clearFlashMessages,
  };
}
