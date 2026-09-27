# quassel - Bau-Anleitung

quassel ist der Chat von RAgents als eigenständige React-Bibliothek: Verlauf mit Denk- und
Werkzeug-Schritten, wartende Aktionen, Eingabe-Karte mit Anhängen und Dazwischenfunken, ein
Event-Kontrakt, der auch im Backend läuft, und ein fertig kompiliertes Stylesheet. Die
Standardoptik ist die von RAgents (hell und dunkel); ein Host passt sie über `--qsl-*`-Variablen
und eigene Grundbausteine an.

Dieses Dokument ist die Bau-Anleitung - auch und gerade für eine KI, die mit quassel eine
Anwendung bauen soll.

## Anweisung an die KI

Wenn du mit quassel eine Anwendung baust, KLÄRE ZUERST die folgenden Punkte mit dem Nutzer,
bevor du Code schreibst. Frage nur, was sich aus dem Auftrag nicht schon ergibt, aber rate nicht
bei Grundsatzentscheidungen:

1. **Art des Chats**: Nur anzeigen (Verlauf ohne Eingabe)? Interaktiver Chat? Oder ein Agent,
   der Werkzeuge benutzt und auf Eingaben wartet (Aktionen)?
2. **Backend**: Woher kommen die Events? quassel bringt KEIN Backend und keinen Transport mit.
   Der Host liefert einen Strom von `ChatEvent`s (SSE, WebSocket, RPC, Fake) und reduziert ihn
   mit `applyEvent`. Senden, Stoppen, Verwerfen sind Callbacks des Hosts.
3. **Eingabe**: Karte (`layout="card"`), einzeilig (`"inline"`) oder als Leiste (`"toolbar"`)?
   Anhänge erlaubt (`attachments`)? Eigene Knöpfe (`actions`, `toolbarLeft`, `toolbarRight`)?
4. **Schritte**: Welcher Detailgrad als Default (`current`, `off`, `icons`, `chips`, `grouped`,
   `compact`, `full`)? Soll der Nutzer umschalten können (`DetailModeSwitch`)?
5. **Optik**: RAgents-Standard oder eigene Farben, Radien, Schrift (`--qsl-*`)? Dark Mode fest,
   per Umschalter oder nach System? Eigene Grundbausteine des Host-Designsystems (`QuasselProvider`)?
6. **Styles im Host**: Hat der Host Tailwind? Ohne Tailwind reicht `quassel/chat.css`.
7. **Texte**: Die deutschen Default-Beschriftungen behalten oder über `texts` ersetzen?

Halte dich beim Bauen an diese Regeln:

- Die Komponenten sind bewusst dumm: `messages` und Callbacks rein, Zustand und Transport
  gehören dem Host. Frontend und Backend sprechen nur über `quassel/events`.
- Style über `--qsl-*`-Variablen auf einem Wrapper und über Slots, nicht durch Kopieren oder
  Forken der Komponenten.
- Klassen, die der Host über `className` an quassel-Komponenten gibt, sind Host-Klassen; quassel
  selbst nutzt nur Klassen mit Präfix `qsl:`.
- Die Galerie (`packages/gallery`) ist die Referenz: dort ist jede Komposition einmal lauffähig
  gebaut, mit Fake-Daten.

## Einbinden

```sh
npm install quassel        # React 18 oder 19 bringt der Host selbst mit
```

| Import | Inhalt |
|---|---|
| `quassel` | React-Bausteine, `QuasselProvider`, Typen, Texte, `announce`, `markdownPlainText` |
| `quassel/events` | Event-Kontrakt, `applyEvent`, Anhang-Grenzen und -Prüfung, ohne React - auch fürs Backend |
| `quassel/chat.css` | Kompiliertes Stylesheet: Theme-Variablen, gekapselter Reset, alle genutzten Utilities |

Laufzeit-Abhängigkeiten: `@base-ui/react`, `class-variance-authority`, `cn`, `lucide-react`,
`streamdown`. Im Repo ist `quassel` ein Quellpaket (`packages/quassel`, TypeScript ohne
Bauschritt, `chat.css` aus `build/`); die Galerie bindet es per `workspace:*` ein.

## quassel/events - der Kontrakt

