export type { Role, ToolInfo, Question, Message, ChatEvent } from "@quassel/events";
export { applyEvent, prettyJson, compactToolLine } from "@quassel/events";

/**
 * off = nur Antworten, icons = Schritte als reine Symbole nebeneinander,
 * chips = Schritte als Symbol + Kurztext nebeneinander (mit Umbruch),
 * compact = Denken und Werkzeuge einzeilig, full = alles ausgeklappt.
 */
export type DetailMode = "off" | "icons" | "chips" | "compact" | "full";
