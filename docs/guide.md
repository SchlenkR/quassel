# quassel - Build guide

quassel is the chat of RAgents as a standalone React library: a transcript with thinking and
tool steps, pending actions, an input card with attachments and interjecting, an event contract
that runs in the backend as well, and a precompiled stylesheet. The default look is the one of
RAgents (light and dark); a host adapts it through `--qsl-*` variables and its own primitives.

This document is the build guide - also, and especially, for an AI that is supposed to build an
application with quassel.

## Instructions for the AI

When you build an application with quassel, CLARIFY THE FOLLOWING POINTS WITH THE USER FIRST,
before you write code. Only ask what does not already follow from the task, but do not guess on
fundamental decisions:

1. **Kind of chat**: Display only (transcript without a composer)? Interactive chat? Or an agent
   that uses tools and waits for input (actions)?
2. **Backend**: Where do the events come from? quassel brings NO backend and no transport.
   The host delivers a stream of `ChatEvent`s (SSE, WebSocket, RPC, fake) and reduces it with
   `applyEvent`. Sending, stopping and dismissing are callbacks of the host.
3. **Input**: Card (`layout="card"`), single line (`"inline"`) or as a bar (`"toolbar"`)?
   Attachments allowed (`attachments`)? Custom buttons (`actions`, `toolbarLeft`, `toolbarRight`)?
4. **Steps**: Which detail level as default (`current`, `off`, `icons`, `chips`, `grouped`,
   `compact`, `full`)? Should the user be able to switch (`DetailModeSwitch`)?
5. **Look**: RAgents default or custom colors, radii, font (`--qsl-*`)? Dark mode fixed, by
   switch or following the system? Custom primitives of the host design system (`QuasselProvider`)?
6. **Styles in the host**: Does the host have Tailwind? Without Tailwind `quassel/chat.css` is enough.
7. **Texts**: Keep the English default labels or replace them through `texts`?

Stick to these rules while building:

- The components are deliberately dumb: `messages` and callbacks in, state and transport belong
  to the host. Frontend and backend only talk through `quassel/events`.
- Style through `--qsl-*` variables on a wrapper and through slots, not by copying or forking the
  components.
- Classes that the host passes to quassel components through `className` are host classes;
  quassel itself only uses classes with the `qsl:` prefix.
- The gallery (`packages/gallery`) is the reference: every composition is built there once in a
  runnable form, with fake data.

## Setup

```sh
npm install quassel        # the host brings React 18 or 19 itself
```

| Import | Contents |
|---|---|
| `quassel` | React building blocks, `QuasselProvider`, types, texts, `announce`, `markdownPlainText` |
| `quassel/events` | Event contract, `applyEvent`, attachment limits and validation, without React - for the backend too |
| `quassel/chat.css` | Compiled stylesheet: theme variables, scoped reset, all utilities in use |

Runtime dependencies: `@base-ui/react`, `class-variance-authority`, `cn`, `lucide-react`,
`streamdown`. In the repo `quassel` is a source package (`packages/quassel`, TypeScript without a
build step, `chat.css` from `build/`); the gallery includes it through `workspace:*`.

## quassel/events - the contract

```ts
type ChatEvent =
  | { kind: "reset"; reason?: "conversation-reset"; conversationId: string | null }
  | { kind: "replay-end"; conversationId: string | null }      // transcript replayed, live from now on
  | { kind: "user"; text: string; inputId?: string; at?: string; attachments?: ChatAttachment[] }
  | { kind: "steered"; inputId: string }                          // input went into the running turn
  | { kind: "text"; delta: string; at?: string; cursor: ChatTextCursor }
  | { kind: "thinking"; delta: string; at?: string }
  | { kind: "tool"; id: string; name: string; arguments: string; label?: string; at?: string }
  | { kind: "tool-result"; id: string; result: string; isError?: boolean }
  | { kind: "action"; actionId: string; owner: string | null; text: string; payload: unknown; at?: string }
  | { kind: "action-resolved"; actionId: string; status: "approved" | "dismissed"; result: unknown }
  | { kind: "system"; text: string; at?: string }                 // errors, cancellation and the like
  | { kind: "status"; running: boolean; startup?: ChatStartupStatus }  // transient
  | { kind: "turn-done" }                                          // closes the open block
  | { kind: "plugin"; pluginId: string; type: string; payload?: unknown; at?: string; journal?: ChatJournalCursor };

applyEvent(messages: Message[], event: ChatEvent): Message[]   // pure reducer
type Role = "user" | "assistant" | "thinking" | "tool" | "system" | "action";
interface ChatTextCursor { conversationId: string; sequence: number; offset: number }
```

