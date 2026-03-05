// backend/src/middleware/adminAuth.ts
import { Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
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

  const { data: teacher } = await (supabase as any)
    .from('teachers')
    .select('id, is_admin')
    .eq('id', user.id)
    .single()

  if (!teacher?.is_admin) {
    res.status(403).json({ error: 'Keine Admin-Rechte' })
    return
  }

  ;(req as any).adminId = user.id
  next()
}
