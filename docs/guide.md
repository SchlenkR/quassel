# quassel - Bau-Anleitung

Wiederverwendbare Chat- und Panel-Bausteine für Web-Projekte: React-Komponenten für
Verlauf und Eingabe, ein CSS-Fundament mit Farbwaschung und Glas-Panel, ein fertiges
Backend für OpenAI-kompatible Endpunkte und eine gemeinsame Event-Sprache dazwischen -
alles in einem npm-Paket `quassel`.

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
   - `quassel/server` - reiner LLM-Chat gegen ein OpenAI-kompatibles Backend.
     Dann klären: welcher Endpunkt (OpenRouter? lokales Ollama/vLLM/oMLX?), welches
     Modell, welcher Systemprompt, welche eigenen Tools, Temperature und Co.
   - Ein eigenes Backend, das den Event-Strom liefert (siehe Backends).
3. **Persistenz**: Sollen Unterhaltungen Prozess-Neustarts überleben? Wohin
   (`sessionDir` bzw. `FileSessionStore`-Verzeichnis)? Mehrere Sessions nebeneinander?
4. **Eingabe**: Keine oder die Karte mit Toolbar (`ChatInputToolbar`)? Bei der Karte: Höhe (`rows`), welche eigenen Knöpfe (`actions`)?
5. **Darstellung der Schritte**: Welcher Detailgrad als Default (`off` / `icons` /
   `chips` / `grouped` / `compact` / `full`)? Soll der Nutzer umschalten können? Eigener
   Working-Indikator?
6. **Optik**: Farbwaschung als Seitenhintergrund? Glas-Panels? Eigene Akzentfarbe,
   Radien, eigenes Stil-Preset (Token-Overrides)? Dark Mode automatisch oder per Toggle?
7. **Texte**: Die deutschen Default-Beschriftungen behalten oder über `texts` ersetzen?

Halte dich beim Bauen an diese Regeln:

- Frontend spricht mit Backends NUR über den Event-Kontrakt (`quassel/events`) und die
  HTTP-Routen des Adapters. Keine OpenAI-Details ins Frontend ziehen.
- Die Komponenten sind bewusst dumm: `messages` und Callbacks rein, Zustand und
  Transport gehören dem Host. Für die Anbindung an ein quassel-Backend nimm `useChat`.
- Style über Tokens (`--qsl-*`) und die vorhandenen Klassen, nicht durch Kopieren oder
  Forken der Komponenten-Styles. Eigene Looks = Token-Overrides auf einem Wrapper.
- Die Waschung besteht aus ZWEI Schichten: `.qsl-wash` (Hintergrund) plus davor eine
  durchscheinende Fläche wie `.qsl-panel`. Nur eine der beiden sieht flach aus.
- Die Galerie (`packages/gallery`) ist die Referenz: dort ist jede Komposition einmal
  lauffähig gebaut. Bei Unsicherheit dort abschauen.

## Einbinden

```sh
npm install quassel        # React 18 oder 19 bringt der Host selbst mit
```

| Import | Inhalt |
|---|---|
| `quassel` | React-Bausteine, `useChat`, Typen, `announce`, `markdownPlainText` |
| `quassel/events` | Event-Kontrakt und `applyEvent`, ohne React - auch fürs Backend |
| `quassel/server` | Backend für OpenAI-kompatible Endpunkte, nur Node |
| `quassel/chat.css` | Styles der Bausteine inklusive Tokens |
| `quassel/foundation.css` | Tokens, Farbwaschung und Glas-Panel für die ganze Seite |
| `quassel/base.css` | Reset, Body-Font, versteckte Scrollbars (opt-in) |

Im Repo selbst ist `quassel` ein Quellpaket (`packages/quassel`, TypeScript ohne Bauschritt);
die Galerie bindet es per `workspace:*` ein. Für lokale Entwicklung an quassel und einem Host
zugleich geht auch `"quassel": "link:../quassel/packages/quassel"` - dann kompiliert der
Bundler des Hosts die Quellen mit.

## quassel/events - der Kontrakt

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

## quassel - die Komponenten

Immer importieren: `import "quassel/chat.css"` (bringt die Tokens mit).

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
  announce?: false | ((announcement: ChatAnnouncement) => string | undefined);  // Screenreader-Ansage, siehe unten
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

#### Screenreader

Der Verlauf ist keine Live-Region: Streaming-Tokens, Schritte, Working-Indikator und Zeitstempel
werden nicht angesagt, während `running` trägt der Verlauf `aria-busy`. Angesagt wird nur, wenn eine
Assistenz-Antwort fertig ist (`closed` oder Lauf beendet) und wenn eine offene Rückfrage erscheint,
und zwar ihr Inhalt als Klartext (`markdownPlainText`). quassel bringt dafür keinen eigenen Satz mit.
Der Verlauf beim Einhängen und Schübe von mehr als zwei Nachrichten (Reset mit Replay) werden nicht angesagt.

