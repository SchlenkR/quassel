import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Message, prettyJson } from "./types";
import { IconSpark, IconTool, IconX } from "./icons";
import { ChatTexts } from "./texts";

export function StepPopover({
  message,
  position,
  texts,
  toolArgumentsText,
  onClose,
}: {
  message: Message;
  position: { x: number; y: number };
  texts: ChatTexts;
  toolArgumentsText: (tool: NonNullable<Message["tool"]>) => string;
  onClose: () => void;
}) {
  const popover = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<{ left: number; top: number }>();

  useLayoutEffect(() => {
    const element = popover.current;
    if (!element) {
      return;
    }
    const margin = 16;
    const gap = 10;
    const bounds = element.getBoundingClientRect();
    const preferredLeft = position.x + gap;
    const preferredTop = position.y + gap;
    const left =
      preferredLeft + bounds.width <= window.innerWidth - margin
        ? preferredLeft
        : position.x - bounds.width - gap;
    const top =
      preferredTop + bounds.height <= window.innerHeight - margin
        ? preferredTop
        : position.y - bounds.height - gap;
    setPlacement({
      left: Math.max(margin, Math.min(left, window.innerWidth - bounds.width - margin)),
      top: Math.max(margin, Math.min(top, window.innerHeight - bounds.height - margin)),
    });
  }, [message.text, message.tool?.result, position]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const tool = message.tool;
  const title = message.role === "thinking" ? texts.thinkingTitle : texts.toolTitle;

  return createPortal(
    <>
      <div className="qsl-popover-backdrop" onClick={onClose} />
      <div
        aria-label={title}
        className="qsl-popover"
        ref={popover}
        role="dialog"
        style={{
          left: placement?.left ?? position.x,
          top: placement?.top ?? position.y,
          visibility: placement ? "visible" : "hidden",
        }}
      >
        <div className="qsl-popover__head">
          {message.role === "thinking" ? (
            <IconSpark className="qsl-popover__icon" />
          ) : (
            <IconTool className={tool?.isError ? "qsl-popover__icon qsl-popover__icon--error" : "qsl-popover__icon"} />
          )}
          <span className="qsl-popover__title">{title}</span>
          <button aria-label={texts.close} className="qsl-popover__close" onClick={onClose} title={texts.close} type="button">
            <IconX />
          </button>
        </div>
        <div className="qsl-popover__body">
          {message.role === "thinking" ? (
            <div className="qsl-popover__thinking">{message.text}</div>
          ) : tool ? (
            <div className="qsl-popover__sections">
              <div className="qsl-popover__toolname">{message.text}</div>
              <PopoverSection label={texts.argumentsLabel} value={toolArgumentsText(tool)} />
              {tool.result === undefined ? (
                <div className="qsl-popover__running">{texts.toolStillRunning}</div>
              ) : (
                <PopoverSection error={tool.isError} label={texts.resultLabel} value={prettyJson(tool.result)} />
              )}
            </div>
          ) : null}
        </div>
      </div>
    </>,
    document.body,
  );
}

function PopoverSection({ label, value, error = false }: { label: string; value: string; error?: boolean }) {
  return (
    <section>
      <h3>{label}</h3>
      <pre className={error ? "qsl-popover__pre qsl-popover__pre--error" : "qsl-popover__pre"}>{value}</pre>
    </section>
  );
}
