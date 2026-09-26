import type { Message } from "@quassel/events";

export type { Role, ToolInfo, Question, Message, ChatEvent } from "@quassel/events";
export { applyEvent, prettyJson, compactToolLine } from "@quassel/events";

/**
 * off = nur Antworten, icons = Schritte als reine Symbole nebeneinander,
 * chips = Schritte als Symbol + Kurztext nebeneinander (mit Umbruch),
 * grouped = aufeinanderfolgende Schritte hinter einer aufklappbaren Kopfzeile, darin einzeilig,
 * compact = Denken und Werkzeuge einzeilig, full = alles ausgeklappt.
 */
export type DetailMode = "off" | "icons" | "chips" | "grouped" | "compact" | "full";

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