- Consecutive `text` deltas with the same `cursor.conversationId` and `cursor.sequence` merge
  into the open answer block, `thinking` deltas into the open thinking block; every other event
  (except `user`) closes it. `offset` counts the non-whitespace characters in the turn.
- `at` on the `tool` event is the start time of the call; `ChatMessages` computes the elapsed
  time of running tools from it. Without `at` quassel shows no elapsed time.
- `status`, `replay-end` and `plugin` do not change the transcript; the host reads
  `status.running` itself and passes it on as `running`.
- `Message.bubble` (`{ color, side, label? }`) turns an answer into a colored speech bubble,
  `Message.sender` is the sender identifier for `owner` and labels.
- Further exports: `prettyJson`, `compactToolLine`, `MAX_CHAT_ATTACHMENTS` (8),
  `MAX_CHAT_ATTACHMENT_BYTES` (20 MiB), `MAX_CHAT_REQUEST_BYTES`, `chatAttachmentMediaType`,
  `parseChatAttachments` (validates attachments on the server: count, name, MIME type, Base64, size).

A custom backend is quassel-compatible as soon as it delivers this event stream. Attachments
come in as `ChatAttachmentInput` (`{ name, mediaType, data }`, Base64) through `onSend` and are
then attached to the `user` event as `ChatAttachment` (`{ name, mediaType, size, url }`).

## quassel - the components

Always import once: `import "quassel/chat.css"`.

### ChatPanel

Frame around transcript and composer: the composer lies over the transcript, the frame measures
it itself (`--qsl-composer-height`) and gives the transcript the footer space it needs.

With `composer` the frame carries a dock for open actions directly above the composer
(`data-chat="actions"`): same width and centering as the composer, the same distance to the
composer as between two blocks in the transcript, empty without taking up space. Several open
actions stack with a small gap; the dock never grows higher than half the frame height
(`--qsl-panel-height`), beyond that it scrolls within itself. It counts as part of the measured
composer, so the transcript keeps its footer space above it too and stays at the end when the
dock appears, grows or disappears. It is filled by `ChatMessages` (see actions); without
`composer` there is no dock.

```ts
{
  children: ReactNode;                  // usually ChatMessages
  composer?: ReactNode;                 // usually ChatInputToolbar
  className?: string;
  nodeRef?: Ref<HTMLDivElement>;
  maxWidth?: CSSProperties["maxWidth"];            // content width for transcript and composer
  horizontalPadding?: CSSProperties["paddingInline"]; // default 24px
  appearance?: ChatAppearance;          // fontSize, lineHeight, messageGap, denseMessageGap
  scrollOnSend?: boolean;               // default false; true jumps to the end after a successful send
}
```

### ChatMessages

```ts
{
  messages: Message[];
  owner?: string | null;                // contributions with this sender without a speech bubble
  detailMode?: DetailMode;              // default "current"
  transcriptMode?: TranscriptMode;      // "all" (default) or "latest"
  running?: boolean;                    // working indicator, aria-busy
  working?: ReactNode;                  // custom working indicator instead of WorkingScenes
  stepsExpandable?: boolean;            // default true: clicking a step opens the detail popover
  groupsExpandable?: boolean;           // default true: in grouped mode the header expands to the steps
  texts?: Partial<ChatTexts>;
  toolArgumentsText?: (tool: ToolInfo) => string;
  renderTool?: (tool: ToolInfo) => ReactNode | undefined;          // custom rendering per tool
  renderAction?: (action: PendingAction, text: string) => ReactNode | undefined; // custom action card
  onDismissAction?: (actionId: string) => void;                    // dismiss on the default card
  onLinkClick?: (href: string, label: string) => boolean;          // true = handled
  emptyState?: ReactNode;
  className?: string;                   // on the outer frame
  scrollerClassName?: string;           // on the scroll container (data-quassel-transcript)
  showTimestamps?: boolean;
  announce?: false | ((announcement: ChatAnnouncement) => string | undefined);
  scrollerRef?: (element: HTMLDivElement | null) => void;
  maxWidth?; horizontalPadding?; appearance?;
  jumpToEndThreshold?: number;          // default 120px
  timestampOptions?: TimestampOptions;  // format "time" | "date-time" | "relative", locale, timeZone, showDaySeparators
  codeBlockOptions?: CodeBlockOptions;  // wrap, maxHeight, showCopyButton
  bubbleOptions?: BubbleOptions;        // variant "default" | "plain" | "bubbles", maxWidth, userSide, assistantSide, showSender, senderLabel
  messageActions?: MessageActionsOptions; // copy, edit, retry, custom
  toolElapsedThreshold?: number | false;  // default 3000 ms until running tools show their elapsed time, false = never
}
```

