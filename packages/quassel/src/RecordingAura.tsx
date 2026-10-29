import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

export function RecordingAura({ anchor, level = 0 }: { anchor: HTMLButtonElement; level?: number }) {
  const aura = useRef<HTMLSpanElement>(null);
  const volume = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;

  useLayoutEffect(() => {
    const element = aura.current;
    const view = anchor.ownerDocument.defaultView;
    if (!element || !view) return;
    let frame = 0;
    let visible = true;
    const observer = new view.IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    observer.observe(anchor);
    const update = () => {
      const rect = anchor.getBoundingClientRect();
      const style = view.getComputedStyle(anchor);
      element.style.left = `${rect.left}px`;
      element.style.top = `${rect.top}px`;
      element.style.width = `${rect.width}px`;
      element.style.height = `${rect.height}px`;
      element.style.visibility = visible && rect.width && rect.height && anchor.checkVisibility() ? "visible" : "hidden";
      element.style.setProperty("--qsl-pill-aura-color", style.getPropertyValue("--qsl-pill-aura-color") || style.getPropertyValue("--qsl-destructive"));
      element.style.setProperty("--qsl-pill-aura-ring-color", style.getPropertyValue("--qsl-pill-aura-ring-color") || style.getPropertyValue("--qsl-pill-aura-color") || style.getPropertyValue("--qsl-destructive"));
      element.style.zIndex = style.getPropertyValue("--qsl-pill-aura-z-index") || "1000";
      frame = view.requestAnimationFrame(update);
    };
    update();
    return () => {
      view.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [anchor]);

  return createPortal(<span
    aria-hidden="true"
    className="qsl:recording-aura"
    data-quassel=""
    data-recording-aura=""
    ref={aura}
    style={{ transform: `scale(${1.2 + volume * 0.65})`, opacity: 0.4 + volume * 0.4 }}
  />, anchor.ownerDocument.body);
}
