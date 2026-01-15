import { supabase } from "@/integrations/supabase/client";

export { supabase };

export type Profile = {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  user_code: string;
  is_online: boolean;
  last_seen: string;
  created_at: string;
  updated_at: string;
};

export type Conversation = {
  id: string;
  name: string | null;
  is_group: boolean;
  is_channel: boolean;
  invite_code: string;
  owner_id: string | null;
  avatar_url: string | null;
  has_audio: boolean;
  created_at: string;
  updated_at: string;
};

export type ConversationMember = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: 'text' | 'image' | 'file' | 'audio' | 'video' | 'system';
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

export type AudioParticipant = {
  id: string;
  conversation_id: string;
  user_id: string;
  is_muted: boolean;
  joined_at: string;
};
