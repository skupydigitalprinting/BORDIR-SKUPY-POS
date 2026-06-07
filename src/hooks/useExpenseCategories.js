// ─────────────────────────────────────────────────────────────
// useExpenseCategories — kategori PENGELUARAN yang bisa diedit user (CRUD).
//
// Disimpan di localStorage (key: bordir_expense_categories_v1) supaya tetap
// ada setelah refresh, tanpa perlu tabel database tambahan.
//
// Memakai useSyncExternalStore agar semua komponen ikut ter-update otomatis
// saat kategori berubah.
// ─────────────────────────────────────────────────────────────
import { useSyncExternalStore } from 'react'

const KEY = 'bordir_expense_categories_v1'

// Kategori bawaan pengeluaran.
const DEFAULTS = [
  { id: 'bahan',       label: 'Bahan',       icon: '🧵' },
  { id: 'gaji',        label: 'Gaji',        icon: '💰' },
  { id: 'operasional', label: 'Operasional', icon: '🛠️' },
  { id: 'listrik',     label: 'Listrik',     icon: '💡' },
  { id: 'sewa',        label: 'Sewa',        icon: '🏠' },
  { id: 'transport',   label: 'Transport',   icon: '🚚' },
  { id: 'lain-lain',   label: 'Lain-lain',   icon: '📦' },
]

function seed() {
  return DEFAULTS.map((c) => ({ id: c.id, label: c.label, icon: c.icon }))
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return seed()
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length) {
      return parsed
        .filter((c) => c && c.id)
        .map((c) => ({ id: String(c.id), label: String(c.label || c.id), icon: c.icon || '📦' }))
    }
    return seed()
  } catch {
    return seed()
  }
}

let cats = load()
const listeners = new Set()

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(cats)) } catch { /* ignore */ }
}

function emit() {
  persist()
  listeners.forEach((l) => l())
}

function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot() { return cats }

function slugify(s) {
  return (
    String(s).toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'kategori'
  )
}

export function addExpenseCategory({ label, icon }) {
  const name = (label || '').trim()
  if (!name) return { ok: false, error: 'Nama kategori wajib diisi' }
  if (cats.some((c) => c.label.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: 'Kategori dengan nama itu sudah ada' }
  }
  let id = slugify(name)
  if (cats.some((c) => c.id === id)) {
    let n = 2
    while (cats.some((c) => c.id === `${id}-${n}`)) n++
    id = `${id}-${n}`
  }
  cats = [...cats, { id, label: name, icon: (icon || '').trim() || '📦' }]
  emit()
  return { ok: true, id }
}

export function updateExpenseCategory(id, { label, icon }) {
  const name = label != null ? String(label).trim() : null
  if (name === '') return { ok: false, error: 'Nama kategori tidak boleh kosong' }
  if (name && cats.some((c) => c.id !== id && c.label.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: 'Kategori dengan nama itu sudah ada' }
  }
  cats = cats.map((c) =>
    c.id === id
      ? { ...c, label: name || c.label, icon: icon != null ? (String(icon).trim() || c.icon) : c.icon }
      : c,
  )
  emit()
  return { ok: true }
}

export function deleteExpenseCategory(id) {
  if (cats.length <= 1) return { ok: false, error: 'Minimal harus ada 1 kategori' }
  cats = cats.filter((c) => c.id !== id)
  emit()
  return { ok: true }
}

export function getExpenseCategories() { return cats }
export function getExpenseCatLabel(id) {
  return cats.find((c) => c.id === id)?.label || id || '-'
}

export function useExpenseCategories() {
  const categories = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return {
    categories,
    addCategory: addExpenseCategory,
    updateCategory: updateExpenseCategory,
    deleteCategory: deleteExpenseCategory,
  }
}
