import type { ChatAttachmentInput } from "./events";

import { chatAttachmentMediaType, MAX_CHAT_ATTACHMENTS, MAX_CHAT_ATTACHMENT_BYTES } from "./chat-attachments";
import { defaultTexts, fillText, type ChatTexts } from "./texts";

export { MAX_CHAT_ATTACHMENTS, MAX_CHAT_ATTACHMENT_BYTES };

export const maxAttachmentSizeLabel = `${MAX_CHAT_ATTACHMENT_BYTES / (1024 * 1024)} MiB`;

export function attachmentMediaType(file: { name: string; type: string }): string {
  return chatAttachmentMediaType(file.name, file.type);
}

export function attachmentCapabilityError(
  files: readonly { name: string; mediaType: string }[],
  capabilities: { input: readonly string[]; model: string },
  texts: ChatTexts = defaultTexts,
): string | undefined {
  for (const file of files) {
    const required = file.mediaType.startsWith("image/") ? "image"
      : file.mediaType.startsWith("video/") ? "video" : file.mediaType === "application/pdf" ? "file" : undefined;
    if (required && !capabilities.input.includes(required)) {
      const kind = required === "image" ? texts.attachmentKindImage : required === "video" ? texts.attachmentKindVideo : texts.attachmentKindPdf;
      if (!capabilities.model) return fillText(texts.attachmentUnsupported, { name: file.name, kind });
      return fillText(texts.attachmentUnsupportedByModel, { model: capabilities.model, name: file.name, kind });
    }
  }
}

export function validateAttachmentSelection(existing: readonly { size: number }[], incoming: readonly { size: number }[], texts: ChatTexts = defaultTexts): void {
  if (existing.length + incoming.length > MAX_CHAT_ATTACHMENTS) {
    throw new Error(fillText(texts.tooManyAttachments, { count: MAX_CHAT_ATTACHMENTS }));
  }
  if ([...existing, ...incoming].reduce((total, file) => total + file.size, 0) > MAX_CHAT_ATTACHMENT_BYTES) {
    throw new Error(fillText(texts.attachmentsTooLarge, { size: maxAttachmentSizeLabel }));
  }
}

export async function encodeAttachment(file: File): Promise<ChatAttachmentInput> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
  }
  return { name: file.name, mediaType: attachmentMediaType(file), data: btoa(chunks.join("")) };
}

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function attachmentDownloadUrl(url: string): string {
  if (/^(data|blob):/i.test(url)) return url;
  const [resource, fragment] = url.split(/#(.*)/s);
  return `${resource}${resource.includes("?") ? "&" : "?"}download=1${fragment === undefined ? "" : `#${fragment}`}`;
}