```ts
type ChatEvent =
  | { kind: "reset"; reason?: "conversation-reset"; conversationId: string | null }
  | { kind: "replay-end"; conversationId: string | null }      // Verlauf nachgespielt, ab jetzt live
  | { kind: "user"; text: string; inputId?: string; at?: string; attachments?: ChatAttachment[] }
  | { kind: "steered"; inputId: string }                          // Eingabe lief in den laufenden Turn
  | { kind: "text"; delta: string; at?: string; cursor: ChatTextCursor }
  | { kind: "thinking"; delta: string; at?: string }
  | { kind: "tool"; id: string; name: string; arguments: string; label?: string; at?: string }
  | { kind: "tool-result"; id: string; result: string; isError?: boolean }
  | { kind: "action"; actionId: string; owner: string | null; text: string; payload: unknown; at?: string }
  | { kind: "action-resolved"; actionId: string; status: "approved" | "dismissed"; result: unknown }
  | { kind: "system"; text: string; at?: string }                 // Fehler, Abbruch und Ähnliches
  | { kind: "status"; running: boolean; startup?: ChatStartupStatus }  // transient
  | { kind: "turn-done" }                                          // schließt den offenen Block
  | { kind: "plugin"; pluginId: string; type: string; payload?: unknown; at?: string; journal?: ChatJournalCursor };

applyEvent(messages: Message[], event: ChatEvent): Message[]   // purer Reducer
type Role = "user" | "assistant" | "thinking" | "tool" | "system" | "action";
interface ChatTextCursor { conversationId: string; sequence: number; offset: number }
```

- Aufeinanderfolgende `text`-Deltas mit gleichem `cursor.conversationId` und `cursor.sequence`
  verschmelzen mit dem offenen Antwortblock, `thinking`-Deltas mit dem offenen Denkblock; jedes
  andere Event (außer `user`) schließt ihn. `offset` zählt die Nicht-Leerzeichen im Turn.
- `status`, `replay-end` und `plugin` ändern den Verlauf nicht; der Host liest `status.running`
  selbst aus und reicht es als `running` weiter.
- `Message.bubble` (`{ color, side, label? }`) macht eine Antwort zur farbigen Sprechblase,
  `Message.sender` ist die Absenderkennung für `owner` und Beschriftungen.
- Weitere Exporte: `prettyJson`, `compactToolLine`, `MAX_CHAT_ATTACHMENTS` (8),
  `MAX_CHAT_ATTACHMENT_BYTES` (20 MiB), `MAX_CHAT_REQUEST_BYTES`, `chatAttachmentMediaType`,
  `parseChatAttachments` (prüft Anhänge serverseitig: Anzahl, Name, MIME-Typ, Base64, Größe).

Ein eigenes Backend ist quassel-kompatibel, sobald es diesen Event-Strom liefert. Anhänge
kommen als `ChatAttachmentInput` (`{ name, mediaType, data }`, Base64) über `onSend` und stehen
danach als `ChatAttachment` (`{ name, mediaType, size, url }`) am `user`-Event.

## quassel - die Komponenten

Immer einmal importieren: `import "quassel/chat.css"`.

### ChatPanel

Rahmen um Verlauf und Eingabe: die Eingabe liegt über dem Verlauf, der Rahmen misst sie selbst
(`--qsl-composer-height`) und gibt dem Verlauf den nötigen Fußraum.

```ts
{
  children: ReactNode;                  // meist ChatMessages
  composer?: ReactNode;                 // meist ChatInputToolbar
  className?: string;
  nodeRef?: Ref<HTMLDivElement>;
  maxWidth?: CSSProperties["maxWidth"];            // Inhaltsbreite für Verlauf und Eingabe
  horizontalPadding?: CSSProperties["paddingInline"]; // Default 24px
  appearance?: ChatAppearance;          // fontSize, lineHeight, messageGap, denseMessageGap
  scrollOnSend?: boolean;               // Default false; true springt nach erfolgreichem Senden ans Ende
}
```

### ChatMessages