Its own scroll container: follows the end while you are at the bottom, pauses when scrolling up
(wheel, keys, touch, scrollbar) and then shows a jump-to-end button. It carries the stable
attribute `data-quassel-transcript`; it gets custom classes through `scrollerClassName`, and
`scrollerRef` delivers the element itself.

Transcript modes: `all` (the default) shows every message. `latest` keeps every user input and shows at most
one non-empty assistant message between two user messages: the last one. The same rule applies
after the last user message and before the first one. Every user message is a boundary, including
steering, regardless of `Message.steered`. Earlier inputs and their last replies stay visible.

A new assistant block replaces the previous one only within the same interval, as soon as it
has text or attachments. The previous text stays visible during tool calls and empty streaming
deltas. Steering preserves the text before it even when a new reply starts after it. Message
order is preserved; an existing text block can keep streaming in its original position while
steering arrives. Source messages are never modified; `all` restores all intermediate replies.

Thinking and tool steps still follow `detailMode` independently. Removing intermediate replies
makes adjacent steps join into the existing groups in `grouped` mode or rows in `chips`/`icons`
mode. User inputs and the retained answer separate groups. The gallery starts with `grouped`
to demonstrate this; `current` shows just the running step, and `off` hides steps. System messages
and actions remain available. Hidden answers are not announced to screen readers.

Set `transcriptMode` directly from host state; no button is required. Optionally place
`<TranscriptModeSwitch mode={transcriptMode} onChange={setTranscriptMode} />` in the input
toolbar. The gallery's Input card starts in `latest` mode and lets you switch during streaming.

Detail levels: `current` = only the step running right now; `off` = answers only; `icons` =
steps as icons; `chips` = icon plus short text with wrapping; `grouped` = consecutive steps
behind a header line ("12 steps"), from 11 steps on collapsible at the bottom too; `compact` =
single line; `full` = with arguments and result. `stepState(message)` returns
`running | thinking | done | error`, chips carry it as `data-state`.

Group headers show the total number of steps and, when nonzero, the number of failed tool
calls: "3 steps, 1 error" or "3 Schritte, 1 Fehler". Errors are part of the total, counted from
`ToolInfo.isError`; successful retries do not erase earlier failed calls. The count is visible
with collapsed, expanded or non-expandable groups. `stepGroupErrorOne` and `stepGroupErrorMany`
override the singular and plural labels; both are optional for existing `ChatTexts` objects.

Elapsed time: While `running` holds and a tool step has no result yet, it shows its elapsed time
since `Message.at` after "running ..." once `toolElapsedThreshold` (default 3 s) has passed:
under a minute through `texts.toolElapsedSeconds` ("12 s"), then "1:40" and from an hour on
"1:02:03". This applies to single-line and full steps, to chips (not `icons`) and to the header
line of `grouped`, which names the running step of the group along with its elapsed time. The
element carries `data-step="elapsed"`. All running displays share one tick, which runs only
while one of them is mounted; only the display itself re-renders, and only when its second
changes. Server rendering shows no elapsed time.

Actions (`role: "action"`): without `renderAction`, or when it returns `undefined`, quassel shows
the `PendingActionCard` with the text, "waiting for input" and - with `onDismissAction` - dismiss;
resolved actions show their result (approved with a check mark, dismissed with a neutral cross
and `actionDismissed`). `renderAction` receives the action including `owner` and `payload` and
renders a custom card (model: `packages/gallery/src/ChoiceCard.tsx`).

