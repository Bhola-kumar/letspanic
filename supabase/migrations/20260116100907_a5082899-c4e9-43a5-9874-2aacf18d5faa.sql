-- Fix infinite recursion in conversation_members SELECT policy
DROP POLICY IF EXISTS "Members can view conversation members" ON public.conversation_members;

CREATE POLICY "Members can view conversation members" 
ON public.conversation_members 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = conversation_members.conversation_id 
    AND cm.user_id = auth.uid()
  )
);

-- Fix infinite recursion in conversations SELECT policy  
DROP POLICY IF EXISTS "Users can view conversations they are members of" ON public.conversations;

CREATE POLICY "Users can view conversations they are members of" 
ON public.conversations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_members.conversation_id = conversations.id 
    AND conversation_members.user_id = auth.uid()
  ) 
  OR is_channel = true
);