```ts
{
  messages: Message[];
  owner?: string | null;                // Beiträge mit diesem sender ohne Sprechblase
  detailMode?: DetailMode;              // Default "current"
  running?: boolean;                    // Working-Indikator, aria-busy
  working?: ReactNode;                  // eigener Working-Indikator statt WorkingScenes
  stepsExpandable?: boolean;            // Default true: Klick auf einen Schritt öffnet das Detail-Popover
  texts?: Partial<ChatTexts>;
  toolArgumentsText?: (tool: ToolInfo) => string;
  renderTool?: (tool: ToolInfo) => ReactNode | undefined;          // eigene Darstellung je Werkzeug
  renderAction?: (action: PendingAction, text: string) => ReactNode | undefined; // eigene Aktionskarte
  onDismissAction?: (actionId: string) => void;                    // Verwerfen auf der Standardkarte
  onLinkClick?: (href: string, label: string) => boolean;          // true = behandelt
  emptyState?: ReactNode;
  className?: string;
  showTimestamps?: boolean;
  announce?: false | ((announcement: ChatAnnouncement) => string | undefined);
  scrollerRef?: (element: HTMLDivElement | null) => void;
  maxWidth?; horizontalPadding?; appearance?;
  jumpToEndThreshold?: number;          // Default 120px
  timestampOptions?: TimestampOptions;  // format "time" | "date-time" | "relative", locale, timeZone, showDaySeparators
  codeBlockOptions?: CodeBlockOptions;  // wrap, maxHeight, showCopyButton
  bubbleOptions?: BubbleOptions;        // variant "default" | "plain" | "bubbles", maxWidth, userSide, assistantSide, showSender, senderLabel
  messageActions?: MessageActionsOptions; // copy, edit, retry, custom
}
```

Eigener Scroll-Container: folgt dem Ende, solange man unten ist, pausiert beim Hochscrollen
(Rad, Tasten, Touch, Scrollbalken) und zeigt dann einen Zum-Ende-Knopf.

Detailgrade: `current` = nur der gerade laufende Schritt; `off` = nur Antworten; `icons` =
Schritte als Symbole; `chips` = Symbol plus Kurztext mit Umbruch; `grouped` = aufeinanderfolgende
Schritte hinter einer Kopfzeile ("12 Schritte"), ab 11 Schritten auch unten einklappbar;
`compact` = einzeilig; `full` = mit Argumenten und Ergebnis. `stepState(message)` liefert
`running | thinking | done | error`, Chips tragen ihn als `data-state`.

Aktionen (`role: "action"`): ohne `renderAction` oder wenn es `undefined` liefert, zeigt quassel
die `PendingActionCard` mit Text, "wartet auf Eingabe" und - mit `onDismissAction` - Verwerfen;
erledigte Aktionen zeigen ihr Ergebnis. `renderAction` bekommt die Aktion samt `owner` und
`payload` und rendert eine eigene Karte (Vorbild: `packages/gallery/src/ChoiceCard.tsx`).

#### Screenreader

Der Verlauf ist keine Live-Region: Streaming, Schritte, Working-Indikator und Zeitstempel werden
nicht angesagt, während `running` trägt der Verlauf `aria-busy`. Angesagt wird nur, wenn eine
Antwort fertig ist (`closed` oder Lauf beendet) und wenn eine neue offene Aktion erscheint, und
zwar ihr Inhalt als Klartext (`markdownPlainText`). Der Verlauf beim Einhängen und Schübe von
mehr als zwei Nachrichten (Reset mit Replay) werden nicht angesagt.

- `announce` weggelassen: der Text der Antwort bzw. Aktion.
- `announce={(a) => ...}`: eigener Text je `ChatAnnouncement` (`{ kind: "reply" | "action", message }`),
  z.B. mit Präfix oder übersetzt; `undefined` bleibt still.
- `announce={false}`: quassel sagt nichts an, der Host übernimmt.

Die Senke `announce(text)` ist exportiert, damit der Host eigene Zustände wie Fehler oder Abbruch
über dieselbe Region ansagen kann: eine gemeinsame, versteckte `role="status"`-Region, 400 ms
Abstand, höchstens fünf wartende Ansagen, Pause bei verstecktem Tab.

### ChatInputToolbar

```ts
{
  onSend: (text: string, attachments?: ChatAttachmentInput[]) => void | Promise<void>;
  onStop?: () => void;                  // mit running: Stop-Knopf, solange nichts getippt ist
  running?: boolean;                    // Tippen wird zum Dazwischenfunken
  disabled?: boolean; sendDisabled?: boolean;
  layout?: "card" | "toolbar" | "inline";  // Default "card"
  detailsContainer?: HTMLElement | null;   // bei "toolbar": Ziel für Anhänge, Fehler und Knöpfe (Portal)
  rows?: number;                        // Default 3; mit maxRows wächst die Eingabe bis dahin
  maxRows?: number;
  actions?: ToolbarAction[];            // { icon?, label?, title?, disabled?, active?, onClick }; active macht einen Toggle
  toolbarLeft?: ReactNode; toolbarRight?: ReactNode;
  texts?: Partial<ChatTexts>;
  handleRef?: Ref<ChatInputHandle>;     // insert(text), focus(), reset(), submit(onSubmit?, { allowEmpty })
  attachments?: boolean;                // Default true; false = kein Anhängen, Ablegen oder Einfügen von Dateien
  attachmentCapabilities?: { input: readonly string[]; model: string };  // was das Modell annimmt: "image", "video", "file"
  attachmentCapabilitiesError?: string;
  onAttachmentsChange?: (hasAttachments: boolean) => void;
  initialValue?: string; onDraftChange?: (text: string) => void;
  onErrorChange?: (error: string | undefined) => void;
  inputAriaControls?: string;
  sendShortcut?: "enter" | "mod-enter"; // Default "enter"; Shift+Enter bricht immer um
  autoFocus?: boolean; onAutoFocusSettled?: () => void;
}
```

