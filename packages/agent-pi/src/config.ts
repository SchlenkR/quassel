/**
 * Was ein Host am Pi-Backend einstellen kann. Alles ist optional - ohne Angaben laeuft
 * Pi mit seiner normalen Konfiguration (Settings, Modelle, Skills, Extensions, AGENTS.md
 * aus ~/.pi und dem Projekt), also genau so gut vorkonfiguriert wie die Pi-CLI selbst.
 */
export interface PiChatConfig {
  /** Ersetzt den Pi-Systemprompt komplett. */
  systemPrompt?: string;
  /** Haengt Anweisungen an den Standard-Systemprompt an (Pi-Tools bleiben erklaert). */
  appendSystemPrompt?: string;
  /** Konkretes Modell statt Pi-Default, z.B. { provider: "anthropic", id: "claude-..." }. */
  model?: { provider: string; id: string };
  /** Denk-Stufe des Modells ("off" | "minimal" | "low" | "medium" | "high"). */
  thinkingLevel?: string;
  /** Welche Tools aktiv sind (z.B. ["read", "grep"]); leeres Array = reiner Chat ohne Tools. */
  tools?: string[];
  /** Eigene Tools aus defineTool() von Pi. */
  customTools?: unknown[];
  /** Arbeitsverzeichnis des Agenten (Projekt-Skills, AGENTS.md, Tool-Pfade). */
  cwd?: string;
  /** Pi-Konfigurationsverzeichnis, Default ~/.pi/agent. */
  agentDir?: string;
  /** Eigenes Sitzungs-Verzeichnis fuer Persistenz; ohne Angabe bleiben Sessions im Speicher. */
  sessionDir?: string;
  /** Fluchtluke: wird zuletzt in die createAgentSession-Optionen gemerged. */
  createOptions?: Record<string, unknown>;
}
