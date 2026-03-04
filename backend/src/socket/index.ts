import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import { registerDrawHandlers } from './handlers/draw'
import { registerAttendanceHandlers } from './handlers/attendance'
import { registerHandHandlers } from './handlers/hand'

export function registerSocketHandlers(io: Server) {
  io.on('connection', (socket) => {
    const token = socket.handshake.auth.token as string | undefined
    if (!token) { socket.disconnect(); return }

    let payload: { student_id: string; lesson_id: string; role: string }
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET!) as typeof payload
    } catch {
      socket.disconnect()
      return
    }
    const { lesson_id, student_id, role } = payload

    if (!lesson_id) {
      socket.disconnect()
      return
    }

    const room = `lesson:${lesson_id}`
    socket.join(room)
    console.log(`[socket] ${role || 'unknown'} joined lesson ${lesson_id}`)

    if (role === 'student') {
      io.to(room).emit('room:students', { student_id, event: 'joined' })
    }

    registerDrawHandlers(io, socket, lesson_id)
    registerAttendanceHandlers(io, socket, lesson_id, student_id, role)
    registerHandHandlers(io, socket, lesson_id, student_id, role)

    socket.on('disconnect', () => {
      if (role === 'student') {
        io.to(room).emit('room:students', { student_id, event: 'left' })
      }
    })
  })
}
