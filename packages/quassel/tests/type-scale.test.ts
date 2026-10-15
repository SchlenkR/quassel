import { window } from "./dom";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, test } from "node:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ChatMessages, type DetailMode, type Message } from "../src/index";

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
  });
});

test("tool arguments and results stay monospace", () => {
  render("full");
  const blocks = [...container.querySelectorAll("[data-step=detail] pre")];
  assert.equal(blocks.length, 2);
  blocks.forEach((block) => assert.ok(block.classList.contains("qsl:font-mono")));
});

test("every text size of the stylesheet derives from --qsl-base", () => {
  const css = readFileSync(new URL("../src/chat.css", import.meta.url), "utf8");
  const sizes = [...css.matchAll(/^\s*--text-([a-z]+):\s*(.+);$/gm)];
  assert.ok(sizes.length >= 9);
  sizes.forEach(([line]) => assert.match(line, /var\(--qsl-base\)/, line));
  assert.match(css, /@property --qsl-base\s*\{[^}]*syntax: "<length>"/);
  assert.doesNotMatch(css, /font-size:\s*[\d.]+(px|rem)/);
});
