# Admin Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Ein vollständiges Admin-Panel mit dem Lehrer, Schüler und Lektionen über eine Web-UI verwaltet werden können — kein SQL mehr nötig.

**Architecture:** `teachers` Tabelle bekommt `is_admin` Spalte. Ein einheitlicher `/login` ersetzt `/lehrer-login` und erkennt die Rolle (Admin → `/admin`, Lehrer → `/lehrer-start`). Neue Backend-Routen unter `/api/admin/*` sind durch `requireAdmin` Middleware geschützt und nutzen die Supabase Admin API für User-Management. Das Frontend bekommt 5 neue Seiten: StaffLoginPage, AdminLayout, AdminDashboard, AdminLehrer, AdminSchueler, AdminLektionen.

**Tech Stack:** React + Vite + TypeScript (inline styles), Express + TypeScript (Backend), Supabase (PostgreSQL + Auth Admin API), React Router DOM v6

---

## Kontext (für den Implementierer)

### Bestehende Dateistruktur

```
frontend/src/
  App.tsx                              ← Router — hier neue Routen hinzufügen
  lib/supabase.ts                      ← createBrowserClient mit VITE_SUPABASE_URL + ANON_KEY
  modules/
    auth/
      TeacherLoginPage.tsx             ← Wird zu StaffLoginPage (NICHT löschen, nur neues File anlegen)
    teacher/
      TeacherStartPage.tsx             ← redirect zu /login anpassen (war /lehrer-login)
      TeacherDashboard.tsx             ← redirect zu /login anpassen

backend/src/
  index.ts                             ← Neuen adminRouter hier registrieren
  lib/supabase.ts                      ← SERVICE_ROLE KEY → hat supabase.auth.admin.* Zugriff
  middleware/
    teacherAuth.ts                     ← Muster für adminAuth.ts
  modules/auth/
    auth.routes.ts                     ← Muster für admin.routes.ts
```

### Wichtige Konventionen

- Supabase-Queries: `(supabase as any).from(...)` (TypeScript-Workaround)
- Inline-Styles überall (kein CSS, kein Tailwind)
- Farbschema: `#1a1a2e` bg, `#16213e` card/sidebar, `#0f3460` input/row, `#e94560` primary/danger, `#4ade80` success, `#f59e0b` warning, `#a8a8b3` text-muted, `#1a4a7a` border
- Auth-Guard Muster: `supabase.auth.getSession()` → prüfen → navigate bei Fehler
- Backend API-Calls vom Frontend: `Authorization: Bearer ${session.access_token}`
- `import.meta.env.VITE_BACKEND_URL` für Backend-URL

### Supabase Admin API (Backend)

Der Backend-Supabase-Client (`lib/supabase.ts`) hat `SERVICE_ROLE_KEY` und kann:
```typescript
// User anlegen
await supabase.auth.admin.createUser({ email, password, email_confirm: true })
// User updaten
await supabase.auth.admin.updateUserById(id, { email?, password? })
// User löschen (löscht auch teachers-Row via CASCADE)
await supabase.auth.admin.deleteUser(id)
```

---

## Task 1: DB Migration — `is_admin` Spalte

**Dateien:**
- Create: `supabase/migrations/004_admin_role.sql`

**Schritt 1: SQL-Datei erstellen**

```sql
-- supabase/migrations/004_admin_role.sql
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
```

**Schritt 2: Migration in Supabase Studio ausführen**

Supabase Studio → SQL Editor → Inhalt einfügen → Run.
Erwartetes Ergebnis: kein Fehler, Spalte `is_admin` existiert in `teachers`.

**Schritt 3: Commit**

```bash
cd C:\APK\fahrschul-classroom
git add supabase/migrations/004_admin_role.sql
git commit -m "feat: add is_admin column to teachers table"
```

---

## Task 2: Backend — `requireAdmin` Middleware

**Dateien:**
- Create: `backend/src/middleware/adminAuth.ts`

**Code:**

```typescript
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
```

**Commit:**

```bash
git add backend/src/middleware/adminAuth.ts
git commit -m "feat: add requireAdmin middleware"
```

---

## Task 3: Backend — Admin Service

**Dateien:**
- Create: `backend/src/modules/admin/admin.service.ts`

**Code:**

