# quassel

Wiederverwendbare Chat- und Panel-Bausteine für Web-Projekte: React-Komponenten für
Verlauf und Eingabe, ein CSS-Fundament mit Farbwaschung und Glas-Panel, zwei fertige
Backends (OpenAI-kompatibel und Pi Coding Agent) und eine gemeinsame Event-Sprache
dazwischen. Die Optik stammt aus einem KI-Chat, pi-sessions und dem PXL-Studio.

Dieses Dokument ist die Bau-Anleitung - auch und gerade für eine KI, die mit quassel
eine Anwendung bauen soll.

## Anweisung an die KI

Wenn du mit quassel eine Anwendung baust, KLÄRE ZUERST die folgenden Punkte mit dem
Nutzer, bevor du Code schreibst. Frage nur, was sich aus dem Auftrag nicht schon ergibt,
aber rate nicht bei Grundsatzentscheidungen:

1. **Art des Chats**: Nur anzeigen (read-only Verlauf, z.B. Transcript-Viewer)?
   Interaktiver Chat? Oder ein Agent, der Werkzeuge benutzt?
2. **Backend**:
   - KEINS - die App liefert die Nachrichten selbst (Fake, Datei, eigener Transport).
   - `@quassel/agent-node` - reiner LLM-Chat gegen ein OpenAI-kompatibles Backend.
     Dann klären: welcher Endpunkt (OpenRouter? lokales Ollama/vLLM/oMLX?), welches
     Modell, welcher Systemprompt, welche eigenen Tools, Temperature und Co.
   - `@quassel/agent-pi` - der Pi Coding Agent (Dateisystem, Bash, Skills, volle
     Systemrechte!). Dann klären: Pi-Standardkonfiguration aus ~/.pi übernehmen oder
     übersteuern (Systemprompt ersetzen/anhängen, Modell, Tool-Auswahl, cwd)?
3. **Persistenz**: Sollen Unterhaltungen Prozess-Neustarts überleben? Wohin
   (`sessionDir` bzw. `FileSessionStore`-Verzeichnis)? Mehrere Sessions nebeneinander?
4. **Eingabe**: Keine / schlicht (`ChatInputPlain`) / Karte mit Toolbar
   (`ChatInputToolbar`)? Bei der Karte: Höhe (`rows`), welche eigenen Knöpfe (`actions`)?
5. **Darstellung der Schritte**: Welcher Detailgrad als Default (`off` / `icons` /
   `chips` / `grouped` / `compact` / `full`)? Soll der Nutzer umschalten können? Eigener
   Working-Indikator?
6. **Optik**: Farbwaschung als Seitenhintergrund? Glas-Panels? Eigene Akzentfarbe,
   Radien, eigenes Stil-Preset (Token-Overrides)? Dark Mode automatisch oder per Toggle?
7. **Texte**: Die deutschen Default-Beschriftungen behalten oder über `texts` ersetzen?

Halte dich beim Bauen an diese Regeln:

- Frontend spricht mit Backends NUR über den Event-Kontrakt (`@quassel/events`) und die
  HTTP-Routen des Adapters. Keine Pi- oder OpenAI-Details ins Frontend ziehen.
- Die Komponenten sind bewusst dumm: `messages` und Callbacks rein, Zustand und
  Transport gehören dem Host. Für die Anbindung an ein quassel-Backend nimm `useChat`.
- Style über Tokens (`--qsl-*`) und die vorhandenen Klassen, nicht durch Kopieren oder
  Forken der Komponenten-Styles. Eigene Looks = Token-Overrides auf einem Wrapper.
- Die Waschung besteht aus ZWEI Schichten: `.qsl-wash` (Hintergrund) plus davor eine
  durchscheinende Fläche wie `.qsl-panel`. Nur eine der beiden sieht flach aus.
- Die Galerie (`packages/gallery`) ist die Referenz: dort ist jede Komposition einmal
  lauffähig gebaut. Bei Unsicherheit dort abschauen.

## Referenzierung

