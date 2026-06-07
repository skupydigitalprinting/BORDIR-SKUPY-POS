-- =====================================================================
-- Bordir Skupy POS — Migration: Hutang Usaha + Penyusutan Aset Tetap
-- =====================================================================
-- * liabilities             → hutang (supplier / bank / lain)
-- * fixed_assets (+kolom)   → penyusutan otomatis (nilai buku)
-- Idempotent & AMAN — tidak menghapus / mengubah data lama.
-- Jalankan di Supabase -> SQL Editor -> Run.
-- =====================================================================

-- ---------- HUTANG (liabilities) ----------
CREATE TABLE IF NOT EXISTS public.liabilities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL DEFAULT '',        -- nama kreditur
  type         text DEFAULT 'supplier',          -- supplier | bank | lain
  amount       numeric NOT NULL DEFAULT 0,
  date         date DEFAULT CURRENT_DATE,
  due_date     date,
  status       text DEFAULT 'aktif',             -- aktif | lunas
  notes        text DEFAULT '',
  cashier_id   uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_liabilities_status ON public.liabilities (status);
CREATE INDEX IF NOT EXISTS idx_liabilities_date   ON public.liabilities (date DESC);

-- ---------- PENYUSUTAN ASET TETAP ----------
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS depreciation_method text DEFAULT 'none';      -- none | percent | nominal
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS depreciation_value  numeric DEFAULT 0;        -- % per tahun ATAU nominal per tahun
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS depreciation_start  date;                     -- tanggal mulai penyusutan

-- ---------- updated_at ----------
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS liabilities_updated_at ON public.liabilities;
CREATE TRIGGER liabilities_updated_at BEFORE UPDATE ON public.liabilities
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- RLS + GRANT ----------
ALTER TABLE public.liabilities ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "anon all liabilities" ON public.liabilities FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.liabilities TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;

-- ---------- REALTIME ----------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='liabilities') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.liabilities';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
