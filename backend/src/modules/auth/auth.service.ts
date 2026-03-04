import { supabase } from '../../lib/supabase'
import jwt from 'jsonwebtoken'
import { LoginRequest, LoginResponse } from './auth.types'

export async function loginStudent(data: LoginRequest): Promise<LoginResponse> {
  // 1. Code prüfen
  const { data: code, error: codeError } = await (supabase as any)
    .from('active_codes')
    .select('*, lessons(*)')
    .eq('room_code', data.room_code.toUpperCase())
    .gt('expires_at', new Date().toISOString())
    .single()

  if (codeError || !code) throw new Error('Ungültiger oder abgelaufener Code')

  // 2. Schüler prüfen
  const { data: student, error: studentError } = await (supabase as any)
    .from('students')
    .select('*')
    .eq('phone_number', data.phone_number)
    .eq('is_active', true)
    .single()

  if (studentError || !student) throw new Error('Handynummer nicht registriert')

  // 3. Attendance Log anlegen
  await (supabase as any).from('attendance_logs').upsert({
    student_id: student.id,
    lesson_id: code.lesson_id,
    joined_at: new Date().toISOString()
  }, { onConflict: 'student_id,lesson_id' })

  // 4. JWT generieren
  const token = jwt.sign(
    { student_id: student.id, lesson_id: code.lesson_id, role: 'student' },
    process.env.JWT_SECRET!,
    { expiresIn: '8h' }
  )

  return {
    token,
    student: { id: student.id, full_name: student.full_name },
    lesson: {
      id: code.lessons.id,
      topic_number: code.lessons.topic_number,
      title: code.lessons.title,
      room_code: code.room_code
    }
  }
}

export async function generateRoomCode(lesson_id: string): Promise<string> {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase()
  const expires_at = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

  await (supabase as any).from('active_codes').upsert(
    { room_code: code, lesson_id, expires_at },
    { onConflict: 'room_code' }
  )
  await (supabase as any)
    .from('lessons')
    .update({ room_code: code, status: 'aktiv' })
    .eq('id', lesson_id)

  return code
}
