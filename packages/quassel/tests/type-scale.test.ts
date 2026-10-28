import { window } from "./dom";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, test } from "node:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ChatInputToolbar, ChatMessages, ChatPanel, Markdown, type DetailMode, type Message } from "../src/index";

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

const steps: Message[] = [
  { key: "think", role: "thinking", text: "Compare", closed: true },
  { key: "read", role: "tool", text: "read", closed: true, tool: { id: "read", name: "read", arguments: "{}", result: "ok" } },
];
const render = (detailMode: DetailMode) =>
  act(() => root.render(createElement(ChatMessages, { messages: steps, detailMode, announce: false })));
const monospace = (element: Element) => [element, ...element.querySelectorAll("*")].filter((node) => node.classList.contains("qsl:font-mono"));

test("step rows use the UI font in every detail level", () => {
  (["chips", "grouped", "compact", "full"] as const).forEach((mode) => {
    render(mode);
    if (mode === "grouped") act(() => container.querySelector<HTMLButtonElement>("[data-step=group] > button")?.click());
    const rows = [...container.querySelectorAll("[data-step=chip], [data-step=group], [data-step=line], [data-step=detail]")];
    assert.ok(rows.length > 0, mode);
    rows.forEach((row) => assert.deepEqual(monospace(row).filter((node) => node.tagName !== "PRE"), [], mode));
    rows.forEach((row) => assert.ok([row, ...row.querySelectorAll("*")].some((node) => node.classList.contains("qsl:text-small")), mode));
  });
});

test("tool arguments and results stay monospace", () => {
  render("full");
  const blocks = [...container.querySelectorAll("[data-step=detail] pre")];
  assert.equal(blocks.length, 2);
  blocks.forEach((block) => {
    assert.ok(block.classList.contains("qsl:font-mono"));
    assert.ok(block.classList.contains("qsl:text-small"));
  });
});

test("the built stylesheet contains only the fixed type scale", () => {
  const css = readFileSync(new URL("../build/chat.css", import.meta.url), "utf8");
  const allowed = {
    "font-size": new Set(["var(--qsl-font-size, 13px)", "var(--qsl-base)", "calc(var(--qsl-base) * 0.85)", "calc(var(--qsl-base) * 1.3)", "calc(var(--qsl-base) * 1.15)", "calc(var(--qsl-base) * 1.05)", "0.9em", "inherit"]),
    "line-height": new Set(["1.5", "1.4", "1.25", "1.3", "1.35", "inherit"]),
  };
  for (const property of ["font-size", "line-height"] as const) {
    const declarations = [...css.matchAll(new RegExp(`(?:^|[;{\\s])${property}:\\s*([^;{}]+);`, "gm"))];
    assert.ok(declarations.length >= 8, property);
    declarations.forEach(([, value]) => assert.ok(allowed[property].has(value.trim()), `${property}: ${value}`));
    allowed[property].forEach((value) => assert.ok(declarations.some(([, actual]) => actual.trim() === value), `${property}: ${value} is missing`));
  }
  assert.match(css, /@property --qsl-base\s*\{[^}]*syntax: "<length>"/);
  assert.match(css, /@property --qsl-base\s*\{[^}]*inherits: true;[^}]*initial-value: 13px;/);
  assert.doesNotMatch(css, /--qsl-(?:text-[\w-]+|chat-font-size|chat-line-height|timestamp-font-size|tool-font-scale)\b/);
  assert.doesNotMatch(css, /--(?:qsl|tw)-leading\b/);
  const fonts = [...css.matchAll(/(?:^|[;{\s])font:\s*([^;{}]+);/gm)];
  fonts.forEach(([, value]) => assert.equal(value, "inherit"));
  const options = readFileSync(new URL("../src/options.ts", import.meta.url), "utf8");
  assert.doesNotMatch(options, /^\s*(?:fontSize|lineHeight|toolFontScale|fontScale)\??:/m);
});

test("messages, input and pending action buttons use body text while notices stay small", () => {
  const messages: Message[] = [
    { key: "user", role: "user", text: "Question" },
    { key: "reply", role: "assistant", text: "Answer", closed: true },
    { key: "notice", role: "system", text: "Notice" },
    { key: "action", role: "action", text: "Choose", action: { actionId: "choice", owner: null, payload: {} } },
  ];
  act(() => root.render(createElement(ChatPanel, {
    composer: createElement(ChatInputToolbar, { onSend: () => {}, attachments: false }),
    children: createElement(ChatMessages, { messages, announce: false, onDismissAction: () => {} }),
  })));
  for (const selector of ["textarea", '[data-chat="actions"] [data-slot="card"]', '[data-chat="actions"] button']) {
    assert.ok(container.querySelector(selector)?.classList.contains("qsl:text-body"), selector);
  }
  assert.ok(container.querySelector('[data-message="system"]')?.classList.contains("qsl:text-small"));
});

test("Markdown carries the same styling scope inside answers and as a standalone document", () => {
  const text = "# Title\n\n**Strong** and *emphasis*, `code` and [link](https://example.com).\n\n- Item\n\n> Quote\n\n```ts\nconst value = 1;\n```\n\n| Key | Value |\n| --- | --- |\n| a | b |";
  act(() => root.render(createElement(Markdown, { text })));
  const document = container.querySelector('[data-quassel-markdown]')!;
  assert.ok(document.hasAttribute("data-quassel"));
  assert.equal(document.closest('[data-message="answer"]'), null);
  for (const selector of ["h1", "strong", "em", "p code", "a", "ul li", "blockquote", "pre code", "table th", "table td"]) {
    assert.ok(document.querySelector(selector), selector);
  }
  const content = document.innerHTML;
  act(() => root.render(createElement(ChatMessages, { messages: [{ key: "answer", role: "assistant", text, closed: true }], announce: false })));
  const answer = container.querySelector('[data-message="answer"] [data-quassel-markdown]')!;
  assert.ok(answer.hasAttribute("data-quassel"));
  assert.equal(answer.innerHTML, content);
  act(() => root.render(createElement(Markdown, { text, streaming: true })));
  assert.ok(container.querySelector('[data-quassel-markdown][data-quassel] h1'));
});
