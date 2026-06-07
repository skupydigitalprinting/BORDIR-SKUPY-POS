import React, { useMemo, useState } from 'react'
import {
  Plus, Edit2, Trash2, CreditCard, CalendarDays, AlertTriangle, Loader2, CheckCircle2,
} from 'lucide-react'
import { Button, EmptyState } from '../components/ui'
import Modal from '../components/Modal'
import { formatRupiah, formatDate } from '../utils/helpers'
import { useToast } from '../components/Toast'

const LBL = 'block text-xs font-semibold mb-2'
const LBL_STYLE = { color: 'var(--text-secondary)', fontFamily: 'Syne', letterSpacing: '0.02em' }
const FIELD = 'w-full px-4 py-3 rounded-xl text-sm exp-field'
const FIELD_STYLE = { background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }

const TYPES = [
  { id: 'supplier', label: 'Hutang Supplier' },
  { id: 'bank', label: 'Hutang Bank' },
  { id: 'lain', label: 'Hutang Lain' },
]
const typeLabel = (id) => TYPES.find(t => t.id === id)?.label || 'Hutang Lain'
const todayISO = () => new Date().toISOString().slice(0, 10)
const EMPTY = () => ({ name: '', type: 'supplier', amount: '', date: todayISO(), dueDate: '', status: 'aktif', notes: '' })

