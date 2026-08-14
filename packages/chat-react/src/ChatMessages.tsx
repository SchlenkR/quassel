import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { compactToolLine, DetailMode, Message, prettyJson, ToolInfo } from "./types";
import { ChatTexts, defaultTexts } from "./texts";
import { Markdown } from "./Markdown";
import { StepPopover } from "./StepPopover";
import { QuestionCard } from "./QuestionCard";
import { WorkingScenes } from "./WorkingScenes";
import { IconChevronDown, IconSpark, IconTool } from "./icons";

function istSchritt(message?: Message): boolean {
  return !!message && (message.role === "thinking" || message.role === "tool");
}

function defaultArgumentsText(tool: ToolInfo): string {
  return prettyJson(tool.arguments);
}

/**
 * Der Verlauf: eigener Scroll-Container mit Autoscroll, solange man unten ist,
 * und einem Zum-Ende-Knopf, sobald man liest. Ohne Eingabe read-only nutzbar.
 */
export function ChatMessages({
  messages,
  detailMode = "compact",
  running = false,
  working,
  workingTimeoutMs = 20000,
  stepsExpandable = true,
  texts,
  toolArgumentsText = defaultArgumentsText,
  onAnswerQuestion,
  emptyState,
  className,
}: {
  messages: Message[];
  detailMode?: DetailMode;
  running?: boolean;
  working?: ReactNode;
  /** Ohne neue Events verschwindet der Working-Indikator nach dieser Zeit, Default 20s. */
  workingTimeoutMs?: number;
  /** false = Denk- und Werkzeug-Schritte lassen sich nicht aufklappen (kein Popover). */
  stepsExpandable?: boolean;
  texts?: Partial<ChatTexts>;
  toolArgumentsText?: (tool: ToolInfo) => string;
  onAnswerQuestion?: (callId: string, text: string) => void;
  emptyState?: ReactNode;
  className?: string;
}) {
  const alleTexte = { ...defaultTexts, ...texts };
  const scrollBereich = useRef<HTMLDivElement>(null);
  const ende = useRef<HTMLDivElement>(null);
  const [amEnde, setAmEnde] = useState(true);

  // Der Indikator laeuft nur, solange wirklich Events eintreffen: jede Aenderung am Verlauf
  // gilt als Lebenszeichen, danach zaehlt der Timeout. Stop beendet ihn ohnehin (running).
  const [stromAktiv, setStromAktiv] = useState(true);
  useEffect(() => {
    setStromAktiv(true);
    const timer = window.setTimeout(() => setStromAktiv(false), workingTimeoutMs);
    return () => window.clearTimeout(timer);
  }, [messages, workingTimeoutMs]);

  // Ein paar Pixel Spielraum: exakt am Ende ist man durch Rundung selten. Passt der ganze
  // Verlauf ins Fenster, gibt es kein Unten - dann gilt man als angekommen.
  const pruefeEnde = useCallback(() => {
    const bereich = scrollBereich.current;
    if (bereich) {
      const scrollbar = bereich.scrollHeight - bereich.clientHeight > 24;
      const unten = bereich.scrollHeight - bereich.scrollTop - bereich.clientHeight < 24;
      setAmEnde(!scrollbar || unten);
    }
  }, []);

  // Beim Streamen waechst der Inhalt, ohne dass jemand scrollt - ohne diesen Beobachter bliebe
  // die Antwort auf "bin ich unten?" stehen und der Knopf sichtbar, obwohl man unten ist.
  useEffect(() => {
    const bereich = scrollBereich.current;
    if (!bereich) {
      return;
    }
    const beobachter = new ResizeObserver(pruefeEnde);
    beobachter.observe(bereich);
    for (const kind of bereich.children) {
      beobachter.observe(kind);
    }
    return () => beobachter.disconnect();
  }, [pruefeEnde, messages.length]);

  useEffect(() => {
    if (!amEnde) {
      return;
    }
    ende.current?.scrollIntoView({ behavior: running ? "auto" : "smooth" });
  }, [messages, running, amEnde]);

  const visible = useMemo(
    () =>
      messages.filter((message) => {
        if (message.role === "thinking" && message.text.trim() === "") {
          return false;
        }
        if (message.role === "thinking" || message.role === "tool") {
          return detailMode !== "off";
        }
        return true;
      }),
    [messages, detailMode],
  );

  // In den Chip-Modi ruecken aufeinanderfolgende Schritte in eine umbrechende Zeile zusammen.
  const chipModus = detailMode === "chips" || detailMode === "icons";
  const bloecke: ReactNode[] = [];
  let gruppe: Message[] = [];
  const schliesseGruppe = () => {
    if (gruppe.length > 0) {
      bloecke.push(
        <StepRow
          expandierbar={stepsExpandable}
          key={gruppe[0].key}
          messages={gruppe}
          mitText={detailMode === "chips"}
          texts={alleTexte}
          toolArgumentsText={toolArgumentsText}
        />,
      );
      gruppe = [];
    }
  };
  visible.forEach((message, index) => {
    if (chipModus && istSchritt(message)) {
      gruppe = [...gruppe, message];
      return;
    }
    schliesseGruppe();
    bloecke.push(
      <Bubble
        detailMode={detailMode}
        dicht={istSchritt(message) && istSchritt(visible[index - 1])}
        expandierbar={stepsExpandable}
        key={message.key}
        message={message}
        texts={alleTexte}
        toolArgumentsText={toolArgumentsText}
        onAnswerQuestion={onAnswerQuestion}
      />,
    );
  });
  schliesseGruppe();

  return (
    <div className={className ? `qsl-chat ${className}` : "qsl-chat"} onScroll={pruefeEnde} ref={scrollBereich}>
      {visible.length === 0 && !running ? (
        emptyState ?? null
      ) : (
        <div aria-live="polite" className="qsl-thread">
          {bloecke}
          {running && stromAktiv && (working ?? <WorkingScenes label={alleTexte.working} />)}
          <div ref={ende} />
        </div>
      )}
      {!amEnde && (
        <div className="qsl-jump">
          <button aria-label={alleTexte.jumpToEnd} onClick={() => ende.current?.scrollIntoView({ behavior: "smooth" })} type="button">
            <IconChevronDown />
          </button>
        </div>
      )}
    </div>
  );
}

