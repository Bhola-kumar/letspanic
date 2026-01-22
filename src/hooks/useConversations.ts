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
      setLoading(true);
      // Fetch conversations where user is a member, including all members and their profiles
      const { data: memberData, error: memberError } = await supabase
        .from("conversation_members")
        .select(`
          conversation_id,
          conversation:conversations (
            *,
            members:conversation_members (
              *,
              profile:profiles (*)
            )
          )
        `)
        .eq("user_id", userId);

      if (memberError) throw memberError;

      
      // Fetch unread counts
      const { data: unreadData, error: unreadError } = await supabase.rpc('get_unread_counts' as any);
      
      if (unreadError) {
        console.error("Error fetching unread counts:", unreadError);
      }

      const unreadMap = new Map<string, number>();
      if (unreadData && Array.isArray(unreadData)) {
        unreadData.forEach((item: any) => {
          unreadMap.set(item.conversation_id, Number(item.unread_count));
        });
      }

      const formattedConversations: ConversationWithDetails[] = (memberData || [])
        .map((m: any) => ({
          ...m.conversation,
          unreadCount: unreadMap.get(m.conversation.id) || 0,
        }))
        .filter(Boolean)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

      setConversations(formattedConversations);
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

  const createDirectChat = useCallback(async (targetUsername: string) => {
    if (!userId) throw new Error("Not authenticated");

    const { data: targetProfile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .ilike("username", targetUsername.trim())
      .single();

    if (profileError || !targetProfile) {
      throw new Error("User not found with that username");
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
  }, [userId, fetchConversations]);

  const generateInviteCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };



  const createChannel = useCallback(async (name: string, hasAudio: boolean = false) => {
    if (!userId) throw new Error("Not authenticated");

    const { data: newConv, error: convError } = await supabase
      .from("conversations")
      .insert({
        name,
        is_group: true,
        is_channel: true,
        has_audio: hasAudio,
        owner_id: userId,
        invite_code: generateInviteCode(),
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
  }, [userId, fetchConversations]);

  const joinByCode = useCallback(async (code: string) => {
    if (!userId) throw new Error("Not authenticated");

    const { data: result, error: rpcError } = await supabase.rpc('join_group_by_code', {
      invite_code_input: code.trim().toUpperCase()
    });

    if (rpcError) {
      console.error("RPC Error joining group:", rpcError);
      throw rpcError;
    }

    if (!result.success) {
      throw new Error(result.error);
    }

    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .select(`
        *,
        members:conversation_members (
          *,
          profile:profiles (*)
        )
      `)
      .eq("id", result.conversation_id)
      .single();
    
    if (convError || !conv) {
      console.error("Error fetching joined conversation:", convError);
      // Wait a moment and try again, might be replication lag or RLS catch-up
      await new Promise(resolve => setTimeout(resolve, 1000));
      fetchConversations();
      return { id: result.conversation_id } as ConversationWithDetails; // Return partial if fetch fails
    }

    // Log the join event
    await supabase.from("messages").insert({
      conversation_id: conv.id,
      sender_id: userId,
      message_type: 'system',
      content: JSON.stringify({ type: 'system_log', action: 'joined_group' })
    });

    fetchConversations();
    return conv;
  }, [userId, fetchConversations]);

  const leaveConversation = useCallback(async (conversationId: string) => {
    if (!userId) throw new Error("Not authenticated");

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: userId,
      message_type: 'system',
      content: JSON.stringify({ type: 'system_log', action: 'left_conversation' })
    });

    await supabase
      .from("conversation_members")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("user_id", userId);

    fetchConversations();
  }, [userId, fetchConversations]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    if (!userId) throw new Error("Not authenticated");

    await supabase.from("conversations").delete().eq("id", conversationId);

    fetchConversations();
  }, [userId, fetchConversations]);

  const markAsRead = useCallback(async (conversationId: string) => {
    if (!userId) return;

    // Optimistic update
    setConversations(prev => prev.map(c => {
      if (c.id === conversationId) {
        return { ...c, unreadCount: 0 };
      }
      return c;
    }));

    // Use a unique toast ID or debounce? 
    // Actually, optimistic update renders component -> triggers effect again? 
    // Effect depends on [conversation.id, messages, messagesLoading, onMarkAsRead]
    // If onMarkAsRead is stable (now it is via useCallback), effect ONLY runs on mount 
    // OR when 'messages' reference changes.
    // So if messages don't change, we are good.

    const { error } = await supabase.rpc('mark_conversation_read' as any, {
      p_conversation_id: conversationId
    });

    if (error) {
      console.error("Error marking conversation as read:", error);
    } 
  }, [userId]);

  const addMemberByUsername = useCallback(async (conversationId: string, username: string) => {
    if (!userId) throw new Error("Not authenticated");

    const { data: targetProfile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .ilike("username", username.trim())
      .single<Profile>();

    if (profileError || !targetProfile) {
      throw new Error("User not found with that username");
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
        .from("conversation_members")
        .select("*")
        .eq("conversation_id", conversationId)
        .eq("user_id", targetProfile.user_id)
        .single();
    
    if (existingMember) {
        throw new Error("User is already a member of this room");
    }

    const { error: insertError } = await supabase
      .from("conversation_members")
      .insert({
        conversation_id: conversationId,
        user_id: targetProfile.user_id,
        role: "member",
      });

    if (insertError) throw insertError;

    // Log the add event
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: userId,
      message_type: 'system',
      content: JSON.stringify({ 
         type: 'system_log', 
         action: 'added_member', 
         targetName: targetProfile.display_name || targetProfile.username 
      })
    });

    // Trigger update? Realtime should handle it, but fetch to be sure
    // We send a toast/notification? Realtime subscription handles list update.
  }, [userId]);

  return {
    conversations,
    loading,
    createDirectChat,
    createChannel,
    joinByCode,
    leaveConversation,
    deleteConversation,
    markAsRead,
    refetch: fetchConversations,
    addMemberByUsername,
  };
}