```typescript
// backend/src/modules/admin/admin.service.ts
import { supabase } from '../../lib/supabase'

// ─── STATS ───────────────────────────────────────────────

export async function getStats() {
  const [{ count: lehrer }, { count: schueler }, { count: lektionen }] = await Promise.all([
    (supabase as any).from('teachers').select('*', { count: 'exact', head: true }),
    (supabase as any).from('students').select('*', { count: 'exact', head: true }),
    (supabase as any).from('lessons').select('*', { count: 'exact', head: true }),
  ])
  return { lehrer: lehrer || 0, schueler: schueler || 0, lektionen: lektionen || 0 }
}

// ─── LEHRER ──────────────────────────────────────────────

export async function getAllLehrer() {
  const { data } = await (supabase as any)
    .from('teachers')
    .select('id, full_name, is_admin, lesson_id, lessons(title, topic_number)')
    .order('full_name')

  // E-Mails aus Auth laden
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const emailMap = new Map(users.map((u: any) => [u.id, u.email]))

  return (data || []).map((t: any) => ({
    id: t.id,
    full_name: t.full_name,
    email: emailMap.get(t.id) || '',
    is_admin: t.is_admin,
    lesson_id: t.lesson_id,
    lesson_title: t.lessons ? `${t.lessons.topic_number}. ${t.lessons.title}` : null
  }))
}

export async function createLehrer(data: { full_name: string; email: string; password: string; lesson_id?: string; is_admin?: boolean }) {
  const { data: authData, error } = await supabase.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true
  })
  if (error || !authData.user) throw new Error(error?.message || 'User-Erstellung fehlgeschlagen')

  await (supabase as any).from('teachers').insert({
    id: authData.user.id,
    full_name: data.full_name,
    lesson_id: data.lesson_id || null,
    is_admin: data.is_admin || false
  })
  return { id: authData.user.id }
}

export async function updateLehrer(id: string, data: { full_name?: string; email?: string; password?: string; lesson_id?: string | null; is_admin?: boolean }) {
  if (data.email || data.password) {
    const updates: any = {}
    if (data.email) updates.email = data.email
    if (data.password) updates.password = data.password
    await supabase.auth.admin.updateUserById(id, updates)
  }
  const dbUpdate: any = {}
  if (data.full_name !== undefined) dbUpdate.full_name = data.full_name
  if (data.lesson_id !== undefined) dbUpdate.lesson_id = data.lesson_id
  if (data.is_admin !== undefined) dbUpdate.is_admin = data.is_admin
  if (Object.keys(dbUpdate).length > 0) {
    await (supabase as any).from('teachers').update(dbUpdate).eq('id', id)
  }
}

export async function deleteLehrer(id: string, requesterId: string) {
  if (id === requesterId) throw new Error('Du kannst dich nicht selbst löschen')
  await supabase.auth.admin.deleteUser(id)
}

// ─── SCHÜLER ─────────────────────────────────────────────

export async function getAllSchueler() {
  const { data } = await (supabase as any)
    .from('students')
    .select('id, full_name, phone_number, is_active')
    .order('full_name')
  return data || []
}

export async function createSchueler(data: { full_name: string; phone_number: string }) {
  const { data: row, error } = await (supabase as any)
    .from('students')
    .insert({ full_name: data.full_name, phone_number: data.phone_number, is_active: true })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return row
}

export async function updateSchueler(id: string, data: { full_name?: string; phone_number?: string; is_active?: boolean }) {
  await (supabase as any).from('students').update(data).eq('id', id)
}

export async function deleteSchueler(id: string) {
  await (supabase as any).from('students').delete().eq('id', id)
}

// ─── LEKTIONEN ────────────────────────────────────────────

export async function getAllLektionen() {
  const { data } = await (supabase as any)
    .from('lessons')
    .select('id, topic_number, title, status, room_code')
    .order('topic_number')

  // Zugewiesene Lehrer laden
  const { data: teachers } = await (supabase as any)
    .from('teachers')
    .select('id, full_name, lesson_id')
    .not('lesson_id', 'is', null)

  const teacherMap = new Map((teachers || []).map((t: any) => [t.lesson_id, t.full_name]))

  return (data || []).map((l: any) => ({
    ...l,
    assigned_teacher: teacherMap.get(l.id) || null
  }))
}

export async function createLektion(data: { topic_number: number; title: string; teacher_id?: string }) {
  const { data: row, error } = await (supabase as any)
    .from('lessons')
    .insert({ topic_number: data.topic_number, title: data.title, status: 'entwurf' })
    .select()
    .single()
  if (error) throw new Error(error.message)

  if (data.teacher_id) {
    await (supabase as any).from('teachers').update({ lesson_id: row.id }).eq('id', data.teacher_id)
  }
  return row
}

export async function updateLektion(id: string, data: { topic_number?: number; title?: string; teacher_id?: string | null }) {
  const dbUpdate: any = {}
  if (data.topic_number !== undefined) dbUpdate.topic_number = data.topic_number
  if (data.title !== undefined) dbUpdate.title = data.title
  if (Object.keys(dbUpdate).length > 0) {
    await (supabase as any).from('lessons').update(dbUpdate).eq('id', id)
  }
  if (data.teacher_id !== undefined) {
    // Alten Lehrer von dieser Lektion lösen
    await (supabase as any).from('teachers').update({ lesson_id: null }).eq('lesson_id', id)
    // Neuen Lehrer zuweisen
    if (data.teacher_id) {
      await (supabase as any).from('teachers').update({ lesson_id: id }).eq('id', data.teacher_id)
    }
  }
}

export async function deleteLektion(id: string) {
  await (supabase as any).from('teachers').update({ lesson_id: null }).eq('lesson_id', id)
  await (supabase as any).from('lessons').delete().eq('id', id)
}
```

