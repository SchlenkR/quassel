import { window } from "./dom";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Markdown, QuasselProvider } from "../src/index";

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

const toFiles = (url: string): string => url.startsWith("@") ? `/files/${url.slice(1)}` : url;
const render = (node: ReactNode) => act(() => root.render(node));
const markdown = (text: string) => createElement(Markdown, { text });
const image = () => container.querySelector("img")?.getAttribute("src");
const link = () => container.querySelector("a")?.getAttribute("href");

test("resolveUrl maps link and image addresses before the link policy", () => {
  render(createElement(QuasselProvider, { resolveUrl: toFiles, children: markdown("![shot](@docs/a.png) [report](@docs/b.md)") }));
  assert.equal(image(), "/files/docs/a.png");
  assert.equal(link(), "/files/docs/b.md");
});

test("a resolved address still passes the link policy", () => {
  render(createElement(QuasselProvider, { resolveUrl: () => "javascript:alert(1)", children: markdown("[x](y.md)") }));
  assert.notEqual(link(), "javascript:alert(1)");
});

test("an inner provider replaces the resolver of an outer one, without one addresses stay unchanged", () => {
  render(createElement(QuasselProvider, {
    resolveUrl: toFiles,
    children: createElement(QuasselProvider, { resolveUrl: (url: string) => `/inner/${url}`, children: markdown("[x](@docs/c.md)") }),
  }));
  assert.equal(link(), "/inner/@docs/c.md");
  render(markdown("[x](@docs/c.md)"));
  assert.equal(link(), "@docs/c.md");
});