pnpm-Workspace intern: `"@quassel/chat-react": "workspace:*"`. Aus fremden lokalen
Projekten per `link:` (Quellpakete - der Bundler des Konsumenten kompiliert sie mit,
Änderungen in quassel sind sofort drüben; React 18 oder 19 muss der Konsument selbst
als Dependency haben):

```json
"@quassel/foundation": "link:../quassel/packages/foundation",
"@quassel/chat-react": "link:../quassel/packages/chat-react",
"@quassel/events": "link:../quassel/packages/events",
"@quassel/question-element": "link:../quassel/packages/question-element",
"@quassel/agent-node": "link:../quassel/packages/agent-node",
"@quassel/agent-pi": "link:../quassel/packages/agent-pi"
```

## @quassel/events - der Kontrakt

```ts
type ChatEvent =
  | { kind: "reset" }
  | { kind: "user"; text: string }
  | { kind: "text"; delta: string }            // Antwort-Delta
  | { kind: "thinking"; delta: string }        // Denk-Delta
  | { kind: "tool"; id: string; name: string; arguments: string; label?: string }
  | { kind: "tool-result"; id: string; result: string; isError?: boolean }
  | { kind: "question"; callId: string; text: string; options: string[] }
  | { kind: "question-answered"; callId: string; answer: string }
  | { kind: "system"; text: string }           // Fehler, "Abgebrochen." etc.
  | { kind: "status"; running: boolean }       // transient, wird nicht persistiert
  | { kind: "turn-done" };                     // schliesst den letzten offenen Block

applyEvent(messages: Message[], event: ChatEvent): Message[]   // purer Reducer
interface Message { key; role; text; closed?; tool?; question? }
type Role = "user" | "assistant" | "thinking" | "tool" | "system" | "question";
```

Aufeinanderfolgende `text`/`thinking`-Deltas verschmelzen mit dem letzten offenen Block;
jedes andere Event schließt ihn. Ein eigenes Backend ist quassel-kompatibel, sobald es
diesen Event-Strom liefert.

## @quassel/chat-react - die Komponenten

Immer importieren: `import "@quassel/chat-react/chat.css"` (setzt foundation-Tokens voraus).

### ChatMessages

```ts
{
  messages: Message[];
  detailMode?: "off" | "icons" | "chips" | "grouped" | "compact" | "full";  // Default "compact"
  running?: boolean;                    // zeigt Working-Indikator, Autoscroll haerter
  working?: ReactNode;                  // eigener Working-Indikator statt Pulszeile
  texts?: Partial<ChatTexts>;           // Beschriftungen ersetzen
  toolArgumentsText?: (tool: ToolInfo) => string;  // eigene Argument-Darstellung
  onAnswerQuestion?: (callId, text) => void;       // fuer Rueckfrage-Karten
  emptyState?: ReactNode;               // Anzeige bei leerem Verlauf
  className?: string;
  showTimestamps?: boolean;             // default false; displays Message.at as HH:MM
  bottomThreshold?: number;             // default 120 pixels; bottom tolerance for following and jump button
}
```

Eigener Scroll-Container mit Autoscroll (folgt nur, wenn man unten ist) und
Zum-Ende-Knopf. Detailgrade: `off` = nur Antworten; `icons` = Schritte als reine
Symbole nebeneinander; `chips` = Symbol + Kurztext nebeneinander mit Umbruch;
`grouped` = aufeinanderfolgende Schritte hinter einer Kopfzeile ("12 Schritte"), die sie
einzeilig auf- und zuklappt, ab 11 Schritten zusätzlich mit "Einklappen" am Ende der Gruppe;
`compact` = einzeilig; `full` = alles ausgeklappt. In `icons`/`chips`/`grouped`/`compact`
öffnet Klick auf einen Schritt ein Detail-Popover (Escape schließt). Ohne Eingabe read-only nutzbar.
Markdown in Antworten (Tabellen, Code, Listen) wird gerendert, streaming-fest.

#### Width and timestamps

