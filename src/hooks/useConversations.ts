import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Conversation, ConversationMember, Profile } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export type ConversationWithDetails = Conversation & {
  members: (ConversationMember & { profile: Profile })[];
  unreadCount?: number;
  lastMessage?: string;
};

export function useConversations(userId: string | undefined) {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchConversations = useCallback(async () => {
    if (!userId) return;
    
    try {
      const { data: memberData, error: memberError } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", userId);

      if (memberError) throw memberError;

      const conversationIds = memberData?.map((m) => m.conversation_id) || [];
      
      if (conversationIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const { data: convData, error: convError } = await supabase
        .from("conversations")
        .select("*")
        .in("id", conversationIds)
        .order("updated_at", { ascending: false });

      if (convError) throw convError;

      const conversationsWithDetails: ConversationWithDetails[] = await Promise.all(
        (convData || []).map(async (conv) => {
          const { data: members } = await supabase
            .from("conversation_members")
            .select("*, profiles(*)")
            .eq("conversation_id", conv.id);

          const formattedMembers = (members || []).map((m: any) => ({
            ...m,
            profile: m.profiles as Profile,
          }));

          return {
            ...conv,
            members: formattedMembers,
          } as ConversationWithDetails;
        })
      );

      setConversations(conversationsWithDetails);
    } catch (error: any) {
      console.error("Error fetching conversations:", error);
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("conversation-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_members",
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchConversations]);

  const createDirectChat = async (targetUserCode: string) => {
    if (!userId) throw new Error("Not authenticated");

    const { data: targetProfile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_code", targetUserCode.toUpperCase())
      .single();

    if (profileError || !targetProfile) {
      throw new Error("User not found with that code");
    }

    // Check if conversation already exists
    const { data: existingMembers } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", userId);

    const myConvIds = existingMembers?.map((m) => m.conversation_id) || [];

    if (myConvIds.length > 0) {
      const { data: theirMembers } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", targetProfile.user_id)
        .in("conversation_id", myConvIds);

      if (theirMembers && theirMembers.length > 0) {
        const { data: existingConv } = await supabase
          .from("conversations")
          .select("*")
          .eq("id", theirMembers[0].conversation_id)
          .eq("is_group", false)
          .single();

        if (existingConv) {
          return existingConv;
        }
      }
    }

    // Create new conversation
    const { data: newConv, error: convError } = await supabase
      .from("conversations")
      .insert({
        is_group: false,
        is_channel: false,
        owner_id: userId,
      })
      .select()
      .single();

    if (convError) throw convError;

    // Add both members
    await supabase.from("conversation_members").insert([
      { conversation_id: newConv.id, user_id: userId, role: "owner" },
      { conversation_id: newConv.id, user_id: targetProfile.user_id, role: "member" },
    ]);

    fetchConversations();
    return newConv;
  };

  const createGroup = async (name: string) => {
    if (!userId) throw new Error("Not authenticated");

    const { data: newConv, error: convError } = await supabase
      .from("conversations")
      .insert({
        name,
        is_group: true,
        is_channel: false,
        owner_id: userId,
      })
      .select()
      .single();

    if (convError) throw convError;

    await supabase.from("conversation_members").insert({
      conversation_id: newConv.id,
      user_id: userId,
      role: "owner",
    });

    fetchConversations();
    return newConv;
  };

  const createChannel = async (name: string, hasAudio: boolean = false) => {
    if (!userId) throw new Error("Not authenticated");

    const { data: newConv, error: convError } = await supabase
      .from("conversations")
      .insert({
        name,
        is_group: true,
        is_channel: true,
        has_audio: hasAudio,
        owner_id: userId,
      })
      .select()
      .single();

    if (convError) throw convError;

    await supabase.from("conversation_members").insert({
      conversation_id: newConv.id,
      user_id: userId,
      role: "owner",
    });

    fetchConversations();
    return newConv;
  };

  const joinByCode = async (code: string) => {
    if (!userId) throw new Error("Not authenticated");

    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .select("*")
      .eq("invite_code", code.toUpperCase())
      .single();

    if (convError || !conv) {
      throw new Error("Invalid invite code");
    }

    const { error: memberError } = await supabase
      .from("conversation_members")
      .insert({
        conversation_id: conv.id,
        user_id: userId,
        role: "member",
      });

    if (memberError) {
      if (memberError.code === "23505") {
        throw new Error("You are already a member");
      }
      throw memberError;
    }

    fetchConversations();
    return conv;
  };

  const leaveConversation = async (conversationId: string) => {
    if (!userId) throw new Error("Not authenticated");

    await supabase
      .from("conversation_members")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("user_id", userId);

    fetchConversations();
  };

  const deleteConversation = async (conversationId: string) => {
    if (!userId) throw new Error("Not authenticated");

    await supabase.from("conversations").delete().eq("id", conversationId);

    fetchConversations();
  };

  return {
    conversations,
    loading,
    createDirectChat,
    createGroup,
    createChannel,
    joinByCode,
    leaveConversation,
    deleteConversation,
    refetch: fetchConversations,
  };
}
