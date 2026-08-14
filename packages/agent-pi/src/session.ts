import { ChatEvent } from "@quassel/events";
import { ChatSessionLike } from "@quassel/agent-node";
import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRuntime,
  SessionManager,
  type AgentSession as PiAgentSession,
} from "@earendil-works/pi-coding-agent";
import { PiChatConfig } from "./config";

/**
 * Eine Pi-Unterhaltung hinter dem quassel-Kontrakt: Pi-Events werden auf ChatEvents
 * gemappt, steer() ist das Dazwischenfunken, abort() der Stop. Abonnenten bekommen
 * erst den Verlauf (bei geoeffneten Sitzungen aus der Pi-Session-Datei rekonstruiert),
 * dann live.
 */
export class PiSession implements ChatSessionLike {
  private readonly events: ChatEvent[] = [];
  private readonly listeners = new Set<(event: ChatEvent) => void>();
  private _running = false;

  private constructor(
    readonly id: string,
    private readonly pi: PiAgentSession,
    private readonly onPersisted?: (sessionFile: string) => void,
  ) {
    this.events.push(...replayFromMessages(pi.messages));
    pi.subscribe((event) => this.mapPiEvent(event as Record<string, unknown>));
  }

  static async create(
    id: string,
    config: PiChatConfig,
    existingSessionFile?: string,
    onPersisted?: (sessionFile: string) => void,
  ): Promise<PiSession> {
    const cwd = config.cwd ?? process.cwd();
    const agentDir = config.agentDir ?? getAgentDir();

    let resourceLoader: DefaultResourceLoader | undefined;
    if (config.systemPrompt !== undefined || config.appendSystemPrompt !== undefined) {
      resourceLoader = new DefaultResourceLoader({
        cwd,
        agentDir,
        ...(config.systemPrompt !== undefined
          ? { systemPromptOverride: () => config.systemPrompt!, appendSystemPromptOverride: () => [] }
          : {}),
        ...(config.appendSystemPrompt !== undefined
          ? { appendSystemPromptOverride: () => [config.appendSystemPrompt!] }
          : {}),
      });
      await resourceLoader.reload();
    }

    let model;
    if (config.model) {
      const runtime = await ModelRuntime.create();
      model = runtime.getModel(config.model.provider, config.model.id);
      if (!model) {
        throw new Error(`Modell nicht gefunden: ${config.model.provider}/${config.model.id}`);
      }
    }

    const sessionManager = existingSessionFile
      ? SessionManager.open(existingSessionFile)
      : config.sessionDir
        ? SessionManager.create(cwd, config.sessionDir)
        : SessionManager.inMemory();

    const { session } = await createAgentSession({
      cwd,
      agentDir,
      sessionManager,
      ...(resourceLoader ? { resourceLoader } : {}),
      ...(model ? { model } : {}),
      ...(config.tools ? { tools: config.tools } : {}),
      ...(config.customTools ? { customTools: config.customTools as never[] } : {}),
      ...config.createOptions,
    } as Parameters<typeof createAgentSession>[0]);
    if (config.thinkingLevel) {
      session.setThinkingLevel(config.thinkingLevel as Parameters<typeof session.setThinkingLevel>[0]);
    }
    return new PiSession(id, session, onPersisted);
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
    this.emit({ kind: "user", text });
    if (this._running) {
      void this.pi.steer(text);
      return;
    }
    void this.run(text);
  }

  stop(): void {
    if (this._running) {
      void this.pi.abort();
    }
  }

  dispose(): void {
    this.pi.dispose();
  }

  private async run(text: string): Promise<void> {
    this._running = true;
    this.emit({ kind: "status", running: true });
    try {
      await this.pi.prompt(text);
    } catch (error) {
      this.emit({ kind: "system", text: error instanceof Error ? error.message : String(error) });
    } finally {
      this._running = false;
      this.emit({ kind: "turn-done" });
      this.emit({ kind: "status", running: false });
      if (this.pi.sessionFile) {
        this.onPersisted?.(this.pi.sessionFile);
      }
    }
  }

  private mapPiEvent(event: Record<string, unknown>): void {
    switch (event.type) {
      case "message_update": {
        const delta = event.assistantMessageEvent as { type?: string; delta?: string } | undefined;
        if (delta?.type === "text_delta" && delta.delta) {
          this.emit({ kind: "text", delta: delta.delta });
        } else if (delta?.type === "thinking_delta" && delta.delta) {
          this.emit({ kind: "thinking", delta: delta.delta });
        }
        break;
      }
      case "tool_execution_start":
        this.emit({
          kind: "tool",
          id: String(event.toolCallId),
          name: String(event.toolName),
          arguments: alsJson(event.args),
        });
        break;
      case "tool_execution_end":
        this.emit({
          kind: "tool-result",
          id: String(event.toolCallId),
          result: alsText(event.result),
          isError: event.isError === true,
        });
        break;
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
}

function alsJson(wert: unknown): string {
  try {
    return JSON.stringify(wert ?? {});
  } catch {
    return String(wert);
  }
}

function alsText(wert: unknown): string {
  if (typeof wert === "string") {
    return wert;
  }
  const inhalt = (wert as { content?: unknown })?.content;
  if (Array.isArray(inhalt)) {
    const texte = inhalt
      .filter((teil): teil is { type: string; text: string } => (teil as { type?: string })?.type === "text")
      .map((teil) => teil.text);
    if (texte.length > 0) {
      return texte.join("\n");
    }
  }
  return alsJson(wert);
}

/** Rekonstruiert den ChatEvent-Verlauf aus den Nachrichten einer geoeffneten Pi-Session. */
function replayFromMessages(messages: readonly unknown[]): ChatEvent[] {
  const events: ChatEvent[] = [];
  for (const roh of messages) {
    const message = roh as { role?: string; content?: unknown; toolCallId?: string; toolName?: string; isError?: boolean };
    if (message.role === "user") {
      const text =
        typeof message.content === "string"
          ? message.content
          : Array.isArray(message.content)
            ? message.content
                .filter((teil): teil is { type: string; text: string } => (teil as { type?: string })?.type === "text")
                .map((teil) => teil.text)
                .join("\n")
            : "";
      if (text) {
        events.push({ kind: "user", text });
      }
      continue;
    }
    if (message.role === "assistant" && Array.isArray(message.content)) {
      for (const teil of message.content as { type?: string; text?: string; thinking?: string; id?: string; name?: string; arguments?: unknown }[]) {
        if (teil.type === "text" && teil.text) {
          events.push({ kind: "text", delta: teil.text }, { kind: "turn-done" });
        } else if (teil.type === "thinking" && teil.thinking) {
          events.push({ kind: "thinking", delta: teil.thinking }, { kind: "turn-done" });
        } else if (teil.type === "toolCall") {
          events.push({ kind: "tool", id: String(teil.id), name: String(teil.name), arguments: alsJson(teil.arguments) });
        }
      }
      continue;
    }
    if (message.role === "toolResult" && message.toolCallId) {
      events.push({
        kind: "tool-result",
        id: message.toolCallId,
        result: alsText(message),
        isError: message.isError === true,
      });
    }
  }
  return events;
}
