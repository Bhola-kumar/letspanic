
import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, PhoneOff, Mic, MicOff, Volume2 } from "lucide-react";
import { Profile } from "@/lib/supabase";
import { CallState, CallData } from "@/hooks/useCallSystem";

interface CallOverlayProps {
  callState: CallState;
  callData: CallData | null;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
  onEnd: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export function CallOverlay({
  callState,
  callData,
  onAccept,
  onDecline,
  onCancel,
  onEnd,
  isMuted,
  onToggleMute,
}: CallOverlayProps) {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let timer: any;
    if (callState === "connected") {
      timer = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => clearInterval(timer);
  }, [callState]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (callState === "idle" || !callData) return null;

  const isIncoming = callState === "incoming";
  const isOutgoing = callState === "outgoing";
  const isConnected = callState === "connected";

  const { otherUser } = callData;

  const getInitials = (name: string) => name.substring(0, 2).toUpperCase();
  const displayName = otherUser.display_name || otherUser.username || "User";

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-xl border-border p-0 overflow-hidden shadow-2xl [&>button]:hidden">
        <div className="flex flex-col items-center justify-center p-8 space-y-8 select-none">
          
          {/* Status Text */}
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">
              {isConnected ? displayName : isIncoming ? "Incoming Call..." : "Calling..."}
            </h2>
            <p className="text-sm text-muted-foreground font-medium">
              {isConnected 
                ? formatDuration(duration) 
                : isIncoming 
                  ? `${displayName} is calling you` 
                  : `Waiting for ${displayName}...`
              }
            </p>
          </div>

          {/* Avatar Ring Animation */}
          <div className="relative">
            {!isConnected && (
              <div className="absolute inset-0 rounded-full animate-ping bg-primary/20" />
            )}
            <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
              <AvatarImage src={otherUser.avatar_url || undefined} />
              <AvatarFallback className="text-2xl bg-secondary">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-6 w-full justify-center pt-4">
            
            {/* Incoming: Decline | Accept */}
            {isIncoming && (
              <>
                <Button
                  size="lg"
                  variant="destructive"
                  className="h-16 w-16 rounded-full shadow-lg"
                  onClick={onDecline}
                >
                  <PhoneOff className="h-8 w-8" />
                </Button>
                <div className="w-8" /> {/* Spacer */}
                <Button
                  size="lg"
                  className="h-16 w-16 rounded-full bg-success hover:bg-success/90 text-white shadow-lg animate-pulse"
                  onClick={onAccept}
                >
                  <Phone className="h-8 w-8" />
                </Button>
              </>
            )}

            {/* Outgoing: Cancel */}
            {isOutgoing && (
              <Button
                size="lg"
                variant="destructive"
                className="h-16 w-16 rounded-full shadow-lg"
                onClick={onCancel}
              >
                <PhoneOff className="h-8 w-8" />
              </Button>
            )}

            {/* Connected: Mute | End */}
            {isConnected && (
              <>
                 <Button
                  size="lg"
                  variant={isMuted ? "secondary" : "outline"}
                  className="h-14 w-14 rounded-full"
                  onClick={onToggleMute}
                >
                  {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </Button>
                
                <Button
                  size="lg"
                  variant="destructive"
                  className="h-16 w-16 rounded-full shadow-lg mx-4"
                  onClick={onEnd}
                >
                  <PhoneOff className="h-8 w-8" />
                </Button>

                {/* Placeholder for future specific volume/speaker controls */}
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 w-14 rounded-full text-muted-foreground"
                  disabled
                >
                  <Volume2 className="h-6 w-6" />
                </Button>
              </>
            )}
            
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
