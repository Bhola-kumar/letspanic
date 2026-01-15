import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
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
  Settings,
  MoreVertical,
  UserPlus,
  Search,
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
  const { toast } = useToast();

  const handleCopyCode = () => {
    navigator.clipboard.writeText(profile.user_code);
    toast({ title: "Copied!", description: "Your code has been copied" });
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
        : c.members.find((m) => m.user_id !== profile.user_id)?.profile?.display_name;
      return name?.toLowerCase().includes(searchQuery.toLowerCase());
    });
  };

  const getConversationName = (conv: ConversationWithDetails) => {
    if (conv.is_group || conv.is_channel) return conv.name || "Unnamed";
    const other = conv.members.find((m) => m.user_id !== profile.user_id);
    return other?.profile?.display_name || other?.profile?.email || "Unknown";
  };

  const getConversationAvatar = (conv: ConversationWithDetails) => {
    if (conv.avatar_url) return conv.avatar_url;
    if (!conv.is_group && !conv.is_channel) {
      const other = conv.members.find((m) => m.user_id !== profile.user_id);
      return other?.profile?.avatar_url;
    }
    return null;
  };

  return (
    <div className="w-80 h-full bg-sidebar flex flex-col border-r border-sidebar-border">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            <span className="font-display font-semibold text-lg">ConnectChat</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCopyCode}>
                <Copy className="mr-2 h-4 w-4" />
                Copy my code: {profile.user_code}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSignOut} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
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
            className="pl-9 bg-sidebar-accent border-sidebar-border"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-4 flex gap-2 flex-wrap">
        <Dialog open={dialogOpen === "direct"} onOpenChange={(o) => setDialogOpen(o ? "direct" : null)}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1">
              <UserPlus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start a new chat</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Enter user code (e.g., A1B2C3D4)"
                value={newChatCode}
                onChange={(e) => setNewChatCode(e.target.value)}
              />
              <Button
                onClick={() => handleAction(() => onCreateDirectChat(newChatCode))}
                disabled={!newChatCode || loading}
                className="w-full"
              >
                {loading ? "Finding..." : "Start Chat"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={dialogOpen === "join"} onOpenChange={(o) => setDialogOpen(o ? "join" : null)}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1">
              <Plus className="h-4 w-4 mr-2" />
              Join
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Join with invite code</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Enter invite code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
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
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Direct Messages
              </span>
            </div>
            <div className="space-y-1">
              {filteredConversations(directChats).map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => onSelectConversation(conv)}
                  className={`channel-item ${selectedConversation?.id === conv.id ? "active" : ""}`}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={getConversationAvatar(conv) || undefined} />
                    <AvatarFallback>{getConversationName(conv)[0]}</AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm">{getConversationName(conv)}</span>
                </div>
              ))}
              {filteredConversations(directChats).length === 0 && (
                <p className="text-xs text-muted-foreground px-3 py-2">No direct messages yet</p>
              )}
            </div>
          </div>

          {/* Groups */}
          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Groups
              </span>
              <Dialog open={dialogOpen === "group"} onOpenChange={(o) => setDialogOpen(o ? "group" : null)}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5">
                    <Plus className="h-3 w-3" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create a group</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
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
                  <div className="h-8 w-8 bg-secondary rounded-lg flex items-center justify-center">
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="truncate text-sm">{getConversationName(conv)}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {conv.members.length}
                  </span>
                </div>
              ))}
              {filteredConversations(groups).length === 0 && (
                <p className="text-xs text-muted-foreground px-3 py-2">No groups yet</p>
              )}
            </div>
          </div>

          {/* Channels */}
          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Channels
              </span>
              <Dialog open={dialogOpen === "channel"} onOpenChange={(o) => setDialogOpen(o ? "channel" : null)}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5">
                    <Plus className="h-3 w-3" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create a channel</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input
                      placeholder="Channel name"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleAction(() => onCreateChannel(newChannelName, false))}
                        disabled={!newChannelName || loading}
                        className="flex-1"
                        variant="outline"
                      >
                        <Hash className="h-4 w-4 mr-2" />
                        Text Channel
                      </Button>
                      <Button
                        onClick={() => handleAction(() => onCreateChannel(newChannelName, true))}
                        disabled={!newChannelName || loading}
                        className="flex-1"
                      >
                        <Mic className="h-4 w-4 mr-2" />
                        Voice Channel
                      </Button>
                    </div>
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
                  <div className="h-8 w-8 bg-secondary rounded-lg flex items-center justify-center">
                    {conv.has_audio ? (
                      <Mic className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Hash className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <span className="truncate text-sm">{getConversationName(conv)}</span>
                  {conv.has_audio && (
                    <span className="ml-auto text-xs bg-success/20 text-success px-2 py-0.5 rounded-full">
                      Voice
                    </span>
                  )}
                </div>
              ))}
              {filteredConversations(channels).length === 0 && (
                <p className="text-xs text-muted-foreground px-3 py-2">No channels yet</p>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* User Profile */}
      <div className="p-3 border-t border-sidebar-border bg-sidebar-accent/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-10 w-10">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback>
                {profile.display_name?.[0] || profile.email[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 online-indicator" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile.display_name || profile.email}</p>
            <p className="text-xs text-muted-foreground">#{profile.user_code}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
