# Fahrschul Classroom — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Live-Classroom-System für Fahrschul-Theorie-Unterricht mit Schüler-PWA, Lehrer-Dashboard, Jitsi-Video, Echtzeit-Zeichnungen und Präsenz-Checks.

**Architecture:** Getrennte Services — React PWA (Vite) als Frontend, Node.js + Express + Socket.io als Backend. Bestehende self-hosted Supabase für DB + Storage. Eigener Jitsi auf Dokploy.

**Tech Stack:** React 18, Vite, TypeScript, Node.js, Express, Socket.io, Supabase JS, JWT, Jitsi IFrame API, HTML5 Canvas

---

## Phase 1: Projekt-Setup

### Task 1: Repo-Struktur anlegen

**Files:**
- Create: `backend/package.json`
- Create: `frontend/package.json`
- Create: `.gitignore`
- Create: `README.md`

**Step 1: Verzeichnisse anlegen**
```bash
cd /c/APK/fahrschul-classroom
mkdir -p backend/src/{modules/{auth,rooms,attendance,media,jitsi},socket/handlers,lib}
mkdir -p frontend/src/{modules/{auth,lobby,jitsi,canvas,attendance,hand-raise,media,schedule,teacher},components,hooks,lib}
```

**Step 2: Backend initialisieren**
```bash
cd /c/APK/fahrschul-classroom/backend
npm init -y
npm install express socket.io @supabase/supabase-js jsonwebtoken cors dotenv
npm install -D typescript @types/node @types/express @types/jsonwebtoken tsx nodemon
npx tsc --init
```

**Step 3: Frontend initialisieren**
```bash
cd /c/APK/fahrschul-classroom/frontend
npm create vite@latest . -- --template react-ts
npm install
npm install @supabase/supabase-js socket.io-client react-router-dom
```

**Step 4: .gitignore erstellen**
```
node_modules/
dist/
.env
.env.local
*.env
```

**Step 5: Commit**
```bash
cd /c/APK/fahrschul-classroom
git init
git add .
git commit -m "feat: initial project structure"
```

---

### Task 2: Environment-Konfiguration

**Files:**
- Create: `backend/.env.example`
- Create: `frontend/.env.example`

**Step 1: Backend .env.example**
```env
PORT=3002
SUPABASE_URL=http://fuehrerscheinfragenapp-supabase-0875b6-178-104-27-147.traefik.me
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret-min-32-chars
JITSI_APP_ID=fahrschul-classroom
JITSI_SECRET=your-jitsi-secret
FRONTEND_URL=http://localhost:5173
```

**Step 2: Frontend .env.example**
```env
VITE_SUPABASE_URL=http://fuehrerscheinfragenapp-supabase-0875b6-178-104-27-147.traefik.me
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_BACKEND_URL=http://localhost:3002
VITE_JITSI_DOMAIN=your-jitsi-domain
```

**Step 3: Lokale .env Dateien anlegen (aus .env.example kopieren)**
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

**Step 4: Commit**
```bash
git add backend/.env.example frontend/.env.example
git commit -m "feat: add environment configuration"
```

---

## Phase 2: Datenbank-Schema

### Task 3: Supabase Migrations anlegen

**Files:**
- Create: `supabase/migrations/003_classroom.sql`

