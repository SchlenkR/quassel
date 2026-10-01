import { useReducer, useState, type ReactNode } from "react";
import {
  applyEvent,
  ChatInputToolbar,
  ChatMessages,
  ChatPanel,
  DetailModeSwitch,
  englishTexts,
  germanTexts,
  QuasselProvider,
  TimestampSwitch,
  TranscriptModeSwitch,
  type TranscriptMode,
  type DetailMode,
  type Message,
  type QuasselButtonProps,
} from "quassel";
import { ChoiceCard } from "./ChoiceCard";
import { useFakeAgent } from "./fakeAgent";
import { actions, research, steps } from "./samples";

const DEMOS = [
  { id: "read", title: "Read only", note: "Transcript without a composer" },
  { id: "input", title: "Input card", note: "Stop, interjecting, attachments" },
  { id: "actions", title: "Actions", note: "Pending actions above the composer" },
  { id: "themes", title: "Themes", note: "Only --qsl-* overridden" },
  { id: "slots", title: "Slots", note: "Custom buttons through QuasselProvider" },
] as const;

type DemoId = (typeof DEMOS)[number]["id"];

const MODES: DetailMode[] = ["off", "current", "icons", "chips", "grouped", "compact", "full"];

function Toggles<T extends string>({ values, value, onChange }: { values: readonly T[]; value: T; onChange: (value: T) => void }) {
  return (
    <div className="toggles">
      {values.map((entry) => (
        <button aria-pressed={entry === value} className="toggle" key={entry} onClick={() => onChange(entry)} type="button">{entry}</button>
      ))}
    </div>
  );
}

function Stage({ title, note, head, children }: { title: string; note: string; head?: ReactNode; children: ReactNode }) {
  return (
    <>
      <div className="stage-head">
        <div>
          <h2>{title}</h2>
          <p>{note}</p>
        </div>
        {head}
      </div>
      <div className="stage-body">{children}</div>
    </>
  );
}

export function App() {
  const [demo, setDemo] = useState<DemoId>("input");
  return (
    <div className="shell">
      <aside className="menu">
        <h1>quassel</h1>
        {DEMOS.map((entry) => (
          <button aria-pressed={entry.id === demo} className="menu-item" key={entry.id} onClick={() => setDemo(entry.id)} type="button">
            <span className="menu-title">{entry.title}</span>
            <span className="menu-note">{entry.note}</span>
          </button>
        ))}
      </aside>
      <main className="stage">
        {demo === "read" && <ReadDemo />}
        {demo === "input" && <InputDemo />}
        {demo === "actions" && <ActionDemo />}
        {demo === "themes" && <ThemeDemo />}
        {demo === "slots" && <SlotDemo />}
      </main>
    </div>
  );
}

function ReadDemo() {
  const [language, setLanguage] = useState<"de" | "en">("en");
  const texts = language === "de" ? germanTexts : englishTexts;
  const [detailMode, setDetailMode] = useState<DetailMode>("grouped");
  return (
    <Stage head={<><Toggles onChange={setLanguage} value={language} values={["de", "en"]} /><Toggles onChange={setDetailMode} value={detailMode} values={MODES} /></>} note="ChatMessages without a composer, step detail level switchable." title="Read only">
      <ChatMessages texts={texts} detailMode={detailMode} messages={[...research, ...steps]} showTimestamps timestampOptions={{ timeZone: "UTC" }} />
    </Stage>
  );
}

