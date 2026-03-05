# Admin Panel Design

**Datum:** 2026-03-05

## Problem

Das System hat keine Admin-Oberfläche. Lehrer, Schüler und Lektionen müssen aktuell manuell per SQL in Supabase Studio angelegt werden — das ist nicht benutzerfreundlich.

## Ziel

Ein vollständiges Admin-Panel das die Fahrschule komplett selbst verwalten kann, ohne technische Kenntnisse.

---

## Entscheidungen

| Frage | Entscheidung |
|-------|-------------|
| Wo? | In der bestehenden Frontend-App (Option A) |
| Login | Ein einheitliches `/login` für Admin + Lehrer (E-Mail + Passwort) |
| Admin-Erkennung | `is_admin` Spalte in `teachers` Tabelle |
| Mehrere Admins | Ja — Admins können weitere Admins anlegen |

---

## Flows

```
SCHÜLER:  / (Handynummer + Code) → /lobby → /raum
STAFF:    /login (E-Mail + Passwort)
              ↓ is_admin=true  →  /admin
              ↓ is_admin=false →  /lehrer-start
```

---

## Routen

| Pfad | Komponente | Wer |
|------|-----------|-----|
| `/login` | StaffLoginPage | Admin + Lehrer |
| `/admin` | AdminDashboard | Admin |
| `/admin/lehrer` | AdminLehrer | Admin |
| `/admin/schueler` | AdminSchueler | Admin |
| `/admin/lektionen` | AdminLektionen | Admin |
| `/lehrer-login` | Redirect → `/login` | (rückwärtskompatibel) |
| `/lehrer-start` | TeacherStartPage | Lehrer (unverändert) |
| `/lehrer` | TeacherDashboard | Lehrer (unverändert) |
| `/` | LoginPage | Schüler (unverändert) |

---

## UI-Layout

### Admin-Panel (alle Seiten)

```
┌──────────────────────────────────────────────────────────┐
│  Fahrschul Classroom — Admin              [Abmelden]     │
├─────────────┬────────────────────────────────────────────┤
│  Dashboard  │                                             │
│  Lehrer     │         [Hauptbereich]                     │
│  Schüler    │                                             │
│  Lektionen  │                                             │
└─────────────┴────────────────────────────────────────────┘
```

### Dashboard `/admin`

3 Stat-Karten: Anzahl Lehrer / Schüler / Lektionen

### Verwaltungsseiten (gleiche Struktur)

```
[Titel]                               [+ Neu hinzufügen]
────────────────────────────────────────────────────────
Spalte 1    Spalte 2    Spalte 3      [✏ Bearbeiten] [✕]
...
```

### Modal (Erstellen / Bearbeiten)

```
┌─────────────────────────────────┐
│  [Titel]                        │
│                                 │
│  Feld 1  [                   ] │
│  Feld 2  [                   ] │
│  ...                            │
│                                 │
│  [Abbrechen]       [Speichern] │
└─────────────────────────────────┘
```

### Felder pro Entität

**Lehrer:** Name, E-Mail, Passwort (neu), Lektion (Dropdown), Admin-Rechte (Checkbox)

**Schüler:** Name, Handynummer (Format: +49...)

**Lektion:** Nummer (topic_number), Titel, Lehrer zuweisen (Dropdown)

---

## Datenbank

### Migration `004_admin_role.sql`

```sql
ALTER TABLE teachers ADD COLUMN is_admin BOOLEAN DEFAULT false;
```

### Erster Admin (einmalig manuell)

```sql
UPDATE teachers SET is_admin = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@fahrschule.de');
```

---

## Backend

### Neue Middleware

`backend/src/middleware/adminAuth.ts` — `requireAdmin`
- Prüft Supabase-Token + `is_admin = true` in `teachers` Tabelle
- 401 bei fehlendem Token, 403 bei fehlenden Rechten

### Neue Routen `backend/src/modules/admin/`

```
admin.routes.ts       ← Alle /api/admin/* Endpunkte
admin.service.ts      ← Business-Logik (Supabase Admin API für User-Mgmt)
```

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| GET | `/api/admin/lehrer` | Alle Lehrer |
| POST | `/api/admin/lehrer` | Lehrer anlegen (Auth + DB) |
| PUT | `/api/admin/lehrer/:id` | Lehrer bearbeiten |
| DELETE | `/api/admin/lehrer/:id` | Lehrer löschen |
| GET | `/api/admin/schueler` | Alle Schüler |
| POST | `/api/admin/schueler` | Schüler anlegen |
| PUT | `/api/admin/schueler/:id` | Schüler bearbeiten |
| DELETE | `/api/admin/schueler/:id` | Schüler löschen |
| GET | `/api/admin/lektionen` | Alle Lektionen |
| POST | `/api/admin/lektionen` | Lektion anlegen |
| PUT | `/api/admin/lektionen/:id` | Lektion bearbeiten |
| DELETE | `/api/admin/lektionen/:id` | Lektion löschen |
| GET | `/api/admin/stats` | Dashboard-Zahlen |

### User-Erstellung via Supabase Admin API

```typescript
// Supabase Admin API (service role key)
await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true })
// Dann: INSERT INTO teachers (id, full_name, lesson_id, is_admin)
```

---

## Frontend-Struktur

```
frontend/src/
  modules/
    auth/
      StaffLoginPage.tsx         ← NEU: /login (Admin + Lehrer)
    admin/
      AdminLayout.tsx            ← NEU: Sidebar + Header Wrapper
      AdminDashboard.tsx         ← NEU: /admin
      AdminLehrer.tsx            ← NEU: /admin/lehrer
      AdminSchueler.tsx          ← NEU: /admin/schueler
      AdminLektionen.tsx         ← NEU: /admin/lektionen
      AdminModal.tsx             ← NEU: Wiederverwendbares Formular-Modal
```

---

## Farbschema (konsistent mit Rest der App)

- Background: `#1a1a2e`
- Sidebar: `#16213e`
- Cards/Table rows: `#0f3460`
- Primary/Danger: `#e94560`
- Success: `#4ade80`
- Text muted: `#a8a8b3`
- Border: `#1a4a7a`

---

## Sicherheit

- `requireAdmin` Middleware auf allen `/api/admin/*` Endpunkten
- Frontend Auth-Guard: Prüft Session + `is_admin` beim Laden jeder Admin-Seite
- Passwort-Änderung läuft über Supabase Admin API (nie plaintext gespeichert)
- Selbst-Löschung verhindert: Admin kann sich nicht selbst löschen