**Step 1: Migration-Datei schreiben**
```sql
-- ============================================
-- Classroom-System Tabellen
-- ============================================

-- Schüler (verknüpft mit fahrschueler-Tabelle)
create table if not exists students (
  id uuid primary key default uuid_generate_v4(),
  phone_number varchar(20) not null unique,
  full_name varchar(255) not null,
  fahrschueler_id uuid references fahrschueler(id),
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Lektionen
create table if not exists lessons (
  id uuid primary key default uuid_generate_v4(),
  unternehmen_id uuid references unternehmen(id) on delete cascade not null,
  topic_number integer not null,
  title varchar(255) not null,
  start_time timestamptz,
  room_code varchar(6),
  jitsi_room varchar(255),
  status varchar(20) default 'geplant', -- geplant | aktiv | beendet
  created_at timestamptz default now()
);

-- Aktive Raum-Codes (kurzlebig)
create table if not exists active_codes (
  id uuid primary key default uuid_generate_v4(),
  room_code varchar(6) not null unique,
  lesson_id uuid references lessons(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- Anwesenheits-Logs
create table if not exists attendance_logs (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) not null,
  lesson_id uuid references lessons(id) not null,
  joined_at timestamptz default now(),
  checks_total integer default 0,
  checks_confirmed integer default 0,
  status varchar(20) default 'ausstehend', -- ausstehend | bestanden | nicht_bestanden
  unique(student_id, lesson_id)
);

-- RLS aktivieren
alter table students enable row level security;
alter table lessons enable row level security;
alter table attendance_logs enable row level security;
alter table active_codes enable row level security;

-- Indexes für Performance
create index idx_active_codes_room_code on active_codes(room_code);
create index idx_attendance_logs_lesson on attendance_logs(lesson_id);
create index idx_students_phone on students(phone_number);
```

**Step 2: Migration in Supabase Studio ausführen**
- Supabase Studio öffnen: `http://fuehrerscheinfragenapp-supabase-0875b6-178-104-27-147.traefik.me`
- SQL Editor → Migration-SQL einkopieren → Run

**Step 3: Commit**
```bash
git add supabase/
git commit -m "feat: add classroom database schema"
```

---

## Phase 3: Backend — Core

### Task 4: Supabase & Express Grundgerüst

**Files:**
- Create: `backend/src/lib/supabase.ts`
- Create: `backend/src/lib/db.ts`
- Create: `backend/src/index.ts`

**Step 1: Supabase Client**
```typescript
// backend/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

**Step 2: Express Server**
```typescript
// backend/src/index.ts
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'
dotenv.config()

const app = express()
const httpServer = createServer(app)

export const io = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL, credentials: true }
})

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }))
app.use(express.json())

// Routes
import authRouter from './modules/auth/auth.routes'
import roomsRouter from './modules/rooms/rooms.routes'
import mediaRouter from './modules/media/media.routes'

app.use('/api/auth', authRouter)
app.use('/api/rooms', roomsRouter)
app.use('/api/media', mediaRouter)

// Socket.io
import { registerSocketHandlers } from './socket/index'
registerSocketHandlers(io)

