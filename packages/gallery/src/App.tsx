import { useState } from "react";
import {
  ChatInputToolbar,
  ChatMessages,
  DetailMode,
  DetailModeSwitch,
  TimestampSwitch,
  IconSpark,
  useChat,
} from "quassel";
import "./themes.css";
import { useFakeAgent } from "./fakeAgent";
import { transcript } from "./transcript";

const DEMOS = [
  { id: "lesen", title: "Nur lesen", note: "Verlauf ohne Eingabe" },
  { id: "toolbar", title: "Eingabe-Karte", note: "Toolbar, Stop und Dazwischenfunken" },
  { id: "bausteine", title: "Panel-Bausteine", note: "Glas, Felder, Punkte" },
  { id: "stile", title: "Stile", note: "Dieselben Bausteine, andere Tokens" },
  { id: "live", title: "Live-Backend", note: "Echtes LLM über quassel/server" },
] as const;

type DemoId = (typeof DEMOS)[number]["id"];

const MODI: { id: DetailMode; label: string }[] = [
  { id: "off", label: "nur Antworten" },
  { id: "icons", label: "Symbole" },
  { id: "chips", label: "kompakt" },
  { id: "grouped", label: "gruppiert" },
  { id: "compact", label: "einzeilig" },
  { id: "full", label: "alles" },
];

function ModusToggles({ modus, setModus }: { modus: DetailMode; setModus: (wert: DetailMode) => void }) {
  return (
    <div className="toggles">
      {MODI.map((eintrag) => (
        <button
          aria-pressed={modus === eintrag.id}
          className="toggle"
          key={eintrag.id}
          onClick={() => setModus(eintrag.id)}
          type="button"
        >
          {eintrag.label}
        </button>
      ))}
    </div>
  );
}

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
        <div className="qsl-panel__foot">quassel</div>
      </aside>
      <main className="stage">
        {demo === "lesen" && <LeseDemo />}
        {demo === "toolbar" && <ToolbarDemo />}
        {demo === "bausteine" && <BausteineDemo />}
        {demo === "stile" && <StilDemo />}
        {demo === "live" && <LiveDemo />}
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
          <p>
            ChatMessages ohne Eingabe - ein Verlauf als Dokument, Schritte je nach Detailgrad. Die letzte
            Schrittzeile zeigt die vier Zustände: fertig, Fehler, laufend, Denken.
          </p>
        </div>
        <ModusToggles modus={detailMode} setModus={setDetailMode} />
      </div>
      <ChatMessages detailMode={detailMode} messages={transcript} />
    </>
  );
}

function ToolbarDemo() {
  const { messages, running, agent } = useFakeAgent();
  const [detailMode, setDetailMode] = useState<DetailMode>("chips");
  const [zeilen, setZeilen] = useState(2);
  const [showTimestamps, setShowTimestamps] = useState(false);
  return (
    <>
      <div className="stage-head">
        <div>
          <h2>Eingabe-Karte</h2>
          <p>
            ChatInputToolbar: Höhe über rows, eigene Knöpfe über actions (Icon, Text oder beides), eigener
            Working-Indikator. Während des Laufs wird Senden zu Stop, Tippen zum Dazwischenfunken.
          </p>
        </div>
        <ModusToggles modus={detailMode} setModus={setDetailMode} />
      </div>
      <ChatMessages
        detailMode={detailMode}
        showTimestamps={showTimestamps}
        emptyState={<div className="empty">Stell eine Frage - und funk ruhig dazwischen, während der Agent läuft.</div>}
        messages={messages}
        running={running}
        working={
          <div className="mein-working">
            <span className="qsl-dot qsl-dot--working" />
            Der Demo-Agent bastelt an der Antwort ...
          </div>
        }
      />
      <div className="stage-foot">
        <ChatInputToolbar
          actions={[
            {
              label: zeilen === 2 ? "hoch" : "flach",
              title: "Eingabehöhe umschalten (rows)",
              onClick: () => setZeilen(zeilen === 2 ? 6 : 2),
            },
          ]}
          onSend={(text) => agent.send(text)}
          onStop={() => agent.stop()}
          rows={zeilen}
          running={running}
          toolbarLeft={<>
            <DetailModeSwitch mode={detailMode} onChange={setDetailMode} />
            <TimestampSwitch showTimestamps={showTimestamps} onChange={setShowTimestamps} />
          </>}
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
          <ChatInputToolbar onSend={(text) => agent.send(text)} onStop={() => agent.stop()} rows={1} running={running} />
        </div>
      </div>
    </>
  );
}

function LiveDemo() {
  const { messages, running, connected, send, stop } = useChat("http://localhost:3300/chat/demo");
  return (
    <>
      <div className="stage-head">
        <div>
          <h2>Live-Backend</h2>
          <p>
            useChat gegen den Beispiel-Server (quassel/server, pnpm demo:server) -
            dahinter ein OpenAI-kompatibles LLM.
          </p>
        </div>
        <span className={connected ? "verbindung verbindung--da" : "verbindung"}>
          <span className={connected ? "qsl-dot qsl-dot--live" : "qsl-dot"} />
          {connected ? "verbunden" : "Server nicht erreichbar"}
        </span>
      </div>
      <ChatMessages
        emptyState={
          <div className="empty">
            {connected
              ? "Verbunden - stell dem Modell eine Frage (Uhrzeit fragen zeigt den Tool-Call)."
              : "Beispiel-Server starten: pnpm demo:server"}
          </div>
        }
        messages={messages}
        running={running}
      />
      <div className="stage-foot">
        <ChatInputToolbar disabled={!connected} onSend={(text) => void send(text)} onStop={() => void stop()} running={running} />
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