Where an action appears is decided by its state: while it is open (`action.status` is missing),
`ChatMessages` in a `ChatPanel` with `composer` renders it in the dock above the composer, in
chronological order, and not at all at its place in the transcript - like a question in a
terminal agent. As soon as it is approved or dismissed, it stands as a record at its place in
the transcript, and the dock is empty again. Without a dock (`ChatMessages` alone or `ChatPanel`
without `composer`) open actions stand in the transcript too. The rendering is the same in both
cases (`renderAction`, otherwise the default card); in the dock the cards inherit font size and
`appearance` of the transcript, but no timestamp column. When an action moves from the dock into
the transcript, its card is mounted anew: the card's own state is lost in the process, and so is
the focus.

#### Screen readers

The transcript is not a live region: streaming, steps, working indicator and timestamps are not
announced, and while `running` the transcript carries `aria-busy`. The ticking elapsed time of
running tools is `aria-hidden`; only the unchanging "running ..." is read out. Announcements
happen only when an answer is finished (`closed` or run ended) and when a new open action
appears, namely its content as plain text (`markdownPlainText`). The transcript at mount time
and batches of more than two messages (reset with replay) are not announced.

- `announce` omitted: the text of the answer or action.
- `announce={(a) => ...}`: custom text per `ChatAnnouncement` (`{ kind: "reply" | "action", message }`),
  e.g. with a prefix or translated; `undefined` stays silent.
- `announce={false}`: quassel announces nothing, the host takes over.

The sink `announce(text)` is exported so that the host can announce its own states such as
errors or cancellation through the same region: one shared, hidden `role="status"` region,
400 ms interval, at most five queued announcements, paused while the tab is hidden.

### ChatInputToolbar

```ts
{
  onSend: (text: string, attachments?: ChatAttachmentInput[]) => void | Promise<void>;
  onStop?: () => void;                  // with running: stop button as long as nothing is typed
  running?: boolean;                    // typing turns into interjecting
  disabled?: boolean; sendDisabled?: boolean;
  layout?: "card" | "toolbar" | "inline";  // default "card"
  detailsContainer?: HTMLElement | null;   // with "toolbar": target for attachments, errors and buttons (portal)
  rows?: number;                        // default 3; with maxRows the input grows up to that
  maxRows?: number;
  actions?: ToolbarAction[];            // { icon?, label?, title?, disabled?, active?, onClick }; active makes a toggle
  toolbarLeft?: ReactNode; toolbarRight?: ReactNode;
  texts?: Partial<ChatTexts>;
  handleRef?: Ref<ChatInputHandle>;     // insert(text), focus(), reset(), submit(onSubmit?, { allowEmpty })
  attachments?: boolean;                // default true; false = no attaching, dropping or pasting of files
  attachmentCapabilities?: { input: readonly string[]; model: string };  // what the model accepts: "image", "video", "file"
  attachmentCapabilitiesError?: string;
  onAttachmentsChange?: (hasAttachments: boolean) => void;
  initialValue?: string; onDraftChange?: (text: string) => void;
  onErrorChange?: (error: string | undefined) => void;
  inputAriaControls?: string;
  sendShortcut?: "enter" | "mod-enter"; // default "enter"; Shift+Enter always inserts a line break
  autoFocus?: boolean; onAutoFocusSettled?: () => void;
}
```

Attachments come in through the button, by dropping or by pasting; at most 8 files and 20 MiB. A
failed `onSend` restores the draft or offers it for insertion. Below a width of 480px, actions
with an icon collapse their label.

### Further building blocks

- `DetailModeSwitch` (`mode`, `onChange`, `modes?`, `texts?`, `className?`): icon button with one icon per mode,
  cycles the detail level; `DETAIL_MODES`, `detailModeLabel(mode, texts)`.
- `TranscriptModeSwitch` (`mode`, `onChange`, `texts?`, `className?`): optional toggle between `all` and `latest`.
- `TimestampSwitch` (`showTimestamps`, `onChange`, `texts?`, `className?`): icon button, clock on or faded.
- `Markdown` (`text`, `streaming?`), plus `MarkdownLinks` (`onLinkClick`) and
  `MarkdownCodeBlocks` (`options`, `texts`) as contexts; `markdownPlainText(text)`.
- `PendingActionCard`, `StepPopover`, `MessageActions`, `WorkingScenes` (`label?`, `compact?`).
- Helpers: `stepState`, `applyEvent`, `fillText`, `formatAttachmentSize`, `encodeAttachment`,
  `validateAttachmentSelection`, `attachmentCapabilityError`, `timestampLabel`, `useChatAction`,
  `copyChatText`, `createChatScroll`, `ChatSendContext`, `formatElapsed(ms, texts)` and
  `useElapsed(startMs)` (elapsed time on the shared tick, e.g. for custom `renderTool` renderings).