const PORT = process.env.PORT || 3002
httpServer.listen(PORT, () => console.log(`Backend läuft auf Port ${PORT}`))
```

**Step 3: package.json scripts ergänzen**
```json
{
  "scripts": {
    "dev": "nodemon --exec tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

**Step 4: Backend starten und testen**
```bash
cd backend && npm run dev
# Erwartung: "Backend läuft auf Port 3002"
```

**Step 5: Commit**
```bash
git add backend/src/
git commit -m "feat: express + socket.io server setup"
```

---

### Task 5: Auth-Modul (Raum-Code)

**Files:**
- Create: `backend/src/modules/auth/auth.service.ts`
- Create: `backend/src/modules/auth/auth.routes.ts`
- Create: `backend/src/modules/auth/auth.types.ts`

**Step 1: Types**
```typescript
// backend/src/modules/auth/auth.types.ts
export interface LoginRequest {
  phone_number: string
  room_code: string
}

export interface LoginResponse {
  token: string
  student: { id: string; full_name: string }
  lesson: { id: string; topic_number: number; title: string }
}
```

**Step 2: Auth Service**
```typescript
// backend/src/modules/auth/auth.service.ts
import { supabase } from '../../lib/supabase'
import jwt from 'jsonwebtoken'
import { LoginRequest, LoginResponse } from './auth.types'

export async function loginStudent(data: LoginRequest): Promise<LoginResponse> {
  // 1. Code prüfen
  const { data: code } = await supabase
    .from('active_codes')
    .select('*, lessons(*)')
    .eq('room_code', data.room_code)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!code) throw new Error('Ungültiger oder abgelaufener Code')

  // 2. Schüler prüfen
  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('phone_number', data.phone_number)
    .eq('is_active', true)
    .single()

  if (!student) throw new Error('Handynummer nicht registriert')

  // 3. Attendance Log anlegen
  await supabase.from('attendance_logs').upsert({
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

  return { token, student, lesson: code.lessons }
}

export async function generateRoomCode(lesson_id: string): Promise<string> {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase()
  const expires_at = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

  await supabase.from('active_codes').upsert({ room_code: code, lesson_id, expires_at })
  await supabase.from('lessons').update({ room_code: code, status: 'aktiv' }).eq('id', lesson_id)

  return code
}
```

**Step 3: Auth Routes**
```typescript
// backend/src/modules/auth/auth.routes.ts
import { Router } from 'express'
import { loginStudent, generateRoomCode } from './auth.service'

const router = Router()

router.post('/login', async (req, res) => {
  try {
    const result = await loginStudent(req.body)
    res.json(result)
  } catch (err: any) {
    res.status(401).json({ error: err.message })
  }
})

router.post('/room-code', async (req, res) => {
  try {
    const code = await generateRoomCode(req.body.lesson_id)
    res.json({ code })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
```

**Step 4: Testen mit curl**
```bash
curl -X POST http://localhost:3002/api/auth/room-code \
  -H "Content-Type: application/json" \
  -d '{"lesson_id": "test-uuid"}'
# Erwartung: {"code": "ABC123"}
```

**Step 5: Commit**
```bash
git add backend/src/modules/auth/
git commit -m "feat: auth module with room code generation"
```

---

### Task 6: Socket.io Handlers

**Files:**
- Create: `backend/src/socket/index.ts`
- Create: `backend/src/socket/handlers/draw.ts`
- Create: `backend/src/socket/handlers/attendance.ts`
- Create: `backend/src/socket/handlers/hand.ts`

**Step 1: Socket Index**
```typescript
// backend/src/socket/index.ts
import { Server } from 'socket.io'
import { registerDrawHandlers } from './handlers/draw'
import { registerAttendanceHandlers } from './handlers/attendance'
import { registerHandHandlers } from './handlers/hand'

export function registerSocketHandlers(io: Server) {
  io.on('connection', (socket) => {
    const { lesson_id, student_id, role } = socket.handshake.auth

    if (!lesson_id) { socket.disconnect(); return }

    socket.join(`lesson:${lesson_id}`)
    console.log(`${role} ${student_id} joined lesson ${lesson_id}`)

    // Schüler-Liste aktualisieren
    if (role === 'student') {
      io.to(`lesson:${lesson_id}`).emit('room:students', { student_id, event: 'joined' })
    }

    registerDrawHandlers(io, socket, lesson_id)
    registerAttendanceHandlers(io, socket, lesson_id)
    registerHandHandlers(io, socket, lesson_id)

    socket.on('disconnect', () => {
      if (role === 'student') {
        io.to(`lesson:${lesson_id}`).emit('room:students', { student_id, event: 'left' })
      }
    })
  })
}
```

**Step 2: Draw Handler**
```typescript
// backend/src/socket/handlers/draw.ts
import { Server, Socket } from 'socket.io'

// Throttle: max 30fps pro Raum
const lastDraw: Record<string, number> = {}

export function registerDrawHandlers(io: Server, socket: Socket, lesson_id: string) {
  socket.on('draw:stroke', (data) => {
    const now = Date.now()
    const key = `lesson:${lesson_id}`
    if (now - (lastDraw[key] || 0) < 33) return // 30fps throttle
    lastDraw[key] = now
    socket.to(key).emit('draw:stroke', data)
  })

  socket.on('draw:clear', () => {
    socket.to(`lesson:${lesson_id}`).emit('draw:clear')
  })
}
```

**Step 3: Attendance Handler**
```typescript
// backend/src/socket/handlers/attendance.ts
import { Server, Socket } from 'socket.io'
import { supabase } from '../../lib/supabase'

export function registerAttendanceHandlers(io: Server, socket: Socket, lesson_id: string) {
  // Nur Lehrer kann Check starten
  socket.on('attendance:start', async () => {
    if (socket.handshake.auth.role !== 'teacher') return

    // checks_total für alle Schüler erhöhen
    await supabase.rpc('increment_checks_total', { p_lesson_id: lesson_id })

    io.to(`lesson:${lesson_id}`).emit('attendance:start', { duration: 120 })

    // Nach 120s automatisch beenden
    setTimeout(async () => {
      io.to(`lesson:${lesson_id}`).emit('attendance:end')
    }, 120_000)
  })

  socket.on('attendance:confirm', async () => {
    const { student_id } = socket.handshake.auth
    await supabase
      .from('attendance_logs')
      .update({ checks_confirmed: supabase.rpc('increment') })
      .eq('student_id', student_id)
      .eq('lesson_id', lesson_id)

    io.to(`lesson:${lesson_id}`).emit('attendance:confirmed', { student_id })
  })
}
```

**Step 4: Hand Handler**
```typescript
// backend/src/socket/handlers/hand.ts
import { Server, Socket } from 'socket.io'

export function registerHandHandlers(io: Server, socket: Socket, lesson_id: string) {
  socket.on('hand:raise', () => {
    io.to(`lesson:${lesson_id}`).emit('hand:update', {
      student_id: socket.handshake.auth.student_id,
      raised: true
    })
  })

  socket.on('hand:lower', () => {
    io.to(`lesson:${lesson_id}`).emit('hand:update', {
      student_id: socket.handshake.auth.student_id,
      raised: false
    })
  })

  // Lehrer gibt Mikrofon frei
  socket.on('mic:grant', ({ target_student_id }) => {
    if (socket.handshake.auth.role !== 'teacher') return
    io.to(`lesson:${lesson_id}`).emit('mic:granted', { student_id: target_student_id })
  })

  socket.on('mic:revoke', ({ target_student_id }) => {
    if (socket.handshake.auth.role !== 'teacher') return
    io.to(`lesson:${lesson_id}`).emit('mic:revoked', { student_id: target_student_id })
  })
}
```

**Step 5: Commit**
```bash
git add backend/src/socket/
git commit -m "feat: socket.io handlers for draw, attendance, hand-raise"
```

---

## Phase 4: Frontend — Core

### Task 7: Vite PWA + Router Setup

**Files:**
- Modify: `frontend/vite.config.ts`
- Create: `frontend/src/lib/socket.ts`
- Create: `frontend/src/lib/supabase.ts`
- Create: `frontend/src/App.tsx`

**Step 1: PWA Plugin installieren**
```bash
cd frontend
npm install -D vite-plugin-pwa
```

**Step 2: vite.config.ts**
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Fahrschul Classroom',
        short_name: 'Classroom',
        theme_color: '#1a1a2e',
        display: 'standalone',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }]
      }
    })
  ]
})
```

**Step 3: Socket Client**
```typescript
// frontend/src/lib/socket.ts
import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(token: string, lesson_id: string): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_BACKEND_URL, {
      auth: { token, lesson_id }
    })
  }
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
```

**Step 4: Supabase Client**
```typescript
// frontend/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

