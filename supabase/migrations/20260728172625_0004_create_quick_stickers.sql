/*
# Create quick_stickers table

1. New Tables
- `quick_stickers` — predefined labels employees can tap for one-click attendance reporting
  - `id` (uuid, primary key)
  - `label` (text, not null) — the sticker text shown to employees (e.g. "משרד ראשי")
  - `icon` (text, nullable) — optional emoji or icon name
  - `color` (text, nullable) — optional color tag for visual grouping
  - `sort_order` (int, default 0) — display ordering
  - `created_at` (timestamptz, default now())
2. Security
- Enable RLS on `quick_stickers`.
- Only managers can create/update/delete stickers.
- Both managers and employees can read stickers (employees need to see them for quick reporting).
*/

CREATE TABLE IF NOT EXISTS quick_stickers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  icon text,
  color text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE quick_stickers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stickers_select_all" ON quick_stickers;
CREATE POLICY "stickers_select_all" ON quick_stickers FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "stickers_insert_manager" ON quick_stickers;
CREATE POLICY "stickers_insert_manager" ON quick_stickers FOR INSERT
  TO authenticated WITH CHECK (public.is_manager());

DROP POLICY IF EXISTS "stickers_update_manager" ON quick_stickers;
CREATE POLICY "stickers_update_manager" ON quick_stickers FOR UPDATE
  TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());

DROP POLICY IF EXISTS "stickers_delete_manager" ON quick_stickers;
CREATE POLICY "stickers_delete_manager" ON quick_stickers FOR DELETE
  TO authenticated USING (public.is_manager());
