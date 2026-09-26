import { applyEvent, ChatEvent, Message } from "quassel";
import { useMemo, useReducer, useRef, useState } from "react";

/**
 * Ein geskripteter Agent für die Galerie: streamt Denken, einen Tool-Call und eine
 * Markdown-Antwort, kann abgebrochen werden und nimmt Zwischenrufe an, die er am
 * Ende der laufenden Runde beantwortet.
 */
export class FakeAgent {
  private steering: string[] = [];
  private cancelled = false;
  private running = false;

  constructor(
    private emit: (event: ChatEvent) => void,
    private setRunning: (running: boolean) => void,
  ) {}

  send(text: string) {
    this.emit({ kind: "user", text });
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
    this.emit({ kind: "system", text: "Abgebrochen." });
    this.emit({ kind: "turn-done" });
    this.setRunning(false);
  }

  private async run(text: string) {
    this.running = true;
    this.cancelled = false;
    this.setRunning(true);
    try {
      await this.stream(
        "thinking",
        "Die Frage betrifft die Demo-Daten. Ich hole mir kurz die Kennzahlen und fasse dann knapp zusammen.",
      );
      if (this.cancelled) return;

      const id = crypto.randomUUID();
      this.emit({
        kind: "tool",
        id,
        name: "suche_daten",
        arguments: JSON.stringify({ frage: text, limit: 3 }),
        label: `suche_daten { frage: "${kurz(text)}" }`,
      });
      await this.sleep(1100);
      if (this.cancelled) return;
      this.emit({
        kind: "tool-result",
        id,
        result: JSON.stringify({ treffer: 3, dauerMs: 412, quellen: ["messwerte", "berichte", "notizen"] }),
      });

      await this.stream("text", antwort(text));
      while (this.steering.length > 0 && !this.cancelled) {
        const zwischenruf = this.steering.shift()!;
        await this.stream("thinking", `Zwischenruf einordnen: "${kurz(zwischenruf)}" - das nehme ich noch mit.`);
        if (this.cancelled) return;
        await this.stream(
          "text",
          `\n\nZu deinem Zwischenruf **"${kurz(zwischenruf)}"**: gute Ergänzung, in einer echten Anbindung würde der Agent das jetzt in derselben Runde berücksichtigen.`,
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
    const teile = text.match(/\S+\s*/g) ?? [];
    for (const teil of teile) {
      if (this.cancelled) return;
      this.emit({ kind, delta: teil });
      await this.sleep(kind === "thinking" ? 30 : 45);
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

function kurz(text: string): string {
  return text.length > 60 ? `${text.slice(0, 60)} ...` : text;
}

function antwort(frage: string): string {
  return [
    `Zu deiner Frage "${kurz(frage)}" habe ich drei Quellen durchsucht. Kurzfassung:`,
    "",
    "- Die **Messwerte** sind vollständig und plausibel",
    "- In den *Berichten* gibt es zwei Auffälligkeiten",
    "- Die Notizen ändern am Bild nichts",
    "",
    "| Quelle | Treffer | Bewertung |",
    "|---|---|---|",
    "| messwerte | 214 | unauffällig |",
    "| berichte | 2 | prüfen |",
    "| notizen | 0 | - |",
    "",
    "Ein Beispiel für den Zugriff:",
    "",
    "```csharp",
    'var treffer = daten.Suche("berichte", limit: 3);',
    "```",
    "",
    "Sag Bescheid, wenn ich tiefer in die zwei Berichts-Auffälligkeiten gehen soll.",
  ].join("\n");
}

/** Verdrahtet den FakeAgent mit React-State: Nachrichten via applyEvent, running als Flag. */
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
