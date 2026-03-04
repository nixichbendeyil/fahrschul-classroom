import { Server, Socket } from 'socket.io'

const lastDraw: Record<string, number> = {}

export function registerDrawHandlers(io: Server, socket: Socket, lesson_id: string) {
  const room = `lesson:${lesson_id}`

  socket.on('draw:stroke', (data) => {
    const now = Date.now()
    if (now - (lastDraw[room] || 0) < 33) return // 30fps throttle
    lastDraw[room] = now
    socket.to(room).emit('draw:stroke', data)
  })

  socket.on('draw:clear', () => {
    socket.to(room).emit('draw:clear')
  })
}
