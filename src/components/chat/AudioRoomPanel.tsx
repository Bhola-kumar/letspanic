import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mic, MicOff, PhoneOff, Phone, Volume2 } from "lucide-react";
import { ParticipantAudio } from "./ParticipantAudio";
import type { Profile } from "@/lib/supabase";

interface Participant {
  user_id: string;
  stream?: MediaStream;
  profile?: Profile | null;
}

interface AudioRoomPanelProps {
  inRoom: boolean;
  participants: Participant[];
  isMuted: boolean;
  audioInputs: MediaDeviceInfo[];
  selectedInput: string | null;
  onJoin: (deviceId?: string) => void;
  onLeave: () => void;
  onToggleMute: () => void;
  onSelectInput: (deviceId: string | null) => void;
  currentUserId: string;
}

export function AudioRoomPanel({
  inRoom,
  participants,
  isMuted,
  audioInputs,
  selectedInput,
  onJoin,
  onLeave,
  onToggleMute,
  onSelectInput,
  currentUserId,
}: AudioRoomPanelProps) {
  const getInitials = (name: string) => name.substring(0, 2).toUpperCase();
  const getDisplayName = (p: Profile | null | undefined) => {
    if (!p) return "Unknown";
    return p.display_name || p.email?.split("@")[0] || "User";
  };

  if (!inRoom) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
        <div className="relative">
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
            <Volume2 className="w-12 h-12 text-primary" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-success rounded-full flex items-center justify-center ring-4 ring-background">
            <Mic className="w-4 h-4 text-success-foreground" />
          </div>
        </div>

        <div className="text-center space-y-2">
          <h3 className="text-xl font-semibold">Voice Channel</h3>
          <p className="text-muted-foreground text-sm max-w-xs">
            Join the voice channel to talk with other members in real-time
          </p>
        </div>

        {audioInputs.length > 1 && (
          <select
            value={selectedInput || ""}
            onChange={(e) => onSelectInput(e.target.value || null)}
            className="text-sm bg-secondary border border-border rounded-lg px-3 py-2 max-w-xs w-full"
          >
            {audioInputs.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || d.deviceId.slice(0, 20)}
              </option>
            ))}
          </select>
        )}

        <Button
          size="lg"
          onClick={() => onJoin(selectedInput || undefined)}
          className="gap-2"
        >
          <Phone className="h-5 w-5" />
          Join Voice
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Connected Header */}
      <div className="px-6 py-4 bg-success/10 border-b border-success/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-3 h-3 bg-success rounded-full" />
            <div className="absolute inset-0 w-3 h-3 bg-success rounded-full animate-pulse-ring" />
          </div>
          <span className="text-sm text-success font-medium">
            Connected to voice channel
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {participants.length + 1} participant{participants.length !== 0 ? "s" : ""}
        </span>
      </div>

      {/* Participants Grid */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {/* Current User */}
          <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-primary/5 ring-2 ring-primary/20">
            <div className="relative">
              <Avatar className="h-16 w-16 ring-2 ring-primary">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  You
                </AvatarFallback>
              </Avatar>
              <div 
                className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center ring-2 ring-background ${
                  isMuted ? "bg-destructive" : "bg-success"
                }`}
              >
                {isMuted ? (
                  <MicOff className="w-3 h-3 text-white" />
                ) : (
                  <Mic className="w-3 h-3 text-white" />
                )}
              </div>
            </div>
            <span className="text-sm font-medium text-center truncate w-full">You</span>
          </div>

          {/* Other Participants */}
          {participants.map((p) => (
            <div
              key={p.user_id}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-secondary/50"
            >
              <div className="relative">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={p.profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-secondary">
                    {getInitials(getDisplayName(p.profile))}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-success rounded-full flex items-center justify-center ring-2 ring-background">
                  <Volume2 className="w-3 h-3 text-white" />
                </div>
              </div>
              <span className="text-sm font-medium text-center truncate w-full">
                {getDisplayName(p.profile)}
              </span>
              {/* Hidden audio element for playback */}
              <ParticipantAudio userId={p.user_id} stream={p.stream} />
            </div>
          ))}
        </div>

        {participants.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No one else is here yet.</p>
            <p className="text-xs mt-1">Share the invite code to bring others!</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 border-t border-border bg-card/80 backdrop-blur-sm">
        <div className="flex items-center justify-center gap-3">
          {audioInputs.length > 0 && (
            <select
              value={selectedInput || ""}
              onChange={(e) => onSelectInput(e.target.value || null)}
              className="text-sm bg-secondary border border-border rounded-lg px-3 py-2"
            >
              {audioInputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || d.deviceId.slice(0, 15)}
                </option>
              ))}
            </select>
          )}

          <Button
            variant={isMuted ? "destructive" : "secondary"}
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={onToggleMute}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>

          <Button
            variant="destructive"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={onLeave}
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
