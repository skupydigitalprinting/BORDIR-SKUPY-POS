-- =====================================================================
-- Bordir Skupy POS — Migration: Pembayaran Hutang (FIFO) + integrasi
-- =====================================================================
-- * liabilities (+kolom paid, type 5 jenis)
-- * liability_payments  → riwayat pembayaran hutang
-- * expenses (+affects_profit, +liability_id) → pembayaran masuk pengeluaran
-- * kategori 'pembayaran-hutang'
-- Idempotent & AMAN — tidak menghapus / mengubah data lama.
-- Jalankan di Supabase -> SQL Editor -> Run.
-- =====================================================================

-- ---------- liabilities: total dibayar ----------
ALTER TABLE public.liabilities ADD COLUMN IF NOT EXISTS paid numeric DEFAULT 0;
-- type kini menampung: operasional | aset | sewa | supplier | bank
-- (nilai lama supplier/bank/lain tetap valid)

-- ---------- expenses: flag laba + link hutang ----------
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS affects_profit boolean DEFAULT true;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS liability_id uuid REFERENCES public.liabilities(id) ON DELETE SET NULL;

-- ---------- kategori pengeluaran 'pembayaran-hutang' ----------
INSERT INTO public.expense_categories (id, name, icon, sort) VALUES
  ('pembayaran-hutang', 'Pembayaran Hutang', '💳', 8)
ON CONFLICT (id) DO NOTHING;

-- ---------- liability_payments ----------
CREATE TABLE IF NOT EXISTS public.liability_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  liability_id    uuid REFERENCES public.liabilities(id) ON DELETE CASCADE,
  payment_date    date DEFAULT CURRENT_DATE,
  amount          numeric NOT NULL DEFAULT 0,
  payment_method  text DEFAULT 'transfer',
  notes           text DEFAULT '',
  expense_id      uuid REFERENCES public.expenses(id) ON DELETE SET NULL,
  created_by      uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_liability_payments_liability ON public.liability_payments (liability_id);
CREATE INDEX IF NOT EXISTS idx_liability_payments_date      ON public.liability_payments (payment_date DESC);

-- ---------- RLS + GRANT ----------
ALTER TABLE public.liability_payments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "anon all liability_payments" ON public.liability_payments FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.liability_payments TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;

-- ---------- REALTIME ----------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='liability_payments') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.liability_payments';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
