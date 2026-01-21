import { useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/supabase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(async () => {
            let { data } = await supabase
              .from("profiles")
              .select("*")
              .eq("user_id", session.user.id)
              .maybeSingle();

            if (!data) {
                // Profile missing (e.g. wiped DB), recreate it
                const { data: newProfile, error } = await supabase
                    .from("profiles")
                    .insert({ 
                        user_id: session.user.id,
                        email: session.user.email,
                        // Add default fields if needed, e.g. username from email or null?
                        // Let's assume UsernameSetup will handle username later if null.
                    })
                    .select()
                    .single();
                
                if (!error) data = newProfile;
            }

            setProfile(data as Profile | null);
          }, 0);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        supabase
          .from("profiles")
          .select("*")
          .eq("user_id", session.user.id)
          .maybeSingle()
          .then(async ({ data }) => {
            if (!data) {
                // Profile missing, recreate
                 const { data: newProfile } = await supabase
                    .from("profiles")
                    .insert({ 
                        user_id: session.user.id,
                        email: session.user.email,
                    })
                    .select()
                    .single();
                 setProfile(newProfile as Profile | null);
            } else {
                setProfile(data as Profile | null);
            }
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) throw error;
    setProfile(data as Profile);
    return data;
  };

  return {
    user,
    profile,
    session,
    loading,
    signInWithGoogle,
    signOut,
    updateProfile,
  };
}
