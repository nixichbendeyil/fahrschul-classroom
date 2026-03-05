# Funktionen – Fahrschul Classroom

## Übersicht der Funktionen

| Funktion               | Schüler | Lehrer | Admin | Technologie          |
|------------------------|:-------:|:------:|:-----:|----------------------|
| Login mit Handynummer  | ✅      | —      | —     | REST + JWT           |
| Login mit E-Mail       | —       | ✅     | ✅    | Supabase Auth        |
| Admin-Panel            | —       | —      | ✅    | React + Express      |
| Lehrer verwalten       | —       | —      | ✅    | Supabase Admin API   |
| Schüler verwalten      | —       | —      | ✅    | REST + Supabase      |
| Lektionen verwalten    | —       | —      | ✅    | REST + Supabase      |
| Video-Konferenz        | ✅      | ✅     | —     | Jitsi Meet Embedded  |
| Anwesenheits-Check     | ✅      | ✅     | —     | Socket.io            |
| Zeichenfläche          | sehen   | ✅     | —     | Canvas + Socket.io   |
| Hand heben             | ✅      | sehen  | —     | Socket.io            |
| Mikrofon-Vergabe       | —       | ✅     | —     | Socket.io + Jitsi    |
| Bildschirm teilen      | —       | ✅     | —     | Jitsi IFrame API     |
| Alle stumm schalten    | —       | ✅     | —     | Jitsi IFrame API     |
| Schülerliste live      | —       | ✅     | —     | Socket.io            |
| Anwesenheits-Statistik | —       | ✅     | —     | Socket.io + Supabase |

---

## 1. Login / Authentifizierung

**Schüler-Login (`/`):**
- Eingabe: Handynummer + 6-stelliger Raum-Code
- Backend prüft: Ist der Code aktiv und nicht abgelaufen (8h Gültigkeit)?
- Backend prüft: Ist die Handynummer in der Datenbank registriert?
- Bei Erfolg: JWT (8h gültig) wird im `localStorage` gespeichert
- Schüler-Daten und Lektions-Infos werden ebenfalls im `localStorage` abgelegt
- Weiterleitung → `/lobby`

**Einheitlicher Staff-Login (`/login`):**
- URL: `http://frontend.178.104.27.147.traefik.me/login`
- Eingabe: E-Mail + Passwort (Supabase Auth)
- Prüft ob User in `teachers`-Tabelle existiert
- Prüft `is_admin` Spalte → Admin: Weiterleitung `/admin`, Lehrer: Weiterleitung `/lehrer-start`
- `/lehrer-login` redirectet automatisch zu `/login` (rückwärtskompatibel)

**Lehrer-Startseite (`/lehrer-start`):**
- Zeigt zugewiesene Lektion
- Button "Code generieren" → generiert neuen Raum-Code
- Button "Unterricht starten" → öffnet Dashboard `/lehrer`
- Auth-Guard: ohne Session → Redirect zu `/login`

**Admin-Panel (`/admin`):**
- Nur zugänglich für Lehrer mit `is_admin = true`
- Auth-Guard auf jeder Admin-Seite: prüft Session + `is_admin`
- Sidebar-Navigation: Dashboard, Lehrer, Schüler, Lektionen
- Abmelden-Button in der Sidebar

**Raum-Code-Generierung:**
- `POST /api/auth/room-code` (Bearer-Token erforderlich — nur für Lehrer)
- Generiert kryptografisch sicheren 6-stelligen Code (A-Z, 0-9)
- Setzt Ablaufzeit: +8 Stunden
- Löscht vorherigen Code für diese Lektion
- Setzt Lektions-Status auf `aktiv`

---

## 2. Video-Konferenz (Jitsi Meet)

Die Jitsi-Integration läuft über die **Jitsi IFrame API** (`api.js`):

