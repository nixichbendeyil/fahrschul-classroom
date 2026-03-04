import { useState, useEffect } from 'react'
import { Socket } from 'socket.io-client'

interface Student {
  id: string
  name: string
  online: boolean
  handRaised: boolean
  checksConfirmed: number
  checksTotal: number
}

interface Props {
  socket: Socket | null
  onGrantMic: (id: string) => void
}

export function StudentList({ socket, onGrantMic }: Props) {
  const [students, setStudents] = useState<Student[]>([])

  useEffect(() => {
    if (!socket) return

    socket.on('room:students', (data: { student_id: string; event: 'joined' | 'left' }) => {
      setStudents(prev => {
        if (data.event === 'joined') {
          const exists = prev.find(s => s.id === data.student_id)
          if (exists) return prev.map(s => s.id === data.student_id ? { ...s, online: true } : s)
          return [...prev, {
            id: data.student_id,
            name: data.student_id.slice(0, 8),
            online: true,
            handRaised: false,
            checksConfirmed: 0,
            checksTotal: 0
          }]
        }
        return prev.map(s => s.id === data.student_id ? { ...s, online: false } : s)
      })
    })

    socket.on('hand:update', (data: { student_id: string; raised: boolean }) => {
      setStudents(prev => prev.map(s =>
        s.id === data.student_id ? { ...s, handRaised: data.raised } : s
      ))
    })

    socket.on('attendance:confirmed', (data: { student_id: string }) => {
      setStudents(prev => prev.map(s =>
        s.id === data.student_id ? { ...s, checksConfirmed: s.checksConfirmed + 1 } : s
      ))
    })

    socket.on('attendance:start', () => {
      setStudents(prev => prev.map(s => ({ ...s, checksTotal: s.checksTotal + 1 })))
    })

    return () => {
      socket.off('room:students')
      socket.off('hand:update')
      socket.off('attendance:confirmed')
      socket.off('attendance:start')
    }
  }, [socket])

  const online = students.filter(s => s.online)
  const offline = students.filter(s => !s.online)

  return (
    <div style={{ padding: '0.5rem' }}>
      <h3 style={{ color: '#a8a8b3', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
        Schüler ({online.length} online)
      </h3>
      {students.length === 0 && (
        <p style={{ color: '#555', fontSize: '0.875rem' }}>Noch keine Schüler beigetreten</p>
      )}
      {[...online, ...offline].map(s => (
        <div key={s.id} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem',
          marginBottom: '0.25rem',
          background: '#0f3460',
          borderRadius: 8,
          opacity: s.online ? 1 : 0.5
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: s.online ? '#4ade80' : '#555',
            flexShrink: 0
          }} />
          <span style={{ color: '#e2e2e2', fontSize: '0.875rem', flex: 1 }}>
            {s.name}
          </span>
          <span style={{ color: '#a8a8b3', fontSize: '0.75rem' }}>
            {s.checksConfirmed}/{s.checksTotal}
          </span>
          {s.handRaised && (
            <button
              onClick={() => onGrantMic(s.id)}
              title="Mikrofon freischalten"
              style={{
                background: '#e94560',
                border: 'none',
                borderRadius: 4,
                padding: '0.25rem 0.5rem',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.75rem'
              }}
            >
              Mic
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
