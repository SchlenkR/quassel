# quassel

Wiederverwendbare Chat- und Panel-Bausteine für eigene Web-Projekte. Die Optik stammt aus
drei Quellen: einem KI-Chat (Schritte, Denken, Werkzeuge), pi-sessions (Farbwaschung
und Glas-Panel) und dem PXL-Studio (Eingabe-Karte mit Toolbar).

## Pakete

- **@quassel/foundation** - reines CSS, kein Framework: Design-Tokens (hell/dunkel),
  die vierfarbige Radial-Waschung (`.qsl-wash`), das Glas-Panel (`.qsl-panel`) und
  kleine Primitives (Feld, Geister-Knopf, Status-Punkt, Puls).
- **@quassel/chat-react** - composable React-Komponenten als Quellpaket:
  - `ChatMessages` - Verlauf mit Autoscroll, Zum-Ende-Knopf, Detailgrad
    (aus / einzeilig / voll), Klick-Popover für Denk- und Werkzeug-Schritte,
    Markdown-Antworten, Rückfrage-Karten. Ohne Eingabe read-only nutzbar.
  - `ChatInputPlain` - Textzeile plus Senden, Stop nur im Lauf.
  - `ChatInputToolbar` - Eingabe-Karte mit Toolbar-Slots (links/rechts), Senden
    morpht im Lauf zu Stop, Tippen im Lauf wird zum Dazwischenfunken.
  - `applyEvent` - der Streaming-Kern als pure Funktion: `ChatEvent`-Strom rein,
    Nachrichtenliste raus. Transport (SSE, SignalR, Fake) bleibt Sache des Hosts.
- **gallery** - die Schubladen-Demo (Vite): jede Komposition einmal live, mit
  geskriptetem Fake-Agenten inklusive Stop und Zwischenrufen.

## Loslegen

```sh
pnpm install
pnpm dev        # Galerie auf http://localhost:3210
```

## Verwenden in einem Projekt

```tsx
import "@quassel/foundation";
import "@quassel/chat-react/chat.css";
import { ChatMessages, ChatInputToolbar, applyEvent } from "@quassel/chat-react";
```

Die Komponenten sind bewusst dumm: sie bekommen `messages` und Callbacks, Zustand und
Transport gehören dem Host. Texte sind deutsch vorbelegt und über die `texts`-Prop
austauschbar. Dark Mode folgt `prefers-color-scheme`, ein Host kann mit
`data-theme="dark"` oder `data-theme="light"` auf `<html>` übersteuern.
