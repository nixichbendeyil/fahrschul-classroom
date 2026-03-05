// frontend/src/modules/admin/AdminLektionen.tsx
import { useState, useEffect } from 'react'
import { AdminLayout } from './AdminLayout'
import { supabase } from '../../lib/supabase'

interface Lektion { id: string; topic_number: number; title: string; status: string; room_code: string | null; assigned_teacher: string | null; assigned_teacher_id: string | null }
interface Lehrer { id: string; full_name: string }

const BACKEND = () => import.meta.env.VITE_BACKEND_URL || ''
async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session!.access_token}` }
}

export function AdminLektionen() {
  const [lektionen, setLektionen] = useState<Lektion[]>([])
  const [lehrer, setLehrer] = useState<Lehrer[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ topic_number: '', title: '', teacher_id: '' })
  const [error, setError] = useState('')

  async function load() {
    const headers = await authHeaders()
    const [lk, lr] = await Promise.all([
      fetch(`${BACKEND()}/api/admin/lektionen`, { headers }).then(r => r.json()),
      fetch(`${BACKEND()}/api/admin/lehrer`, { headers }).then(r => r.json()),
    ])
    setLektionen(lk)
    setLehrer(lr.filter((l: any) => !l.is_admin))
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditId(null)
    setForm({ topic_number: '', title: '', teacher_id: '' })
    setError('')
    setShowModal(true)
  }

  function openEdit(l: Lektion) {
    setEditId(l.id)
    setForm({ topic_number: String(l.topic_number), title: l.title, teacher_id: l.assigned_teacher_id || '' })
    setError('')
    setShowModal(true)
  }

  async function handleSave() {
    setError('')
    if (!form.topic_number || !form.title) { setError('Nummer und Titel erforderlich'); return }
    const headers = await authHeaders()
    const body = { topic_number: Number(form.topic_number), title: form.title, teacher_id: form.teacher_id || null }
    const res = editId
      ? await fetch(`${BACKEND()}/api/admin/lektionen/${editId}`, { method: 'PUT', headers, body: JSON.stringify(body) })
      : await fetch(`${BACKEND()}/api/admin/lektionen`, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Fehler'); return }
    setShowModal(false)
    load()
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Lektion "${title}" wirklich löschen?`)) return
    const headers = await authHeaders()
    const res = await fetch(`${BACKEND()}/api/admin/lektionen/${id}`, { method: 'DELETE', headers })
    if (!res.ok) { const d = await res.json(); alert(d.error); return }
    load()
  }

  const inputStyle = { width: '100%', padding: '0.625rem', background: '#0f3460', border: '1px solid #1a4a7a', borderRadius: '6px', color: '#fff', fontSize: '0.875rem', boxSizing: 'border-box' as const }

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ color: '#e2e2e2', margin: 0, fontSize: '1.5rem' }}>Lektionen</h1>
        <button onClick={openCreate} style={{ padding: '0.625rem 1.25rem', background: '#e94560', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>+ Neue Lektion</button>
      </div>

      <div style={{ background: '#16213e', borderRadius: 12, overflow: 'hidden', border: '1px solid #1a4a7a' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1a4a7a' }}>
              {['Nr.', 'Titel', 'Lehrer', 'Status', 'Aktionen'].map(h => (
                <th key={h} style={{ padding: '0.875rem 1rem', color: '#a8a8b3', fontSize: '0.75rem', textAlign: 'left', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lektionen.map(l => (
              <tr key={l.id} style={{ borderBottom: '1px solid #0f3460' }}>
                <td style={{ padding: '0.875rem 1rem', color: '#e94560', fontSize: '0.875rem', fontWeight: 700 }}>{l.topic_number}</td>
                <td style={{ padding: '0.875rem 1rem', color: '#e2e2e2', fontSize: '0.875rem' }}>{l.title}</td>
                <td style={{ padding: '0.875rem 1rem', color: '#a8a8b3', fontSize: '0.875rem' }}>{l.assigned_teacher || '—'}</td>
                <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem' }}>
                  <span style={{ color: l.status === 'aktiv' ? '#4ade80' : '#a8a8b3' }}>{l.status}</span>
                </td>
                <td style={{ padding: '0.875rem 1rem' }}>
                  <button onClick={() => openEdit(l)} style={{ marginRight: '0.5rem', padding: '0.375rem 0.75rem', background: '#0f3460', color: '#a8a8b3', border: '1px solid #1a4a7a', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}>Bearbeiten</button>
                  <button onClick={() => handleDelete(l.id, l.title)} style={{ padding: '0.375rem 0.75rem', background: 'transparent', color: '#e94560', border: '1px solid #e9456040', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}>Löschen</button>
                </td>
              </tr>
            ))}
            {lektionen.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#555' }}>Noch keine Lektionen angelegt</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#16213e', padding: '2rem', borderRadius: 12, width: '100%', maxWidth: 440, border: '1px solid #1a4a7a' }}>
            <h2 style={{ color: '#e2e2e2', margin: '0 0 1.5rem', fontSize: '1.25rem' }}>{editId ? 'Lektion bearbeiten' : 'Neue Lektion'}</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#a8a8b3', fontSize: '0.75rem', display: 'block', marginBottom: '0.375rem' }}>NUMMER</label>
              <input style={inputStyle} type="number" value={form.topic_number} onChange={e => setForm(f => ({ ...f, topic_number: e.target.value }))} placeholder="1" min="1" />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#a8a8b3', fontSize: '0.75rem', display: 'block', marginBottom: '0.375rem' }}>TITEL</label>
              <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Grundregeln im Straßenverkehr" />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ color: '#a8a8b3', fontSize: '0.75rem', display: 'block', marginBottom: '0.375rem' }}>LEHRER ZUWEISEN</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.teacher_id} onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))}>
                <option value="">— Kein Lehrer —</option>
                {lehrer.map(l => <option key={l.id} value={l.id}>{l.full_name}</option>)}
              </select>
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
