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
3. **Input**: Card (`layout="card"`), single line (`"inline"`), bar (`"toolbar"`) or pill (`"pill"`)?
   Attachments allowed (`attachments`)? Custom buttons (`actions`, `toolbarLeft`, `toolbarRight`)?
4. **Steps**: Which detail level as default (`current`, `off`, `icons`, `chips`, `grouped`,
   `compact`, `full`)? Should the user be able to switch (`DetailModeSwitch`)?
5. **Look**: RAgents default or custom colors, radii, font (`--qsl-*`; the text size follows the
   host through `--qsl-font-size: 1em`)? Dark mode fixed, by
   switch or following the system? Custom primitives of the host design system (`QuasselProvider`)?
6. **Styles in the host**: Does the host have Tailwind? Without Tailwind `@schlenkr/quassel/chat.css` is enough.
7. **Texts**: Keep the English default labels or replace them through `texts`?

Stick to these rules while building:

- The components are deliberately dumb: `messages` and callbacks in, state and transport belong
  to the host. Frontend and backend only talk through `@schlenkr/quassel/events`.
- Style through `--qsl-*` variables on a wrapper and through slots, not by copying or forking the
  components.
- Classes that the host passes to quassel components through `className` are host classes;
  quassel itself only uses classes with the `qsl:` prefix.
- The gallery (`packages/gallery`) is the reference: every composition is built there once in a
  runnable form, with fake data.

## Setup

```sh
npm install @schlenkr/quassel        # the host brings React 18 or 19 itself
```

| Import | Contents |
|---|---|
| `@schlenkr/quassel` | React building blocks, `QuasselProvider`, types, texts, `announce`, `markdownPlainText` |
| `@schlenkr/quassel/events` | Event contract, `applyEvent`, attachment limits and validation, without React - for the backend too |
| `@schlenkr/quassel/chat.css` | Compiled stylesheet: theme variables, scoped reset, all utilities in use |

