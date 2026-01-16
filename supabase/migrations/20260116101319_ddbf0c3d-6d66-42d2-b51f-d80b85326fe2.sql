-- Prevent RLS infinite recursion on conversation_members by using a SECURITY DEFINER helper

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

-- Recreate SELECT policy without querying conversation_members directly inside the policy expression
DROP POLICY IF EXISTS "Members can view conversation members" ON public.conversation_members;

CREATE POLICY "Members can view conversation members"
ON public.conversation_members
FOR SELECT
USING (
  public.is_conversation_member(conversation_members.conversation_id, auth.uid())
);