**Commit:**

```bash
git add backend/src/modules/admin/admin.service.ts
git commit -m "feat: add admin service with full CRUD"
```

---

## Task 4: Backend — Admin Routes + index.ts registrieren

**Dateien:**
- Create: `backend/src/modules/admin/admin.routes.ts`
- Modify: `backend/src/index.ts`

**admin.routes.ts:**

```typescript
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
```

**index.ts — nach der `roomsRouter` Zeile einfügen:**

```typescript
import adminRouter from './modules/admin/admin.routes'
app.use('/api/admin', adminRouter)
```

**Commit:**

```bash
git add backend/src/modules/admin/admin.routes.ts backend/src/index.ts
git commit -m "feat: add admin REST routes and register in server"
```

---

## Task 5: Frontend — `StaffLoginPage` (einheitlicher Login)

**Dateien:**
- Create: `frontend/src/modules/auth/StaffLoginPage.tsx`

**Code:**

```typescript
// frontend/src/modules/auth/StaffLoginPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export function StaffLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }

      const { data: teacher } = await (supabase as any)
        .from('teachers')
        .select('is_admin')
        .eq('id', session.user.id)
        .single()

      if (teacher?.is_admin) navigate('/admin')
      else if (teacher) navigate('/lehrer-start')
      else setLoading(false)
    }
    check()
  }, [navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError || !data.session) {
      setError(authError?.message || 'Login fehlgeschlagen')
      setLoading(false)
      return
    }

    const { data: teacher } = await (supabase as any)
      .from('teachers')
      .select('is_admin')
      .eq('id', data.session.user.id)
      .single()

    if (!teacher) {
      await supabase.auth.signOut()
      setError('Kein Zugang für diese E-Mail')
      setLoading(false)
      return
    }

    if (teacher.is_admin) navigate('/admin')
    else navigate('/lehrer-start')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e' }}>
      <p style={{ color: '#a8a8b3' }}>Bitte warten...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#16213e', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '360px', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
        <h1 style={{ color: '#e94560', marginBottom: '0.25rem', fontSize: '1.5rem' }}>Anmelden</h1>
        <p style={{ color: '#a8a8b3', marginBottom: '1.5rem', fontSize: '0.875rem' }}>Fahrschul Classroom — Mitarbeiter</p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ color: '#a8a8b3', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>E-MAIL</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              style={{ width: '100%', padding: '0.75rem', background: '#0f3460', border: '1px solid #1a4a7a', borderRadius: '8px', color: '#fff', fontSize: '1rem', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ color: '#a8a8b3', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>PASSWORT</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              style={{ width: '100%', padding: '0.75rem', background: '#0f3460', border: '1px solid #1a4a7a', borderRadius: '8px', color: '#fff', fontSize: '1rem', boxSizing: 'border-box' }} />
          </div>

          {error && <p style={{ color: '#e94560', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</p>}

          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '0.875rem', background: loading ? '#555' : '#e94560', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Bitte warten...' : 'Einloggen'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

**Commit:**

```bash
git add frontend/src/modules/auth/StaffLoginPage.tsx
git commit -m "feat: add unified staff login page with role detection"
```

---

## Task 6: Frontend — Admin Layout + Dashboard

**Dateien:**
- Create: `frontend/src/modules/admin/AdminLayout.tsx`
- Create: `frontend/src/modules/admin/AdminDashboard.tsx`

**AdminLayout.tsx:**

```typescript
// frontend/src/modules/admin/AdminLayout.tsx
import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

interface Props { children: React.ReactNode }