**Schüler:**
- Betritt den Jitsi-Raum automatisch mit seinem Namen aus der Datenbank
- Kein separater Login in Jitsi notwendig
- Mikrofon standardmäßig stummgeschaltet bis Lehrer es freischaltet

**Lehrer:**
- Betritt denselben Raum als `Lehrer`
- Hat Moderator-Rechte in Jitsi (durch `isTeacher`-Flag)
- Kann alle Teilnehmer stummschalten
- Kann Bildschirm teilen
- Kann Mikrofone einzelner Schüler per Socket-Event freischalten

**Jitsi IFrame API Funktionen:**

| Funktion          | Methode                        |
|-------------------|--------------------------------|
| Alle stumm        | `executeCommand('muteEveryone')` |
| Bildschirm teilen | `executeCommand('toggleShareScreen')` |
| Anzeigename setzen| `executeCommand('displayName', name)` |

---

## 3. Anwesenheits-Check

Der Lehrer kann jederzeit einen Anwesenheits-Check starten:

**Ablauf:**
1. Lehrer klickt "Präsenz-Check" → sendet `attendance:start` Socket-Event
2. Server: prüft Rolle (`teacher` only), setzt `activeChecks.add(lesson_id)`
3. Server: erhöht `checks_total` für alle Schüler in der Lektion (Supabase)
4. Server: broadcastet `attendance:start` mit `{ duration: 120 }` an alle im Raum
5. Bei Schülern: Overlay erscheint mit Countdown (120 Sekunden)
6. Schüler klickt "Ich bin da!" → sendet `attendance:confirm`
7. Server: prüft ob Check noch aktiv (`activeChecks.has(lesson_id)`)
8. Server: erhöht `checks_confirmed` für diesen Schüler (Supabase)
9. Server: broadcastet `attendance:confirmed` mit `student_id` an alle
10. Lehrer: sieht in der Schülerliste wer bestätigt hat
11. Nach 120s: Server sendet `attendance:end`, Overlay verschwindet

**Datenstruktur in Supabase (`attendance_logs`):**
```
student_id     | lesson_id | checks_total | checks_confirmed | joined_at
schüler-uuid   | lektion-uuid | 5        | 4                | 2026-03-05 ...
```

---

## 4. Zeichenfläche (Drawing Canvas)

Eine transparente Zeichenfläche wird über das Jitsi-Video gelegt.

**Lehrer (aktiv):**
- Zeichnen aktivieren/deaktivieren per Button
- Pointer-Events: Maus/Touch/Stift werden erfasst
- Farbauswahl per Color-Picker
- Strichstärke 1–20px per Slider
- Canvas leeren per "Löschen"-Button
- Zeichenstriche werden via Socket.io gesendet (max. 30fps)

**Schüler (passiv):**
- Sehen die Zeichenstriche des Lehrers in Echtzeit
- Kein Pointer-Event-Zugriff (`pointerEvents: 'none'`)

**Technische Details:**
- `useCanvas` Hook verwaltet den Canvas-State und Socket-Sync
- Throttle: 33ms Mindestabstand zwischen Strichen pro Socket-ID
- `draw:stroke` Event enthält Koordinaten und Stil
- `draw:clear` leert den Canvas bei allen Teilnehmern

---

## 5. Hand heben

**Schüler:**
- Sendet `hand:raise` → Server broadcastet `hand:update { raised: true }`
- Sendet `hand:lower` → Server broadcastet `hand:update { raised: false }`

**Lehrer (Schülerliste):**
- Schüler mit erhobener Hand zeigen "Mic"-Button
- Klick auf "Mic" → sendet `mic:grant { target_student_id }`
- Server prüft Rolle (`teacher` only) → broadcastet `mic:granted`

---

## 6. Mikrofon-Vergabe

**Flow:**
1. Schüler hebt Hand (Socket-Event)
2. Lehrer sieht "Mic"-Button neben dem Schüler
3. Lehrer klickt "Mic" → `mic:grant` mit `target_student_id`
4. Server broadcastet `mic:granted { student_id }` an alle
5. Frontend des Schülers kann darauf reagieren (Jitsi-Mikrofon aktivieren)

