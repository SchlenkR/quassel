import { window } from "./dom";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ChatMessages, ChatPanel, type Message } from "../src/index";

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

const at = "2026-01-01T12:00:00.000Z";
const messages: Message[] = [
  { key: "user", role: "user", text: "A short question", at },
  { key: "tool", role: "tool", text: "Read the file", at, tool: { id: "read", name: "read", arguments: "{}", result: "ok" } },
  { key: "answer", role: "assistant", text: "The answer", at, closed: true },
];
type Options = Omit<Parameters<typeof ChatMessages>[0], "messages">;
const render = (options: Options = {}, input = messages) => act(() => root.render(createElement(ChatMessages, { messages: input, detailMode: "grouped", announce: false, ...options })));

test("user backgrounds span the row by default without changing text width or alignment", () => {
  render({ bubbleOptions: { maxWidth: 240 } });
  const user = container.querySelector<HTMLElement>('[data-message="user"]')!;
  const background = user.querySelector<HTMLElement>('[data-chat="bubble-background"]')!;
  const content = user.querySelector<HTMLElement>('[data-chat="bubble-content"]')!;
  assert.equal(user.dataset.backgroundWidth, "full");
  assert.equal(user.dataset.side, "end");
  assert.equal(background.getAttribute("aria-hidden"), "true");
  assert.equal(background.textContent, "");
  assert.equal(background.style.maxWidth, "");
  assert.equal(content.style.maxWidth, "240px");
  assert.equal(content.textContent, "A short question");
  assert.equal(container.querySelector('[data-message="answer"] [data-chat="bubble-background"]'), null);
  render({ bubbleOptions: { maxWidth: 240, userBackgroundFullWidth: false } });
  assert.equal(container.querySelector('[data-message="user"]')?.getAttribute("data-background-width"), "content");
  assert.equal(container.querySelector('[data-chat="bubble-background"]'), null);
  assert.equal(container.querySelector<HTMLElement>('[data-chat="bubble-content"]')?.style.maxWidth, "240px");
});

test("plain transcripts stay plain and colored backgrounds keep their color in both widths", () => {
  render({ bubbleOptions: { variant: "plain" } });
  assert.equal(container.querySelector('[data-chat="bubble-background"]'), null);
  const colored: Message[] = [{ ...messages[0], bubble: { color: "#235789", side: "start" } }];
  render({}, colored);
  assert.equal(container.querySelector('[data-message="bubble"]')?.getAttribute("data-side"), "start");
  assert.equal(container.querySelector<HTMLElement>('[data-chat="bubble-background"]')?.style.background, "#235789");
  assert.equal(container.querySelector<HTMLElement>('[data-chat="bubble-content"]')?.style.background, "");
  render({ bubbleOptions: { userBackgroundFullWidth: false } }, colored);
  assert.equal(container.querySelector('[data-chat="bubble-background"]'), null);
  assert.equal(container.querySelector<HTMLElement>('[data-chat="bubble-content"]')?.style.background, "#235789");
});

test("timestamp placement changes without losing expanded tool groups or timestamp formatting", () => {
  render({ showTimestamps: true, timestampOptions: { timeZone: "UTC" } });
  assert.equal(container.querySelector('[data-chat="timestamped"]')?.getAttribute("data-timestamp-position"), "aside");
  assert.equal(container.querySelector("time")?.textContent, "12:00");
  assert.equal(container.querySelector("time")?.getAttribute("datetime"), at);
  assert.ok(container.querySelector("time")?.classList.contains("qsl:text-small"));
  assert.ok(container.querySelector("time")?.classList.contains("qsl:text-muted-foreground"));
  act(() => container.querySelector<HTMLButtonElement>('[data-step="group"] > button')!.click());
  render({ showTimestamps: true, timestampOptions: { position: "above", timeZone: "UTC" } });
  const wrappers = [...container.querySelectorAll('[data-chat="timestamped"]')];
  assert.equal(wrappers.length, 3);
  wrappers.forEach(wrapper => {
    assert.equal(wrapper.getAttribute("data-timestamp-position"), "above");
    assert.equal(wrapper.firstElementChild?.tagName, "TIME");
    assert.equal(wrapper.childElementCount, 2);
  });
  assert.equal(container.querySelector('[data-step="group"] > button')?.getAttribute("aria-expanded"), "true");
  assert.equal(container.querySelector("time")?.textContent, "12:00");
  render({ timestampOptions: { position: "above" } });
  assert.equal(container.querySelector("time"), null);
});

test("appearance spacing reaches nested chats without typography overrides", () => {
  act(() => root.render(createElement(ChatPanel, {
    appearance: { messageGap: 12, denseMessageGap: 4, toolGroupGap: 2, toolRowPadding: 3 },
    children: createElement(ChatMessages, { messages, showTimestamps: true, announce: false }),
  })));
  const panel = container.querySelector<HTMLElement>('[data-chat="panel"]')!;
  assert.equal(panel.style.getPropertyValue("--qsl-chat-message-gap"), "12px");
  assert.equal(panel.style.getPropertyValue("--qsl-chat-dense-message-gap"), "4px");
  assert.equal(panel.style.getPropertyValue("--qsl-tool-group-gap"), "2px");
  assert.equal(panel.style.getPropertyValue("--qsl-tool-row-padding"), "3px");
  assert.ok(container.querySelector("time")?.classList.contains("qsl:text-small"));
  assert.doesNotMatch(container.innerHTML, /style="[^"]*(?:font-size|font-scale|line-height)/);
});

test("copy actions sit below the message: Markdown for inputs, Markdown and formatted for answers", () => {
  render();
  const labels = (actions: Element) => [...actions.querySelectorAll("button")].map((button) => button.getAttribute("aria-label"));
  const userActions = container.querySelector('[data-message="user"]')!.parentElement!.querySelector('[data-chat="message-actions"]')!;
  assert.equal(userActions.closest('[data-chat="bubble-content"]'), null);
  assert.deepEqual(labels(userActions), ["Copy as Markdown"]);
  assert.deepEqual(labels(container.querySelector('[data-message="answer"] [data-chat="message-actions"]')!), ["Copy as Markdown", "Copy with formatting"]);
});