export function AdminLayout({ children }: Props) {
  const [adminName, setAdminName] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/login'); return }
      const { data: teacher } = await (supabase as any)
        .from('teachers')
        .select('full_name, is_admin')
        .eq('id', session.user.id)
        .single()
      if (!teacher?.is_admin) { navigate('/login'); return }
      setAdminName(teacher.full_name)
    }
    check()
  }, [navigate])

  async function logout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const navItems = [
    { path: '/admin', label: 'Dashboard' },
    { path: '/admin/lehrer', label: 'Lehrer' },
    { path: '/admin/schueler', label: 'Schüler' },
    { path: '/admin/lektionen', label: 'Lektionen' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#1a1a2e', fontFamily: 'system-ui, sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: '#16213e', borderRight: '1px solid #1a4a7a', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '1.5rem 1rem', borderBottom: '1px solid #1a4a7a' }}>
          <p style={{ color: '#e94560', fontWeight: 700, margin: 0, fontSize: '0.875rem' }}>FAHRSCHUL CLASSROOM</p>
          <p style={{ color: '#a8a8b3', margin: '0.25rem 0 0', fontSize: '0.75rem' }}>Admin-Panel</p>
        </div>
        <nav style={{ padding: '0.5rem 0', flex: 1 }}>
          {navItems.map(item => (
            <Link key={item.path} to={item.path} style={{
              display: 'block', padding: '0.75rem 1rem',
              color: location.pathname === item.path ? '#e2e2e2' : '#a8a8b3',
              background: location.pathname === item.path ? '#0f3460' : 'transparent',
              textDecoration: 'none', fontSize: '0.875rem',
              borderLeft: location.pathname === item.path ? '3px solid #e94560' : '3px solid transparent',
            }}>{item.label}</Link>
          ))}
        </nav>
        <div style={{ padding: '1rem', borderTop: '1px solid #1a4a7a' }}>
          <p style={{ color: '#a8a8b3', fontSize: '0.75rem', margin: '0 0 0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adminName}</p>
          <button onClick={logout} style={{ width: '100%', padding: '0.5rem', background: 'transparent', border: '1px solid #1a4a7a', color: '#a8a8b3', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}>
            Abmelden
          </button>
        </div>
      </div>
      {/* Main */}
      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  )
}
```

**AdminDashboard.tsx:**

```typescript
// frontend/src/modules/admin/AdminDashboard.tsx
import { useState, useEffect } from 'react'
import { AdminLayout } from './AdminLayout'
import { supabase } from '../../lib/supabase'

export function AdminDashboard() {
  const [stats, setStats] = useState({ lehrer: 0, schueler: 0, lektionen: 0 })

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const BACKEND = import.meta.env.VITE_BACKEND_URL || ''
      const res = await fetch(`${BACKEND}/api/admin/stats`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      if (res.ok) setStats(await res.json())
    }
    load()
  }, [])

  return (
    <AdminLayout>
      <h1 style={{ color: '#e2e2e2', margin: '0 0 2rem', fontSize: '1.5rem' }}>Dashboard</h1>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Lehrer', value: stats.lehrer, color: '#6366f1' },
          { label: 'Schüler', value: stats.schueler, color: '#4ade80' },
          { label: 'Lektionen', value: stats.lektionen, color: '#f59e0b' },
        ].map(card => (
          <div key={card.label} style={{ background: '#16213e', borderRadius: 12, padding: '1.5rem 2.5rem', border: `1px solid ${card.color}40`, minWidth: 160 }}>
            <p style={{ color: card.color, fontSize: '3rem', fontWeight: 700, margin: 0, lineHeight: 1 }}>{card.value}</p>
            <p style={{ color: '#a8a8b3', margin: '0.5rem 0 0', fontSize: '0.875rem' }}>{card.label}</p>
          </div>
        ))}
      </div>
    </AdminLayout>
  )
}
```

**Commit:**

```bash
git add frontend/src/modules/admin/AdminLayout.tsx frontend/src/modules/admin/AdminDashboard.tsx
git commit -m "feat: add admin layout with sidebar and dashboard"
```

---

## Task 7: Frontend — Admin Lehrer-Verwaltung

**Dateien:**
- Create: `frontend/src/modules/admin/AdminLehrer.tsx`

**Code:**

```typescript
// frontend/src/modules/admin/AdminLehrer.tsx
import { useState, useEffect } from 'react'
import { AdminLayout } from './AdminLayout'
import { supabase } from '../../lib/supabase'

interface Lehrer { id: string; full_name: string; email: string; is_admin: boolean; lesson_id: string | null; lesson_title: string | null }
interface Lektion { id: string; topic_number: number; title: string }