**Step 5: App Router**
```typescript
// frontend/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LoginPage } from './modules/auth/LoginPage'
import { LobbyPage } from './modules/lobby/LobbyPage'
import { StudentRoom } from './modules/jitsi/StudentRoom'
import { TeacherDashboard } from './modules/teacher/TeacherDashboard'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/raum" element={<StudentRoom />} />
        <Route path="/lehrer" element={<TeacherDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}
```

**Step 6: Frontend starten**
```bash
cd frontend && npm run dev
# Erwartung: Vite server auf http://localhost:5173
```

**Step 7: Commit**
```bash
git add frontend/src/ frontend/vite.config.ts
git commit -m "feat: vite pwa setup with router"
```

---

### Task 8: Auth-Modul (Login-Seite)

**Files:**
- Create: `frontend/src/modules/auth/LoginPage.tsx`
- Create: `frontend/src/modules/auth/useAuth.ts`

**Step 1: useAuth Hook**
```typescript
// frontend/src/modules/auth/useAuth.ts
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function useAuth() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function login(phone_number: string, room_code: string) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number, room_code: room_code.toUpperCase() })
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const data = await res.json()
      localStorage.setItem('classroom_token', data.token)
      localStorage.setItem('classroom_student', JSON.stringify(data.student))
      localStorage.setItem('classroom_lesson', JSON.stringify(data.lesson))
      navigate('/lobby')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return { login, loading, error }
}
```