- `announce` weggelassen: der Text der Antwort bzw. Rückfrage.
- `announce={(a) => ...}`: eigener Text je `ChatAnnouncement` (`{ kind: "reply" | "question", message }`), z.B. mit Präfix oder übersetzt; `undefined` bleibt still.
- `announce={false}`: quassel sagt nichts an, der Host übernimmt.

Die Senke `announce(text)` ist exportiert, damit der Host eigene Zustände wie Fehler oder Abbruch über
dieselbe Region ansagen kann: eine gemeinsame, versteckte `role="status"`-Region, 400 ms Abstand,
höchstens fünf wartende Ansagen, Pause bei verstecktem Tab, gleicher Text wird erneut angesagt.

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
ChatInputToolbar: { onSend; onStop?; running?; disabled?; rows?;      // Hoehe, Default 3
                    actions?: ToolbarAction[];                        // eigene Knoepfe
                    toolbarLeft?; toolbarRight?; texts? }             // freie Slots
ToolbarAction:    { icon?; label?; title?; disabled?; active?; onClick }
```

Verhalten: Enter sendet, Shift+Enter bricht um. Im Lauf morpht Senden zu Stop;
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

Rückfragen (Nachrichten mit `role: "question"`) rendert `ChatMessages` selbst als Karte mit
Einfach- oder Mehrfachauswahl und freier Antwortzeile; die Antwort kommt über `onAnswerQuestion`.

Exportiert sind außerdem `Markdown`, `markdownPlainText`, `announce`, `DetailModeSwitch`,
`TimestampSwitch`, `ChatPanel`, `stepState`, `DETAIL_MODES`, `detailModeLabel` und die Icons.
`ChatTexts`-Schlüssel (alle deutsch vorbelegt, über `texts` ersetzbar): working, toolRunning,
toolStillRunning, thinkingChip, stepGroupOne, stepGroupMany, stepGroupCollapse, thinkingTitle,
toolTitle, argumentsLabel, resultLabel, close, jumpToEnd, send, sendIntoRun, stop, placeholder,
steeringPlaceholder, timestamps, messageActions, questionSubmit, questionPlaceholder,
questionAnswer, copyMessage, copyCode, copied, copyFailed, editMessage, retryMessage,
detailModeTitle, detailModeOff, detailModeIcons, detailModeChips, detailModeGrouped,
detailModeCompact, detailModeFull.

## CSS-Fundament

`import "quassel/foundation.css"` = Tokens + Waschung + Panel. `quassel/base.css` (Reset, Body-Font,
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

Das Backend spricht einen HTTP/SSE-Adapter (`createChatHandler` aus `quassel/server`,
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

### quassel/server - reiner LLM-Chat, null Abhängigkeiten

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
`packages/quassel/examples/server.ts`.

## Loslegen

```sh
pnpm install
pnpm dev        # Galerie auf http://localhost:3210

# Beispiel-Backend für die Live-Schublade (OpenAI-kompatibel, Konfiguration per Env):
QUASSEL_BASE_URL=http://localhost:11434/v1 QUASSEL_MODEL=qwen3:4b pnpm demo:server   # Port 3300

pnpm check      # Typprüfung von Paket und Galerie
```

Die README-Bilder stammen aus `packages/gallery/showcase.html` (Szenen per
`?scene=agent|details|questions|party|themes`, dunkel mit `&theme=dark`).

## Veröffentlichen

```sh
pnpm release --dry-run   # baut packages/quassel/dist und zeigt den Inhalt des Pakets
pnpm release             # veröffentlicht auf npm
```

Vorher die Version in `packages/quassel/package.json` erhöhen; eine schon veröffentlichte
Version bricht ab. Das Skript (`scripts/publish.mjs`) prüft die Typen, bündelt die drei
Einstiege mit esbuild, erzeugt die Deklarationen mit tsc, kopiert das CSS und schreibt ein
eigenes `package.json` mit den gebauten Pfaden. Den Token nimmt es aus `NPM_TOKEN`, sonst
gilt die `.npmrc` des Benutzers.

## Rezepte

- **Transcript-Viewer**: `ChatMessages` mit fertigen `Message[]`, keine Eingabe.
- **Chat ohne Backend**: Events selbst erzeugen und per `applyEvent` reduzieren
  (Vorbild: `packages/gallery/src/fakeAgent.ts`).
- **Chat mit Backend**: Server aus dem passenden examples/server.ts ableiten, im
  Frontend `useChat` + `ChatMessages` + eine Eingabe.
- **Eigener Look**: Wrapper-Klasse mit Token-Overrides, siehe themes.css.
- **Eigenes Backend**: `ChatSessionProvider` implementieren, `createChatHandler`
  davorschalten - Frontend bleibt unverändert.
