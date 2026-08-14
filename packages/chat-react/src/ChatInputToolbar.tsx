import { KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";
import { ChatTexts, defaultTexts } from "./texts";
import { IconSend, IconStop } from "./icons";

// Unter dieser Panel-Breite klappen Beschriftungen mit .qsl-collapsible zu ihren Symbolen.
const COMPACT_WIDTH_PX = 480;

/**
 * Die Eingabe-Karte: rahmenlose Textarea oben, Toolbar unter einer Haarlinie. Links und
 * rechts nehmen eigene Knöpfe auf; der Senden-Knopf morpht im Lauf zu Stop, und Tippen
 * während des Laufs wird zum Dazwischenfunken.
 */
export function ChatInputToolbar({
  onSend,
  onStop,
  running = false,
  disabled = false,
  toolbarLeft,
  toolbarRight,
  texts,
}: {
  onSend: (text: string) => void;
  onStop?: () => void;
  running?: boolean;
  disabled?: boolean;
  toolbarLeft?: ReactNode;
  toolbarRight?: ReactNode;
  texts?: Partial<ChatTexts>;
}) {
  const alleTexte = { ...defaultTexts, ...texts };
  const [draft, setDraft] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  // Panel-Breite statt Viewport-Breite: die Chat-Spalte kann im Host beliebig schmal sein.
  useEffect(() => {
    const element = rootRef.current;
    if (!element) {
      return;
    }
    const update = () => setCompact(element.clientWidth < COMPACT_WIDTH_PX);
    update();
    const beobachter = new ResizeObserver(update);
    beobachter.observe(element);
    return () => beobachter.disconnect();
  }, []);

  const hatText = draft.trim().length > 0;

  const send = () => {
    const text = draft.trim();
    if (!text || disabled) {
      return;
    }
    setDraft("");
    onSend(text);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <div className={compact ? "qsl-input-card qsl-input-card--compact" : "qsl-input-card"} ref={rootRef}>
      <textarea
        aria-label={alleTexte.placeholder}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={running ? alleTexte.steeringPlaceholder : alleTexte.placeholder}
        rows={3}
        value={draft}
      />
      <div className="qsl-input-card__toolbar">
        <div className="qsl-input-card__left">{toolbarLeft}</div>
        <div className="qsl-input-card__right">
          {toolbarRight}
          {running && !hatText && onStop ? (
            <button aria-label={alleTexte.stop} className="qsl-send qsl-send--stop" onClick={onStop} title={alleTexte.stop} type="button">
              <IconStop />
            </button>
          ) : (
            <button
              aria-label={alleTexte.send}
              className="qsl-send"
              disabled={disabled || !hatText}
              onClick={send}
              title={running ? alleTexte.sendIntoRun : alleTexte.send}
              type="button"
            >
              <IconSend />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