**Step 2: LoginPage**
```typescript
// frontend/src/modules/auth/LoginPage.tsx
import { useState } from 'react'
import { useAuth } from './useAuth'

export function LoginPage() {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const { login, loading, error } = useAuth()

  return (
    <div className="login-container">
      <h1>Fahrschul Classroom</h1>
      <input
        type="tel"
        placeholder="Handynummer"
        value={phone}
        onChange={e => setPhone(e.target.value)}
      />
      <input
        type="text"
        placeholder="Raum-Code (z.B. ABC123)"
        maxLength={6}
        value={code}
        onChange={e => setCode(e.target.value.toUpperCase())}
      />
      {error && <p className="error">{error}</p>}
      <button onClick={() => login(phone, code)} disabled={loading}>
        {loading ? 'Bitte warten...' : 'Eintreten'}
      </button>
    </div>
  )
}
```

**Step 3: Im Browser testen**
- `http://localhost:5173` öffnen
- Login-Formular sollte erscheinen

**Step 4: Commit**
```bash
git add frontend/src/modules/auth/
git commit -m "feat: student login page with room code"
```

---

### Task 9: Canvas Zeichen-Modul

**Files:**
- Create: `frontend/src/modules/canvas/DrawingCanvas.tsx`
- Create: `frontend/src/modules/canvas/useCanvas.ts`

**Step 1: useCanvas Hook**
```typescript
// frontend/src/modules/canvas/useCanvas.ts
import { useRef, useEffect, useCallback } from 'react'
import { Socket } from 'socket.io-client'

export function useCanvas(socket: Socket | null, isTeacher: boolean) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const color = useRef('#ff0000')
  const strokeWidth = useRef(3)

  const getCtx = () => canvasRef.current?.getContext('2d')

  const drawStroke = useCallback((x1: number, y1: number, x2: number, y2: number, c: string, w: number) => {
    const ctx = getCtx()
    if (!ctx) return
    ctx.strokeStyle = c
    ctx.lineWidth = w
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }, [])

  // Empfange Zeichnungen von anderen
  useEffect(() => {
    if (!socket) return
    socket.on('draw:stroke', (data) => drawStroke(data.x1, data.y1, data.x2, data.y2, data.color, data.width))
    socket.on('draw:clear', () => {
      const ctx = getCtx()
      const canvas = canvasRef.current
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height)
    })
    return () => { socket.off('draw:stroke'); socket.off('draw:clear') }
  }, [socket, drawStroke])

  // Touch + Maus Events für Lehrer
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isTeacher) return
    drawing.current = true
    canvasRef.current?.setPointerCapture(e.pointerId)
  }, [isTeacher])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!drawing.current || !isTeacher || !socket) return
    const rect = canvasRef.current!.getBoundingClientRect()
    const x2 = e.clientX - rect.left
    const y2 = e.clientY - rect.top
    const x1 = x2 - e.movementX
    const y1 = y2 - e.movementY
    drawStroke(x1, y1, x2, y2, color.current, strokeWidth.current)
    socket.emit('draw:stroke', { x1, y1, x2, y2, color: color.current, width: strokeWidth.current })
  }, [isTeacher, socket, drawStroke])

  const handlePointerUp = useCallback(() => { drawing.current = false }, [])

  const clearCanvas = useCallback(() => {
    const ctx = getCtx()
    const canvas = canvasRef.current
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height)
    socket?.emit('draw:clear')
  }, [socket])

  return { canvasRef, handlePointerDown, handlePointerMove, handlePointerUp, clearCanvas, color, strokeWidth }
}
```

