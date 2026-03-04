interface Props {
  roomCode: string
  canvasActive: boolean
  onStartCheck: () => void
  onMuteAll: () => void
  onShareScreen: () => void
  onToggleCanvas: () => void
}

export function TeacherControls({
  roomCode, canvasActive,
  onStartCheck, onMuteAll, onShareScreen, onToggleCanvas
}: Props) {
  return (
    <div style={{ padding: '1rem' }}>
      {/* Raum-Code */}
      <div style={{
        background: '#0f3460',
        borderRadius: 10,
        padding: '1rem',
        textAlign: 'center',
        marginBottom: '1rem'
      }}>
        <p style={{ color: '#a8a8b3', fontSize: '0.75rem', margin: '0 0 0.25rem' }}>RAUM-CODE</p>
        <p style={{ color: '#e94560', fontSize: '2rem', fontWeight: 700, letterSpacing: '0.3rem', margin: 0 }}>
          {roomCode || '------'}
        </p>
      </div>

      {/* Buttons */}
      {[
        { label: 'Praesenz-Check', onClick: onStartCheck, color: '#f59e0b' },
        { label: 'Alle stumm', onClick: onMuteAll, color: '#6366f1' },
        { label: 'Bildschirm teilen', onClick: onShareScreen, color: '#06b6d4' },
        { label: canvasActive ? 'Zeichnen beenden' : 'Zeichnen', onClick: onToggleCanvas, color: canvasActive ? '#e94560' : '#4ade80' },
      ].map(btn => (
        <button
          key={btn.label}
          onClick={btn.onClick}
          style={{
            width: '100%',
            padding: '0.75rem',
            marginBottom: '0.5rem',
            background: btn.color,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          {btn.label}
        </button>
      ))}
    </div>
  )
}