The transcript uses the full available width without extra horizontal padding by default.
Hosts can set `--qsl-thread-max-width` (for example `760px`) and
`--qsl-thread-padding-inline` (for example `20px`) on a wrapper. Set the shared
`ChatPanel` width to constrain both transcript and composer together.

`showTimestamps` controls the optional timestamp column. `TimestampSwitch` is a controlled
button for `ChatInputToolbar.toolbarLeft` or `toolbarRight`; the host decides whether to
render it, owns the state and decides whether to persist it. Omitting the button leaves
`showTimestamps` independently configurable. Text comes from `texts.timestamps`;
`collapsible` (default true) hides the label in compact toolbars, and `className` customizes styling.

```tsx
const [showTimestamps, setShowTimestamps] = useState(false);

<ChatPanel composer={
  <ChatInputToolbar onSend={send} toolbarLeft={
    <TimestampSwitch showTimestamps={showTimestamps} onChange={setShowTimestamps} />
  } />
}>
  <ChatMessages messages={messages} showTimestamps={showTimestamps} bottomThreshold={120} />
</ChatPanel>
```

#### Optional chat configuration

All new settings are opt-in. They add no settings UI and do not persist preferences.
Hosts own configuration and action callbacks. Existing presentation and send behavior
remain the defaults when the props are omitted.

| Component / prop | Options | Default |
| --- | --- | --- |
| `ChatPanel.appearance`, `ChatMessages.appearance` | `fontSize`, `lineHeight`, `messageGap`, `denseMessageGap` | Existing 13px message text, line heights and 16px/8px gaps |
| Both inputs: `sendShortcut` | `"enter"`, `"mod-enter"` (Ctrl or Cmd + Enter) | `"enter"`; Shift+Enter inserts a newline |
| `ChatMessages.messageActions` | `copy` boolean/predicate, `edit`, `retry`, `custom` | No actions |
| `ChatMessages.timestampOptions` | `format`: `"time"`, `"date-time"`, `"relative"`; `locale`, `timeZone`, `showDaySeparators` | Local HH:MM; no day separators; timestamp column still controlled by `showTimestamps` |
| `ChatMessages.codeBlockOptions` | `wrap`, `maxHeight`, `showCopyButton` | No wrapping, no height limit, no copy button |
| `ChatMessages.bubbleOptions` | `variant`: `"default"`, `"plain"`, `"bubbles"`; `maxWidth`, `userSide`, `assistantSide`, `showSender`, `senderLabel(message)` | Existing bubbles, metadata labels and alignment; 86% width, 100% in narrow chats |
| `ChatPanel.scrollOnSend` | Boolean | `false`: no forced jump; ordinary following at the bottom remains active |

Appearance lengths accept CSS strings or numbers (pixels); numeric `lineHeight` is a
multiplier. Set appearance on `ChatPanel` to include its composer, or on `ChatMessages`
to style only the transcript. Bubble width overrides also apply in narrow chats. Explicit
side options override message metadata. `showSender: false` hides labels, `true` also
allows a role label when no metadata label exists; `senderLabel` supplies host labels.

Editing is offered for user messages and retry for assistant messages. Callbacks receive
the original message; the host opens its editor or performs the retry. Quassel does not
rewrite history or contact a model. `custom(message)` returns an array of
`{ id, label, icon?, disabled?, onClick(message) }`. Copy can be restricted with a predicate.
Async actions disable their button while pending and display errors. Copy uses the browser
clipboard API; unavailable or rejected access is shown as an error. All action labels can
be replaced through `texts`.

Day separators are independent of timestamp visibility, use the selected time zone,
and split groups of steps across day boundaries. Missing or invalid dates create no
separator or timestamp. Relative timestamps refresh while visible. Invalid Intl locale
or time zone options throw rather than silently changing the requested formatting.

`scrollOnSend` applies to the input and transcript in the same `ChatPanel`, after a
successful `onSend`. Empty, disabled or failed submissions do not trigger a jump. A
successful jump resumes following, including messages arriving after `onSend` resolves.
With `false`, sending preserves the reading position when the user has scrolled up.
Custom composers can perform their own scrolling via `scrollerRef`. Both provided inputs
accept async `onSend`, show failures, retain failed drafts and ignore IME composition
and repeated Enter events.