**Step 2: DrawingCanvas Component**
```typescript
// frontend/src/modules/canvas/DrawingCanvas.tsx
import { useCanvas } from './useCanvas'
import { Socket } from 'socket.io-client'

interface Props {
  socket: Socket | null
  isTeacher: boolean
  active: boolean
}

export function DrawingCanvas({ socket, isTeacher, active }: Props) {
  const { canvasRef, handlePointerDown, handlePointerMove, handlePointerUp, clearCanvas } = useCanvas(socket, isTeacher)

  if (!active) return null

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: isTeacher ? 'all' : 'none' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', cursor: isTeacher ? 'crosshair' : 'default' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      {isTeacher && (
        <button onClick={clearCanvas} style={{ position: 'absolute', top: 8, right: 8 }}>
          Löschen
        </button>
      )}
    </div>
  )
}
```

**Step 3: Commit**
```bash
git add frontend/src/modules/canvas/
git commit -m "feat: drawing canvas with pointer + socket sync"
```

---

### Task 10: Präsenz-Check Modul (120s Timer)

**Files:**
- Create: `frontend/src/modules/attendance/AttendanceCheck.tsx`
- Create: `frontend/src/modules/attendance/useAttendance.ts`

**Step 1: useAttendance Hook**
```typescript
// frontend/src/modules/attendance/useAttendance.ts
import { useState, useEffect, useRef } from 'react'
import { Socket } from 'socket.io-client'

export function useAttendance(socket: Socket | null) {
  const [active, setActive] = useState(false)
  const [timeLeft, setTimeLeft] = useState(120)
  const [confirmed, setConfirmed] = useState(false)
  const timerRef = useRef<number>()

  useEffect(() => {
    if (!socket) return

    socket.on('attendance:start', ({ duration }: { duration: number }) => {
      setActive(true)
      setTimeLeft(duration)
      setConfirmed(false)
      timerRef.current = window.setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) { clearInterval(timerRef.current); setActive(false); return 0 }
          return t - 1
        })
      }, 1000)
    })

    socket.on('attendance:end', () => {
      clearInterval(timerRef.current)
      setActive(false)
    })

    return () => { socket.off('attendance:start'); socket.off('attendance:end') }
  }, [socket])

  function confirm() {
    socket?.emit('attendance:confirm')
    setConfirmed(true)
  }

  return { active, timeLeft, confirmed, confirm }
}
```

**Step 2: AttendanceCheck Component**
```typescript
// frontend/src/modules/attendance/AttendanceCheck.tsx
import { useAttendance } from './useAttendance'
import { Socket } from 'socket.io-client'

export function AttendanceCheck({ socket }: { socket: Socket | null }) {
  const { active, timeLeft, confirmed, confirm } = useAttendance(socket)

  if (!active) return null

  return (
    <div className="attendance-overlay">
      <div className="attendance-modal">
        <h2>Bist du noch dabei?</h2>
        <div className="timer">{timeLeft}s</div>
        {confirmed
          ? <p>✓ Präsenz bestätigt</p>
          : <button onClick={confirm} className="confirm-btn">Ich bin da!</button>
        }
      </div>
    </div>
  )
}
```

**Step 3: Commit**
```bash
git add frontend/src/modules/attendance/
git commit -m "feat: attendance check with 120s timer"
```

---

### Task 11: Jitsi Wrapper

**Files:**
- Create: `frontend/src/modules/jitsi/JitsiContainer.tsx`
- Create: `frontend/src/modules/jitsi/useJitsi.ts`

**Step 1: useJitsi Hook**
```typescript
// frontend/src/modules/jitsi/useJitsi.ts
import { useEffect, useRef } from 'react'

declare global { interface Window { JitsiMeetExternalAPI: any } }

interface JitsiOptions {
  room: string
  displayName: string
  isTeacher: boolean
  onParticipantJoined?: (id: string) => void
  onHandRaised?: (id: string, raised: boolean) => void
}

export function useJitsi(containerId: string, options: JitsiOptions) {
  const apiRef = useRef<any>(null)

  useEffect(() => {
    if (!window.JitsiMeetExternalAPI) return

    apiRef.current = new window.JitsiMeetExternalAPI(import.meta.env.VITE_JITSI_DOMAIN, {
      roomName: options.room,
      parentNode: document.getElementById(containerId),
      userInfo: { displayName: options.displayName },
      configOverwrite: {
        startWithAudioMuted: !options.isTeacher,
        startWithVideoMuted: true,
        toolbarButtons: [], // Keine Jitsi-Menüs
      },
      interfaceConfigOverwrite: { SHOW_JITSI_WATERMARK: false }
    })

    if (options.onParticipantJoined) {
      apiRef.current.addListener('participantJoined', (e: any) => options.onParticipantJoined!(e.id))
    }
    if (options.onHandRaised) {
      apiRef.current.addListener('raiseHandUpdated', (e: any) => options.onHandRaised!(e.id, e.handRaised))
    }

    return () => apiRef.current?.dispose()
  }, [])

  const muteAll = () => apiRef.current?.executeCommand('muteEveryone', 'audio')
  const shareScreen = () => apiRef.current?.executeCommand('toggleShareScreen')

  return { muteAll, shareScreen }
}
```

