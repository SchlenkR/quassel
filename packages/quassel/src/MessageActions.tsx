import { useEffect, useRef, useState, type ReactNode } from "react";
import type { MessageActionsOptions } from "./options";
import type { ChatTexts } from "./texts";
import type { Message } from "./types";

export function ActionButton({ label, icon, disabled, onClick, successLabel }: {
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  onClick: () => void | Promise<void>;
  successLabel?: string;
}) {
  const pending = useRef(false);
  const [status, setStatus] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (status !== "done") return;
    const timer = window.setTimeout(() => setStatus("idle"), 1800);
    return () => window.clearTimeout(timer);
  }, [status]);
  const run = async () => {
    if (pending.current) return;
    pending.current = true;
    setStatus("pending");
    setError(undefined);
    try {
      await onClick();
      setStatus("done");
    } catch (failure) {
      setStatus("idle");
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      pending.current = false;
    }
  };
  return <>
    <button className="qsl-icon-button" type="button" disabled={disabled || status === "pending"} onClick={() => void run()}>
      {icon}{status === "done" && successLabel ? successLabel : label}
    </button>
    {error && <span className="qsl-action-error" role="alert">{error}</span>}
  </>;
}

export async function copyText(text: string, error: string) {
  if (!navigator.clipboard) throw new Error(error);
  await navigator.clipboard.writeText(text);
}

export function MessageActions({ message, options, texts }: { message: Message; options?: MessageActionsOptions; texts: ChatTexts }) {
  if (!options) return null;
  const copy = typeof options.copy === "function" ? options.copy(message) : options.copy;
  const edit = message.role === "user" ? options.edit : undefined;
  const retry = message.role === "assistant" ? options.retry : undefined;
  const custom = options.custom?.(message) ?? [];
  if (!copy && !edit && !retry && custom.length === 0) return null;
  return <div className="qsl-message-actions" role="group" aria-label={texts.messageActions}>
    {copy && <ActionButton label={texts.copyMessage} successLabel={texts.copied} onClick={() => copyText(message.text, texts.copyFailed)} />}
    {edit && <ActionButton label={texts.editMessage} onClick={() => edit(message)} />}
    {retry && <ActionButton label={texts.retryMessage} onClick={() => retry(message)} />}
    {custom.map(action => <ActionButton key={action.id} label={action.label} icon={action.icon} disabled={action.disabled} onClick={() => action.onClick(message)} />)}
  </div>;
}
