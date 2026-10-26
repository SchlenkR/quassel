import { markdownPlainText } from "./Markdown";
import { useEffect, useRef, useState } from "react";

export function useChatAction() {
  const pending = useRef(false);
  const [status, setStatus] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (status !== "done") return;
    const timer = window.setTimeout(() => setStatus("idle"), 1800);
    return () => window.clearTimeout(timer);
  }, [status]);
  const invoke = async (action: () => void | Promise<void>, failureLabel: string) => {
    if (pending.current) return;
    pending.current = true;
    setError(undefined);
    setStatus("pending");
    try {
      await action();
      setStatus("done");
    } catch (failure) {
      const detail = failure instanceof Error ? failure.message : String(failure);
      setError(`${failureLabel}: ${detail}`);
      setStatus("idle");
    } finally {
      pending.current = false;
    }
  };
  return { status, error, invoke };
}

export async function copyChatText(text: string, unavailable: string) {
  if (!navigator.clipboard) throw new Error(unavailable);
  await navigator.clipboard.writeText(text);
}

export async function copyChatHtml(element: HTMLElement, text: string, unavailable: string) {
  if (!navigator.clipboard) throw new Error(unavailable);
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard.write) return navigator.clipboard.writeText(text);
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("button").forEach((button) => button.remove());
  clone.querySelectorAll("[class]").forEach((node) => node.removeAttribute("class"));
  const blob = (content: string, type: string) => new Blob([content], { type });
  await navigator.clipboard.write([new ClipboardItem({ "text/html": blob(clone.innerHTML, "text/html"), "text/plain": blob(markdownPlainText(text), "text/plain") })]);
}
