import { window } from "./dom";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { channelMessages, ChatMessages, germanTexts, mentionMarkdown, summarizeThread, threadMessages, type ChatAuthor, type Message } from "../src/index";

let root: Root;
let container: HTMLElement;
beforeEach(() => {
  container = window.document.createElement("div") as unknown as HTMLElement;
  window.document.body.appendChild(container as never);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const ana: ChatAuthor = { id: "ana", name: "Ana Lopez" };
const ben: ChatAuthor = { id: "ben", name: "Ben Ito", initials: "BI" };
const cleo: ChatAuthor = { id: "cleo", name: "Cleo Park", avatarUrl: "data:image/png;base64,AA==" };
const at = (minute: number) => `2026-03-02T09:${String(minute).padStart(2, "0")}:00.000Z`;
const post = (key: string, author: ChatAuthor, minute: number, text: string, extra: Partial<Message> = {}): Message =>
  ({ key, role: author.id === "ana" ? "user" : "assistant", text, closed: true, at: at(minute), author, ...extra });

const conversation: Message[] = [
  post("m1", ana, 0, "The supplier confirmed Friday."),
  post("m2", ana, 2, "I will update the plan."),
  post("m3", ben, 5, "@Ana Lopez can you check the invoice?", { mentions: [{ id: "ana", name: "Ana Lopez" }] }),
  post("r1", cleo, 6, "Looks fine to me.", { parentId: "m3" }),
  post("r2", ana, 7, "Checked, it is paid.", { parentId: "m3" }),
];

type Options = Omit<Parameters<typeof ChatMessages>[0], "messages">;
const render = (messages: Message[], options: Options = {}) =>
  act(() => root.render(createElement(ChatMessages, { messages, layout: "multi-party", announce: false, timestampOptions: { timeZone: "UTC" }, ...options })));
const rows = () => [...container.querySelectorAll<HTMLElement>('[data-message="party"]')];

test("the helpers split channel and thread views and summarize replies", () => {
  const channel = channelMessages(conversation);
  assert.deepEqual(channel.map((message) => message.key), ["m1", "m2", "m3"]);
  assert.deepEqual(channel[2].thread, { count: 2, participants: [cleo, ana], lastReplyAt: at(7) });
  assert.deepEqual(threadMessages(conversation, "m3").map((message) => message.key), ["m3", "r1", "r2"]);
  assert.deepEqual(threadMessages(conversation, "missing"), []);
  assert.equal(summarizeThread([]).count, 0);
});

test("mentions become highlight links, longest name first, never inside code", () => {
  const mentions = [{ id: "a", name: "Ana" }, { id: "al", name: "Ana Lopez" }];
  assert.equal(mentionMarkdown("Hi @ana lopez and @Ana!", mentions), "Hi [@ana lopez](#qsl-mention:al) and [@Ana](#qsl-mention:a)!");
  assert.equal(mentionMarkdown("mail me@Ana or `@Ana`", mentions), "mail me@Ana or `@Ana`");
  assert.equal(mentionMarkdown("@Anabel", mentions), "@Anabel");
  assert.equal(mentionMarkdown("@Ana", undefined), "@Ana");
});

test("rows show avatar, name and time; consecutive messages of one author share one header", () => {
  render(channelMessages(conversation));
  const [first, second, third] = rows();
  assert.equal(first.querySelector('[data-chat="author"]')?.textContent, "Ana Lopez");
  assert.equal(first.querySelector("time")?.textContent, "09:00");
  assert.equal(first.querySelector('[data-chat="avatar"]')?.textContent, "AL");
  assert.equal(second.dataset.grouped, "true");
  assert.equal(second.querySelector('[data-chat="message-header"]'), null);
  assert.equal(third.querySelector('[data-chat="avatar"]')?.textContent, "BI");
  render(channelMessages(conversation), { groupWithin: false });
  assert.equal(rows()[1].dataset.grouped, undefined);
});

test("messages addressed to the reader are highlighted and their mention is marked as own", () => {
  render(channelMessages(conversation), { currentUserId: "ana" });
  const [, , asked] = rows();
  assert.equal(asked.dataset.highlighted, "true");
  const mention = asked.querySelector<HTMLElement>('[data-chat="mention"]')!;
  assert.equal(mention.textContent, "@Ana Lopez");
  assert.equal(mention.dataset.self, "true");
  assert.equal(rows()[0].dataset.highlighted, undefined);
  render(channelMessages(conversation), { currentUserId: "ana", isHighlighted: (message) => message.key === "m1" });
  assert.equal(rows()[0].dataset.highlighted, "true");
  assert.equal(rows()[2].dataset.highlighted, undefined);
});

test("the reply summary shows count and participants and opens the thread", () => {
  const opened: string[] = [];
  render(channelMessages(conversation), { onOpenThread: (message) => opened.push(message.key), activeThreadKey: "m3",
    renderMessageDecorations: (message, place) => place === "thread" ? createElement("span", { "data-test": "state" }, "pending") : null });
  const summary = container.querySelector<HTMLButtonElement>('[data-chat="thread-summary"]')!;
  assert.match(summary.textContent ?? "", /2 replies/);
  assert.match(summary.textContent ?? "", /pending/);
  assert.match(summary.textContent ?? "", /last 09:07/);
  assert.equal(summary.querySelectorAll('[data-chat="avatar"]').length, 2);
  assert.equal(summary.getAttribute("aria-pressed"), "true");
  act(() => summary.click());
  assert.deepEqual(opened, ["m3"]);
});

test("the thread view renders parent, reply divider and replies with the same list", () => {
  render(threadMessages(channelMessages(conversation).concat(conversation.filter((message) => message.parentId)), "m3"), { threadParentKey: "m3", texts: germanTexts });
  assert.deepEqual(rows().map((row) => row.dataset.messageKey), ["m3", "r1", "r2"]);
  assert.equal(container.querySelector('[data-chat="thread-divider"]')?.textContent, "2 Antworten");
  assert.equal(container.querySelector('[data-chat="thread-summary"]'), null);
});

test("reactions toggle through the host and offer the remaining choices", () => {
  const toggled: string[] = [];
  const messages = [post("m1", ben, 0, "Done", { reactions: [{ key: "+1", count: 2, userIds: ["ana", "cleo"] }, { key: "heart", count: 1 }] })];
  render(messages, { currentUserId: "ana", onToggleReaction: (message, key) => toggled.push(`${message.key}:${key}`), reactionChoices: ["+1", "heart", "eyes"],
    renderReaction: (key) => key === "heart" ? createElement("i", null, "H") : undefined });
  const chips = [...container.querySelectorAll<HTMLButtonElement>('[data-chat="reaction"]')];
  assert.deepEqual(chips.map((chip) => chip.textContent), ["+12", "H1"]);
  assert.equal(chips[0].getAttribute("aria-pressed"), "true");
  assert.equal(chips[1].getAttribute("aria-pressed"), "false");
  act(() => chips[1].click());
  act(() => container.querySelector<HTMLButtonElement>('[data-chat="add-reaction"]')!.click());
  const choices = [...container.querySelectorAll<HTMLButtonElement>('[data-chat="reaction-choice"]')];
  assert.deepEqual(choices.map((choice) => choice.textContent), ["eyes"]);
  act(() => choices[0].click());
  assert.deepEqual(toggled, ["m1:heart", "m1:eyes"]);
  render(messages, { currentUserId: "ana" });
  assert.equal(container.querySelector('[data-chat="reaction"]')?.tagName, "SPAN");
  assert.equal(container.querySelector('[data-chat="add-reaction"]'), null);
});

test("host hooks render cards, attachments, avatars and header decorations", () => {
  const messages = [post("m1", cleo, 0, "See the draft", {
    cards: [{ kind: "invoice", key: "i1", data: { total: 12 } }, { kind: "unknown" }],
    attachments: [{ name: "plan.pdf", mediaType: "application/pdf", size: 10, url: "/plan.pdf" }],
    badges: [{ label: "Guest", tone: "accent" }],
    edited: true,
  })];
  render(messages, {
    renderCard: (card) => card.kind === "invoice" ? createElement("b", { "data-test": "card" }, `Total ${(card.data as { total: number }).total}`) : undefined,
    renderAttachment: (attachment) => createElement("u", null, attachment.name),
    renderAvatar: (author) => createElement("span", { "data-test": "avatar" }, author.id),
    renderMessageDecorations: (_message, place) => place === "header" ? "waiting" : null,
  });
  assert.equal(container.querySelector('[data-test="card"]')?.textContent, "Total 12");
  assert.equal(container.querySelectorAll('[data-card-kind]').length, 1);
  assert.equal(container.querySelector('[data-chat="attachment-custom"]')?.textContent, "plan.pdf");
  assert.equal(container.querySelector('[data-test="avatar"]')?.textContent, "cleo");
  const header = container.querySelector('[data-chat="message-header"]')!;
  assert.match(header.textContent ?? "", /edited/);
  assert.match(header.textContent ?? "", /Guest/);
  assert.match(header.textContent ?? "", /waiting/);
  assert.equal(header.querySelector('[data-chat="badge"]')?.getAttribute("data-tone"), "accent");
});

test("unread and day dividers sit before their message and a leading slot stays above", () => {
  const messages = [post("m1", ana, 0, "Earlier"), post("m2", ben, 1, "Later", { at: "2026-03-03T08:00:00.000Z" })];
  render(messages, { unreadFromKey: "m2", texts: germanTexts, before: createElement("button", { "data-test": "older" }, "older"),
    timestampOptions: { timeZone: "UTC", showDaySeparators: true, locale: "en-GB" } });
  const order = [...container.querySelectorAll('[data-test="older"], [data-chat="day-separator"], [data-chat="unread-divider"], [data-message="party"]')]
    .map((element) => element.getAttribute("data-chat") ?? element.getAttribute("data-message") ?? element.getAttribute("data-test"));
  assert.deepEqual(order, ["older", "day-separator", "party", "day-separator", "unread-divider", "party"]);
  assert.equal(container.querySelector('[data-chat="unread-divider"]')?.textContent, "Neu");
  assert.equal(container.querySelector('[data-chat="unread-divider"]')?.getAttribute("role"), "separator");
  render(messages, { timestampOptions: { timeZone: "UTC", showDaySeparators: true, dayLabel: (date) => `Day ${date.getUTCDate()}` } });
  assert.deepEqual([...container.querySelectorAll('[data-chat="day-separator"]')].map((element) => element.textContent), ["Day 2", "Day 3"]);
});

test("the assistant layout stays unchanged by default", () => {
  act(() => root.render(createElement(ChatMessages, { messages: channelMessages(conversation), announce: false })));
  assert.equal(rows().length, 0);
  assert.ok(container.querySelector('[data-message="user"]'));
});