export default function Hutang({
  liabilities = [], addLiability, updateLiability, deleteLiability, busy,
}) {
  const toast = useToast()
  const [filter, setFilter] = useState('aktif')
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY())
  const [saving, setSaving] = useState(false)
  const [delTarget, setDelTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const filtered = useMemo(() => liabilities.filter(l => filter === 'all' ? true : l.status === filter), [liabilities, filter])
  const totalActive = useMemo(() => liabilities.filter(l => l.status === 'aktif').reduce((s, l) => s + (+l.amount || 0), 0), [liabilities])

  const openAdd = () => { setEditId(null); setForm(EMPTY()); setModalOpen(true) }
  const openEdit = (l) => {
    setEditId(l.id)
    setForm({ name: l.name || '', type: l.type || 'supplier', amount: String(l.amount || ''), date: l.date || todayISO(), dueDate: l.dueDate || '', status: l.status || 'aktif', notes: l.notes || '' })
    setModalOpen(true)
  }
  const onAmount = (e) => setForm(p => ({ ...p, amount: e.target.value.replace(/[^\d]/g, '') }))
  const amountDisplay = form.amount ? Number(form.amount).toLocaleString('id-ID') : ''

  const handleSave = async () => {
    if (saving) return
    if (!form.name.trim()) return toast.error('Nama kreditur wajib diisi')
    const amount = Number(String(form.amount).replace(/[^\d]/g, ''))
    if (!amount || amount <= 0) return toast.error('Nominal harus > 0')
    setSaving(true)
    try {
      const data = { ...form, amount }
      const res = editId ? await updateLiability(editId, data) : await addLiability(data)
      if (res.ok) { toast.success(editId ? 'Hutang diperbarui' : 'Hutang ditambahkan'); setModalOpen(false) }
      else toast.error(res.error || 'Gagal menyimpan')
    } finally { setSaving(false) }
  }

  const toggleLunas = async (l) => {
    setBusyId(l.id)
    try {
      const res = await updateLiability(l.id, { ...l, status: l.status === 'lunas' ? 'aktif' : 'lunas' })
      if (res.ok) toast.success(l.status === 'lunas' ? 'Ditandai aktif' : 'Ditandai lunas')
      else toast.error(res.error || 'Gagal')
    } finally { setBusyId(null) }
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
          <Button variant="primary" onClick={openAdd}><Plus size={15} /> Tambah Hutang</Button>
        </div>

        <div className="rounded-2xl p-4 mb-5" style={{ background: 'linear-gradient(135deg, rgba(255,77,106,0.08), rgba(234,88,12,0.04))', border: '1px solid rgba(255,77,106,0.25)' }}>
          <div className="flex items-center gap-2 mb-1">
            <CreditCard size={14} style={{ color: '#ff4d6a' }} />
            <p className="text-xs font-semibold" style={{ color: '#ff4d6a', fontFamily: 'Syne' }}>Total Hutang Aktif</p>
          </div>
          <p className="text-xl font-bold" style={{ color: '#ff4d6a', fontFamily: 'Syne' }}>{formatRupiah(totalActive)}</p>
        </div>

        <div className="flex gap-2 mb-5">
          {[{ id: 'aktif', label: 'Aktif' }, { id: 'lunas', label: 'Lunas' }, { id: 'all', label: 'Semua' }].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background: filter === f.id ? 'linear-gradient(135deg, var(--accent), #6366f1)' : 'var(--bg-card)', color: filter === f.id ? '#fff' : 'var(--text-secondary)', border: `1px solid ${filter === f.id ? 'transparent' : 'var(--border)'}`, fontFamily: 'Syne' }}>
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={CreditCard} title="Belum ada hutang"
            description="Catat hutang supplier, bank, atau lainnya untuk perhitungan Aset Bersih yang akurat."
            action={<Button variant="primary" size="sm" onClick={openAdd}><Plus size={13} /> Tambah</Button>} />
        ) : (
          <div className="space-y-2.5">
            {filtered.map((l, idx) => (
              <div key={l.id} className="rounded-2xl p-4 animate-fadeIn flex flex-col sm:flex-row sm:items-center gap-3"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', animationDelay: `${idx * 20}ms`, opacity: l.status === 'lunas' ? 0.7 : 1 }}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <CreditCard size={18} style={{ color: l.status === 'lunas' ? '#10d98a' : '#ff4d6a' }} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)', fontFamily: 'Syne' }}>{l.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: 'rgba(139,92,246,0.12)', color: 'var(--accent-light)', fontFamily: 'Syne', border: '1px solid rgba(139,92,246,0.2)' }}>{typeLabel(l.type)}</span>
                      {l.status === 'lunas' && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(16,217,138,0.12)', color: '#10d98a', fontFamily: 'Syne' }}>LUNAS</span>}
                    </div>
                    <div className="text-xs mt-1 flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-muted)' }}>
                      <span className="inline-flex items-center gap-1"><CalendarDays size={11} /> {formatDate(l.date)}</span>
                      {l.dueDate && <><span style={{ opacity: 0.5 }}>·</span><span>Jatuh tempo {formatDate(l.dueDate)}</span></>}
                      {l.notes && (<><span style={{ opacity: 0.5 }}>·</span><span className="truncate max-w-[140px]">{l.notes}</span></>)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 pl-14 sm:pl-0 border-t sm:border-t-0 pt-2.5 sm:pt-0" style={{ borderColor: 'var(--border)' }}>
                  <div className="text-base font-bold whitespace-nowrap" style={{ color: l.status === 'lunas' ? '#10d98a' : '#ff4d6a', fontFamily: 'Syne' }}>{formatRupiah(l.amount)}</div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => toggleLunas(l)} disabled={busyId === l.id} title={l.status === 'lunas' ? 'Tandai aktif' : 'Tandai lunas'}
                      className="w-9 h-9 rounded-xl flex items-center justify-center btn-press"
                      style={{ background: 'rgba(16,217,138,0.1)', color: '#10d98a', border: '1px solid rgba(16,217,138,0.2)' }}>
                      {busyId === l.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    </button>
                    <button onClick={() => openEdit(l)} className="w-9 h-9 rounded-xl flex items-center justify-center btn-press"
                      style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}><Edit2 size={14} /></button>
                    <button onClick={() => setDelTarget(l)} className="w-9 h-9 rounded-xl flex items-center justify-center btn-press"
                      style={{ background: 'rgba(255,77,106,0.08)', color: 'var(--red)', border: '1px solid rgba(255,77,106,0.15)' }}><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Hutang' : 'Tambah Hutang'} subtitle="Catat hutang usaha" size="lg">
        <div className="space-y-5">
          <div>
            <label className={LBL} style={LBL_STYLE}>Nama Kreditur</label>
            <input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="cth: CV Benang Jaya / Bank BCA" className={`${FIELD} exp-ph`} style={FIELD_STYLE} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LBL} style={LBL_STYLE}>Jenis Hutang</label>
              <select value={form.type} onChange={(e) => setForm(p => ({ ...p, type: e.target.value }))} className={FIELD} style={FIELD_STYLE}>
                {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={LBL} style={LBL_STYLE}>Nominal</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Rp</span>
                <input inputMode="numeric" value={amountDisplay} onChange={onAmount} placeholder="0" className={`${FIELD} exp-ph`} style={{ ...FIELD_STYLE, paddingLeft: 40 }} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LBL} style={LBL_STYLE}>Tanggal</label>
              <input type="date" value={form.date} onChange={(e) => setForm(p => ({ ...p, date: e.target.value }))} className={FIELD} style={{ ...FIELD_STYLE, colorScheme: 'dark' }} />
            </div>
            <div>
              <label className={LBL} style={LBL_STYLE}>Jatuh Tempo <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opsional)</span></label>
              <input type="date" value={form.dueDate} onChange={(e) => setForm(p => ({ ...p, dueDate: e.target.value }))} className={FIELD} style={{ ...FIELD_STYLE, colorScheme: 'dark' }} />
            </div>
          </div>
          <div>
            <label className={LBL} style={LBL_STYLE}>Keterangan <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opsional)</span></label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Catatan tambahan…" className={`${FIELD} exp-ph resize-none`} style={FIELD_STYLE} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Batal</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving || busy}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {saving ? 'Menyimpan...' : editId ? 'Simpan' : 'Tambah'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!delTarget} onClose={() => setDelTarget(null)} title="Hapus Hutang" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.2)' }}>
              <AlertTriangle size={16} style={{ color: 'var(--red)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Yakin ingin menghapus hutang <strong style={{ color: 'var(--text-primary)' }}>{delTarget?.name}</strong>? Tindakan ini tidak bisa dibatalkan.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDelTarget(null)} disabled={deleting}>Batal</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Ya, Hapus
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
