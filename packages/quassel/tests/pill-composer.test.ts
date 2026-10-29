import { window } from "./dom";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { act, createElement, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ChatInputToolbar, germanTexts, type ChatAttachmentInput, type ChatInputHandle, type ChatMicrophone, type MicrophonePress } from "../src/index";

let root: Root;
let container: HTMLElement;
let sent: { text: string; attachments?: ChatAttachmentInput[] }[];
let stopped: number;
let presses: { kind: string; press?: MicrophonePress }[];

beforeEach(() => {
  container = window.document.createElement("div") as unknown as HTMLElement;
  window.document.body.appendChild(container as never);
  root = createRoot(container);
  sent = [];
  stopped = 0;
  presses = [];
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

type Options = Partial<Parameters<typeof ChatInputToolbar>[0]>;
const microphone = (state: ChatMicrophone["state"] = "idle", level?: number): ChatMicrophone => ({
  state, level,
  onPressStart: (press) => presses.push({ kind: "start", press }),
  onPressEnd: (press) => presses.push({ kind: "end", press }),
  onCancel: () => presses.push({ kind: "cancel" }),
});
const render = (options: Options = {}) => act(() => root.render(createElement(ChatInputToolbar, {
  layout: "pill", attachments: false, texts: germanTexts,
  onSend: (text, attachments) => { sent.push({ text, attachments }); },
  onStop: () => { stopped += 1; }, ...options,
})));
const primary = () => container.querySelector<HTMLButtonElement>("[data-primary-action]")!;
const textarea = () => container.querySelector<HTMLTextAreaElement>("textarea")!;
const state = () => primary().dataset.primaryAction;
const keyboard = (target: Element, type: "keydown" | "keyup", init: NonNullable<ConstructorParameters<typeof window.KeyboardEvent>[1]> = {}) => {
  const event = new window.KeyboardEvent(type, { key: "Enter", bubbles: true, cancelable: true, ...init });
  act(() => target.dispatchEvent(event as never));
  return event;
};
const pointer = (type: string, pointerId = 1, button = 0) => act(() => primary().dispatchEvent(new window.PointerEvent(type, { pointerId, button, isPrimary: true, bubbles: true, cancelable: true }) as never));
const changeDraft = (value: string) => act(() => {
  Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")!.set!.call(textarea(), value);
  textarea().dispatchEvent(new window.Event("input", { bubbles: true }) as never);
});
const click = () => act(async () => primary().click());

test("one primary button morphs between microphone, send, stop and steering without remounting", async () => {
  const mic = microphone();
  render({ microphone: mic });
  const button = primary();
  assert.equal(state(), "microphone");
  assert.equal(button.getAttribute("aria-label"), "Sprechen");
  assert.equal(container.querySelectorAll("button").length, 1);
  assert.equal(textarea().getAttribute("rows"), "1");
  changeDraft("  A new question  ");
  assert.equal(state(), "send");
  await click();
  assert.deepEqual(sent, [{ text: "A new question", attachments: undefined }]);
  render({ microphone: mic, running: true });
  assert.equal(state(), "stop");
  await click();
  assert.equal(stopped, 1);
  changeDraft("Steer the current turn");
  assert.equal(state(), "send");
  assert.equal(primary().getAttribute("aria-label"), germanTexts.sendIntoRun);
  assert.equal(primary().title, germanTexts.sendIntoRun);
  await click();
  assert.equal(sent[1].text, "Steer the current turn");
  assert.equal(state(), "stop");
  assert.equal(primary(), button);
  assert.equal(container.querySelectorAll("[data-primary-action]").length, 1);
});

test("without a microphone, empty or whitespace-only input keeps send disabled", () => {
  render();
  assert.equal(state(), "send");
  assert.equal(primary().disabled, true);
  changeDraft(" \n ");
  assert.equal(primary().disabled, true);
  render({ running: true, onStop: undefined });
  assert.equal(state(), "stop");
  assert.equal(primary().disabled, true);
});

test("holding an activation key cannot repeat send or stop as the primary action morphs", () => {
  render({ initialValue: "Draft" });
  assert.equal(keyboard(primary(), "keydown", { repeat: true }).defaultPrevented, true);
  changeDraft("");
  render({ running: true });
  assert.equal(keyboard(primary(), "keydown", { repeat: true }).defaultPrevented, true);
  assert.equal(sent.length, 0);
  assert.equal(stopped, 0);
});

test("microphone states take priority over text and running, and block draft submission", async () => {
  const handle = createRef<ChatInputHandle>();
  for (const voice of ["preparing", "recording", "transcribing"] as const) {
    render({ initialValue: "Keep this draft", running: true, microphone: microphone(voice), handleRef: handle });
    assert.equal(state(), voice);
    assert.equal(textarea().disabled, true);
    assert.equal(primary().getAttribute("aria-busy"), voice === "recording" ? null : "true");
    assert.equal(primary().disabled, voice === "transcribing");
    await act(async () => handle.current?.submit());
    keyboard(textarea(), "keydown");
    assert.equal(sent.length, 0);
  }
});

test("disabled prevents microphone and send, while sendDisabled still permits stopping and recording", async () => {
  render({ microphone: microphone(), disabled: true, attachments: true });
  assert.equal(primary().disabled, true);
  assert.equal(textarea().disabled, true);
  assert.ok([...container.querySelectorAll("button")].every((button) => button.disabled));
  pointer("pointerdown");
  await click();
  assert.equal(presses.length, 0);
  render({ microphone: microphone(), sendDisabled: true });
  assert.equal(primary().disabled, false);
  changeDraft("Blocked send");
  assert.equal(primary().disabled, true);
  changeDraft("");
  render({ microphone: microphone(), sendDisabled: true, running: true });
  await click();
  assert.equal(stopped, 1);
  assert.equal(sent.length, 0);
});

test("Enter sends, Shift+Enter inserts a line, repeats and IME composition never send", async () => {
  render({ initialValue: "First line" });
  assert.equal(keyboard(textarea(), "keydown", { shiftKey: true }).defaultPrevented, false);
  keyboard(textarea(), "keydown", { isComposing: true });
  keyboard(textarea(), "keydown", { keyCode: 229 });
  keyboard(textarea(), "keydown", { repeat: true });
  act(() => textarea().dispatchEvent(new window.CompositionEvent("compositionstart", { bubbles: true }) as never));
  keyboard(textarea(), "keydown");
  assert.equal(sent.length, 0);
  act(() => textarea().dispatchEvent(new window.CompositionEvent("compositionend", { bubbles: true }) as never));
  await act(async () => { assert.equal(keyboard(textarea(), "keydown").defaultPrevented, true); });
  assert.equal(sent[0].text, "First line");
  assert.equal(textarea().value, "");
});

test("mod-enter keeps plain Enter and Shift+Enter available for line breaks", async () => {
  render({ initialValue: "Draft", sendShortcut: "mod-enter" });
  assert.equal(keyboard(textarea(), "keydown").defaultPrevented, false);
  assert.equal(keyboard(textarea(), "keydown", { ctrlKey: true, shiftKey: true }).defaultPrevented, false);
  assert.equal(sent.length, 0);
  await act(async () => { keyboard(textarea(), "keydown", { ctrlKey: true }); });
  assert.equal(sent[0].text, "Draft");
  changeDraft("Next");
  await act(async () => { keyboard(textarea(), "keydown", { metaKey: true }); });
  assert.equal(sent[1].text, "Next");
});

test("a pointer hold ends once even when the host switches through preparing and recording", async () => {
  render({ microphone: microphone() });
  const button = primary();
  const captured: number[] = [];
  button.setPointerCapture = (id) => captured.push(id);
  pointer("pointerdown", 4, 2);
  assert.equal(presses.length, 0);
  pointer("pointerdown", 4);
  render({ microphone: microphone("preparing") });
  assert.equal(primary(), button);
  assert.equal(primary().disabled, false);
  render({ microphone: microphone("recording") });
  pointer("pointerup", 5);
  assert.equal(presses.length, 1);
  pointer("pointerup", 4);
  pointer("lostpointercapture", 4);
  await click();
  assert.deepEqual(captured, [4]);
  assert.deepEqual(presses.map(({ kind, press }) => [kind, press?.source]), [["start", "pointer"], ["end", "pointer"]]);
  assert.ok(presses[1].press!.timeStamp >= presses[0].press!.timeStamp);
  assert.equal(sent.length, 0);
});

test("keyboard presses support hold and latch, ignore repeat and suppress the synthetic click", async () => {
  render({ microphone: microphone() });
  keyboard(primary(), "keydown", { key: " " });
  keyboard(primary(), "keydown", { key: " ", repeat: true });
  render({ microphone: microphone("recording") });
  keyboard(primary(), "keyup", { key: "Enter" });
  assert.equal(presses.length, 1);
  keyboard(primary(), "keyup", { key: " " });
  await click();
  assert.deepEqual(presses.map(({ kind, press }) => [kind, press?.source]), [["start", "keyboard"], ["end", "keyboard"]]);
  keyboard(primary(), "keydown");
  keyboard(primary(), "keyup");
  assert.deepEqual(presses.map(({ kind }) => kind), ["start", "end", "start", "end"]);
});

test("assistive activation emits a virtual press pair and uses translated names and tooltips", async () => {
  render({ microphone: { ...microphone(), label: "Dictate" }, texts: { microphoneHint: "Hold or click", microphoneRecording: "Finish voice" } });
  assert.equal(primary().getAttribute("aria-label"), "Dictate");
  assert.equal(primary().title, "Hold or click");
  await click();
  assert.deepEqual(presses.map(({ kind, press }) => [kind, press?.source]), [["start", "virtual"], ["end", "virtual"]]);
  render({ microphone: microphone("recording"), texts: { microphoneRecording: "Finish voice" } });
  assert.equal(primary().getAttribute("aria-label"), "Finish voice");
  assert.equal(primary().title, "Finish voice");
  assert.equal(primary().getAttribute("aria-pressed"), "true");
});

test("pointer cancellation, capture loss, Escape, blur, disabling and unmount cancel safely", () => {
  render({ microphone: microphone() });
  pointer("pointerdown");
  pointer("pointercancel");
  pointer("pointerup");
  pointer("pointerdown");
  pointer("lostpointercapture");
  pointer("pointerdown");
  keyboard(primary(), "keydown", { key: "Escape" });
  pointer("pointerdown");
  act(() => window.dispatchEvent(new window.Event("blur")));
  pointer("pointerdown");
  render({ microphone: microphone(), disabled: true });
  render({ microphone: microphone() });
  pointer("pointerdown");
  act(() => root.render(null));
  assert.deepEqual(presses.map(({ kind }) => kind), ["start", "cancel", "start", "cancel", "start", "cancel", "start", "cancel", "start", "cancel", "start", "cancel"]);
});

test("Escape cancels a latched recording even while focus is outside the button", () => {
  render({ microphone: microphone("recording") });
  keyboard(container, "keydown", { key: "Escape" });
  assert.deepEqual(presses, [{ kind: "cancel" }]);
});

test("recording aura escapes clipping ancestors, follows a clamped level and is removed after recording", () => {
  container.style.overflow = "hidden";
  render({ microphone: microphone("recording", 2) });
  const aura = document.querySelector<HTMLElement>("[data-recording-aura]")!;
  assert.ok(aura);
  assert.equal(aura.parentElement, window.document.body);
  assert.equal(container.contains(aura), false);
  assert.equal(aura.getAttribute("aria-hidden"), "true");
  assert.equal(aura.style.transform, "scale(1.85)");
  render({ microphone: microphone("recording", -1) });
  assert.equal(aura.style.transform, "scale(1.2)");
  render({ microphone: microphone("recording", Number.NaN) });
  assert.equal(aura.style.transform, "scale(1.2)");
  render({ microphone: microphone("transcribing") });
  assert.equal(window.document.querySelector("[data-recording-aura]"), null);
});

test("replacement content preserves the hidden draft, restores it and cannot submit it", async () => {
  render({ initialValue: "Unsaved draft", replaceInput: createElement("div", { role: "status" }, "Voice waveform") });
  assert.equal(textarea().hidden, true);
  assert.equal(textarea().value, "Unsaved draft");
  assert.equal(container.querySelector("[data-input=replacement]")?.textContent, "Voice waveform");
  keyboard(textarea(), "keydown");
  await click();
  assert.equal(sent.length, 0);
  render({ replaceInput: false });
  assert.equal(textarea().hidden, false);
  assert.equal(textarea().value, "Unsaved draft");
  assert.equal(container.querySelector("[data-input=replacement]"), null);
  await click();
  assert.equal(sent[0].text, "Unsaved draft");
});

test("left and right host slots surround the input and attachments stay before the primary action", () => {
  render({
    attachments: true,
    toolbarLeft: createElement("button", { "aria-label": "Menu" }, "Menu"),
    toolbarRight: createElement("button", { "aria-label": "Tools" }, "Tools"),
  });
  const row = container.querySelector("[data-input=pill]")!;
  assert.deepEqual([...row.children].map((child) => child.getAttribute("data-input") ?? child.tagName), ["left", "TEXTAREA", "right", "BUTTON"]);
  assert.equal(row.lastElementChild, primary());
  assert.equal(container.querySelector("[data-input=right]")?.lastElementChild?.getAttribute("aria-label"), germanTexts.attachFiles);
});

test("button, drop and paste accept attachment-only sends and respect attachments=false", async () => {
  for (const method of ["button", "drop", "paste"] as const) {
    render({ attachments: true, microphone: microphone() });
    const file = new window.File(["demo"], "demo.txt", { type: "text/plain" });
    await act(async () => {
      if (method === "button") {
        const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
        let opened = false;
        input.click = () => { opened = true; };
        container.querySelector<HTMLButtonElement>(`button[aria-label="${germanTexts.attachFiles}"]`)!.click();
        assert.equal(opened, true);
        Object.defineProperty(input, "files", { value: [file], configurable: true });
        input.dispatchEvent(new window.Event("change", { bubbles: true }) as never);
      } else {
        const event = new window.Event(method, { bubbles: true, cancelable: true });
        Object.defineProperty(event, method === "paste" ? "clipboardData" : "dataTransfer", { value: { files: [file], types: ["Files"], getData: () => "" } });
        container.querySelector("[data-layout]")!.dispatchEvent(event as never);
      }
    });
    assert.equal(state(), "send");
    assert.equal(primary().disabled, false);
    await click();
    assert.deepEqual(sent.at(-1), { text: "", attachments: [{ name: "demo.txt", mediaType: "text/plain", data: "ZGVtbw==" }] });
  }
  assert.equal(sent.length, 3);
  render({ attachments: false, microphone: microphone() });
  assert.equal(container.querySelector('input[type="file"]'), null);
  const event = new window.Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: { files: [new window.File(["x"], "x.txt")], types: ["Files"] } });
  act(() => container.querySelector("[data-layout]")!.dispatchEvent(event as never));
  assert.equal(state(), "microphone");
});

