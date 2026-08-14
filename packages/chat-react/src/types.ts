export type { Role, ToolInfo, Question, Message, ChatEvent } from "@quassel/events";
export { applyEvent, prettyJson, compactToolLine } from "@quassel/events";

/** off = nur Antworten, compact = Denken und Werkzeuge einzeilig, full = alles ausgeklappt. */
export type DetailMode = "off" | "compact" | "full";
