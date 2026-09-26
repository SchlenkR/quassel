import { AgentConfig, OpenAiMessage, OpenAiToolCall } from "./types";

export interface StreamCallbacks {
  onText: (delta: string) => void;
  onThinking: (delta: string) => void;
}

export interface StreamResult {
  content: string;
  toolCalls: OpenAiToolCall[];
  finishReason: string | undefined;
}

interface DeltaToolCall {
  index?: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

/**
 * Ein Streaming-Aufruf gegen /chat/completions. Denk-Anteile kommen je nach Backend als
 * eigenes reasoning-Feld (OpenRouter) oder als <think>-Tags im Content (Ollama) - beides
 * landet in onThinking.
 */
export async function streamChatCompletion(
  config: AgentConfig,
  messages: OpenAiMessage[],
  signal: AbortSignal,
  callbacks: StreamCallbacks,
): Promise<StreamResult> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    stream: true,
  };
  if (config.temperature !== undefined) body.temperature = config.temperature;
  if (config.topP !== undefined) body.top_p = config.topP;
  if (config.maxTokens !== undefined) body.max_tokens = config.maxTokens;
  if (config.tools && config.tools.length > 0) {
    body.tools = config.tools.map((tool) => ({
      type: "function",
      function: { name: tool.name, description: tool.description, parameters: tool.parameters },
    }));
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      ...config.headers,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Backend antwortet mit ${response.status}: ${detail.slice(0, 400)}`);
  }

  const denkFilter = new ThinkTagFilter(callbacks);
  const toolCalls = new Map<number, OpenAiToolCall>();
  let content = "";
  let finishReason: string | undefined;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let puffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    puffer += decoder.decode(value, { stream: true });
    const zeilen = puffer.split("\n");
    puffer = zeilen.pop() ?? "";
    for (const zeile of zeilen) {
      if (!zeile.startsWith("data:")) {
        continue;
      }
      const daten = zeile.slice(5).trim();
      if (!daten || daten === "[DONE]") {
        continue;
      }
      const chunk = JSON.parse(daten);
      const choice = chunk.choices?.[0];
      if (!choice) {
        continue;
      }
      if (choice.finish_reason) {
        finishReason = choice.finish_reason;
      }
      const delta = choice.delta ?? {};
      const reasoning = delta.reasoning ?? delta.reasoning_content;
      if (typeof reasoning === "string" && reasoning.length > 0) {
        callbacks.onThinking(reasoning);
      }
      if (typeof delta.content === "string" && delta.content.length > 0) {
        content += denkFilter.push(delta.content);
      }
      for (const teil of (delta.tool_calls ?? []) as DeltaToolCall[]) {
        const index = teil.index ?? 0;
        const bisher = toolCalls.get(index) ?? {
          id: teil.id ?? `call_${index}`,
          type: "function" as const,
          function: { name: "", arguments: "" },
        };
        if (teil.id) bisher.id = teil.id;
        if (teil.function?.name) bisher.function.name += teil.function.name;
        if (teil.function?.arguments) bisher.function.arguments += teil.function.arguments;
        toolCalls.set(index, bisher);
      }
    }
  }
  content += denkFilter.flush();

  return {
    content,
    toolCalls: [...toolCalls.entries()].sort(([a], [b]) => a - b).map(([, call]) => call),
    finishReason,
  };
}

/**
 * Trennt <think>-Bloecke aus einem Delta-Strom: Denk-Text geht an onThinking, der Rest
 * wird zurueckgegeben. Tags koennen mitten in einem Chunk oder ueber Chunk-Grenzen liegen.
 */
class ThinkTagFilter {
  private inThink = false;
  private rest = "";

  constructor(private callbacks: StreamCallbacks) {}

  push(delta: string): string {
    this.rest += delta;
    let heraus = "";
    for (;;) {
      const tag = this.inThink ? "</think>" : "<think>";
      const pos = this.rest.indexOf(tag);
      if (pos === -1) {
        const sicher = this.sicherAusgebbar(this.rest, tag);
        heraus += this.gebeAus(this.rest.slice(0, sicher));
        this.rest = this.rest.slice(sicher);
        return heraus;
      }
      heraus += this.gebeAus(this.rest.slice(0, pos));
      this.rest = this.rest.slice(pos + tag.length);
      this.inThink = !this.inThink;
    }
  }

  flush(): string {
    const heraus = this.gebeAus(this.rest);
    this.rest = "";
    return heraus;
  }

  /* Ein angebrochenes Tag am Chunk-Ende bleibt im Puffer, bis der Rest eintrifft. */
  private sicherAusgebbar(text: string, tag: string): number {
    for (let laenge = tag.length - 1; laenge > 0; laenge--) {
      if (text.endsWith(tag.slice(0, laenge))) {
        return text.length - laenge;
      }
    }
    return text.length;
  }

  private gebeAus(text: string): string {
    if (!text) {
      return "";
    }
    if (this.inThink) {
      this.callbacks.onThinking(text);
      return "";
    }
    this.callbacks.onText(text);
    return text;
  }
}
