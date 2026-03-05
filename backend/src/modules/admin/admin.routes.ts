// backend/src/modules/admin/admin.routes.ts
import { Router } from 'express'
import { requireAdmin } from '../../middleware/adminAuth'
import {
  getStats,
  getAllLehrer, createLehrer, updateLehrer, deleteLehrer,
  getAllSchueler, createSchueler, updateSchueler, deleteSchueler,
  getAllLektionen, createLektion, updateLektion, deleteLektion
} from './admin.service'

const router = Router()
router.use(requireAdmin)

router.get('/stats', async (_req, res) => {
  try { res.json(await getStats()) }
  catch (e: any) { res.status(500).json({ error: e.message }) }
})

// Lehrer
router.get('/lehrer', async (_req, res) => {
  try { res.json(await getAllLehrer()) }
  catch (e: any) { res.status(500).json({ error: e.message }) }
})
router.post('/lehrer', async (req, res) => {
  try { res.json(await createLehrer(req.body)) }
  catch (e: any) { res.status(400).json({ error: e.message }) }
})
router.put('/lehrer/:id', async (req, res) => {
  try { await updateLehrer(req.params.id, req.body); res.json({ ok: true }) }
  catch (e: any) { res.status(400).json({ error: e.message }) }
})
router.delete('/lehrer/:id', async (req, res) => {
  try { await deleteLehrer(req.params.id, (req as any).adminId); res.json({ ok: true }) }
  catch (e: any) { res.status(400).json({ error: e.message }) }
})

// Schüler
router.get('/schueler', async (_req, res) => {
  try { res.json(await getAllSchueler()) }
  catch (e: any) { res.status(500).json({ error: e.message }) }
})
router.post('/schueler', async (req, res) => {
  try { res.json(await createSchueler(req.body)) }
  catch (e: any) { res.status(400).json({ error: e.message }) }
})
router.put('/schueler/:id', async (req, res) => {
  try { await updateSchueler(req.params.id, req.body); res.json({ ok: true }) }
  catch (e: any) { res.status(400).json({ error: e.message }) }
})
router.delete('/schueler/:id', async (req, res) => {
  try { await deleteSchueler(req.params.id); res.json({ ok: true }) }
  catch (e: any) { res.status(400).json({ error: e.message }) }
})

// Lektionen
router.get('/lektionen', async (_req, res) => {
  try { res.json(await getAllLektionen()) }
  catch (e: any) { res.status(500).json({ error: e.message }) }
})
router.post('/lektionen', async (req, res) => {
  try { res.json(await createLektion(req.body)) }
  catch (e: any) { res.status(400).json({ error: e.message }) }
})
router.put('/lektionen/:id', async (req, res) => {
  try { await updateLektion(req.params.id, req.body); res.json({ ok: true }) }
  catch (e: any) { res.status(400).json({ error: e.message }) }
})
router.delete('/lektionen/:id', async (req, res) => {
  try { await deleteLektion(req.params.id); res.json({ ok: true }) }
  catch (e: any) { res.status(400).json({ error: e.message }) }
})

export default router
