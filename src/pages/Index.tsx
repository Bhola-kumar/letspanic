import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useConversations, ConversationWithDetails } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { LoginScreen } from "@/components/chat/LoginScreen";
import { Sidebar } from "@/components/chat/Sidebar";
import { usePresence } from "@/hooks/usePresence";
import { ChatArea } from "@/components/chat/ChatArea";
import { EmptyState } from "@/components/chat/EmptyState";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const { user, profile, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithDetails | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const { toast } = useToast();
  
  usePresence(user?.id);

  const {
    conversations,
    loading: convsLoading,
    createDirectChat,
    createGroup,
    createChannel,
    joinByCode,
    leaveConversation,
    deleteConversation,
    refetch: refetchConversations,
  } = useConversations(user?.id);

  const {
    messages,
    loading: msgsLoading,
    sendMessage,
    sendFileMessage,
    deleteMessage,
  } = useMessages(selectedConversation?.id || null, user?.id);

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
    const conv = await createDirectChat(code);
    const fullConv = conversations.find((c) => c.id === conv.id);
    if (fullConv) setSelectedConversation(fullConv);
    else {
      await refetchConversations();
    }
  };

  const handleCreateGroup = async (name: string) => {
    await createGroup(name);
  };

  const handleCreateChannel = async (name: string, hasAudio: boolean) => {
    await createChannel(name, hasAudio);
  };

  const handleJoinByCode = async (code: string) => {
    await joinByCode(code);
  };

  const handleLeave = async () => {
    if (!selectedConversation) return;
    await leaveConversation(selectedConversation.id);
    setSelectedConversation(null);
  };

  const handleDelete = async () => {
    if (!selectedConversation) return;
    await deleteConversation(selectedConversation.id);
    setSelectedConversation(null);
  };

  const handleSendMessage = async (content: string) => {
    await sendMessage(content);
  };

  const handleSendFile = async (file: File, type: "image" | "file" | "video" | "audio") => {
    await sendFileMessage(file, type);
  };

  const handleDeleteMessage = async (id: string) => {
    await deleteMessage(id);
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

  const isOwner = selectedConversation?.owner_id === user.id;

  // Mobile: single-pane - show list first, then chat. Desktop: two-pane layout.
  if (isMobile) {
    return (
      <div className="h-[100dvh] w-full flex overflow-hidden bg-background">
        {!selectedConversation ? (
          <Sidebar
            profile={profile}
            conversations={conversations}
            selectedConversation={selectedConversation}
            onSelectConversation={setSelectedConversation}
            onCreateDirectChat={handleCreateDirectChat}
            onCreateGroup={handleCreateGroup}
            onCreateChannel={handleCreateChannel}
            onJoinByCode={handleJoinByCode}
            onSignOut={signOut}
          />
        ) : (
          <ChatArea
            conversation={selectedConversation}
            messages={messages}
            messagesLoading={msgsLoading}
            profile={profile}
            onSendMessage={handleSendMessage}
            onSendFile={handleSendFile}
            onDeleteMessage={handleDeleteMessage}
            onLeave={handleLeave}
            onDelete={handleDelete}
            isOwner={isOwner}
            onBack={() => setSelectedConversation(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex overflow-hidden bg-background">
      <Sidebar
        profile={profile}
        conversations={conversations}
        selectedConversation={selectedConversation}
        onSelectConversation={setSelectedConversation}
        onCreateDirectChat={handleCreateDirectChat}
        onCreateGroup={handleCreateGroup}
        onCreateChannel={handleCreateChannel}
        onJoinByCode={handleJoinByCode}
        onSignOut={signOut}
      />
      
      {selectedConversation ? (
        <ChatArea
          conversation={selectedConversation}
          messages={messages}
          messagesLoading={msgsLoading}
          profile={profile}
          onSendMessage={handleSendMessage}
          onSendFile={handleSendFile}
          onDeleteMessage={handleDeleteMessage}
          onLeave={handleLeave}
          onDelete={handleDelete}
          isOwner={isOwner}
        />
      ) : (
        <EmptyState />
      )}
    </div>
  );
};

export default Index;
