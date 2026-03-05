# Teacher Auth & UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Lehrer können sich mit E-Mail + Passwort (Supabase Auth) einloggen, Raum-Code per Button generieren und direkt ins Dashboard einsteigen — alle Lehrer-Seiten sind passwortgeschützt.

**Architecture:** Supabase Auth verwaltet Lehrer-Accounts. Das Frontend nutzt den Supabase-Session-Token direkt (kein extra Backend-JWT für Lehrer). Eine `teachers`-Tabelle verknüpft `auth.uid()` mit einer Lektion. `/lehrer-login` → `/lehrer-start` → `/lehrer` ist der vollständige Lehrer-Flow. Auth-Guards auf `/lehrer-start` und `/lehrer` redirecten zu `/lehrer-login` wenn keine Session existiert.

**Tech Stack:** React + Vite, TypeScript, Supabase JS (Frontend Auth), Express + Socket.io (Backend), PostgreSQL (Supabase)

---

## Kontext (für den Implementierer)

### Bestehende Dateistruktur

```
frontend/src/
  App.tsx                          ← Router — hier neue Routen eintragen
  lib/supabase.ts                  ← createClient mit VITE_SUPABASE_URL + ANON_KEY
  modules/
    auth/
      LoginPage.tsx                ← Schüler-Login (NICHT anfassen)
      useAuth.ts                   ← Schüler-Login-Hook (NICHT anfassen)
    teacher/
      TeacherDashboard.tsx         ← Lehrer-Dashboard (Auth-Guard hinzufügen)
      TeacherControls.tsx          ← (NICHT anfassen)
      StudentList.tsx              ← (NICHT anfassen)

backend/src/
  modules/auth/
    auth.routes.ts                 ← POST /login + POST /room-code
    auth.service.ts                ← loginStudent(), generateRoomCode()
    auth.types.ts                  ← LoginRequest, LoginResponse
```

### Wichtige Konventionen

- Supabase-Queries immer mit `(supabase as any).from(...)` (TypeScript-Workaround)
- Lehrer-Session im `localStorage` als `teacher_session` (Supabase Session JSON)
- Lehrer-Lektion im `localStorage` als `classroom_lesson` (bereits vorhanden für TeacherDashboard)
- Inline-Styles überall (kein CSS, kein Tailwind) — Farbschema: `#1a1a2e` bg, `#16213e` card, `#0f3460` input, `#e94560` primary, `#a8a8b3` text-muted

### Supabase Auth in der Frontend-App

```typescript
import { supabase } from '../../lib/supabase'

// Login
const { data, error } = await supabase.auth.signInWithPassword({ email, password })
// data.session enthält access_token, user etc.

// Session abrufen
const { data: { session } } = await supabase.auth.getSession()

// Logout
await supabase.auth.signOut()
```

---

## Task 1: Datenbank — `teachers` Tabelle

**Ziel:** Eine Tabelle anlegen die Supabase-User (Lehrer) mit ihren Lektionen verknüpft.

**Dateien:**
- Create: `supabase/migrations/003_teachers.sql`

**Schritt 1: SQL-Datei erstellen**

```sql
-- supabase/migrations/003_teachers.sql

CREATE TABLE IF NOT EXISTS teachers (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Schritt 2: Migration in Supabase ausführen**

Im Supabase Studio → SQL Editor → Inhalt der Datei einfügen und ausführen.

Erwartetes Ergebnis: Tabelle `teachers` ist angelegt, kein Fehler.

**Schritt 3: Test-Lehrer anlegen**

Im Supabase Studio:
1. Authentication → Users → "Invite user" oder "Add user"
2. E-Mail: `lehrer@test.de`, Passwort: `test1234`
3. Danach in SQL Editor:
```sql
-- UUID des gerade angelegten Users einfügen
INSERT INTO teachers (id, full_name, lesson_id)
SELECT id, 'Max Lehrer', (SELECT id FROM lessons LIMIT 1)
FROM auth.users WHERE email = 'lehrer@test.de';
```

**Schritt 4: Commit**

```bash
git add supabase/migrations/003_teachers.sql
git commit -m "feat: add teachers table migration"
```

---

## Task 2: Backend — `/api/auth/room-code` mit Auth schützen

**Ziel:** Der `/room-code` Endpunkt soll nur für authentifizierte Lehrer zugänglich sein (Supabase Access Token im Authorization-Header).

**Dateien:**
- Create: `backend/src/middleware/teacherAuth.ts`
- Modify: `backend/src/modules/auth/auth.routes.ts`

**Schritt 1: Middleware erstellen**

```typescript
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
```

**Schritt 2: Route schützen**

```typescript
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

