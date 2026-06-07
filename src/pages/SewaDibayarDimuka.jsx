import React, { useMemo, useState } from 'react'
import {
  Plus, Edit2, Trash2, Building2, CalendarDays, AlertTriangle, Loader2, MapPin, Wallet,
} from 'lucide-react'
import { Button, EmptyState } from '../components/ui'
import Modal from '../components/Modal'
import { formatRupiah, formatDate, rentCalc } from '../utils/helpers'
import { useToast } from '../components/Toast'

const LBL = 'block text-xs font-semibold mb-2'
const LBL_STYLE = { color: 'var(--text-secondary)', fontFamily: 'Syne', letterSpacing: '0.02em' }
const FIELD = 'w-full px-4 py-3 rounded-xl text-sm exp-field'
const FIELD_STYLE = { background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }

const todayISO = () => new Date().toISOString().slice(0, 10)
const EMPTY = () => ({ name: '', location: '', startDate: todayISO(), endDate: '', months: '12', totalAmount: '', notes: '' })

// Tambah N bulan ke tanggal ISO, kurangi 1 hari → tanggal berakhir.
function calcEndDate(startISO, months) {
  if (!startISO || !(Number(months) > 0)) return ''
  const s = new Date(startISO + 'T00:00:00')
  const e = new Date(s.getFullYear(), s.getMonth() + Number(months), s.getDate())
  e.setDate(e.getDate() - 1)
  return e.toISOString().slice(0, 10)
}

