# Bedienungsanleitung – Fahrschul Classroom

## Vorbereitung (einmalig, Fahrschule)

Bevor Schüler das System nutzen können, müssen folgende Daten in Supabase eingegeben sein:

### Schüler anlegen (Tabelle `students`)

| Spalte         | Beispiel              |
|----------------|-----------------------|
| `phone_number` | `+4915112345678`      |
| `full_name`    | `Max Mustermann`      |
| `is_active`    | `true`                |

### Lektion anlegen (Tabelle `lessons`)

| Spalte         | Beispiel              |
|----------------|-----------------------|
| `topic_number` | `1`                   |
| `title`        | `Verkehrszeichen`     |
| `status`       | `entwurf`             |

---

## Für den Lehrer

### 1. Einloggen

Öffne im Browser:

```
http://frontend.178.104.27.147.traefik.me/lehrer-login
```

Gib deine **E-Mail-Adresse** und dein **Passwort** ein. Du wirst zu `/lehrer-start` weitergeleitet.

> Bist du bereits eingeloggt, wirst du automatisch zu `/lehrer-start` weitergeleitet.

### 2. Raum-Code generieren

Auf der Startseite (`/lehrer-start`) siehst du deine zugewiesene Lektion.

1. Klicke auf **"🔑 Code generieren"** — ein 6-stelliger Code erscheint (z.B. `XK7R2M`)
2. Gib diesen Code an deine Schüler weiter (Tafel, WhatsApp, mündlich)
3. Optional: Klicke auf **"🔄 Neuen Code generieren"** um den alten Code zu ersetzen

### 3. Unterricht starten

Klicke auf **"▶ Unterricht starten"** — du wirst zum Lehrer-Dashboard weitergeleitet.

> Der Button ist erst aktiv nachdem ein Code generiert wurde.

### 4. Lehrer-Dashboard öffnen (direkt)

Navigiere zu: `http://frontend.178.104.27.147.traefik.me/lehrer`

> Ohne aktive Lehrer-Session wird automatisch zu `/lehrer-login` weitergeleitet.

### 5. Das Lehrer-Dashboard

Das Dashboard besteht aus zwei Bereichen:

```
┌─────────────────────────────┬──────────────────┐
│                             │  RAUM-CODE       │
│       Jitsi Video           │  XK7R2M          │
│       (Hauptbereich)        │──────────────────│
│                             │ Präsenz-Check    │
│  [Canvas überlagert         │ Alle stumm       │
│   wenn aktiv]               │ Bildschirm teilen│
│                             │ Zeichnen         │
│                             │──────────────────│
│                             │ SCHÜLER (3 online│
│                             │ ● Max M.   3/4   │
│                             │ ● Anna S.  4/4  🖐│
│                             │ ○ Tom B.   2/4   │
└─────────────────────────────┴──────────────────┘
```

### 6. Buttons in der Sidebar

| Button           | Farbe  | Funktion                                          |
|------------------|--------|---------------------------------------------------|
| Präsenz-Check    | gelb   | Startet 120s Anwesenheits-Check bei allen Schülern|
| Alle stumm       | lila   | Schaltet alle Mikrofone in Jitsi stumm            |
| Bildschirm teilen| cyan   | Aktiviert Bildschirmfreigabe in Jitsi             |
| Zeichnen         | grün   | Aktiviert Zeichenfläche über dem Video            |
| Zeichnen beenden | rot    | Deaktiviert Zeichenfläche                         |

### 7. Zeichnen

1. Klicke "Zeichnen" → Button wird rot ("Zeichnen beenden")
2. Eine transparente Fläche erscheint über dem Video
3. Werkzeuge oben rechts:
   - **Farbfeld**: Klicken zum Ändern der Stiftfarbe
   - **Slider**: Strichstärke 1–20px
   - **Löschen**: Leert die gesamte Zeichenfläche
4. Mit Maus/Stift zeichnen — Schüler sehen alles live
5. "Zeichnen beenden" zum Deaktivieren

### 8. Anwesenheits-Check durchführen

1. Klicke "Präsenz-Check"
2. Bei allen Schülern erscheint ein Overlay mit 120s Countdown
3. Schüler die reagieren erscheinen in der Schülerliste mit erhöhtem Zähler
4. Nach 120s endet der Check automatisch
5. In der Schülerliste siehst du `{bestätigt}/{gesamt}` pro Schüler

### 9. Schüler-Mikrofon freischalten

1. Schüler hebt die Hand (in seiner App)
2. In der Schülerliste erscheint ein roter "Mic"-Button neben dem Schüler
3. Klicke "Mic" → der Schüler wird benachrichtigt und kann sprechen

### 10. Schülerliste verstehen

```
● Max Mustermann    3/4     ← online, 3 von 4 Checks bestätigt
○ Anna Schmidt      2/4     ← offline/disconnected
● Tom Bauer         4/4  Mic ← online, Hand erhoben → Mic-Button
```

