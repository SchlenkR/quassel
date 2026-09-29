import { window } from "./dom";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatMessages, defaultTexts, formatElapsed, type DetailMode, type Message } from "../src/index";
import { elapsedTicker } from "../src/elapsed";

const start = Date.parse("2026-01-01T10:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();

const done = (key: string, name: string): Message => ({ key, role: "tool", text: name, closed: true, at: iso(start - 60_000), tool: { id: key, name, arguments: "{}", result: "ok" } });
const open = (at: string | null = iso(start)): Message => ({ key: "bash", role: "tool", text: "bash", closed: true, ...(at === null ? {} : { at }), tool: { id: "bash", name: "bash", arguments: "{}" } });

let root: Root;
let container: HTMLElement;

beforeEach(() => {
  mock.timers.enable({ apis: ["setInterval", "Date"], now: start });
  container = window.document.createElement("div") as unknown as HTMLElement;
  window.document.body.appendChild(container as never);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  mock.timers.reset();
});

const render = (messages: Message[], options: { detailMode?: DetailMode; running?: boolean; toolElapsedThreshold?: number | false } = {}) =>
  act(() => root.render(createElement(ChatMessages, { messages, running: true, working: createElement("span"), detailMode: "compact", ...options })));

const tick = (ms: number) => act(() => mock.timers.tick(ms));

const shown = () => [...container.querySelectorAll("[data-step=elapsed]")].map((element) => element.textContent);

test("formatElapsed: seconds from texts under a minute, then m:ss and h:mm:ss", () => {
  assert.deepEqual([0, 12_000, 59_999, 60_000, 100_000, 3_599_000, 3_723_000, 36_000_000].map((ms) => formatElapsed(ms, defaultTexts)),
    ["0 s", "12 s", "59 s", "1:00", "1:40", "59:59", "1:02:03", "10:00:00"]);
  assert.equal(formatElapsed(-5_000, defaultTexts), "0 s");
  assert.equal(formatElapsed(12_000, { toolElapsedSeconds: "{seconds}s" }), "12s");
});

test("nothing is shown before the threshold, then the time appears", () => {
  render([open()]);
  assert.deepEqual(shown(), []);
  tick(2_500);
  assert.deepEqual(shown(), []);
  tick(500);
  assert.deepEqual(shown(), ["3 s"]);
  render([open()], { toolElapsedThreshold: 10_000 });
  assert.deepEqual(shown(), []);
});

test("the running row counts up over time", () => {
  render([open()]);
  tick(12_000);
  assert.deepEqual(shown(), ["12 s"]);
  tick(88_000);
  assert.deepEqual(shown(), ["1:40"]);
  render([open(iso(start + 100_000 - 3_722_000))]);
  tick(1_000);
  assert.deepEqual(shown(), ["1:02:03"]);
});

test("the ticker stops once the result arrives or the chat stops running", () => {
  render([open()]);
  tick(5_000);
  assert.deepEqual(shown(), ["5 s"]);
  assert.equal(elapsedTicker.active(), true);
  render([{ ...open(), tool: { ...open().tool!, result: "done" } }]);
  assert.deepEqual(shown(), []);
  assert.equal(elapsedTicker.active(), false);

  render([open()]);
  assert.equal(elapsedTicker.active(), true);
  render([open()], { running: false });
  assert.deepEqual(shown(), []);
  assert.equal(elapsedTicker.active(), false);
});

test("without a start time, disabled or on the server nothing is shown", () => {
  render([open(null)]);
  tick(10_000);
  assert.deepEqual(shown(), []);
  assert.equal(elapsedTicker.active(), false);
  render([open()], { toolElapsedThreshold: false });
  tick(10_000);
  assert.deepEqual(shown(), []);
  assert.equal(elapsedTicker.active(), false);
  const html = renderToStaticMarkup(createElement(ChatMessages, { messages: [open(iso(start - 60_000))], running: true, detailMode: "grouped" }));
  assert.doesNotMatch(html, /data-step="elapsed"/);
});

test("the collapsed group header shows the elapsed time of its running step, hidden from screen readers", () => {
  render([done("read", "read"), open()], { detailMode: "grouped" });
  tick(12_000);
  const header = container.querySelector("[data-step=group] button[aria-expanded=false]");
  assert.ok(header);
  assert.match(header.textContent ?? "", /^2 stepsbash running \.\.\.12 s$/);
  const elapsed = header.querySelector("[data-step=elapsed]");
  assert.equal(elapsed?.getAttribute("aria-hidden"), "true");
  assert.equal(header.querySelectorAll("[aria-live]").length, 0);

  render([open(), done("read", "read")], { detailMode: "grouped" });
  assert.match(container.querySelector("[data-step=group] button")?.textContent ?? "", /^2 stepsbash running \.\.\.12 s$/);
});

test("chips carry the elapsed time, icons do not", () => {
  render([done("read", "read"), open()], { detailMode: "chips" });
  tick(4_000);
  assert.deepEqual(shown(), ["4 s"]);
  render([done("read", "read"), open()], { detailMode: "icons" });
  assert.deepEqual(shown(), []);
});
