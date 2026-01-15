import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Send,
  Paperclip,
  Image,
  File,
  MoreVertical,
  Copy,
  Trash2,
  LogOut,
  Users,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Download,
  X,
} from "lucide-react";
import type { Profile } from "@/lib/supabase";
import type { ConversationWithDetails } from "@/hooks/useConversations";
import type { MessageWithSender } from "@/hooks/useMessages";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, isYesterday } from "date-fns";

interface ChatAreaProps {
  conversation: ConversationWithDetails;
  messages: MessageWithSender[];
  messagesLoading: boolean;
  profile: Profile;
  onSendMessage: (content: string) => Promise<void>;
  onSendFile: (file: File, type: "image" | "file" | "video" | "audio") => Promise<void>;
  onDeleteMessage: (id: string) => Promise<void>;
  onLeave: () => Promise<void>;
  onDelete: () => Promise<void>;
  isOwner: boolean;
}

export function ChatArea({
  conversation,
  messages,
  messagesLoading,
  profile,
  onSendMessage,
  onSendFile,
  onDeleteMessage,
  onLeave,
  onDelete,
  isOwner,
}: ChatAreaProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [inAudioRoom, setInAudioRoom] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      await onSendMessage(message.trim());
      setMessage("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "file") => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await onSendFile(file, type);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
    e.target.value = "";
  };

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(conversation.invite_code);
    toast({ title: "Copied!", description: "Invite code copied to clipboard" });
  };

  const formatMessageDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, "h:mm a");
    if (isYesterday(date)) return `Yesterday ${format(date, "h:mm a")}`;
    return format(date, "MMM d, h:mm a");
  };

  const getConversationTitle = () => {
    if (conversation.is_group || conversation.is_channel) return conversation.name || "Unnamed";
    const other = conversation.members.find((m) => m.user_id !== profile.user_id);
    return other?.profile?.display_name || other?.profile?.email || "Unknown";
  };

  const getOtherUserAvatar = () => {
    if (conversation.avatar_url) return conversation.avatar_url;
    if (!conversation.is_group && !conversation.is_channel) {
      const other = conversation.members.find((m) => m.user_id !== profile.user_id);
      return other?.profile?.avatar_url;
    }
    return null;
  };

  const renderMessage = (msg: MessageWithSender) => {
    const isOwn = msg.sender_id === profile.user_id;
    const showFile = msg.message_type !== "text" && msg.file_url;

    return (
      <div
        key={msg.id}
        className={`flex gap-3 group animate-slide-in ${isOwn ? "flex-row-reverse" : ""}`}
      >
        {!isOwn && (
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={msg.sender?.avatar_url || undefined} />
            <AvatarFallback>
              {msg.sender?.display_name?.[0] || msg.sender?.email?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}

        <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
          {!isOwn && (
            <span className="text-xs text-muted-foreground mb-1">
              {msg.sender?.display_name || msg.sender?.email}
            </span>
          )}

          <div className={isOwn ? "message-bubble-sent" : "message-bubble-received"}>
            {showFile ? (
              <div className="space-y-2">
                {msg.message_type === "image" && (
                  <img
                    src={msg.file_url!}
                    alt={msg.file_name || "Image"}
                    className="max-w-xs rounded-lg"
                  />
                )}
                {msg.message_type === "file" && (
                  <a
                    href={msg.file_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm hover:underline"
                  >
                    <File className="h-4 w-4" />
                    {msg.file_name || "Download file"}
                    <Download className="h-3 w-3" />
                  </a>
                )}
                {msg.message_type === "video" && (
                  <video
                    src={msg.file_url!}
                    controls
                    className="max-w-xs rounded-lg"
                  />
                )}
                {msg.message_type === "audio" && (
                  <audio src={msg.file_url!} controls className="max-w-xs" />
                )}
              </div>
            ) : (
              <p className="text-sm">{msg.content}</p>
            )}
          </div>

          <span className="text-xs text-muted-foreground mt-1">
            {formatMessageDate(msg.created_at)}
          </span>
        </div>

        {isOwn && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onDeleteMessage(msg.id)} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={getOtherUserAvatar() || undefined} />
            <AvatarFallback>{getConversationTitle()[0]}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold">{getConversationTitle()}</h2>
            <p className="text-xs text-muted-foreground">
              {conversation.members.length} member{conversation.members.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {conversation.has_audio && (
            <>
              {inAudioRoom ? (
                <>
                  <Button
                    variant={isMuted ? "destructive" : "secondary"}
                    size="icon"
                    onClick={() => setIsMuted(!isMuted)}
                  >
                    {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => setInAudioRoom(false)}
                  >
                    <PhoneOff className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setInAudioRoom(true)}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Join Voice
                </Button>
              )}
            </>
          )}

          <Dialog open={showMembers} onOpenChange={setShowMembers}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Users className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Members ({conversation.members.length})</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {conversation.members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.profile?.avatar_url || undefined} />
                      <AvatarFallback>
                        {member.profile?.display_name?.[0] || member.profile?.email?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {member.profile?.display_name || member.profile?.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {member.role === "owner" ? "Owner" : member.role === "admin" ? "Admin" : "Member"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(conversation.is_group || conversation.is_channel) && (
                <DropdownMenuItem onClick={handleCopyInvite}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy invite code: {conversation.invite_code}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLeave} className="text-warning">
                <LogOut className="mr-2 h-4 w-4" />
                Leave
              </DropdownMenuItem>
              {isOwner && (
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Audio Room Indicator */}
      {inAudioRoom && (
        <div className="px-6 py-3 bg-success/10 border-b border-success/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-3 h-3 bg-success rounded-full" />
              <div className="absolute inset-0 w-3 h-3 bg-success rounded-full animate-pulse-ring" />
            </div>
            <span className="text-sm text-success font-medium">
              Connected to voice channel
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setInAudioRoom(false)}
            className="text-success hover:text-success"
          >
            <X className="h-4 w-4 mr-1" />
            Disconnect
          </Button>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-6 scrollbar-thin">
        <div className="space-y-4 max-w-3xl mx-auto">
          {messagesLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <p className="text-muted-foreground">No messages yet</p>
              <p className="text-sm text-muted-foreground">Start the conversation!</p>
            </div>
          ) : (
            messages.map(renderMessage)
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFileSelect(e, "file")}
            className="hidden"
          />
          <input
            type="file"
            ref={imageInputRef}
            accept="image/*,video/*"
            onChange={(e) => handleFileSelect(e, "image")}
            className="hidden"
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <Paperclip className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
                <Image className="mr-2 h-4 w-4" />
                Image / Video
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <File className="mr-2 h-4 w-4" />
                File
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Input
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            className="flex-1 bg-input border-border"
          />

          <Button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            size="icon"
            className="shrink-0"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
