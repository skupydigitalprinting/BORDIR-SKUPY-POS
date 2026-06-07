-- =====================================================================
-- Bordir Skupy POS — Migration: Sumber Dana Aset & Sewa
-- =====================================================================
-- fixed_assets.funding & prepaid_rent.funding: cash | transfer | hutang
--   * cash/transfer → Kas berkurang
--   * hutang        → Kas TIDAK berkurang, Hutang bertambah (otomatis)
-- Idempotent & AMAN — tidak menghapus / mengubah data lama (default 'cash').
-- =====================================================================

ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS funding text DEFAULT 'cash';
ALTER TABLE public.prepaid_rent ADD COLUMN IF NOT EXISTS funding text DEFAULT 'cash';

NOTIFY pgrst, 'reload schema';
