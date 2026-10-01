import { applyEvent, type ChatEvent, type ChatTextCursor, type Message } from "quassel";
import { useMemo, useReducer, useRef, useState } from "react";

type DemoTurn = {
  sequence: number;
  question: string;
  steering: string[];
  cancelled: boolean;
  offset: number;
};

export class FakeAgent {
  private active?: DemoTurn;
  private sequence = 0;

  constructor(
    private emit: (event: ChatEvent) => void,
    private setRunning: (running: boolean) => void,
  ) {}

  send(text: string) {
    const inputId = crypto.randomUUID();
    this.emit({ kind: "user", text, inputId, at: new Date().toISOString() });
    if (this.active) {
      this.emit({ kind: "steered", inputId });
      this.active.steering.push(text);
      return;
    }
    const turn: DemoTurn = { sequence: ++this.sequence, question: text, steering: [], cancelled: false, offset: 0 };
    this.active = turn;
    this.setRunning(true);
    void this.run(turn);
  }

  stop() {
    if (!this.active) return;
    this.active.cancelled = true;
    this.active = undefined;
    this.emit({ kind: "system", text: "Cancelled." });
    this.emit({ kind: "turn-done" });
    this.setRunning(false);
  }

  private async run(turn: DemoTurn) {
    try {
      await this.tool(turn, "search_data", { question: turn.question, limit: 3 }, { sources: ["measurements", "reports", "notes"] });
      await this.stream(turn, "text", "I found three sources. The reports mention two anomalies; I will read those next.");
      await this.tool(turn, "read_reports", { reports: ["report-a", "report-b"] }, { error: "The report source timed out." }, true);
      await this.stream(turn, "text", "The report source timed out. I will retry before comparing the measurements.");
      await this.tool(turn, "retry_reports", { reports: ["report-a", "report-b"] }, { anomalies: 2 });
      await this.stream(turn, "thinking", "Both reports refer to the same measurement period. I need to compare them against the raw measurements before drawing a conclusion.");
      await this.tool(turn, "compare_sources", { sources: ["measurements", "reports"] }, { measurements: 214, anomalies: 2 });
      await this.stream(turn, "text", "The comparison confirms the two anomalies. I will check the totals and the notes before giving you the summary.");
      await this.tool(turn, "verify_totals", { includeNotes: true }, { total: 214, notes: 0, verified: true });
      await this.stream(turn, "thinking", "The totals agree. I can now summarize the findings and include any additional instructions.");
      const instructions: string[] = [];
      do {
        if (turn.cancelled) return;
        const pending = turn.steering.splice(0);
        instructions.push(...pending);
        if (pending.length > 0) {
          await this.stream(turn, "thinking", `Taking your additions into account: ${pending.map(short).join("; ")}`);
          await this.tool(turn, `check_additions_${instructions.length}`, { instructions: pending }, { checked: true });
        }
        await this.stream(turn, "text", answer(turn.question, instructions));
      } while (turn.steering.length > 0);
    } finally {
      if (this.active === turn) {
        this.emit({ kind: "turn-done" });
        this.active = undefined;
        this.setRunning(false);
      }
    }
  }

  private async tool(turn: DemoTurn, name: string, args: object, result: object, isError = false) {
    if (turn.cancelled) return;
    const id = `${turn.sequence}-${name}`;
    this.emit({ kind: "tool", id, name, arguments: JSON.stringify(args), at: new Date().toISOString() });
    await this.sleep(3500);
    if (turn.cancelled) return;
    this.emit({ kind: "tool-result", id, result: JSON.stringify(result), isError });
  }

  private async stream(turn: DemoTurn, kind: "text" | "thinking", text: string) {
    const parts = text.match(/\S+\s*/g) ?? [];
    for (const part of parts) {
      if (turn.cancelled) return;
      if (kind === "text") turn.offset += part.replace(/\s/g, "").length;
      const cursor: ChatTextCursor = { conversationId: "gallery", sequence: turn.sequence, offset: turn.offset };
      const at = new Date().toISOString();
      this.emit(kind === "text" ? { kind, delta: part, cursor, at } : { kind, delta: part, at });
      await this.sleep(kind === "thinking" ? 40 : 70);
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

function short(text: string): string {
  return text.length > 60 ? `${text.slice(0, 60)} ...` : text;
}

function answer(question: string, instructions: string[]): string {
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
    ...instructions.flatMap((instruction) => ["", `Your addition **"${short(instruction)}"** is included in this summary.`]),
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
