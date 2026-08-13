/*
# Add per-employee work settings

Adds per-employee work configuration columns to the `profiles` table so managers
can define each employee's work days, hours quota, and overtime eligibility.

1. New columns on `profiles`
- `work_days` (integer[]) — days of week the employee is scheduled to work (0=Sun … 6=Sat). Defaults to all days.
- `hours_quota_type` (text) — 'daily' or 'weekly', determines whether the hours quota is per day or per week. Defaults to 'daily'.
- `hours_quota` (numeric) — number of standard hours the employee is expected to work (per day or per week, depending on type). Defaults to 8.
- `overtime_eligible` (boolean) — whether the employee is eligible for overtime. Defaults to false.
- `overtime_threshold` (numeric) — hours after which overtime starts counting. Defaults to 8 (daily) / 40 (weekly).

2. Security
- No new tables. Existing RLS policies on `profiles` already cover these columns (column-level privileges are not restricted).
- No policy changes needed.
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS work_days integer[] DEFAULT ARRAY[0,1,2,3,4,5,6]::integer[],
  ADD COLUMN IF NOT EXISTS hours_quota_type text DEFAULT 'daily' CHECK (hours_quota_type IN ('daily','weekly')),
  ADD COLUMN IF NOT EXISTS hours_quota numeric(5,2) DEFAULT 8,
  ADD COLUMN IF NOT EXISTS overtime_eligible boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS overtime_threshold numeric(5,2) DEFAULT 8;
