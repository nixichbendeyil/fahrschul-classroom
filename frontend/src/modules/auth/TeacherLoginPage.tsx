// frontend/src/modules/auth/TeacherLoginPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export function TeacherLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  // Bereits eingeloggt? Direkt weiter
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/lehrer-start')
      else setLoading(false)
    })
  }, [navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError || !data.session) {
      setError(authError?.message || 'Login fehlgeschlagen')
      setLoading(false)
      return
    }

    // Prüfen ob User ein Lehrer ist (teachers-Tabelle)
    const { data: teacher } = await (supabase as any)
      .from('teachers')
      .select('id')
      .eq('id', data.session.user.id)
      .single()

    if (!teacher) {
      await supabase.auth.signOut()
      setError('Kein Lehrer-Account für diese E-Mail')
      setLoading(false)
      return
    }

    navigate('/lehrer-start')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e' }}>
      <p style={{ color: '#a8a8b3' }}>Bitte warten...</p>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#1a1a2e', fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        background: '#16213e', padding: '2rem', borderRadius: '12px',
        width: '100%', maxWidth: '360px', boxShadow: '0 4px 24px rgba(0,0,0,0.4)'
      }}>
        <h1 style={{ color: '#e94560', marginBottom: '0.25rem', fontSize: '1.5rem' }}>
          Lehrer-Login
        </h1>
        <p style={{ color: '#a8a8b3', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          Fahrschul Classroom — Lehrerbereich
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ color: '#a8a8b3', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>
              E-MAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="lehrer@fahrschule.de"
              required
              style={{
                width: '100%', padding: '0.75rem', background: '#0f3460',
                border: '1px solid #1a4a7a', borderRadius: '8px',
                color: '#fff', fontSize: '1rem', boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ color: '#a8a8b3', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>
              PASSWORT
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%', padding: '0.75rem', background: '#0f3460',
                border: '1px solid #1a4a7a', borderRadius: '8px',
                color: '#fff', fontSize: '1rem', boxSizing: 'border-box'
              }}
            />
          </div>

          {error && (
            <p style={{ color: '#e94560', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '0.875rem',
              background: loading ? '#555' : '#e94560',
              color: '#fff', border: 'none', borderRadius: '8px',
              fontSize: '1rem', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Bitte warten...' : 'Einloggen'}
          </button>
        </form>
      </div>
    </div>
  )
}