Anhänge kommen über den Knopf, per Ablegen oder Einfügen; höchstens 8 Dateien und 20 MiB. Ein
fehlgeschlagenes `onSend` stellt den Entwurf wieder her oder bietet ihn zum Einfügen an. Unter
480px Breite klappen Beschriftungen mit `collapsible` zu ihren Symbolen.

### Weitere Bausteine

- `DetailModeSwitch` (`mode`, `onChange`, `modes?`, `collapsible?`, `texts?`, `className?`):
  schaltet den Detailgrad weiter; `DETAIL_MODES`, `detailModeLabel(mode, texts)`.
- `TimestampSwitch` (`showTimestamps`, `onChange`, `collapsible?`, `texts?`, `className?`).
- `Markdown` (`text`, `streaming?`), dazu `MarkdownLinks` (`onLinkClick`) und
  `MarkdownCodeBlocks` (`options`, `texts`) als Kontexte; `markdownPlainText(text)`.
- `PendingActionCard`, `StepPopover`, `MessageActions`, `WorkingScenes` (`label?`, `compact?`).
- Helfer: `stepState`, `applyEvent`, `fillText`, `formatAttachmentSize`, `encodeAttachment`,
  `validateAttachmentSelection`, `attachmentCapabilityError`, `timestampLabel`, `useChatAction`,
  `copyChatText`, `createChatScroll`, `ChatSendContext`.

### Texte

Alle Beschriftungen stehen in `ChatTexts` (Default `defaultTexts`, deutsch) und lassen sich über
`texts` je Komponente teilweise ersetzen. Platzhalter wie `{count}`, `{name}`, `{size}`, `{kind}`,
`{model}` füllt quassel selbst. Eine vollständige englische Fassung steht in
`packages/gallery/src/texts.ts`.

## Theming

### Variablen

quassel liest seine Optik aus Variablen. Sie gelten ab dem Element, auf dem sie stehen: auf
`:root` für die ganze Seite oder auf einem Wrapper für einen Chat.

| Variable | Bedeutung | hell / dunkel |
|---|---|---|
| `--qsl-background` | Fläche von Eingabe, Popover, Karten | `#f3f2f7` / `#292735` |
| `--qsl-foreground` | Text | `#34303d` / `#e9e2ed` |
| `--qsl-card` | Kartenfläche | `#e7eaf2` / `#2b303e` |
| `--qsl-primary` | Akzent: Senden, Links, Fokus, laufende Schritte | `#79638d` / `#bda6cf` |
| `--qsl-primary-foreground` | Text auf Akzent | `#ffffff` / `#2d2235` |
| `--qsl-secondary` | eigene Nachrichten, Code, Hover | `#e1ddeb` / `#373247` |
| `--qsl-muted-foreground` | Nebentext, Zeitstempel, Schritte | `#62586e` / `#b6a9bd` |
| `--qsl-destructive` | Fehler, Stop | `#a94360` / `#ffa2b0` |
| `--qsl-success` | Häkchen | `#3b705f` / `#8dceae` |
| `--qsl-border`, `--qsl-border-soft`, `--qsl-border-strong` | Linien | |
| `--qsl-glass-edge` | Kante im Ton `material` | |
| `--qsl-bar-shadow`, `--qsl-pop-shadow`, `--qsl-card-shadow` | Schatten | |
| `--qsl-radius` | Grundradius, alle Radien leiten sich davon ab | `0.5rem` |
| `--qsl-font`, `--qsl-mono` | Schriften | Systemschrift, `ui-monospace` |
| `--qsl-color-scheme` | `color-scheme` der quassel-Elemente | `light` / `dark` |

