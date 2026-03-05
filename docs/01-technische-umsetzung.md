# Technische Umsetzung – Fahrschul Classroom

## Überblick

Live-Classroom-System für Fahrschul-Theoriestunden. Lehrer und Schüler treffen sich in einem virtuellen Raum mit Video, Zeichenfläche und Anwesenheitskontrolle.

---

## Infrastruktur (Hetzner VPS: 178.104.27.147)

```
┌──────────────────────────────────────────────┐
│              Dokploy v0.28.3                 │
│         (Deployment-Plattform)               │
│                                              │
│  ┌─────────┐  ┌──────────┐  ┌─────────────┐ │
│  │ Frontend│  │ Backend  │  │    Jitsi    │ │
│  │  nginx  │  │ Node.js  │  │ 4 Container │ │
│  │  :80   │  │  :3002   │  │  :10000/udp │ │
│  └─────────┘  └──────────┘  └─────────────┘ │
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │    Traefik (Reverse Proxy + TLS)        │ │
│  │    traefik.me Wildcard-DNS              │ │
│  └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘

Supabase (Self-Hosted, gleicher VPS):
  fuehrerscheinfragenapp-supabase-...-traefik.me
```

### Domains

| Service  | URL                                            | TLS  |
|----------|------------------------------------------------|------|
| Frontend | http://frontend.178.104.27.147.traefik.me      | nein |
| Backend  | http://backend.178.104.27.147.traefik.me       | nein |
| Jitsi    | https://jitsi.178.104.27.147.traefik.me        | ja   |

> **Hinweis:** traefik.me unterstützt kein HTTPS für Subdomains — nur Jitsi bekommt ein Let's-Encrypt-Zertifikat (benötigt für WebRTC).

---

## Tech-Stack

| Schicht    | Technologie             | Version  |
|------------|-------------------------|----------|
| Frontend   | React + Vite            | 18 / 5   |
| Sprache    | TypeScript              | 5.x      |
| Routing    | React Router DOM        | v6       |
| Echtzeit   | Socket.io-client        | 4.x      |
| Video      | Jitsi Meet (Embedded)   | stable   |
| Backend    | Node.js + Express       | 20 / 4   |
| Echtzeit   | Socket.io (Server)      | 4.x      |
| Auth       | JWT (jsonwebtoken)      | —        |
| Datenbank  | Supabase (PostgreSQL)   | self-hosted |
| Deployment | Docker + Dokploy        | v0.28.3  |
| Proxy      | Traefik                 | v2       |

---

## Architektur

### Frontend (React PWA)

```
src/
  App.tsx                        ← Router (alle Routen)
  main.tsx                       ← React-Einstieg
  lib/
    socket.ts                    ← Socket.io Singleton
    supabase.ts                  ← Supabase Browser-Client
  modules/
    auth/
      LoginPage.tsx              ← Schüler-Login (Handynummer + Code)
      StaffLoginPage.tsx         ← Einheitlicher Login für Admin + Lehrer
      useAuth.ts                 ← Login-Logik + JWT speichern
    lobby/
      LobbyPage.tsx              ← Warteraum nach Login
    jitsi/
      StudentRoom.tsx            ← Schüler-Ansicht (Jitsi + Anwesenheit)
      useJitsi.ts                ← Jitsi IFrame API Hook
    teacher/
      TeacherDashboard.tsx       ← Lehrer-Ansicht (Jitsi + Sidebar)
      TeacherControls.tsx        ← Kontroll-Buttons Sidebar
      StudentList.tsx            ← Live-Schülerliste
    canvas/
      DrawingCanvas.tsx          ← Zeichenfläche UI
      useCanvas.ts               ← Canvas-Logik + Socket-Sync
    attendance/
      AttendanceCheck.tsx        ← Anwesenheits-Popup
      useAttendance.ts           ← Anwesenheits-Logik
    admin/
      AdminLayout.tsx            ← Sidebar + Header Wrapper (Auth-Guard)
      AdminDashboard.tsx         ← /admin (Statistik-Karten)
      AdminLehrer.tsx            ← /admin/lehrer (CRUD)
      AdminSchueler.tsx          ← /admin/schueler (CRUD)
      AdminLektionen.tsx         ← /admin/lektionen (CRUD)
```

**Routing:**

