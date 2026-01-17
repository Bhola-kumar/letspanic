import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

export function useOnlineStatus() {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    // Initial fetch of online users
    const fetchOnlineUsers = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("is_online", true);
      
      if (data) {
        setOnlineUsers(new Set(data.map((u) => u.user_id)));
      }
    };

    fetchOnlineUsers();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("online-status")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
        },
        (payload) => {
          const { new: newProfile } = payload;
          setOnlineUsers((prev) => {
            const next = new Set(prev);
            if (newProfile.is_online) {
              next.add(newProfile.user_id);
            } else {
              next.delete(newProfile.user_id);
            }
            return next;
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return onlineUsers;
}
