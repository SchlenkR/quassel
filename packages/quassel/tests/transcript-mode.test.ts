import { window } from "./dom";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { defaultTexts, type ChatTexts, applyEvent, ChatMessages, ChatPanel, TranscriptModeSwitch, type ChatAnnouncement, type DetailMode, type Message, type TranscriptMode } from "../src/index";

const oldQuestion: Message = { key: "u1", role: "user", text: "Old question" };
const oldAnswer: Message = { key: "a1", role: "assistant", text: "Old answer", closed: true };
const question: Message = { key: "u2", role: "user", text: "Current question" };
const progress: Message = { key: "a2", role: "assistant", text: "Checking the sources", closed: true };
const tool: Message = { key: "t", role: "tool", text: "search", tool: { id: "t", name: "search", arguments: "{}" } };
const answer: Message = { key: "a3", role: "assistant", text: "Final answer", closed: true };
const history = [oldQuestion, oldAnswer, question, progress, tool, answer];

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

type Options = Omit<Parameters<typeof ChatMessages>[0], "messages">;
const render = (messages: Message[], options: Options = {}) =>
  act(() => root.render(createElement(ChatMessages, { messages, transcriptMode: "latest", detailMode: "off", announce: false, ...options })));
const text = () => container.querySelector("[data-quassel-transcript]")?.textContent ?? "";

test("latest preserves question-answer pairs, all restores intermediate replies and is the default", () => {
  const snapshot = structuredClone(history);
  render(history);
  assert.match(text(), /Current question.*Final answer/);
  assert.match(text(), /Old question.*Old answer.*Current question.*Final answer/);
  assert.doesNotMatch(text(), /Checking the sources/);
  render(history, { transcriptMode: "all" });
  assert.match(text(), /Old question.*Old answer.*Current question.*Checking the sources.*Final answer/);
  render(history, { transcriptMode: undefined });
  assert.match(text(), /Old question.*Old answer/);
  assert.deepEqual(history, snapshot);
});

test("progress stays during tool calls and empty deltas, then a streaming answer replaces it", () => {
  const messages = [oldQuestion, oldAnswer, question, progress, tool];
  const options = { running: true, detailMode: "current" as const, working: createElement("span") };
  render(messages, options);
  assert.match(text(), /Checking the sources/);
  assert.ok(container.querySelector("[data-kind=tool]"));
  render([...messages, { ...answer, text: " \n", closed: false }], options);
  assert.match(text(), /Checking the sources/);
  render([...messages, { ...answer, text: "Final", closed: false }], options);
  assert.match(text(), /Final/);
  assert.doesNotMatch(text(), /Checking the sources/);
  render([...messages, answer], { running: false });
  assert.match(text(), /Final answer/);
});

test("a new question preserves previous question-answer pairs", () => {
  render([...history, { key: "u3", role: "user", text: "New question" }]);
  assert.match(text(), /Old question.*Old answer.*Current question.*Final answer.*New question/);
  assert.doesNotMatch(text(), /Checking the sources/);
  render([]);
  assert.equal(text(), "");
});

test("steering preserves the reply before it even when another reply starts after it", () => {
  const cursor = { conversationId: "demo", sequence: 2, offset: 8 };
  let messages = applyEvent([oldQuestion, oldAnswer, question], { kind: "text", delta: "Checking", cursor });
  messages = applyEvent(messages, { kind: "user", text: "Include totals", inputId: "s1" });
  messages = applyEvent(messages, { kind: "steered", inputId: "s1" });
  messages = applyEvent(messages, { kind: "text", delta: " the sources", cursor: { ...cursor, offset: 18 } });
  messages = applyEvent(messages, { kind: "user", text: "And the notes", inputId: "s2" });
  messages = applyEvent(messages, { kind: "steered", inputId: "s2" });
  render(messages, { running: true });
  assert.match(text(), /Old question.*Old answer.*Current question.*Checking the sources.*Include totals.*And the notes/);
  messages = applyEvent(messages, { kind: "tool", id: "check", name: "check", arguments: "{}" });
  render(messages, { running: true, detailMode: "current" });
  assert.match(text(), /Checking the sources/);
  assert.ok(container.querySelector("[data-kind=tool]"));
  messages = applyEvent(messages, { kind: "tool-result", id: "check", result: "ok" });
  messages = applyEvent(messages, { kind: "thinking", delta: "Compare the totals" });
  render(messages, { running: true, detailMode: "current" });
  assert.match(text(), /Checking the sources/);
  assert.ok(container.querySelector("[data-kind=thinking]"));
  messages = applyEvent(messages, { kind: "text", delta: "Final answer", cursor: { ...cursor, offset: 29 } });
  render(messages, { running: true });
  assert.match(text(), /Old question.*Old answer.*Current question.*Checking the sources.*Include totals.*And the notes.*Final answer/);
  assert.equal(container.querySelectorAll("[data-message=answer]").length, 3);
  render(messages, { transcriptMode: "all" });
  assert.match(text(), /Checking the sources/);
});

