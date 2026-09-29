import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import { cn } from "./ui/cn";
import { ChatSendContext, createChatSendScope } from "./ChatSendContext";
import { ChatActionDock } from "./ChatActionDock";
import { appearanceStyle, type ChatAppearance } from "./options";

/**
 * Transcript with an overlaid composer. The frame measures the composer itself and gives the
 * transcript the footer space it needs, so no host has to set inner dimensions.
 */
export function ChatPanel({
  children,
  composer,
  className,
  nodeRef,
  maxWidth,
  horizontalPadding,
  appearance,
  scrollOnSend = false,
}: {
  children: ReactNode;
  /** The composer; it lies over the transcript, not below it. */
  composer?: ReactNode;
  className?: string;
  nodeRef?: Ref<HTMLDivElement>;
  maxWidth?: CSSProperties["maxWidth"];
  horizontalPadding?: CSSProperties["paddingInline"];
  appearance?: ChatAppearance;
  scrollOnSend?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const [dock, setDock] = useState<HTMLDivElement | null>(null);
  const hasComposer = composer !== undefined;
  const scrollOnSendRef = useRef(scrollOnSend);
  const [sendScope] = useState(() => createChatSendScope(scrollOnSendRef));
  useLayoutEffect(() => { scrollOnSendRef.current = scrollOnSend; }, [scrollOnSend]);

  useEffect(() => {
    const element = composerRef.current;
    const frame = root.current;
    if (!element || !frame) {
      return;
    }
    const measure = () => {
      frame.style.setProperty("--qsl-composer-height", `${element.offsetHeight}px`);
      frame.style.setProperty("--qsl-panel-height", `${frame.offsetHeight}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(frame);
    measure();
    return () => {
      observer.disconnect();
      frame.style.removeProperty("--qsl-composer-height");
      frame.style.removeProperty("--qsl-panel-height");
    };
  }, [hasComposer]);

  return (
    <ChatSendContext.Provider value={sendScope}>
    <ChatActionDock.Provider value={hasComposer ? dock : undefined}>
    <div
      className={cn("qsl:relative qsl:flex qsl:min-h-0 qsl:min-w-0 qsl:flex-col qsl:overflow-hidden", className)}
      data-chat="panel"
      data-quassel=""
      style={{
        ...appearanceStyle(appearance),
        "--qsl-chat-content-max-width": typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth,
        "--qsl-chat-horizontal-padding": typeof horizontalPadding === "number" ? `${horizontalPadding}px` : horizontalPadding,
      } as CSSProperties}
      ref={(element) => {
        root.current = element;
        if (typeof nodeRef === "function") {
          nodeRef(element);
        } else if (nodeRef) {
          nodeRef.current = element;
        }
      }}
    >
      {children}
      {hasComposer && (
        <div className="qsl:absolute qsl:inset-x-0 qsl:bottom-0 qsl:z-[5] qsl:px-[var(--qsl-chat-horizontal-padding,24px)] qsl:pb-3.5 qsl:*:mx-auto qsl:*:max-w-[var(--qsl-chat-content-max-width,none)]" data-chat="composer" ref={composerRef}>
          <div>
            <div
              className="qsl:-mx-[16px] qsl:max-h-[calc(var(--qsl-panel-height,100dvh)_/_2)] qsl:overflow-y-auto qsl:px-[16px] qsl:pb-[var(--qsl-chat-message-gap,16px)] qsl:[-webkit-mask-image:linear-gradient(to_bottom,#000_calc(100%_-_var(--qsl-chat-message-gap,16px)),transparent)] qsl:[mask-image:linear-gradient(to_bottom,#000_calc(100%_-_var(--qsl-chat-message-gap,16px)),transparent)] qsl:empty:hidden"
              data-chat="actions"
              ref={setDock}
            />
          </div>
          {composer}
        </div>
      )}
    </div>
    </ChatActionDock.Provider>
    </ChatSendContext.Provider>
  );
}
