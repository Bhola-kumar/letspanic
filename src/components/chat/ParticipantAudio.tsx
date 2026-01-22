import { useEffect, useRef, useState } from "react";

interface ParticipantAudioProps {
  stream?: MediaStream;
  userId?: string;
  outputDeviceId?: string;
  showUI?: boolean;
}

export function ParticipantAudio({ stream, userId, outputDeviceId, showUI = false }: ParticipantAudioProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    if (audioRef.current && stream) {
      console.log("Attaching remote stream to audio element");
      audioRef.current.srcObject = stream;
      console.log("Attached srcObject ->", audioRef.current.srcObject);
      // Ensure element is unmuted and audible
      try {
        audioRef.current.muted = false;
        audioRef.current.volume = 1;
      } catch (e) {
        console.warn("Could not set audio element properties:", e);
      }

      // Attach simple event listeners for debugging and autoplay handling
      const onPlaying = () => {
        console.log("Remote audio playing (onplaying)");
        setIsPlaying(true);
      };
      const onPause = () => setIsPlaying(false);
      const onError = (ev: any) => console.warn("Audio element error:", ev);
      audioRef.current.addEventListener("playing", onPlaying);
      audioRef.current.addEventListener("pause", onPause);
      audioRef.current.addEventListener("error", onError as any);

      // Try to play and connect via AudioContext on user gesture if needed
      const tryPlay = async () => {
        try {
          await audioRef.current?.play();
          console.log("Remote audio play() resolved");
        } catch (error) {
          console.warn("Auto-play blocked or failed:", error);
        }

        // Try to use a shared/global AudioContext (created when user joined/accepted)
        try {
          const g = (window as any).__letspanicAudioContext as AudioContext | undefined;
          const ctx = (g && g.state !== 'closed') ? g : audioContextRef.current;
          if (ctx && stream) {
            if (!audioContextRef.current) audioContextRef.current = ctx;
            if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
            sourceNodeRef.current = audioContextRef.current.createMediaStreamSource(stream);
            sourceNodeRef.current.connect(audioContextRef.current.destination);
            console.log("Connected remote stream to AudioContext destination");
          }
        } catch (e) {
          console.warn("AudioContext connect failed:", e);
        }
      };

      tryPlay();

      return () => {
        audioRef.current?.removeEventListener("playing", onPlaying);
        audioRef.current?.removeEventListener("pause", onPause);
        audioRef.current?.removeEventListener("error", onError as any);
        // Disconnect source node to free resources
        try {
          if (sourceNodeRef.current) {
            sourceNodeRef.current.disconnect();
            sourceNodeRef.current = null;
          }
        } catch (e) {}
        // Clear audio element source
        try { if (audioRef.current) audioRef.current.srcObject = null; } catch (e) {}
      };
    }
  }, [stream]);

  // Handle output device switching
  useEffect(() => {
    if (audioRef.current && outputDeviceId) {
        try {
            // @ts-ignore - setSinkId is not yet in all TS definitions
            if (typeof audioRef.current.setSinkId === 'function') {
                // @ts-ignore
                audioRef.current.setSinkId(outputDeviceId)
                    .then(() => console.log(`Audio output switched to ${outputDeviceId}`))
                    .catch((err: any) => console.warn("Failed to set audio output device", err));
            }
        } catch (e) {
            console.warn("Error setting sinkId:", e);
        }
    }
  }, [outputDeviceId]);

  const handlePlayPause = async () => {
    if (!audioRef.current) return;
    try {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        await audioRef.current.play();
        // resume AudioContext on user gesture to satisfy autoplay policies
        try {
          const g = (window as any).__letspanicAudioContext as AudioContext | undefined;
          if (g && g.state !== 'closed') {
            audioContextRef.current = g;
          } else if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          }
          await audioContextRef.current.resume();
          if (stream) {
            if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
            sourceNodeRef.current = audioContextRef.current.createMediaStreamSource(stream);
            sourceNodeRef.current.connect(audioContextRef.current.destination);
          }
        } catch (e) {
          console.warn("AudioContext resume/connect failed:", e);
        }
      }
    } catch (e) {
      console.warn("[WebRTC] Play/Pause failed:", e);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        if (sourceNodeRef.current) {
          sourceNodeRef.current.disconnect();
          sourceNodeRef.current = null;
        }
      } catch (e) {}
      try { if (audioRef.current) audioRef.current.srcObject = null; } catch (e) {}
    };
  }, []);

  // Note: per-participant audio output selector removed to keep a single
  // live control per participant. Global output routing can be handled
  // elsewhere if needed.

  if (!showUI) {
      return (
          <audio 
            ref={audioRef} 
            autoPlay 
            playsInline 
            className="hidden" 
          />
      );
  }

  return (
    <div className="inline-flex items-center gap-2 px-2 py-1 bg-muted/50 rounded-md border border-border">
      <div className={`w-2 h-2 rounded-full ${isPlaying ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
      <button
        type="button"
        onClick={handlePlayPause}
        className="text-xs font-medium hover:text-primary transition-colors uppercase tracking-wider"
      >
        {isPlaying ? "Live" : "Click to Hear"} {userId ? `(${userId.slice(0, 4)})` : ""}
      </button>
      {/* per-participant output selector intentionally omitted */}
      <audio 
        ref={audioRef} 
        autoPlay 
        playsInline 
        className="w-0 h-0 opacity-0 pointer-events-none absolute" 
      />
    </div>
  );
}