// GEÄNDERT: Jetzt mit requireTeacher geschützt
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
```

**Schritt 3: Manuell testen**

```bash
# Ohne Token → 401
curl -X POST http://backend.178.104.27.147.traefik.me/api/auth/room-code \
  -H "Content-Type: application/json" \
  -d '{"lesson_id": "test"}'
# Erwartet: {"error":"Kein Token"}
```

**Schritt 4: Commit**

```bash
git add backend/src/middleware/teacherAuth.ts backend/src/modules/auth/auth.routes.ts
git commit -m "feat: protect room-code endpoint with teacher auth"
```

---

## Task 3: Frontend — `/lehrer-login` Seite

**Ziel:** Eine Login-Seite mit E-Mail + Passwort, die Supabase Auth nutzt und bei Erfolg zu `/lehrer-start` weiterleitet. Bei bereits eingeloggtem Lehrer direkt weiterleiten.

**Dateien:**
- Create: `frontend/src/modules/auth/TeacherLoginPage.tsx`

**Code:**

```typescript
// frontend/src/modules/auth/TeacherLoginPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export function TeacherLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  // Bereits eingeloggt? Direkt weiter
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/lehrer-start')
      else setLoading(false)
    })
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

    // Prüfen ob User ein Lehrer ist (teachers-Tabelle)
    const { data: teacher } = await (supabase as any)
      .from('teachers')
      .select('id')
      .eq('id', data.session.user.id)
      .single()

    if (!teacher) {
      await supabase.auth.signOut()
      setError('Kein Lehrer-Account für diese E-Mail')
      setLoading(false)
      return
    }

    navigate('/lehrer-start')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e' }}>
      <p style={{ color: '#a8a8b3' }}>Bitte warten...</p>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#1a1a2e', fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        background: '#16213e', padding: '2rem', borderRadius: '12px',
        width: '100%', maxWidth: '360px', boxShadow: '0 4px 24px rgba(0,0,0,0.4)'
      }}>
        <h1 style={{ color: '#e94560', marginBottom: '0.25rem', fontSize: '1.5rem' }}>
          Lehrer-Login
        </h1>
        <p style={{ color: '#a8a8b3', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          Fahrschul Classroom — Lehrerbereich
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ color: '#a8a8b3', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>
              E-MAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="lehrer@fahrschule.de"
              required
              style={{
                width: '100%', padding: '0.75rem', background: '#0f3460',
                border: '1px solid #1a4a7a', borderRadius: '8px',
                color: '#fff', fontSize: '1rem', boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ color: '#a8a8b3', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>
              PASSWORT
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%', padding: '0.75rem', background: '#0f3460',
                border: '1px solid #1a4a7a', borderRadius: '8px',
                color: '#fff', fontSize: '1rem', boxSizing: 'border-box'
              }}
            />
          </div>

          {error && (
            <p style={{ color: '#e94560', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '0.875rem',
              background: loading ? '#555' : '#e94560',
              color: '#fff', border: 'none', borderRadius: '8px',
              fontSize: '1rem', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Bitte warten...' : 'Einloggen'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

**Schritt 2: Commit**

```bash
git add frontend/src/modules/auth/TeacherLoginPage.tsx
git commit -m "feat: add teacher login page with supabase auth"
```

---

## Task 4: Frontend — `/lehrer-start` Seite

**Ziel:** Nach dem Login sieht der Lehrer seine Lektion, kann den Raum-Code generieren und den Unterricht starten. Bei nicht eingeloggtem User: redirect zu `/lehrer-login`.

**Dateien:**
- Create: `frontend/src/modules/teacher/TeacherStartPage.tsx`

**Code:**

```typescript
// frontend/src/modules/teacher/TeacherStartPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

interface Lesson {
  id: string
  topic_number: number
  title: string
  room_code: string | null
}

interface Teacher {
  full_name: string
  lesson_id: string
}

export function TeacherStartPage() {
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [teacherName, setTeacherName] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    async function loadData() {
      // Auth-Guard: Session prüfen
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        navigate('/lehrer-login')
        return
      }

      // Lehrer-Daten laden
      const { data: teacher } = await (supabase as any)
        .from('teachers')
        .select('full_name, lesson_id')
        .eq('id', session.user.id)
        .single() as { data: Teacher | null }

      if (!teacher) {
        await supabase.auth.signOut()
        navigate('/lehrer-login')
        return
      }

      setTeacherName(teacher.full_name)

      // Lektion laden
      const { data: lessonData } = await (supabase as any)
        .from('lessons')
        .select('id, topic_number, title, room_code')
        .eq('id', teacher.lesson_id)
        .single() as { data: Lesson | null }

      setLesson(lessonData)
      setLoading(false)
    }

    loadData()
  }, [navigate])

  async function generateCode() {
    if (!lesson) return
    setGenerating(true)
    setError('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { navigate('/lehrer-login'); return }

    const backendUrl = import.meta.env.VITE_BACKEND_URL || ''
    const res = await fetch(`${backendUrl}/api/auth/room-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ lesson_id: lesson.id })
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Fehler beim Generieren')
    } else {
      const data = await res.json()
      setLesson(prev => prev ? { ...prev, room_code: data.code } : prev)
    }

    setGenerating(false)
  }

  async function startLesson() {
    if (!lesson) return

    // Lektionsdaten für TeacherDashboard in localStorage setzen
    localStorage.setItem('classroom_lesson', JSON.stringify({
      id: lesson.id,
      topic_number: lesson.topic_number,
      title: lesson.title,
      room_code: lesson.room_code,
      jitsi_room: lesson.id
    }))
    localStorage.setItem('classroom_token', '') // Lehrer braucht keinen Student-Token

    navigate('/lehrer')
  }

  async function logout() {
    await supabase.auth.signOut()
    navigate('/lehrer-login')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e' }}>
      <p style={{ color: '#a8a8b3' }}>Lädt...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a2e', fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', maxWidth: 600, margin: '0 auto 2rem' }}>
        <div>
          <h1 style={{ color: '#e94560', fontSize: '1.5rem', margin: 0 }}>Fahrschul Classroom</h1>
          <p style={{ color: '#a8a8b3', margin: '0.25rem 0 0', fontSize: '0.875rem' }}>Willkommen, {teacherName}</p>
        </div>
        <button
          onClick={logout}
          style={{
            background: 'transparent', border: '1px solid #1a4a7a',
            color: '#a8a8b3', padding: '0.5rem 1rem', borderRadius: '8px',
            cursor: 'pointer', fontSize: '0.875rem'
          }}
        >
          Abmelden
        </button>
      </div>

      {/* Lektion Card */}
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        {!lesson ? (
          <div style={{ background: '#16213e', borderRadius: 12, padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: '#a8a8b3' }}>Keine Lektion zugewiesen. Bitte Administrator kontaktieren.</p>
          </div>
        ) : (
          <div style={{ background: '#16213e', borderRadius: 12, padding: '1.5rem', border: '1px solid #1a4a7a' }}>
            <p style={{ color: '#a8a8b3', fontSize: '0.75rem', margin: '0 0 0.25rem', textTransform: 'uppercase' }}>
              Lektion {lesson.topic_number}
            </p>
            <h2 style={{ color: '#e2e2e2', margin: '0 0 1.5rem', fontSize: '1.25rem' }}>{lesson.title}</h2>

            {/* Raum-Code Anzeige */}
            <div style={{
              background: '#0f3460', borderRadius: 10, padding: '1rem',
              textAlign: 'center', marginBottom: '1rem'
            }}>
              <p style={{ color: '#a8a8b3', fontSize: '0.75rem', margin: '0 0 0.5rem' }}>RAUM-CODE FÜR SCHÜLER</p>
              {lesson.room_code ? (
                <p style={{ color: '#4ade80', fontSize: '2.5rem', fontWeight: 700, letterSpacing: '0.4rem', margin: 0 }}>
                  {lesson.room_code}
                </p>
              ) : (
                <p style={{ color: '#555', fontSize: '1.25rem', margin: 0 }}>— noch kein Code —</p>
              )}
            </div>

            {error && (
              <p style={{ color: '#e94560', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>
            )}

            {/* Buttons */}
            <button
              onClick={generateCode}
              disabled={generating}
              style={{
                width: '100%', padding: '0.875rem', marginBottom: '0.75rem',
                background: generating ? '#555' : '#f59e0b',
                color: '#fff', border: 'none', borderRadius: '8px',
                fontSize: '1rem', fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer'
              }}
            >
              {generating ? 'Generiere...' : lesson.room_code ? '🔄 Neuen Code generieren' : '🔑 Code generieren'}
            </button>

            <button
              onClick={startLesson}
              disabled={!lesson.room_code}
              style={{
                width: '100%', padding: '0.875rem',
                background: lesson.room_code ? '#e94560' : '#333',
                color: '#fff', border: 'none', borderRadius: '8px',
                fontSize: '1rem', fontWeight: 600,
                cursor: lesson.room_code ? 'pointer' : 'not-allowed',
                opacity: lesson.room_code ? 1 : 0.6
              }}
            >
              {lesson.room_code ? '▶ Unterricht starten' : 'Zuerst Code generieren'}
            </button>

            {lesson.room_code && (
              <p style={{ color: '#a8a8b3', fontSize: '0.75rem', textAlign: 'center', marginTop: '0.75rem' }}>
                Schüler öffnen: frontend.178.104.27.147.traefik.me
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

**Schritt 2: Commit**

```bash
git add frontend/src/modules/teacher/TeacherStartPage.tsx
git commit -m "feat: add teacher start page with lesson overview and code generation"
```

---

## Task 5: Frontend — Auth-Guard auf `/lehrer` + App.tsx Routing

**Ziel:** Das TeacherDashboard prüft beim Laden ob eine Lehrer-Session existiert. App.tsx bekommt die zwei neuen Routen.

**Dateien:**
- Modify: `frontend/src/modules/teacher/TeacherDashboard.tsx` (Auth-Guard vorne einfügen)
- Modify: `frontend/src/App.tsx` (neue Routen)

**Schritt 1: Auth-Guard in TeacherDashboard**

Ganz oben in `TeacherDashboard()` vor dem return, direkt nach den bestehenden `const`-Zeilen einfügen:

```typescript
// frontend/src/modules/teacher/TeacherDashboard.tsx
// KOMPLETTE DATEI — Auth-Guard ergänzt

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useJitsi } from '../jitsi/useJitsi'
import { DrawingCanvas } from '../canvas/DrawingCanvas'
import { StudentList } from './StudentList'
import { TeacherControls } from './TeacherControls'
import { getSocket } from '../../lib/socket'
import { supabase } from '../../lib/supabase'

export function TeacherDashboard() {
  const [canvasActive, setCanvasActive] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const navigate = useNavigate()

  const token = localStorage.getItem('classroom_token') || ''
  const lesson = JSON.parse(localStorage.getItem('classroom_lesson') || '{}')
  const socket = token && lesson.id ? getSocket(token, lesson.id) : null

  // Auth-Guard
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/lehrer-login')
      } else if (!lesson.id) {
        navigate('/lehrer-start')
      } else {
        setAuthChecked(true)
      }
    })
  }, [navigate])

  const { muteAll, shareScreen } = useJitsi('jitsi-teacher-container', {
    room: lesson.jitsi_room || lesson.id || 'teacher-room',
    displayName: 'Lehrer',
    isTeacher: true
  })

  function startCheck() {
    socket?.emit('attendance:start')
  }

  function grantMic(studentId: string) {
    socket?.emit('mic:grant', { target_student_id: studentId })
  }

  if (!authChecked) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e' }}>
      <p style={{ color: '#a8a8b3' }}>Prüfe Authentifizierung...</p>
    </div>
  )

  return (
    <div style={{
      display: 'flex', width: '100vw', height: '100vh',
      background: '#1a1a2e', fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <div id="jitsi-teacher-container" style={{ width: '100%', height: '100%' }} />
        <DrawingCanvas socket={socket} isTeacher={true} active={canvasActive} />
      </div>

      <div style={{
        width: 280, background: '#16213e', overflowY: 'auto',
        borderLeft: '1px solid #1a4a7a', display: 'flex', flexDirection: 'column'
      }}>
        <TeacherControls
          roomCode={lesson.room_code || ''}
          canvasActive={canvasActive}
          onStartCheck={startCheck}
          onMuteAll={muteAll}
          onShareScreen={shareScreen}
          onToggleCanvas={() => setCanvasActive(a => !a)}
        />
        <StudentList socket={socket} onGrantMic={grantMic} />
      </div>
    </div>
  )
}
```

**Schritt 2: App.tsx — neue Routen**

```typescript
// frontend/src/App.tsx — KOMPLETTE DATEI

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LoginPage } from './modules/auth/LoginPage'
import { TeacherLoginPage } from './modules/auth/TeacherLoginPage'
import { LobbyPage } from './modules/lobby/LobbyPage'
import { StudentRoom } from './modules/jitsi/StudentRoom'
import { TeacherDashboard } from './modules/teacher/TeacherDashboard'
import { TeacherStartPage } from './modules/teacher/TeacherStartPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Schüler */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/raum" element={<StudentRoom />} />

        {/* Lehrer */}
        <Route path="/lehrer-login" element={<TeacherLoginPage />} />
        <Route path="/lehrer-start" element={<TeacherStartPage />} />
        <Route path="/lehrer" element={<TeacherDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}
```

**Schritt 3: Commit**

```bash
git add frontend/src/App.tsx frontend/src/modules/teacher/TeacherDashboard.tsx
git commit -m "feat: add auth guards and routing for teacher pages"
```

---

## Task 6: Deployen und testen

**Schritt 1: Alle Änderungen pushen**

```bash
git push
```

**Schritt 2: Warten bis Dokploy deployed hat** (Autodeploy ist aktiv, ~2-3 Minuten)

**Schritt 3: Vollständigen Flow testen**

1. Öffne `http://frontend.178.104.27.147.traefik.me/lehrer-login`
2. Direkt `/lehrer` aufrufen → muss zu `/lehrer-login` redirecten ✓
3. Mit falschen Daten einloggen → Fehlermeldung erscheint ✓
4. Mit `lehrer@test.de` / `test1234` einloggen → weiterleitung zu `/lehrer-start` ✓
5. "Code generieren" klicken → grüner Code erscheint ✓
6. "Unterricht starten" → weiterleitung zu `/lehrer` mit Jitsi ✓
7. "Abmelden" → zurück zu `/lehrer-login` ✓
8. Schüler-Flow testen: `http://frontend.178.104.27.147.traefik.me/` mit Handynummer + Code ✓

**Schritt 4: Endgültiger Commit**

```bash
git add -A
git commit -m "feat: complete teacher auth flow"
git push
```
