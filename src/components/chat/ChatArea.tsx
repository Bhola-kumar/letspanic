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
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  UserPlus,
  Send,
  Paperclip,
  Image,
  File,
  MoreVertical,
  Trash2,
  LogOut,
  Users,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Download,
  X,
  Copy,
  ArrowLeft,
  Zap,
  ZapOff,
  Settings,
} from "lucide-react";
import type { Profile } from "@/lib/supabase";
import type { ConversationWithDetails } from "@/hooks/useConversations";
import type { MessageWithSender } from "@/hooks/useMessages";
import { useToast } from "@/hooks/use-toast";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { useFlashChat } from "@/hooks/useFlashChat";
import { useVoiceRoom } from "@/hooks/useVoiceRoom";
import { useTranscription } from "@/hooks/useTranscription";
import { ParticipantAudio } from "@/components/chat/ParticipantAudio";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { OnlineStatus } from "@/components/chat/OnlineStatus";
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
  onBack?: () => void;
  onMarkAsRead: (id: string) => Promise<void>;
  currentUserId: string;
  onInitiateCall: (conversationId: string, targetUser: Profile) => Promise<void>;
  // Voice Room Props
  inAudioRoom: boolean;
  participants: any[]; // Participant type is not exported, using any for now or need export
  isMuted: boolean;
  toggleMute: () => void;
  leaveRoom: () => void;
  audioInputs: MediaDeviceInfo[];
  selectedInput: string | null;
  onSwitchDevice: (deviceId: string) => void;
  joinRoom: (deviceId?: string, overrideConversationId?: string) => Promise<void>;
  onAddMember: (conversationId: string, username: string) => Promise<void>;
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
  onBack,
  onMarkAsRead,
  currentUserId,
  onInitiateCall,
  inAudioRoom,
  participants,
  isMuted,
  toggleMute,
  leaveRoom,
  audioInputs,
  selectedInput,
  onSwitchDevice,
  joinRoom,
  onAddMember,
}: ChatAreaProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [isFlashMode, setIsFlashMode] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMemberUsername, setNewMemberUsername] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  
  // Removed local useVoiceRoom hook to use parent state

  const { current: liveTranscript, isFinal: liveIsFinal, supported: transcriptionSupported } = useTranscription(inAudioRoom);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { typingUsers, sendTyping, stopTyping } = useTypingIndicator(
    conversation.id,
    profile.user_id,
    profile.display_name || profile.email.split("@")[0]
  );

  const { flashMessages, sendFlashMessage, toggleFlashMode, clearFlashMessages } = useFlashChat(
    conversation.id,
    profile.user_id,
    profile,
    isFlashMode,
    setIsFlashMode
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, typingUsers, flashMessages]);

  // Clear flash messages when switching conversations
  // Clear flash messages when switching conversations
  useEffect(() => {
    clearFlashMessages();
  }, [conversation.id, clearFlashMessages]);

  useEffect(() => {
    if (conversation.id && !messagesLoading) {
      onMarkAsRead(conversation.id);
    }
  }, [conversation.id, messages, messagesLoading, onMarkAsRead]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    if (e.target.value.trim()) {
      sendTyping();
    }
  };

  const handleSend = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    stopTyping();
    try {
      if (isFlashMode) {
        await sendFlashMessage(message.trim());
      } else {
        await onSendMessage(message.trim());
      }
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

  const handleToggleFlash = async () => {
    const nextState = !isFlashMode;
    await toggleFlashMode(nextState);
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

  const formatMessageTime = (dateStr: string) => {
    return format(new Date(dateStr), "h:mm a");
  };

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "MMMM d, yyyy");
  };

  const getOtherUser = () => {
    if (conversation.is_group || conversation.is_channel) return null;
    return conversation.members.find((m) => m.user_id !== profile.user_id);
  };

  const getConversationTitle = () => {
    if (conversation.is_group || conversation.is_channel) return conversation.name || "Unnamed";
    const other = getOtherUser();
    return other?.profile?.display_name || other?.profile?.email?.split("@")[0] || "Chat";
  };

  const getOtherUserAvatar = () => {
    if (conversation.avatar_url) return conversation.avatar_url;
    const other = getOtherUser();
    return other?.profile?.avatar_url;
  };

  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase();
  };

  const getSenderName = (sender: Profile | null | undefined) => {
    if (!sender) return "Unknown";
    return sender.display_name || sender.email?.split("@")[0] || "User";
  };

  // Group messages by date
  const getMessagesWithDates = () => {
    const result: { type: "date" | "message"; date?: string; message?: MessageWithSender }[] = [];
    let lastDate = "";

    messages.forEach((msg) => {
      const msgDate = new Date(msg.created_at).toDateString();
      if (msgDate !== lastDate) {
        result.push({ type: "date", date: msg.created_at });
        lastDate = msgDate;
      }
      result.push({ type: "message", message: msg });
    });

    return result;
  };

  const renderMessage = (msg: MessageWithSender, showAvatar: boolean, isFirstInGroup: boolean) => {
    const isOwn = msg.sender_id === profile.user_id;
    const showFile = msg.message_type !== "text" && msg.file_url;
    const senderName = getSenderName(msg.sender);

    return (
      <div
        key={msg.id}
        className={`flex gap-2 group animate-enter ${isOwn ? "flex-row-reverse" : ""} ${isFirstInGroup ? "mt-4" : "mt-0.5"}`}
      >
        {!isOwn && (
          <div className="w-7 shrink-0">
            {showAvatar && (
              <Avatar className="h-7 w-7 ring-1 ring-border/50 shadow-sm">
                <AvatarImage src={msg.sender?.avatar_url || undefined} />
                <AvatarFallback className="bg-secondary text-[10px] font-medium">
                  {getInitials(senderName)}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        )}

        <div className={`flex flex-col max-w-[70%] ${isOwn ? "items-end" : "items-start"}`}>
          <div
            className={`
              relative px-3 py-2 rounded-xl shadow-sm transition-all duration-200 group
              ${isOwn 
                ? "bg-primary text-primary-foreground rounded-br-sm" 
                : "bg-secondary/80 text-foreground rounded-bl-sm backdrop-blur-sm"
              }
              hover:shadow-md
            `}
          >
            {showFile ? (
              <div className="space-y-2">
                {msg.message_type === "image" && (
                  <img
                    src={msg.file_url!}
                    alt={msg.file_name || "Image"}
                    className="max-w-xs rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(msg.file_url!, "_blank")}
                  />
                )}
                {msg.message_type === "file" && (
                  <a
                    href={msg.file_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs hover:underline p-2 bg-background/20 rounded-md"
                  >
                    <File className="h-3.5 w-3.5" />
                    <span className="truncate max-w-[150px]">{msg.file_name || "Download file"}</span>
                    <Download className="h-3 w-3 ml-auto" />
                  </a>
                )}
                {msg.message_type === "video" && (
                  <video
                    src={msg.file_url!}
                    controls
                    className="max-w-xs rounded-md"
                  />
                )}
                {msg.message_type === "audio" && (
                  <audio src={msg.file_url!} controls className="max-w-xs" />
                )}
                {/* System / Call Log Message */}
                {msg.message_type === "system" && (() => {
                    try {
                        const data = JSON.parse(msg.content || "{}");
                        if (data.type === 'call_log') {
                            return (
                                <div className="flex items-center gap-3 py-1 min-w-[150px]">
                                    <div className={`p-2 rounded-full ${data.status === 'missed' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                                        {data.status === 'missed' || data.status === 'declined' ? <PhoneOff className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-sm capitalize">
                                            {data.status === 'missed' ? 'Missed Call' : 
                                             data.status === 'declined' ? 'Call Declined' : 
                                             'Voice Call'}
                                        </span>
                                        {data.duration && (
                                            <span className="text-xs opacity-80">{data.duration}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        }
                        if (data.type === 'system_log') {
                            let text = "";
                            if (data.action === 'joined_group') text = "joined the room";
                            if (data.action === 'left_conversation') text = "left the conversation";
                            if (data.action === 'added_member') text = `added ${data.targetName}`;
                            
                            if (data.action === 'added_member') text = `added ${data.targetName}`;
                            
                            const senderMember = conversation.members.find(m => m.user_id === msg.sender_id);
                            const senderName = isOwn ? "You" : getSenderName(senderMember?.profile);

                            return (
                                <div className="flex items-center justify-center gap-2 py-0.5 opacity-70">
                                    <span className="text-xs italic">
                                       {senderName} {text}
                                    </span>
                                </div>
                            );
                        }
                    } catch (e) {}
                    return <p className="text-sm font-medium italic text-center opacity-80">{msg.content}</p>;
                })()}
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap break-words leading-snug pr-4">{msg.content}</p>
            )}

            {/* Overlay Actions */}
            {isOwn && (
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div className="bg-background/20 backdrop-blur rounded-full p-0.5 shadow-sm cursor-pointer hover:bg-background/40">
                      <MoreVertical className="h-3 w-3 text-current" />
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="glass-card">
                    <DropdownMenuItem onClick={() => onDeleteMessage(msg.id)} className="text-destructive gap-2 text-xs cursor-pointer">
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-1 mt-0.5 mx-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[9px] text-muted-foreground">
              {formatMessageTime(msg.created_at)}
            </span>
            {isOwn && msg.message_type !== "system" && (
              <span className="text-[9px]">
                {msg.created_at ? (
                  conversation.members.some(m => m.user_id !== profile.user_id && new Date(m.last_read_at) >= new Date(msg.created_at)) ? (
                    <span className="text-primary font-bold">✓✓</span>
                  ) : (
                    <span className="text-muted-foreground">✓</span>
                  )
                ) : null}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const otherUser = getOtherUser();
  const messagesWithDates = getMessagesWithDates();

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* Header - Compact */}
      <div className="flex-none h-14 px-4 flex items-center justify-between border-b border-border/50 bg-card/80 backdrop-blur-xl z-20">
        <div className="flex items-center gap-3">
          {/* Mobile back button (only shown when onBack provided) */}
          {typeof onBack === "function" && (
            <div className="md:hidden mr-1">
              <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="relative">
            <Avatar className="h-8 w-8 ring-1 ring-primary/20">
              <AvatarImage src={getOtherUserAvatar() || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                {getInitials(getConversationTitle())}
              </AvatarFallback>
            </Avatar>
            {otherUser?.profile?.is_online && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[hsl(var(--online))] rounded-full ring-2 ring-background" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <h2 className="font-semibold text-sm leading-none mb-0.5 truncate max-w-[100px] xs:max-w-[150px] sm:max-w-none">{getConversationTitle()}</h2>
            {conversation.is_group || conversation.is_channel ? (
              <p className="text-[10px] text-muted-foreground">
                {conversation.members.length} member{conversation.members.length !== 1 ? "s" : ""}
              </p>
            ) : otherUser?.profile ? (
              <div className="scale-90 origin-left">
                <OnlineStatus 
                  isOnline={otherUser.profile.is_online || false} 
                  lastSeen={otherUser.profile.last_seen}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Flash Mode Toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isFlashMode ? "default" : "ghost"}
                  size="icon"
                  onClick={handleToggleFlash}
                  className={`h-9 w-9 ${isFlashMode ? "bg-warning text-warning-foreground hover:bg-warning/90" : ""}`}
                >
                  {isFlashMode ? <Zap className="h-4 w-4" /> : <ZapOff className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isFlashMode ? "Flash Mode ON - Messages won't be saved" : "Enable Flash Mode"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Dialogs for Actions */}
          <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
             <DialogContent className="sm:max-w-md">
                   <DialogHeader>
                     <DialogTitle>Add Member</DialogTitle>
                     <DialogDescription>
                       Enter the username of the person you want to add.
                     </DialogDescription>
                   </DialogHeader>
                   <div className="flex items-center space-x-2">
                       <Input
                         placeholder="Username"
                         value={newMemberUsername}
                         onChange={(e) => setNewMemberUsername(e.target.value)}
                       />
                       <Button 
                           type="button" 
                           size="sm" 
                           className="px-3"
                           disabled={!newMemberUsername || addingMember}
                           onClick={async () => {
                               setAddingMember(true);
                               try {
                                   await onAddMember(conversation.id, newMemberUsername);
                                   setAddMemberOpen(false);
                                   setNewMemberUsername("");
                                   toast({ title: "Success", description: "User added to the room" });
                               } catch (e: any) {
                                   toast({ title: "Error", description: e.message, variant: "destructive" });
                               } finally {
                                   setAddingMember(false);
                               }
                           }}
                       >
                           {addingMember ? "Adding..." : "Add"}
                       </Button>
                   </div>
             </DialogContent>
          </Dialog>

          {(conversation.is_group || conversation.is_channel) && (
             <Dialog open={showMembers} onOpenChange={setShowMembers}>
               <DialogContent className="max-w-md">
                 <DialogHeader>
                   <DialogTitle>Members ({conversation.members.length})</DialogTitle>
                   <DialogDescription>
                     People in this conversation
                   </DialogDescription>
                 </DialogHeader>
                 <div className="space-y-2 max-h-80 overflow-y-auto">
                 {conversation.members.map((member) => (
                   <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                     <div className="relative">
                       <Avatar className="h-10 w-10">
                         <AvatarImage src={member.profile?.avatar_url || undefined} />
                         <AvatarFallback className="bg-secondary">
                           {getInitials(getSenderName(member.profile))}
                         </AvatarFallback>
                       </Avatar>
                       {member.profile?.is_online && (
                         <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[hsl(var(--online))] rounded-full ring-2 ring-background" />
                       )}
                     </div>
                     <div className="flex-1 min-w-0">
                       <p className="font-medium truncate">
                         {getSenderName(member.profile)}
                         {member.user_id === profile.user_id && (
                           <span className="text-muted-foreground text-xs ml-2">(You)</span>
                         )}
                       </p>
                       <div className="flex items-center gap-2">
                         <span className="text-xs text-muted-foreground capitalize px-1.5 py-0.5 bg-secondary rounded">
                           {member.role}
                         </span>
                         {member.profile && (
                           <OnlineStatus 
                             isOnline={member.profile.is_online || false} 
                             lastSeen={member.profile.last_seen}
                             showText={!member.profile.is_online}
                           />
                         )}
                       </div>
                     </div>
                   </div>
                 ))}
                 </div>
               </DialogContent>
             </Dialog>
           )}

          {conversation.has_audio && (
            <>
              {inAudioRoom ? (
                <>
                  <Button
                    variant={isMuted ? "destructive" : "secondary"}
                    size="icon"
                    onClick={toggleMute}
                    className="h-9 w-9"
                  >
                    {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={leaveRoom}
                    className="h-9 w-9"
                  >
                    <PhoneOff className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => joinRoom(selectedInput || undefined, conversation.id)}
                  className="gap-2 px-2 sm:px-3"
                >
                  <Phone className="h-4 w-4" />
                  <span className="hidden sm:inline">Join Voice</span>
                </Button>
              )}
            </>
          )}

          {(!conversation.is_group && !conversation.is_channel) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9"
                    onClick={async () => {
                        const otherMember = conversation.members.find(m => m.user_id !== currentUserId);
                        if (otherMember?.profile) {
                            await onInitiateCall(conversation.id, otherMember.profile);
                        }
                    }}
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Call</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {(conversation.is_group || conversation.is_channel) && (
            <Dialog open={showMembers} onOpenChange={setShowMembers}>
              <DialogContent className="sm:max-w-[425px] w-[95vw]">
                <DialogHeader>
                  <DialogTitle>Members ({conversation.members.length})</DialogTitle>
                  <DialogDescription>
                    People in this conversation
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                {conversation.members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.profile?.avatar_url || undefined} />
                        <AvatarFallback className="bg-secondary">
                          {getInitials(getSenderName(member.profile))}
                        </AvatarFallback>
                      </Avatar>
                      {member.profile?.is_online && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[hsl(var(--online))] rounded-full ring-2 ring-background" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {getSenderName(member.profile)}
                        {member.user_id === profile.user_id && (
                          <span className="text-muted-foreground text-xs ml-2">(You)</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground capitalize px-1.5 py-0.5 bg-secondary rounded">
                          {member.role}
                        </span>
                        {member.profile && (
                          <OnlineStatus 
                            isOnline={member.profile.is_online || false} 
                            lastSeen={member.profile.last_seen}
                            showText={!member.profile.is_online}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              </DialogContent>
            </Dialog>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(conversation.is_group || conversation.is_channel) && (
                <>
                  <DropdownMenuItem onClick={handleCopyInvite} className="gap-2 cursor-pointer">
                    <Copy className="h-4 w-4" />
                    <span>Copy Invite Link</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAddMemberOpen(true)} className="gap-2 cursor-pointer">
                    <UserPlus className="h-4 w-4" />
                    <span>Add Member</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowMembers(true)} className="gap-2 cursor-pointer">
                    <Users className="h-4 w-4" />
                    <span>View Members ({conversation.members.length})</span>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLeave} className="text-warning gap-2">
                <LogOut className="h-4 w-4" />
                Leave conversation
              </DropdownMenuItem>
              {isOwner && (
                <DropdownMenuItem onClick={onDelete} className="text-destructive gap-2">
                  <Trash2 className="h-4 w-4" />
                  Delete conversation
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Audio Room Indicator */}
      {/* Audio Room Indicator */}
      {inAudioRoom && (
        <div className="flex-none h-12 px-4 bg-[hsl(var(--card))] border-b border-[hsl(var(--border))] flex items-center justify-between backdrop-blur-sm z-10 animate-fade-in relative overflow-hidden">
          {/* Subtle green glow background */}
          <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none" />
          
          <div className="flex items-center gap-3 z-10 overflow-hidden">
            <div className="relative flex items-center justify-center shrink-0">
               <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
            </div>
            <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-emerald-500 leading-none truncate">Voice Connected</span>
                <span className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">
                  {(() => {
                    const activeNames = participants
                      .filter(p => p.user_id !== profile.user_id)
                      .map(p => {
                        const member = conversation.members.find(m => m.user_id === p.user_id);
                        return getSenderName(member?.profile);
                      });
                    
                    if (activeNames.length === 0) return "Just you";
                    if (activeNames.length === 1) return `with ${activeNames[0]}`;
                    if (activeNames.length === 2) return `with ${activeNames[0]} & ${activeNames[1]}`;
                    return `with ${activeNames[0]}, ${activeNames[1]} +${activeNames.length - 2}`;
                  })()}
                </span>
            </div>
          </div>
          <div className="flex items-center gap-1 z-10 shrink-0">
            {/* Render remote audio streams (invisible UI) */}
            {participants.map(p => (
              <ParticipantAudio 
                key={p.user_id} 
                userId={p.user_id} 
                stream={p.stream} 
                outputDeviceId={selectedInput || undefined} // Fallback if selectedOutput not explicitly passed to this component yet, or keep undefined if handled globally
                showUI={false}
              />
            ))}

            {/* Audio Device Selector - Dropdown */}
            {audioInputs.length > 0 && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                            <Settings className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>Microphone</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {audioInputs.map(d => (
                            <DropdownMenuItem key={d.deviceId} onClick={() => onSwitchDevice(d.deviceId)} className="flex items-center justify-between cursor-pointer">
                                <span className="truncate text-xs">{d.label || "Microphone " + d.deviceId.slice(0, 4)}</span>
                                {selectedInput === d.deviceId && <span className="text-emerald-500 text-xs ml-2">✓</span>}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={leaveRoom}
              className="h-8 w-8 bg-destructive/10 text-destructive hover:bg-destructive/20 ml-1 rounded-full"
            >
              <PhoneOff className="h-4 w-4" />
            </Button>
          </div>

        </div>
      )}

      {/* Flash Mode Indicator */}
      {isFlashMode && (
        <div className="flex-none px-6 py-2 bg-warning/10 border-b border-warning/20 flex items-center justify-between backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Zap className="w-4 h-4 text-warning" />
            </div>
            <span className="text-sm text-warning font-medium">
              Flash Mode Active — Messages won't be saved
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFlashMode(false)}
            className="text-warning hover:text-warning hover:bg-warning/20"
          >
            <X className="h-4 w-4 mr-1" />
            Disable
          </Button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden relative">
        <ScrollArea className="h-full scrollbar-thin">
        <div className="p-4 max-w-3xl mx-auto flex flex-col">
          {isFlashMode ? (
            // Flash Mode Messages
            <>
              {flashMessages.length === 0 ? (
                <div className="text-center py-16 space-y-4">
                  <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mx-auto">
                    <Zap className="w-8 h-8 text-warning" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-medium text-foreground">Flash Chat</p>
                    <p className="text-sm text-muted-foreground">
                      Messages here are ephemeral and won't be saved
                    </p>
                  </div>
                </div>
              ) : (
                flashMessages.map((msg, index) => {
                  const isOwn = msg.sender_id === profile.user_id;
                  const prevMsg = flashMessages[index - 1];
                  const isFirstInGroup = !prevMsg || prevMsg.sender_id !== msg.sender_id;
                  const senderName = msg.sender?.display_name || msg.sender?.email?.split("@")[0] || "User";

                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 group animate-fade-in ${isOwn ? "flex-row-reverse" : ""}`}
                    >
                      {!isOwn && (
                        <div className="w-8 shrink-0">
                          {isFirstInGroup && (
                            <Avatar className="h-8 w-8 ring-2 ring-warning/30 shadow-md">
                              <AvatarImage src={msg.sender?.avatar_url || undefined} />
                              <AvatarFallback className="bg-warning/10 text-xs font-medium">
                                {senderName.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      )}

                      <div className={`flex flex-col max-w-[70%] ${isOwn ? "items-end" : "items-start"}`}>
                        {!isOwn && isFirstInGroup && (
                          <span className="text-xs font-medium text-warning mb-1 ml-1">
                            {senderName}
                          </span>
                        )}

                        <div
                          className={`
                            relative px-4 py-2.5 rounded-2xl shadow-sm transition-all duration-200
                            ${isOwn 
                              ? "bg-warning text-warning-foreground rounded-br-md" 
                              : "bg-warning/20 text-foreground rounded-bl-md backdrop-blur-sm border border-warning/30"
                            }
                            hover:shadow-md
                          `}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                        </div>

                        <span className="text-[10px] text-muted-foreground mt-1 mx-1 flex items-center gap-1">
                          <Zap className="w-2.5 h-2.5 text-warning" />
                          {format(new Date(msg.created_at), "h:mm a")}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          ) : (
            // Normal Mode Messages
            <>
              {messagesLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
                  <p className="text-sm text-muted-foreground">Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-16 space-y-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                    <Send className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-medium text-foreground">No messages yet</p>
                    <p className="text-sm text-muted-foreground">
                      Start the conversation with {getConversationTitle()}!
                    </p>
                  </div>
                </div>
              ) : (
                messagesWithDates.map((item, index) => {
                  if (item.type === "date") {
                    return (
                      <div key={`date-${item.date}`} className="flex items-center justify-center my-6">
                        <div className="px-3 py-1 bg-secondary/50 rounded-full">
                          <span className="text-xs font-medium text-muted-foreground">
                            {formatDateHeader(item.date!)}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  const msg = item.message!;
                  const prevItem = messagesWithDates[index - 1];
                  const isFirstInGroup =
                    !prevItem ||
                    prevItem.type === "date" ||
                    prevItem.message?.sender_id !== msg.sender_id;

                  return renderMessage(msg, isFirstInGroup, isFirstInGroup);
                })
              )}
            </>
          )}

          {/* Typing Indicator */}
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                <div className="flex gap-0.5">
                  <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
              <TypingIndicator users={typingUsers} />
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>
      </div>

      {/* Input - Compact */}
      <div className={`flex-none relative p-3 border-t backdrop-blur-xl z-20 ${isFlashMode ? "border-warning/20 bg-warning/5" : "border-border/50 bg-card/40"}`}>
        {/* Live Transcript Overlay */}
        {inAudioRoom && (
          <div className="absolute bottom-full left-0 right-0 px-4 pb-2 pointer-events-none flex justify-center">
            <div className="bg-background/80 backdrop-blur border border-border/50 shadow-lg rounded-xl px-4 py-2 max-w-2xl w-full pointer-events-auto animate-in slide-in-from-bottom-2 fade-in">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  Live Transcript
                </span>
              </div>
              <div className="text-sm">
                {!liveTranscript ? (
                   <span className="text-muted-foreground italic">Listening for speech...</span>
                ) : (
                    <span className={liveIsFinal ? "text-foreground" : "text-muted-foreground"}>
                      {liveTranscript}
                    </span>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          {!isFlashMode && (
            <>
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
                  <Button variant="ghost" size="icon" className="shrink-0 h-10 w-10 rounded-full hover:bg-secondary">
                    <Paperclip className="h-5 w-5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start">
                  <DropdownMenuItem onClick={() => imageInputRef.current?.click()} className="gap-2">
                    <Image className="h-4 w-4" />
                    Image / Video
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="gap-2">
                    <File className="h-4 w-4" />
                    File
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          {isFlashMode && (
            <div className="shrink-0 h-10 w-10 rounded-full bg-warning/20 flex items-center justify-center">
              <Zap className="h-5 w-5 text-warning" />
            </div>
          )}

          <div className="flex-1 relative">
            <Input
              placeholder={isFlashMode ? "Flash message (won't be saved)..." : `Message ${getConversationTitle()}...`}
              value={message}
              onChange={handleInputChange}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              onBlur={stopTyping}
              className={`h-11 pr-12 rounded-full focus:ring-2 ${
                isFlashMode 
                  ? "bg-warning/10 border-warning/30 focus:ring-warning/20" 
                  : "bg-secondary/50 border-border/50 focus:ring-primary/20"
              }`}
            />
          </div>

          <Button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            size="icon"
            className={`shrink-0 h-10 w-10 rounded-full shadow-lg ${isFlashMode ? "bg-warning hover:bg-warning/90" : ""}`}
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
