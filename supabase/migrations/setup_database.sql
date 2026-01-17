-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create profiles table for user data
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  user_code TEXT UNIQUE DEFAULT upper(substring(md5(random()::text) from 1 for 8)),
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create conversations table (for 1-on-1 and groups)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  is_group BOOLEAN DEFAULT false,
  is_channel BOOLEAN DEFAULT false,
  invite_code TEXT UNIQUE DEFAULT upper(substring(md5(random()::text) from 1 for 8)),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  avatar_url TEXT,
  has_audio BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create conversation members table
CREATE TABLE IF NOT EXISTS public.conversation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'audio', 'video', 'system')),
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create audio room participants table
CREATE TABLE IF NOT EXISTS public.audio_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_muted BOOLEAN DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_participants ENABLE ROW LEVEL SECURITY;

-- Helper Functions (SECURITY DEFINER to bypass RLS for specific checks and prevent recursion)
CREATE OR REPLACE FUNCTION public.is_conversation_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_members
    WHERE conversation_id = _conversation_id
      AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_owner(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = _conversation_id
      AND c.owner_id = _user_id
  );
$$;

-- Secure Function to Join Group by Code
CREATE OR REPLACE FUNCTION public.join_group_by_code(invite_code_input text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv_id uuid;
  existing_member uuid;
BEGIN
  -- 1. Find the conversation by code
  SELECT id INTO conv_id
  FROM public.conversations
  WHERE invite_code = upper(trim(invite_code_input));

  IF conv_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid invite code');
  END IF;

  -- 2. Check if already a member
  SELECT id INTO existing_member
  FROM public.conversation_members
  WHERE conversation_id = conv_id AND user_id = auth.uid();

  IF existing_member IS NOT NULL THEN
     RETURN json_build_object('success', false, 'error', 'You are already a member');
  END IF;

  -- 3. Insert member
  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  VALUES (conv_id, auth.uid(), 'member');

  RETURN json_build_object('success', true, 'conversation_id', conv_id);
END;
$$;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Conversations policies
DROP POLICY IF EXISTS "Users can view conversations they are members of" ON public.conversations;
CREATE POLICY "Users can view conversations they are members of"
ON public.conversations
FOR SELECT
USING (
  auth.uid() = owner_id
  OR public.is_conversation_member(id, auth.uid())
  OR is_channel = true
);

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations" ON public.conversations 
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can update conversations" ON public.conversations;
CREATE POLICY "Owners can update conversations" ON public.conversations 
  FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can delete conversations" ON public.conversations;
CREATE POLICY "Owners can delete conversations" ON public.conversations 
  FOR DELETE USING (auth.uid() = owner_id);

-- Conversation members policies
DROP POLICY IF EXISTS "Members can view conversation members" ON public.conversation_members;
CREATE POLICY "Members can view conversation members"
ON public.conversation_members
FOR SELECT
USING (
  public.is_conversation_member(conversation_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can join conversations" ON public.conversation_members;
CREATE POLICY "Users can join conversations"
ON public.conversation_members
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR public.is_conversation_owner(conversation_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can leave conversations" ON public.conversation_members;
CREATE POLICY "Users can leave conversations" ON public.conversation_members 
  FOR DELETE USING (auth.uid() = user_id OR public.is_conversation_owner(conversation_id, auth.uid()));

-- Messages policies
DROP POLICY IF EXISTS "Members can view messages" ON public.messages;
CREATE POLICY "Members can view messages" ON public.messages 
  FOR SELECT USING (
    public.is_conversation_member(conversation_id, auth.uid())
  );
  
DROP POLICY IF EXISTS "Members can send messages" ON public.messages;
CREATE POLICY "Members can send messages" ON public.messages 
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND 
    public.is_conversation_member(conversation_id, auth.uid())
  );
  
DROP POLICY IF EXISTS "Senders can update own messages" ON public.messages;
CREATE POLICY "Senders can update own messages" ON public.messages 
  FOR UPDATE USING (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Senders can delete own messages" ON public.messages;
CREATE POLICY "Senders can delete own messages" ON public.messages 
  FOR DELETE USING (auth.uid() = sender_id);

-- Audio participants policies
DROP POLICY IF EXISTS "Members can view audio participants" ON public.audio_participants;
CREATE POLICY "Members can view audio participants" ON public.audio_participants 
  FOR SELECT USING (
    public.is_conversation_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can join audio" ON public.audio_participants;
CREATE POLICY "Users can join audio" ON public.audio_participants 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave audio" ON public.audio_participants;
CREATE POLICY "Users can leave audio" ON public.audio_participants 
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update audio status" ON public.audio_participants;
CREATE POLICY "Users can update audio status" ON public.audio_participants 
  FOR UPDATE USING (auth.uid() = user_id);

-- Create function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for timestamp updates
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_messages_updated_at ON public.messages;
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for messages and audio participants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'audio_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.audio_participants;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'conversation_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
  END IF;
END $$;

-- Create storage bucket for chat files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-files', 'chat-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Anyone can view chat files" ON storage.objects;
CREATE POLICY "Anyone can view chat files" ON storage.objects FOR SELECT USING (bucket_id = 'chat-files');

DROP POLICY IF EXISTS "Authenticated users can upload chat files" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat-files' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
CREATE POLICY "Users can delete own files" ON storage.objects FOR DELETE USING (bucket_id = 'chat-files' AND auth.uid()::text = (storage.foldername(name))[1]);
