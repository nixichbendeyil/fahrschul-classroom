// backend/src/middleware/teacherAuth.ts
import { Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export async function requireTeacher(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ error: 'Kein Token' })
    return
  }

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    res.status(401).json({ error: 'Ungültiger Token' })
    return
  }

  // Prüfen ob User ein Lehrer ist
  const { data: teacher } = await (supabase as any)
    .from('teachers')
    .select('id, lesson_id')
    .eq('id', user.id)
    .single()

  if (!teacher) {
    res.status(403).json({ error: 'Kein Lehrer-Account' })
    return
  }

  // User-Infos an Request anhängen für spätere Handler
  ;(req as any).teacher = { id: teacher.id, lesson_id: teacher.lesson_id }
  next()
}
