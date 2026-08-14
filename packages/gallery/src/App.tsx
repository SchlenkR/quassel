import { useState } from "react";
import {
  ChatInputPlain,
  ChatInputToolbar,
  ChatMessages,
  DetailMode,
  IconSpark,
} from "@quassel/chat-react";
import "./themes.css";
import { useFakeAgent } from "./fakeAgent";
import { transcript } from "./transcript";

const DEMOS = [
  { id: "lesen", title: "Nur lesen", note: "Verlauf ohne Eingabe" },
  { id: "schlicht", title: "Schlichte Eingabe", note: "Text rein, senden, fertig" },
  { id: "toolbar", title: "Eingabe-Karte", note: "Toolbar, Stop und Dazwischenfunken" },
  { id: "bausteine", title: "Panel-Bausteine", note: "Glas, Felder, Punkte" },
  { id: "stile", title: "Stile", note: "Dieselben Bausteine, andere Tokens" },
] as const;

type DemoId = (typeof DEMOS)[number]["id"];

export function App() {
  const [demo, setDemo] = useState<DemoId>("toolbar");

  return (
    <div className="shell">
      <aside className="qsl-panel">
        <div className="qsl-panel__head">
          <IconSpark size={16} />
          <h1>quassel</h1>
        </div>
        <div className="qsl-panel__body">
          <div className="qsl-label">Schubladen</div>
          {DEMOS.map((eintrag) => (
            <button
              className={eintrag.id === demo ? "qsl-ghost qsl-ghost--active" : "qsl-ghost"}
              key={eintrag.id}
              onClick={() => setDemo(eintrag.id)}
              type="button"
            >
              <span className="demo-title">{eintrag.title}</span>
              <span className="demo-note">{eintrag.note}</span>
            </button>
          ))}
        </div>
        <div className="qsl-panel__foot">@quassel/foundation + @quassel/chat-react</div>
      </aside>
      <main className="stage">
        {demo === "lesen" && <LeseDemo />}
        {demo === "schlicht" && <SchlichtDemo />}
        {demo === "toolbar" && <ToolbarDemo />}
        {demo === "bausteine" && <BausteineDemo />}
        {demo === "stile" && <StilDemo />}
      </main>
    </div>
  );
}

function LeseDemo() {
  const [detailMode, setDetailMode] = useState<DetailMode>("compact");
  return (
    <>
      <div className="stage-head">
        <div>
          <h2>Nur lesen</h2>
          <p>ChatMessages ohne Eingabe - ein Verlauf als Dokument, Schritte je nach Detailgrad.</p>
        </div>
        <div className="toggles">
          {(["off", "compact", "full"] as const).map((mode) => (
            <button
              aria-pressed={detailMode === mode}
              className="toggle"
              key={mode}
              onClick={() => setDetailMode(mode)}
              type="button"
            >
              {mode === "off" ? "nur Antworten" : mode === "compact" ? "einzeilig" : "alles"}
            </button>
          ))}
        </div>
      </div>
      <ChatMessages detailMode={detailMode} messages={transcript} />
    </>
  );
}

function SchlichtDemo() {
  const { messages, running, agent } = useFakeAgent();
  return (
    <>
      <div className="stage-head">
        <div>
          <h2>Schlichte Eingabe</h2>
          <p>ChatInputPlain: nur Text und Senden. Der Stop-Knopf erscheint erst im Lauf.</p>
        </div>
      </div>
      <ChatMessages
        emptyState={<div className="empty">Stell eine Frage - der Demo-Agent antwortet geskriptet.</div>}
        messages={messages}
        running={running}
      />
      <div className="stage-foot">
        <ChatInputPlain onSend={(text) => agent.send(text)} onStop={() => agent.stop()} running={running} />
      </div>
    </>
  );
}

