-- Fix 403 on inserting conversation_members when creating direct chats/groups
-- Allow conversation owners to add other users as members (still allows users to add themselves)

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

DROP POLICY IF EXISTS "Users can join conversations" ON public.conversation_members;

CREATE POLICY "Users can join conversations"
ON public.conversation_members
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR public.is_conversation_owner(conversation_id, auth.uid())
);