Runtime dependencies: `@base-ui/react`, `class-variance-authority`, `cn`, `lucide-react`,
`streamdown`. In the repo `@schlenkr/quassel` is a source package (`packages/quassel`, TypeScript without a
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
The transcript shows image attachments as a preview; a click opens them large in a dialog with
download and close, Escape or a click beside the image closes it.

## quassel - the components

Always import once: `import "@schlenkr/quassel/chat.css"`.

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
  appearance?: ChatAppearance;          // messageGap, denseMessageGap, toolGroupGap, toolRowPadding
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
  jumpToEndThreshold?: number;          // default 120px; tolerance for following and the jump button
  timestampOptions?: TimestampOptions;  // position "aside" | "above", format, locale, timeZone, showDaySeparators
  codeBlockOptions?: CodeBlockOptions;  // wrap, maxHeight, showCopyButton
  bubbleOptions?: BubbleOptions;        // userBackgroundFullWidth, variant, maxWidth, sides, showSender, senderLabel
  messageActions?: MessageActionsOptions; // copy, copyFormatted, edit, retry, custom
  toolElapsedThreshold?: number | false;  // default 3000 ms until running tools show their elapsed time, false = never
}
```

Its own scroll container: follows the end while you are within `jumpToEndThreshold` pixels
of the bottom. Scrolling beyond that tolerance pauses following and immediately shows the
jump-to-end button. An upward wheel, key, or touch gesture pauses at once, also within the
tolerance and while content keeps growing before its scroll event arrives. Scrolling back down
within the tolerance resumes following and hides the button. Scrollbar and native scrolling
use the same boundary; content growth does not pause following. It carries the stable
attribute `data-quassel-transcript`; it gets custom classes through `scrollerClassName`, and
`scrollerRef` delivers the element itself.

With `showTimestamps`, `timestampOptions.position` chooses `"aside"` (the default, a left
column) or `"above"` (a line above each block). The `time` column beside a message is at least
five digits wide and never wraps; longer formats widen it. Timestamps use the UI font at the
same small size as tool text: 85% of the base, with line height 1.4.

`bubbleOptions.userBackgroundFullWidth` defaults to `true`: a user message has a background
across the available message row. Only the background expands; the content keeps its normal
width, `bubbleOptions.maxWidth`, alignment and sender label. `false` restores a background
around the content. `variant: "plain"` and contributions made plain through `owner` stay plain.
Assistant bubbles and custom bubble colors retain their existing behavior. A full background
uses `data-chat="bubble-background"`, its content `data-chat="bubble-content"`; the message
row carries `data-background-width="full"` or `"content"` when rendered as a bubble.

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

Thinking and tool detail popovers stay within the available viewport space, up to 70 percent
of the viewport height or 620 px. Long content scrolls inside the body; the title and close
button remain visible, including when an open popup's viewport is resized.

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
  layout?: "card" | "toolbar" | "inline" | "pill";  // default "card"
  detailsContainer?: HTMLElement | null;   // with "toolbar": target for attachments, errors and buttons (portal)
  rows?: number;                        // default 3; with maxRows the input grows up to that (inline and pill start at 1)
  maxRows?: number;
  actions?: ToolbarAction[];            // { icon?, label?, title?, disabled?, active?, onClick }; active makes a toggle
  toolbarLeft?: ReactNode; toolbarRight?: ReactNode;
  microphone?: ChatMicrophone;          // pill only: host-controlled voice input
  replaceInput?: ReactNode;             // pill only: replaces the textarea area, preserving the draft
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

#### Pill composer

`layout="pill"` renders a single rounded row: `actions` and `toolbarLeft`, the textarea (or
`replaceInput`), `toolbarRight`, the attachment button, and one primary action at the far right.
The row starts at 64px with a 48px round action; the input text uses the host base.
It starts with one text row and grows to `maxRows` (default 6), then scrolls inside the textarea.
The 32px corners stay rounded as the row grows. Previews and errors sit above the pill.
The other layouts keep their existing size, structure and behavior; voice props apply only to pill.

| Condition, in priority order | Primary action | Behavior |
|---|---|---|
| `microphone.state === "preparing"` | Spinner | Connecting; an existing press can still end or cancel |
| `microphone.state === "recording"` | Live microphone | Recording color, indicator and level-driven aura; host handles finishing |
| `microphone.state === "transcribing"` | Spinner, disabled | Busy until the host changes state |
| Text or attachments | Send | `onSend`; also while running, for steering |
| Running, empty | Stop | `onStop`; disabled when no stop handler exists |
| Empty, idle, `microphone` provided | Microphone | Host press callbacks |
| Empty, no microphone (or send pending) | Send, disabled | No empty send or accidental recording |

`disabled` blocks the textarea, attachment button and primary action. `sendDisabled` blocks
sending without blocking microphone or stop. Hosts control their own slot buttons' disabled
state. During voice preparation, recording and transcription the draft is preserved and
cannot be submitted. `replaceInput` hides the textarea without discarding it and blocks sending
until removed. Use it for a waveform, elapsed recording time or transcription status.

The package exports `ChatMicrophone` and `MicrophonePress`:

```ts
interface MicrophonePress {
  source: "pointer" | "keyboard" | "virtual";
  timeStamp: number;
}