| Pfad               | Komponente        | Wer                              |
|--------------------|-------------------|----------------------------------|
| `/`                | LoginPage         | Schüler                          |
| `/lobby`           | LobbyPage         | Schüler                          |
| `/raum`            | StudentRoom       | Schüler                          |
| `/login`           | StaffLoginPage    | Admin + Lehrer (Rolle → Redirect)|
| `/lehrer-login`    | Redirect → `/login` | (rückwärtskompatibel)          |
| `/lehrer-start`    | TeacherStartPage  | Lehrer (Code generieren)         |
| `/lehrer`          | TeacherDashboard  | Lehrer (Auth-Guard aktiv)        |
| `/admin`           | AdminDashboard    | Admin (Auth-Guard is_admin)      |
| `/admin/lehrer`    | AdminLehrer       | Admin                            |
| `/admin/schueler`  | AdminSchueler     | Admin                            |
| `/admin/lektionen` | AdminLektionen    | Admin                            |

### Backend (Node.js + Express + Socket.io)

```
src/
  index.ts                       ← Server-Einstieg, CORS, Port 3002
  lib/
    supabase.ts                  ← Supabase Service-Role Client
  middleware/
    teacherAuth.ts               ← requireTeacher (Supabase Token)
    adminAuth.ts                 ← requireAdmin (Token + is_admin check)
  modules/
    auth/
      auth.routes.ts             ← POST /api/auth/login
                                    POST /api/auth/room-code (Auth-geschützt)
      auth.service.ts            ← Login-Logik, Code-Generierung
      auth.types.ts              ← TypeScript-Typen
    rooms/
      rooms.routes.ts            ← GET /api/rooms (aktive Lektionen)
    admin/
      admin.routes.ts            ← Alle /api/admin/* Endpunkte
      admin.service.ts           ← Business-Logik (Supabase Admin API)
  socket/
    index.ts                     ← JWT-Authentifizierung bei WS-Connect
    handlers/
      draw.ts                    ← Zeichnen broadcast (30fps throttle)
      attendance.ts              ← Anwesenheits-Check-Logik
      hand.ts                    ← Hand heben + Mikrofon-Vergabe
```

**REST-Endpunkte:**

| Methode | Pfad                        | Auth          | Beschreibung                    |
|---------|-----------------------------|---------------|---------------------------------|
| GET     | `/health`                   | —             | Server-Status                   |
| POST    | `/api/auth/login`           | —             | Login mit Handynummer + Code    |
| POST    | `/api/auth/room-code`       | Lehrer-Token  | Neuen Raum-Code generieren      |
| GET     | `/api/rooms`                | —             | Aktive Lektionen auflisten      |
| GET     | `/api/admin/stats`          | Admin-Token   | Anzahl Lehrer/Schüler/Lektionen |
| GET     | `/api/admin/lehrer`         | Admin-Token   | Alle Lehrer (inkl. E-Mail)      |
| POST    | `/api/admin/lehrer`         | Admin-Token   | Lehrer anlegen (Auth + DB)      |
| PUT     | `/api/admin/lehrer/:id`     | Admin-Token   | Lehrer bearbeiten               |
| DELETE  | `/api/admin/lehrer/:id`     | Admin-Token   | Lehrer löschen                  |
| GET     | `/api/admin/schueler`       | Admin-Token   | Alle Schüler                    |
| POST    | `/api/admin/schueler`       | Admin-Token   | Schüler anlegen                 |
| PUT     | `/api/admin/schueler/:id`   | Admin-Token   | Schüler bearbeiten              |
| DELETE  | `/api/admin/schueler/:id`   | Admin-Token   | Schüler löschen                 |
| GET     | `/api/admin/lektionen`      | Admin-Token   | Alle Lektionen                  |
| POST    | `/api/admin/lektionen`      | Admin-Token   | Lektion anlegen                 |
| PUT     | `/api/admin/lektionen/:id`  | Admin-Token   | Lektion bearbeiten              |
| DELETE  | `/api/admin/lektionen/:id`  | Admin-Token   | Lektion löschen                 |

### Datenbank (Supabase / PostgreSQL)

