import { Server, Socket } from 'socket.io'

const lastDraw: Record<string, number> = {}

export function registerDrawHandlers(io: Server, socket: Socket, lesson_id: string) {
  const room = `lesson:${lesson_id}`

  // Fix I-3: Throttle per socket.id statt pro Raum
  socket.on('draw:stroke', (data) => {
    const now = Date.now()
    if (now - (lastDraw[socket.id] || 0) < 33) return // 30fps throttle
    lastDraw[socket.id] = now
    socket.to(room).emit('draw:stroke', data)
  })

  socket.on('draw:clear', () => {
    socket.to(room).emit('draw:clear')
  })

  // Fix I-3: Cleanup beim disconnect
  socket.on('disconnect', () => {
    delete lastDraw[socket.id]
  })
}
