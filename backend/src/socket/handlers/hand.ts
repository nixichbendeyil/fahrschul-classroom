import { Server, Socket } from 'socket.io'

export function registerHandHandlers(io: Server, socket: Socket, lesson_id: string) {
  const room = `lesson:${lesson_id}`

  socket.on('hand:raise', () => {
    io.to(room).emit('hand:update', {
      student_id: socket.handshake.auth.student_id,
      raised: true
    })
  })

  socket.on('hand:lower', () => {
    io.to(room).emit('hand:update', {
      student_id: socket.handshake.auth.student_id,
      raised: false
    })
  })

  socket.on('mic:grant', ({ target_student_id }: { target_student_id: string }) => {
    if (socket.handshake.auth.role !== 'teacher') return
    io.to(room).emit('mic:granted', { student_id: target_student_id })
  })

  socket.on('mic:revoke', ({ target_student_id }: { target_student_id: string }) => {
    if (socket.handshake.auth.role !== 'teacher') return
    io.to(room).emit('mic:revoked', { student_id: target_student_id })
  })
}
