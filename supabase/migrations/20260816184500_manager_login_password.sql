ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS login_password text;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS login_email text;
