export interface ChatTexts {
  working: string;
  toolRunning: string;
  toolStillRunning: string;
  thinkingChip: string;
  stepGroupOne: string;
  stepGroupMany: string;
  stepGroupCollapse: string;
  thinkingTitle: string;
  toolTitle: string;
  argumentsLabel: string;
  resultLabel: string;
  close: string;
  jumpToEnd: string;
  send: string;
  sendIntoRun: string;
  stop: string;
  placeholder: string;
  steeringPlaceholder: string;
  inputHint: string;
  timestamps: string;
  inputHintModEnter: string;
  messageActions: string;
  copyMessage: string;
  copyCode: string;
  copied: string;
  copyFailed: string;
  editMessage: string;
  retryMessage: string;
  detailModeTitle: string;
  detailModeOff: string;
  detailModeIcons: string;
  detailModeChips: string;
  detailModeGrouped: string;
  detailModeCompact: string;
  detailModeFull: string;
}

export const defaultTexts: ChatTexts = {
  working: "Arbeitet ...",
  toolRunning: "läuft ...",
  toolStillRunning: "Werkzeug läuft ...",
  thinkingChip: "Denken",
  stepGroupOne: "1 Schritt",
  stepGroupMany: "{count} Schritte",
  stepGroupCollapse: "Einklappen",
  thinkingTitle: "Thinking-Trace",
  toolTitle: "Tool-Call",
  argumentsLabel: "Argumente",
  resultLabel: "Ergebnis",
  close: "Schließen",
  jumpToEnd: "Zum Ende springen",
  send: "Senden",
  sendIntoRun: "In den laufenden Lauf schicken",
  stop: "Lauf abbrechen",
  placeholder: "Nachricht schreiben ...",
  steeringPlaceholder: "Dazwischenfunken ...",
  inputHint: "Enter zum Senden - Shift + Enter für eine neue Zeile",
  timestamps: "Zeitstempel",
  inputHintModEnter: "Strg/Cmd + Enter zum Senden - Enter für eine neue Zeile",
  messageActions: "Nachrichtenaktionen",
  copyMessage: "Nachricht kopieren",
  copyCode: "Code kopieren",
  copied: "Kopiert",
  copyFailed: "Kopieren ist nicht verfügbar.",
  editMessage: "Nachricht bearbeiten",
  retryMessage: "Erneut senden",
  detailModeTitle: "Detailgrad der Schritte",
  detailModeOff: "nur Antworten",
  detailModeIcons: "Symbole",
  detailModeChips: "kompakt",
  detailModeGrouped: "gruppiert",
  detailModeCompact: "einzeilig",
  detailModeFull: "alles",
};
