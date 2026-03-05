// frontend/src/modules/admin/AdminLehrer.tsx
import { useState, useEffect } from 'react'
import { AdminLayout } from './AdminLayout'
import { supabase } from '../../lib/supabase'

interface Lehrer { id: string; full_name: string; email: string; is_admin: boolean; lesson_id: string | null; lesson_title: string | null }
interface Lektion { id: string; topic_number: number; title: string }

const BACKEND = () => import.meta.env.VITE_BACKEND_URL || ''
async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session!.access_token}` }
}

export function AdminLehrer() {
  const [lehrer, setLehrer] = useState<Lehrer[]>([])
  const [lektionen, setLektionen] = useState<Lektion[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ full_name: '', email: '', password: '', lesson_id: '', is_admin: false })
  const [error, setError] = useState('')

  async function load() {
    const headers = await authHeaders()
    const [lr, lk] = await Promise.all([
      fetch(`${BACKEND()}/api/admin/lehrer`, { headers }).then(r => r.json()),
      fetch(`${BACKEND()}/api/admin/lektionen`, { headers }).then(r => r.json()),
    ])
    setLehrer(lr)
    setLektionen(lk)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditId(null)
    setForm({ full_name: '', email: '', password: '', lesson_id: '', is_admin: false })
    setError('')
    setShowModal(true)
  }

  function openEdit(l: Lehrer) {
    setEditId(l.id)
    setForm({ full_name: l.full_name, email: l.email, password: '', lesson_id: l.lesson_id || '', is_admin: l.is_admin })
    setError('')
    setShowModal(true)
  }

  async function handleSave() {
    setError('')
    const headers = await authHeaders()
    const body = { ...form, lesson_id: form.lesson_id || null }

    const res = editId
      ? await fetch(`${BACKEND()}/api/admin/lehrer/${editId}`, { method: 'PUT', headers, body: JSON.stringify(body) })
      : await fetch(`${BACKEND()}/api/admin/lehrer`, { method: 'POST', headers, body: JSON.stringify(body) })

    if (!res.ok) { const d = await res.json(); setError(d.error || 'Fehler'); return }
    setShowModal(false)
    load()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`${name} wirklich löschen?`)) return
    const headers = await authHeaders()
    const res = await fetch(`${BACKEND()}/api/admin/lehrer/${id}`, { method: 'DELETE', headers })
    if (!res.ok) { const d = await res.json(); alert(d.error); return }
    load()
  }

  const inputStyle = { width: '100%', padding: '0.625rem', background: '#0f3460', border: '1px solid #1a4a7a', borderRadius: '6px', color: '#fff', fontSize: '0.875rem', boxSizing: 'border-box' as const }
  const labelStyle = { color: '#a8a8b3', fontSize: '0.75rem', display: 'block', marginBottom: '0.375rem' }

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ color: '#e2e2e2', margin: 0, fontSize: '1.5rem' }}>Lehrer</h1>
        <button onClick={openCreate} style={{ padding: '0.625rem 1.25rem', background: '#e94560', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
          + Neuer Lehrer
        </button>
      </div>

      <div style={{ background: '#16213e', borderRadius: 12, overflow: 'hidden', border: '1px solid #1a4a7a' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1a4a7a' }}>
              {['Name', 'E-Mail', 'Lektion', 'Admin', 'Aktionen'].map(h => (
                <th key={h} style={{ padding: '0.875rem 1rem', color: '#a8a8b3', fontSize: '0.75rem', textAlign: 'left', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lehrer.map(l => (
              <tr key={l.id} style={{ borderBottom: '1px solid #0f3460' }}>
                <td style={{ padding: '0.875rem 1rem', color: '#e2e2e2', fontSize: '0.875rem' }}>{l.full_name}</td>
                <td style={{ padding: '0.875rem 1rem', color: '#a8a8b3', fontSize: '0.875rem' }}>{l.email}</td>
                <td style={{ padding: '0.875rem 1rem', color: '#a8a8b3', fontSize: '0.875rem' }}>{l.lesson_title || '—'}</td>
                <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem' }}>
                  {l.is_admin ? <span style={{ color: '#f59e0b' }}>Admin</span> : <span style={{ color: '#555' }}>Lehrer</span>}
                </td>
                <td style={{ padding: '0.875rem 1rem' }}>
                  <button onClick={() => openEdit(l)} style={{ marginRight: '0.5rem', padding: '0.375rem 0.75rem', background: '#0f3460', color: '#a8a8b3', border: '1px solid #1a4a7a', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}>Bearbeiten</button>
                  <button onClick={() => handleDelete(l.id, l.full_name)} style={{ padding: '0.375rem 0.75rem', background: 'transparent', color: '#e94560', border: '1px solid #e9456040', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}>Löschen</button>
                </td>
              </tr>
            ))}
            {lehrer.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#555' }}>Noch keine Lehrer angelegt</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#16213e', padding: '2rem', borderRadius: 12, width: '100%', maxWidth: 480, border: '1px solid #1a4a7a', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ color: '#e2e2e2', margin: '0 0 1.5rem', fontSize: '1.25rem' }}>{editId ? 'Lehrer bearbeiten' : 'Neuer Lehrer'}</h2>

            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>NAME</label>
              <input style={inputStyle} value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Max Mustermann" />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>E-MAIL</label>
              <input style={inputStyle} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="lehrer@fahrschule.de" />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>{editId ? 'NEUES PASSWORT (leer = unverändert)' : 'PASSWORT'}</label>
              <input style={inputStyle} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>LEKTION ZUWEISEN</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.lesson_id} onChange={e => setForm(f => ({ ...f, lesson_id: e.target.value }))}>
                <option value="">— Keine Lektion —</option>
                {lektionen.map(l => <option key={l.id} value={l.id}>{l.topic_number}. {l.title}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" id="is_admin" checked={form.is_admin} onChange={e => setForm(f => ({ ...f, is_admin: e.target.checked }))} />
              <label htmlFor="is_admin" style={{ color: '#a8a8b3', fontSize: '0.875rem', cursor: 'pointer' }}>Admin-Rechte</label>
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
