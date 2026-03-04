import { useCanvas } from './useCanvas'
import { Socket } from 'socket.io-client'

interface Props {
  socket: Socket | null
  isTeacher: boolean
  active: boolean
}

export function DrawingCanvas({ socket, isTeacher, active }: Props) {
  const {
    canvasRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    clearCanvas,
    color,
    strokeWidth
  } = useCanvas(socket, isTeacher)

  if (!active) return null

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, width: '100%', height: '100%',
      pointerEvents: isTeacher ? 'all' : 'none',
      zIndex: 10
    }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          cursor: isTeacher ? 'crosshair' : 'default',
          display: 'block'
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      {isTeacher && (
        <div style={{
          position: 'absolute',
          top: 8, right: 8,
          display: 'flex',
          gap: '0.5rem'
        }}>
          <input
            type="color"
            defaultValue="#ff0000"
            onChange={e => { color.current = e.target.value }}
            title="Farbe"
            style={{ cursor: 'pointer', width: 36, height: 36, border: 'none', borderRadius: 4 }}
          />
          <input
            type="range"
            min={1}
            max={20}
            defaultValue={3}
            onChange={e => { strokeWidth.current = Number(e.target.value) }}
            title="Strichstärke"
            style={{ width: 80 }}
          />
          <button
            onClick={clearCanvas}
            style={{
              background: '#e94560',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '0.25rem 0.75rem',
              cursor: 'pointer'
            }}
          >
            Löschen
          </button>
        </div>
      )}
    </div>
  )
}