### Texts

All labels live in `ChatTexts`. The package exports complete `englishTexts` and `germanTexts`
sets; `defaultTexts` remains the English set for backwards compatibility. Pass the chosen set
to each component's `texts` prop, including toolbar switches. Switching the set at runtime
changes the UI language without changing messages or the transcript mode.

```tsx
const texts = language === "de" ? germanTexts : englishTexts;
<ChatMessages messages={messages} texts={texts} />
<ChatInputToolbar onSend={send} texts={texts}
  toolbarLeft={<TranscriptModeSwitch mode={mode} onChange={setMode} texts={texts} />} />
```

Override individual labels with `{ ...germanTexts, placeholder: "Frage stellen ..." }`.
quassel fills placeholders such as `{count}`, `{name}`, `{size}`, `{kind}`, `{model}`, `{seconds}`
itself. Model output, tool names and results are content supplied by the host and are not
translated. The gallery's input and read-only demos offer `de` / `en` controls.

## Theming

### Variables

quassel reads its look from variables. They apply from the element they are set on: on `:root`
for the whole page or on a wrapper for one chat.

| Variable | Meaning | light / dark |
|---|---|---|
| `--qsl-background` | surface of composer, popover, cards | `#f3f2f7` / `#292735` |
| `--qsl-foreground` | text | `#34303d` / `#e9e2ed` |
| `--qsl-card` | card surface | `#e7eaf2` / `#2b303e` |
| `--qsl-primary` | accent: send, links, focus, running steps | `#79638d` / `#bda6cf` |
| `--qsl-primary-foreground` | text on accent | `#ffffff` / `#2d2235` |
| `--qsl-secondary` | own messages, code, hover | `#e1ddeb` / `#373247` |
| `--qsl-muted-foreground` | secondary text, timestamps, steps | `#62586e` / `#b6a9bd` |
| `--qsl-destructive` | errors, stop | `#a94360` / `#ffa2b0` |
| `--qsl-success` | check marks | `#3b705f` / `#8dceae` |
| `--qsl-border`, `--qsl-border-soft`, `--qsl-border-strong` | lines | |
| `--qsl-glass-edge` | edge in the `material` tone | |
| `--qsl-bar-shadow`, `--qsl-pop-shadow`, `--qsl-card-shadow` | shadows | |
| `--qsl-radius` | base radius, all radii derive from it | `0.5rem` |
| `--qsl-radius-sm`, `-md`, `-lg`, `-xl`, `-2xl` | single steps, otherwise from `--qsl-radius` | not set: `* 0.6`, `* 0.8`, `* 1`, `* 1.4`, `* 1.8` |
| `--qsl-radius-panel` | cards, e.g. the action card | `17px` |
| `--qsl-input-card-radius` | input card | not set: `--qsl-radius-xl` |
| `--qsl-bubble-radius` | speech bubble of own messages | not set: `10px 10px 4px 10px` (`material` tone: `9px`) |
| `--qsl-text-meta` | chips, timestamps, arguments and result in the `full` detail level | `10.5px` |
| `--qsl-text-trace` | step lines, group header, section titles and content in the step popover | `11px` |
| `--qsl-text-label` | sender identifier on speech bubbles, the "fed into" note | `0.72rem` |
| `--qsl-text-small` | `<small>` (size of attachments) | not set: `80%` |
| `--qsl-font`, `--qsl-mono` | fonts | system font, `ui-monospace` |
| `--qsl-color-scheme` | `color-scheme` of the quassel elements | `light` / `dark` |

Plus the scales from the Tailwind theme: `--qsl-spacing` (0.235rem, compact unit),
`--qsl-text-xs` to `--qsl-text-lg` including `--line-height` (`--qsl-text-xs` is 0.68rem) and
the chat dimensions `--qsl-chat-font-size` (13px), `--qsl-chat-line-height`,
`--qsl-chat-message-gap` (16px), `--qsl-chat-dense-message-gap` (8px),
`--qsl-chat-content-max-width`, `--qsl-chat-horizontal-padding` (24px; these six are also set
by `appearance`, `maxWidth` and `horizontalPadding`).

Every variable takes effect from the element it is set on, the radii too: "not set" means
quassel defines them nowhere itself and computes with the default at the place of use. A wrapper
that sets `--qsl-radius-md` or `--qsl-bubble-radius` therefore reaches into every quassel
element. Small buttons cap `--qsl-radius-md` at 10 or 12px.

