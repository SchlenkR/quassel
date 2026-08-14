import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { ChatTexts, defaultTexts } from "./texts";
import { IconSend, IconStop } from "./icons";

/** Die schlichte Eingabe: Textzeile plus Senden, sonst nichts. Stop erscheint nur im Lauf. */
export function ChatInputPlain({
  onSend,
  onStop,
  running = false,
  disabled = false,
  showHint = true,
  texts,
}: {
  onSend: (text: string) => void;
  onStop?: () => void;
  running?: boolean;
  disabled?: boolean;
  showHint?: boolean;
  texts?: Partial<ChatTexts>;
}) {
  const alleTexte = { ...defaultTexts, ...texts };
  const [draft, setDraft] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!textarea.current) {
      return;
    }
    textarea.current.style.height = "0";
    textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 190)}px`;
  }, [draft]);

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
    <div className="qsl-input-plain-wrap">
      <form
        className="qsl-input-plain"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <textarea
          aria-label={alleTexte.placeholder}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={running ? alleTexte.steeringPlaceholder : alleTexte.placeholder}
          ref={textarea}
          rows={1}
          value={draft}
        />
        {running && onStop && (
          <button aria-label={alleTexte.stop} className="qsl-input-plain__stop" onClick={onStop} title={alleTexte.stop} type="button">
            <IconStop />
          </button>
        )}
        <button
          aria-label={alleTexte.send}
          className="qsl-input-plain__send"
          disabled={disabled || !draft.trim()}
          title={running ? alleTexte.sendIntoRun : alleTexte.send}
          type="submit"
        >
          <IconSend />
        </button>
      </form>
      {showHint && <p className="qsl-input-hint">{alleTexte.inputHint}</p>}
    </div>
  );
}
