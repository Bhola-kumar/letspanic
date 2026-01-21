-- Add last_read_at to conversation_members
ALTER TABLE conversation_members 
ADD COLUMN last_read_at TIMESTAMPTZ DEFAULT NOW();

-- Function to mark a conversation as read
CREATE OR REPLACE FUNCTION mark_conversation_read(p_conversation_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE conversation_members
  SET last_read_at = NOW()
  WHERE conversation_id = p_conversation_id
  AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread counts
-- Returns list of conversation_ids and their unread count for the calling user
CREATE OR REPLACE FUNCTION get_unread_counts()
RETURNS TABLE (conversation_id UUID, unread_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.conversation_id,
    COUNT(msg.id) as unread_count
  FROM conversation_members m
  JOIN messages msg ON msg.conversation_id = m.conversation_id
  WHERE m.user_id = auth.uid()
  AND msg.created_at > m.last_read_at
  AND msg.sender_id != auth.uid() -- Don't count own messages
  AND msg.is_deleted = false
  GROUP BY m.conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