test("each user input bounds one reply and removed replies let tool and thinking groups merge", () => {
  const completed = (key: string): Message => ({ ...tool, key, tool: { id: key, name: key, arguments: "{}", result: "ok" } });
  const thinking: Message = { key: "think", role: "thinking", text: "Compare sources", closed: true };
  const steering: Message = { key: "steer", role: "user", text: "Include totals", steered: true };
  const last: Message = { ...answer, key: "last", text: "Totals checked" };
  const messages = [question, completed("read"), progress, thinking, completed("compare"), answer,
    steering, completed("sum"), { ...progress, key: "p2" }, completed("verify"), last];
  render(messages, { detailMode: "grouped" });
  assert.deepEqual([...container.querySelectorAll("[data-message]")].map((element) => element.getAttribute("data-message")),
    ["user", "answer", "user", "answer"]);
  assert.match(text(), /Current question.*Final answer.*Include totals.*Totals checked/);
  assert.doesNotMatch(text(), /Checking the sources/);
  assert.deepEqual([...container.querySelectorAll("[data-step=group] > button")].map((element) => element.textContent),
    ["3 steps", "2 steps"]);
  act(() => container.querySelectorAll<HTMLButtonElement>("[data-step=group] > button").forEach((button) => button.click()));
  assert.equal(container.querySelectorAll("[data-kind=tool]").length, 4);
  assert.equal(container.querySelectorAll("[data-kind=thinking]").length, 1);
  render(messages.map((message) => message === steering ? { ...message, steered: false } : message), { detailMode: "off" });
  assert.match(text(), /Current question.*Final answer.*Include totals.*Totals checked/);
  render(messages, { transcriptMode: "all", detailMode: "off" });
  assert.equal(container.querySelectorAll("[data-message=answer]").length, 4);
});

test("without a user message only the latest answer is shown, including attachments without text", () => {
  render([progress, answer]);
  assert.equal(text(), "Final answer");
  render([question, progress, { ...answer, text: "", attachments: [{ name: "report.pdf", mediaType: "application/pdf", size: 12, url: "/report.pdf" }] }]);
  assert.match(text(), /report.pdf/);
  assert.doesNotMatch(text(), /Checking the sources/);
});

test("step detail remains independent and can show steps from earlier turns", () => {
  const modes: DetailMode[] = ["off", "current", "icons", "chips", "grouped", "compact", "full"];
  const messages = [oldQuestion, { ...tool, key: "old-tool", text: "old_search", tool: { id: "old", name: "old_search", arguments: "{}", result: "ok" } }, oldAnswer, question, progress, tool];
  for (const detailMode of modes) {
    render(messages, { detailMode, running: true, working: createElement("span") });
    assert.match(text(), /Current question.*Checking the sources/);
    assert.match(text(), /Old question.*Old answer/);
    if (detailMode === "full" || detailMode === "compact" || detailMode === "chips") assert.match(text(), /old_search/);
    if (detailMode === "current" || detailMode === "off") assert.doesNotMatch(text(), /old_search/);
    assert.equal(container.querySelector("[data-step]") !== null, detailMode !== "off", detailMode);
  }
  render(messages, { detailMode: "current", running: false });
  assert.equal(container.querySelector("[data-step]"), null);
});

test("pending actions survive a new question, inline and docked; current system messages remain visible", () => {
  const pending: Message = { key: "p", role: "action", text: "Choose a source", action: { actionId: "p", owner: null, payload: {} } };
  const messages = [oldQuestion, pending, oldAnswer, question, { key: "s", role: "system" as const, text: "Request failed" }];
  render(messages);
  assert.match(text(), /Choose a source/);
  assert.match(text(), /Request failed/);
  act(() => root.render(createElement(ChatPanel, {
    composer: createElement("textarea"),
    children: createElement(ChatMessages, { messages, transcriptMode: "latest", announce: false }),
  })));
  assert.match(container.querySelector("[data-chat=actions]")?.textContent ?? "", /Choose a source/);
  assert.doesNotMatch(text(), /Choose a source/);
  assert.match(text(), /Old question.*Old answer/);
  render(messages.map((message) => message === pending ? { ...pending, action: { ...pending.action!, status: "dismissed" } } : message));
  assert.match(text(), /Choose a source/);
});

test("hidden answers are not announced or reannounced when switching to all", () => {
  const announced: ChatAnnouncement[] = [];
  const announce = (announcement: ChatAnnouncement) => { announced.push(announcement); return undefined; };
  render([question], { announce });
  render([question, progress, answer], { announce });
  assert.deepEqual(announced.map(({ message }) => message.key), [answer.key]);
  render([question, progress, answer], { announce, transcriptMode: "all" });
  assert.deepEqual(announced.map(({ message }) => message.key), [answer.key]);
});

test("the optional switch requests changes in both directions and supports custom labels", () => {
  const changed: TranscriptMode[] = [];
  const onChange = (mode: TranscriptMode) => changed.push(mode);
  act(() => root.render(createElement(TranscriptModeSwitch, { mode: "all", onChange, texts: { showLatestExchange: "Focus" } })));
  const button = container.querySelector("button");
  assert.equal(button?.getAttribute("aria-label"), "Focus");
  assert.equal(button?.getAttribute("aria-pressed"), "false");
  act(() => button?.click());
  assert.deepEqual(changed, ["latest"]);
  act(() => root.render(createElement(TranscriptModeSwitch, { mode: "latest", onChange })));
  assert.equal(container.querySelector("button")?.getAttribute("aria-pressed"), "true");
  act(() => container.querySelector("button")?.click());
  assert.deepEqual(changed, ["latest", "all"]);
});

test("existing complete translations remain valid without the new switch labels", () => {
  const { showAllMessages, showLatestExchange, stepGroupErrorOne, stepGroupErrorMany, ...existingTexts } = defaultTexts;
  const texts: ChatTexts = existingTexts;
  render(history, { transcriptMode: undefined, texts });
  assert.match(text(), /Old question.*Old answer.*Current question.*Checking the sources.*Final answer/);
  act(() => root.render(createElement(TranscriptModeSwitch, { mode: "all", onChange: () => undefined, texts })));
  assert.equal(container.querySelector("button")?.getAttribute("aria-label"), showLatestExchange);
  act(() => root.render(createElement(TranscriptModeSwitch, { mode: "latest", onChange: () => undefined, texts })));
  assert.equal(container.querySelector("button")?.getAttribute("aria-label"), showAllMessages);
});