- **Grüner Punkt**: Schüler ist gerade verbunden
- **Grauer Punkt**: Schüler hat die Verbindung getrennt
- **Zahl X/Y**: X = bestätigte Anwesenheitschecks, Y = gestartete Checks

---

## Für den Schüler

### 1. App öffnen

Öffne im Browser (Handy oder PC):

```
http://frontend.178.104.27.147.traefik.me
```

> **Tipp:** Auf dem Handy: Browser → Seite aufrufen → "Zum Startbildschirm hinzufügen" für App-Feeling.

### 2. Login

Auf der Startseite erscheint das Login-Formular:

```
┌────────────────────────┐
│   Fahrschul Classroom  │
│                        │
│  HANDYNUMMER           │
│  [+49 151 12345678   ] │
│                        │
│  RAUM-CODE             │
│  [   ABC123          ] │
│                        │
│  [     Eintreten     ] │
└────────────────────────┘
```

**Handynummer:** Die Nummer, die beim Fahrlehrer hinterlegt ist (mit +49, ohne 0 am Anfang)

**Raum-Code:** Den 6-stelligen Code den du von deinem Fahrlehrer bekommst (z.B. `XK7R2M`)

Klicke "Eintreten". Wenn alles stimmt, kommst du in den Warteraum.

### 3. Mögliche Fehlermeldungen

| Fehlermeldung                   | Bedeutung                                      |
|---------------------------------|------------------------------------------------|
| Bitte alle Felder ausfüllen     | Handynummer oder Code fehlt                    |
| Ungültiger oder abgelaufener Code | Code falsch oder Stunde hat noch nicht begonnen |
| Handynummer nicht registriert   | Nummer ist noch nicht beim Fahrlehrer eingetragen |

### 4. Im Unterricht (Schüler-Ansicht)

Nach dem Login siehst du das Jitsi-Video mit deinem Fahrlehrer und den anderen Schülern.

**Was du siehst:**
- Video-Konferenz mit Kamera und Mikrofon
- Wenn der Lehrer zeichnet: Striche über dem Video

### 5. Anwesenheits-Check bestätigen

Wenn der Fahrlehrer eine Anwesenheitskontrolle startet, erscheint ein Overlay:

```
┌────────────────────────┐
│         👋              │
│   Bist du noch dabei?  │
│                        │
│          87s           │
│                        │
│  [    Ich bin da!    ] │
└────────────────────────┘
```

**Wichtig:** Klicke auf "Ich bin da!" bevor der Countdown auf 0 läuft!

- Wenn die Zeit auf 30 Sekunden fällt, wird der Countdown **rot** (dringlich)
- Nach dem Klicken erscheint ✅ und die Meldung "Präsenz bestätigt!"
- Das Overlay verschwindet wenn der Lehrer den Check beendet

### 6. Hand heben

> Die Hand-heben-Funktion wird vom Backend unterstützt (Socket-Events vorhanden), das UI für Schüler ist in Entwicklung.

---

## Häufige Fragen

**Q: Der Raum-Code wird nicht akzeptiert.**
A: Stelle sicher dass die Stunde bereits vom Lehrer gestartet wurde. Codes laufen nach 8 Stunden ab.

**Q: Mein Name erscheint in Jitsi falsch.**
A: Der Name wird automatisch aus der Datenbank geladen (2 Sekunden nach Verbindungsaufbau gesetzt).

**Q: Das Video läuft nicht.**
A: Jitsi benötigt HTTPS auf dem eigenen Gerät. Unter Chrome: Einstellungen → Datenschutz → Kamera/Mikrofon erlauben. Der Browser muss Kamera/Mikrofon-Zugriff erlauben.

**Q: Der Anwesenheits-Check erscheint nicht.**
A: Überprüfe deine Internetverbindung. Die Socket.io-Verbindung muss aktiv sein.

**Q: Kann ich die App auf dem Handy installieren?**
A: Ja. In Chrome/Safari: Menü → "Zum Startbildschirm hinzufügen".

---

## System-URLs

| Was                  | URL                                                               |
|----------------------|-------------------------------------------------------------------|
| Schüler-Login        | http://frontend.178.104.27.147.traefik.me/                        |
| Lehrer-Login         | http://frontend.178.104.27.147.traefik.me/lehrer-login            |
| Lehrer-Startseite    | http://frontend.178.104.27.147.traefik.me/lehrer-start            |
| Lehrer-Dashboard     | http://frontend.178.104.27.147.traefik.me/lehrer                  |
| Backend API          | http://backend.178.104.27.147.traefik.me                          |
| Jitsi (direkt)       | https://jitsi.178.104.27.147.traefik.me                           |
| Dokploy Admin        | http://178.104.27.147:3000                                        |
| Supabase Studio      | http://fuehrerscheinfragenapp-supabase-...-traefik.me             |