test("pending sends never become microphone actions and failed sends restore the draft", async () => {
  let reject!: (error: Error) => void;
  const pending = new Promise<void>((_, fail) => { reject = fail; });
  render({ initialValue: "Retry me", microphone: microphone(), onSend: () => pending });
  act(() => primary().click());
  assert.equal(state(), "send");
  assert.equal(primary().disabled, true);
  changeDraft("New draft");
  await act(async () => reject(new Error("Try again")));
  assert.equal(textarea().value, "New draft");
  assert.match(container.textContent ?? "", /Retry me/);
  assert.match(container.textContent ?? "", /Try again/);
  assert.equal(primary().disabled, false);
});

test("auto-grow respects maxRows and restores the minimum height after the draft clears", () => {
  render({ maxRows: 3 });
  const input = textarea();
  input.style.lineHeight = "24px";
  input.style.paddingTop = "12px";
  input.style.paddingBottom = "12px";
  Object.defineProperty(input, "scrollHeight", { configurable: true, value: 240 });
  changeDraft("One\nTwo\nThree\nFour");
  assert.equal(input.style.height, "96px");
  assert.equal(input.style.overflowY, "auto");
  Object.defineProperty(input, "scrollHeight", { configurable: true, value: 48 });
  changeDraft("");
  assert.equal(input.style.height, "48px");
  assert.equal(input.style.overflowY, "hidden");
});

test("card, inline and toolbar keep their existing controls and ignore pill-only slots", () => {
  for (const layout of ["card", "inline", "toolbar"] as const) {
    render({ layout, running: true, microphone: microphone("recording"), replaceInput: "Pill only" });
    assert.equal(container.querySelector("[data-primary-action]"), null);
    assert.equal(textarea().disabled, false);
    assert.equal(textarea().hidden, false);
    assert.equal(container.querySelector("[data-input=replacement]"), null);
    assert.equal(window.document.querySelector("[data-recording-aura]"), null);
    assert.ok(container.querySelector(`button[aria-label="${germanTexts.stop}"]`));
  }
});
