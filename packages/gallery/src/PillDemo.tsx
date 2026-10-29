import { useEffect, useRef, useState } from "react";
import { ChatInputToolbar, ChatMessages, germanTexts, type ChatInputHandle, type ChatMicrophone, type MicrophonePress } from "@schlenkr/quassel";
import { useFakeAgent } from "./fakeAgent";
import "./pill.css";

const texts = { ...germanTexts, placeholder: "Was soll ich tun?" };

function useVoiceLevel(recording: boolean) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setLevel(0.15 + Math.abs(Math.sin(performance.now() / 320) * Math.cos(performance.now() / 730)) * 0.85), 70);
    return () => window.clearInterval(timer);
  }, [recording]);
  return level;
}

function VoiceStrip({ level, pending = false }: { level: number; pending?: boolean }) {
  return <div className="pill-voice" role="status" aria-label={pending ? texts.microphoneTranscribing : "Aufnahme läuft"}>
    <span className="pill-voice-label">{pending ? "Wird transkribiert ..." : "Ich höre zu"}</span>
    <span className="pill-wave" aria-hidden="true">
      {Array.from({ length: 28 }, (_, index) => <span key={index} style={{ height: `${4 + (0.3 + Math.abs(Math.sin(index * 1.4))) * level * 23}px` }} />)}
    </span>
  </div>;
}

function HostButtons({ onMenu, onConversation, conversation = false }: { onMenu?: () => void; onConversation?: () => void; conversation?: boolean }) {
  return <>
    <button className="pill-host-button" type="button" aria-label="Einstellungen" title="Einstellungen" onClick={onMenu}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" /><circle cx="15" cy="17" r="3" /></svg>
    </button>
    <button className="pill-host-button" type="button" aria-label="Gespräch umschalten" title="Gespräch umschalten" aria-pressed={conversation} onClick={onConversation}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h12v10H8l-4 3V4Zm15 5h2v12l-4-3h-6v-1" /></svg>
    </button>
  </>;
}

const noMicrophoneAction = () => {};
const sampleMicrophone = (state: ChatMicrophone["state"], level: number): ChatMicrophone => ({
  state, level, onPressStart: noMicrophoneAction, onPressEnd: noMicrophoneAction, onCancel: noMicrophoneAction,
});

export function PillStates() {
  const level = useVoiceLevel(true);
  const states = [
    { id: "idle", title: "Bereit", note: "Leer: Mikrofon" },
    { id: "typing", title: "Nachricht", note: "Text: Senden", text: "Fasse die Ergebnisse zusammen." },
    { id: "running", title: "Agent arbeitet", note: "Leer: Stoppen", running: true },
    { id: "steering", title: "Nachsteuern", note: "Text während der Arbeit: Senden", running: true, text: "Bitte nur die wichtigsten Punkte." },
    { id: "preparing", title: "Verbinden", note: "Mikrofon wird vorbereitet", voice: "preparing" },
    { id: "recording", title: "Aufnahme", note: "Live-Pegel mit Aura außerhalb der Pill", voice: "recording" },
    { id: "transcribing", title: "Transkription", note: "Beschäftigt: Spinner", voice: "transcribing" },
    { id: "disabled", title: "Deaktiviert", note: "Eingabe und Aktion gesperrt", disabled: true },
    { id: "no-microphone", title: "Ohne Mikrofon", note: "Leer: Senden deaktiviert", noMicrophone: true },
  ] as const;
  return <div className="pill-states">
    {states.map((entry) => {
      const voice = "voice" in entry ? entry.voice : "idle";
      return <section className="pill-state" data-pill-example={entry.id} key={entry.id}>
        <div className="pill-state-heading"><h3>{entry.title}</h3><span>{entry.note}</span></div>
        <ChatInputToolbar
          layout="pill"
          initialValue={"text" in entry ? entry.text : ""}
          maxRows={4}
          microphone={"noMicrophone" in entry ? undefined : sampleMicrophone(voice, level)}
          onSend={noMicrophoneAction}
          onStop={noMicrophoneAction}
          disabled={"disabled" in entry}
          running={"running" in entry}
          replaceInput={voice === "recording" || voice === "transcribing" ? <VoiceStrip level={level} pending={voice === "transcribing"} /> : undefined}
          texts={texts}
          toolbarLeft={<HostButtons />}
        />
      </section>;
    })}
  </div>;
}

export function PillDemo() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [state, setState] = useState<ChatMicrophone["state"]>("idle");
  const [menu, setMenu] = useState(false);
  const [conversation, setConversation] = useState(false);
  const input = useRef<ChatInputHandle>(null);
  const press = useRef<{ timeStamp: number; recording: boolean } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const { messages, running, agent } = useFakeAgent();
  const level = useVoiceLevel(state === "recording");
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const finish = () => {
    window.clearTimeout(timer.current);
    setState("transcribing");
    timer.current = window.setTimeout(() => {
      setState("idle");
      input.current?.insert("Fasse die Ergebnisse bitte kurz zusammen.");
    }, 1200);
  };
  const microphone: ChatMicrophone = {
    state,
    level,
    onPressStart: (event: MicrophonePress) => {
      press.current = { timeStamp: event.timeStamp, recording: state === "recording" };
      if (state === "recording") return;
      setState("preparing");
      timer.current = window.setTimeout(() => setState("recording"), 180);
    },
    onPressEnd: (event) => {
      if (press.current && (press.current.recording || event.timeStamp - press.current.timeStamp >= 250)) finish();
      press.current = null;
    },
    onCancel: () => {
      window.clearTimeout(timer.current);
      press.current = null;
      setState("idle");
    },
  };
  return <div className="pill-demo pill-palette" data-theme={theme}>
    <header className="pill-demo-heading">
      <div><h2>Eine Pill. Eine Aktion.</h2><p>Halten oder antippen zum Sprechen. Beim laufenden Agenten einfach weitertippen.</p></div>
      <div className="pill-theme-switch" aria-label="Farbschema">
        {(["light", "dark"] as const).map((value) => <button key={value} type="button" aria-pressed={theme === value} onClick={() => setTheme(value)}>{value === "light" ? "Hell" : "Dunkel"}</button>)}
      </div>
    </header>
    <section className="pill-playground">
      <span className="pill-eyebrow">AUSPROBIEREN</span>
      {conversation && <div className="pill-conversation"><ChatMessages messages={messages} running={running} detailMode="grouped" texts={texts} /></div>}
      {menu && <p className="pill-help">Mikrofon, Pegel und Transkription sind hier simuliert. Ein kurzer Klick startet die Aufnahme, ein weiterer beendet sie. Halten und Loslassen funktioniert ebenfalls. Escape bricht ab.</p>}
      <ChatInputToolbar
        handleRef={input}
        layout="pill"
        maxRows={5}
        microphone={microphone}
        onSend={(text) => { setConversation(true); agent.send(text); }}
        onStop={() => agent.stop()}
        replaceInput={state === "recording" || state === "transcribing" ? <VoiceStrip level={level} pending={state === "transcribing"} /> : undefined}
        running={running}
        texts={texts}
        toolbarLeft={<HostButtons conversation={conversation} onMenu={() => setMenu(!menu)} onConversation={() => setConversation(!conversation)} />}
      />
      <p className="pill-help">Enter sendet. Shift+Enter fügt eine Zeile ein. Die Aufnahme ist simuliert.</p>
    </section>
    <PillStates />
  </div>;
}
