import { window } from "./dom";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ChatMessages, ChatPanel, type ChatAnnouncement, type Message, type PendingAction } from "../src/index";

const question = (key: string, text: string, action: Partial<PendingAction> = {}): Message =>
  ({ key, role: "action", text, closed: true, action: { actionId: key, owner: null, payload: {}, ...action } });
const user: Message = { key: "u", role: "user", text: "Prepare the release notes.", closed: true };
const answered = question("a1", "Which audience?", { status: "approved", result: "End users" });

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

const chat = (messages: Message[], options: Options = {}) => createElement(ChatMessages, { messages, ...options });
const render = (element: ReactNode) => act(() => root.render(element));
const inPanel = (messages: Message[], options: Options = {}) =>
  render(createElement(ChatPanel, { composer: createElement("textarea", { "data-testid": "input" }), children: chat(messages, options) }));

const dock = () => container.querySelector("[data-chat=actions]");
const transcript = () => container.querySelector("[data-quassel-transcript]");
const docked = () => [...dock()?.children[0]?.children ?? []].map((element) => element.textContent);

test("an open action sits in the dock right above the composer, not in the transcript", () => {
  inPanel([user, question("q1", "Publish the draft?")]);
  assert.deepEqual(docked(), ["Publish the draft?waiting for input"]);
  assert.doesNotMatch(transcript()?.textContent ?? "", /Publish the draft/);
  const composer = container.querySelector("[data-chat=composer]");
  assert.ok(composer?.contains(dock()));
  assert.equal(dock()?.parentElement?.nextElementSibling?.getAttribute("data-testid"), "input");
});

test("a resolved action is a receipt in the transcript and leaves the dock empty", () => {
  inPanel([user, question("q1", "Publish the draft?")]);
  inPanel([user, question("q1", "Publish the draft?", { status: "approved", result: "published" })]);
  assert.equal(dock()?.children.length, 0);
  assert.match(transcript()?.textContent ?? "", /Publish the draft\?published/);
  assert.ok(transcript()?.querySelector("[data-action=resolved]"));
});

test("without a composer, or outside a panel, open actions stay inline", () => {
  render(createElement(ChatPanel, { children: chat([user, question("q1", "Publish the draft?")]) }));
  assert.equal(dock(), null);
  assert.match(transcript()?.textContent ?? "", /Publish the draft\?waiting for input/);

  render(chat([user, question("q1", "Publish the draft?")]));
  assert.equal(dock(), null);
  assert.match(transcript()?.textContent ?? "", /Publish the draft\?waiting for input/);
});

test("several open actions stack in chronological order, answered ones stay in the transcript", () => {
  const texts = { pendingAction: "" };
  inPanel([user, question("q1", "First?"), answered, question("q2", "Second?"), question("q3", "Third?")], { texts });
  assert.deepEqual(docked(), ["First?", "Second?", "Third?"]);
  assert.match(transcript()?.textContent ?? "", /Which audience\?End users/);
  assert.doesNotMatch(transcript()?.textContent ?? "", /First|Second|Third/);
});

test("renderAction draws open actions in the dock and falls back to the generic card", () => {
  const renderAction = (action: PendingAction, text: string) => action.owner === "choice"
    ? createElement("div", { "data-testid": "choice" }, `${text} ${action.status ?? "open"}`)
    : undefined;
  inPanel([user, question("q1", "Pick one", { owner: "choice" }), question("q2", "Publish the draft?")], { renderAction });
  assert.equal(dock()?.querySelector("[data-testid=choice]")?.textContent, "Pick one open");
  assert.ok(dock()?.querySelector("[data-action=waiting]"));
  assert.equal(transcript()?.querySelector("[data-testid=choice]"), null);

  inPanel([user, question("q1", "Pick one", { owner: "choice", status: "approved", result: "A" }), question("q2", "Publish the draft?")], { renderAction });
  assert.equal(transcript()?.querySelector("[data-testid=choice]")?.textContent, "Pick one approved");
  assert.equal(dock()?.querySelector("[data-testid=choice]"), null);
});

test("the generic card in the dock dismisses through onDismissAction and keeps the host texts", () => {
  const dismissed: string[] = [];
  const options = { onDismissAction: (actionId: string) => dismissed.push(actionId), texts: { pendingAction: "awaiting reply", dismissAction: "Discard", actionDismissed: "discarded" } };
  inPanel([user, question("q1", "Publish the draft?")], options);
  const button = [...dock()?.querySelectorAll("button") ?? []].find((element) => element.textContent === "Discard");
  assert.ok(button);
  assert.match(dock()?.textContent ?? "", /awaiting reply/);
  act(() => (button as unknown as { click: () => void }).click());
  assert.deepEqual(dismissed, ["q1"]);

  inPanel([user, question("q1", "Publish the draft?", { status: "dismissed", result: null })], options);
  assert.equal(dock()?.children.length, 0);
  assert.match(transcript()?.textContent ?? "", /Publish the draft\?discarded/);
});

test("a new open action in the dock is still announced", () => {
  const announced: ChatAnnouncement[] = [];
  const announce = (announcement: ChatAnnouncement) => {
    announced.push(announcement);
    return undefined;
  };
  inPanel([user], { announce });
  inPanel([user, question("q1", "Publish the draft?")], { announce });
  assert.deepEqual(announced.map(({ kind, message }) => [kind, message.key]), [["action", "q1"]]);
});
