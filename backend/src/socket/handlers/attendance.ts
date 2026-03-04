import { Server, Socket } from 'socket.io'
import { supabase } from '../../lib/supabase'

export function registerAttendanceHandlers(io: Server, socket: Socket, lesson_id: string) {
  const room = `lesson:${lesson_id}`

  socket.on('attendance:start', async () => {
    if (socket.handshake.auth.role !== 'teacher') return

    // checks_total für alle Schüler in dieser Lektion erhöhen
    await (supabase as any)
      .from('attendance_logs')
      .update({ checks_total: (supabase as any).rpc('increment') })
      .eq('lesson_id', lesson_id)

    io.to(room).emit('attendance:start', { duration: 120 })

    setTimeout(() => {
      io.to(room).emit('attendance:end')
    }, 120_000)
  })

  socket.on('attendance:confirm', async () => {
    const { student_id } = socket.handshake.auth
    if (!student_id) return

    const { data: log } = await (supabase as any)
      .from('attendance_logs')
      .select('checks_confirmed')
      .eq('student_id', student_id)
      .eq('lesson_id', lesson_id)
      .single()

    if (log) {
      await (supabase as any)
        .from('attendance_logs')
        .update({ checks_confirmed: log.checks_confirmed + 1 })
        .eq('student_id', student_id)
        .eq('lesson_id', lesson_id)
    }

    io.to(room).emit('attendance:confirmed', { student_id })
  })
}