/** Aufeinanderfolgende Schritte als Chips nebeneinander; bei Platzmangel bricht die Zeile um. */
function StepRow({
  messages,
  mitText,
  expandierbar,
  texts,
  toolArgumentsText,
}: {
  messages: Message[];
  mitText: boolean;
  expandierbar: boolean;
  texts: ChatTexts;
  toolArgumentsText: (tool: ToolInfo) => string;
}) {
  const [detail, setDetail] = useState<{ key: string; position: { x: number; y: number } }>();
  const offen = expandierbar && detail && messages.find((message) => message.key === detail.key);

  return (
    <div className="qsl-step qsl-steprow">
      {messages.map((message) => {
        const thinking = message.role === "thinking";
        const tool = message.tool;
        const laeuft = tool !== undefined && tool.result === undefined;
        const label = thinking ? texts.thinkingChip : tool?.name ?? message.text;
        if (!expandierbar) {
          return (
            <span
              className={`qsl-chip qsl-chip--still${mitText ? "" : " qsl-chip--icon"}${laeuft ? " qsl-pulse" : ""}`}
              key={message.key}
              title={label}
            >
              {thinking ? (
                <IconSpark size={11} />
              ) : (
                <IconTool className={tool?.isError ? "qsl-chip__icon--error" : undefined} size={11} />
              )}
              {mitText && <span className="qsl-chip__label">{label}</span>}
            </span>
          );
        }
        return (
          <button
            aria-haspopup="dialog"
            className={`qsl-chip${mitText ? "" : " qsl-chip--icon"}${laeuft ? " qsl-pulse" : ""}`}
            key={message.key}
            onClick={(event) => setDetail({ key: message.key, position: { x: event.clientX, y: event.clientY } })}
            title={label}
            type="button"
          >
            {thinking ? (
              <IconSpark size={11} />
            ) : (
              <IconTool className={tool?.isError ? "qsl-chip__icon--error" : undefined} size={11} />
            )}
            {mitText && <span className="qsl-chip__label">{label}</span>}
          </button>
        );
      })}
      {offen && detail && (
        <StepPopover
          message={offen}
          position={detail.position}
          texts={texts}
          toolArgumentsText={toolArgumentsText}
          onClose={() => setDetail(undefined)}
        />
      )}
    </div>
  );
}

