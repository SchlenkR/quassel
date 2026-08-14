import { ChatEvent } from "@quassel/events";

/** Konfiguration gegen ein OpenAI-kompatibles Backend (OpenRouter, Ollama, vLLM, ...). */
export interface AgentConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
  systemPrompt?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  headers?: Record<string, string>;
  tools?: AgentTool[];
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: object;
  run: (args: unknown) => Promise<string> | string;
}

export interface OpenAiToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface OpenAiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
}

export interface SessionState {
  id: string;
  events: ChatEvent[];
  history: OpenAiMessage[];
  updatedAt: number;
}

export interface SessionInfo {
  id: string;
  title: string;
  updatedAt: number;
}

export interface SessionStore {
  load(id: string): Promise<SessionState | undefined>;
  save(state: SessionState): Promise<void>;
  list(): Promise<SessionInfo[]>;
  delete(id: string): Promise<void>;
}
