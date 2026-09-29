const intervalMs = 400;
const maxQueued = 5;

let region: HTMLElement | undefined;
let queued: readonly string[] = [];
let running = false;

function liveRegion(): HTMLElement {
  if (region?.isConnected) {
    return region;
  }
  const element = document.createElement("div");
  element.setAttribute("role", "status");
  element.setAttribute("aria-live", "polite");
  element.setAttribute("aria-atomic", "true");
  Object.assign(element.style, {
    position: "absolute",
    width: "1px",
    height: "1px",
    margin: "-1px",
    padding: "0",
    border: "0",
    overflow: "hidden",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
  });
  document.body.append(element);
  region = element;
  return element;
}

function next(): void {
  if (queued.length === 0) {
    running = false;
    return;
  }
  if (document.visibilityState === "hidden") {
    document.addEventListener("visibilitychange", next, { once: true });
    return;
  }
  const [text, ...rest] = queued;
  queued = rest;
  const target = liveRegion();
  target.textContent = target.textContent === text ? `${text}\u00a0` : text;
  window.setTimeout(next, intervalMs);
}

/** Announces text through a shared, hidden live region: throttled, and paused while the tab is hidden. */
export function announce(text: string): void {
  const content = text.trim();
  if (!content || typeof document === "undefined") {
    return;
  }
  queued = [...queued, content].slice(-maxQueued);
  if (running) {
    return;
  }
  running = true;
  liveRegion();
  window.setTimeout(next, intervalMs);
}
