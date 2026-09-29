import { useReducer, useState, type ReactNode } from "react";
import {
  applyEvent,
  ChatInputToolbar,
  ChatMessages,
  ChatPanel,
  DetailModeSwitch,
  QuasselProvider,
  TimestampSwitch,
  type DetailMode,
  type Message,
  type QuasselButtonProps,
} from "quassel";
import { ChoiceCard } from "./ChoiceCard";
import { useFakeAgent } from "./fakeAgent";
import { actions, research, steps } from "./samples";

const DEMOS = [
  { id: "lesen", title: "Nur lesen", note: "Verlauf ohne Eingabe" },
  { id: "eingabe", title: "Eingabe-Karte", note: "Stop, Dazwischenfunken, Anhänge" },
  { id: "aktionen", title: "Aktionen", note: "Wartende Aktionen über der Eingabe" },
  { id: "stile", title: "Stile", note: "Nur --qsl-* überschrieben" },
  { id: "slots", title: "Slots", note: "Eigene Knöpfe per QuasselProvider" },
] as const;

type DemoId = (typeof DEMOS)[number]["id"];

const MODI: DetailMode[] = ["off", "current", "icons", "chips", "grouped", "compact", "full"];

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
  const [demo, setDemo] = useState<DemoId>("eingabe");
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
        {demo === "lesen" && <ReadDemo />}
        {demo === "eingabe" && <InputDemo />}
        {demo === "aktionen" && <ActionDemo />}
        {demo === "stile" && <ThemeDemo />}
        {demo === "slots" && <SlotDemo />}
      </main>
    </div>
  );
}

function ReadDemo() {
  const [detailMode, setDetailMode] = useState<DetailMode>("grouped");
  return (
    <Stage head={<Toggles onChange={setDetailMode} value={detailMode} values={MODI} />} note="ChatMessages ohne Eingabe, Detailgrad der Schritte umschaltbar." title="Nur lesen">
      <ChatMessages detailMode={detailMode} messages={[...research, ...steps]} showTimestamps timestampOptions={{ timeZone: "UTC" }} />
    </Stage>
  );
}

function InputDemo() {
  const { messages, running, agent } = useFakeAgent();
  const [detailMode, setDetailMode] = useState<DetailMode>("chips");
  const [showTimestamps, setShowTimestamps] = useState(false);
  return (
    <Stage note="ChatPanel mit ChatInputToolbar: während des Laufs Stop, Tippen funkt dazwischen." title="Eingabe-Karte">
      <ChatPanel
        className="panel"
        composer={
          <ChatInputToolbar
            maxRows={6}
            onSend={(text) => agent.send(text)}
            onStop={() => agent.stop()}
            rows={1}
            running={running}
            toolbarLeft={<>
              <DetailModeSwitch collapsible={false} mode={detailMode} onChange={setDetailMode} />
              <TimestampSwitch collapsible={false} onChange={setShowTimestamps} showTimestamps={showTimestamps} />
            </>}
          />
        }
        maxWidth={760}
        scrollOnSend
      >
        <ChatMessages
          codeBlockOptions={{ showCopyButton: true }}
          detailMode={detailMode}
          emptyState={<div className="empty">Stell eine Frage und funk ruhig dazwischen, während der Agent läuft.</div>}
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
    dispatch({ kind: "action", actionId: crypto.randomUUID(), owner: null, text: `"${text}" so übernehmen?`, payload: {}, at });
  };
  return (
    <Stage note="Offene Aktionen stehen über der Eingabe, erledigte im Verlauf; renderAction ersetzt die Standardkarte. Senden stellt eine neue Rückfrage." title="Aktionen">
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
      note="Kein Komponenten-Code: ein Wrapper setzt --qsl-* (themes.css) und data-theme."
      title="Stile"
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
    <Stage note="QuasselProvider ersetzt den Button durch einen des Hosts; Layout-Klassen von quassel bleiben wirksam." title="Slots">
      <QuasselProvider components={{ Button: PlainButton }}>
        <ChatPanel className="panel" composer={<ChatInputToolbar onSend={(text) => agent.send(text)} onStop={() => agent.stop()} rows={1} running={running} />}>
          <ChatMessages messageActions={{ copy: true }} messages={messages.length ? messages : research} running={running} />
        </ChatPanel>
      </QuasselProvider>
    </Stage>
  );
}
