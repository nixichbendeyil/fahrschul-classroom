// frontend/src/modules/admin/AdminSchueler.tsx
import { useState, useEffect } from 'react'
import { AdminLayout } from './AdminLayout'
import { supabase } from '../../lib/supabase'

interface Schueler { id: string; full_name: string; phone_number: string; is_active: boolean }

const BACKEND = () => import.meta.env.VITE_BACKEND_URL || ''
async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session!.access_token}` }
}

export function AdminSchueler() {
  const [schueler, setSchueler] = useState<Schueler[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ full_name: '', phone_number: '' })
  const [error, setError] = useState('')

  async function load() {
    const headers = await authHeaders()
    const data = await fetch(`${BACKEND()}/api/admin/schueler`, { headers }).then(r => r.json())
    setSchueler(data)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditId(null)
    setForm({ full_name: '', phone_number: '' })
    setError('')
    setShowModal(true)
  }

  function openEdit(s: Schueler) {
    setEditId(s.id)
    setForm({ full_name: s.full_name, phone_number: s.phone_number })
    setError('')
    setShowModal(true)
  }

  async function handleSave() {
    setError('')
    if (!form.full_name || !form.phone_number) { setError('Alle Felder ausfüllen'); return }
    const headers = await authHeaders()
    const res = editId
      ? await fetch(`${BACKEND()}/api/admin/schueler/${editId}`, { method: 'PUT', headers, body: JSON.stringify(form) })
      : await fetch(`${BACKEND()}/api/admin/schueler`, { method: 'POST', headers, body: JSON.stringify(form) })
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Fehler'); return }
    setShowModal(false)
    load()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`${name} wirklich löschen?`)) return
    const headers = await authHeaders()
    await fetch(`${BACKEND()}/api/admin/schueler/${id}`, { method: 'DELETE', headers })
    load()
  }

  const inputStyle = { width: '100%', padding: '0.625rem', background: '#0f3460', border: '1px solid #1a4a7a', borderRadius: '6px', color: '#fff', fontSize: '0.875rem', boxSizing: 'border-box' as const }

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ color: '#e2e2e2', margin: 0, fontSize: '1.5rem' }}>Schüler</h1>
        <button onClick={openCreate} style={{ padding: '0.625rem 1.25rem', background: '#e94560', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>+ Neuer Schüler</button>
      </div>

      <div style={{ background: '#16213e', borderRadius: 12, overflow: 'hidden', border: '1px solid #1a4a7a' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1a4a7a' }}>
              {['Name', 'Handynummer', 'Status', 'Aktionen'].map(h => (
                <th key={h} style={{ padding: '0.875rem 1rem', color: '#a8a8b3', fontSize: '0.75rem', textAlign: 'left', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schueler.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid #0f3460' }}>
                <td style={{ padding: '0.875rem 1rem', color: '#e2e2e2', fontSize: '0.875rem' }}>{s.full_name}</td>
                <td style={{ padding: '0.875rem 1rem', color: '#a8a8b3', fontSize: '0.875rem' }}>{s.phone_number}</td>
                <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem' }}>
                  <span style={{ color: s.is_active ? '#4ade80' : '#555' }}>{s.is_active ? 'Aktiv' : 'Inaktiv'}</span>
                </td>
                <td style={{ padding: '0.875rem 1rem' }}>
                  <button onClick={() => openEdit(s)} style={{ marginRight: '0.5rem', padding: '0.375rem 0.75rem', background: '#0f3460', color: '#a8a8b3', border: '1px solid #1a4a7a', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}>Bearbeiten</button>
                  <button onClick={() => handleDelete(s.id, s.full_name)} style={{ padding: '0.375rem 0.75rem', background: 'transparent', color: '#e94560', border: '1px solid #e9456040', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}>Löschen</button>
                </td>
              </tr>
            ))}
            {schueler.length === 0 && (
              <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#555' }}>Noch keine Schüler angelegt</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#16213e', padding: '2rem', borderRadius: 12, width: '100%', maxWidth: 440, border: '1px solid #1a4a7a' }}>
            <h2 style={{ color: '#e2e2e2', margin: '0 0 1.5rem', fontSize: '1.25rem' }}>{editId ? 'Schüler bearbeiten' : 'Neuer Schüler'}</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#a8a8b3', fontSize: '0.75rem', display: 'block', marginBottom: '0.375rem' }}>NAME</label>
              <input style={inputStyle} value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Max Mustermann" />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ color: '#a8a8b3', fontSize: '0.75rem', display: 'block', marginBottom: '0.375rem' }}>HANDYNUMMER</label>
              <input style={inputStyle} value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))} placeholder="+4915112345678" />
            </div>
            {error && <p style={{ color: '#e94560', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '0.75rem', background: 'transparent', border: '1px solid #1a4a7a', color: '#a8a8b3', borderRadius: '8px', cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={handleSave} style={{ flex: 1, padding: '0.75rem', background: '#e94560', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Speichern</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