function Bubble({
  message,
  detailMode,
  dicht,
  expandierbar,
  texts,
  toolArgumentsText,
  onAnswerQuestion,
}: {
  message: Message;
  detailMode: DetailMode;
  dicht: boolean;
  expandierbar: boolean;
  texts: ChatTexts;
  toolArgumentsText: (tool: ToolInfo) => string;
  onAnswerQuestion?: (callId: string, text: string) => void;
}) {
  const [detailPosition, setDetailPosition] = useState<{ x: number; y: number }>();

  useEffect(() => {
    if (detailMode !== "compact") {
      setDetailPosition(undefined);
    }
  }, [detailMode]);

  const schritt = dicht ? "qsl-step qsl-step--dense" : "qsl-step";

  if (message.role === "thinking" || (message.role === "tool" && message.tool)) {
    const thinking = message.role === "thinking";
    const tool = message.tool;
    const icon = thinking ? (
      <IconSpark className="qsl-trace__icon" size={12} />
    ) : (
      <IconTool className={tool?.isError ? "qsl-trace__icon qsl-trace__icon--error" : "qsl-trace__icon"} size={12} />
    );
    const zeile = (
      <>
        {message.text}
        {tool && tool.result === undefined && <span className="qsl-trace__running">{texts.toolRunning}</span>}
      </>
    );

    if (detailMode === "compact") {
      if (!expandierbar) {
        return (
          <div className={`${schritt} qsl-trace qsl-trace--compact${thinking ? " qsl-trace--thinking" : ""}`}>
            {icon}
            <span className="qsl-trace__line">{zeile}</span>
          </div>
        );
      }
      return (
        <>
          <button
            aria-expanded={detailPosition !== undefined}
            aria-haspopup="dialog"
            className={`${schritt} qsl-trace qsl-trace--compact${thinking ? " qsl-trace--thinking" : ""}`}
            onClick={(event) => setDetailPosition({ x: event.clientX, y: event.clientY })}
            type="button"
          >
            {icon}
            <span className="qsl-trace__line">{zeile}</span>
          </button>
          {detailPosition && (
            <StepPopover
              message={message}
              position={detailPosition}
              texts={texts}
              toolArgumentsText={toolArgumentsText}
              onClose={() => setDetailPosition(undefined)}
            />
          )}
        </>
      );
    }
    return (
      <div className={`${schritt} qsl-trace${thinking ? " qsl-trace--thinking" : ""}`}>
        {icon}
        <div className="qsl-trace__body">
          <div className="qsl-trace__line">{zeile}</div>
          {tool && (
            <div className="qsl-details">
              <pre>{toolArgumentsText(tool)}</pre>
              {tool.result !== undefined && (
                <pre className={tool.isError ? "qsl-details__pre--error" : undefined}>{prettyJson(tool.result)}</pre>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (message.role === "question" && message.question) {
    return (
      <div className={schritt}>
        <QuestionCard
          question={message.question}
          text={message.text}
          onAnswer={(text) => onAnswerQuestion?.(message.question!.callId, text)}
        />
      </div>
    );
  }

  if (message.role === "system") {
    return <div className={`${schritt} qsl-system`}>{message.text}</div>;
  }

  if (message.role === "user") {
    return (
      <div className={`${schritt} qsl-user`}>
        <div>{message.text}</div>
      </div>
    );
  }

  const inhalt = message.text.trim();
  if (!inhalt) {
    return null;
  }
  return (
    <div className={`${schritt} qsl-answer`}>
      <Markdown text={inhalt} />
    </div>
  );
}
