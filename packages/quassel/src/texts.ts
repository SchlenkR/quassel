export interface ChatTexts {
  working: string;
  toolRunning: string;
  toolStillRunning: string;
  toolElapsedSeconds: string;
  currentTool: string;
  thinkingChip: string;
  toolChip: string;
  stepGroupOne: string;
  stepGroupMany: string;
  stepGroupErrorOne?: string;
  stepGroupErrorMany?: string;
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
  detailModeTitle: string;
  detailModeOff: string;
  detailModeCurrent: string;
  detailModeIcons: string;
  detailModeChips: string;
  detailModeGrouped: string;
  detailModeCompact: string;
  detailModeFull: string;
  showAllMessages?: string;
  showLatestExchange?: string;
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

export const englishTexts: Required<ChatTexts> = {
  working: "Working ...",
  toolRunning: "running ...",
  toolStillRunning: "Tool running ...",
  toolElapsedSeconds: "{seconds} s",
  currentTool: "Tool running",
  thinkingChip: "Thinking",
  toolChip: "Tool",
  stepGroupOne: "1 step",
  stepGroupMany: "{count} steps",
  stepGroupErrorOne: "1 error",
  stepGroupErrorMany: "{count} errors",
  stepGroupCollapse: "Collapse",
  thinkingTitle: "Thinking trace",
  toolTitle: "Tool call",
  argumentsLabel: "Arguments",
  resultLabel: "Result",
  close: "Close",
  jumpToEnd: "Jump to end",
  send: "Send",
  sendIntoRun: "Feed into the running turn",
  stop: "Stop work",
  placeholder: "Write a message ...",
  steeringPlaceholder: "Interject ...",
  steered: "Fed into the running turn",
  detailModeTitle: "Step detail level",
  detailModeOff: "answers only",
  detailModeCurrent: "current",
  detailModeIcons: "icons",
  detailModeChips: "compact",
  detailModeGrouped: "grouped",
  detailModeCompact: "single line",
  detailModeFull: "everything",
  showAllMessages: "Show intermediate replies",
  showLatestExchange: "Show latest reply between inputs",
  showTimestamps: "Show timestamps",
  hideTimestamps: "Hide timestamps",
  copyMessage: "Copy message",
  editMessage: "Edit message",
  retryMessage: "Request answer again",
  copyCode: "Copy code",
  copied: "Copied",
  pendingAction: "waiting for input",
  dismissAction: "Dismiss",
  actionDismissed: "dismissed",
  actionFailed: "Action failed",
  clipboardUnavailable: "The clipboard is not available",
  transcript: "Chat history",
  attachments: "Attachments",
  attachFiles: "Attach files",
  attachFilesHint: "Attach files (up to {count} files, {size} in total)",
  removeAttachment: "Remove {name}",
  attachmentPreparing: "Preparing ...",
  attachmentsPreparing: "Preparing attachments ...",
  attachmentReadFailed: "The file could not be read. Remove it and add it again.",
  attachmentsWhileBusy: "Wait until the input is ready again, then add the files again.",
  tooManyAttachments: "At most {count} attachments per message. Remove an attachment first.",
  attachmentsTooLarge: "Attachments may be at most {size} in total. Choose smaller files.",
  attachmentUnsupported: "This chat does not support {name} as {kind}. Remove the attachment.",
  attachmentUnsupportedByModel: "The model {model} does not support {name} as {kind}. Choose a suitable model or remove the attachment.",
  attachmentKindImage: "image",
  attachmentKindVideo: "video",
  attachmentKindPdf: "PDF",
  notSent: "Not sent:",
  notSentAttachments: "({count} attachments)",
  insertUnsent: "Insert unsent input",
};

export const germanTexts: Required<ChatTexts> = {
  working: "Arbeitet ...",
  toolRunning: "läuft ...",
  toolStillRunning: "Werkzeug läuft ...",
  toolElapsedSeconds: "{seconds} s",
  currentTool: "Werkzeug läuft",
  thinkingChip: "Denken",
  toolChip: "Werkzeug",
  stepGroupOne: "1 Schritt",
  stepGroupMany: "{count} Schritte",
  stepGroupErrorOne: "1 Fehler",
  stepGroupErrorMany: "{count} Fehler",
  stepGroupCollapse: "Einklappen",
  thinkingTitle: "Gedankengang",
  toolTitle: "Werkzeugaufruf",
  argumentsLabel: "Argumente",
  resultLabel: "Ergebnis",
  close: "Schließen",
  jumpToEnd: "Zum Ende springen",
  send: "Senden",
  sendIntoRun: "In die laufende Antwort einreihen",
  stop: "Bearbeitung stoppen",
  placeholder: "Nachricht schreiben ...",
  steeringPlaceholder: "Nachsteuern ...",
  steered: "In die laufende Antwort eingereiht",
  detailModeTitle: "Detailgrad der Schritte",
  detailModeOff: "nur Antworten",
  detailModeCurrent: "aktueller Schritt",
  detailModeIcons: "Symbole",
  detailModeChips: "kompakt",
  detailModeGrouped: "gruppiert",
  detailModeCompact: "einzeilig",
  detailModeFull: "alles",
  showAllMessages: "Zwischenantworten anzeigen",
  showLatestExchange: "Letzte Antwort zwischen den Eingaben anzeigen",
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
  attachmentReadFailed: "Die Datei konnte nicht gelesen werden. Den Anhang entfernen und erneut hinzufügen.",
  attachmentsWhileBusy: "Warten, bis die Eingabe wieder bereit ist, dann die Dateien erneut hinzufügen.",
  tooManyAttachments: "Höchstens {count} Anhänge pro Nachricht. Zuerst einen Anhang entfernen.",
  attachmentsTooLarge: "Anhänge dürfen zusammen höchstens {size} groß sein. Kleinere Dateien auswählen.",
  attachmentUnsupported: "Dieser Chat unterstützt {name} nicht als {kind}. Den Anhang entfernen.",
  attachmentUnsupportedByModel: "Das Modell {model} unterstützt {name} nicht als {kind}. Ein passendes Modell auswählen oder den Anhang entfernen.",
  attachmentKindImage: "Bild",
  attachmentKindVideo: "Video",
  attachmentKindPdf: "PDF",
  notSent: "Nicht gesendet:",
  notSentAttachments: "({count} Anhänge)",
  insertUnsent: "Nicht gesendete Eingabe einfügen",
};

export const defaultTexts = englishTexts;
