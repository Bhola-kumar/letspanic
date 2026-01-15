import { MessageCircle, Users, Hash, Mic } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-background p-8">
      <div className="text-center space-y-6 max-w-md">
        <div className="w-20 h-20 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center">
          <MessageCircle className="w-10 h-10 text-primary" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-display font-bold">Welcome to ConnectChat</h2>
          <p className="text-muted-foreground">
            Select a conversation or start a new one to begin messaging
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4">
          <div className="glass-card p-4 text-left space-y-2">
            <Users className="w-6 h-6 text-primary" />
            <h3 className="font-semibold">Direct Messages</h3>
            <p className="text-xs text-muted-foreground">
              Connect with users using their unique code
            </p>
          </div>
          <div className="glass-card p-4 text-left space-y-2">
            <Hash className="w-6 h-6 text-primary" />
            <h3 className="font-semibold">Channels</h3>
            <p className="text-xs text-muted-foreground">
              Create or join channels with invite codes
            </p>
          </div>
          <div className="glass-card p-4 text-left space-y-2">
            <Mic className="w-6 h-6 text-primary" />
            <h3 className="font-semibold">Voice Rooms</h3>
            <p className="text-xs text-muted-foreground">
              Live audio conversations in channels
            </p>
          </div>
          <div className="glass-card p-4 text-left space-y-2">
            <MessageCircle className="w-6 h-6 text-primary" />
            <h3 className="font-semibold">Rich Media</h3>
            <p className="text-xs text-muted-foreground">
              Share images, files, and more
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
