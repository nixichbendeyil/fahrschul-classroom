import { useState } from 'react'
import { useAuth } from './useAuth'

export function LoginPage() {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const { login, loading, error } = useAuth()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    login(phone, code)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#1a1a2e',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        background: '#16213e',
        padding: '2rem',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '360px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)'
      }}>
        <h1 style={{ color: '#e94560', marginBottom: '0.25rem', fontSize: '1.5rem' }}>
          Fahrschul Classroom
        </h1>
        <p style={{ color: '#a8a8b3', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          Gib deine Handynummer und den Raum-Code ein
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ color: '#a8a8b3', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>
              HANDYNUMMER
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+49 151 12345678"
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#0f3460',
                border: '1px solid #1a4a7a',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ color: '#a8a8b3', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>
              RAUM-CODE
            </label>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#0f3460',
                border: '1px solid #1a4a7a',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '1.5rem',
                letterSpacing: '0.3rem',
                textAlign: 'center',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {error && (
            <p style={{ color: '#e94560', marginBottom: '1rem', fontSize: '0.875rem' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: loading ? '#555' : '#e94560',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Bitte warten...' : 'Eintreten'}
          </button>
        </form>
      </div>
    </div>
  )
}