Lehrer kann Mikrofon auch wieder entziehen: `mic:revoke` → `mic:revoked`

---

## 7. Schülerliste (Live)

Die Lehrer-Sidebar zeigt eine Echtzeit-Liste aller Schüler:

**Angezeigte Infos pro Schüler:**
- Grüner/grauer Punkt: Online-Status
- Name (aus Datenbank)
- Anwesenheits-Quote: `{checks_confirmed}/{checks_total}`
- "Mic"-Button (nur wenn Hand erhoben)

**Events die die Liste aktualisieren:**
- `room:students` → join/leave (Online-Status)
- `hand:update` → Hand-Status
- `attendance:confirmed` → `checks_confirmed` +1
- `attendance:start` → `checks_total` +1

---

## 8. Lobby (Warteraum)

Nach dem Login landet der Schüler in der Lobby:
- Zeigt Lektions-Infos (Thema, Raum-Code)
- Wartet bis der Lehrer den Raum öffnet
- Weiterleitung zu `/raum` wenn bereit

---

## 9. Rooms API

`GET /api/rooms` listet alle aktiven Lektionen:
- Filtert nach `status = 'aktiv'`
- Kann vom Frontend oder Admin-Tool abgefragt werden

---

## 10. Admin-Panel

Das Admin-Panel ermöglicht die vollständige Verwaltung der Fahrschule ohne SQL-Kenntnisse.

**Dashboard (`/admin`):**
- Zeigt Statistik-Karten: Anzahl Lehrer, Schüler, Lektionen

**Lehrer-Verwaltung (`/admin/lehrer`):**
- Liste aller Lehrer mit Name, E-Mail, zugewiesener Lektion, Admin-Badge
- Lehrer anlegen: Name + E-Mail + Passwort + Lektions-Zuweisung + Admin-Checkbox
- Lehrer bearbeiten: alle Felder änderbar (Passwort leer = unverändert)
- Lehrer löschen: löscht Auth-User + teachers-Row (CASCADE)
- Selbst-Löschung verhindert (serverseitig)

**Schüler-Verwaltung (`/admin/schueler`):**
- Liste aller Schüler mit Name, Handynummer, Aktiv-Status
- Schüler anlegen / bearbeiten / löschen

**Lektionen-Verwaltung (`/admin/lektionen`):**
- Liste aller Lektionen mit Nummer, Titel, zugewiesenem Lehrer, Status
- Lektion anlegen: Nummer + Titel + Lehrer zuweisen (optional)
- Lektion bearbeiten: Lehrer-Zuweisung ändert `lesson_id` auf teachers-Row
- Lektion löschen: löst alle Lehrer-Zuweisungen vor dem Löschen

**Backend:**
- Alle Endpunkte unter `/api/admin/*` durch `requireAdmin` Middleware geschützt
- Lehrer-Erstellung über Supabase Admin API (`auth.admin.createUser`)
- E-Mail/Passwort-Änderung über `auth.admin.updateUserById`

---

## Sicherheitsmechanismen

| Mechanismus               | Implementierung                                    |
|---------------------------|----------------------------------------------------|
| JWT-Auth bei Socket       | `jwt.verify()` beim WS-Connect, disconnect bei Fehler |
| Rollen-Prüfung            | Serverseitig in jedem Handler (`if role !== 'teacher'`) |
| Replay-Schutz Anwesenheit | `activeChecks.has(lesson_id)` prüft ob Check läuft |
| Code-Sicherheit           | `crypto.randomBytes` statt `Math.random`           |
| Zeichnen-Throttle         | Max 30fps per Socket-ID                            |
| CORS                      | Nur `FRONTEND_URL` erlaubt                         |
| Token-Ablauf              | JWT und Raum-Codes laufen nach 8h ab               |
