# quassel

Composable chat building blocks for React: a streaming transcript with thinking and tool steps,
clarifying questions, an input card, a small CSS foundation, and an event contract with a
ready-made backend for OpenAI-compatible endpoints. One package, no runtime dependencies.

![An agent chat with grouped steps, timestamps, Markdown and the input card](docs/images/agent.png)

## What you can build

**Agent chats that show their work.** Thinking and tool calls appear as steps. Pick how much
of them the user sees - from answers only to fully expanded - and let them switch at runtime.

![The same steps as icons, chips and single lines](docs/images/details.png)

**Clarifying questions.** The agent asks, the user picks one or several options or answers
freely. Answered questions stay in the transcript as a record.

**Multi-party conversations.** Colored bubbles with labels for agents that talk to each other.

<p>
  <img src="docs/images/questions.png" alt="Clarifying questions with single and multiple choice" width="49%">
  <img src="docs/images/party.png" alt="Planner and reviewer as labeled bubbles" width="49%">
</p>

**Your look, not a fork.** Every color, radius and font is a `--qsl-*` token. A theme is a class
that overrides tokens; dark mode follows the system or `data-theme`.

![Default, sunset and emerald themes](docs/images/themes.png)

![The agent chat in dark mode](docs/images/agent-dark.png)

## Highlights

- Streaming-safe Markdown with tables and code, no dependencies, no `dangerouslySetInnerHTML`.
- Steering: typing while a run is active sends into the running turn.
- Timestamps, day separators, message actions and copy buttons for code blocks.
- Screen reader friendly: the transcript is not a live region; finished replies and new
  questions are announced once, with the host in control of the wording.
- All labels are replaceable through `texts` (defaults are German).

## Install

```sh
npm install quassel
```

| Import | Contents |
|---|---|
| `quassel` | React components, `useChat`, types |
| `quassel/events` | The event contract and the pure reducer `applyEvent`, without React |
| `quassel/server` | Node backend for OpenAI-compatible endpoints with sessions and SSE |
| `quassel/chat.css` | Component styles including the tokens |
| `quassel/foundation.css` | Tokens, color wash and glass panel for the whole page |

```tsx
import { ChatInputToolbar, ChatMessages, ChatPanel, useChat } from "quassel";
import "quassel/chat.css";

export function Chat() {
  const { messages, running, send, stop } = useChat("http://localhost:3300/chat/demo");
  return (
    <ChatPanel composer={<ChatInputToolbar onSend={send} onStop={stop} running={running} />}>
      <ChatMessages messages={messages} running={running} detailMode="grouped" />
    </ChatPanel>
  );
}
```

```ts
import { createServer } from "node:http";
import { createChatHandler, SessionManager } from "quassel/server";

const manager = new SessionManager({ baseUrl: "http://localhost:11434/v1", model: "qwen3:4b" });
const handler = createChatHandler({ manager });

createServer(async (req, res) => {
  if (!(await handler(req, res))) res.writeHead(404).end();
}).listen(3300);
```

Any backend that emits the `quassel/events` stream works with the same components.

## Development

```sh
pnpm install
pnpm dev          # gallery on http://localhost:3210
pnpm check        # type check
pnpm release      # build and publish to npm (see docs/guide.md)
```

The full build guide - every prop, the event contract, the backend - is in
[docs/guide.md](docs/guide.md) (German). It is written so that an AI assistant can build an
application with quassel from it.

## License

[MIT](LICENSE)
