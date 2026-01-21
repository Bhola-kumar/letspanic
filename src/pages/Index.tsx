import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useConversations, ConversationWithDetails } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { supabase } from "@/lib/supabase";
import { LoginScreen } from "@/components/chat/LoginScreen";
import { UsernameSetup } from "@/components/auth/UsernameSetup";
import { Sidebar } from "@/components/chat/Sidebar";
import { usePresence } from "@/hooks/usePresence";
import { ChatArea } from "@/components/chat/ChatArea";
import { EmptyState } from "@/components/chat/EmptyState";
import { useToast } from "@/hooks/use-toast";

import { CallOverlay } from "@/components/chat/CallOverlay";
import { useCallSystem } from "@/hooks/useCallSystem";
import { useVoiceRoom } from "@/hooks/useVoiceRoom";
import { ParticipantAudio } from "@/components/chat/ParticipantAudio";

const Index = () => {
  const { user, profile, loading: authLoading, signInWithGoogle, signOut, updateProfile } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithDetails | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const { toast } = useToast();

  const {
    callState,
    callData,
    initiateCall,
    acceptCall,
    declineCall,
    cancelCall,
    endCall
  } = useCallSystem(user?.id, profile);

  // We need to useVoiceRoom here to actually join/leave the room when call is accepted/ended
  // But useVoiceRoom expects a single conversationId.
  // We can pass the conversationId from callData.
  const { 
    joinRoom, 
    leaveRoom, 
    toggleMute, 
    isMuted, 
    inAudioRoom, 
    participants, 
    audioInputs, 
    audioOutputs,
    selectedInput, 
    selectedOutput,
    switchDevice,
    switchOutput 
  } = useVoiceRoom(callData?.conversationId || null, user?.id);

  usePresence(user?.id);

  // Sync call state with voice room
  useEffect(() => {
    if (callState === 'connected') {
      joinRoom();
    } else if (callState === 'idle' || callState === 'ending') {
      leaveRoom();
    }
  }, [callState, joinRoom, leaveRoom]);

  const {
    conversations,
    loading: conversationsLoading,
    createDirectChat,
    createChannel,
    joinByCode,
    leaveConversation,
    deleteConversation,
    markAsRead,
    refetch: refetchConversations,
    addMemberByUsername,
  } = useConversations(user?.id);

  const {
    messages,
    loading: messagesLoading,
    sendMessage,
    sendFileMessage: sendFile,
    deleteMessage,
  } = useMessages(selectedConversation?.id || null, user?.id);

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Global message listener for notifications
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('global-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          // If we are looking at this conversation and window is focused, don't notify
          const isCurrentConv = selectedConversation?.id === payload.new.conversation_id;
          const isHidden = document.hidden;

          if ((!isCurrentConv || isHidden) && payload.new.sender_id !== user.id) {
            // Fetch sender info for notification
            const { data: sender } = await supabase
              .from('profiles')
              .select('display_name, email')
              .eq('user_id', payload.new.sender_id)
              .single();

            const senderName = sender?.display_name || sender?.email?.split('@')[0] || 'Someone';

            if ("Notification" in window && Notification.permission === "granted") {
              new Notification(`New message from ${senderName}`, {
                body: payload.new.message_type === 'text' ? payload.new.content : `Sent a ${payload.new.message_type}`,
                icon: '/placeholder.svg'
              });
            }
            // Also refetch conversations to update badges
            refetchConversations();
          } else if (isCurrentConv && !isHidden) {
            // We are looking at it, so we can mark as read immediately or let the ChatArea effect handle it.
            // But ChatArea effects depend on 'messages' changing.
            // Since we are in the parent, we can just optionally refetch if needed,
            // but useMessages inside ChatArea subscribes to its own messages, so UI updates automatically.
            // Just update unread counts (badges) globally if we were in another chat.
            if (!isCurrentConv) refetchConversations();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, selectedConversation?.id, refetchConversations]);

  useEffect(() => {
    // Check for joinCode in URL
    const params = new URLSearchParams(window.location.search);
    const code = params.get('joinCode');

    if (code && user?.id) {
        // Auto-join
        // We might want to clear the param so it doesn't re-join on refresh?
        // Or show a dialog "Do you want to join..."
        // For now, let's try auto-join and notify.
        
        // Remove param from URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);

        joinByCode(code).then((conv) => {
             toast({ title: "Joined Room", description: `You joined ${conv.name || 'the room'}`});
             if (conv) {
                // Determine if we need to fetch details or if joinByCode returns enough
                // joinByCode returns partial or full. 
                // We should select it.
                // But conversations list might update asynchronously.
                // Let's set selectedConversation if it's returns with details.
                // Usually fetchConversations will update the list, and we select it from there.
                
                // Let's rely on conversations update.
             }
        }).catch(err => {
             toast({ title: "Join Failed", description: err.message, variant: "destructive" });
        });
    }
  }, [user?.id, joinByCode, toast]);

  // Update selected conversation when conversations change
  useEffect(() => {
    if (selectedConversation) {
      const updated = conversations.find((c) => c.id === selectedConversation.id);
      if (updated) {
        setSelectedConversation(updated);
      } else {
        setSelectedConversation(null);
      }
    }
  }, [conversations]);

  // Check valid conversation
  useEffect(() => {
    const checkConversation = async () => {
      if (selectedConversation) {
        const { data: isValid } = await supabase
          .rpc('is_conversation_member', {
            _conversation_id: selectedConversation.id,
            _user_id: user?.id
          });

        if (!isValid) {
          setSelectedConversation(null);
          toast({
            title: "Access Denied",
            description: "You are no longer a member of this conversation",
            variant: "destructive",
          });
        }
      }
    };

    checkConversation();
  }, [selectedConversation?.id, user?.id]);

  // Detect mobile viewport to render a single-pane experience
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCreateDirectChat = async (code: string) => {
    try {
      const conv = await createDirectChat(code);
      const fullConv = conversations.find((c) => c.id === conv.id);
      if (fullConv) setSelectedConversation(fullConv);
      else {
        await refetchConversations();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };



  const handleCreateChannel = async (name: string, hasAudio: boolean) => {
    try {
      await createChannel(name, hasAudio);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleJoinByCode = async (code: string) => {
    try {
      await joinByCode(code);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLeave = async () => {
    if (!selectedConversation) return;
    try {
      await leaveConversation(selectedConversation.id);
      setSelectedConversation(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedConversation) return;
    try {
      await deleteConversation(selectedConversation.id);
      setSelectedConversation(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = async (content: string) => {
    await sendMessage(content);
  };

  const handleSendFile = async (file: File, type: "image" | "file" | "video" | "audio") => {
    await sendFile(file, type);
  };

  const handleDeleteMessage = async (id: string) => {
    try {
      await deleteMessage(id);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddMember = async (conversationId: string, username: string) => {
    try {
        if (addMemberByUsername) {
            await addMemberByUsername(conversationId, username);
        }
    } catch (error: any) {
        toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
        });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user || !profile) {
    return <LoginScreen onGoogleLogin={handleGoogleLogin} loading={authLoading} />;
  }

  // Force username setup
  if (!profile.username) {
    return (
      <UsernameSetup
        onComplete={() => {
           // Reload profile to reflect changes
           window.location.reload();
        }}
      />
    );
  }

  const isOwner = selectedConversation?.owner_id === user.id;

  // Mobile: single-pane - show list first, then chat. Desktop: two-pane layout.
  if (isMobile) {
    return (
      <div className="h-[100dvh] w-full flex overflow-hidden bg-background">
         <CallOverlay
          callState={callState}
          callData={callData}
          onAccept={acceptCall}
          onDecline={declineCall}
          onCancel={cancelCall}
          onEnd={endCall}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          audioOutputs={audioOutputs}
          selectedOutput={selectedOutput}
          onSwitchOutput={switchOutput}
        />
        {/* Global Audio Rendering */}
        {participants.map((p: any) => (
          <ParticipantAudio 
            key={p.user_id} 
            userId={p.user_id} 
            stream={p.stream} 
            outputDeviceId={selectedOutput || undefined}
           />
        ))}

        {!selectedConversation ? (
          <Sidebar
            profile={profile}
            conversations={conversations}
            selectedConversation={selectedConversation}
            onSelectConversation={setSelectedConversation}
            onCreateDirectChat={handleCreateDirectChat}
            onCreateChannel={handleCreateChannel}
            onJoinByCode={handleJoinByCode}
            onSignOut={signOut}
          />
        ) : (
          <ChatArea
            conversation={selectedConversation}
            messages={messages}
            messagesLoading={messagesLoading}
            profile={profile}
            onSendMessage={handleSendMessage}
            onSendFile={handleSendFile}
            onDeleteMessage={handleDeleteMessage}
            onLeave={handleLeave}
            onDelete={handleDelete}
            isOwner={isOwner}
            onBack={() => setSelectedConversation(null)}
            onMarkAsRead={markAsRead}
            currentUserId={user.id}
            onInitiateCall={initiateCall}
            inAudioRoom={inAudioRoom}
            participants={participants}
            isMuted={isMuted}
            toggleMute={toggleMute}
            leaveRoom={leaveRoom}
            audioInputs={audioInputs}
            selectedInput={selectedInput}
            onSwitchDevice={switchDevice}
            joinRoom={joinRoom}
            onAddMember={handleAddMember}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex overflow-hidden bg-background">
      <CallOverlay
          callState={callState}
          callData={callData}
          onAccept={acceptCall}
          onDecline={declineCall}
          onCancel={cancelCall}
          onEnd={endCall}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          audioOutputs={audioOutputs}
          selectedOutput={selectedOutput}
          onSwitchOutput={switchOutput}
        />
      <Sidebar
        profile={profile}
        conversations={conversations}
        selectedConversation={selectedConversation}
        onSelectConversation={setSelectedConversation}
        onCreateDirectChat={handleCreateDirectChat}
        onCreateChannel={handleCreateChannel}
        onJoinByCode={handleJoinByCode}
        onSignOut={signOut}
      />

      {selectedConversation ? (
        <ChatArea
          conversation={selectedConversation}
          messages={messages}
          messagesLoading={messagesLoading}
          profile={profile}
          onSendMessage={handleSendMessage}
          onSendFile={handleSendFile}
          onDeleteMessage={handleDeleteMessage}
          onLeave={handleLeave}
          onDelete={handleDelete}
          isOwner={isOwner}
          onMarkAsRead={markAsRead}
          currentUserId={user.id}
          onInitiateCall={initiateCall}
          inAudioRoom={inAudioRoom}
          participants={participants}
          isMuted={isMuted}
          toggleMute={toggleMute}
          joinRoom={joinRoom}
          leaveRoom={leaveRoom}
          audioInputs={audioInputs}
          selectedInput={selectedInput}
          onSwitchDevice={switchDevice}
          onAddMember={handleAddMember}
        />
      ) : (
        <EmptyState />
      )}
    </div>
  );
};

export default Index;
