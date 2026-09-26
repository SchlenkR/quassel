import { KeyboardEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ChatTexts, defaultTexts } from "./texts";
import { isSendKey, useChatSubmit } from "./ChatSendContext";
import type { SendShortcut } from "./options";
import { IconSend, IconStop } from "./icons";

// Unter dieser Panel-Breite klappen Beschriftungen mit .qsl-collapsible zu ihren Symbolen.
const COMPACT_WIDTH_PX = 480;

/** Ein Toolbar-Knopf, deklarativ: Symbol, Text oder beides - plus Klick-Handler. */
export interface ToolbarAction {
  icon?: ReactNode;
  label?: string;
  title?: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
}

/**
 * Die Eingabe-Karte: rahmenlose Textarea oben, Toolbar unter einer Haarlinie. Eigene
 * Knöpfe kommen deklarativ über `actions` oder frei über die Slots links/rechts; im Lauf
 * bleibt der Stop-Knopf sichtbar, und Tippen zeigt daneben den Senden-Knopf, der zum
 * Dazwischenfunken wird. `rows` bestimmt die Starthöhe; mit `maxRows` wächst die Textarea
 * mit dem Inhalt bis zu dieser Zeilenzahl und scrollt danach.
 */
export function ChatInputToolbar({
  onSend,
  onStop,
  running = false,
  disabled = false,
  rows = 3,
  maxRows,
  actions,
  toolbarLeft,
  toolbarRight,
  texts,
  sendShortcut = "enter",
}: {
  onSend: (text: string) => void | Promise<void>;
  onStop?: () => void;
  running?: boolean;
  disabled?: boolean;
  rows?: number;
  maxRows?: number;
  actions?: ToolbarAction[];
  toolbarLeft?: ReactNode;
  toolbarRight?: ReactNode;
  texts?: Partial<ChatTexts>;
  sendShortcut?: SendShortcut;
}) {
  const alleTexte = { ...defaultTexts, ...texts };
  const [draft, setDraft] = useState("");
  const { submit, sending, error } = useChatSubmit(onSend);
  const rootRef = useRef<HTMLDivElement>(null);
  const eingabeRef = useRef<HTMLTextAreaElement>(null);
  const [compact, setCompact] = useState(false);

  // Auto-Wachstum: Hoehe folgt dem Inhalt zwischen rows und maxRows, danach scrollt die Textarea.
  const applyAutoGrow = useCallback(() => {
    const element = eingabeRef.current;
    if (!element || maxRows === undefined) {
      return;
    }
    const stil = getComputedStyle(element);
    const zeilenhoehe = Number.parseFloat(stil.lineHeight) || Number.parseFloat(stil.fontSize) * 1.4;
    const polster = Number.parseFloat(stil.paddingTop) + Number.parseFloat(stil.paddingBottom);
    const maximum = zeilenhoehe * Math.max(maxRows, rows) + polster;
    element.style.height = "auto";
    const inhalt = element.scrollHeight;
    element.style.height = `${Math.min(inhalt, maximum)}px`;
    element.style.overflowY = inhalt > maximum ? "auto" : "hidden";
  }, [maxRows, rows]);

  useEffect(() => {
    applyAutoGrow();
  }, [draft, applyAutoGrow]);

  // Hosts may lay the composer out a frame later; re-measure once the width settles.
  useEffect(() => {
    const element = eingabeRef.current;
    if (!element || maxRows === undefined) {
      return;
    }
    let lastWidth = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth !== lastWidth) {
        lastWidth = element.clientWidth;
        applyAutoGrow();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [maxRows, applyAutoGrow]);

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

  const send = async () => {
    const text = draft.trim();
    if (!text || disabled || sending) {
      return;
    }
    if (await submit(text)) setDraft(current => current === draft ? "" : current);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSendKey(event, sendShortcut)) {
      event.preventDefault();
      if (!event.repeat) void send();
    }
  };

  return (
    <div className={compact ? "qsl-input-card qsl-input-card--compact" : "qsl-input-card"} ref={rootRef}>
      {error && <p className="qsl-action-error" role="alert">{error}</p>}
      <textarea
        aria-label={alleTexte.placeholder}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={running ? alleTexte.steeringPlaceholder : alleTexte.placeholder}
        ref={eingabeRef}
        rows={rows}
        value={draft}
      />
      <div className="qsl-input-card__toolbar">
        <div className="qsl-input-card__left">
          {actions?.map((action, index) => (
            <button
              className={action.active ? "qsl-icon-button qsl-icon-button--active" : "qsl-icon-button"}
              disabled={action.disabled}
              key={index}
              onClick={action.onClick}
              title={action.title ?? action.label}
              type="button"
            >
              {action.icon}
              {action.label && <span className={action.icon ? "qsl-collapsible" : undefined}>{action.label}</span>}
            </button>
          ))}
          {toolbarLeft}
        </div>
        <div className="qsl-input-card__right">
          {toolbarRight}
          {running && onStop && (
            <button aria-label={alleTexte.stop} className="qsl-send qsl-send--stop" onClick={onStop} title={alleTexte.stop} type="button">
              <IconStop />
            </button>
          )}
          {(!running || !onStop || hatText) && (
            <button
              aria-label={alleTexte.send}
              className="qsl-send"
              disabled={disabled || sending || !hatText}
              onClick={() => void send()}
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
