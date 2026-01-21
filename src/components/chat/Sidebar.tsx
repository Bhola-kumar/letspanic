import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MessageCircle,
  Users,
  Hash,
  Mic,
  Plus,
  Copy,
  LogOut,
  MoreVertical,
  UserPlus,
  Search,
  Check,
} from "lucide-react";
import type { Profile } from "@/lib/supabase";
import type { ConversationWithDetails } from "@/hooks/useConversations";
import { useToast } from "@/hooks/use-toast";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";

interface SidebarProps {
  profile: Profile;
  conversations: ConversationWithDetails[];
  selectedConversation: ConversationWithDetails | null;
  onSelectConversation: (conv: ConversationWithDetails) => void;
  onCreateDirectChat: (code: string) => Promise<void>;
  onCreateChannel: (name: string, hasAudio: boolean) => Promise<void>;
  onJoinByCode: (code: string) => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function Sidebar({
  profile,
  conversations,
  selectedConversation,
  onSelectConversation,
  onCreateDirectChat,
  onCreateChannel,
  onJoinByCode,
  onSignOut,
}: SidebarProps) {
  const [newChatUsername, setNewChatUsername] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [dialogOpen, setDialogOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const onlineUserIds = useOnlineStatus();

  const handleCopyUsername = () => {
    if (!profile.username) return;
    navigator.clipboard.writeText(profile.username);
    setCopied(true);
    toast({ title: "Copied!", description: "Username copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAction = async (action: () => Promise<void>) => {
    setLoading(true);
    try {
      await action();
      setDialogOpen(null);
      setNewChatUsername("");

      setNewChannelName("");
      setJoinCode("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const directChats = conversations.filter((c) => !c.is_group && !c.is_channel);
  const channels = conversations.filter((c) => c.is_channel);

  const filteredConversations = (list: ConversationWithDetails[]) => {
    if (!searchQuery) return list;
    return list.filter((c) => {
      const name = c.is_group || c.is_channel
        ? c.name
        : getConversationName(c);
      return name?.toLowerCase().includes(searchQuery.toLowerCase());
    });
  };

  const getDisplayName = (p: Profile | null | undefined) => {
    if (!p) return "Unknown";
    return p.display_name || p.email?.split("@")[0] || "User";
  };

  const getConversationName = (conv: ConversationWithDetails) => {
    if (conv.is_group || conv.is_channel) return conv.name || "Unnamed";
    const other = conv.members.find((m) => m.user_id !== profile.user_id);
    return getDisplayName(other?.profile);
  };

  const getConversationAvatar = (conv: ConversationWithDetails) => {
    if (conv.avatar_url) return conv.avatar_url;
    if (!conv.is_group && !conv.is_channel) {
      const other = conv.members.find((m) => m.user_id !== profile.user_id);
      return other?.profile?.avatar_url;
    }
    return null;
  };

  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase();
  };

  const getOtherUserStatus = (conv: ConversationWithDetails) => {
    if (conv.is_group || conv.is_channel) return null;
    const other = conv.members.find((m) => m.user_id !== profile.user_id);
    return other ? onlineUserIds.has(other.user_id) : false;
  };

  return (
    <div className="w-full md:w-80 h-full bg-sidebar flex flex-col md:border-r border-sidebar-border overflow-hidden">
      {/* Header Section - Fixed at top */}
      <div className="flex-none bg-sidebar z-10">
        {/* Header - Compact */}
        <div className="p-3 border-b border-sidebar-border/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center shadow-md shadow-primary/20">
                <MessageCircle className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-display font-semibold text-base tracking-tight">Lets Panic</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-card">
                <DropdownMenuItem onClick={handleCopyUsername} className="gap-2 cursor-pointer">
                  {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy username: {profile.username}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onSignOut} className="text-destructive gap-2 cursor-pointer">
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 bg-sidebar-accent/50 border-sidebar-border/50 rounded-md h-8 text-xs focus-visible:ring-1"
            />
          </div>
        </div>
        {/* Action Buttons - Compact */}
        <div className="p-2 px-3 flex gap-2">
          <Dialog open={dialogOpen === "direct"} onOpenChange={(o) => setDialogOpen(o ? "direct" : null)}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1.5 shadow-sm">
                <UserPlus className="h-3.5 w-3.5" />
                New Chat
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card">
              <DialogHeader>
                <DialogTitle>Start a new chat</DialogTitle>
                <DialogDescription>
                  Enter the username of the person you want to chat with
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Enter username"
                  value={newChatUsername}
                  onChange={(e) => setNewChatUsername(e.target.value.toLowerCase())}
                  className="font-mono tracking-wide glass-input"
                />
                <Button
                  onClick={() => handleAction(() => onCreateDirectChat(newChatUsername))}
                  disabled={!newChatUsername || loading}
                  className="w-full"
                >
                  {loading ? "Finding user..." : "Start Chat"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen === "join"} onOpenChange={(o) => setDialogOpen(o ? "join" : null)}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1.5 shadow-sm">
                <Plus className="h-3.5 w-3.5" />
                Join
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card">
              <DialogHeader>
                <DialogTitle>Join with invite code</DialogTitle>
                <DialogDescription>
                  Enter an invite code to join a group or channel
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Enter invite code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="uppercase font-mono tracking-wider glass-input"
                />
                <Button
                  onClick={() => handleAction(() => onJoinByCode(joinCode))}
                  disabled={!joinCode || loading}
                  className="w-full"
                >
                  {loading ? "Joining..." : "Join"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Scrollable Center Section */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full scrollbar-thin">
          <div className="p-2 space-y-6">
          {/* Direct Messages */}
          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Direct Messages
              </span>
              <span className="text-xs text-muted-foreground">{directChats.length}</span>
            </div>
            <div className="space-y-1">
              {filteredConversations(directChats).map((conv) => {
                const isOnline = getOtherUserStatus(conv);
                const name = getConversationName(conv);
                return (
                  <div
                    key={conv.id}
                    onClick={() => onSelectConversation(conv)}
                    className={`compact-item ${selectedConversation?.id === conv.id ? "active" : ""}`}
                  >
                    <div className="relative">
                      <Avatar className="h-8 w-8 ring-1 ring-border/50">
                        <AvatarImage src={getConversationAvatar(conv) || undefined} />
                        <AvatarFallback className="bg-secondary text-[10px]">
                          {getInitials(name)}
                        </AvatarFallback>
                      </Avatar>
                      <span 
                        className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ring-2 ring-sidebar ${
                          isOnline ? "bg-[hsl(var(--online))]" : "bg-[hsl(var(--offline))]"
                        }`} 
                      />
                    </div>
                    <div className="flex-1 min-w-0 flex items-center justify-between">
                      <div className="min-w-0">
                        <span className={`truncate text-sm block leading-tight ${conv.unreadCount ? "font-bold text-foreground" : "font-medium"}`}>{name}</span>
                        <span className="text-[10px] text-muted-foreground truncate block">
                          {isOnline ? "Online" : "Offline"}
                        </span>
                      </div>
                      {conv.unreadCount ? (
                        <span className="bg-primary text-primary-foreground text-[10px] font-bold h-5 min-w-[1.25rem] px-1 rounded-full flex items-center justify-center ml-2">
                          {conv.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {filteredConversations(directChats).length === 0 && (
                <p className="text-xs text-muted-foreground px-3 py-4 text-center">
                  No direct messages yet. Start a new chat!
                </p>
              )}
            </div>
          </div>



          {/* Rooms (formerly Channels) */}
          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Rooms
              </span>
              <Dialog open={dialogOpen === "channel"} onOpenChange={(o) => setDialogOpen(o ? "channel" : null)}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-secondary">
                    <Plus className="h-3 w-3" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create a room</DialogTitle>
                    <DialogDescription>
                      Create a voice room for your community
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input
                      placeholder="Room name"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                    />
                    <Button
                      onClick={() => handleAction(() => onCreateChannel(newChannelName, true))}
                      disabled={!newChannelName || loading}
                      className="w-full"
                    >
                      <Mic className="h-4 w-4 mr-2" />
                      Create Room
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-1">
              {filteredConversations(channels).map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => onSelectConversation(conv)}
                  className={`compact-item ${selectedConversation?.id === conv.id ? "active" : ""}`}
                >
                  <div className="h-7 w-7 bg-secondary/80 rounded-md flex items-center justify-center">
                    {conv.has_audio ? (
                      <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <span className="truncate text-sm font-medium flex-1 leading-tight">{getConversationName(conv)}</span>
                  {conv.has_audio && (
                    <span className="text-[9px] bg-success/20 text-success px-1.5 py-0.5 rounded-full font-medium mr-2">
                      Voice
                    </span>
                  )}
                  {conv.unreadCount ? (
                    <span className="bg-primary text-primary-foreground text-[10px] font-bold h-5 min-w-[1.25rem] px-1 rounded-full flex items-center justify-center">
                      {conv.unreadCount}
                    </span>
                  ) : null}
                </div>
              ))}
              {filteredConversations(channels).length === 0 && (
                <p className="text-xs text-muted-foreground px-3 py-4 text-center">
                  No rooms yet
                </p>
              )}
            </div>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* User Profile - Fixed at bottom */}
      <div className="flex-none p-2 border-t border-sidebar-border bg-sidebar-accent/30 z-10">
        <div className="flex items-center gap-2 px-1">
          <div className="relative">
            <Avatar className="h-8 w-8 ring-1 ring-primary/20">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {getInitials(getDisplayName(profile))}
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[hsl(var(--online))] rounded-full ring-2 ring-sidebar" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate leading-tight">{getDisplayName(profile)}</p>
            <p className="text-[10px] text-muted-foreground font-mono leading-tight">@{profile.username}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
