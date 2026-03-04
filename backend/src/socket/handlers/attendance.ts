import { Server, Socket } from 'socket.io'
import { supabase } from '../../lib/supabase'

const activeChecks = new Set<string>()

export function registerAttendanceHandlers(
  io: Server,
  socket: Socket,
  lesson_id: string,
  student_id: string,
  role: string
) {
  const room = `lesson:${lesson_id}`

  socket.on('attendance:start', async () => {
    if (role !== 'teacher') return

    // Fix I-2: Read-then-Write statt kaputtem RPC-Aufruf
    const { data: logs } = await (supabase as any)
      .from('attendance_logs')
      .select('id, checks_total')
      .eq('lesson_id', lesson_id)

    if (logs && logs.length > 0) {
      for (const log of logs) {
        await (supabase as any)
          .from('attendance_logs')
          .update({ checks_total: log.checks_total + 1 })
          .eq('id', log.id)
      }
    }

    // Fix C-2: Aktiven Check serverseitig tracken
    activeChecks.add(lesson_id)
    io.to(room).emit('attendance:start', { duration: 120 })

    setTimeout(() => {
      activeChecks.delete(lesson_id)
      io.to(room).emit('attendance:end')
    }, 120_000)
  })

  socket.on('attendance:confirm', async () => {
    // Fix C-2: Nur bestätigen wenn Check aktiv ist
    if (!activeChecks.has(lesson_id)) return
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
