-- =====================================================================
-- Bordir Skupy POS — Migration: Modul Pengeluaran (expenses)
-- =====================================================================
-- Menambahkan tabel `expenses` untuk pencatatan pengeluaran toko.
-- Idempotent — aman dijalankan berulang di Supabase SQL Editor.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.expenses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date            date NOT NULL DEFAULT CURRENT_DATE,   -- tanggal pengeluaran
  name            text NOT NULL DEFAULT '',             -- nama pengeluaran
  amount          numeric NOT NULL DEFAULT 0,           -- nominal
  category        text DEFAULT '',                      -- kategori (bahan/gaji/dst)
  notes           text DEFAULT '',                      -- catatan/keterangan
  payment_method  text DEFAULT 'transfer',                  -- cash | transfer | qris
  cashier_id      uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date       ON public.expenses (date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON public.expenses (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category   ON public.expenses (category);

-- updated_at otomatis (memakai fungsi yang sudah ada di schema utama;
-- kalau belum ada, buat di sini supaya migration tetap mandiri).
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS expenses_updated_at ON public.expenses;
CREATE TRIGGER expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- RLS — sama seperti tabel lain (anon key, akses penuh dari app).
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "anon all expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- GRANT privilege tabel ke role anon + authenticated.
-- WAJIB: RLS policy saja tidak cukup — tanpa GRANT ini muncul
-- "permission denied for table expenses".
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;

-- Realtime — daftarkan ke publication supabase_realtime kalau belum ada.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'expenses'
     ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