```tsx
<ChatPanel
  appearance={{ fontSize: 15, lineHeight: 1.7, messageGap: 20 }}
  scrollOnSend={true}
  composer={<ChatInputToolbar onSend={send} sendShortcut="mod-enter" />}
>
  <ChatMessages
    messages={messages}
    showTimestamps
    timestampOptions={{ format: "date-time", locale: "de-DE", timeZone: "Europe/Berlin", showDaySeparators: true }}
    codeBlockOptions={{ wrap: true, maxHeight: 320, showCopyButton: true }}
    bubbleOptions={{ maxWidth: "90%", showSender: false }}
    messageActions={{ copy: true, edit: openEditor, retry: retryAnswer }}
  />
</ChatPanel>
```

The exported option types are `ChatAppearance`, `TimestampOptions`, `CodeBlockOptions`,
`BubbleOptions`, `MessageAction`, `MessageActionsOptions` and `SendShortcut`. Standalone
Markdown can use `<MarkdownCodeBlocks options={...} texts={...}>` around `<Markdown>`.

#### Schritt-Zustände

`stepState(message): "running" | "thinking" | "done" | "error"` ist die einzige Ableitung:
Werkzeug ohne Ergebnis = `running`, offener Denk-Block = `thinking`, `isError` = `error`,
sonst `done`. In `icons`/`chips` trägt jeder Chip die Klasse `qsl-chip--<zustand>`:
`running`/`thinking` pulsen mit angedeuteter Akzent-Kontur, `error` bekommt rotes Symbol
und rötliche Kontur, `done` ein kleines Häkchen und einen leicht gedämpften Chip. Das
Häkchen sitzt in einem festen Feld, der Zustandswechsel ändert die Chipbreite also nicht.

### DetailModeSwitch

```ts
{
  mode: DetailMode;
  onChange: (mode: DetailMode) => void;
  modes?: readonly DetailMode[];  // Auswahl und Reihenfolge, Default alle sechs
  collapsible?: boolean;          // false = Beschriftung bleibt auch schmal stehen
  texts?: Partial<ChatTexts>;
  className?: string;
}
```

Ein Knopf, der den Detailgrad weiterschaltet und den aktuellen als Beschriftung zeigt.
Gedacht fuer die Toolbar (`toolbarLeft`) oder eine eigene Kopfzeile; der Host haelt den
Wert und reicht ihn an `ChatMessages.detailMode` weiter. `detailModeLabel(mode, texts)`
liefert dieselbe Beschriftung fuer eigene Bedienelemente, `DETAIL_MODES` die Reihenfolge.

### Eingaben

```ts
ChatInputPlain:   { onSend; onStop?; running?; disabled?; showHint?; texts? }
ChatInputToolbar: { onSend; onStop?; running?; disabled?; rows?;      // Hoehe, Default 3
                    actions?: ToolbarAction[];                        // eigene Knoepfe
                    toolbarLeft?; toolbarRight?; texts? }             // freie Slots
ToolbarAction:    { icon?; label?; title?; disabled?; active?; onClick }
```

Verhalten beider: Enter sendet, Shift+Enter bricht um. Im Lauf morpht Senden zu Stop;
Tippen im Lauf wird zum Dazwischenfunken (Titel "In den laufenden Lauf schicken").
Bei schmalem Panel (< 480px, per ResizeObserver) verschwinden `.qsl-collapsible`-Texte,
Icons bleiben. `actions` mit `label` ohne `icon` ergibt reine Text-Knöpfe.

### useChat - Anbindung an ein quassel-Backend

```ts
const { messages, running, connected, send, stop } = useChat("http://host:port/chat/<session-id>");
```

Dauerhafter SSE-Strom (`GET .../stream`): erst Verlauf-Replay, dann live; Reconnect
nach 3s. `send` = `POST .../send`, `stop` = `POST .../stop`.

