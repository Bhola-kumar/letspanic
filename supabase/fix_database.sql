-- Run this in your Supabase SQL Editor to fix the join errors

-- 1. Fix conversations owner selection
ALTER TABLE public.conversations
DROP CONSTRAINT IF EXISTS conversations_owner_id_fkey,
ADD CONSTRAINT conversations_owner_id_fkey 
FOREIGN KEY (owner_id) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

-- 2. Fix conversation members profiles selection
ALTER TABLE public.conversation_members
DROP CONSTRAINT IF EXISTS conversation_members_user_id_fkey,
ADD CONSTRAINT conversation_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- 3. Fix messages sender profiles selection
ALTER TABLE public.messages
DROP CONSTRAINT IF EXISTS messages_sender_id_fkey,
ADD CONSTRAINT messages_sender_id_fkey 
FOREIGN KEY (sender_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- 4. Fix audio participants profiles selection
ALTER TABLE public.audio_participants
DROP CONSTRAINT IF EXISTS audio_participants_user_id_fkey,
ADD CONSTRAINT audio_participants_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Notify that the fix is applied
-- This will help verify if the SQL was executed successfully
DO $$ 
BEGIN 
  RAISE NOTICE 'Database relationships have been fixed.';
END $$;
