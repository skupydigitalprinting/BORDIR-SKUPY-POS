-- =====================================================================
-- Bordir Skupy POS — Migration: Relasi Pengeluaran ↔ Pembayaran Hutang
-- =====================================================================
-- Melengkapi relasi audit antara pembayaran hutang & pengeluaran:
--   expenses.liability_id          → liabilities.id        (= "debt_id")
--   expenses.liability_payment_id  → liability_payments.id (= "debt_payment_id")
--   liability_payments.expense_id  → expenses.id           (sudah ada)
-- Idempotent & AMAN — tidak menghapus / mengubah data lama.
-- =====================================================================

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS liability_id uuid;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS liability_payment_id uuid;

CREATE INDEX IF NOT EXISTS idx_expenses_liability        ON public.expenses (liability_id);
CREATE INDEX IF NOT EXISTS idx_expenses_liability_payment ON public.expenses (liability_payment_id);

NOTIFY pgrst, 'reload schema';
