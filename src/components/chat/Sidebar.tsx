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

interface SidebarProps {
  profile: Profile;
  conversations: ConversationWithDetails[];
  selectedConversation: ConversationWithDetails | null;
  onSelectConversation: (conv: ConversationWithDetails) => void;
  onCreateDirectChat: (code: string) => Promise<void>;
  onCreateGroup: (name: string) => Promise<void>;
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
  onCreateGroup,
  onCreateChannel,
  onJoinByCode,
  onSignOut,
}: SidebarProps) {
  const [newChatCode, setNewChatCode] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [dialogOpen, setDialogOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopyCode = () => {
    navigator.clipboard.writeText(profile.user_code);
    setCopied(true);
    toast({ title: "Copied!", description: "Your code has been copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAction = async (action: () => Promise<void>) => {
    setLoading(true);
    try {
      await action();
      setDialogOpen(null);
      setNewChatCode("");
      setNewGroupName("");
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
  const groups = conversations.filter((c) => c.is_group && !c.is_channel);
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
    return other?.profile?.is_online || false;
  };

  return (
    <div className="w-80 h-full bg-sidebar flex flex-col border-r border-sidebar-border">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/60 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <MessageCircle className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold text-lg">Lets Panic</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCopyCode} className="gap-2">
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                Copy my code: {profile.user_code}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSignOut} className="text-destructive gap-2">
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-sidebar-accent border-sidebar-border rounded-full h-10"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-4 flex gap-2">
        <Dialog open={dialogOpen === "direct"} onOpenChange={(o) => setDialogOpen(o ? "direct" : null)}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1 rounded-full">
              <UserPlus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start a new chat</DialogTitle>
              <DialogDescription>
                Enter the user code of the person you want to chat with
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Input
                placeholder="Enter user code (e.g., A1B2C3D4)"
                value={newChatCode}
                onChange={(e) => setNewChatCode(e.target.value.toUpperCase())}
                className="uppercase font-mono tracking-wider"
              />
              <Button
                onClick={() => handleAction(() => onCreateDirectChat(newChatCode))}
                disabled={!newChatCode || loading}
                className="w-full"
              >
                {loading ? "Finding user..." : "Start Chat"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={dialogOpen === "join"} onOpenChange={(o) => setDialogOpen(o ? "join" : null)}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1 rounded-full">
              <Plus className="h-4 w-4 mr-2" />
              Join
            </Button>
          </DialogTrigger>
          <DialogContent>
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
                className="uppercase font-mono tracking-wider"
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

      <ScrollArea className="flex-1 scrollbar-thin">
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
                    className={`channel-item group ${selectedConversation?.id === conv.id ? "active" : ""}`}
                  >
                    <div className="relative">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={getConversationAvatar(conv) || undefined} />
                        <AvatarFallback className="bg-secondary text-xs">
                          {getInitials(name)}
                        </AvatarFallback>
                      </Avatar>
                      <span 
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-sidebar ${
                          isOnline ? "bg-[hsl(var(--online))]" : "bg-[hsl(var(--offline))]"
                        }`} 
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="truncate text-sm font-medium block">{name}</span>
                      <span className="text-xs text-muted-foreground truncate block">
                        {isOnline ? "Online" : "Offline"}
                      </span>
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

          {/* Groups */}
          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Groups
              </span>
              <Dialog open={dialogOpen === "group"} onOpenChange={(o) => setDialogOpen(o ? "group" : null)}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-secondary">
                    <Plus className="h-3 w-3" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create a group</DialogTitle>
                    <DialogDescription>
                      Create a new group and invite others with a code
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input
                      placeholder="Group name"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                    />
                    <Button
                      onClick={() => handleAction(() => onCreateGroup(newGroupName))}
                      disabled={!newGroupName || loading}
                      className="w-full"
                    >
                      {loading ? "Creating..." : "Create Group"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-1">
              {filteredConversations(groups).map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => onSelectConversation(conv)}
                  className={`channel-item ${selectedConversation?.id === conv.id ? "active" : ""}`}
                >
                  <div className="h-9 w-9 bg-secondary/80 rounded-lg flex items-center justify-center">
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="truncate text-sm font-medium block">{getConversationName(conv)}</span>
                    <span className="text-xs text-muted-foreground">
                      {conv.members.length} member{conv.members.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              ))}
              {filteredConversations(groups).length === 0 && (
                <p className="text-xs text-muted-foreground px-3 py-4 text-center">
                  No groups yet
                </p>
              )}
            </div>
          </div>

          {/* Channels */}
          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Channels
              </span>
              <Dialog open={dialogOpen === "channel"} onOpenChange={(o) => setDialogOpen(o ? "channel" : null)}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-secondary">
                    <Plus className="h-3 w-3" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create a channel</DialogTitle>
                    <DialogDescription>
                      Create a voice channel for your community
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input
                      placeholder="Channel name"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                    />
                    <Button
                      onClick={() => handleAction(() => onCreateChannel(newChannelName, true))}
                      disabled={!newChannelName || loading}
                      className="w-full"
                    >
                      <Mic className="h-4 w-4 mr-2" />
                      Create Audio Channel
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
                  className={`channel-item ${selectedConversation?.id === conv.id ? "active" : ""}`}
                >
                  <div className="h-9 w-9 bg-secondary/80 rounded-lg flex items-center justify-center">
                    {conv.has_audio ? (
                      <Mic className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Hash className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <span className="truncate text-sm font-medium flex-1">{getConversationName(conv)}</span>
                  {conv.has_audio && (
                    <span className="text-[10px] bg-success/20 text-success px-2 py-0.5 rounded-full font-medium">
                      Voice
                    </span>
                  )}
                </div>
              ))}
              {filteredConversations(channels).length === 0 && (
                <p className="text-xs text-muted-foreground px-3 py-4 text-center">
                  No channels yet
                </p>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* User Profile */}
      <div className="p-3 border-t border-sidebar-border bg-sidebar-accent/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-10 w-10 ring-2 ring-primary/20">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {getInitials(getDisplayName(profile))}
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-[hsl(var(--online))] rounded-full ring-2 ring-sidebar" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{getDisplayName(profile)}</p>
            <p className="text-xs text-muted-foreground font-mono">#{profile.user_code}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
