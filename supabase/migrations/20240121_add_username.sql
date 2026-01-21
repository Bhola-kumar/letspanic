-- Add username column to profiles
ALTER TABLE profiles 
ADD COLUMN username TEXT UNIQUE;

-- Create index for faster search
CREATE INDEX idx_profiles_username ON profiles(username);

-- RPC to check if username is available
CREATE OR REPLACE FUNCTION check_username_available(username_input TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM profiles WHERE username = LOWER(username_input)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC to update username
CREATE OR REPLACE FUNCTION update_username(username_input TEXT)
RETURNS JSONB AS $$
DECLARE
  updated_profile profiles%ROWTYPE;
BEGIN
  -- Validate username format (alphanumeric, 3-20 chars)
  IF NOT (username_input ~* '^[a-zA-Z0-9_]{3,20}$') THEN
    RAISE EXCEPTION 'Username must be 3-20 characters long and contain only letters, numbers, and underscores.';
  END IF;

  -- Check availability again to be safe
  IF EXISTS (SELECT 1 FROM profiles WHERE username = LOWER(username_input)) THEN
    RAISE EXCEPTION 'Username is already taken.';
  END IF;

  UPDATE profiles
  SET username = LOWER(username_input)
  WHERE user_id = auth.uid()
  RETURNING * INTO updated_profile;

  RETURN to_jsonb(updated_profile);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
