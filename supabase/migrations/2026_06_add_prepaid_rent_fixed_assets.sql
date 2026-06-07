-- =====================================================================
-- Bordir Skupy POS — Migration: Sewa Dibayar Dimuka + Aset Tetap
-- =====================================================================
-- Menambahkan akuntansi yang lebih profesional:
--   * prepaid_rent  → sewa dibayar dimuka (diamortisasi per bulan)
--   * fixed_assets  → aset tetap (capital, bukan beban langsung)
-- Idempotent & AMAN — tidak menghapus / mengubah data lama.
-- Jalankan di Supabase -> SQL Editor -> Run.
-- =====================================================================

-- ---------- SEWA DIBAYAR DIMUKA ----------
CREATE TABLE IF NOT EXISTS public.prepaid_rent (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL DEFAULT '',
  location         text DEFAULT '',
  start_date       date NOT NULL DEFAULT CURRENT_DATE,
  end_date         date,
  months           integer NOT NULL DEFAULT 1,
  total_amount     numeric NOT NULL DEFAULT 0,
  monthly_expense  numeric NOT NULL DEFAULT 0,   -- total_amount / months
  remaining_value  numeric NOT NULL DEFAULT 0,   -- nilai awal = total (live dihitung di app)
  notes            text DEFAULT '',
  cashier_id       uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prepaid_rent_start ON public.prepaid_rent (start_date DESC);

-- ---------- ASET TETAP ----------
CREATE TABLE IF NOT EXISTS public.fixed_assets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL DEFAULT '',
  category       text DEFAULT '',                -- mis. Mesin, Kendaraan, Perabot
  amount         numeric NOT NULL DEFAULT 0,     -- nilai perolehan
  purchase_date  date DEFAULT CURRENT_DATE,
  notes          text DEFAULT '',
  cashier_id     uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fixed_assets_date ON public.fixed_assets (purchase_date DESC);

-- ---------- updated_at trigger ----------
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prepaid_rent_updated_at ON public.prepaid_rent;
CREATE TRIGGER prepaid_rent_updated_at BEFORE UPDATE ON public.prepaid_rent
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS fixed_assets_updated_at ON public.fixed_assets;
CREATE TRIGGER fixed_assets_updated_at BEFORE UPDATE ON public.fixed_assets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- RLS + GRANT ----------
ALTER TABLE public.prepaid_rent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "anon all prepaid_rent" ON public.prepaid_rent FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "anon all fixed_assets" ON public.fixed_assets FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prepaid_rent TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixed_assets TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;

-- ---------- REALTIME ----------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='prepaid_rent') THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.prepaid_rent';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='fixed_assets') THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.fixed_assets';
    END IF;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
