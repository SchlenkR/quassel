import type { Message } from "./events";

export type { Role, ToolInfo, PendingAction, Message, ChatEvent, ChatTextCursor, ChatJournalCursor, ChatAttachment, ChatAttachmentInput, ChatAttachmentCapabilities, ChatStartupStatus } from "./events";
export { applyEvent, prettyJson, compactToolLine } from "./events";

/**
 * current = nur der laufende Schritt, off = nur Antworten, icons = Schritte als reine Symbole nebeneinander,
 * chips = Schritte als Symbol + Kurztext nebeneinander (mit Umbruch),
 * grouped = aufeinanderfolgende Schritte als eine aufklappbare Zeile, dahinter einzeilig,
 * compact = Denken und Werkzeuge einzeilig, full = alles ausgeklappt.
 */
export type DetailMode = "off" | "current" | "icons" | "chips" | "grouped" | "compact" | "full";

/** running = call still open, thinking = thought block still open, done = finished, error = failed. */
export type StepState = "running" | "thinking" | "done" | "error";

/** The single derivation of a step state, so chips, hosts and tests read the same signal. */
export function stepState(message: Message): StepState {
  if (message.tool?.isError) {
    return "error";
  }
  if (message.role === "thinking") {
    return message.closed ? "done" : "thinking";
  }
  return message.tool !== undefined && message.tool.result === undefined ? "running" : "done";
}

/** A moment worth one screen reader announcement: a finished reply or a new pending action. */
export type ChatAnnouncement =
  | { kind: "reply"; message: Message }
  | { kind: "action"; message: Message };
