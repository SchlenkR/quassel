import { useEffect, useRef, useState } from "react";
import {
  ChatInputPlain,
  ChatInputToolbar,
  ChatMessages,
  DetailMode,
  DetailModeSwitch,
  TimestampSwitch,
  IconSpark,
  useChat,
} from "@quassel/chat-react";
import "@quassel/question-element";
import "./themes.css";
import { useFakeAgent } from "./fakeAgent";
import { transcript } from "./transcript";

const DEMOS = [
  { id: "lesen", title: "Nur lesen", note: "Verlauf ohne Eingabe" },
  { id: "schlicht", title: "Schlichte Eingabe", note: "Text rein, senden, fertig" },
  { id: "toolbar", title: "Eingabe-Karte", note: "Toolbar, Stop und Dazwischenfunken" },
  { id: "frage", title: "Frage-Element", note: "Web Component ohne React" },
  { id: "bausteine", title: "Panel-Bausteine", note: "Glas, Felder, Punkte" },
  { id: "stile", title: "Stile", note: "Dieselben Bausteine, andere Tokens" },
  { id: "live", title: "Live-Backend", note: "Echtes LLM über @quassel/agent-node" },
  { id: "pi", title: "Pi-Backend", note: "Der Pi Coding Agent über @quassel/agent-pi" },
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
        <div className="qsl-panel__foot">@quassel/foundation + @quassel/chat-react</div>
      </aside>
      <main className="stage">
        {demo === "lesen" && <LeseDemo />}
        {demo === "schlicht" && <SchlichtDemo />}
        {demo === "toolbar" && <ToolbarDemo />}
        {demo === "frage" && <FrageDemo />}
        {demo === "bausteine" && <BausteineDemo />}
        {demo === "stile" && <StilDemo />}
        {demo === "live" && <LiveDemo />}
        {demo === "pi" && <PiDemo />}
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
          <ChatInputPlain onSend={(text) => agent.send(text)} onStop={() => agent.stop()} running={running} showHint={false} />
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
            useChat gegen den Beispiel-Server (packages/agent-node, pnpm --filter @quassel/agent-node demo) -
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
              : "Beispiel-Server starten: pnpm --filter @quassel/agent-node demo"}
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

function PiDemo() {
  const { messages, running, connected, send, stop } = useChat("http://localhost:3301/chat/pi-demo");
  const [detailMode, setDetailMode] = useState<DetailMode>("chips");
  return (
    <>
      <div className="stage-head">
        <div>
          <h2>Pi-Backend</h2>
          <p>
            Gleiches Frontend, anderes Backend: der Pi Coding Agent hinter demselben Event-Kontrakt
            (pnpm --filter @quassel/agent-pi demo).
          </p>
        </div>
        <div className="pi-kopf">
          <ModusToggles modus={detailMode} setModus={setDetailMode} />
          <span className={connected ? "verbindung verbindung--da" : "verbindung"}>
            <span className={connected ? "qsl-dot qsl-dot--live" : "qsl-dot"} />
            {connected ? "verbunden" : "Server nicht erreichbar"}
          </span>
        </div>
      </div>
      <ChatMessages
        detailMode={detailMode}
        emptyState={
          <div className="empty">
            {connected
              ? "Verbunden - frag z.B. nach den Dateien im Projekt, dann siehst du Pi-Tool-Calls."
              : "Pi-Server starten: pnpm --filter @quassel/agent-pi demo"}
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

/** Bewusst ohne JSX gebaut: die Karten entstehen mit reinem DOM, React haelt nur das Protokoll. */
function FrageDemo() {
  const buehne = useRef<HTMLDivElement>(null);
  const [runde, setRunde] = useState(0);
  const [protokoll, setProtokoll] = useState<string[]>([]);

  useEffect(() => {
    const stage = buehne.current;
    if (!stage) return;

    const timers: number[] = [];
    const notieren = (zeile: string) => setProtokoll((bisher) => [zeile, ...bisher].slice(0, 6));

    const karte = (text: string, options: string[], extras: Partial<HTMLElementTagNameMap["qsl-question"]> = {}) => {
      const element = document.createElement("qsl-question");
      element.text = text;
      element.options = options;
      Object.assign(element, extras);
      element.addEventListener("answer", (event) => {
        notieren(`answer: ${JSON.stringify(event.detail)}`);
        element.busy = true;
        timers.push(
          window.setTimeout(() => {
            element.busy = false;
            element.answer = event.detail.value;
          }, 500),
        );
      });
      element.addEventListener("dismiss", () => {
        notieren("dismiss");
        element.answer = "Verworfen";
      });
      return element;
    };

    stage.append(
      karte("Welchen Zeitraum soll die Auswertung abdecken?", ["Letzte Woche", "Letzter Monat", "Letztes Quartal"]),
      karte("Welche Anlagen sollen mit hinein?", ["Halle 1", "Halle 2", "Kesselhaus", "Außenlager"], {
        multi: true,
        dismissible: true,
      }),
      karte("Womit soll ich weitermachen?", ["Bericht schreiben", "Rohdaten exportieren"], {
        answer: "Bericht schreiben",
      }),
    );

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      stage.replaceChildren();
    };
  }, [runde]);

  return (
    <>
      <div className="stage-head">
        <div>
          <h2>Frage-Element</h2>
          <p>
            &lt;qsl-question&gt; aus @quassel/question-element: Custom Element im Light DOM, dieselben
            qsl-question-Klassen wie die React-Karte - hier per document.createElement gesetzt, ohne React im Spiel.
          </p>
        </div>
        <div className="toggles">
          <button className="toggle" onClick={() => setRunde((wert) => wert + 1)} type="button">
            zurücksetzen
          </button>
        </div>
      </div>
      <div className="fragen">
        <div className="fragen-buehne" ref={buehne} />
        <div className="fragen-log">
          {protokoll.length === 0
            ? "Noch nichts beantwortet - die Ereignisse landen hier."
            : protokoll.map((zeile, index) => <div key={index}>{zeile}</div>)}
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
