import { Server } from 'socket.io'
import { registerDrawHandlers } from './handlers/draw'
import { registerAttendanceHandlers } from './handlers/attendance'
import { registerHandHandlers } from './handlers/hand'

export function registerSocketHandlers(io: Server) {
  io.on('connection', (socket) => {
    const { lesson_id, student_id, role } = socket.handshake.auth

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
    registerAttendanceHandlers(io, socket, lesson_id)
    registerHandHandlers(io, socket, lesson_id)

    socket.on('disconnect', () => {
      if (role === 'student') {
        io.to(room).emit('room:students', { student_id, event: 'left' })
      }
    })
  })
}
