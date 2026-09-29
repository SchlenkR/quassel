import { applyEvent, type ChatEvent, type ChatTextCursor, type Message } from "quassel";
import { useMemo, useReducer, useRef, useState } from "react";

/**
 * A scripted agent for the gallery: streams thinking, a tool call that runs long enough
 * to show its elapsed time, and a
 * Markdown answer, can be cancelled and accepts interjections, which it answers at the
 * end of the running turn.
 */
export class FakeAgent {
  private steering: string[] = [];
  private cancelled = false;
  private running = false;
  private turn = 0;

  constructor(
    private emit: (event: ChatEvent) => void,
    private setRunning: (running: boolean) => void,
  ) {}

  send(text: string) {
    this.emit({ kind: "user", text, at: new Date().toISOString() });
    if (this.running) {
      this.steering.push(text);
      return;
    }
    void this.run(text);
  }

  stop() {
    if (!this.running) {
      return;
    }
    this.cancelled = true;
    this.steering = [];
    this.emit({ kind: "system", text: "Cancelled." });
    this.emit({ kind: "turn-done" });
    this.setRunning(false);
  }

  private async run(text: string) {
    this.turn += 1;
    this.running = true;
    this.cancelled = false;
    this.setRunning(true);
    try {
      await this.stream(
        "thinking",
        "The question is about the demo data. I will quickly fetch the key figures and then summarize briefly.",
      );
      if (this.cancelled) return;

      const id = `tool-${this.turn}`;
      this.emit({
        kind: "tool",
        id,
        name: "search_data",
        arguments: JSON.stringify({ question: text, limit: 3 }),
        label: `search_data { question: "${short(text)}" }`,
        at: new Date().toISOString(),
      });
      await this.sleep(5000);
      if (this.cancelled) return;
      this.emit({
        kind: "tool-result",
        id,
        result: JSON.stringify({ hits: 3, durationMs: 412, sources: ["measurements", "reports", "notes"] }),
      });

      await this.stream("text", answer(text));
      while (this.steering.length > 0 && !this.cancelled) {
        const interjection = this.steering.shift()!;
        await this.stream("thinking", `Placing the interjection: "${short(interjection)}" - I will take that into account.`);
        if (this.cancelled) return;
        await this.stream(
          "text",
          `\n\nAbout your interjection **"${short(interjection)}"**: good addition, with a real integration the agent would now take it into account in the same turn.`,
        );
      }
    } finally {
      if (!this.cancelled) {
        this.emit({ kind: "turn-done" });
        this.setRunning(false);
      }
      this.running = false;
    }
  }

  private async stream(kind: "text" | "thinking", text: string) {
    const parts = text.match(/\S+\s*/g) ?? [];
    const sequence = this.turn;
    let offset = 0;
    for (const part of parts) {
      if (this.cancelled) return;
      offset += part.replace(/\s/g, "").length;
      const cursor: ChatTextCursor = { conversationId: "gallery", sequence, offset };
      const at = new Date().toISOString();
      this.emit(kind === "text" ? { kind, delta: part, cursor, at } : { kind, delta: part, at });
      await this.sleep(kind === "thinking" ? 30 : 45);
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

function short(text: string): string {
  return text.length > 60 ? `${text.slice(0, 60)} ...` : text;
}

function answer(question: string): string {
  return [
    `For your question "${short(question)}" I searched three sources. Summary:`,
    "",
    "- The **measurements** are complete and plausible",
    "- The *reports* show two anomalies",
    "- The notes do not change the picture",
    "",
    "| Source | Hits | Assessment |",
    "|---|---|---|",
    "| measurements | 214 | unremarkable |",
    "| reports | 2 | check |",
    "| notes | 0 | - |",
    "",
    "An example of the access:",
    "",
    "```csharp",
    'var hits = data.Search("reports", limit: 3);',
    "```",
    "",
    "Let me know if I should dig deeper into the two report anomalies.",
  ].join("\n");
}

/** Wires the FakeAgent to React state: messages via applyEvent, running as a flag. */
export function useFakeAgent() {
  const [messages, dispatch] = useReducer(applyEvent, [] as Message[]);
  const [running, setRunning] = useState(false);
  const agentRef = useRef<FakeAgent | undefined>(undefined);
  const agent = useMemo(() => {
    agentRef.current = agentRef.current ?? new FakeAgent(dispatch, setRunning);
    return agentRef.current;
  }, []);
  return { messages, running, agent };
}
