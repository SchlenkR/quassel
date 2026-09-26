import { CheckIcon, CopyIcon, PencilIcon, RotateCcwIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "./ui/cn";
import { useQuasselComponents } from "./QuasselProvider";
import type { MessageActionsOptions, MessageAction } from "./options";
import type { ChatTexts } from "./texts";
import type { Message } from "./types";
import { copyChatText, useChatAction } from "./useChatAction";

const actionClasses = cn(
  "qsl:absolute qsl:top-1 qsl:right-1 qsl:z-[1] qsl:flex qsl:flex-wrap qsl:rounded-sm qsl:bg-secondary qsl:opacity-0",
  "qsl:shadow-[0_2px_6px_color-mix(in_srgb,var(--qsl-foreground)_15%,transparent)]",
  "qsl:pointer-events-none qsl:group-hover:pointer-events-auto qsl:group-hover:opacity-100 qsl:focus-within:pointer-events-auto qsl:focus-within:opacity-100",
  "qsl:[@media(hover:none)]:pointer-events-auto qsl:[@media(hover:none)]:opacity-100",
);

export function MessageActions({ message, options, texts }: { message: Message; options?: MessageActionsOptions; texts: ChatTexts }) {
  const action = useChatAction();
  const { Button } = useQuasselComponents();
  const [lastAction, setLastAction] = useState<string>();
  const copy = typeof options?.copy === "function" ? options.copy(message) : options?.copy ?? message.role === "user";
  const actions: MessageAction[] = [
    ...(copy && message.text.trim() ? [{ id: "copy", label: texts.copyMessage, icon: <CopyIcon />, onClick: () => copyChatText(message.text, texts.clipboardUnavailable) }] : []),
    ...(options?.edit && message.role === "user" ? [{ id: "edit", label: texts.editMessage, icon: <PencilIcon />, onClick: options.edit }] : []),
    ...(options?.retry && message.role === "assistant" ? [{ id: "retry", label: texts.retryMessage, icon: <RotateCcwIcon />, onClick: options.retry }] : []),
    ...options?.custom?.(message) ?? [],
  ];
  return <>
    {actions.length > 0 && <div className={actionClasses}>
      {actions.map((item) => {
        const copied = item.id === "copy" && lastAction === item.id && action.status === "done";
        const label = copied ? texts.copied : item.label;
        return <Button aria-label={label} className="qsl:text-inherit" disabled={item.disabled || action.status === "pending"}
          key={item.id} size={item.icon ? "icon-sm" : "sm"} title={label} variant="ghost"
          onClick={() => {
            setLastAction(item.id);
            void action.invoke(() => item.onClick(message), texts.actionFailed);
          }}>{copied ? <CheckIcon /> : item.icon ?? item.label}</Button>;
      })}
    </div>}
    {action.error && <p className="qsl:mt-2 qsl:text-sm qsl:text-destructive" role="alert">{action.error}</p>}
  </>;
}
