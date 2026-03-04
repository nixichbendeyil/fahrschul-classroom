import { Router } from 'express'
import { supabase } from '../../lib/supabase'

const router = Router()

router.get('/', async (_req, res) => {
  const { data } = await (supabase as any).from('lessons').select('*').eq('status', 'aktiv')
  res.json(data || [])
})

export default router
