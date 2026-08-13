/*
# Add monthly quota type and allow null work settings

1. Changes to `profiles`
- Add 'monthly' to the `hours_quota_type` check constraint (was daily/weekly only).
- Allow `hours_quota` to be null (meaning "no quota defined").
- Allow `work_days` to be null (meaning "no fixed work days").
- Allow `overtime_threshold` to be null (meaning "no overtime threshold").

2. Security
- No policy changes needed; existing RLS covers the columns.
*/

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_hours_quota_type_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_hours_quota_type_check
  CHECK (hours_quota_type IS NULL OR hours_quota_type IN ('daily','weekly','monthly'));

ALTER TABLE profiles
  ALTER COLUMN hours_quota DROP NOT NULL,
  ALTER COLUMN work_days DROP NOT NULL,
  ALTER COLUMN overtime_threshold DROP NOT NULL;
