import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Message, Profile } from "@/lib/supabase";

export type MessageWithSender = Message & {
  sender: Profile;
};

export function useMessages(conversationId: string | null, userId: string | undefined) {
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .neq("is_deleted", true)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const senderIds = Array.from(
        new Set((data || []).map((m: any) => m.sender_id).filter(Boolean))
      );

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", senderIds);

      if (profilesError) throw profilesError;

      const profilesMap = new Map(
        (profiles || []).map((p: any) => [p.user_id, p as Profile])
      );

      const formatted = (data || []).map((msg: any) => {
        const sender = profilesMap.get(msg.sender_id);
        const fallbackSender: Profile = {
          id: "",
          user_id: msg.sender_id,
          email: "",
          display_name: null,
          avatar_url: null,
          user_code: "",
          is_online: false,
          last_seen: msg.created_at,
          created_at: msg.created_at,
          updated_at: msg.created_at,
        };

        return {
          ...msg,
          sender: sender || fallbackSender,
        } as MessageWithSender;
      });

      setMessages(formatted);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!conversationId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", payload.new.sender_id)
            .single();

          const fallbackSender: Profile = {
            id: "",
            user_id: payload.new.sender_id,
            email: "",
            display_name: null,
            avatar_url: null,
            user_code: "",
            is_online: false,
            last_seen: payload.new.created_at as string,
            created_at: payload.new.created_at as string,
            updated_at: payload.new.created_at as string,
          };

          const newMessage: MessageWithSender = {
            ...(payload.new as Message),
            sender: (profile as Profile) || fallbackSender,
          };

          setMessages((prev) => [...prev, newMessage]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === payload.new.id
                ? { ...msg, ...(payload.new as Message) }
                : msg
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [conversationId]);

  const sendMessage = async (content: string, type: Message["message_type"] = "text") => {
    if (!conversationId || !userId) throw new Error("Cannot send message");

    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: userId,
      content,
      message_type: type,
    });

    if (error) throw error;
  };

  const sendFileMessage = async (
    file: File,
    type: Message["message_type"]
  ) => {
    if (!conversationId || !userId) throw new Error("Cannot send file");

    const filePath = `${userId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("chat-files")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("chat-files")
      .getPublicUrl(filePath);

    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: userId,
      content: file.name,
      message_type: type,
      file_url: urlData.publicUrl,
      file_name: file.name,
      file_size: file.size,
    });

    if (error) throw error;
  };

  const deleteMessage = async (messageId: string) => {
    await supabase
      .from("messages")
      .update({ is_deleted: true })
      .eq("id", messageId);
  };

  return {
    messages,
    loading,
    sendMessage,
    sendFileMessage,
    deleteMessage,
  };
}
