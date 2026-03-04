# Fahrschul Classroom — Design Dokument
**Datum:** 2026-03-04
**Status:** Genehmigt

---

## Übersicht

Live-Classroom-System für Theorie-Unterricht in Fahrschulen. Schüler treten per PWA bei, Lehrer steuert Unterricht über Dashboard. Echtzeit-Sync via Socket.io, Video via Jitsi.

---

## Architektur

**Ansatz:** Getrennte Services (Frontend + Backend + Jitsi + Supabase)

```
GitHub: fahrschul-classroom/
  ├── frontend/          ← React PWA (Vite + TypeScript)
  │     ├── /schueler    ← Schüler-Interface
  │     └── /lehrer      ← Lehrer-Dashboard
  └── backend/           ← Node.js + Express + Socket.io

Dokploy Services (Hetzner 178.104.27.147):
  ├── classroom-frontend  (Port 80)
  ├── classroom-backend   (Port 3002)
  ├── jitsi               (Port 8443)
  └── supabase            (bereits aktiv)
```

---

## Modulare Struktur

### Frontend (`frontend/src/`)
```
modules/
  auth/          ← Login (Nummer + Raum-Code)
  lobby/         ← Warteraum
  jitsi/         ← Jitsi IFrame Wrapper
  canvas/        ← Zeichen-Layer (Touch + Maus)
  attendance/    ← Präsenz-Check (120s Timer)
  hand-raise/    ← Handzeichen + Mikrofon-Freigabe
  media/         ← PDF/Video-Anzeige
  schedule/      ← Terminkalender
  teacher/       ← Lehrer-Dashboard Module
components/      ← Wiederverwendbare UI-Teile
hooks/           ← Custom React Hooks
lib/
  socket.ts      ← Socket.io Client
  supabase.ts    ← Supabase Client
```

### Backend (`backend/src/`)
```
modules/
  auth/          ← Code-Generierung & Validierung
  rooms/         ← Raum-Verwaltung
  attendance/    ← Präsenz-Logik
  media/         ← Medien-Verwaltung
  jitsi/         ← Jitsi Token-Generierung
socket/
  handlers/
    draw.ts      ← Zeichen-Events
    check.ts     ← Präsenz-Events
    hand.ts      ← Handzeichen-Events
lib/
  supabase.ts
  db.ts
```

**Regel:** Jedes Modul max. 150-200 Zeilen, eigene Typen, unabhängig austauschbar.

---

## Datenbank (Supabase PostgreSQL)

```sql
students
  id, phone_number, full_name, is_active, created_at
  (verknüpft mit fahrschueler-Tabelle)

lessons
  id, topic_number, title, start_time,
  room_code VARCHAR(6), jitsi_room, status

attendance_logs
  id, student_id, lesson_id, joined_at,
  checks_total, checks_confirmed, status

active_codes
  id, room_code, lesson_id, expires_at
  (kurzlebig, wird nach Unterricht gelöscht)
```

---

## Auth-Flow (Option A — Raum-Code)

```
1. Lehrer startet Lektion
2. Backend generiert 6-stelligen Code → in active_codes
3. Code erscheint groß auf Lehrer-Dashboard
4. Schüler öffnet PWA → gibt Handynummer + Code ein
5. Backend prüft: Nummer in students? Code gültig?
6. Ja → JWT Token → Zugang zum Unterrichtsraum
7. Code läuft ab bei Unterrichtsende oder manuell
```

Kein SMS, kein Twilio, keine externen Kosten.

---

## Echtzeit-Events (Socket.io)

### Client → Server
| Event | Beschreibung |
|---|---|
| `student:join` | Schüler tritt bei |
| `student:leave` | Schüler verlässt |
| `hand:raise` | Hand heben |
| `hand:lower` | Hand senken |
| `attendance:confirm` | Präsenz-Check bestätigen |
| `draw:stroke` | Zeichnung (X,Y Koordinaten) |
| `draw:clear` | Zeichnung löschen |

### Server → Client
| Event | Beschreibung |
|---|---|
| `room:students` | Aktualisierte Schülerliste |
| `attendance:start` | Check startet (120s Timer) |
| `attendance:end` | Check beendet |
| `hand:update` | Handzeichen-Status aller |
| `mic:granted` | Mikrofon-Freigabe für Schüler |
| `mic:revoked` | Mikrofon wieder stumm |
| `draw:stroke` | Zeichnung an alle senden |
| `draw:clear` | Zeichnung löschen bei allen |

**Performance:** Zeichnungen gebündelt (max. 30fps), jeder Raum = eigener Socket.io-Room, keine DB-Schreibung bei Zeichnungen.

---

## Jitsi Integration

- Self-hosted auf Dokploy (DSGVO-konform)
- Lehrer = Moderator (Screen-Share, alle stummschalten)
- Schüler = Teilnehmer (nur Audio wenn freigegeben, keine Kamera)
- Alle Jitsi-Menüs ausgeblendet (`toolbarButtons: []`)
- JWT-Token pro Teilnehmer vom Backend generiert

---

## Medien-Verwaltung

- Upload → Supabase Storage
- Kategorien: PDFs, Videos, Bilder
- Editierbar: umbenennen, löschen, neu hochladen
- Im Unterricht: Lehrer wählt Medium → URL via Socket.io an alle Schüler
- Video-Pause: friert Video ein, aktiviert Zeichen-Layer automatisch

---

## PDF-Export

- Läuft komplett im Browser (`window.print()`)
- Inhalt: Schülername, Lektionsnummer, Datum, Checks bestanden/gesamt

---

## Tech-Stack

| Bereich | Technologie |
|---|---|
| Frontend PWA | React + Vite + TypeScript |
| Backend | Node.js + Express + Socket.io |
| Datenbank | Self-hosted Supabase (PostgreSQL) |
| Video | Self-hosted Jitsi auf Dokploy |
| Medien | Supabase Storage |
| Deployment | Dokploy (Hetzner) |
