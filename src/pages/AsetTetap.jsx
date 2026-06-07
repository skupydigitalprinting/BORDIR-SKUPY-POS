import React, { useMemo, useState } from 'react'
import {
  Plus, Edit2, Trash2, Factory, CalendarDays, AlertTriangle, Loader2,
} from 'lucide-react'
import { Button, EmptyState } from '../components/ui'
import Modal from '../components/Modal'
import { formatRupiah, formatDate } from '../utils/helpers'
import { useToast } from '../components/Toast'

const LBL = 'block text-xs font-semibold mb-2'
const LBL_STYLE = { color: 'var(--text-secondary)', fontFamily: 'Syne', letterSpacing: '0.02em' }
const FIELD = 'w-full px-4 py-3 rounded-xl text-sm exp-field'
const FIELD_STYLE = { background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }

const CATEGORY_SUGGEST = ['Mesin', 'Kendaraan', 'Perabot', 'Elektronik', 'Peralatan', 'Bangunan', 'Lainnya']
const todayISO = () => new Date().toISOString().slice(0, 10)
const EMPTY = () => ({ name: '', category: 'Mesin', amount: '', purchaseDate: todayISO(), notes: '' })

export default function AsetTetap({
  fixedAssets = [], addFixedAsset, updateFixedAsset, deleteFixedAsset, busy,
}) {
  const toast = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY())
  const [saving, setSaving] = useState(false)
  const [delTarget, setDelTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const total = useMemo(() => fixedAssets.reduce((s, a) => s + (+a.amount || 0), 0), [fixedAssets])

  const openAdd = () => { setEditId(null); setForm(EMPTY()); setModalOpen(true) }
  const openEdit = (a) => {
    setEditId(a.id)
    setForm({ name: a.name || '', category: a.category || 'Mesin', amount: String(a.amount || ''), purchaseDate: a.purchaseDate || todayISO(), notes: a.notes || '' })
    setModalOpen(true)
  }
  const onAmount = (e) => setForm(p => ({ ...p, amount: e.target.value.replace(/[^\d]/g, '') }))
  const amountDisplay = form.amount ? Number(form.amount).toLocaleString('id-ID') : ''

  const handleSave = async () => {
    if (saving) return
    if (!form.name.trim()) return toast.error('Nama aset wajib diisi')
    const amount = Number(String(form.amount).replace(/[^\d]/g, ''))
    if (!amount || amount <= 0) return toast.error('Nilai aset harus > 0')
    setSaving(true)
    try {
      const data = { name: form.name.trim(), category: form.category.trim(), amount, purchaseDate: form.purchaseDate, notes: form.notes.trim() }
      const res = editId ? await updateFixedAsset(editId, data) : await addFixedAsset(data)
      if (res.ok) { toast.success(editId ? 'Aset diperbarui' : 'Aset ditambahkan'); setModalOpen(false) }
      else toast.error(res.error || 'Gagal menyimpan')
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!delTarget || deleting) return
    setDeleting(true)
    try {
      const res = await deleteFixedAsset(delTarget.id)
      if (res.ok) { toast.success('Aset dihapus'); setDelTarget(null) }
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
              <Factory size={14} /> Aset Tetap
            </div>
            <h2 className="text-xl sm:text-2xl font-bold mt-0.5" style={{ fontFamily: 'Syne', color: 'var(--text-primary)' }}>
              {fixedAssets.length} aset
            </h2>
          </div>
          <Button variant="primary" onClick={openAdd}><Plus size={15} /> Tambah Aset</Button>
        </div>

        <div className="rounded-2xl p-4 mb-5" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(99,102,241,0.05))', border: '1px solid rgba(139,92,246,0.25)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Factory size={14} style={{ color: 'var(--accent-light)' }} />
            <p className="text-xs font-semibold" style={{ color: 'var(--accent-light)', fontFamily: 'Syne' }}>Total Nilai Aset Tetap</p>
          </div>
          <p className="text-xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Syne' }}>{formatRupiah(total)}</p>
        </div>

        {fixedAssets.length === 0 ? (
          <EmptyState icon={Factory} title="Belum ada aset tetap"
            description="Catat aset toko (mesin bordir, kendaraan, perabot, dll). Aset tidak mengurangi laba secara langsung."
            action={<Button variant="primary" size="sm" onClick={openAdd}><Plus size={13} /> Tambah</Button>} />
        ) : (
          <div className="space-y-2.5">
            {fixedAssets.map((a, idx) => (
              <div key={a.id} className="rounded-2xl p-4 animate-fadeIn flex flex-col sm:flex-row sm:items-center gap-3"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', animationDelay: `${idx * 20}ms` }}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <Factory size={18} style={{ color: 'var(--accent-light)' }} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)', fontFamily: 'Syne' }}>{a.name}</span>
                      {a.category && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: 'rgba(139,92,246,0.12)', color: 'var(--accent-light)', fontFamily: 'Syne', border: '1px solid rgba(139,92,246,0.2)' }}>{a.category}</span>}
                    </div>
                    <div className="text-xs mt-1 flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-muted)' }}>
                      <span className="inline-flex items-center gap-1"><CalendarDays size={11} /> {formatDate(a.purchaseDate)}</span>
                      {a.notes && (<><span style={{ opacity: 0.5 }}>·</span><span className="truncate max-w-[160px]">{a.notes}</span></>)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 pl-14 sm:pl-0 border-t sm:border-t-0 pt-2.5 sm:pt-0" style={{ borderColor: 'var(--border)' }}>
                  <div className="text-base font-bold whitespace-nowrap" style={{ color: 'var(--accent-light)', fontFamily: 'Syne' }}>{formatRupiah(a.amount)}</div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => openEdit(a)} className="w-9 h-9 rounded-xl flex items-center justify-center btn-press"
                      style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}><Edit2 size={14} /></button>
                    <button onClick={() => setDelTarget(a)} className="w-9 h-9 rounded-xl flex items-center justify-center btn-press"
                      style={{ background: 'rgba(255,77,106,0.08)', color: 'var(--red)', border: '1px solid rgba(255,77,106,0.15)' }}><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editId ? 'Edit Aset' : 'Tambah Aset Tetap'} subtitle="Aset modal — tidak langsung jadi beban" size="lg">
        <div className="space-y-5">
          <div>
            <label className={LBL} style={LBL_STYLE}>Nama Aset</label>
            <input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="cth: Mesin Bordir Tajima" className={`${FIELD} exp-ph`} style={FIELD_STYLE} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LBL} style={LBL_STYLE}>Kategori</label>
              <select value={form.category} onChange={(e) => setForm(p => ({ ...p, category: e.target.value }))} className={FIELD} style={FIELD_STYLE}>
                {CATEGORY_SUGGEST.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={LBL} style={LBL_STYLE}>Tanggal Perolehan</label>
              <input type="date" value={form.purchaseDate} onChange={(e) => setForm(p => ({ ...p, purchaseDate: e.target.value }))}
                className={FIELD} style={{ ...FIELD_STYLE, colorScheme: 'dark' }} />
            </div>
          </div>
          <div>
            <label className={LBL} style={LBL_STYLE}>Nilai Aset</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Rp</span>
              <input inputMode="numeric" value={amountDisplay} onChange={onAmount}
                placeholder="0" className={`${FIELD} exp-ph`} style={{ ...FIELD_STYLE, paddingLeft: 40 }} />
            </div>
          </div>
          <div>
            <label className={LBL} style={LBL_STYLE}>Keterangan <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opsional)</span></label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Catatan tambahan…" className={`${FIELD} exp-ph resize-none`} style={FIELD_STYLE} />
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

      <Modal open={!!delTarget} onClose={() => setDelTarget(null)} title="Hapus Aset" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.2)' }}>
              <AlertTriangle size={16} style={{ color: 'var(--red)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Hapus aset <strong style={{ color: 'var(--text-primary)' }}>{delTarget?.name}</strong>?
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDelTarget(null)} disabled={deleting}>Batal</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Hapus
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
