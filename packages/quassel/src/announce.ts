const abstandMs = 400;
const hoechstensWartend = 5;

let region: HTMLElement | undefined;
let wartend: readonly string[] = [];
let laeuft = false;

function ansageRegion(): HTMLElement {
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

function naechste(): void {
  if (wartend.length === 0) {
    laeuft = false;
    return;
  }
  if (document.visibilityState === "hidden") {
    document.addEventListener("visibilitychange", naechste, { once: true });
    return;
  }
  const [text, ...rest] = wartend;
  wartend = rest;
  const ziel = ansageRegion();
  ziel.textContent = ziel.textContent === text ? `${text}\u00a0` : text;
  window.setTimeout(naechste, abstandMs);
}

/** Sagt Text über eine gemeinsame, versteckte Live-Region an: gedrosselt, und bei verstecktem Tab angehalten. */
export function announce(text: string): void {
  const inhalt = text.trim();
  if (!inhalt || typeof document === "undefined") {
    return;
  }
  wartend = [...wartend, inhalt].slice(-hoechstensWartend);
  if (laeuft) {
    return;
  }
  laeuft = true;
  ansageRegion();
  window.setTimeout(naechste, abstandMs);
}
