export interface ChatTexts {
  working: string;
  toolRunning: string;
  toolStillRunning: string;
  currentTool: string;
  thinkingChip: string;
  toolChip: string;
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
  steered: string;
  inputHint: string;
  detailModeTitle: string;
  detailModeOff: string;
  detailModeCurrent: string;
  detailModeIcons: string;
  detailModeChips: string;
  detailModeGrouped: string;
  detailModeCompact: string;
  detailModeFull: string;
  timestamps: string;
  showTimestamps: string;
  hideTimestamps: string;
  copyMessage: string;
  editMessage: string;
  retryMessage: string;
  copyCode: string;
  copied: string;
  pendingAction: string;
  dismissAction: string;
  actionDismissed: string;
  actionFailed: string;
  clipboardUnavailable: string;
  transcript: string;
  attachments: string;
  attachFiles: string;
  attachFilesHint: string;
  removeAttachment: string;
  attachmentPreparing: string;
  attachmentsPreparing: string;
  attachmentReadFailed: string;
  attachmentsWhileBusy: string;
  tooManyAttachments: string;
  attachmentsTooLarge: string;
  attachmentUnsupported: string;
  attachmentUnsupportedByModel: string;
  attachmentKindImage: string;
  attachmentKindVideo: string;
  attachmentKindPdf: string;
  notSent: string;
  notSentAttachments: string;
  insertUnsent: string;
}


export const fillText = (text: string, values: Record<string, string | number>): string =>
  text.replace(/\{(\w+)\}/g, (match, name: string) => name in values ? String(values[name]) : match);

export const defaultTexts: ChatTexts = {
  working: "Arbeitet ...",
  toolRunning: "läuft ...",
  toolStillRunning: "Werkzeug läuft ...",
  currentTool: "Werkzeug läuft",
  thinkingChip: "Denken",
  toolChip: "Werkzeug",
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
  sendIntoRun: "In den laufenden Turn einspeisen",
  stop: "Arbeit stoppen",
  placeholder: "Nachricht schreiben ...",
  steeringPlaceholder: "Dazwischenfunken ...",
  steered: "In den laufenden Turn eingespeist",
  inputHint: "Enter zum Senden - Shift + Enter für eine neue Zeile",
  detailModeTitle: "Detailgrad der Schritte",
  detailModeOff: "nur Antworten",
  detailModeCurrent: "aktuell",
  detailModeIcons: "Symbole",
  detailModeChips: "kompakt",
  detailModeGrouped: "gruppiert",
  detailModeCompact: "einzeilig",
  detailModeFull: "alles",
  timestamps: "Zeitstempel",
  showTimestamps: "Zeitstempel anzeigen",
  hideTimestamps: "Zeitstempel ausblenden",
  copyMessage: "Nachricht kopieren",
  editMessage: "Nachricht bearbeiten",
  retryMessage: "Antwort erneut anfordern",
  copyCode: "Code kopieren",
  copied: "Kopiert",
  pendingAction: "wartet auf Eingabe",
  dismissAction: "Verwerfen",
  actionDismissed: "verworfen",
  actionFailed: "Aktion fehlgeschlagen",
  clipboardUnavailable: "Die Zwischenablage ist nicht verfügbar",
  transcript: "Chatverlauf",
  attachments: "Anhänge",
  attachFiles: "Dateien anhängen",
  attachFilesHint: "Dateien anhängen (bis zu {count} Dateien, insgesamt {size})",
  removeAttachment: "{name} entfernen",
  attachmentPreparing: "Wird vorbereitet ...",
  attachmentsPreparing: "Anhänge werden vorbereitet ...",
  attachmentReadFailed: "Datei konnte nicht gelesen werden. Entferne sie und füge sie erneut hinzu.",
  attachmentsWhileBusy: "Warte, bis die Eingabe wieder bereit ist, und füge die Dateien dann erneut hinzu.",
  tooManyAttachments: "Höchstens {count} Anhänge pro Nachricht. Entferne zuerst einen Anhang.",
  attachmentsTooLarge: "Anhänge dürfen zusammen höchstens {size} groß sein. Wähle kleinere Dateien.",
  attachmentUnsupported: "Dieser Chat unterstützt {name} nicht als {kind}. Entferne den Anhang.",
  attachmentUnsupportedByModel: "Das Modell {model} unterstützt {name} nicht als {kind}. Wähle ein passendes Modell oder entferne den Anhang.",
  attachmentKindImage: "Bild",
  attachmentKindVideo: "Video",
  attachmentKindPdf: "PDF",
  notSent: "Nicht gesendet:",
  notSentAttachments: "({count} Anhänge)",
  insertUnsent: "Nicht gesendete Eingabe einfügen",
};
