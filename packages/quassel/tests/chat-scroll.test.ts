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

test("upward wheel steps within the threshold pause following while content grows before each scroll event", () => {
  const { changes, scroll } = following();
  const viewport = { scrollTop: 0, scrollHeight: 2000, clientHeight: 400 };
  scroll.layout(viewport);
  for (let step = 0; step < 3; step++) {
    scroll.pause(viewport);
    viewport.scrollTop -= 100;
    viewport.scrollHeight += 10;
    scroll.layout(viewport);
    scroll.scroll(viewport);
  }
  assert.equal(viewport.scrollTop, 1300);
  assert.deepEqual(changes, [false]);
});

test("a user scroll before its queued event survives a concurrent render", () => {
  const { changes, scroll } = following();
  const viewport = { scrollTop: 0, scrollHeight: 1200, clientHeight: 400 };
  scroll.layout(viewport);
  scroll.pause(viewport);
  viewport.scrollTop = 300;
  viewport.scrollHeight += 150;
  scroll.layout(viewport);
  scroll.scroll(viewport);
  assert.equal(viewport.scrollTop, 300);
  assert.deepEqual(changes, [false]);
});

test("after a gesture pause, scrolling back down within the threshold resumes following", () => {
  const { changes, scroll } = following();
  const viewport = { scrollTop: 0, scrollHeight: 1000, clientHeight: 200 };
  scroll.layout(viewport);
  scroll.pause(viewport);
  viewport.scrollTop = 500;
  scroll.scroll(viewport);
  viewport.scrollTop = 720;
  scroll.scroll(viewport);
  viewport.scrollHeight = 1100;
  scroll.layout(viewport);
  assert.equal(viewport.scrollTop, 900);
  assert.deepEqual(changes, [false, true]);
});

test("a downward return within the threshold resumes following although a render lands before its scroll event", () => {
  const { changes, scroll } = following();
  const viewport = { scrollTop: 0, scrollHeight: 1000, clientHeight: 200 };
  scroll.layout(viewport);
  scroll.pause(viewport);
  viewport.scrollTop = 500;
  scroll.scroll(viewport);
  viewport.scrollTop = 720;
  viewport.scrollHeight += 10;
  scroll.layout(viewport);
  scroll.scroll(viewport);
  assert.deepEqual(changes, [false, true]);
});
