import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface TypingUser {
  userId: string;
  displayName: string;
}

export function useTypingIndicator(
  conversationId: string | null,
  userId: string | undefined,
  displayName: string | undefined
) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const timeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (!conversationId || !userId) return;

    // Create a broadcast channel for typing indicators
    const channel = supabase.channel(`typing-${conversationId}`);

    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        const { user_id, display_name } = payload.payload;
        
        if (user_id === userId) return;

        setTypingUsers((prev) => {
          const exists = prev.find((u) => u.userId === user_id);
          if (!exists) {
            return [...prev, { userId: user_id, displayName: display_name }];
          }
          return prev;
        });

        // Clear existing timeout for this user
        if (timeoutRef.current[user_id]) {
          clearTimeout(timeoutRef.current[user_id]);
        }

        // Set timeout to remove typing indicator after 3 seconds
        timeoutRef.current[user_id] = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u.userId !== user_id));
          delete timeoutRef.current[user_id];
        }, 3000);
      })
      .on("broadcast", { event: "stop_typing" }, (payload) => {
        const { user_id } = payload.payload;
        
        if (timeoutRef.current[user_id]) {
          clearTimeout(timeoutRef.current[user_id]);
          delete timeoutRef.current[user_id];
        }
        
        setTypingUsers((prev) => prev.filter((u) => u.userId !== user_id));
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      // Clear all timeouts
      Object.values(timeoutRef.current).forEach(clearTimeout);
      timeoutRef.current = {};
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [conversationId, userId]);

  const sendTyping = useCallback(() => {
    if (!channelRef.current || !userId || isTypingRef.current) return;

    isTypingRef.current = true;
    channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: userId, display_name: displayName || "Someone" },
    });

    // Debounce: allow sending again after 2 seconds
    setTimeout(() => {
      isTypingRef.current = false;
    }, 2000);
  }, [userId, displayName]);

  const stopTyping = useCallback(() => {
    if (!channelRef.current || !userId) return;

    channelRef.current.send({
      type: "broadcast",
      event: "stop_typing",
      payload: { user_id: userId },
    });
    isTypingRef.current = false;
  }, [userId]);

  return { typingUsers, sendTyping, stopTyping };
}
