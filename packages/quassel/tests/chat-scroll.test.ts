import assert from "node:assert/strict";
import { test } from "node:test";
import { createChatScroll } from "../src/index";

const following = () => {
  const changes: boolean[] = [];
  return { changes, scroll: createChatScroll((value) => changes.push(value)) };
};

test("a native upward scroll over unchanged content pauses following, and reaching the end resumes it", () => {
  const { changes, scroll } = following();
  const viewport = { scrollTop: 0, scrollHeight: 1000, clientHeight: 200 };
  scroll.layout(viewport);
  assert.equal(viewport.scrollTop, 800);
  viewport.scrollTop = 500;
  scroll.scroll(viewport);
  assert.deepEqual(changes, [false]);
  viewport.scrollTop = 800;
  scroll.scroll(viewport);
  assert.deepEqual(changes, [false, true]);
});

test("content that grows or shrinks under a following transcript keeps it at the end", () => {
  const { changes, scroll } = following();
  const viewport = { scrollTop: 0, scrollHeight: 1000, clientHeight: 200 };
  scroll.layout(viewport);
  viewport.scrollHeight = 1200;
  scroll.layout(viewport);
  assert.equal(viewport.scrollTop, 1000);
  viewport.scrollHeight = 900;
  viewport.scrollTop = 700;
  scroll.scroll(viewport);
  scroll.layout(viewport);
  assert.equal(viewport.scrollTop, 700);
  assert.deepEqual(changes, []);
});

test("a queued scroll at an old position after a pause does not resume following", () => {
  const { changes, scroll } = following();
  const viewport = { scrollTop: 0, scrollHeight: 1000, clientHeight: 200 };
  scroll.layout(viewport);
  viewport.scrollTop = 0;
  scroll.pause(viewport);
  scroll.scroll(viewport);
  scroll.layout(viewport);
  assert.equal(viewport.scrollTop, 0);
  assert.deepEqual(changes, [false]);
});
