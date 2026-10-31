import type { ChatAuthor, ChatMention, ChatThread, Message } from "./events";

export const mentionHrefPrefix = "#qsl-mention:";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const escapeLabel = (value: string) => value.replace(/[[\]\\]/g, "\\$&");

/** The replies of one thread as a summary: count, distinct participants in order of appearance, time of the last reply. */
export function summarizeThread(replies: readonly Message[]): ChatThread {
  const participants = replies
    .map((reply) => reply.author)
    .filter((author): author is ChatAuthor => author !== undefined)
    .filter((author, index, all) => all.findIndex((other) => other.id === author.id) === index);
  return { count: replies.length, participants, lastReplyAt: replies.at(-1)?.at };
}

/** The channel view: top-level messages only; parents without thread data get one computed from their replies. */
export function channelMessages(messages: readonly Message[]): Message[] {
  const repliesOf = (key: string) => messages.filter((message) => message.parentId === key);
  return messages
    .filter((message) => message.parentId === undefined)
    .map((message) => message.thread === undefined && repliesOf(message.key).length > 0
      ? { ...message, thread: summarizeThread(repliesOf(message.key)) }
      : message);
}

/** The thread view: the parent first, then its replies in their order. */
export function threadMessages(messages: readonly Message[], parentKey: string): Message[] {
  const parent = messages.find((message) => message.key === parentKey);
  return parent ? [parent, ...messages.filter((message) => message.parentId === parentKey)] : [];
}

/** Turns "@name" into a mention link that quassel renders highlighted; code stays untouched. */
export function mentionMarkdown(text: string, mentions: readonly ChatMention[] | undefined): string {
  const named = (mentions ?? []).filter((mention) => mention.name.trim() !== "");
  if (named.length === 0) return text;
  const byName = new Map(named.map((mention) => [mention.name.toLocaleLowerCase(), mention]));
  const names = [...byName.keys()].sort((left, right) => right.length - left.length).map(escapeRegExp);
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_@\\[])@(${names.join("|")})(?![\\p{L}\\p{N}_])`, "giu");
  return text
    .split(/(```[\s\S]*?```|`[^`\n]*`)/)
    .map((part, index) => index % 2 === 1 ? part : part.replace(pattern, (match, name: string) => {
      const mention = byName.get(name.toLocaleLowerCase());
      return mention ? `[${escapeLabel(match)}](${mentionHrefPrefix}${encodeURIComponent(mention.id)})` : match;
    }))
    .join("");
}
