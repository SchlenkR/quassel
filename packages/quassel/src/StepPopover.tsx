import { useMemo, type CSSProperties, type MouseEvent } from "react";
import { SparklesIcon, WrenchIcon, XIcon } from "lucide-react";
import { cn } from "./ui/cn";
import { useQuasselComponents, useQuasselPortalContainer } from "./QuasselProvider";
import { Message, prettyJson } from "./types";
import { ChatTexts } from "./texts";

export type StepPopoverOrigin = { x: number; y: number; base: string };

export const stepPopoverOrigin = (event: MouseEvent<HTMLElement>): StepPopoverOrigin => ({
  x: event.clientX,
  y: event.clientY,
  base: getComputedStyle(event.currentTarget).getPropertyValue("--qsl-base"),
});

const preClasses = "qsl:rounded-lg qsl:bg-secondary qsl:p-3 qsl:font-mono qsl:text-small qsl:break-all qsl:whitespace-pre-wrap";

export function StepPopover({
  message,
  position,
  texts,
  toolArgumentsText,
  onClose,
}: {
  message: Message;
  position: StepPopoverOrigin;
  texts: ChatTexts;
  toolArgumentsText: (tool: NonNullable<Message["tool"]>) => string;
  onClose: () => void;
}) {
  const anchor = useMemo(() => ({
    getBoundingClientRect: () => new DOMRect(
      Math.max(16, Math.min(position.x, window.innerWidth - 16)),
      Math.max(16, Math.min(position.y, window.innerHeight - 16)),
      0,
      0,
    ),
    contextElement: document.documentElement,
  }), [position]);
  const { Button, Popover, PopoverContent } = useQuasselComponents();
  const portalContainer = useQuasselPortalContainer();
  const tool = message.tool;
  const thinking = message.role === "thinking";
  const title = thinking ? texts.thinkingTitle : texts.toolTitle;

  return (
    <Popover open onOpenChange={(open) => { if (!open) onClose(); }}>
      <PopoverContent
        align="start"
        anchor={anchor}
        aria-label={title}
        className={cn(
          "qsl:w-[min(680px,calc(100vw-32px))] qsl:gap-0 qsl:overflow-hidden qsl:p-0 qsl:text-body qsl:shadow-pop",
          "qsl:max-h-[min(70dvh,620px,var(--available-height))]",
        )}
        collisionPadding={16}
        portalContainer={portalContainer}
        side="bottom"
        sideOffset={10}
        style={{ "--qsl-base": position.base || undefined } as CSSProperties}
      >
        <div className="qsl:flex qsl:flex-none qsl:items-center qsl:gap-2 qsl:border-b qsl:border-border-soft qsl:px-4 qsl:py-2.5">
          {thinking ? (
            <SparklesIcon className="qsl:text-muted-foreground" size={14} />
          ) : (
            <WrenchIcon className={tool?.isError ? "qsl:text-destructive" : "qsl:text-muted-foreground"} size={14} />
          )}
          <span className="qsl:min-w-0 qsl:flex-1 qsl:overflow-hidden qsl:text-ellipsis qsl:whitespace-nowrap qsl:font-medium">{title}</span>
          <Button aria-label={texts.close} className="qsl:flex-none" onClick={onClose} size="icon-sm" title={texts.close} variant="ghost">
            <XIcon />
          </Button>
        </div>
        <div className="qsl:min-h-0 qsl:flex-1 qsl:overflow-auto qsl:overscroll-contain qsl:p-4">
          {thinking ? (
            <div className="qsl:text-small qsl:whitespace-pre-wrap">{message.text}</div>
          ) : tool ? (
            <div className="qsl:flex qsl:flex-col qsl:gap-4">
              <div className="qsl:font-mono qsl:text-small">{message.text}</div>
              <PopoverSection label={texts.argumentsLabel} value={toolArgumentsText(tool)} />
              {tool.result === undefined ? (
                <div className="qsl:text-small qsl:text-muted-foreground">{texts.toolStillRunning}</div>
              ) : (
                <PopoverSection error={tool.isError} label={texts.resultLabel} value={prettyJson(tool.result)} />
              )}
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PopoverSection({ label, value, error = false }: { label: string; value: string; error?: boolean }) {
  return (
    <section>
      <h3 className="qsl:mb-1.5 qsl:text-small qsl:font-semibold qsl:tracking-[0.04em] qsl:text-muted-foreground qsl:uppercase">{label}</h3>
      <pre className={cn(preClasses, error && "qsl:text-destructive")}>{value}</pre>
    </section>
  );
}