export default function SewaDibayarDimuka({
  prepaidRent = [], addPrepaidRent, updatePrepaidRent, deletePrepaidRent, busy,
}) {
  const toast = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY())
  const [saving, setSaving] = useState(false)
  const [delTarget, setDelTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const totals = useMemo(() => {
    let total = 0, remaining = 0, monthly = 0
    prepaidRent.forEach(r => {
      const c = rentCalc(r)
      total += c.total; remaining += c.remaining
      if (c.remaining > 0) monthly += c.monthly   // beban bulanan untuk sewa yang masih berjalan
    })
    return { total, remaining, monthly }
  }, [prepaidRent])

  const monthsNum = Number(String(form.months).replace(/[^\d]/g, '')) || 0
  const totalNum = Number(String(form.totalAmount).replace(/[^\d]/g, '')) || 0
  const monthlyPreview = monthsNum > 0 ? Math.round(totalNum / monthsNum) : 0

  const openAdd = () => { setEditId(null); setForm(EMPTY()); setModalOpen(true) }
  const openEdit = (r) => {
    setEditId(r.id)
    setForm({
      name: r.name || '', location: r.location || '',
      startDate: r.startDate || todayISO(), endDate: r.endDate || '',
      months: String(r.months || ''), totalAmount: String(r.totalAmount || ''), notes: r.notes || '',
    })
    setModalOpen(true)
  }

  const setMonths = (val) => {
    const m = val.replace(/[^\d]/g, '')
    setForm(p => ({ ...p, months: m, endDate: calcEndDate(p.startDate, m) }))
  }
  const setStart = (val) => setForm(p => ({ ...p, startDate: val, endDate: calcEndDate(val, p.months) }))
  const onTotal = (e) => setForm(p => ({ ...p, totalAmount: e.target.value.replace(/[^\d]/g, '') }))
  const totalDisplay = form.totalAmount ? Number(form.totalAmount).toLocaleString('id-ID') : ''

  const handleSave = async () => {
    if (saving) return
    if (!form.name.trim()) return toast.error('Nama sewa wajib diisi')
    if (!(monthsNum > 0)) return toast.error('Lama sewa (bulan) harus > 0')
    if (!(totalNum > 0)) return toast.error('Total pembayaran harus > 0')
    setSaving(true)
    try {
      const data = {
        name: form.name.trim(), location: form.location.trim(),
        startDate: form.startDate, endDate: form.endDate || calcEndDate(form.startDate, monthsNum),
        months: monthsNum, totalAmount: totalNum, notes: form.notes.trim(),
      }
      const res = editId ? await updatePrepaidRent(editId, data) : await addPrepaidRent(data)
      if (res.ok) { toast.success(editId ? 'Sewa diperbarui' : 'Sewa ditambahkan'); setModalOpen(false) }
      else toast.error(res.error || 'Gagal menyimpan')
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!delTarget || deleting) return
    setDeleting(true)
    try {
      const res = await deletePrepaidRent(delTarget.id)
      if (res.ok) { toast.success('Sewa dihapus'); setDelTarget(null) }
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
              <Building2 size={14} /> Sewa Dibayar Dimuka
            </div>
            <h2 className="text-xl sm:text-2xl font-bold mt-0.5" style={{ fontFamily: 'Syne', color: 'var(--text-primary)' }}>
              {prepaidRent.length} kontrak sewa
            </h2>
          </div>
          <Button variant="primary" onClick={openAdd}><Plus size={15} /> Tambah Sewa</Button>
        </div>

        {/* Ringkasan */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <SummaryCard label="Total Sewa Dibayar" value={formatRupiah(totals.total)} color="var(--accent-light)" />
          <SummaryCard label="Sisa Nilai Sewa" value={formatRupiah(totals.remaining)} color="#10d98a" />
          <SummaryCard label="Beban / Bulan" value={formatRupiah(totals.monthly)} color="#f59e0b" />
        </div>

        {prepaidRent.length === 0 ? (
          <EmptyState icon={Building2} title="Belum ada sewa"
            description="Catat sewa toko yang dibayar dimuka. Sistem otomatis menghitung beban per bulan."
            action={<Button variant="primary" size="sm" onClick={openAdd}><Plus size={13} /> Tambah</Button>} />
        ) : (
          <div className="space-y-2.5">
            {prepaidRent.map((r, idx) => {
              const c = rentCalc(r)
              const pct = c.total > 0 ? Math.min(100, Math.round((c.amortized / c.total) * 100)) : 0
              return (
                <div key={r.id} className="rounded-2xl p-4 animate-fadeIn"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', animationDelay: `${idx * 20}ms` }}>
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                      <Building2 size={18} style={{ color: 'var(--accent-light)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)', fontFamily: 'Syne' }}>{r.name}</div>
                      <div className="text-xs mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-muted)' }}>
                        {r.location && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {r.location}</span>}
                        <span className="inline-flex items-center gap-1"><CalendarDays size={11} /> {formatDate(r.startDate)} – {r.endDate ? formatDate(r.endDate) : '…'}</span>
                        <span>· {c.months} bln</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => openEdit(r)} className="w-9 h-9 rounded-xl flex items-center justify-center btn-press"
                        style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}><Edit2 size={14} /></button>
                      <button onClick={() => setDelTarget(r)} className="w-9 h-9 rounded-xl flex items-center justify-center btn-press"
                        style={{ background: 'rgba(255,77,106,0.08)', color: 'var(--red)', border: '1px solid rgba(255,77,106,0.15)' }}><Trash2 size={14} /></button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <MiniStat label="Total Bayar" value={formatRupiah(c.total)} />
                    <MiniStat label="Per Bulan" value={formatRupiah(c.monthly)} color="#f59e0b" />
                    <MiniStat label="Sisa Nilai" value={formatRupiah(c.remaining)} color="#10d98a" />
                  </div>
                  {/* progress amortisasi */}
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>
                      <span>Terpakai {c.elapsed}/{c.months} bln</span><span>{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), #6366f1)' }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Form */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editId ? 'Edit Sewa' : 'Tambah Sewa Dibayar Dimuka'} subtitle="Sistem menghitung beban per bulan otomatis" size="lg">
        <div className="space-y-5">
          <div>
            <label className={LBL} style={LBL_STYLE}>Nama Sewa</label>
            <input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="cth: Sewa Toko Tanah Abang" className={`${FIELD} exp-ph`} style={FIELD_STYLE} />
          </div>
          <div>
            <label className={LBL} style={LBL_STYLE}>Lokasi</label>
            <input value={form.location} onChange={(e) => setForm(p => ({ ...p, location: e.target.value }))}
              placeholder="cth: Pasar Tanah Abang Blok B" className={`${FIELD} exp-ph`} style={FIELD_STYLE} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LBL} style={LBL_STYLE}>Tanggal Mulai</label>
              <input type="date" value={form.startDate} onChange={(e) => setStart(e.target.value)}
                className={FIELD} style={{ ...FIELD_STYLE, colorScheme: 'dark' }} />
            </div>
            <div>
              <label className={LBL} style={LBL_STYLE}>Tanggal Berakhir <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(otomatis)</span></label>
              <input type="date" value={form.endDate} onChange={(e) => setForm(p => ({ ...p, endDate: e.target.value }))}
                className={FIELD} style={{ ...FIELD_STYLE, colorScheme: 'dark' }} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LBL} style={LBL_STYLE}>Lama Sewa (bulan)</label>
              <input inputMode="numeric" value={form.months} onChange={(e) => setMonths(e.target.value)}
                placeholder="12" className={`${FIELD} exp-ph`} style={FIELD_STYLE} />
            </div>
            <div>
              <label className={LBL} style={LBL_STYLE}>Total Pembayaran</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Rp</span>
                <input inputMode="numeric" value={totalDisplay} onChange={onTotal}
                  placeholder="0" className={`${FIELD} exp-ph`} style={{ ...FIELD_STYLE, paddingLeft: 40 }} />
              </div>
            </div>
          </div>

          {/* Preview biaya bulanan */}
          <div className="rounded-xl p-4 flex items-center justify-between"
            style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)' }}>
            <div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Biaya Sewa Bulanan (otomatis)</div>
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {formatRupiah(totalNum)} ÷ {monthsNum || 0} bulan
              </div>
            </div>
            <div className="text-lg font-bold" style={{ color: 'var(--accent-light)', fontFamily: 'Syne' }}>
              {formatRupiah(monthlyPreview)}<span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>/bln</span>
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

      {/* Hapus */}
      <Modal open={!!delTarget} onClose={() => setDelTarget(null)} title="Hapus Sewa" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.2)' }}>
              <AlertTriangle size={16} style={{ color: 'var(--red)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Hapus sewa <strong style={{ color: 'var(--text-primary)' }}>{delTarget?.name}</strong>? Tindakan ini tidak bisa dibatalkan.
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

function SummaryCard({ label, value, color }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-1">
        <Wallet size={13} style={{ color }} />
        <p className="text-xs font-semibold" style={{ color, fontFamily: 'Syne' }}>{label}</p>
      </div>
      <p className="text-base sm:text-lg font-bold truncate" style={{ color: 'var(--text-primary)', fontFamily: 'Syne' }}>{value}</p>
    </div>
  )
}

function MiniStat({ label, value, color = 'var(--text-primary)' }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-xs font-bold truncate" style={{ color, fontFamily: 'Syne' }}>{value}</div>
    </div>
  )
}
