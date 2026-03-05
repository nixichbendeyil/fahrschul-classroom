// frontend/src/modules/admin/AdminDashboard.tsx
import { useState, useEffect } from 'react'
import { AdminLayout } from './AdminLayout'
import { supabase } from '../../lib/supabase'

export function AdminDashboard() {
  const [stats, setStats] = useState({ lehrer: 0, schueler: 0, lektionen: 0 })

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const BACKEND = import.meta.env.VITE_BACKEND_URL || ''
      const res = await fetch(`${BACKEND}/api/admin/stats`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      if (res.ok) setStats(await res.json())
    }
    load()
  }, [])

  return (
    <AdminLayout>
      <h1 style={{ color: '#e2e2e2', margin: '0 0 2rem', fontSize: '1.5rem' }}>Dashboard</h1>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Lehrer', value: stats.lehrer, color: '#6366f1' },
          { label: 'Schüler', value: stats.schueler, color: '#4ade80' },
          { label: 'Lektionen', value: stats.lektionen, color: '#f59e0b' },
        ].map(card => (
          <div key={card.label} style={{ background: '#16213e', borderRadius: 12, padding: '1.5rem 2.5rem', border: `1px solid ${card.color}40`, minWidth: 160 }}>
            <p style={{ color: card.color, fontSize: '3rem', fontWeight: 700, margin: 0, lineHeight: 1 }}>{card.value}</p>
            <p style={{ color: '#a8a8b3', margin: '0.5rem 0 0', fontSize: '0.875rem' }}>{card.label}</p>
          </div>
        ))}
      </div>
    </AdminLayout>
  )
}