interface ChatMicrophone {
  state: "idle" | "preparing" | "recording" | "transcribing";
  level?: number;
  onPressStart: (press: MicrophonePress) => void;
  onPressEnd: (press: MicrophonePress) => void;
  onCancel: () => void;
  label?: string;
}
```

The host requests microphone permission, captures audio, computes `level` and transcribes.
Quassel never opens the microphone. The level is clamped to 0-1; non-finite values become 0.
`label` overrides the idle microphone name. All other voice labels and tooltips come from
`texts`: `microphone`, `microphoneHint`, `microphonePreparing`, `microphoneRecording` and
`microphoneTranscribing`, included in `englishTexts` and `germanTexts`.

Primary pointer presses use pointer capture; Space and Enter emit equivalent start/end pairs
and ignore repeats. `timeStamp` is the event timestamp in milliseconds, so the host can measure
a hold. A screen reader's virtual activation emits a start/end pair with the same timestamp.
There is no duplicate callback from the click after a pointer or keyboard press. Start and end
remain paired across changes from idle to preparing to recording; the end uses the callbacks
that received the start.

For press-and-hold, start capture on `onPressStart`, then finish on `onPressEnd`. For
click-to-latch, keep recording after a short pair, finish after a long pair or a subsequent
pair that began while recording, and treat virtual pairs as short clicks. The gallery's
`PillDemo.tsx` demonstrates both with a 250ms threshold. On finishing, set `state` to
`"transcribing"`, then to `"idle"`; insert the transcript with `ChatInputHandle.insert(text)`
or send it through the host. A host can use the same API while an agent is running.

Escape (also with focus elsewhere), pointer cancellation, lost pointer capture, keyboard
focus loss during a press, window blur, a hidden document, disabling and unmounting cancel
active voice input through `onCancel`. The host should release audio resources and set its
state back to idle. Preparing ignores new presses; transcribing is disabled and `aria-busy`.

Enter sends, Shift+Enter inserts a line break, and `sendShortcut="mod-enter"` requires Ctrl
or Cmd. IME composition never sends. Buttons have accessible names and focus outlines.
Icons crossfade and rotate on the same button; reduced motion disables these transitions and
the spinner rotation and keeps the recording aura at a fixed size.

The primary action uses a native button for pointer capture and keyboard handling. Theme it
through the pill variables; `QuasselProvider.components.Button` still supplies attachment and
declarative action buttons.

The aura is a pointer-transparent portal in the button's document body, positioned against the
button each animation frame so scrolling and resizing keep it aligned. It escapes clipping
and transformed ancestors of the composer. Its colors are read from the button's host theme;
`--qsl-pill-aura-z-index` controls its stacking order (default 1000).

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
  `copyChatText`, `copyChatHtml`, `createChatScroll`, `ChatSendContext`, `formatElapsed(ms, texts)` and
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
| `--qsl-inline-code-background` | inline code tint | unset: 70% `--qsl-secondary`, 30% transparent |
| `--qsl-inline-code-foreground` | inline code text | unset: inherited text color |
| `--qsl-inline-code-edge` | inline code outline | unset: transparent |
| `--qsl-code-background` | Markdown code block surface | unset: `--qsl-secondary` |
| `--qsl-code-border` | Markdown code block border | unset: `--qsl-border` |
| `--qsl-blockquote-background` | blockquote tint | unset: 6% `--qsl-primary`, 94% transparent |
| `--qsl-destructive` | errors, stop | `#a94360` / `#ffa2b0` |
| `--qsl-success` | check marks | `#3b705f` / `#8dceae` |
| `--qsl-border`, `--qsl-border-soft`, `--qsl-border-strong` | lines | |
| `--qsl-glass-edge` | edge in the `material` tone | |
| `--qsl-bar-shadow`, `--qsl-pop-shadow`, `--qsl-card-shadow` | shadows | |
| `--qsl-radius` | base radius, all radii derive from it | `0.5rem` |
| `--qsl-radius-sm`, `-md`, `-lg`, `-xl`, `-2xl` | single steps, otherwise from `--qsl-radius` | not set: `* 0.6`, `* 0.8`, `* 1`, `* 1.4`, `* 1.8` |
| `--qsl-radius-panel` | cards, e.g. the action card | `17px` |
| `--qsl-input-card-radius` | input card | not set: `--qsl-radius-xl` |
| `--qsl-pill-background` | pill surface | `--qsl-background` |
| `--qsl-pill-border` | pill edge | `--qsl-border` |
| `--qsl-pill-shadow` | pill elevation | `--qsl-bar-shadow` |
| `--qsl-pill-primary-background` | round action background | `--qsl-primary` |
| `--qsl-pill-primary-foreground` | round action icon | `--qsl-primary-foreground` |
| `--qsl-pill-primary-shadow` | round action elevation | soft accent shadow |
| `--qsl-pill-recording-background` | recording action background | `--qsl-destructive` |
| `--qsl-pill-recording-foreground` | recording icon and indicator | `--qsl-background` |
| `--qsl-pill-aura-color` | voice aura glow | `--qsl-destructive` |
| `--qsl-pill-aura-ring-color` | voice aura ring | aura color |
| `--qsl-pill-aura-z-index` | portal stacking order | `1000` |
| `--qsl-bubble-radius` | speech bubble of own messages | not set: `10px 10px 4px 10px` (`material` tone: `9px`) |
| `--qsl-font-size` | text size of the quassel root, see [Text size](#text-size) | `13px`; `1em` follows the host |
| `--qsl-tool-group-gap` | gap between rows in an expanded group | `1px` |
| `--qsl-tool-row-padding` | vertical padding inside tool/thinking rows and group headers | `1px` |
| `--qsl-font`, `--qsl-mono` | fonts | system font, `ui-monospace` |
| `--qsl-color-scheme` | `color-scheme` of the quassel elements | `light` / `dark` |

Spacing uses `--qsl-spacing` (0.235rem, compact unit) and the chat dimensions
`--qsl-chat-message-gap` (10px), `--qsl-chat-dense-message-gap` (3px),
`--qsl-chat-content-max-width` and `--qsl-chat-horizontal-padding` (24px). These four are also set
by `appearance`, `maxWidth` and `horizontalPadding`. `appearance` additionally accepts
`toolGroupGap` and `toolRowPadding` (CSS lengths; numbers are pixels). Typography is controlled
only by `--qsl-font`, `--qsl-mono` and `--qsl-font-size`.

Every variable takes effect from the element it is set on, the radii too: "not set" means
quassel defines them nowhere itself and computes with the default at the place of use. A wrapper
that sets `--qsl-radius-md` or `--qsl-bubble-radius` therefore reaches into every quassel
element. Small buttons cap `--qsl-radius-md` at 10 or 12px.

A host with a minimum font size chooses a base that keeps its 85% small text above that limit.
Popovers live in `document.body` by default and only inherit the wrapper's color and font-family
variables with `portalContainer` (see slots); the base size is passed to them automatically.

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

### Text size

The typography inputs are exactly `--qsl-font` (UI family), `--qsl-mono` (monospace family) and
`--qsl-font-size` (base size). quassel defaults to 13px. Set one size on a wrapper; every size
inside follows it. Any CSS length works, and `1em` inherits the surrounding font size:

```css
.my-chat {
    --qsl-font-size: 1em;
}
```

The scale is fixed; individual sizes and line heights have no public overrides:

| Content | Size relative to base | Line height |
|---|---|---|
| Messages, card/inline/toolbar/pill composer, pending action and question cards, options, text buttons | 1 | 1.5 |
| Step rows, group headers, timestamps, chips, tool arguments/results, labels, badges, notices, table meta text | 0.85 | 1.4 |
| Markdown h1 | 1.3 | 1.25 |
| Markdown h2 | 1.15 | 1.3 |
| Markdown h3 | 1.05 | 1.35 |
| Markdown h4-h6 | 1 | 1.4 |
| Inline monospace and Markdown code blocks | 0.9 of surrounding text | inherited |

Markdown tables use body text; their `<small>` content uses the small size. Code inside a code
block inherits the block's size, so the 0.9 factor applies only once. Tool rows use the UI font;
arguments and results use the monospace font at the small size.

`--qsl-base` is internal: a registered `<length>` property (`@property`, initial value `13px`).
The outer quassel root resolves the selected size into an absolute length, which descendants
inherit unchanged. Small text therefore never shrinks again inside another small element.
Set `--qsl-font-size` on the outer root or an ancestor, and never set `--qsl-base` yourself.

`Markdown` carries its own styling scope and reset. Import the same stylesheet and use it
outside a transcript to render a document with exactly the same Markdown typography:

```tsx
import { Markdown } from "@schlenkr/quassel";
import "@schlenkr/quassel/chat.css";

<div className="my-chat">
  <Markdown text={documentText} />
</div>
```

Headings, emphasis, lists, code, links, blockquotes and tables share one set of rules in documents
and answers. Their colors come from the theme variables, including the three Markdown background
variables in the table above. No host Markdown stylesheet is needed.

A tool detail popover renders in `document.body` (or `portalContainer`), outside the chat.
quassel passes it the absolute base of the chat that opened it. A custom `PopoverContent` must
apply the `style` prop it receives to its popup for the same effect. Spacing remains based on
`--qsl-spacing` in `rem`.

`@property` registrations are ignored inside shadow trees. A host that mounts quassel in a
shadow root includes `@schlenkr/quassel/chat.css` in the document as well, so the absolute base
registration is available there too.

#### Migration to 0.6

Delete overrides of `--qsl-chat-font-size`, `--qsl-chat-line-height`, `--qsl-timestamp-font-size`,
`--qsl-tool-font-scale` and all `--qsl-text-*` variables (including `--qsl-text-sm`,
`--qsl-text-trace`, `--qsl-text-label`, `--qsl-text-meta`, `--qsl-text-xs`, `--qsl-text-lg`,
`--qsl-text-xl`, `--qsl-text-base`, `--qsl-text-small` and their `--line-height` companions).
Replace the host's running text size with a single `--qsl-font-size` value, or use `1em` to
follow the surrounding text. Remove `appearance.fontSize`, `appearance.lineHeight`,
`appearance.toolFontScale` and `timestampOptions.fontScale`; they are no longer accepted.
Delete duplicated host Markdown typography rules and render documents with `Markdown`.
Colors, radii, shadows and spacing options keep their existing contract.

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
import { QuasselProvider, type QuasselButtonProps } from "@schlenkr/quassel";

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
| `PopoverContent` | `anchor` (virtual element with `getBoundingClientRect`), `align`, `side`, `sideOffset`, `collisionPadding`, `className`, `style` (carries `--qsl-base`), `aria-label`, `portalContainer` (resolved target or `undefined` for `document.body`), `children` |

`className` contains quassel's own layout classes (e.g. the position of a button); a slot should
keep them. A custom `PopoverContent` should pass `portalContainer` to its portal, apply `style` to
its popup (text size, see [Text size](#text-size)) and, if the host wants to detect open
popovers, set `data-quassel-popover` itself. `defaultComponents` returns the
built-in primitives for wrapping, `useQuasselComponents()` the currently effective ones, e.g. for
a custom action card.

`allowUrl` extends the link policy of the Markdown: the defaults are http, https, mailto, tel,
ftp, irc, xmpp and relative addresses; everything else is dropped unless `allowUrl` allows it.

`resolveUrl` maps every link and image address of the Markdown before that policy applies, for
example relative paths of a document onto the host's file route; the policy then checks the
result. An inner provider's `resolveUrl` replaces the outer one, so a document view can resolve
against its own folder inside a chat that resolves against something else:

```tsx
<QuasselProvider resolveUrl={(url) => url.startsWith("docs/") ? `/files/${url}` : url}>
  <Markdown text={report} />
</QuasselProvider>
```

## CSS

### Hosts without Tailwind

`@schlenkr/quassel/chat.css` is precompiled and needs nothing else. It does not change the host page:

- All utilities carry the `qsl:` prefix (in CSS `.qsl\:flex`), the theme variables `--qsl-*`,
  its own keyframes `qsl-*`.
- There is no global reset. The Tailwind preflight applies only to elements with `data-quassel`
  (the roots of panel, transcript, composer, Markdown, popover and primitives) and their descendants,
  with zero specificity. There, as in RAgents, the WebKit scrollbars are hidden too.
- The rules live in the cascade layers `theme`, `base`, `components` and `utilities`. Unlayered rules of the
  host therefore always win - good for custom classes through `className`, but global element
  rules of the host (`button { ... }`, `a { ... }`) reach into quassel too. Such rules belong in
  a layer of their own or on classes of their own.
- The only global things are Tailwind's `@property` registrations for `--tw-*`, quassel's
  `@property --qsl-base` and the keyframes `enter` and `exit` from tw-animate-css.

### Hosts with Tailwind

A Tailwind host also simply includes `@schlenkr/quassel/chat.css`; thanks to the prefix nothing collides
with its own utilities, and the layer names fit in with its own. For adjustments through
`className` it uses its own classes and sets variables as an arbitrary property:
`className="[--qsl-input-card-radius:var(--radius-lg)]"`.

Order, as soon as the host passes its own primitives as slots: include `@schlenkr/quassel/chat.css` AFTER
the host's utilities. Only then do quassel's layout classes win against the base classes of the
host primitives (the host's `cn` does not know `qsl:` classes and does not resolve the conflict).
A host class that should then win against a quassel class needs `!`, e.g.
`className="min-h-16!"`. Hover and focus states of the host primitives are kept because their
selectors are more specific.

Developing on quassel and the host at the same time: include quassel in the host through
`"@schlenkr/quassel": "link:../quassel/packages/quassel"` (the host's bundler compiles the TypeScript
sources along) and run `pnpm --filter @schlenkr/quassel dev` in quassel. That keeps
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
its own base next to the default: 15px body text, custom radii and speech bubble through
wrapper variables, popovers through `portalContainer` in the wrapper.

The Pill composer demo includes an interactive fake agent, simulated press-and-hold and
click-to-latch recording, waveform and transcription, plus every primary state in light and
dark. `showcase.html?scene=pill&theme=light` (or `dark`) shows a compact state sheet including
idle, text, running, steering, preparing, recording, transcribing, disabled and no microphone.

## Publishing

```sh
pnpm release --dry-run   # builds packages/quassel/dist and shows the contents of the package
pnpm release             # publishes to npm
pnpm --dir packages/quassel pack --pack-destination /tmp/quassel-preview
```

The version counts up by itself: the release takes the patch after the latest version on npm and
writes it to `packages/quassel/package.json`; a minor or major step is set there by hand beforehand.
In VS Code, `Tasks: Run Build Task` offers `quassel: release` (token from `npm_key`) and the dry run.
The script (`scripts/publish.mjs`) checks the types, bundles `index` and `events` with esbuild
(dependencies stay external), generates the declarations with tsc, builds `chat.css` with the
Tailwind CLI and writes its own `package.json` with the built paths. It takes the token from
`NPM_TOKEN`, otherwise the user's `.npmrc` applies.

`pnpm pack` in `packages/quassel` runs the same type check, bundling, declaration and CSS build
through `prepack` (`scripts/publish.mjs --build-only`) and packs `dist` at the declared version.
It does not query npm, change versions, write credentials or publish. Use the tarball to test
a host before releasing. `publishConfig.linkDirectory=false` keeps the gallery linked to source.

## Recipes

- **Transcript viewer**: `ChatMessages` with ready-made `Message[]`, no composer.
- **Chat with a custom backend**: receive events via SSE or WebSocket, reduce them with
  `useReducer(applyEvent, [])`, pass `status.running` on as `running`, wire `onSend` and
  `onStop` to your own endpoints (model for the flow: `packages/gallery/src/fakeAgent.ts`).
- **Server**: use `applyEvent` and `parseChatAttachments` from `@schlenkr/quassel/events` in the backend
  to keep the same transcript and to validate attachments.
- **Custom look**: wrapper with `--qsl-*`, see `themes.css`; design system buttons through
  `QuasselProvider`.