**Step 2: JitsiContainer**
```typescript
// frontend/src/modules/jitsi/JitsiContainer.tsx
import { useEffect } from 'react'
import { useJitsi } from './useJitsi'

interface Props {
  room: string
  displayName: string
  isTeacher: boolean
}

export function JitsiContainer({ room, displayName, isTeacher }: Props) {
  // Jitsi Script laden
  useEffect(() => {
    const script = document.createElement('script')
    script.src = `https://${import.meta.env.VITE_JITSI_DOMAIN}/external_api.js`
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [])

  useJitsi('jitsi-container', { room, displayName, isTeacher })

  return <div id="jitsi-container" style={{ width: '100%', height: '100%' }} />
}
```

**Step 3: Commit**
```bash
git add frontend/src/modules/jitsi/
git commit -m "feat: jitsi iframe wrapper with teacher controls"
```

---

### Task 12: Lehrer-Dashboard

**Files:**
- Create: `frontend/src/modules/teacher/TeacherDashboard.tsx`
- Create: `frontend/src/modules/teacher/StudentList.tsx`
- Create: `frontend/src/modules/teacher/TeacherControls.tsx`

**Step 1: StudentList Component**
```typescript
// frontend/src/modules/teacher/StudentList.tsx
import { useState, useEffect } from 'react'
import { Socket } from 'socket.io-client'

interface Student {
  id: string
  name: string
  online: boolean
  handRaised: boolean
  checksConfirmed: number
  checksTotal: number
}

export function StudentList({ socket, onGrantMic }: { socket: Socket | null, onGrantMic: (id: string) => void }) {
  const [students, setStudents] = useState<Student[]>([])

  useEffect(() => {
    if (!socket) return
    socket.on('room:students', (data) => {
      setStudents(prev => {
        if (data.event === 'joined') return [...prev.filter(s => s.id !== data.student_id), { id: data.student_id, name: '', online: true, handRaised: false, checksConfirmed: 0, checksTotal: 0 }]
        return prev.map(s => s.id === data.student_id ? { ...s, online: false } : s)
      })
    })
    socket.on('hand:update', ({ student_id, raised }) => {
      setStudents(prev => prev.map(s => s.id === student_id ? { ...s, handRaised: raised } : s))
    })
    socket.on('attendance:confirmed', ({ student_id }) => {
      setStudents(prev => prev.map(s => s.id === student_id ? { ...s, checksConfirmed: s.checksConfirmed + 1 } : s))
    })
    return () => { socket.off('room:students'); socket.off('hand:update'); socket.off('attendance:confirmed') }
  }, [socket])

  return (
    <div className="student-list">
      <h3>Schüler ({students.filter(s => s.online).length} online)</h3>
      {students.map(s => (
        <div key={s.id} className={`student-row ${s.online ? 'online' : 'offline'}`}>
          <span>{s.name || s.id.slice(0, 8)}</span>
          {s.handRaised && <button onClick={() => onGrantMic(s.id)}>🎤 Freischalten</button>}
          <span>{s.checksConfirmed}/{s.checksTotal} ✓</span>
        </div>
      ))}
    </div>
  )
}
```

**Step 2: TeacherControls**
```typescript
// frontend/src/modules/teacher/TeacherControls.tsx
interface Props {
  onStartCheck: () => void
  onMuteAll: () => void
  onShareScreen: () => void
  onToggleCanvas: () => void
  canvasActive: boolean
  roomCode: string
}

