import { ChatEvent } from "../events";
import { streamChatCompletion } from "./openai";
import { AgentConfig, OpenAiMessage, SessionState, SessionStore } from "./types";

const MAX_RUNDEN = 12;

/**
 * Eine Unterhaltung: haelt Verlauf und Event-Log, streamt Antworten, fuehrt Tools aus.
 * Senden waehrend eines Laufs wird zum Zwischenruf und am Runden-Ende beruecksichtigt.
 * Abonnenten bekommen erst den bisherigen Verlauf, dann live.
 */
export class AgentSession {
  private readonly events: ChatEvent[] = [];
  private readonly history: OpenAiMessage[] = [];
  private readonly listeners = new Set<(event: ChatEvent) => void>();
  private readonly steering: string[] = [];
  private abort?: AbortController;
  private _running = false;

  constructor(
    readonly id: string,
    private readonly config: AgentConfig,
    private readonly store?: SessionStore,
    initial?: SessionState,
  ) {
    if (initial) {
      this.events.push(...initial.events);
      this.history.push(...initial.history);
    } else if (config.systemPrompt) {
      this.history.push({ role: "system", content: config.systemPrompt });
    }
  }

  get running(): boolean {
    return this._running;
  }

  subscribe(listener: (event: ChatEvent) => void): () => void {
    listener({ kind: "reset" });
    for (const event of this.events) {
      listener(event);
    }
    listener({ kind: "status", running: this._running });
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  send(text: string): void {
    if (this._running) {
      this.emit({ kind: "user", text });
      this.steering.push(text);
      return;
    }
    void this.run(text);
  }

  stop(): void {
    if (!this._running) {
      return;
    }
    this.steering.length = 0;
    this.abort?.abort();
  }

  private async run(text: string): Promise<void> {
    this._running = true;
    this.abort = new AbortController();
    const signal = this.abort.signal;
    this.emit({ kind: "status", running: true });
    this.emit({ kind: "user", text });
    this.history.push({ role: "user", content: text });

    try {
      for (let runde = 0; runde < MAX_RUNDEN; runde++) {
        const result = await streamChatCompletion(this.config, this.history, signal, {
          onText: (delta) => this.emit({ kind: "text", delta }),
          onThinking: (delta) => this.emit({ kind: "thinking", delta }),
        });
        this.history.push({
          role: "assistant",
          content: result.content || null,
          ...(result.toolCalls.length > 0 ? { tool_calls: result.toolCalls } : {}),
        });

        for (const call of result.toolCalls) {
          this.emit({ kind: "tool", id: call.id, name: call.function.name, arguments: call.function.arguments });
          const antwort = await this.runTool(call.function.name, call.function.arguments, call.id);
          this.history.push({ role: "tool", content: antwort.result, tool_call_id: call.id });
        }

        while (this.steering.length > 0) {
          this.history.push({ role: "user", content: this.steering.shift()! });
        }

        const fertig = result.toolCalls.length === 0 && this.history[this.history.length - 1]?.role !== "user";
        if (fertig) {
          break;
        }
      }
    } catch (error) {
      if (signal.aborted) {
        this.emit({ kind: "system", text: "Abgebrochen." });
      } else {
        this.emit({ kind: "system", text: error instanceof Error ? error.message : String(error) });
      }
    } finally {
      this._running = false;
      this.abort = undefined;
      this.emit({ kind: "turn-done" });
      this.emit({ kind: "status", running: false });
      await this.persist();
    }
  }

  private async runTool(name: string, argsText: string, callId: string): Promise<{ result: string }> {
    const tool = this.config.tools?.find((eintrag) => eintrag.name === name);
    if (!tool) {
      const fehler = `Unbekanntes Werkzeug: ${name}`;
      this.emit({ kind: "tool-result", id: callId, result: fehler, isError: true });
      return { result: fehler };
    }
    try {
      const args = argsText.trim() === "" ? {} : JSON.parse(argsText);
      const result = String(await tool.run(args));
      this.emit({ kind: "tool-result", id: callId, result });
      return { result };
    } catch (error) {
      const fehler = error instanceof Error ? error.message : String(error);
      this.emit({ kind: "tool-result", id: callId, result: fehler, isError: true });
      return { result: `Fehler: ${fehler}` };
    }
  }

  private emit(event: ChatEvent): void {
    if (event.kind !== "status") {
      this.events.push(event);
    }
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private async persist(): Promise<void> {
    if (!this.store) {
      return;
    }
    await this.store.save({
      id: this.id,
      events: this.events,
      history: this.history,
      updatedAt: Date.now(),
    });
  }
}