```sql
students          -- Schüler (Handynummer, Name, is_active)
lessons           -- Lektionen (Thema, Raum-Code, Status)
active_codes      -- Temporäre Raum-Codes (8h gültig)
attendance_logs   -- Anwesenheits-Protokoll pro Schüler/Lektion
teachers          -- Lehrer (Supabase Auth User → Lektion, is_admin)
```

**Migrations:**

| Datei                          | Inhalt                                      |
|--------------------------------|---------------------------------------------|
| `003_teachers.sql`             | `teachers` Tabelle mit FK auf `auth.users`  |
| `004_admin_role.sql`           | `is_admin BOOLEAN DEFAULT false` auf teachers|

---

## Socket.io Events

### Client → Server

| Event               | Wer     | Beschreibung                    |
|---------------------|---------|---------------------------------|
| `attendance:start`  | Lehrer  | Anwesenheits-Check starten      |
| `attendance:confirm`| Schüler | Anwesenheit bestätigen          |
| `draw:stroke`       | Lehrer  | Zeichenstrich senden            |
| `draw:clear`        | Lehrer  | Canvas leeren                   |
| `hand:raise`        | Schüler | Hand heben                      |
| `hand:lower`        | Schüler | Hand senken                     |
| `mic:grant`         | Lehrer  | Mikrofon für Schüler freischalten|
| `mic:revoke`        | Lehrer  | Mikrofon entziehen              |

### Server → Client (broadcast)

| Event                | Empfänger   | Beschreibung                     |
|----------------------|-------------|----------------------------------|
| `room:students`      | alle        | Schüler beigetreten/verlassen    |
| `attendance:start`   | alle        | Check gestartet, 120s Timer      |
| `attendance:end`     | alle        | Check beendet                    |
| `attendance:confirmed`| alle       | Schüler hat bestätigt            |
| `draw:stroke`        | alle außer Sender | Zeichenstrich            |
| `draw:clear`         | alle außer Sender | Canvas leeren            |
| `hand:update`        | alle        | Hand-Status Schüler              |
| `mic:granted`        | alle        | Mikrofon-Freischaltung           |
| `mic:revoked`        | alle        | Mikrofon-Entzug                  |

---

## Sicherheit

- **JWT-Auth bei Socket-Verbindung**: Jede WebSocket-Verbindung wird beim Connect mit dem JWT verifiziert. Ungültige Tokens → sofortiger Disconnect.
- **Rollen-Prüfung**: Lehrer-Events (`attendance:start`, `mic:grant`, `mic:revoke`) werden serverseitig auf die Rolle geprüft.
- **Aktiver-Check-Tracking**: `attendance:confirm` wird nur akzeptiert wenn ein Check serverseitig aktiv ist (verhindert Replay-Angriffe).
- **Kryptografisch sichere Codes**: Raum-Codes werden mit `crypto.randomBytes` generiert (kein `Math.random`).
- **30fps Throttle**: Zeichenstriche werden per Socket-ID gedrosselt (max. 1 Event alle 33ms).

---

## Deployment

### Frontend Dockerfile (Multi-Stage)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build          # Vite baked .env.production ein

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### Backend Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY tsconfig.json ./
COPY src ./src
RUN npm install -D typescript ... && npm run build && npm prune --production
EXPOSE 3002
CMD ["node", "dist/index.js"]
```

### Jitsi (Docker Compose, 4 Container)

| Container    | Rolle                                  |
|--------------|----------------------------------------|
| `jitsi-web`  | Jitsi Meet Web-UI (nginx)             |
| `prosody`    | XMPP-Server (Signaling)               |
| `jicofo`     | Conference Focus (Raum-Management)    |
| `jvb`        | Video Bridge (Media-Relay, UDP 10000) |

---

## Wichtige Konfigurationen

### frontend/.env.production

```env
VITE_SUPABASE_URL=http://fuehrerscheinfragenapp-supabase-...-traefik.me
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_BACKEND_URL=http://backend.178.104.27.147.traefik.me
VITE_JITSI_DOMAIN=jitsi.178.104.27.147.traefik.me
```

### backend/.env (auf Server)

```env
PORT=3002
JWT_SECRET=<geheim>
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
FRONTEND_URL=http://frontend.178.104.27.147.traefik.me
```

### tsconfig.app.json (kritisch)

```json
"types": ["vite/client"]
```
Ohne diesen Eintrag schlägt `tsc -b` fehl weil `import.meta.env` nicht erkannt wird.
