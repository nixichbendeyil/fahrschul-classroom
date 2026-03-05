// backend/src/modules/auth/auth.routes.ts
import { Router } from 'express'
import { loginStudent, generateRoomCode } from './auth.service'
import { requireTeacher } from '../../middleware/teacherAuth'

const router = Router()

router.post('/login', async (req, res) => {
  try {
    const result = await loginStudent(req.body)
    res.json(result)
  } catch (err: any) {
    res.status(401).json({ error: err.message })
  }
})

// Jetzt mit requireTeacher geschützt
router.post('/room-code', requireTeacher, async (req, res) => {
  try {
    const { lesson_id } = req.body
    if (!lesson_id) {
      res.status(400).json({ error: 'lesson_id erforderlich' })
      return
    }
    const code = await generateRoomCode(lesson_id)
    res.json({ code })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
