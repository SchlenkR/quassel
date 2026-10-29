import { LoaderCircleIcon, MicIcon, SendIcon, SquareIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import type { ChatMicrophone, MicrophonePress } from "./options";
import type { ChatTexts } from "./texts";
import { RecordingAura } from "./RecordingAura";

type PrimaryState = "microphone" | "send" | "stop" | Exclude<ChatMicrophone["state"], "idle">;
type Press = { source: MicrophonePress["source"]; key?: string; pointerId?: number; microphone: ChatMicrophone };

export function ComposerPrimaryAction({ hasContent, running, sending, disabled, sendDisabled, microphone, texts, onSend, onStop }: {
  hasContent: boolean;
  running: boolean;
  sending: boolean;
  disabled: boolean;
  sendDisabled: boolean;
  microphone?: ChatMicrophone;
  texts: Required<ChatTexts>;
  onSend: () => void;
  onStop?: () => void;
}) {
  const state: PrimaryState = microphone && microphone.state !== "idle" ? microphone.state
    : hasContent ? "send" : running ? "stop" : microphone && !sending ? "microphone" : "send";
  const voice = state === "microphone" || state === "preparing" || state === "recording";
  const busy = state === "preparing" || state === "transcribing";
  const blocked = disabled || state === "transcribing" || (state === "send" && (sendDisabled || sending || !hasContent)) || (state === "stop" && !onStop);
  const label = state === "microphone" ? microphone?.label ?? texts.microphone
    : state === "preparing" ? texts.microphonePreparing : state === "recording" ? texts.microphoneRecording
    : state === "transcribing" ? texts.microphoneTranscribing : state === "stop" ? texts.stop : running ? texts.sendIntoRun : texts.send;
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const press = useRef<Press | null>(null);
  const suppressClick = useRef(false);
  const clickReset = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const currentMicrophone = useRef(microphone);

  const resetClick = () => {
    clearTimeout(clickReset.current);
    clickReset.current = setTimeout(() => { suppressClick.current = false; }, 0);
  };

  const cancel = () => {
    const active = press.current;
    press.current = null;
    if (active) resetClick();
    const current = currentMicrophone.current;
    if (active) active.microphone.onCancel();
    else if (current?.state === "recording" || current?.state === "preparing") current.onCancel();
  };
  useLayoutEffect(() => { currentMicrophone.current = microphone; }, [microphone]);
  useEffect(() => { if (disabled) cancel(); }, [disabled]);
  useEffect(() => {
    if (!button) return;
    const document = button.ownerDocument;
    const view = document.defaultView!;
    const onVisibility = () => { if (document.hidden) cancel(); };
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && (press.current || currentMicrophone.current?.state === "recording" || currentMicrophone.current?.state === "preparing")) {
        event.preventDefault();
        cancel();
      }
    };
    view.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("keydown", onEscape);
    return () => {
      view.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("keydown", onEscape);
      cancel();
      clearTimeout(clickReset.current);
    };
  }, [button]);

  const start = (source: MicrophonePress["source"], timeStamp: number, pointerId?: number, key?: string) => {
    if (!voice || state === "preparing" || blocked || !microphone || press.current) return;
    press.current = { source, pointerId, key, microphone };
    clearTimeout(clickReset.current);
    suppressClick.current = true;
    microphone.onPressStart({ source, timeStamp });
  };
  const end = (timeStamp: number) => {
    const active = press.current;
    press.current = null;
    resetClick();
    active?.microphone.onPressEnd({ source: active.source, timeStamp });
  };
  const activationKey = (event: KeyboardEvent) => (event.key === " " || event.key === "Enter")
    && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229;

  return <>
    {state === "recording" && button && <RecordingAura anchor={button} level={microphone?.level} />}
    <button
      aria-busy={busy || undefined}
      aria-label={label}
      aria-pressed={voice ? state === "recording" : undefined}
      className="qsl:primary-action"
      data-primary-action={state}
      disabled={blocked}
      onBlur={() => { if (press.current?.source === "keyboard") cancel(); }}
      onClick={(event) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        if (voice && event.detail === 0) {
          start("virtual", event.timeStamp);
          end(event.timeStamp);
          suppressClick.current = false;
        } else if (state === "send") onSend();
        else if (state === "stop") onStop?.();
      }}
      onContextMenu={(event) => { if (voice) event.preventDefault(); }}
      onKeyDown={(event) => {
        if (activationKey(event) && event.repeat) {
          event.preventDefault();
          return;
        }
        if (!voice) {
          suppressClick.current = false;
          return;
        }
        if (activationKey(event)) {
          event.preventDefault();
          start("keyboard", event.timeStamp, undefined, event.key);
        }
      }}
      onKeyUp={(event) => {
        if (activationKey(event) && (voice || press.current?.source === "keyboard")) {
          event.preventDefault();
          if (press.current?.source === "keyboard" && press.current.key === event.key) end(event.timeStamp);
        }
      }}
      onLostPointerCapture={(event) => { if (press.current?.pointerId === event.pointerId) cancel(); }}
      onPointerCancel={(event) => { if (press.current?.pointerId === event.pointerId) cancel(); }}
      onPointerDown={(event) => {
        suppressClick.current = false;
        if (event.button !== 0 || event.isPrimary === false) return;
        start("pointer", event.timeStamp, event.pointerId);
        if (press.current?.pointerId === event.pointerId) event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerUp={(event) => { if (press.current?.source === "pointer" && press.current.pointerId === event.pointerId) end(event.timeStamp); }}
      ref={setButton}
      title={state === "microphone" ? texts.microphoneHint : label}
      type="button"
    >
      <span aria-hidden="true" className="qsl:primary-icon" data-active={state === "microphone" || state === "recording"}><MicIcon /></span>
      <span aria-hidden="true" className="qsl:primary-icon" data-active={state === "send"}><SendIcon /></span>
      <span aria-hidden="true" className="qsl:primary-icon" data-active={state === "stop"}><SquareIcon fill="currentColor" /></span>
      <span aria-hidden="true" className="qsl:primary-icon" data-active={busy}><LoaderCircleIcon className="qsl:motion-safe:animate-spin" /></span>
      {state === "recording" && <span aria-hidden="true" className="qsl:recording-dot" />}
    </button>
  </>;
}
