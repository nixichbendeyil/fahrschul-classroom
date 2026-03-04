import { useAttendance } from './useAttendance'
import { Socket } from 'socket.io-client'

export function AttendanceCheck({ socket }: { socket: Socket | null }) {
  const { active, timeLeft, confirmed, confirm } = useAttendance(socket)

  if (!active) return null

  const urgent = timeLeft <= 30

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#16213e',
        borderRadius: 16,
        padding: '2.5rem',
        textAlign: 'center',
        maxWidth: 340,
        width: '90%',
        border: `2px solid ${urgent ? '#e94560' : '#1a4a7a'}`
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
          {confirmed ? '✅' : '👋'}
        </div>
        <h2 style={{ color: '#fff', marginBottom: '0.5rem' }}>
          {confirmed ? 'Präsenz bestätigt!' : 'Bist du noch dabei?'}
        </h2>

        {!confirmed && (
          <>
            <div style={{
              fontSize: '3rem',
              fontWeight: 700,
              color: urgent ? '#e94560' : '#e2e2e2',
              marginBottom: '1.5rem'
            }}>
              {timeLeft}s
            </div>
            <button
              onClick={confirm}
              style={{
                width: '100%',
                padding: '1rem',
                background: '#e94560',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: '1.1rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Ich bin da!
            </button>
          </>
        )}

        {confirmed && (
          <p style={{ color: '#a8a8b3', fontSize: '0.875rem' }}>
            Warte bis der Lehrer den Check beendet...
          </p>
        )}
      </div>
    </div>
  )
}