function ToolbarDemo() {
  const { messages, running, agent } = useFakeAgent();
  const [detailMode, setDetailMode] = useState<DetailMode>("compact");
  return (
    <>
      <div className="stage-head">
        <div>
          <h2>Eingabe-Karte</h2>
          <p>
            ChatInputToolbar: Karte mit Toolbar-Slots. Während des Laufs wird Senden zu Stop, Tippen zum
            Dazwischenfunken.
          </p>
        </div>
      </div>
      <ChatMessages
        detailMode={detailMode}
        emptyState={<div className="empty">Stell eine Frage - und funk ruhig dazwischen, während der Agent läuft.</div>}
        messages={messages}
        running={running}
      />
      <div className="stage-foot">
        <ChatInputToolbar
          onSend={(text) => agent.send(text)}
          onStop={() => agent.stop()}
          running={running}
          toolbarLeft={
            <button
              className="qsl-icon-button"
              onClick={() =>
                setDetailMode(detailMode === "off" ? "compact" : detailMode === "compact" ? "full" : "off")
              }
              title="Detailgrad umschalten"
              type="button"
            >
              <IconSpark size={14} />
              <span className="qsl-collapsible">
                {detailMode === "off" ? "nur Antworten" : detailMode === "compact" ? "einzeilig" : "alles"}
              </span>
            </button>
          }
        />
      </div>
    </>
  );
}

const STILE = [
  { id: "", title: "Standard" },
  { id: "theme-tinte", title: "Tinte" },
  { id: "theme-abendrot", title: "Abendrot" },
  { id: "theme-smaragd", title: "Smaragd" },
] as const;

function StilDemo() {
  const [stil, setStil] = useState<string>("theme-abendrot");
  const { messages, running, agent } = useFakeAgent();
  const verlauf = messages.length > 0 ? messages : transcript;
  return (
    <>
      <div className="stage-head">
        <div>
          <h2>Stile</h2>
          <p>Kein Komponenten-Code angefasst: nur Token-Overrides auf dem Wrapper (siehe themes.css).</p>
        </div>
        <div className="toggles">
          {STILE.map((eintrag) => (
            <button
              aria-pressed={stil === eintrag.id}
              className="toggle"
              key={eintrag.id}
              onClick={() => setStil(eintrag.id)}
              type="button"
            >
              {eintrag.title}
            </button>
          ))}
        </div>
      </div>
      <div className={`stil-canvas qsl-wash qsl-wash--clip ${stil}`}>
        <ChatMessages messages={verlauf} running={running} />
        <div className="stage-foot">
          <ChatInputPlain onSend={(text) => agent.send(text)} onStop={() => agent.stop()} running={running} showHint={false} />
        </div>
      </div>
    </>
  );
}

function BausteineDemo() {
  return (
    <>
      <div className="stage-head">
        <div>
          <h2>Panel-Bausteine</h2>
          <p>Die foundation pur: Glas-Panel auf der Waschung, Feld, Geister-Liste, Status-Punkte.</p>
        </div>
      </div>
      <div className="bausteine">
        <div className="qsl-panel baustein-panel">
          <div className="qsl-panel__head">
            <h2>Sitzungen</h2>
            <span className="baustein-counter">3</span>
          </div>
          <input className="qsl-field baustein-filter" placeholder="Filtern ..." />
          <div className="qsl-panel__body">
            <div className="qsl-label">Heute</div>
            <button className="qsl-ghost qsl-ghost--active" type="button">
              <span className="baustein-item">
                <span className="qsl-dot qsl-dot--working" /> Energiebericht Woche 32
              </span>
            </button>
            <button className="qsl-ghost" type="button">
              <span className="baustein-item">
                <span className="qsl-dot qsl-dot--live" /> Sensor-Diagnose Halle 2
              </span>
            </button>
            <div className="qsl-label">Gestern</div>
            <button className="qsl-ghost" type="button">
              <span className="baustein-item">
                <span className="qsl-dot" /> Abgeschlossene Analyse
              </span>
            </button>
          </div>
          <div className="qsl-panel__foot">~/demo/sitzungen</div>
        </div>
      </div>
    </>
  );
}
