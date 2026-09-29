import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import { cn } from "./ui/cn";
import { ChatSendContext, createChatSendScope } from "./ChatSendContext";
import { ChatActionDock } from "./ChatActionDock";
import { appearanceStyle, type ChatAppearance } from "./options";

/**
 * Verlauf mit ueberlagerter Eingabe. Der Rahmen misst die Eingabe selbst und
 * gibt dem Verlauf den noetigen Fussraum, damit kein Host Innenmasse setzen muss.
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
  /** Die Eingabe; sie liegt ueber dem Verlauf, nicht darunter. */
  composer?: ReactNode;
  className?: string;
  nodeRef?: Ref<HTMLDivElement>;
  maxWidth?: CSSProperties["maxWidth"];
  horizontalPadding?: CSSProperties["paddingInline"];
  appearance?: ChatAppearance;
  scrollOnSend?: boolean;
}) {
  const wurzel = useRef<HTMLDivElement>(null);
  const eingabe = useRef<HTMLDivElement>(null);
  const [dock, setDock] = useState<HTMLDivElement | null>(null);
  const hasComposer = composer !== undefined;
  const scrollOnSendRef = useRef(scrollOnSend);
  const [sendScope] = useState(() => createChatSendScope(scrollOnSendRef));
  useLayoutEffect(() => { scrollOnSendRef.current = scrollOnSend; }, [scrollOnSend]);

  useEffect(() => {
    const element = eingabe.current;
    const rahmen = wurzel.current;
    if (!element || !rahmen) {
      return;
    }
    const messen = () => {
      rahmen.style.setProperty("--qsl-composer-height", `${element.offsetHeight}px`);
      rahmen.style.setProperty("--qsl-panel-height", `${rahmen.offsetHeight}px`);
    };
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(element);
    beobachter.observe(rahmen);
    messen();
    return () => {
      beobachter.disconnect();
      rahmen.style.removeProperty("--qsl-composer-height");
      rahmen.style.removeProperty("--qsl-panel-height");
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
        wurzel.current = element;
        if (typeof nodeRef === "function") {
          nodeRef(element);
        } else if (nodeRef) {
          nodeRef.current = element;
        }
      }}
    >
      {children}
      {hasComposer && (
        <div className="qsl:absolute qsl:inset-x-0 qsl:bottom-0 qsl:z-[5] qsl:px-[var(--qsl-chat-horizontal-padding,24px)] qsl:pb-3.5 qsl:*:mx-auto qsl:*:max-w-[var(--qsl-chat-content-max-width,none)]" data-chat="composer" ref={eingabe}>
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