Dazu die Maßstäbe aus dem Tailwind-Theme: `--qsl-spacing` (0.235rem, kompakte Einheit),
`--qsl-text-xs` bis `--qsl-text-lg` samt `--line-height`, `--qsl-radius-panel` (17px) und die
Chat-Maße `--qsl-chat-font-size` (13px), `--qsl-chat-line-height`, `--qsl-chat-message-gap`
(16px), `--qsl-chat-dense-message-gap` (8px), `--qsl-chat-content-max-width`,
`--qsl-chat-horizontal-padding` (24px; diese sechs setzen auch `appearance`, `maxWidth` und
`horizontalPadding`) sowie `--qsl-input-card-radius` für die Eingabe-Karte.

```css
.mein-chat {
    --qsl-primary: #11855c;
    --qsl-secondary: #dcefe5;
    --qsl-radius: 0.9rem;
    --qsl-font: Georgia, serif;
}
```

Ein Host mit eigenem Designsystem bindet seine Tokens einfach an: `--qsl-primary: var(--brand);`.
Beispiele: `packages/gallery/src/themes.css`.

### Dark Mode

Wie in RAgents entscheidet `data-theme` auf einem Vorfahren, meist `<html>`:

- `data-theme="dark"`: dunkle Werte.
- `data-theme="light"` oder kein Attribut: helle Werte.
- `data-theme="system"`: folgt `prefers-color-scheme`.

Das Attribut darf auch auf einem Wrapper stehen, etwa um nur den Chat dunkel zu zeigen; der
nächste Vorfahre gewinnt. Eigene Farben für dunkel gibt der Host mit
`[data-theme="dark"] .mein-chat { ... }` an. Einschränkung: einige wenige Hover-Schattierungen
der Knöpfe (Tailwind-Variante `dark:`) folgen jedem dunklen Vorfahren, auch wenn dazwischen ein
helles `data-theme` steht.

### Slots: eigene Grundbausteine

`QuasselProvider` ersetzt die Grundbausteine, aus denen quassel seine Knöpfe, Karten und
Popover baut. Nicht angegebene bleiben die eingebauten (Base UI plus Tailwind), Provider lassen
sich verschachteln.

```tsx
import { QuasselProvider, type QuasselButtonProps } from "quassel";

function HostButton({ variant, size, className, children, ...rest }: QuasselButtonProps) {
  return <button {...rest} className={`host-button host-button--${variant ?? "default"} ${className ?? ""}`} type="button">{children}</button>;
}

<QuasselProvider components={{ Button: HostButton }} allowUrl={(url) => url.startsWith("app:")}>
  <App />
</QuasselProvider>
```

| Slot | Props (`Quassel...Props`) |
|---|---|
| `Button` | `variant` (default, outline, secondary, ghost, destructive, link), `size` (default, xs, sm, lg, icon, icon-xs, icon-sm, icon-lg), `className`, `disabled`, `title`, `aria-label`, `aria-pressed`, `onClick`, `children` |
| `Toggle` | `variant`, `size`, `className`, `disabled`, `title`, `pressed`, `onPressedChange`, `children` |
| `Card` | `size` (default, sm), `className`, `children` |
| `StopButton` | `label`, `busy`, `size`, `className`, `disabled`, `title`, `onClick` |
| `Popover` | `open`, `onOpenChange`, `children` |
| `PopoverContent` | `anchor` (virtuelles Element mit `getBoundingClientRect`), `align`, `side`, `sideOffset`, `collisionPadding`, `className`, `aria-label`, `children` |

`className` enthält quassels eigene Layout-Klassen (etwa Position eines Knopfs); ein Slot sollte
sie übernehmen. `defaultComponents` liefert die eingebauten Bausteine zum Umhüllen,
`useQuasselComponents()` die aktuell gültigen, etwa für eine eigene Aktionskarte.

`allowUrl` erweitert die Link-Politik des Markdowns: Standard sind http, https, mailto, tel,
ftp, irc, xmpp und relative Adressen; alles andere wird verworfen, außer `allowUrl` erlaubt es.

## CSS

### Hosts ohne Tailwind

`quassel/chat.css` ist fertig kompiliert und braucht nichts weiter. Es verändert die Host-Seite
nicht:

- Alle Utilities tragen das Präfix `qsl:` (im CSS `.qsl\:flex`), die Theme-Variablen `--qsl-*`,
  eigene Keyframes `qsl-*`.
