import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function usePresence(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    const updateStatus = async (isOnline: boolean) => {
      try {
        await supabase
          .from('profiles')
          .update({
            is_online: isOnline,
            last_seen: new Date().toISOString(),
          })
          .eq('user_id', userId);
      } catch (error) {
        console.error('Error updating presence:', error);
      }
    };

    // Set online when component mounts
    updateStatus(true);

    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      updateStatus(isVisible);
    };

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set offline when component unmounts
    return () => {
      updateStatus(false);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId]);
}
