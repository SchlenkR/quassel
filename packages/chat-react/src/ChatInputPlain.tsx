import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { ChatTexts, defaultTexts } from "./texts";
import { isSendKey, useChatSubmit } from "./ChatSendContext";
import type { SendShortcut } from "./options";
import { IconSend, IconStop } from "./icons";

/** Die schlichte Eingabe: Textzeile plus Senden, sonst nichts. Stop erscheint nur im Lauf. */
export function ChatInputPlain({
  onSend,
  onStop,
  running = false,
  disabled = false,
  showHint = true,
  texts,
  sendShortcut = "enter",
}: {
  onSend: (text: string) => void | Promise<void>;
  onStop?: () => void;
  running?: boolean;
  disabled?: boolean;
  showHint?: boolean;
  texts?: Partial<ChatTexts>;
  sendShortcut?: SendShortcut;
}) {
  const alleTexte = { ...defaultTexts, ...texts };
  const [draft, setDraft] = useState("");
  const { submit, sending, error } = useChatSubmit(onSend);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!textarea.current) {
      return;
    }
    textarea.current.style.height = "0";
    textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 190)}px`;
  }, [draft]);

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
    <div className="qsl-input-plain-wrap">
      {error && <p className="qsl-action-error" role="alert">{error}</p>}
      <form
        className="qsl-input-plain"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
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
          disabled={disabled || sending || !draft.trim()}
          title={running ? alleTexte.sendIntoRun : alleTexte.send}
          type="submit"
        >
          <IconSend />
        </button>
      </form>
      {showHint && <p className="qsl-input-hint">{texts?.inputHint ?? (sendShortcut === "mod-enter" ? alleTexte.inputHintModEnter : alleTexte.inputHint)}</p>}
    </div>
  );
}
