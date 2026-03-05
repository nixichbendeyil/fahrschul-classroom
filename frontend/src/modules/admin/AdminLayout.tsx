// frontend/src/modules/admin/AdminLayout.tsx
import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

interface Props { children: React.ReactNode }

export function AdminLayout({ children }: Props) {
  const [adminName, setAdminName] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/login'); return }
      const { data: teacher } = await (supabase as any)
        .from('teachers')
        .select('full_name, is_admin')
        .eq('id', session.user.id)
        .single()
      if (!teacher?.is_admin) { navigate('/login'); return }
      setAdminName(teacher.full_name)
    }
    check()
  }, [navigate])

  async function logout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const navItems = [
    { path: '/admin', label: 'Dashboard' },
    { path: '/admin/lehrer', label: 'Lehrer' },
    { path: '/admin/schueler', label: 'Schüler' },
    { path: '/admin/lektionen', label: 'Lektionen' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#1a1a2e', fontFamily: 'system-ui, sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: '#16213e', borderRight: '1px solid #1a4a7a', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '1.5rem 1rem', borderBottom: '1px solid #1a4a7a' }}>
          <p style={{ color: '#e94560', fontWeight: 700, margin: 0, fontSize: '0.875rem' }}>FAHRSCHUL CLASSROOM</p>
          <p style={{ color: '#a8a8b3', margin: '0.25rem 0 0', fontSize: '0.75rem' }}>Admin-Panel</p>
        </div>
        <nav style={{ padding: '0.5rem 0', flex: 1 }}>
          {navItems.map(item => (
            <Link key={item.path} to={item.path} style={{
              display: 'block', padding: '0.75rem 1rem',
              color: location.pathname === item.path ? '#e2e2e2' : '#a8a8b3',
              background: location.pathname === item.path ? '#0f3460' : 'transparent',
              textDecoration: 'none', fontSize: '0.875rem',
              borderLeft: location.pathname === item.path ? '3px solid #e94560' : '3px solid transparent',
            }}>{item.label}</Link>
          ))}
        </nav>
        <div style={{ padding: '1rem', borderTop: '1px solid #1a4a7a' }}>
          <p style={{ color: '#a8a8b3', fontSize: '0.75rem', margin: '0 0 0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adminName}</p>
          <button onClick={logout} style={{ width: '100%', padding: '0.5rem', background: 'transparent', border: '1px solid #1a4a7a', color: '#a8a8b3', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}>
            Abmelden
          </button>
        </div>
      </div>
      {/* Main */}
      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  )
}