### Sonstiges

`QuestionCard` ist die Rückfrage-Karte für React; ihre Optik liegt in
`@quassel/question-element/question.css`, die `chat.css` mitimportiert - für Hosts ohne React
gibt es dieselbe Karte als `<qsl-question>` (siehe unten).

`Markdown`, `QuestionCard`, `StepPopover`, `DetailModeSwitch`, Icons (`IconSend`, `IconStop`, `IconX`,
`IconChevronDown`, `IconChevronRight`, `IconLayers`, `IconCheck`, `IconSpark`, `IconTool`) sind einzeln exportiert.
`ChatTexts`-Schlüssel (alle deutsch vorbelegt): working, toolRunning, toolStillRunning,
thinkingChip, stepGroupOne, stepGroupMany, stepGroupCollapse, thinkingTitle, toolTitle, argumentsLabel, resultLabel, close, jumpToEnd,
send, sendIntoRun, stop, placeholder, steeringPlaceholder, inputHint, detailModeTitle,
detailModeOff, detailModeIcons, detailModeChips, detailModeGrouped, detailModeCompact, detailModeFull.

## @quassel/question-element - die Rückfrage-Karte ohne Framework

`<qsl-question>` ist dieselbe Karte wie `QuestionCard`, nur als Custom Element - für Hosts
ohne React (Vanilla-JS-Canvas, Server-gerendertes HTML, andere Frameworks). Reines
JavaScript, kein Bauschritt, keine Abhängigkeiten: die Datei ist direkt ladbar.

```html
<link rel="stylesheet" href="/vendor/question.css">
<script type="module" src="/vendor/qsl-question.js"></script>

<qsl-question text="Welchen Zeitraum?" options='["Woche","Monat"]'></qsl-question>
```

```js
const karte = document.createElement("qsl-question");
karte.text = "Welche Anlagen sollen mit hinein?";
karte.options = ["Halle 1", "Halle 2", "Kesselhaus"];
karte.multi = true;
karte.dismissible = true;
karte.addEventListener("answer", (event) => {
  karte.busy = true;                       // Antwort unterwegs
  send(event.detail.value).then(() => { karte.busy = false; karte.answer = event.detail.value; });
});
karte.addEventListener("dismiss", () => karte.remove());
raum.appendChild(karte);
```

**Eigenschaften** (jeweils auch als Attribut, Boolesche als An-/Abwesenheit):

```
text          string    Fragetext
options       string[]  Optionen; als Attribut JSON-Array oder eine Option je Zeile
multi         boolean   Mehrfachauswahl mit Kästchen und "Auswahl übernehmen"
placeholder   string    Freitext-Platzhalter, Default "... oder frei antworten"
answer        string    gesetzt = beantwortet: die Karte ist nur noch Beleg (Häkchen + Text)
disabled      boolean   nichts anklickbar
busy          boolean   Antwort unterwegs: gedämpft (qsl-question--busy) und nimmt nichts an
dismissible   boolean   zeigt den Verwerfen-Knopf, der dismiss auslöst
submit-label / answer-label / dismiss-label   Beschriftungen ersetzen (nur als Attribut)
selectedOptions / freeText                    schreibgeschützter Blick auf den Zwischenstand
```

**Ereignisse** (beide `bubbles` und `composed`, ein Host kann also delegieren):

```
answer   CustomEvent<{ options: string[]; text: string; value: string }>
dismiss  CustomEvent<void>
```

Eigenschaften dürfen bei jedem Render neu gesetzt werden: gleiche Werte sind folgenlos,
auch `options` - Auswahl und Entwurfstext überleben das. Ein Host, der die Karte über
Renderzyklen hinweg am Leben halten will, hält das Element selbst fest (nicht sein Markup)
und hängt es wieder ein; Entwurf und Auswahl hängen an der Instanz.