function InputDemo() {
  const [language, setLanguage] = useState<"de" | "en">("en");
  const texts = language === "de" ? germanTexts : englishTexts;
  const { messages, running, agent } = useFakeAgent();
  const [detailMode, setDetailMode] = useState<DetailMode>("grouped");
  const [transcriptMode, setTranscriptMode] = useState<TranscriptMode>("latest");
  const [showTimestamps, setShowTimestamps] = useState(false);
  return (
    <Stage head={<Toggles onChange={setLanguage} value={language} values={["de", "en"]} />} note="Keep your inputs and only the latest reply between them, or show intermediate replies too. Try interjecting while the simulated agent works." title="Input card">
      <ChatPanel
        className="panel"
        composer={
          <ChatInputToolbar
            texts={texts}
            maxRows={6}
            onSend={(text) => agent.send(text)}
            onStop={() => agent.stop()}
            rows={1}
            running={running}
            toolbarLeft={<>
              <TranscriptModeSwitch texts={texts} mode={transcriptMode} onChange={setTranscriptMode} />
              <DetailModeSwitch texts={texts} mode={detailMode} onChange={setDetailMode} />
              <TimestampSwitch texts={texts} onChange={setShowTimestamps} showTimestamps={showTimestamps} />
            </>}
          />
        }
        maxWidth={760}
        scrollOnSend
      >
        <ChatMessages
          texts={texts}
          codeBlockOptions={{ showCopyButton: true }}
          detailMode={detailMode}
          transcriptMode={transcriptMode}
          emptyState={<div className="empty">Ask a question and feel free to interject while the agent is running.</div>}
          messageActions={{ copy: true }}
          messages={messages}
          running={running}
          showTimestamps={showTimestamps}
        />
      </ChatPanel>
    </Stage>
  );
}

function ActionDemo() {
  const [messages, dispatch] = useReducer(applyEvent, actions);
  const resolve = (actionId: string, status: "approved" | "dismissed", result: unknown) =>
    dispatch({ kind: "action-resolved", actionId, status, result });
  const ask = (text: string) => {
    const at = new Date().toISOString();
    dispatch({ kind: "user", text, at });
    dispatch({ kind: "action", actionId: crypto.randomUUID(), owner: null, text: `Apply "${text}" as is?`, payload: {}, at });
  };
  return (
    <Stage note="Open actions sit above the composer, resolved ones in the transcript; renderAction replaces the default card. Sending asks a new question." title="Actions">
      <ChatPanel className="panel" composer={<ChatInputToolbar onSend={ask} rows={1} />} maxWidth={760}>
        <ChatMessages
          messages={messages}
          onDismissAction={(actionId) => resolve(actionId, "dismissed", null)}
          renderAction={(action, text) => action.owner === "choice"
            ? <ChoiceCard action={action} onChoose={(option) => resolve(action.actionId, "approved", option)} text={text} />
            : undefined}
        />
      </ChatPanel>
    </Stage>
  );
}

const THEMES = ["default", "theme-sunset", "theme-emerald"] as const;
const SCHEMES = ["light", "dark"] as const;

function ThemeDemo() {
  const [theme, setTheme] = useState<(typeof THEMES)[number]>("theme-sunset");
  const [scheme, setScheme] = useState<(typeof SCHEMES)[number]>("light");
  return (
    <Stage
      head={<div className="toggles"><Toggles onChange={setTheme} value={theme} values={THEMES} /><Toggles onChange={setScheme} value={scheme} values={SCHEMES} /></div>}
      note="No component code: a wrapper sets --qsl-* (themes.css) and data-theme."
      title="Themes"
    >
      <div className={`theme-canvas ${theme}`} data-theme={scheme}>
        <ChatPanel className="panel" composer={<ChatInputToolbar onSend={() => undefined} rows={1} />}>
          <ChatMessages detailMode="chips" messages={steps as Message[]} />
        </ChatPanel>
      </div>
    </Stage>
  );
}

function PlainButton({ children, onClick, disabled, title, className, variant, size, ...rest }: QuasselButtonProps) {
  return (
    <button {...rest} className={`plain-button ${variant ?? "default"} ${size?.startsWith("icon") ? "icon" : ""} ${className ?? ""}`} disabled={disabled} onClick={onClick} title={title} type="button">
      {children}
    </button>
  );
}

function SlotDemo() {
  const { messages, running, agent } = useFakeAgent();
  return (
    <Stage note="QuasselProvider replaces the button with one of the host; quassel's layout classes stay in effect." title="Slots">
      <QuasselProvider components={{ Button: PlainButton }}>
        <ChatPanel className="panel" composer={<ChatInputToolbar onSend={(text) => agent.send(text)} onStop={() => agent.stop()} rows={1} running={running} />}>
          <ChatMessages messageActions={{ copy: true }} messages={messages.length ? messages : research} running={running} />
        </ChatPanel>
      </QuasselProvider>
    </Stage>
  );
}
