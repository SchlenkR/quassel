import { window } from "./dom";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { applyEvent, ChatMessages, defaultTexts, englishTexts, germanTexts, type Message } from "../src/index";

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

const render = (messages: Message[], options: Omit<Parameters<typeof ChatMessages>[0], "messages"> = {}) =>
  act(() => root.render(createElement(ChatMessages, { messages, detailMode: "grouped", announce: false, ...options })));
const header = () => container.querySelector("[data-step=group]")?.firstElementChild;
const done = (id: string, isError = false): Message => ({ key: id, role: "tool", text: id, tool: { id, name: id, arguments: "{}", result: isError ? "timeout" : "ok", isError } });

test("completed groups distinguish total steps and errors, including locked and expanded groups", () => {
  render([done("read")]);
  assert.equal(header()?.textContent, "1 step");
  assert.equal(container.querySelector("[data-step=errors]"), null);
  render([done("read", true)]);
  assert.equal(header()?.textContent, "1 step, 1 error");
  const messages: Message[] = [done("read", true), { key: "think", role: "thinking", text: "Compare", closed: true }, done("retry"), done("check", true)];
  render(messages);
  assert.equal(header()?.textContent, "4 steps, 2 errors");
  act(() => container.querySelector<HTMLButtonElement>("[data-step=group] > button")?.click());
  assert.equal(header()?.getAttribute("aria-expanded"), "true");
  assert.equal(header()?.textContent, "4 steps, 2 errors");
  assert.equal(container.querySelectorAll("[data-kind=tool]").length, 3);
  render(messages, { groupsExpandable: false });
  assert.equal(container.querySelector("[data-step=group] button"), null);
  assert.equal(header()?.textContent, "4 steps, 2 errors");
});

test("streamed failures stay visible during and after a successful retry", () => {
  let messages = applyEvent([], { kind: "tool", id: "read", name: "read", arguments: "{}" });
  const options = { running: true, working: createElement("span"), groupsExpandable: false };
  render(messages, options);
  assert.equal(container.querySelector("[data-step=errors]"), null);
  messages = applyEvent(messages, { kind: "tool-result", id: "read", result: "timeout", isError: true });
  render(messages, options);
  assert.equal(header()?.textContent, "1 step, 1 error");
  messages = applyEvent(messages, { kind: "tool", id: "retry", name: "retry", arguments: "{}" });
  render(messages, options);
  assert.match(header()?.textContent ?? "", /^2 steps, 1 errorretry running/);
  messages = applyEvent(messages, { kind: "tool-result", id: "retry", result: "ok" });
  render(messages);
  assert.equal(header()?.textContent, "2 steps, 1 error");
});

test("language switches preserve expanded groups and content; custom error labels are supported", () => {
  const messages = [done("read", true), done("retry")];
  render(messages, { texts: germanTexts });
  assert.equal(header()?.textContent, "2 Schritte, 1 Fehler");
  act(() => container.querySelector<HTMLButtonElement>("[data-step=group] > button")?.click());
  render(messages, { texts: englishTexts });
  assert.equal(header()?.getAttribute("aria-expanded"), "true");
  assert.equal(header()?.textContent, "2 steps, 1 error");
  assert.equal(container.querySelectorAll("[data-kind=tool]").length, 2);
  render([done("read", true), done("check", true)], { texts: germanTexts });
  assert.equal(header()?.textContent, "2 Schritte, 2 Fehler");
  render(messages, { texts: { stepGroupErrorOne: "one failure" } });
  assert.equal(header()?.textContent, "2 steps, one failure");
  render([done("read", true), done("check", true)], { texts: { stepGroupErrorMany: "{count} failures" } });
  assert.equal(header()?.textContent, "2 steps, 2 failures");
});

test("German and English presets cover every label and preserve every placeholder", () => {
  assert.equal(defaultTexts, englishTexts);
  assert.deepEqual(Object.keys(germanTexts).sort(), Object.keys(englishTexts).sort());
  for (const key of Object.keys(englishTexts) as (keyof typeof englishTexts)[]) {
    assert.ok(germanTexts[key].trim(), key);
    assert.deepEqual(germanTexts[key].match(/\{\w+\}/g)?.sort(), englishTexts[key].match(/\{\w+\}/g)?.sort(), key);
  }
});