`value` ist der fertige Antworttext und entspricht genau dem, was `QuestionCard.onAnswer`
liefert: Einfachauswahl = die Option, Mehrfachauswahl = die Auswahl mit `"; "` verbunden,
Freitext = der getippte Text. `options` und `text` liegen daneben, wenn ein Host beides
getrennt braucht. Das Element wechselt nach einer Antwort NICHT von selbst in den
Beleg-Zustand - der Host setzt `busy` und danach `answer`, so wie im React-Chat auch.

**CSS-Voraussetzung**: `question.css` aus diesem Paket (enthält alle `.qsl-question*`-Regeln)
plus die `--qsl-*`-Tokens - entweder aus `@quassel/foundation` oder aus eigenen Token-Werten
des Hosts. `chat.css` importiert dieselbe Datei, React-Karte und Element sehen deshalb
zwangsläufig gleich aus; wer den Chat schon lädt, braucht nichts zusätzlich einzubinden.

**Light DOM, kein Shadow DOM** - bewusst so: die Hosts laufen unter
`style-src 'self'` ohne `unsafe-inline`, ein `<style>`-Block im Shadow-Root wäre dort
blockiert. Bliebe `adoptedStyleSheets` (formal an der CSP vorbei, aber nur mit
zusätzlichem Fetch der CSS) - und die Karte hätte dann ein eigenes Stylesheet statt
desselben wie die React-Karte. Light DOM heißt: das Element trägt selbst die Klasse
`qsl-question`, füllt sich mit den bekannten Kind-Klassen und erbt Tokens, Theme-Overrides
und Schrift des Hosts. Inline-Styles setzt es keine.

## @quassel/foundation - CSS-Fundament

`import "@quassel/foundation"` = Tokens + Waschung + Panel. `base.css` (Reset, Body-Font,
versteckte Scrollbars) ist bewusst separat und opt-in.

- **Tokens** auf `:root`: `--qsl-ink`, `--qsl-muted`, `--qsl-line`, `--qsl-line-soft`,
  `--qsl-surface`, `--qsl-panel`, `--qsl-content`, `--qsl-accent`, `--qsl-danger`,
  `--qsl-success`, `--qsl-app-bg`, `--qsl-text`, `--qsl-shadow-bar`, `--qsl-shadow-pop`,
  `--qsl-mono`, `--qsl-font`, `--qsl-radius-panel` (14px), `--qsl-radius-large` (12px),
  `--qsl-radius` (8px), `--qsl-radius-small` (4px), `--qsl-wash-1..4`.
- **Dark Mode**: folgt `prefers-color-scheme`; `data-theme="dark"|"light"` auf `<html>`
  übersteuert.
- **`.qsl-wash`**: vierfarbige Radial-Waschung. Auf `body` fixed und viewportfüllend,
  auf Containern absolut (dann `.qsl-wash--clip` dazu). Wirkt nur mit einer
  durchscheinenden Fläche davor.
- **`.qsl-panel`**: Glas-Panel (color-mix + backdrop-blur), mit `__head`, `__body`
  (scrollt), `__foot`. Primitives: `.qsl-field`, `.qsl-ghost` (+`--active`),
  `.qsl-label`, `.qsl-dot` (+`--live`, `--working`), `.qsl-pulse`.
- **Eigener Look**: Wrapper-Klasse, die Tokens überschreibt - kein Komponenten-Code.
  Beispiele in `packages/gallery/src/themes.css` (Tinte, Abendrot, Smaragd).

## Backends

Beide sprechen denselben HTTP/SSE-Adapter (`createChatHandler` aus agent-node,
framework-frei für `node:http`, CORS eingebaut):

```
GET    <prefix>/:id/stream    SSE: reset, Verlauf, status, dann live (+ Pings)
POST   <prefix>/:id/send      { text } - startet Lauf oder funkt dazwischen
POST   <prefix>/:id/stop      bricht den laufenden Turn ab
GET    <prefix>/sessions      [{ id, title, updatedAt }]
DELETE <prefix>/:id
```

Session-Ids: `[A-Za-z0-9_-]{1,64}`. Der Handler nimmt jedes Objekt, das
`ChatSessionProvider` erfüllt (`get`/`list`/`delete` mit Sessions aus
`running`/`subscribe`/`send`/`stop`) - so entstehen weitere Backends.

