import { useEffect, useRef, useState, useCallback } from "react";

// Lightweight local transcription hook — no network, no persistence.
export function useTranscription(enabled: boolean) {
  const [current, setCurrent] = useState("");
  const [isFinal, setIsFinal] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const recognitionRef = useRef<any>(null);

  const supported = typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const clear = useCallback(() => {
    setCurrent("");
    setIsFinal(false);
  }, []);

  useEffect(() => {
    if (!supported) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) final += result[0].transcript;
        else interim += result[0].transcript;
      }

      if (final) {
        setCurrent(final.trim());
        setIsFinal(true);
      } else if (interim) {
        setCurrent(interim.trim());
        setIsFinal(false);
      }
    };

    recognition.onstart = () => setIsActive(true);
    recognition.onend = () => {
      setIsActive(false);
      // Auto-restart while enabled
      if (recognitionRef.current && enabled) {
        try { recognitionRef.current.start(); } catch (e) {}
      }
    };

    recognition.onerror = (ev: any) => {
      console.warn("SpeechRecognition error:", ev);
      if (ev.error === 'no-speech') {
        // clear interim when no speech detected
        setCurrent("");
        setIsFinal(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try { recognition.stop(); } catch (e) {}
      recognitionRef.current = null;
    };
  }, [supported, enabled]);

  useEffect(() => {
    if (!supported) return;
    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (enabled) {
      try { recognition.start(); } catch (e) {}
    } else {
      try { recognition.stop(); } catch (e) {}
      clear();
    }
  }, [enabled, supported, clear]);

  return { current, isFinal, supported, isActive, clear };
}
