import { useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Phone,
  X,
} from "lucide-react";

interface VideoCallModalProps {
  isOpen: boolean;
  inCall: boolean;
  isCalling: boolean;
  isReceivingCall: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  callerName?: string;
  callerAvatar?: string;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
}

export function VideoCallModal({
  isOpen,
  inCall,
  isCalling,
  isReceivingCall,
  localStream,
  remoteStream,
  isMuted,
  isVideoOff,
  callerName = "Unknown",
  callerAvatar,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onToggleVideo,
}: VideoCallModalProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const getInitials = (name: string) => name.substring(0, 2).toUpperCase();

  // Incoming call UI
  if (isReceivingCall && !inCall) {
    return (
      <Dialog open={isOpen} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" hideClose>
          <DialogTitle className="sr-only">Incoming Video Call</DialogTitle>
          <DialogDescription className="sr-only">
            Someone is calling you
          </DialogDescription>
          <div className="flex flex-col items-center justify-center py-8 space-y-6">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
              <Avatar className="h-24 w-24 ring-4 ring-primary/30">
                <AvatarImage src={callerAvatar} />
                <AvatarFallback className="bg-primary/10 text-2xl">
                  {getInitials(callerName)}
                </AvatarFallback>
              </Avatar>
            </div>
            
            <div className="text-center space-y-1">
              <h3 className="text-xl font-semibold">{callerName}</h3>
              <p className="text-muted-foreground animate-pulse">
                Incoming video call...
              </p>
            </div>

            <div className="flex gap-4">
              <Button
                variant="destructive"
                size="lg"
                className="rounded-full h-14 w-14"
                onClick={onReject}
              >
                <X className="h-6 w-6" />
              </Button>
              <Button
                variant="default"
                size="lg"
                className="rounded-full h-14 w-14 bg-green-500 hover:bg-green-600"
                onClick={onAccept}
              >
                <Phone className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Calling or In-call UI
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-4xl p-0 overflow-hidden" hideClose>
        <DialogTitle className="sr-only">
          {isCalling ? "Calling..." : "Video Call"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {isCalling ? "Waiting for answer" : "Video call in progress"}
        </DialogDescription>
        
        <div className="relative bg-black aspect-video">
          {/* Remote Video (full size) */}
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
              <div className="text-center space-y-4">
                <Avatar className="h-32 w-32 mx-auto ring-4 ring-white/10">
                  <AvatarImage src={callerAvatar} />
                  <AvatarFallback className="bg-gray-700 text-4xl text-white">
                    {getInitials(callerName)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <h3 className="text-2xl font-semibold text-white">{callerName}</h3>
                  <p className="text-gray-400">
                    {isCalling ? (
                      <span className="flex items-center justify-center gap-1">
                        <span className="animate-pulse">Calling</span>
                        <span className="flex gap-0.5">
                          <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </span>
                      </span>
                    ) : (
                      "Connecting..."
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Local Video (picture-in-picture) */}
          {localStream && (
            <div className="absolute bottom-4 right-4 w-48 aspect-video rounded-lg overflow-hidden shadow-xl ring-2 ring-white/20">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isVideoOff ? "hidden" : ""}`}
              />
              {isVideoOff && (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                  <VideoOff className="h-8 w-8 text-gray-500" />
                </div>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/50 backdrop-blur-md rounded-full px-4 py-3">
            <Button
              variant={isMuted ? "destructive" : "secondary"}
              size="icon"
              className="rounded-full h-12 w-12"
              onClick={onToggleMute}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>

            <Button
              variant={isVideoOff ? "destructive" : "secondary"}
              size="icon"
              className="rounded-full h-12 w-12"
              onClick={onToggleVideo}
            >
              {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </Button>

            <Button
              variant="destructive"
              size="icon"
              className="rounded-full h-14 w-14"
              onClick={onEnd}
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