export function TeacherControls({ onStartCheck, onMuteAll, onShareScreen, onToggleCanvas, canvasActive, roomCode }: Props) {
  return (
    <div className="teacher-controls">
      <div className="room-code-display">
        <span>Raum-Code:</span>
        <strong>{roomCode}</strong>
      </div>
      <button onClick={onStartCheck}>🕐 Präsenz-Check starten</button>
      <button onClick={onMuteAll}>🔇 Alle stumm</button>
      <button onClick={onShareScreen}>📺 Bildschirm teilen</button>
      <button onClick={onToggleCanvas} className={canvasActive ? 'active' : ''}>
        ✏️ {canvasActive ? 'Zeichnen beenden' : 'Zeichnen'}
      </button>
    </div>
  )
}
```

**Step 3: TeacherDashboard**
```typescript
// frontend/src/modules/teacher/TeacherDashboard.tsx
import { useState } from 'react'
import { JitsiContainer } from '../jitsi/JitsiContainer'
import { DrawingCanvas } from '../canvas/DrawingCanvas'
import { StudentList } from './StudentList'
import { TeacherControls } from './TeacherControls'
import { getSocket } from '../../lib/socket'

export function TeacherDashboard() {
  const [canvasActive, setCanvasActive] = useState(false)
  const token = localStorage.getItem('classroom_token') || ''
  const lesson = JSON.parse(localStorage.getItem('classroom_lesson') || '{}')
  const socket = getSocket(token, lesson.id)

  function startCheck() { socket.emit('attendance:start') }
  function muteAll() { /* via Jitsi API */ }
  function grantMic(id: string) { socket.emit('mic:grant', { target_student_id: id }) }

  return (
    <div className="teacher-dashboard">
      <div className="main-area" style={{ position: 'relative' }}>
        <JitsiContainer room={lesson.jitsi_room} displayName="Lehrer" isTeacher={true} />
        <DrawingCanvas socket={socket} isTeacher={true} active={canvasActive} />
      </div>
      <div className="sidebar">
        <TeacherControls
          onStartCheck={startCheck}
          onMuteAll={muteAll}
          onShareScreen={() => {}}
          onToggleCanvas={() => setCanvasActive(a => !a)}
          canvasActive={canvasActive}
          roomCode={lesson.room_code || ''}
        />
        <StudentList socket={socket} onGrantMic={grantMic} />
      </div>
    </div>
  )
}
```

**Step 4: Commit**
```bash
git add frontend/src/modules/teacher/
git commit -m "feat: teacher dashboard with controls and student list"
```

---

## Phase 5: Deployment

### Task 13: Jitsi auf Dokploy

**Step 1: In Dokploy neues Projekt anlegen**
- Dokploy öffnen → New Project → `classroom`

**Step 2: Jitsi Template suchen**
- Create Service → Template → "Jitsi" suchen → Create

**Step 3: Jitsi Domain in .env eintragen**
```env
VITE_JITSI_DOMAIN=jitsi.178.104.27.147.traefik.me
```

**Step 4: Deploy + testen**
- Jitsi URL im Browser öffnen → Test-Raum erstellen

---

### Task 14: Backend auf Dokploy

**Files:**
- Create: `backend/Dockerfile`

**Step 1: Dockerfile**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3002
CMD ["node", "dist/index.js"]
```

**Step 2: In Dokploy**
- Create Service → Application → GitHub → `fahrschul-classroom` Repo
- Root Directory: `backend`
- Port: 3002
- Environment Variables aus `.env` eintragen

**Step 3: Deploy**

---

### Task 15: Frontend auf Dokploy

**Files:**
- Create: `frontend/Dockerfile`

**Step 1: Dockerfile**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
```

**Step 2: In Dokploy**
- Create Service → Application → GitHub → `fahrschul-classroom` Repo
- Root Directory: `frontend`
- Port: 80
- Environment Variables eintragen

**Step 3: Deploy + testen**
- PWA im Browser öffnen
- Login testen
- Raum beitreten testen
