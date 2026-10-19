import { window } from "./dom";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ChatMessages, type Message } from "../src/index";

const question: Message = {
  key: "u1",
  role: "user",
  text: "What does the picture show?",
  attachments: [{ name: "plant.png", mediaType: "image/png", size: 2048, url: "/files/plant.png" }],
};

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

const viewer = () => window.document.querySelector("[data-chat=image-viewer]");

test("an image attachment shows inline and opens large on click until Escape closes it", async () => {
  act(() => root.render(createElement(ChatMessages, { messages: [question], announce: false })));
  const preview = container.querySelector<HTMLButtonElement>("[data-chat=attachment-image]");
  assert.equal(preview?.getAttribute("aria-label"), "Enlarge plant.png");
  assert.equal(preview?.querySelector("img")?.getAttribute("src"), "/files/plant.png");
  assert.equal(viewer(), null);

  await act(async () => preview!.click());
  assert.equal(viewer()?.querySelector("img")?.getAttribute("src"), "/files/plant.png");
  assert.equal(viewer()?.querySelector("a[download]")?.getAttribute("href"), "/files/plant.png?download=1");

  await act(async () => {
    window.document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  assert.equal(viewer(), null);
});
