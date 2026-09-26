import { useLayoutEffect, useMemo, useRef, type ReactNode, type Ref } from "react";
import { ChatSendContext } from "./ChatSendContext";
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
  appearance,
  scrollOnSend = false,
}: {
  children: ReactNode;
  /** Die Eingabe; sie liegt ueber dem Verlauf, nicht darunter. */
  composer?: ReactNode;
  className?: string;
  nodeRef?: Ref<HTMLDivElement>;
  appearance?: ChatAppearance;
  scrollOnSend?: boolean;
}) {
  const jump = useRef<(() => void) | undefined>(undefined);
  const scrollOnSendRef = useRef(scrollOnSend);
  useLayoutEffect(() => { scrollOnSendRef.current = scrollOnSend; }, [scrollOnSend]);
  const sendContext = useMemo(() => ({
    onSent: () => { if (scrollOnSendRef.current) jump.current?.(); },
    registerJump: (callback: () => void) => {
      jump.current = callback;
      return () => { if (jump.current === callback) jump.current = undefined; };
    },
  }), []);
  const wurzel = useRef<HTMLDivElement>(null);
  const eingabe = useRef<HTMLDivElement>(null);
  const mitEingabe = composer !== undefined;

  useLayoutEffect(() => {
    const element = eingabe.current;
    const rahmen = wurzel.current;
    if (!rahmen) {
      return;
    }
    if (!element) {
      rahmen.style.removeProperty("--qsl-composer-height");
      return;
    }
    const messen = () => rahmen.style.setProperty("--qsl-composer-height", `${element.offsetHeight}px`);
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(element);
    messen();
    return () => beobachter.disconnect();
  }, [mitEingabe]);

  return (
    <ChatSendContext.Provider value={sendContext}>
    <div
      className={className ? `qsl-chat-panel ${className}` : "qsl-chat-panel"}
      style={appearanceStyle(appearance)}
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
      {composer !== undefined && (
        <div className="qsl-chat-panel__composer" ref={eingabe}>
          {composer}
        </div>
      )}
    </div>
    </ChatSendContext.Provider>
  );
}
