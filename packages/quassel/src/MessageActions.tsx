import { CheckIcon, ClipboardTypeIcon, CopyIcon, PencilIcon, RotateCcwIcon } from "lucide-react";
import { type RefObject, useState } from "react";
import { cn } from "./ui/cn";
import { useQuasselComponents } from "./QuasselProvider";
import type { MessageActionsOptions, MessageAction } from "./options";
import { defaultTexts, type ChatTexts } from "./texts";
import type { Message } from "./types";
import { copyChatHtml, copyChatText, useChatAction } from "./useChatAction";

const actionClasses = cn(
  "qsl:mt-0.5 qsl:flex qsl:h-5 qsl:items-center qsl:gap-0.5 qsl:text-muted-foreground qsl:opacity-0 qsl:transition-opacity",
  "qsl:pointer-events-none qsl:group-hover/message:pointer-events-auto qsl:focus-within:pointer-events-auto",
  "qsl:[@media(hover:none)]:pointer-events-auto",
);
const visibleClasses = "qsl:group-hover/message:opacity-100 qsl:focus-within:opacity-100 qsl:[@media(hover:none)]:opacity-100";
const lightClasses = "qsl:group-hover/message:opacity-70 qsl:focus-within:opacity-70 qsl:[@media(hover:none)]:opacity-70";

export function MessageActions({ message, options, texts, contentRef, side = message.role === "user" ? "end" : "start" }: {
  message: Message;
  options?: MessageActionsOptions;
  texts: ChatTexts;
  contentRef?: RefObject<HTMLElement | null>;
  side?: "start" | "end";
}) {
  const action = useChatAction();
  const { Button } = useQuasselComponents();
  const [lastAction, setLastAction] = useState<string>();
  const enabled = (option: MessageActionsOptions["copy"], fallback: boolean) => typeof option === "function" ? option(message) : option ?? fallback;
  const copy = enabled(options?.copy, message.role === "user" || message.role === "assistant") && !!message.text.trim();
  const copyFormatted = copy && !!contentRef && enabled(options?.copyFormatted, message.role === "assistant");
  const actions: MessageAction[] = [
    ...(copy ? [{ id: "copy", label: texts.copyMessage, icon: <CopyIcon />, onClick: () => copyChatText(message.text, texts.clipboardUnavailable) }] : []),
    ...(copyFormatted ? [{ id: "copy-formatted", label: texts.copyFormatted ?? defaultTexts.copyFormatted!, icon: <ClipboardTypeIcon />,
      onClick: () => contentRef.current ? copyChatHtml(contentRef.current, message.text, texts.clipboardUnavailable) : copyChatText(message.text, texts.clipboardUnavailable) }] : []),
    ...(options?.edit && message.role === "user" ? [{ id: "edit", label: texts.editMessage, icon: <PencilIcon />, onClick: options.edit }] : []),
    ...(options?.retry && message.role === "assistant" ? [{ id: "retry", label: texts.retryMessage, icon: <RotateCcwIcon />, onClick: options.retry }] : []),
    ...options?.custom?.(message) ?? [],
  ];
  return <>
    {actions.length > 0 && <div className={cn(actionClasses, message.role === "user" ? visibleClasses : lightClasses, side === "end" && "qsl:justify-end")} data-chat="message-actions">
      {actions.map((item) => {
        const copied = ["copy", "copy-formatted"].includes(item.id) && lastAction === item.id && action.status === "done";
        const label = copied ? texts.copied : item.label;
        return <Button aria-label={label} className={cn("qsl:text-inherit", item.icon && "qsl:size-5")} disabled={item.disabled || action.status === "pending"}
          key={item.id} size={item.icon ? "icon-xs" : "xs"} title={label} variant="ghost"
          onClick={() => {
            setLastAction(item.id);
            void action.invoke(() => item.onClick(message), texts.actionFailed);
          }}>{copied ? <CheckIcon /> : item.icon ?? item.label}</Button>;
      })}
    </div>}
    {action.error && <p className="qsl:mt-2 qsl:text-small qsl:text-destructive" role="alert">{action.error}</p>}
  </>;
}
