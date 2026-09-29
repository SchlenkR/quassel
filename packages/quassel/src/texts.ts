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
  working: "Working ...",
  toolRunning: "running ...",
  toolStillRunning: "Tool running ...",
  toolElapsedSeconds: "{seconds} s",
  currentTool: "Tool running",
  thinkingChip: "Thinking",
  toolChip: "Tool",
  stepGroupOne: "1 step",
  stepGroupMany: "{count} steps",
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