const BACKEND = () => import.meta.env.VITE_BACKEND_URL || ''
async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session!.access_token}` }
}

export function AdminLehrer() {
  const [lehrer, setLehrer] = useState<Lehrer[]>([])
  const [lektionen, setLektionen] = useState<Lektion[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ full_name: '', email: '', password: '', lesson_id: '', is_admin: false })
  const [error, setError] = useState('')

  async function load() {
    const headers = await authHeaders()
    const [lr, lk] = await Promise.all([
      fetch(`${BACKEND()}/api/admin/lehrer`, { headers }).then(r => r.json()),
      fetch(`${BACKEND()}/api/admin/lektionen`, { headers }).then(r => r.json()),
    ])
    setLehrer(lr)
    setLektionen(lk)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditId(null)
    setForm({ full_name: '', email: '', password: '', lesson_id: '', is_admin: false })
    setError('')
    setShowModal(true)
  }

  function openEdit(l: Lehrer) {
    setEditId(l.id)
    setForm({ full_name: l.full_name, email: l.email, password: '', lesson_id: l.lesson_id || '', is_admin: l.is_admin })
    setError('')
    setShowModal(true)
  }

  async function handleSave() {
    setError('')
    const headers = await authHeaders()
    const body = { ...form, lesson_id: form.lesson_id || null }

    const res = editId
      ? await fetch(`${BACKEND()}/api/admin/lehrer/${editId}`, { method: 'PUT', headers, body: JSON.stringify(body) })
      : await fetch(`${BACKEND()}/api/admin/lehrer`, { method: 'POST', headers, body: JSON.stringify(body) })

    if (!res.ok) { const d = await res.json(); setError(d.error || 'Fehler'); return }
    setShowModal(false)
    load()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`${name} wirklich löschen?`)) return
    const headers = await authHeaders()
    const res = await fetch(`${BACKEND()}/api/admin/lehrer/${id}`, { method: 'DELETE', headers })
    if (!res.ok) { const d = await res.json(); alert(d.error); return }
    load()
  }

  const inputStyle = { width: '100%', padding: '0.625rem', background: '#0f3460', border: '1px solid #1a4a7a', borderRadius: '6px', color: '#fff', fontSize: '0.875rem', boxSizing: 'border-box' as const }
  const labelStyle = { color: '#a8a8b3', fontSize: '0.75rem', display: 'block', marginBottom: '0.375rem' }

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ color: '#e2e2e2', margin: 0, fontSize: '1.5rem' }}>Lehrer</h1>
        <button onClick={openCreate} style={{ padding: '0.625rem 1.25rem', background: '#e94560', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
          + Neuer Lehrer
        </button>
      </div>

      <div style={{ background: '#16213e', borderRadius: 12, overflow: 'hidden', border: '1px solid #1a4a7a' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1a4a7a' }}>
              {['Name', 'E-Mail', 'Lektion', 'Admin', 'Aktionen'].map(h => (
                <th key={h} style={{ padding: '0.875rem 1rem', color: '#a8a8b3', fontSize: '0.75rem', textAlign: 'left', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lehrer.map(l => (
              <tr key={l.id} style={{ borderBottom: '1px solid #0f3460' }}>
                <td style={{ padding: '0.875rem 1rem', color: '#e2e2e2', fontSize: '0.875rem' }}>{l.full_name}</td>
                <td style={{ padding: '0.875rem 1rem', color: '#a8a8b3', fontSize: '0.875rem' }}>{l.email}</td>
                <td style={{ padding: '0.875rem 1rem', color: '#a8a8b3', fontSize: '0.875rem' }}>{l.lesson_title || '—'}</td>
                <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem' }}>
                  {l.is_admin ? <span style={{ color: '#f59e0b' }}>Admin</span> : <span style={{ color: '#555' }}>Lehrer</span>}
                </td>
                <td style={{ padding: '0.875rem 1rem' }}>
                  <button onClick={() => openEdit(l)} style={{ marginRight: '0.5rem', padding: '0.375rem 0.75rem', background: '#0f3460', color: '#a8a8b3', border: '1px solid #1a4a7a', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}>Bearbeiten</button>
                  <button onClick={() => handleDelete(l.id, l.full_name)} style={{ padding: '0.375rem 0.75rem', background: 'transparent', color: '#e94560', border: '1px solid #e9456040', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}>Löschen</button>
                </td>
              </tr>
            ))}
            {lehrer.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#555' }}>Noch keine Lehrer angelegt</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#16213e', padding: '2rem', borderRadius: 12, width: '100%', maxWidth: 480, border: '1px solid #1a4a7a', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ color: '#e2e2e2', margin: '0 0 1.5rem', fontSize: '1.25rem' }}>{editId ? 'Lehrer bearbeiten' : 'Neuer Lehrer'}</h2>

            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>NAME</label>
              <input style={inputStyle} value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Max Mustermann" />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>E-MAIL</label>
              <input style={inputStyle} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="lehrer@fahrschule.de" />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>{editId ? 'NEUES PASSWORT (leer = unverändert)' : 'PASSWORT'}</label>
              <input style={inputStyle} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>LEKTION ZUWEISEN</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.lesson_id} onChange={e => setForm(f => ({ ...f, lesson_id: e.target.value }))}>
                <option value="">— Keine Lektion —</option>
                {lektionen.map(l => <option key={l.id} value={l.id}>{l.topic_number}. {l.title}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" id="is_admin" checked={form.is_admin} onChange={e => setForm(f => ({ ...f, is_admin: e.target.checked }))} />
              <label htmlFor="is_admin" style={{ color: '#a8a8b3', fontSize: '0.875rem', cursor: 'pointer' }}>Admin-Rechte</label>
            </div>

            {error && <p style={{ color: '#e94560', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</p>}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '0.75rem', background: 'transparent', border: '1px solid #1a4a7a', color: '#a8a8b3', borderRadius: '8px', cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={handleSave} style={{ flex: 1, padding: '0.75rem', background: '#e94560', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Speichern</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
```

**Commit:**

```bash
git add frontend/src/modules/admin/AdminLehrer.tsx
git commit -m "feat: add admin teacher management page"
```

---

## Task 8: Frontend — Admin Schüler-Verwaltung

**Dateien:**
- Create: `frontend/src/modules/admin/AdminSchueler.tsx`

**Code:**

