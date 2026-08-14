export type Role = "user" | "assistant" | "thinking" | "tool" | "system" | "question";

export interface ToolInfo {
  id: string;
  name: string;
  arguments: string;
  result?: string;
  isError?: boolean;
}

/** Eine Rückfrage des Assistenten. `answer` gesetzt heißt: beantwortet, die Karte ist nur noch Beleg. */
export interface Question {
  callId: string;
  options: string[];
  answer?: string;
}

export interface Message {
  key: string;
  role: Role;
  text: string;
  closed?: boolean;
  tool?: ToolInfo;
  question?: Question;
}

/** off = nur Antworten, compact = Denken und Werkzeuge einzeilig, full = alles ausgeklappt. */
export type DetailMode = "off" | "compact" | "full";

export type ChatEvent =
  | { kind: "reset" }
  | { kind: "user"; text: string }
  | { kind: "text"; delta: string }
  | { kind: "thinking"; delta: string }
  | { kind: "tool"; id: string; name: string; arguments: string; label?: string }
  | { kind: "tool-result"; id: string; result: string; isError?: boolean }
  | { kind: "question"; callId: string; text: string; options: string[] }
  | { kind: "question-answered"; callId: string; answer: string }
  | { kind: "system"; text: string }
  | { kind: "turn-done" };

function closeLast(messages: Message[]): Message[] {
  const last = messages[messages.length - 1];
  if (!last || last.closed) {
    return messages;
  }
  return [...messages.slice(0, -1), { ...last, closed: true }];
}

function appendDelta(messages: Message[], role: Role, delta: string): Message[] {
  const last = messages[messages.length - 1];
  if (last && last.role === role && !last.closed) {
    return [...messages.slice(0, -1), { ...last, text: last.text + delta }];
  }
  return [...closeLast(messages), { key: crypto.randomUUID(), role, text: delta }];
}

/** Der Streaming-Kern: Deltas verschmelzen mit dem letzten offenen Block, alles andere schließt ihn. */
export function applyEvent(messages: Message[], event: ChatEvent): Message[] {
  switch (event.kind) {
    case "reset":
      return [];
    case "user":
      return [...closeLast(messages), { key: crypto.randomUUID(), role: "user", text: event.text }];
    case "text":
      return appendDelta(messages, "assistant", event.delta);
    case "thinking":
      return appendDelta(messages, "thinking", event.delta);
    case "tool":
      return [
        ...closeLast(messages),
        {
          key: crypto.randomUUID(),
          role: "tool",
          text: event.label ?? event.name,
          closed: true,
          tool: { id: event.id, name: event.name, arguments: event.arguments },
        },
      ];
    case "tool-result":
      return messages.map((message) =>
        message.tool?.id === event.id
          ? { ...message, tool: { ...message.tool, result: event.result, isError: event.isError } }
          : message,
      );
    case "question":
      return [
        ...closeLast(messages),
        {
          key: crypto.randomUUID(),
          role: "question",
          text: event.text,
          closed: true,
          question: { callId: event.callId, options: event.options },
        },
      ];
    case "question-answered":
      return messages.map((message) =>
        message.question?.callId === event.callId
          ? { ...message, question: { ...message.question, answer: event.answer } }
          : message,
      );
    case "system":
      return [...closeLast(messages), { key: crypto.randomUUID(), role: "system", text: event.text, closed: true }];
    case "turn-done":
      return closeLast(messages);
  }
}

export function prettyJson(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export function compactToolLine(tool: ToolInfo): string {
  const args = tool.arguments.replace(/\s+/g, " ").trim();
  const line = args && args !== "{}" ? `${tool.name} ${args}` : tool.name;
  return line.length > 160 ? `${line.slice(0, 160)} ...` : line;
}