A host with a minimum font size sets all sizes below its limit, at 12px that is
`--qsl-text-xs`, `--qsl-text-meta`, `--qsl-text-trace`, `--qsl-text-label` and `--qsl-text-small`.
Popovers live in `document.body` by default and only inherit the wrapper's variables with
`portalContainer` (see slots).

```css
.my-chat {
    --qsl-primary: #11855c;
    --qsl-secondary: #dcefe5;
    --qsl-radius: 0.9rem;
    --qsl-font: Georgia, serif;
}
```

A host with its own design system simply binds its tokens: `--qsl-primary: var(--brand);`.
Examples: `packages/gallery/src/themes.css`.

### Dark mode

As in RAgents, `data-theme` on an ancestor decides, usually `<html>`:

- `data-theme="dark"`: dark values.
- `data-theme="light"` or no attribute: light values.
- `data-theme="system"`: follows `prefers-color-scheme`.

The attribute may also sit on a wrapper, e.g. to show only the chat in dark; the nearest
ancestor wins. The host sets its own colors for dark with
`[data-theme="dark"] .my-chat { ... }`. Limitation: a very few hover shades of the buttons
(Tailwind variant `dark:`) follow any dark ancestor, even when a light `data-theme` sits in
between.

### Slots: custom primitives

`QuasselProvider` replaces the primitives from which quassel builds its buttons, cards and
popovers. Those not given stay the built-in ones (Base UI plus Tailwind), providers can be
nested.

```tsx
import { QuasselProvider, type QuasselButtonProps } from "quassel";

function HostButton({ variant, size, className, children, ...rest }: QuasselButtonProps) {
  return <button {...rest} className={`host-button host-button--${variant ?? "default"} ${className ?? ""}`} type="button">{children}</button>;
}

<QuasselProvider components={{ Button: HostButton }} allowUrl={(url) => url.startsWith("app:")}>
  <App />
</QuasselProvider>
```

`portalContainer` sets where quassel renders its popovers (default: `document.body`). Allowed
are an element, a ref or a function that returns the element (`QuasselPortalContainer`); it is
resolved on opening. When the container sits in the host's theme wrapper, its `--qsl-*`
variables and `data-theme` apply in the popover too:

```tsx
const popovers = useRef<HTMLDivElement>(null);

<div className="my-chat">
  <QuasselProvider portalContainer={popovers}>
    <ChatPanel ...>...</ChatPanel>
  </QuasselProvider>
  <div ref={popovers} />
</div>
```

The container should sit outside the scroll container and not clip through `overflow`;
positioning is absolute. `useQuasselPortalContainer()` returns the resolved element for the
host's own popovers. The built-in popover carries `data-quassel-popover` (plus
`data-slot="popover-content"` as before); from it a host can tell that a quassel popover is open.

| Slot | Props (`Quassel...Props`) |
|---|---|
| `Button` | `variant` (default, outline, secondary, ghost, destructive, link), `size` (default, xs, sm, lg, icon, icon-xs, icon-sm, icon-lg), `className`, `disabled`, `title`, `aria-label`, `aria-pressed`, `onClick`, `children` |
| `Toggle` | `variant`, `size`, `className`, `disabled`, `title`, `pressed`, `onPressedChange`, `children` |
| `Card` | `size` (default, sm), `className`, `children` |
| `StopButton` | `label`, `busy`, `size`, `className`, `disabled`, `title`, `onClick` |
| `Popover` | `open`, `onOpenChange`, `children` |
| `PopoverContent` | `anchor` (virtual element with `getBoundingClientRect`), `align`, `side`, `sideOffset`, `collisionPadding`, `className`, `aria-label`, `portalContainer` (resolved target or `undefined` for `document.body`), `children` |

`className` contains quassel's own layout classes (e.g. the position of a button); a slot should
keep them. A custom `PopoverContent` should pass `portalContainer` to its portal and, if the host
wants to detect open popovers, set `data-quassel-popover` itself. `defaultComponents` returns the
built-in primitives for wrapping, `useQuasselComponents()` the currently effective ones, e.g. for
a custom action card.

`allowUrl` extends the link policy of the Markdown: the defaults are http, https, mailto, tel,
ftp, irc, xmpp and relative addresses; everything else is dropped unless `allowUrl` allows it.

