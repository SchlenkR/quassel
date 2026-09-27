import { useReducer, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  applyEvent,
  ChatInputToolbar,
  ChatMessages,
  ChatPanel,
  DetailModeSwitch,
  QuasselProvider,
  TimestampSwitch,
  type DetailMode,
} from "quassel";
import "quassel/chat.css";
import "./themes.css";
import "./showcase.css";
import { ChoiceCard } from "./ChoiceCard";
import { actions, party, research, steps, tokens } from "./samples";
import { englishTexts as texts } from "./texts";

function Frame({ caption, small, className, children }: { caption?: string; small?: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={["showcase-frame", small && "showcase-frame--small", className].filter(Boolean).join(" ")}>
      {caption && <div className="showcase-caption">{caption}</div>}
      {children}
    </div>
  );
}

function AgentScene() {
  const [detailMode, setDetailMode] = useState<DetailMode>("grouped");
  const [showTimestamps, setShowTimestamps] = useState(true);
  return (
    <Frame>
      <ChatPanel
        className="showcase-panel"
        composer={
          <ChatInputToolbar
            maxRows={4}
            onSend={() => undefined}
            onStop={() => undefined}
            rows={1}
            running
            texts={texts}
            toolbarLeft={<>
              <DetailModeSwitch collapsible={false} mode={detailMode} onChange={setDetailMode} texts={texts} />
              <TimestampSwitch collapsible={false} onChange={setShowTimestamps} showTimestamps={showTimestamps} texts={texts} />
            </>}
          />
        }
        horizontalPadding={16}
      >
        <ChatMessages
          codeBlockOptions={{ showCopyButton: true }}
          detailMode={detailMode}
          messages={research}
          running
          showTimestamps={showTimestamps}
          texts={texts}
          timestampOptions={{ timeZone: "UTC", locale: "en" }}
        />
      </ChatPanel>
    </Frame>
  );
}

function DetailScene() {
  const modes: { mode: DetailMode; caption: string }[] = [
    { mode: "icons", caption: "icons" },
    { mode: "chips", caption: "chips" },
    { mode: "compact", caption: "one line" },
  ];
  return (
    <>
      {modes.map(({ mode, caption }) => (
        <Frame caption={caption} className="showcase-frame--short" key={mode} small>
          <ChatMessages detailMode={mode} horizontalPadding={16} messages={steps} texts={texts} />
        </Frame>
      ))}
    </>
  );
}

function ActionScene() {
  const [messages, dispatch] = useReducer(applyEvent, actions);
  return (
    <Frame className="showcase-frame--tall" small>
      <ChatMessages
        horizontalPadding={16}
        messages={messages}
        onDismissAction={(actionId) => dispatch({ kind: "action-resolved", actionId, status: "dismissed", result: null })}
        renderAction={(action, text) => action.owner === "choice"
          ? <ChoiceCard action={action} onChoose={(option) => dispatch({ kind: "action-resolved", actionId: action.actionId, status: "approved", result: option })} text={text} />
          : undefined}
        texts={texts}
      />
    </Frame>
  );
}

function PartyScene() {
  return (
    <Frame small>
      <ChatMessages bubbleOptions={{ variant: "bubbles" }} horizontalPadding={16} messages={party} texts={texts} />
    </Frame>
  );
}

function ThemeScene() {
  const themes = [
    { className: "", caption: "default" },
    { className: "theme-sunset", caption: "sunset" },
    { className: "theme-emerald", caption: "emerald" },
  ];
  return (
    <>
      {themes.map(({ className, caption }) => (
        <Frame caption={caption} className={`showcase-frame--short ${className}`} key={caption} small>
          <ChatMessages detailMode="chips" horizontalPadding={16} messages={steps} texts={texts} />
          <div className="showcase-composer">
            <ChatInputToolbar onSend={() => undefined} rows={1} texts={texts} />
          </div>
        </Frame>
      ))}
    </>
  );
}

function TokenChat() {
  return (
    <>
      <ChatMessages detailMode="chips" horizontalPadding={16} messages={tokens} showTimestamps texts={texts} timestampOptions={{ timeZone: "UTC", locale: "en" }} />
      <div className="showcase-composer">
        <ChatInputToolbar onSend={() => undefined} rows={1} texts={texts} />
      </div>
    </>
  );
}

function HostScene() {
  const popovers = useRef<HTMLDivElement>(null);
  return (
    <>
      <Frame caption="default" className="showcase-frame--short" small>
        <TokenChat />
      </Frame>
      <div className="theme-host" data-host-wrapper>
        <QuasselProvider portalContainer={popovers}>
          <Frame caption="host tokens, popovers inside the wrapper" className="showcase-frame--short" small>
            <TokenChat />
          </Frame>
        </QuasselProvider>
        <div ref={popovers} />
      </div>
    </>
  );
}

const scenes: Record<string, () => ReactNode> = {
  agent: AgentScene,
  details: DetailScene,
  actions: ActionScene,
  questions: ActionScene,
  party: PartyScene,
  themes: ThemeScene,
  host: HostScene,
};

const params = new URLSearchParams(location.search);
document.documentElement.dataset.theme = params.get("theme") === "dark" ? "dark" : "light";
const Scene = scenes[params.get("scene") ?? "agent"] ?? AgentScene;

createRoot(document.getElementById("root")!).render(
  <div className="showcase" data-shot>
    <Scene />
  </div>,
);
