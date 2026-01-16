-- Allow conversation owners to view their conversations even before membership rows are inserted
DROP POLICY IF EXISTS "Users can view conversations they are members of" ON public.conversations;

CREATE POLICY "Users can view conversations they are members of"
ON public.conversations
FOR SELECT
USING (
  auth.uid() = owner_id
  OR EXISTS (
    SELECT 1
    FROM public.conversation_members
    WHERE conversation_members.conversation_id = conversations.id
      AND conversation_members.user_id = auth.uid()
  )
  OR is_channel = true
);
