# Teacher Auth & UX — Design

## Problem

- `/lehrer` ist öffentlich zugänglich (kein Schutz)
- Kein Login für Lehrer
- Raum-Code muss manuell per API-Call generiert werden
- Kein zentraler Einstiegspunkt für Lehrer

## Lösung

Supabase Auth für Lehrer-Login + neues `/lehrer-start` als Schaltzentrale.

## User Flow

### Lehrer

```
/lehrer-login
  E-Mail + Passwort → Supabase Auth
  Prüfung role='teacher' in profiles
  ↓ Erfolg
/lehrer-start
  Lektionsliste mit aktivem Code + "Code generieren" + "Unterricht starten"
  ↓ Unterricht starten
/lehrer (Dashboard, wie bisher aber geschützt)
```

### Schüler (unverändert)
```
/ → Login → /lobby → /raum
```

## Datenbank

Neue Tabelle `teachers`:
```sql
id          UUID PK (= auth.uid())
full_name   TEXT
lesson_id   UUID FK → lessons(id)
```

Lehrer-Accounts werden manuell in Supabase Auth angelegt.

## Backend-Änderungen

| Endpunkt | Methode | Neu/Geändert |
|----------|---------|--------------|
| `/api/auth/teacher-login` | POST | NEU |
| `/api/auth/generate-code` | POST | Jetzt auth-geschützt |

`teacher-login`: Nimmt Supabase Access Token → gibt Backend-JWT `{ role: 'teacher', teacher_id, lesson_id }` zurück.

## Frontend-Änderungen

| Route | Status | Beschreibung |
|-------|--------|--------------|
| `/lehrer-login` | NEU | E-Mail + Passwort Form |
| `/lehrer-start` | NEU | Lektionsliste + Code-Generierung |
| `/lehrer` | geändert | Auth-Guard hinzufügen |
| `App.tsx` | geändert | Neue Routen registrieren |

## Sicherheit

- `/lehrer` und `/lehrer-start` prüfen Teacher-JWT im localStorage
- Kein JWT → redirect zu `/lehrer-login`
- `generate-code` Endpoint prüft serverseitig die Lehrer-Rolle
- Schüler-Seiten bleiben unverändert
