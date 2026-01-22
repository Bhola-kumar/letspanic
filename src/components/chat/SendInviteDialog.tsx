import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useConversations } from "@/hooks/useConversations";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Send, Check } from "lucide-react";
import type { Profile } from "@/lib/supabase";

interface SendInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inviteCode: string;
  currentRoomId: string;
  currentRoomName: string;
  senderId: string;
}

export function SendInviteDialog({
  open,
  onOpenChange,
  inviteCode,
  currentRoomId,
  currentRoomName,
  senderId
}: SendInviteDialogProps) {
  const { conversations, loading } = useConversations(senderId);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
        setSelectedUserIds(new Set());
        setSearchQuery("");
    }
  }, [open]);

  // Filter for DMs (not groups, not channels)
  const dms = conversations.filter(c => !c.is_group && !c.is_channel);

  // Filter based on search query
  const filteredDms = dms.filter(c => {
    const otherMember = c.members.find(m => m.user_id !== senderId);
    const name = otherMember?.profile?.display_name || otherMember?.profile?.username || "";
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const toggleUser = (userId: string) => {
    const next = new Set(selectedUserIds);
    if (next.has(userId)) {
        next.delete(userId);
    } else {
        next.add(userId);
    }
    setSelectedUserIds(next);
  };

  const handleSendInvites = async () => {
    if (selectedUserIds.size === 0) return;
    setSending(true);

    try {
        const inviteLink = `${window.location.origin}/?joinCode=${inviteCode}`;
        const messageContent = `Hey! Join my room "${currentRoomName}" using this link: ${inviteLink}`;

        // Find conversation IDs for selected users
        const promises = Array.from(selectedUserIds).map(async (targetUserId) => {
             const dm = dms.find(c => c.members.some(m => m.user_id === targetUserId));
             if (dm) {
                 // Send message to existing DM
                 return supabase.from("messages").insert({
                     conversation_id: dm.id,
                     sender_id: senderId,
                     content: messageContent,
                     message_type: 'text'
                 });
             } else {
                 // Should not happen as we select from existing DMs, but handle if needed?
                 // For now only allow inviting people already in DMs as per requirement "available user from my dms"
                 return Promise.resolve();
             }
        });

        await Promise.all(promises);

        toast({ title: "Invites Sent", description: `Sent invites to ${selectedUserIds.size} user(s).` });
        onOpenChange(false);
    } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
        setSending(false);
    }
  };

  const getOtherMember = (conv: any) => conv.members.find((m: any) => m.user_id !== senderId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Send Invites</DialogTitle>
          <DialogDescription>
            Select friends from your DMs to invite to this room.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Search friends..." 
                className="pl-8" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
        </div>

        <ScrollArea className="h-[300px] pr-4">
            {loading ? (
                <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
            ) : filteredDms.length === 0 ? (
                <p className="text-center text-muted-foreground p-4">No friends found.</p>
            ) : (
                <div className="space-y-2">
                    {filteredDms.map(dm => {
                        const other = getOtherMember(dm);
                        const profile = other?.profile;
                        if (!profile) return null;
                        const isSelected = selectedUserIds.has(profile.user_id);
                        
                        return (
                            <div 
                                key={dm.id} 
                                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? "bg-primary/10" : "hover:bg-secondary/50"}`}
                                onClick={() => toggleUser(profile.user_id)}
                            >
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={profile.avatar_url} />
                                    <AvatarFallback>{profile.username?.substring(0,2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{profile.display_name || profile.username}</p>
                                    <p className="text-xs text-muted-foreground truncate">@{profile.username}</p>
                                </div>
                                {isSelected && <Check className="h-5 w-5 text-primary" />}
                            </div>
                        );
                    })}
                </div>
            )}
        </ScrollArea>

        <div className="pt-2">
            <Button 
                className="w-full" 
                onClick={handleSendInvites} 
                disabled={selectedUserIds.size === 0 || sending}
            >
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send Invite ({selectedUserIds.size})
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
