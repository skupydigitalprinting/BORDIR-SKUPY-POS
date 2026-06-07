import React, { useMemo, useState } from 'react'
import {
  Search, Plus, Edit2, Trash2, Wallet, TrendingDown, CalendarDays,
  Tags, X, AlertTriangle, Loader2, Receipt,
} from 'lucide-react'
import { Input, Button, EmptyState } from '../components/ui'
import Modal from '../components/Modal'
import CategoryManager from '../components/CategoryManager'
import { formatRupiah, formatDate } from '../utils/helpers'
import { useExpenseCategories, getExpenseCatLabel } from '../hooks/useExpenseCategories'
import { useToast } from '../components/Toast'

const PAYMENT_OPTIONS = [
  { id: 'cash', label: 'Cash' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'qris', label: 'QRIS' },
]

const todayISO = () => new Date().toISOString().slice(0, 10)
const EMPTY = () => ({ date: todayISO(), name: '', amount: '', category: '', notes: '', paymentMethod: 'cash' })

export default function Pengeluaran({
  expenses = [], addExpense, updateExpense, deleteExpense, busy,
}) {
  const toast = useToast()
  const { categories, addCategory, updateCategory, deleteCategory } = useExpenseCategories()

  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY())
  const [saving, setSaving] = useState(false)
  const [delTarget, setDelTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [catOpen, setCatOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return expenses.filter(e => {
      const matchQ = !q || (e.name || '').toLowerCase().includes(q) || (e.notes || '').toLowerCase().includes(q)
      const matchCat = filterCat === 'all' ? true : e.category === filterCat
      return matchQ && matchCat
    })
  }, [expenses, search, filterCat])

  const totalAll = useMemo(() => expenses.reduce((s, e) => s + (+e.amount || 0), 0), [expenses])
  const totalMonth = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    return expenses.filter(e => new Date(e.date) >= monthStart).reduce((s, e) => s + (+e.amount || 0), 0)
  }, [expenses])
  const totalFiltered = useMemo(() => filtered.reduce((s, e) => s + (+e.amount || 0), 0), [filtered])

  const openAdd = () => {
    setEditId(null)
    setForm({ ...EMPTY(), category: categories[0]?.id || '' })
    setModalOpen(true)
  }
  const openEdit = (e) => {
    setEditId(e.id)
    setForm({
      date: e.date || todayISO(),
      name: e.name || '',
      amount: String(e.amount || ''),
      category: e.category || '',
      notes: e.notes || '',
      paymentMethod: e.paymentMethod || 'cash',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (saving) return
    if (!form.name.trim()) return toast.error('Nama pengeluaran wajib diisi')
    const amount = Number(String(form.amount).replace(/[^\d]/g, ''))
    if (!amount || amount <= 0) return toast.error('Nominal harus lebih dari 0')
    setSaving(true)
    try {
      const data = {
        date: form.date || todayISO(),
        name: form.name.trim(),
        amount,
        category: form.category || '',
        notes: form.notes.trim(),
        paymentMethod: form.paymentMethod || 'cash',
      }
      const res = editId ? await updateExpense(editId, data) : await addExpense(data)
      if (res.ok) {
        toast.success(editId ? 'Pengeluaran diperbarui' : 'Pengeluaran ditambahkan')
        setModalOpen(false)
      } else {
        toast.error(res.error || 'Gagal menyimpan')
      }
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!delTarget || deleting) return
    setDeleting(true)
    try {
      const res = await deleteExpense(delTarget.id)
      if (res.ok) { toast.success('Pengeluaran dihapus'); setDelTarget(null) }
      else toast.error(res.error || 'Gagal menghapus')
    } finally { setDeleting(false) }
  }

  const onAmountChange = (e) => {
    const digits = e.target.value.replace(/[^\d]/g, '')
    setForm(p => ({ ...p, amount: digits }))
  }
  const amountDisplay = form.amount ? Number(form.amount).toLocaleString('id-ID') : ''

  return (
    <div className="flex-1 overflow-y-auto mesh-bg">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Pengeluaran Toko</div>
            <h2 className="text-xl sm:text-2xl font-bold mt-0.5"
              style={{ fontFamily: 'Syne', color: 'var(--text-primary)' }}>
              {expenses.length} catatan pengeluaran
            </h2>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setCatOpen(true)}>
              <Tags size={15} /> Kategori
            </Button>
            <Button variant="primary" onClick={openAdd}>
              <Plus size={15} /> Tambah
            </Button>
          </div>
        </div>

        {/* Stat strips */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <div className="rounded-2xl p-4" style={{
            background: 'linear-gradient(135deg, rgba(255,77,106,0.08), rgba(234,88,12,0.04))',
            border: '1px solid rgba(255,77,106,0.25)',
          }}>
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown size={13} style={{ color: '#ff4d6a' }} />
              <p className="text-xs font-semibold" style={{ color: '#ff4d6a', fontFamily: 'Syne' }}>
                Total Pengeluaran
              </p>
            </div>
            <p className="text-base sm:text-lg font-bold truncate" style={{ color: '#ff4d6a', fontFamily: 'Syne' }}>
              {formatRupiah(totalAll)}
            </p>
          </div>
          <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays size={13} style={{ color: 'var(--accent-light)' }} />
              <p className="text-xs font-semibold" style={{ color: 'var(--accent-light)', fontFamily: 'Syne' }}>
                Bulan Ini
              </p>
            </div>
            <p className="text-base sm:text-lg font-bold truncate" style={{ color: 'var(--text-primary)', fontFamily: 'Syne' }}>
              {formatRupiah(totalMonth)}
            </p>
          </div>
          <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Receipt size={13} style={{ color: 'var(--text-secondary)' }} />
              <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)', fontFamily: 'Syne' }}>
                Hasil Filter
              </p>
            </div>
            <p className="text-base sm:text-lg font-bold truncate" style={{ color: 'var(--text-primary)', fontFamily: 'Syne' }}>
              {formatRupiah(totalFiltered)}
            </p>
          </div>
        </div>

        {/* Search + filter */}
        <div className="flex gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama / keterangan pengeluaran..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            <button onClick={() => setFilterCat('all')}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-all flex-shrink-0"
              style={{
                background: filterCat === 'all' ? 'linear-gradient(135deg, var(--accent), #6366f1)' : 'var(--bg-card)',
                color: filterCat === 'all' ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${filterCat === 'all' ? 'transparent' : 'var(--border)'}`,
                fontFamily: 'Syne',
              }}>
              Semua
            </button>
            {categories.map(c => (
              <button key={c.id} onClick={() => setFilterCat(c.id)}
                className="px-3 py-2 rounded-xl text-xs font-semibold transition-all flex-shrink-0"
                style={{
                  background: filterCat === c.id ? 'linear-gradient(135deg, var(--accent), #6366f1)' : 'var(--bg-card)',
                  color: filterCat === c.id ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${filterCat === c.id ? 'transparent' : 'var(--border)'}`,
                  fontFamily: 'Syne',
                }}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Belum ada pengeluaran"
            description="Catat pengeluaran toko (bahan, gaji, listrik, dll) untuk menghitung laba bersih"
            action={<Button variant="primary" size="sm" onClick={openAdd}><Plus size={13} /> Tambah</Button>}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((e, idx) => (
              <div key={e.id}
                className="rounded-2xl p-4 animate-fadeIn flex items-center gap-3"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', animationDelay: `${idx * 20}ms` }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  {categories.find(c => c.id === e.category)?.icon || '📦'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {e.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide"
                      style={{ background: 'rgba(139,92,246,0.12)', color: 'var(--accent-light)', fontFamily: 'Syne' }}>
                      {getExpenseCatLabel(e.category)}
                    </span>
                  </div>
                  <div className="text-xs mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-muted)' }}>
                    <span>{formatDate(e.date)}</span>
                    <span>·</span>
                    <span className="uppercase">{e.paymentMethod}</span>
                    {e.notes && (<><span>·</span><span className="truncate">{e.notes}</span></>)}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm sm:text-base font-bold" style={{ color: '#ff4d6a', fontFamily: 'Syne' }}>
                    {formatRupiah(e.amount)}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(e)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center btn-press"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => setDelTarget(e)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center btn-press"
                    style={{ background: 'rgba(255,77,106,0.08)', color: 'var(--red)', border: '1px solid rgba(255,77,106,0.15)' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}
        subtitle="Catat pengeluaran toko"
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Tanggal" type="date" value={form.date}
              onChange={(e) => setForm(p => ({ ...p, date: e.target.value }))}
              style={{ colorScheme: 'dark' }} />
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)', fontFamily: 'Syne' }}>
                Nominal
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }}>Rp</span>
                <input inputMode="numeric" value={amountDisplay} onChange={onAmountChange}
                  placeholder="0"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              </div>
            </div>
          </div>

          <Input label="Nama Pengeluaran" value={form.name}
            onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="cth: Beli benang bordir" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)', fontFamily: 'Syne' }}>
                Kategori
              </label>
              <select value={form.category}
                onChange={(e) => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)', fontFamily: 'Syne' }}>
                Metode Pembayaran
              </label>
              <select value={form.paymentMethod}
                onChange={(e) => setForm(p => ({ ...p, paymentMethod: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                {PAYMENT_OPTIONS.map(o => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)', fontFamily: 'Syne' }}>
              Catatan / Keterangan
            </label>
            <textarea rows={2} value={form.notes}
              onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl text-sm resize-none"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Batal</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving || busy}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {saving ? 'Menyimpan...' : editId ? 'Simpan' : 'Tambah'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!delTarget} onClose={() => setDelTarget(null)} title="Hapus Pengeluaran" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.2)' }}>
              <AlertTriangle size={16} style={{ color: 'var(--red)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Hapus pengeluaran <strong style={{ color: 'var(--text-primary)' }}>{delTarget?.name}</strong> sebesar{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{formatRupiah(delTarget?.amount || 0)}</strong>? Tindakan ini tidak bisa dibatalkan.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDelTarget(null)} disabled={deleting}>Batal</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Hapus
            </Button>
          </div>
        </div>
      </Modal>

      {/* Category manager */}
      <CategoryManager
        open={catOpen}
        onClose={() => setCatOpen(false)}
        categories={categories}
        addCategory={addCategory}
        updateCategory={updateCategory}
        deleteCategory={deleteCategory}
      />
    </div>
  )
}