### @quassel/agent-node - reiner LLM-Chat, null Abhängigkeiten

```ts
const manager = new SessionManager(
  {
    baseUrl: "http://localhost:11434/v1",   // OpenAI-kompatibel
    model: "qwen3:4b",
    apiKey: undefined,                            // optional
    systemPrompt: "Du bist ...",
    temperature: 0.7, topP: undefined, maxTokens: undefined, headers: {},
    tools: [{ name, description, parameters, run: async (args) => "..." }],
  },
  new FileSessionStore("./.sessions"),            // oder MemorySessionStore / eigenes SessionStore
);
const handler = createChatHandler({ manager });   // prefix Default "/chat"
```

Agent-Loop mit Tool-Runden (max 12), Steering-Queue wird am Runden-Ende eingespeist,
Stop per AbortController. Denk-Anteile: `reasoning`-Feld (OpenRouter) und
`<think>`-Tags (Ollama) landen beide als thinking-Events. Vorlage:
`packages/agent-node/examples/server.ts`.

### @quassel/agent-pi - der Pi Coding Agent

Voller Coding-Agent (read/bash/edit/write, Skills, Extensions, AGENTS.md). ACHTUNG:
volle Systemrechte - Tool-Auswahl bewusst treffen, Server nicht ungeschützt exponieren.

```ts
const manager = new PiSessionManager({
  systemPrompt: "...",           // ersetzt den Pi-Prompt komplett
  appendSystemPrompt: "...",     // ODER: haengt nur eigene Regeln an
  model: { provider: "omlx", id: "..." },   // statt Pi-Default
  thinkingLevel: "medium",
  tools: ["read", "grep"],       // Auswahl; [] = reiner Chat ohne Tools
  customTools: [meinTool],       // Pi defineTool()
  cwd: "/pfad/zum/projekt",      // Projekt-Skills, AGENTS.md, Tool-Pfade
  sessionDir: "./.pi-sessions",  // Persistenz; weglassen = im Speicher
  createOptions: { ... },        // Fluchtluke zu createAgentSession
});
```

ALLES optional: ohne Angaben läuft Pi mit seiner normalen Konfiguration aus `~/.pi`
(Settings, Modelle, Auth, Skills, Extensions) - so gut vorkonfiguriert wie die CLI.
`steer()` ist das Dazwischenfunken, `abort()` der Stop. Bei `sessionDir` überleben
Unterhaltungen Neustarts (Zuordnung in `sessionDir/quassel-ids.json`, Verlauf wird aus
der Pi-Session-Datei rekonstruiert). Vorlage: `packages/agent-pi/examples/server.ts`.

## Loslegen

```sh
pnpm install
pnpm dev        # Galerie auf http://localhost:3210

# Beispiel-Backend fuer die Live-Schublade (OpenAI-kompatibel, Konfiguration per Env):
QUASSEL_BASE_URL=http://localhost:11434/v1 QUASSEL_MODEL=qwen3:4b \
  pnpm --filter @quassel/agent-node demo          # Port 3300

# Beispiel-Backend fuer die Pi-Schublade (nutzt die Pi-Konfiguration aus ~/.pi):
pnpm --filter @quassel/agent-pi demo              # Port 3301
```

## Rezepte

- **Transcript-Viewer**: `ChatMessages` mit fertigen `Message[]`, keine Eingabe.
- **Chat ohne Backend**: Events selbst erzeugen und per `applyEvent` reduzieren
  (Vorbild: `packages/gallery/src/fakeAgent.ts`).
- **Chat mit Backend**: Server aus dem passenden examples/server.ts ableiten, im
  Frontend `useChat` + `ChatMessages` + eine Eingabe.
- **Eigener Look**: Wrapper-Klasse mit Token-Overrides, siehe themes.css.
- **Eigenes Backend**: `ChatSessionProvider` implementieren, `createChatHandler`
  davorschalten - Frontend bleibt unverändert.
