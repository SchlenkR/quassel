import { createContext, useContext, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { SendShortcut } from "./options";

export const ChatSendContext = createContext<{
  onSent: () => void;
  registerJump: (jump: () => void) => () => void;
} | undefined>(undefined);

export function isSendKey(event: KeyboardEvent<HTMLTextAreaElement>, shortcut: SendShortcut): boolean {
  return event.key === "Enter" && !event.shiftKey && !event.altKey
    && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229
    && (shortcut === "enter" || event.ctrlKey || event.metaKey);
}

export function useChatSubmit(onSend: (text: string) => void | Promise<void>) {
  const panel = useContext(ChatSendContext);
  const pending = useRef(false);
  const mounted = useRef(true);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const submit = async (text: string): Promise<boolean> => {
    if (pending.current) return false;
    pending.current = true;
    setSending(true);
    setError(undefined);
    try {
      await onSend(text);
      if (!mounted.current) return false;
      panel?.onSent();
      return true;
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : String(failure));
      return false;
    } finally {
      pending.current = false;
      if (mounted.current) setSending(false);
    }
  };
  return { submit, sending, error };
}
