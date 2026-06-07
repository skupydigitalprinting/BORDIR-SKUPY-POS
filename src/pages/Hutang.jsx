import React, { useMemo, useState } from 'react'
import {
  Plus, Edit2, Trash2, CreditCard, CalendarDays, AlertTriangle, Loader2,
  Wallet, History, ChevronDown, ChevronUp, Layers,
} from 'lucide-react'
import { Button, EmptyState } from '../components/ui'
import Modal from '../components/Modal'
import { formatRupiah, formatDate } from '../utils/helpers'
import { useToast } from '../components/Toast'

const LBL = 'block text-xs font-semibold mb-2'
const LBL_STYLE = { color: 'var(--text-secondary)', fontFamily: 'Syne', letterSpacing: '0.02em' }
const FIELD = 'w-full px-4 py-3 rounded-xl text-sm exp-field'
const FIELD_STYLE = { background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }

// Jenis hutang + apakah pembayarannya memotong laba operasional.
const TYPES = [
  { id: 'operasional', label: 'Hutang Operasional', profit: true,  hint: 'Pembayaran = pengeluaran operasional (memotong laba).' },
  { id: 'aset',        label: 'Hutang Aset',         profit: false, hint: 'Tidak memotong laba (aset sudah masuk Aset Tetap).' },
  { id: 'sewa',        label: 'Hutang Sewa',         profit: false, hint: 'Tidak memotong laba (beban via Sewa Dibayar Dimuka).' },
  { id: 'supplier',    label: 'Hutang Supplier/Stok', profit: false, hint: 'Tidak memotong laba (terkait persediaan).' },
  { id: 'bank',        label: 'Hutang Bank',         profit: false, hint: 'Pokok tidak memotong laba; bunga catat terpisah.' },
]
const PAYMENTS = [
  { id: 'transfer', label: 'Transfer' },
  { id: 'cash', label: 'Cash' },
  { id: 'qris', label: 'QRIS' },
  { id: 'ewallet', label: 'E-Wallet' },
  { id: 'lainnya', label: 'Lainnya' },
]
const typeMeta = (id) => TYPES.find(t => t.id === id) || { label: id || 'Hutang', profit: false }
const payLabel = (id) => PAYMENTS.find(p => p.id === id)?.label || id
const STATUS_META = {
  aktif:    { label: 'Aktif',    color: '#ff4d6a', bg: 'rgba(255,77,106,0.12)' },
  sebagian: { label: 'Sebagian', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  lunas:    { label: 'Lunas',    color: '#10d98a', bg: 'rgba(16,217,138,0.12)' },
}
const todayISO = () => new Date().toISOString().slice(0, 10)
const EMPTY = () => ({ name: '', type: 'operasional', amount: '', date: todayISO(), dueDate: '', notes: '' })

const digits = (v) => String(v).replace(/[^\d]/g, '')
const fmtInput = (v) => v ? Number(v).toLocaleString('id-ID') : ''

export default function Hutang({
  liabilities = [], liabilityPayments = [], admins = [],
  addLiability, updateLiability, deleteLiability,
  payLiability, payLiabilitiesFIFO, editLiabilityPayment, deleteLiabilityPayment, busy,
}) {
  const toast = useToast()
  const [filter, setFilter] = useState('aktif')
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY())
  const [saving, setSaving] = useState(false)
  const [delTarget, setDelTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [expanded, setExpanded] = useState(null)          // liabilityId yang riwayatnya dibuka
  const [payTarget, setPayTarget] = useState(null)        // liability untuk modal Bayar (null=tutup)
  const [fifoOpen, setFifoOpen] = useState(false)
  const [payForm, setPayForm] = useState({ date: todayISO(), amount: '', method: 'transfer', notes: '' })
  const [paying, setPaying] = useState(false)
  const [editPay, setEditPay] = useState(null)            // payment untuk modal edit
  const [delPay, setDelPay] = useState(null)              // payment untuk konfirmasi hapus

  const adminName = (id) => (admins.find(a => a.id === id)?.name) || '—'
  const filtered = useMemo(() => liabilities.filter(l => filter === 'all' ? true : l.status === filter), [liabilities, filter])
  const totalActive = useMemo(() => liabilities.reduce((s, l) => s + (l.remaining || 0), 0), [liabilities])
  const paymentsOf = (lid) => liabilityPayments.filter(p => p.liabilityId === lid)
    .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate))

  // ----- CRUD hutang -----
  const openAdd = () => { setEditId(null); setForm(EMPTY()); setModalOpen(true) }
  const openEdit = (l) => {
    setEditId(l.id)
    setForm({ name: l.name || '', type: l.type || 'operasional', amount: String(l.amount || ''), date: l.date || todayISO(), dueDate: l.dueDate || '', notes: l.notes || '' })
    setModalOpen(true)
  }
  const handleSave = async () => {
    if (saving) return
    if (!form.name.trim()) return toast.error('Nama kreditur wajib diisi')
    const amount = Number(digits(form.amount))
    if (!amount || amount <= 0) return toast.error('Nominal harus > 0')
    setSaving(true)
    try {
      const res = editId ? await updateLiability(editId, { ...form, amount }) : await addLiability({ ...form, amount })
      if (res.ok) { toast.success(editId ? 'Hutang diperbarui' : 'Hutang ditambahkan'); setModalOpen(false) }
      else toast.error(res.error || 'Gagal menyimpan')
    } finally { setSaving(false) }
  }
  const handleDelete = async () => {
    if (!delTarget || deleting) return
    setDeleting(true)
    try {
      const res = await deleteLiability(delTarget.id)
      if (res.ok) { toast.success('Hutang dihapus'); setDelTarget(null) }
      else toast.error(res.error || 'Gagal menghapus')
    } finally { setDeleting(false) }
  }

  // ----- Pembayaran -----
  const openPay = (l) => { setPayTarget(l); setPayForm({ date: todayISO(), amount: String(l.remaining || ''), method: 'transfer', notes: '' }) }
  const openFifo = () => { setFifoOpen(true); setPayForm({ date: todayISO(), amount: '', method: 'transfer', notes: '' }) }
  const submitPay = async () => {
    if (paying) return
    const amount = Number(digits(payForm.amount))
    if (!amount || amount <= 0) return toast.error('Nominal harus > 0')
    setPaying(true)
    try {
      const data = { date: payForm.date, amount, method: payForm.method, notes: payForm.notes.trim() }
      const res = payTarget
        ? await payLiability(payTarget.id, data)
        : await payLiabilitiesFIFO(amount, { date: payForm.date, method: payForm.method, notes: payForm.notes.trim() })
      if (res.ok) { toast.success('Pembayaran dicatat'); setPayTarget(null); setFifoOpen(false) }
      else toast.error(res.error || 'Gagal mencatat pembayaran')
    } finally { setPaying(false) }
  }

  const openEditPay = (p) => { setEditPay(p); setPayForm({ date: p.paymentDate || todayISO(), amount: String(p.amount || ''), method: p.paymentMethod || 'transfer', notes: p.notes || '' }) }
  const submitEditPay = async () => {
    if (paying) return
    const amount = Number(digits(payForm.amount))
    if (!amount || amount <= 0) return toast.error('Nominal harus > 0')
    setPaying(true)
    try {
      const res = await editLiabilityPayment(editPay.id, { date: payForm.date, amount, method: payForm.method, notes: payForm.notes.trim() })
      if (res.ok) { toast.success('Pembayaran diperbarui'); setEditPay(null) }
      else toast.error(res.error || 'Gagal')
    } finally { setPaying(false) }
  }
  const submitDelPay = async () => {
    if (!delPay || paying) return
    setPaying(true)
    try {
      const res = await deleteLiabilityPayment(delPay.id)
      if (res.ok) { toast.success('Pembayaran dihapus, sisa hutang dikembalikan'); setDelPay(null) }
      else toast.error(res.error || 'Gagal')
    } finally { setPaying(false) }
  }

  const onPayAmount = (e) => setPayForm(p => ({ ...p, amount: digits(e.target.value) }))

  return (
    <div className="flex-1 overflow-y-auto mesh-bg">
      <style>{`
        .exp-field { transition: border-color .15s ease, box-shadow .15s ease; outline: none; }
        .exp-field:focus { border-color: var(--accent) !important; box-shadow: 0 0 0 3px rgba(139,92,246,0.15); }
        .exp-ph::placeholder { color: var(--text-muted); opacity: 0.5; }
      `}</style>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <div className="text-sm flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
              <CreditCard size={14} /> Hutang Usaha
            </div>
            <h2 className="text-xl sm:text-2xl font-bold mt-0.5" style={{ fontFamily: 'Syne', color: 'var(--text-primary)' }}>
              {liabilities.length} catatan hutang
            </h2>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={openFifo}><Layers size={15} /> Bayar (FIFO)</Button>
            <Button variant="primary" onClick={openAdd}><Plus size={15} /> Tambah</Button>
          </div>
        </div>

        <div className="rounded-2xl p-4 mb-5" style={{ background: 'linear-gradient(135deg, rgba(255,77,106,0.08), rgba(234,88,12,0.04))', border: '1px solid rgba(255,77,106,0.25)' }}>
          <div className="flex items-center gap-2 mb-1">
            <CreditCard size={14} style={{ color: '#ff4d6a' }} />
            <p className="text-xs font-semibold" style={{ color: '#ff4d6a', fontFamily: 'Syne' }}>Total Sisa Hutang</p>
          </div>
          <p className="text-xl font-bold" style={{ color: '#ff4d6a', fontFamily: 'Syne' }}>{formatRupiah(totalActive)}</p>
        </div>

        <div className="flex gap-2 mb-5 flex-wrap">
          {[{ id: 'aktif', label: 'Aktif' }, { id: 'sebagian', label: 'Sebagian' }, { id: 'lunas', label: 'Lunas' }, { id: 'all', label: 'Semua' }].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background: filter === f.id ? 'linear-gradient(135deg, var(--accent), #6366f1)' : 'var(--bg-card)', color: filter === f.id ? '#fff' : 'var(--text-secondary)', border: `1px solid ${filter === f.id ? 'transparent' : 'var(--border)'}`, fontFamily: 'Syne' }}>
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={CreditCard} title="Belum ada hutang"
            description="Catat hutang usaha. Saat dibayar, otomatis tercatat di Pengeluaran dengan aturan laba/rugi sesuai jenis hutang."
            action={<Button variant="primary" size="sm" onClick={openAdd}><Plus size={13} /> Tambah</Button>} />
        ) : (
          <div className="space-y-2.5">
            {filtered.map((l) => {
              const sm = STATUS_META[l.status] || STATUS_META.aktif
              const tm = typeMeta(l.type)
              const pct = l.amount > 0 ? Math.min(100, Math.round(((l.paid || 0) / l.amount) * 100)) : 0
              const isOpen = expanded === l.id
              const pays = paymentsOf(l.id)
              return (
                <div key={l.id} className="rounded-2xl p-4 animate-fadeIn"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', opacity: l.status === 'lunas' ? 0.85 : 1 }}>
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                      <CreditCard size={18} style={{ color: sm.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)', fontFamily: 'Syne' }}>{l.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: sm.bg, color: sm.color, fontFamily: 'Syne' }}>{sm.label}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(139,92,246,0.12)', color: 'var(--accent-light)', fontFamily: 'Syne', border: '1px solid rgba(139,92,246,0.2)' }}>{tm.label}</span>
                      </div>
                      <div className="text-xs mt-1 flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-muted)' }}>
                        <span className="inline-flex items-center gap-1"><CalendarDays size={11} /> {formatDate(l.date)}</span>
                        {l.dueDate && <><span style={{ opacity: 0.5 }}>·</span><span>Jatuh tempo {formatDate(l.dueDate)}</span></>}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <Mini label="Total" value={formatRupiah(l.amount)} />
                    <Mini label="Dibayar" value={formatRupiah(l.paid || 0)} color="#10d98a" />
                    <Mini label="Sisa" value={formatRupiah(l.remaining || 0)} color={sm.color} />
                  </div>
                  <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #10d98a, #059669)' }} />
                  </div>

                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {l.remaining > 0 && (
                      <Button variant="primary" size="sm" onClick={() => openPay(l)}><Wallet size={13} /> Bayar</Button>
                    )}
                    <Button variant="secondary" size="sm" onClick={() => setExpanded(isOpen ? null : l.id)}>
                      <History size={13} /> Riwayat ({pays.length}) {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </Button>
                    <div className="flex-1" />
                    <button onClick={() => openEdit(l)} className="w-9 h-9 rounded-xl flex items-center justify-center btn-press"
                      style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}><Edit2 size={14} /></button>
                    <button onClick={() => setDelTarget(l)} className="w-9 h-9 rounded-xl flex items-center justify-center btn-press"
                      style={{ background: 'rgba(255,77,106,0.08)', color: 'var(--red)', border: '1px solid rgba(255,77,106,0.15)' }}><Trash2 size={14} /></button>
                  </div>

                  {isOpen && (
                    <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: '1px dashed var(--border)' }}>
                      {pays.length === 0 && <div className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>Belum ada pembayaran.</div>}
                      {pays.map(p => (
                        <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                          <div className="min-w-0">
                            <div className="text-xs font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Syne' }}>{formatRupiah(p.amount)}</div>
                            <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                              {[formatDate(p.paymentDate), payLabel(p.paymentMethod), `oleh ${adminName(p.createdBy)}`, p.notes].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button onClick={() => openEditPay(p)} className="w-8 h-8 rounded-lg flex items-center justify-center btn-press"
                              style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}><Edit2 size={12} /></button>
                            <button onClick={() => setDelPay(p)} className="w-8 h-8 rounded-lg flex items-center justify-center btn-press"
                              style={{ background: 'rgba(255,77,106,0.08)', color: 'var(--red)', border: '1px solid rgba(255,77,106,0.15)' }}><Trash2 size={12} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Tambah/Edit hutang */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Hutang' : 'Tambah Hutang'} subtitle="Catat hutang usaha" size="lg">
        <div className="space-y-5">
          <div>
            <label className={LBL} style={LBL_STYLE}>Nama Kreditur</label>
            <input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="cth: CV Benang Jaya / Bank BCA" className={`${FIELD} exp-ph`} style={FIELD_STYLE} />
          </div>
          <div>
            <label className={LBL} style={LBL_STYLE}>Jenis Hutang</label>
            <select value={form.type} onChange={(e) => setForm(p => ({ ...p, type: e.target.value }))} className={FIELD} style={FIELD_STYLE}>
              {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <p className="text-[11px] mt-1.5" style={{ color: typeMeta(form.type).profit ? '#f59e0b' : 'var(--text-muted)' }}>{typeMeta(form.type).hint}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LBL} style={LBL_STYLE}>Nominal Hutang</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Rp</span>
                <input inputMode="numeric" value={fmtInput(form.amount)} onChange={(e) => setForm(p => ({ ...p, amount: digits(e.target.value) }))} placeholder="0" className={`${FIELD} exp-ph`} style={{ ...FIELD_STYLE, paddingLeft: 40 }} />
              </div>
            </div>
            <div>
              <label className={LBL} style={LBL_STYLE}>Tanggal</label>
              <input type="date" value={form.date} onChange={(e) => setForm(p => ({ ...p, date: e.target.value }))} className={FIELD} style={{ ...FIELD_STYLE, colorScheme: 'dark' }} />
            </div>
          </div>
          <div>
            <label className={LBL} style={LBL_STYLE}>Jatuh Tempo <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opsional)</span></label>
            <input type="date" value={form.dueDate} onChange={(e) => setForm(p => ({ ...p, dueDate: e.target.value }))} className={FIELD} style={{ ...FIELD_STYLE, colorScheme: 'dark' }} />
          </div>
          <div>
            <label className={LBL} style={LBL_STYLE}>Keterangan <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opsional)</span></label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Catatan tambahan…" className={`${FIELD} exp-ph resize-none`} style={FIELD_STYLE} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Batal</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving || busy}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}{saving ? 'Menyimpan...' : editId ? 'Simpan' : 'Tambah'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bayar (per item / FIFO) */}
      <Modal open={!!payTarget || fifoOpen} onClose={() => { setPayTarget(null); setFifoOpen(false) }}
        title={payTarget ? `Bayar — ${payTarget.name}` : 'Bayar Hutang (FIFO)'}
        subtitle={payTarget ? `Sisa ${formatRupiah(payTarget.remaining || 0)}` : 'Hutang paling lama dibayar lebih dulu'} size="md">
        <div className="space-y-5">
          {!payTarget && (
            <div className="rounded-xl p-3 text-[11px]" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', color: 'var(--text-secondary)' }}>
              FIFO: nominal akan dialokasikan otomatis ke hutang tertua dulu, lalu ke berikutnya.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LBL} style={LBL_STYLE}>Tanggal Pembayaran</label>
              <input type="date" value={payForm.date} onChange={(e) => setPayForm(p => ({ ...p, date: e.target.value }))} className={FIELD} style={{ ...FIELD_STYLE, colorScheme: 'dark' }} />
            </div>
            <div>
              <label className={LBL} style={LBL_STYLE}>Nominal Pembayaran</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Rp</span>
                <input inputMode="numeric" value={fmtInput(payForm.amount)} onChange={onPayAmount} placeholder="0" className={`${FIELD} exp-ph`} style={{ ...FIELD_STYLE, paddingLeft: 40 }} />
              </div>
            </div>
          </div>
          <div>
            <label className={LBL} style={LBL_STYLE}>Metode Pembayaran</label>
            <select value={payForm.method} onChange={(e) => setPayForm(p => ({ ...p, method: e.target.value }))} className={FIELD} style={FIELD_STYLE}>
              {PAYMENTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={LBL} style={LBL_STYLE}>Catatan <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opsional)</span></label>
            <textarea rows={2} value={payForm.notes} onChange={(e) => setPayForm(p => ({ ...p, notes: e.target.value }))} placeholder="cth: no. bukti transfer…" className={`${FIELD} exp-ph resize-none`} style={FIELD_STYLE} />
          </div>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Pembayaran otomatis tercatat di modul Pengeluaran (kategori "Pembayaran Hutang").</p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => { setPayTarget(null); setFifoOpen(false) }} disabled={paying}>Batal</Button>
            <Button variant="primary" onClick={submitPay} disabled={paying || busy}>
              {paying ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}{paying ? 'Memproses...' : 'Bayar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit pembayaran */}
      <Modal open={!!editPay} onClose={() => setEditPay(null)} title="Edit Pembayaran" size="md">
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LBL} style={LBL_STYLE}>Tanggal</label>
              <input type="date" value={payForm.date} onChange={(e) => setPayForm(p => ({ ...p, date: e.target.value }))} className={FIELD} style={{ ...FIELD_STYLE, colorScheme: 'dark' }} />
            </div>
            <div>
              <label className={LBL} style={LBL_STYLE}>Nominal</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Rp</span>
                <input inputMode="numeric" value={fmtInput(payForm.amount)} onChange={onPayAmount} placeholder="0" className={`${FIELD} exp-ph`} style={{ ...FIELD_STYLE, paddingLeft: 40 }} />
              </div>
            </div>
          </div>
          <div>
            <label className={LBL} style={LBL_STYLE}>Metode Pembayaran</label>
            <select value={payForm.method} onChange={(e) => setPayForm(p => ({ ...p, method: e.target.value }))} className={FIELD} style={FIELD_STYLE}>
              {PAYMENTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={LBL} style={LBL_STYLE}>Catatan</label>
            <textarea rows={2} value={payForm.notes} onChange={(e) => setPayForm(p => ({ ...p, notes: e.target.value }))} className={`${FIELD} exp-ph resize-none`} style={FIELD_STYLE} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setEditPay(null)} disabled={paying}>Batal</Button>
            <Button variant="primary" onClick={submitEditPay} disabled={paying}>
              {paying ? <Loader2 size={14} className="animate-spin" /> : <Edit2 size={14} />} Simpan
            </Button>
          </div>
        </div>
      </Modal>

      {/* Konfirmasi hapus hutang */}
      <Modal open={!!delTarget} onClose={() => setDelTarget(null)} title="Hapus Hutang" size="sm">
        <ConfirmBody text={<>Yakin ingin menghapus hutang <strong style={{ color: 'var(--text-primary)' }}>{delTarget?.name}</strong>? Seluruh riwayat pembayarannya juga ikut terhapus.</>}
          onCancel={() => setDelTarget(null)} onConfirm={handleDelete} loading={deleting} />
      </Modal>

      {/* Konfirmasi hapus pembayaran */}
      <Modal open={!!delPay} onClose={() => setDelPay(null)} title="Hapus Pembayaran" size="sm">
        <ConfirmBody text={<>Yakin ingin menghapus pembayaran <strong style={{ color: 'var(--text-primary)' }}>{formatRupiah(delPay?.amount || 0)}</strong>? Sisa hutang akan bertambah kembali dan catatan pengeluaran terkait ikut dihapus.</>}
          onCancel={() => setDelPay(null)} onConfirm={submitDelPay} loading={paying} />
      </Modal>
    </div>
  )
}

function Mini({ label, value, color = 'var(--text-primary)' }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-xs font-bold truncate" style={{ color, fontFamily: 'Syne' }}>{value}</div>
    </div>
  )
}

function ConfirmBody({ text, onCancel, onConfirm, loading }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.2)' }}>
          <AlertTriangle size={16} style={{ color: 'var(--red)' }} />
        </div>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{text}</p>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>Batal</Button>
        <Button variant="danger" onClick={onConfirm} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Ya, Hapus
        </Button>
      </div>
    </div>
  )
}