- Es gibt keinen globalen Reset. Der Tailwind-Preflight gilt nur für Elemente mit `data-quassel`
  (die Wurzeln von Panel, Verlauf, Eingabe, Popover und Grundbausteinen) und ihre Nachfahren,
  mit Spezifität null. Dort sind wie in RAgents auch die WebKit-Scrollbalken ausgeblendet.
- Die Regeln liegen in den Cascade Layers `theme`, `base` und `utilities`. Ungelayerte Regeln
  des Hosts gewinnen daher immer - gut für eigene Klassen über `className`, aber globale
  Element-Regeln des Hosts (`button { ... }`, `a { ... }`) wirken auch in quassel hinein. Solche
  Regeln gehören in einen eigenen Layer oder auf eigene Klassen.
- Global sind nur Tailwinds `@property`-Registrierungen für `--tw-*` und die Keyframes `enter`
  und `exit` aus tw-animate-css.

### Hosts mit Tailwind

Auch ein Tailwind-Host bindet einfach `quassel/chat.css` ein; dank Präfix kollidiert nichts mit
seinen eigenen Utilities, und die Layer-Namen fügen sich in seine ein. Für Anpassungen über
`className` nimmt er seine eigenen Klassen und setzt Variablen als Arbitrary Property:
`className="[--qsl-input-card-radius:var(--radius-lg)]"`.

Reihenfolge, sobald der Host eigene Bausteine als Slots übergibt: `quassel/chat.css` NACH den
Utilities des Hosts einbinden. Nur dann gewinnen quassels Layout-Klassen gegen die Grundklassen
der Host-Bausteine (das `cn` des Hosts kennt keine `qsl:`-Klassen und löst den Konflikt nicht auf).
Eine Host-Klasse, die dann gegen eine quassel-Klasse gewinnen soll, braucht `!`, etwa
`className="min-h-16!"`. Hover- und Fokus-Zustände der Host-Bausteine bleiben erhalten, weil ihre
Selektoren spezifischer sind.

Entwicklung an quassel und am Host zugleich: den Host per `"quassel": "link:../quassel/packages/quassel"`
einbinden (der Bundler des Hosts übersetzt die TypeScript-Quellen mit) und in quassel
`pnpm --filter quassel dev` laufen lassen. Das hält `packages/quassel/build/chat.css` per
Tailwind-Watch aktuell; der Dev-Server des Hosts lädt die Datei bei jeder Änderung neu.

## Galerie und Showcase

```sh
pnpm install
pnpm dev        # Stylesheet im Watch-Modus plus Galerie auf http://localhost:3210
pnpm check      # Typprüfung von Paket und Galerie
pnpm build      # Stylesheet und Galerie bauen
```

Die Galerie zeigt Nur-Lesen, Eingabe-Karte mit Fake-Agent, Aktionen, Stile und Slots. Die
README-Bilder stammen aus `packages/gallery/showcase.html`: Szenen per
`?scene=agent|details|questions|party|themes` (`questions` zeigt die Aktionen, `actions` geht
auch), dunkel mit `&theme=dark`.

## Veröffentlichen

```sh
pnpm release --dry-run   # baut packages/quassel/dist und zeigt den Inhalt des Pakets
pnpm release             # veröffentlicht auf npm
```

Vorher die Version in `packages/quassel/package.json` erhöhen; eine schon veröffentlichte
Version bricht ab. Das Skript (`scripts/publish.mjs`) prüft die Typen, bündelt `index` und
`events` mit esbuild (Abhängigkeiten bleiben extern), erzeugt die Deklarationen mit tsc, baut
`chat.css` mit der Tailwind-CLI und schreibt ein eigenes `package.json` mit den gebauten Pfaden.
Den Token nimmt es aus `NPM_TOKEN`, sonst gilt die `.npmrc` des Benutzers.

## Rezepte

- **Transcript-Viewer**: `ChatMessages` mit fertigen `Message[]`, keine Eingabe.
- **Chat mit eigenem Backend**: Events per SSE oder WebSocket empfangen, mit `useReducer(applyEvent, [])`
  reduzieren, `status.running` als `running` weiterreichen, `onSend` und `onStop` auf die eigenen
  Endpunkte legen (Vorbild für den Ablauf: `packages/gallery/src/fakeAgent.ts`).
- **Server**: `applyEvent` und `parseChatAttachments` aus `quassel/events` im Backend nutzen, um
  denselben Verlauf zu halten und Anhänge zu prüfen.
- **Eigener Look**: Wrapper mit `--qsl-*`, siehe `themes.css`; Knöpfe des Designsystems per
  `QuasselProvider`.
