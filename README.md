# quassel

Wiederverwendbare Chat- und Panel-Bausteine für eigene Web-Projekte. Die Optik stammt aus
drei Quellen: einem KI-Chat (Schritte, Denken, Werkzeuge), pi-sessions (Farbwaschung
und Glas-Panel) und dem PXL-Studio (Eingabe-Karte mit Toolbar).

## Pakete

- **@quassel/foundation** - reines CSS, kein Framework: Design-Tokens (hell/dunkel),
  die vierfarbige Radial-Waschung (`.qsl-wash`), das Glas-Panel (`.qsl-panel`) und
  kleine Primitives (Feld, Geister-Knopf, Status-Punkt, Puls).
- **@quassel/chat-react** - composable React-Komponenten als Quellpaket:
  - `ChatMessages` - Verlauf mit Autoscroll, Zum-Ende-Knopf, fünf Detailgraden
    (aus / Symbole / kompakt / einzeilig / voll - die Chip-Modi stellen Schritte
    nebeneinander mit Umbruch), Klick-Popover für Denk- und Werkzeug-Schritte,
    Markdown-Antworten, Rückfrage-Karten, austauschbarem Working-Indikator
    (`working`-Prop). Ohne Eingabe read-only nutzbar.
  - `ChatInputPlain` - Textzeile plus Senden, Stop nur im Lauf.
  - `ChatInputToolbar` - Eingabe-Karte, Höhe über `rows`, eigene Knöpfe deklarativ
    über `actions` (Icon, Text oder beides) oder frei über die Slots links/rechts;
    Senden morpht im Lauf zu Stop, Tippen im Lauf wird zum Dazwischenfunken.
  - `applyEvent` - der Streaming-Kern als pure Funktion: `ChatEvent`-Strom rein,
    Nachrichtenliste raus. Transport (SSE, SignalR, Fake) bleibt Sache des Hosts.
- **@quassel/agent-node** - die Backend-Komponente für Node: Systemprompt, Konfiguration
  gegen OpenAI-kompatible Backends (OpenRouter, Ollama, vLLM; baseUrl, model, apiKey,
  temperature, topP, maxTokens, headers), optionale Tools, Stop und Zwischenrufe,
  Session-Persistenz über ein steckbares `SessionStore`-Interface (`FileSessionStore`,
  `MemorySessionStore`) und ein framework-freier HTTP/SSE-Adapter (`createChatHandler`).
  Der Agent spricht dieselbe Event-Sprache wie das Frontend.
- **@quassel/agent-pi** - der Pi Coding Agent als quassel-Backend, hinter demselben
  Event-Kontrakt und HTTP-Adapter. `PiChatConfig` macht alles einstellbar:
  `systemPrompt` (ersetzen) oder `appendSystemPrompt` (anhängen), `model`,
  `thinkingLevel`, `tools` (Auswahl oder leer = reiner Chat), `customTools`, `cwd`
  (Projekt-Skills und AGENTS.md), `sessionDir` (Persistenz) und `createOptions` als
  Fluchtluke. Ohne Angaben läuft Pi mit seiner normalen Konfiguration aus ~/.pi
  (Settings, Modelle, Skills, Extensions) - also so gut vorkonfiguriert wie die CLI.
- **@quassel/events** - die gemeinsame Sprache: `ChatEvent`-Typen und der pure
  Reducer `applyEvent`. Frontend und Backend teilen genau dieses Paket.
- **gallery** - die Schubladen-Demo (Vite): jede Komposition einmal live, mit
  geskriptetem Fake-Agenten inklusive Stop und Zwischenrufen - und einer
  Live-Schublade gegen den Beispiel-Server.

## Loslegen

```sh
pnpm install
pnpm dev        # Galerie auf http://localhost:3210

# Beispiel-Backend (fuer die Live-Schublade), Konfiguration per Env:
QUASSEL_BASE_URL=http://localhost:11434/v1 QUASSEL_MODEL=qwen3:4b \
  pnpm --filter @quassel/agent-node demo
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