```typescript
// frontend/src/modules/admin/AdminSchueler.tsx
import { useState, useEffect } from 'react'
import { AdminLayout } from './AdminLayout'
import { supabase } from '../../lib/supabase'

interface Schueler { id: string; full_name: string; phone_number: string; is_active: boolean }

const BACKEND = () => import.meta.env.VITE_BACKEND_URL || ''
async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session!.access_token}` }
}

export function AdminSchueler() {
  const [schueler, setSchueler] = useState<Schueler[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ full_name: '', phone_number: '' })
  const [error, setError] = useState('')

  async function load() {
    const headers = await authHeaders()
    const data = await fetch(`${BACKEND()}/api/admin/schueler`, { headers }).then(r => r.json())
    setSchueler(data)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditId(null)
    setForm({ full_name: '', phone_number: '' })
    setError('')
    setShowModal(true)
  }

  function openEdit(s: Schueler) {
    setEditId(s.id)
    setForm({ full_name: s.full_name, phone_number: s.phone_number })
    setError('')
    setShowModal(true)
  }

  async function handleSave() {
    setError('')
    if (!form.full_name || !form.phone_number) { setError('Alle Felder ausfüllen'); return }
    const headers = await authHeaders()
    const res = editId
      ? await fetch(`${BACKEND()}/api/admin/schueler/${editId}`, { method: 'PUT', headers, body: JSON.stringify(form) })
      : await fetch(`${BACKEND()}/api/admin/schueler`, { method: 'POST', headers, body: JSON.stringify(form) })
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Fehler'); return }
    setShowModal(false)
    load()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`${name} wirklich löschen?`)) return
    const headers = await authHeaders()
    await fetch(`${BACKEND()}/api/admin/schueler/${id}`, { method: 'DELETE', headers })
    load()
  }

  const inputStyle = { width: '100%', padding: '0.625rem', background: '#0f3460', border: '1px solid #1a4a7a', borderRadius: '6px', color: '#fff', fontSize: '0.875rem', boxSizing: 'border-box' as const }

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ color: '#e2e2e2', margin: 0, fontSize: '1.5rem' }}>Schüler</h1>
        <button onClick={openCreate} style={{ padding: '0.625rem 1.25rem', background: '#e94560', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>+ Neuer Schüler</button>
      </div>

      <div style={{ background: '#16213e', borderRadius: 12, overflow: 'hidden', border: '1px solid #1a4a7a' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1a4a7a' }}>
              {['Name', 'Handynummer', 'Status', 'Aktionen'].map(h => (
                <th key={h} style={{ padding: '0.875rem 1rem', color: '#a8a8b3', fontSize: '0.75rem', textAlign: 'left', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schueler.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid #0f3460' }}>
                <td style={{ padding: '0.875rem 1rem', color: '#e2e2e2', fontSize: '0.875rem' }}>{s.full_name}</td>
                <td style={{ padding: '0.875rem 1rem', color: '#a8a8b3', fontSize: '0.875rem' }}>{s.phone_number}</td>
                <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem' }}>
                  <span style={{ color: s.is_active ? '#4ade80' : '#555' }}>{s.is_active ? 'Aktiv' : 'Inaktiv'}</span>
                </td>
                <td style={{ padding: '0.875rem 1rem' }}>
                  <button onClick={() => openEdit(s)} style={{ marginRight: '0.5rem', padding: '0.375rem 0.75rem', background: '#0f3460', color: '#a8a8b3', border: '1px solid #1a4a7a', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}>Bearbeiten</button>
                  <button onClick={() => handleDelete(s.id, s.full_name)} style={{ padding: '0.375rem 0.75rem', background: 'transparent', color: '#e94560', border: '1px solid #e9456040', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}>Löschen</button>
                </td>
              </tr>
            ))}
            {schueler.length === 0 && (
              <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#555' }}>Noch keine Schüler angelegt</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#16213e', padding: '2rem', borderRadius: 12, width: '100%', maxWidth: 440, border: '1px solid #1a4a7a' }}>
            <h2 style={{ color: '#e2e2e2', margin: '0 0 1.5rem', fontSize: '1.25rem' }}>{editId ? 'Schüler bearbeiten' : 'Neuer Schüler'}</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#a8a8b3', fontSize: '0.75rem', display: 'block', marginBottom: '0.375rem' }}>NAME</label>
              <input style={inputStyle} value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Max Mustermann" />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ color: '#a8a8b3', fontSize: '0.75rem', display: 'block', marginBottom: '0.375rem' }}>HANDYNUMMER</label>
              <input style={inputStyle} value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))} placeholder="+4915112345678" />
            </div>
            {error && <p style={{ color: '#e94560', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '0.75rem', background: 'transparent', border: '1px solid #1a4a7a', color: '#a8a8b3', borderRadius: '8px', cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={handleSave} style={{ flex: 1, padding: '0.75rem', background: '#e94560', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Speichern</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
```

**Commit:**

```bash
git add frontend/src/modules/admin/AdminSchueler.tsx
git commit -m "feat: add admin student management page"
```

---

## Task 9: Frontend — Admin Lektionen-Verwaltung

**Dateien:**
- Create: `frontend/src/modules/admin/AdminLektionen.tsx`

**Code:**

```typescript
// frontend/src/modules/admin/AdminLektionen.tsx
import { useState, useEffect } from 'react'
import { AdminLayout } from './AdminLayout'
import { supabase } from '../../lib/supabase'

interface Lektion { id: string; topic_number: number; title: string; status: string; room_code: string | null; assigned_teacher: string | null }
interface Lehrer { id: string; full_name: string }

const BACKEND = () => import.meta.env.VITE_BACKEND_URL || ''
async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session!.access_token}` }
}

export function AdminLektionen() {
  const [lektionen, setLektionen] = useState<Lektion[]>([])
  const [lehrer, setLehrer] = useState<Lehrer[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ topic_number: '', title: '', teacher_id: '' })
  const [error, setError] = useState('')

  async function load() {
    const headers = await authHeaders()
    const [lk, lr] = await Promise.all([
      fetch(`${BACKEND()}/api/admin/lektionen`, { headers }).then(r => r.json()),
      fetch(`${BACKEND()}/api/admin/lehrer`, { headers }).then(r => r.json()),
    ])
    setLektionen(lk)
    setLehrer(lr.filter((l: any) => !l.is_admin))
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditId(null)
    setForm({ topic_number: '', title: '', teacher_id: '' })
    setError('')
    setShowModal(true)
  }

  function openEdit(l: Lektion) {
    setEditId(l.id)
    const assignedLehrer = lehrer.find(lr => lr.full_name === l.assigned_teacher)
    setForm({ topic_number: String(l.topic_number), title: l.title, teacher_id: assignedLehrer?.id || '' })
    setError('')
    setShowModal(true)
  }

  async function handleSave() {
    setError('')
    if (!form.topic_number || !form.title) { setError('Nummer und Titel erforderlich'); return }
    const headers = await authHeaders()
    const body = { topic_number: Number(form.topic_number), title: form.title, teacher_id: form.teacher_id || null }
    const res = editId
      ? await fetch(`${BACKEND()}/api/admin/lektionen/${editId}`, { method: 'PUT', headers, body: JSON.stringify(body) })
      : await fetch(`${BACKEND()}/api/admin/lektionen`, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Fehler'); return }
    setShowModal(false)
    load()
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Lektion "${title}" wirklich löschen?`)) return
    const headers = await authHeaders()
    await fetch(`${BACKEND()}/api/admin/lektionen/${id}`, { method: 'DELETE', headers })
    load()
  }

  const inputStyle = { width: '100%', padding: '0.625rem', background: '#0f3460', border: '1px solid #1a4a7a', borderRadius: '6px', color: '#fff', fontSize: '0.875rem', boxSizing: 'border-box' as const }

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ color: '#e2e2e2', margin: 0, fontSize: '1.5rem' }}>Lektionen</h1>
        <button onClick={openCreate} style={{ padding: '0.625rem 1.25rem', background: '#e94560', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>+ Neue Lektion</button>
      </div>

      <div style={{ background: '#16213e', borderRadius: 12, overflow: 'hidden', border: '1px solid #1a4a7a' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1a4a7a' }}>
              {['Nr.', 'Titel', 'Lehrer', 'Status', 'Aktionen'].map(h => (
                <th key={h} style={{ padding: '0.875rem 1rem', color: '#a8a8b3', fontSize: '0.75rem', textAlign: 'left', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lektionen.map(l => (
              <tr key={l.id} style={{ borderBottom: '1px solid #0f3460' }}>
                <td style={{ padding: '0.875rem 1rem', color: '#e94560', fontSize: '0.875rem', fontWeight: 700 }}>{l.topic_number}</td>
                <td style={{ padding: '0.875rem 1rem', color: '#e2e2e2', fontSize: '0.875rem' }}>{l.title}</td>
                <td style={{ padding: '0.875rem 1rem', color: '#a8a8b3', fontSize: '0.875rem' }}>{l.assigned_teacher || '—'}</td>
                <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem' }}>
                  <span style={{ color: l.status === 'aktiv' ? '#4ade80' : '#a8a8b3' }}>{l.status}</span>
                </td>
                <td style={{ padding: '0.875rem 1rem' }}>
                  <button onClick={() => openEdit(l)} style={{ marginRight: '0.5rem', padding: '0.375rem 0.75rem', background: '#0f3460', color: '#a8a8b3', border: '1px solid #1a4a7a', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}>Bearbeiten</button>
                  <button onClick={() => handleDelete(l.id, l.title)} style={{ padding: '0.375rem 0.75rem', background: 'transparent', color: '#e94560', border: '1px solid #e9456040', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}>Löschen</button>
                </td>
              </tr>
            ))}
            {lektionen.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#555' }}>Noch keine Lektionen angelegt</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#16213e', padding: '2rem', borderRadius: 12, width: '100%', maxWidth: 440, border: '1px solid #1a4a7a' }}>
            <h2 style={{ color: '#e2e2e2', margin: '0 0 1.5rem', fontSize: '1.25rem' }}>{editId ? 'Lektion bearbeiten' : 'Neue Lektion'}</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#a8a8b3', fontSize: '0.75rem', display: 'block', marginBottom: '0.375rem' }}>NUMMER</label>
              <input style={inputStyle} type="number" value={form.topic_number} onChange={e => setForm(f => ({ ...f, topic_number: e.target.value }))} placeholder="1" min="1" />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#a8a8b3', fontSize: '0.75rem', display: 'block', marginBottom: '0.375rem' }}>TITEL</label>
              <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Grundregeln im Straßenverkehr" />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ color: '#a8a8b3', fontSize: '0.75rem', display: 'block', marginBottom: '0.375rem' }}>LEHRER ZUWEISEN</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.teacher_id} onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))}>
                <option value="">— Kein Lehrer —</option>
                {lehrer.map(l => <option key={l.id} value={l.id}>{l.full_name}</option>)}
              </select>
            </div>
            {error && <p style={{ color: '#e94560', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '0.75rem', background: 'transparent', border: '1px solid #1a4a7a', color: '#a8a8b3', borderRadius: '8px', cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={handleSave} style={{ flex: 1, padding: '0.75rem', background: '#e94560', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Speichern</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
```

**Commit:**

```bash
git add frontend/src/modules/admin/AdminLektionen.tsx
git commit -m "feat: add admin lesson management page"
```

---

## Task 10: Frontend — App.tsx aktualisieren

**Dateien:**
- Modify: `frontend/src/App.tsx`

**Komplette neue Datei:**

```typescript
// frontend/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './modules/auth/LoginPage'
import { StaffLoginPage } from './modules/auth/StaffLoginPage'
import { LobbyPage } from './modules/lobby/LobbyPage'
import { StudentRoom } from './modules/jitsi/StudentRoom'
import { TeacherDashboard } from './modules/teacher/TeacherDashboard'
import { TeacherStartPage } from './modules/teacher/TeacherStartPage'
import { AdminDashboard } from './modules/admin/AdminDashboard'
import { AdminLehrer } from './modules/admin/AdminLehrer'
import { AdminSchueler } from './modules/admin/AdminSchueler'
import { AdminLektionen } from './modules/admin/AdminLektionen'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Schüler */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/raum" element={<StudentRoom />} />

        {/* Staff Login (einheitlich) */}
        <Route path="/login" element={<StaffLoginPage />} />
        <Route path="/lehrer-login" element={<Navigate to="/login" replace />} />

        {/* Lehrer */}
        <Route path="/lehrer-start" element={<TeacherStartPage />} />
        <Route path="/lehrer" element={<TeacherDashboard />} />

        {/* Admin */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/lehrer" element={<AdminLehrer />} />
        <Route path="/admin/schueler" element={<AdminSchueler />} />
        <Route path="/admin/lektionen" element={<AdminLektionen />} />
      </Routes>
    </BrowserRouter>
  )
}
```

**Commit:**

```bash
git add frontend/src/App.tsx
git commit -m "feat: add admin routes and unified login to App.tsx"
```

---

## Task 11: Deploy + Erster Admin anlegen

**Schritt 1: Pushen**

```bash
git push
```

**Schritt 2: Warten bis Dokploy deployed** (~2-3 Minuten, Autodeploy aktiv)

**Schritt 3: DB-Migration ausführen** (Supabase Studio → SQL Editor)

```sql
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
```

**Schritt 4: Ersten Admin anlegen** (Supabase Studio → SQL Editor)

```sql
-- Bestehenden Lehrer zum Admin machen
UPDATE teachers SET is_admin = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'lehrer@test.de');
```

Oder neuen Admin anlegen: Supabase Studio → Authentication → Users → "Add user" mit E-Mail + Passwort, dann:

```sql
INSERT INTO teachers (id, full_name, is_admin)
SELECT id, 'Admin', true FROM auth.users WHERE email = 'admin@fahrschule.de';
```

**Schritt 5: Vollständigen Flow testen**

1. `http://frontend.178.104.27.147.traefik.me/login` öffnen
2. Mit Admin-Account einloggen → landet auf `/admin`
3. Lektion anlegen unter `/admin/lektionen`
4. Lehrer anlegen unter `/admin/lehrer` + Lektion zuweisen
5. Schüler anlegen unter `/admin/schueler`
6. Mit Lehrer-Account einloggen → landet auf `/lehrer-start`
7. Code generieren → Schüler-Login testen

**Schritt 6: `/lehrer-login` Redirect testen**

`http://frontend.178.104.27.147.traefik.me/lehrer-login` → muss zu `/login` redirecten ✓