## CSS

### Hosts without Tailwind

`quassel/chat.css` is precompiled and needs nothing else. It does not change the host page:

- All utilities carry the `qsl:` prefix (in CSS `.qsl\:flex`), the theme variables `--qsl-*`,
  its own keyframes `qsl-*`.
- There is no global reset. The Tailwind preflight applies only to elements with `data-quassel`
  (the roots of panel, transcript, composer, popover and primitives) and their descendants,
  with zero specificity. There, as in RAgents, the WebKit scrollbars are hidden too.
- The rules live in the cascade layers `theme`, `base` and `utilities`. Unlayered rules of the
  host therefore always win - good for custom classes through `className`, but global element
  rules of the host (`button { ... }`, `a { ... }`) reach into quassel too. Such rules belong in
  a layer of their own or on classes of their own.
- The only global things are Tailwind's `@property` registrations for `--tw-*` and the keyframes
  `enter` and `exit` from tw-animate-css.

### Hosts with Tailwind

A Tailwind host also simply includes `quassel/chat.css`; thanks to the prefix nothing collides
with its own utilities, and the layer names fit in with its own. For adjustments through
`className` it uses its own classes and sets variables as an arbitrary property:
`className="[--qsl-input-card-radius:var(--radius-lg)]"`.

Order, as soon as the host passes its own primitives as slots: include `quassel/chat.css` AFTER
the host's utilities. Only then do quassel's layout classes win against the base classes of the
host primitives (the host's `cn` does not know `qsl:` classes and does not resolve the conflict).
A host class that should then win against a quassel class needs `!`, e.g.
`className="min-h-16!"`. Hover and focus states of the host primitives are kept because their
selectors are more specific.

Developing on quassel and the host at the same time: include quassel in the host through
`"quassel": "link:../quassel/packages/quassel"` (the host's bundler compiles the TypeScript
sources along) and run `pnpm --filter quassel dev` in quassel. That keeps
`packages/quassel/build/chat.css` up to date through Tailwind watch; the host's dev server
reloads the file on every change.

## Gallery and showcase

```sh
pnpm install
pnpm dev        # stylesheet in watch mode plus the gallery on http://localhost:3210
pnpm check      # type check of package and gallery
pnpm test       # package tests (node:test, happy-dom, fake timers)
pnpm build      # build stylesheet and gallery
```

The gallery shows read only, input card with a fake agent (alternating text, thinking and
multiple tool calls of 3.5 seconds each, including steering), actions, themes and slots. The
README images come from `packages/gallery/showcase.html`: scenes via
`?scene=agent|details|questions|party|themes` (`questions` shows the actions: the resolved one
in the transcript, two open ones in the dock above the composer; `actions` works too; in `agent`
`run_tests` has been running for 1:40), dark with `&theme=dark`. `?scene=host` shows a host with
its own scale next to the default: font sizes from 12px, custom radii and speech bubble through
wrapper variables, popovers through `portalContainer` in the wrapper.

## Publishing

```sh
pnpm release --dry-run   # builds packages/quassel/dist and shows the contents of the package
pnpm release             # publishes to npm
```

The version counts up by itself: the release takes the patch after the latest version on npm and
writes it to `packages/quassel/package.json`; a minor or major step is set there by hand beforehand.
In VS Code, `Tasks: Run Build Task` offers `quassel: release` (token from `npm_key`) and the dry run.
The script (`scripts/publish.mjs`) checks the types, bundles `index` and `events` with esbuild
(dependencies stay external), generates the declarations with tsc, builds `chat.css` with the
Tailwind CLI and writes its own `package.json` with the built paths. It takes the token from
`NPM_TOKEN`, otherwise the user's `.npmrc` applies.

## Recipes

- **Transcript viewer**: `ChatMessages` with ready-made `Message[]`, no composer.
- **Chat with a custom backend**: receive events via SSE or WebSocket, reduce them with
  `useReducer(applyEvent, [])`, pass `status.running` on as `running`, wire `onSend` and
  `onStop` to your own endpoints (model for the flow: `packages/gallery/src/fakeAgent.ts`).
- **Server**: use `applyEvent` and `parseChatAttachments` from `quassel/events` in the backend
  to keep the same transcript and to validate attachments.
- **Custom look**: wrapper with `--qsl-*`, see `themes.css`; design system buttons through
  `QuasselProvider`.
