import { ReactNode, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { appearanceStyle, type ChatAppearance, type TimestampOptions, type CodeBlockOptions, type BubbleOptions, type MessageActionsOptions } from "./options";
import { timestampDate, formatTimestamp, timestampDay, formatDay } from "./timestamps";
import { MessageActions } from "./MessageActions";
import { ChatSendContext } from "./ChatSendContext";
import { ChatAnnouncement, compactToolLine, DetailMode, Message, prettyJson, stepState, ToolInfo } from "./types";
import { ChatTexts, defaultTexts } from "./texts";
import { Markdown, MarkdownLinks, MarkdownCodeBlocks, markdownPlainText, type LinkClickHandler } from "./Markdown";
import { announce as ansagen } from "./announce";
import { StepPopover } from "./StepPopover";
import { QuestionCard } from "./QuestionCard";
import { WorkingScenes } from "./WorkingScenes";
import { IconCheck, IconChevronDown, IconChevronRight, IconLayers, IconSpark, IconTool } from "./icons";

const collapseAtBottomFrom = 11;
const hoechstensAnsagenAufEinmal = 2;

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
  renderTool,
  onAnswerQuestion,
  onLinkClick,
  announce,
  emptyState,
  className,
  showTimestamps = false,
  bottomThreshold = 120,
  scrollerRef,
  appearance,
  timestampOptions,
  codeBlockOptions,
  bubbleOptions,
  messageActions,
}: {
  messages: Message[];
  appearance?: ChatAppearance;
  timestampOptions?: TimestampOptions;
  codeBlockOptions?: CodeBlockOptions;
  bubbleOptions?: BubbleOptions;
  messageActions?: MessageActionsOptions;
  detailMode?: DetailMode;
  running?: boolean;
  working?: ReactNode;
  /** Ohne neue Events verschwindet der Working-Indikator nach dieser Zeit, Default 20s. */
  workingTimeoutMs?: number;
  /** false = Denk- und Werkzeug-Schritte lassen sich nicht aufklappen (kein Popover). */
  stepsExpandable?: boolean;
  texts?: Partial<ChatTexts>;
  toolArgumentsText?: (tool: ToolInfo) => string;
  /** Eigene Darstellung fuer einzelne Werkzeuge; undefined = Standarddarstellung. */
  renderTool?: (tool: ToolInfo) => ReactNode | undefined;
  onAnswerQuestion?: (callId: string, text: string) => void;
  /** Faengt Klicks auf Markdown-Links ab; true = behandelt, der Browser folgt nicht. */
  onLinkClick?: LinkClickHandler;
  /** Screenreader-Ansage je fertiger Antwort und neuer Rückfrage: Default ist ihr Text, eine Funktion liefert eigenen Text (undefined = still), false schaltet ab. */
  announce?: false | ((announcement: ChatAnnouncement) => string | undefined);
  emptyState?: ReactNode;
  className?: string;
  /** true = dezente HH:MM-Spalte links an jedem Block (Message.at). */
  showTimestamps?: boolean;
  bottomThreshold?: number;
  /** Exposes the scroll container so hosts can scroll without querying the DOM. */
  scrollerRef?: (element: HTMLDivElement | null) => void;
}) {
  const alleTexte = { ...defaultTexts, ...texts };
  const scrollBereich = useRef<HTMLDivElement>(null);
  const [amEnde, setAmEnde] = useState(true);
  const folgt = useRef(amEnde);
  folgt.current = amEnde;
  const panel = useContext(ChatSendContext);
  useLayoutEffect(() => panel?.registerJump(() => {
    setAmEnde(true);
    const viewport = scrollBereich.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }), [panel]);
  const [now, setNow] = useState(Date.now);
  const relative = showTimestamps && timestampOptions?.format === "relative";
  useEffect(() => {
    if (!relative) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [relative]);

  // Der Indikator laeuft nur, solange wirklich Events eintreffen: jede Aenderung am Verlauf
  // gilt als Lebenszeichen, danach zaehlt der Timeout. Stop beendet ihn ohnehin (running).
  const [stromAktiv, setStromAktiv] = useState(true);
  useEffect(() => {
    setStromAktiv(true);
    const timer = window.setTimeout(() => setStromAktiv(false), workingTimeoutMs);
    return () => window.clearTimeout(timer);
  }, [messages, workingTimeoutMs]);

  // Der Verlauf beim Einhängen und ganze Schübe (Reset mit Replay) gelten als bekannt, nicht als neu.
  const angesagt = useRef<ReadonlySet<string>>(new Set(messages.map((message) => message.key)));
  useEffect(() => {
    const faellig = messages.filter((message, index) => !angesagt.current.has(message.key) && (
      message.role === "question"
        ? message.question !== undefined && message.question.answer === undefined
        : message.role === "assistant" && message.text.trim() !== "" && (message.closed === true || (!running && index === messages.length - 1))
    ));
    if (faellig.length === 0) {
      return;
    }
    angesagt.current = new Set([...angesagt.current, ...faellig.map((message) => message.key)]);
    if (announce === false || faellig.length > hoechstensAnsagenAufEinmal) {
      return;
    }
    faellig
      .map((message) => announce
        ? announce({ kind: message.role === "question" ? "question" : "reply", message })
        : markdownPlainText(message.text))
      .forEach((text) => text && ansagen(text));
  }, [messages, running, announce]);

  // Include content that fits without scrolling in the bottom tolerance.
  const pruefeEnde = useCallback(() => {
    const bereich = scrollBereich.current;
    if (bereich) {
      const abstandZumEnde = bereich.scrollHeight - bereich.scrollTop - bereich.clientHeight;
      setAmEnde(abstandZumEnde <= bottomThreshold);
    }
  }, [bottomThreshold]);

  // Wächst der Inhalt oder der Fußraum der Eingabe, bleibt ein folgender Verlauf am Ende.
  useEffect(() => {
    const bereich = scrollBereich.current;
    if (!bereich) {
      return;
    }
    const beobachter = new ResizeObserver(() => {
      if (folgt.current) {
        bereich.scrollTop = bereich.scrollHeight;
      } else {
        pruefeEnde();
      }
    });
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
    scrollBereich.current?.scrollTo({ top: scrollBereich.current.scrollHeight, behavior: running ? "auto" : "smooth" });
  }, [messages, running, amEnde]);

  const visible = useMemo(
    () =>
      messages.filter((message) => {
        if ((message.role === "thinking" || message.role === "assistant") && message.text.trim() === "") {
          return false;
        }
        if (message.role === "thinking" || message.role === "tool") {
          return detailMode !== "off";
        }
        return true;
      }),
    [messages, detailMode],
  );

  // Dezente HH:MM-Spalte links; ohne Zeitstempel bleibt der Block unverpackt.
  const zeitVon = (at: string | undefined) => {
    const date = timestampDate(at);
    return date ? formatTimestamp(date, timestampOptions, now) : "";
  };
  const mitZeit = (inhalt: ReactNode, key: string, at: string | undefined): ReactNode =>
    showTimestamps
      ? (
        <div className="qsl-line" key={`zeit-${key}`}>
          <time className="qsl-time" dateTime={timestampDate(at) ? at : undefined} style={timestampOptions?.format && timestampOptions.format !== "time" ? { width: "auto", maxWidth: "35%" } : undefined}>{zeitVon(at)}</time>
          <div className="qsl-line-body">{inhalt}</div>
        </div>
      )
      : inhalt;

  // In den Chip-Modi ruecken aufeinanderfolgende Schritte in eine umbrechende Zeile zusammen, gruppiert hinter eine aufklappbare Zeile.
  const chipModus = detailMode === "chips" || detailMode === "icons";
  const gruppenModus = detailMode === "grouped";
  const bloecke: ReactNode[] = [];
  let gruppe: Message[] = [];
  const schliesseGruppe = () => {
    if (gruppe.length > 0) {
      const letzterZustand = stepState(gruppe[gruppe.length - 1]);
      bloecke.push(mitZeit(
        gruppenModus ? (
          <StepGroup
            aktiv={running && (letzterZustand === "running" || letzterZustand === "thinking")}
            expandierbar={stepsExpandable}
            key={gruppe[0].key}
            messages={gruppe}
            texts={alleTexte}
            toolArgumentsText={toolArgumentsText}
          />
        ) : (
          <StepRow
            expandierbar={stepsExpandable}
            key={gruppe[0].key}
            messages={gruppe}
            mitText={detailMode === "chips"}
            texts={alleTexte}
            toolArgumentsText={toolArgumentsText}
          />
        ),
        gruppe[0].key,
        gruppe[0].at,
      ));
      gruppe = [];
    }
  };
  let currentDay: string | undefined;
  visible.forEach((message, index) => {
    const date = timestampOptions?.showDaySeparators ? timestampDate(message.at) : undefined;
    if (date) {
      const day = timestampDay(date, timestampOptions?.timeZone);
      if (day !== currentDay) {
        schliesseGruppe();
        bloecke.push(<div className="qsl-day-separator" role="separator" key={`day-${message.key}`} aria-label={formatDay(date, timestampOptions)}>{formatDay(date, timestampOptions)}</div>);
        currentDay = day;
      }
    }
    const eigeneDarstellung = message.role === "tool" && message.tool ? renderTool?.(message.tool) : undefined;
    if (eigeneDarstellung !== undefined) {
      schliesseGruppe();
      bloecke.push(mitZeit(
        <div className="qsl-step" key={message.key}>
          {eigeneDarstellung}
        </div>,
        message.key,
        message.at,
      ));
      return;
    }
    if ((chipModus || gruppenModus) && istSchritt(message)) {
      gruppe = [...gruppe, message];
      return;
    }
    schliesseGruppe();
    bloecke.push(mitZeit(
      <Bubble
        detailMode={detailMode}
        dicht={istSchritt(message) && istSchritt(visible[index - 1])}
        expandierbar={stepsExpandable}
        key={message.key}
        message={message}
        bubbleOptions={bubbleOptions}
        messageActions={messageActions}
        texts={alleTexte}
        toolArgumentsText={toolArgumentsText}
        onAnswerQuestion={onAnswerQuestion}
      />,
      message.key,
      message.at,
    ));
  });
  schliesseGruppe();

  const verlauf = (
    <div className={className ? `qsl-chat-wrap ${className}` : "qsl-chat-wrap"} style={appearanceStyle(appearance)}>
      <div
        className="qsl-chat"
        onScroll={pruefeEnde}
        ref={(element) => {
          scrollBereich.current = element;
          scrollerRef?.(element);
        }}
      >
        {visible.length === 0 && !running ? (
          emptyState ?? null
        ) : (
          <div aria-busy={running || undefined} className="qsl-thread">
            {bloecke}
            {running && stromAktiv && (working ?? <WorkingScenes label={alleTexte.working} />)}
          </div>
        )}
      </div>
      {!amEnde && (
        <div className="qsl-jump">
          <button aria-label={alleTexte.jumpToEnd} onClick={() => scrollBereich.current?.scrollTo({ top: scrollBereich.current.scrollHeight, behavior: "smooth" })} type="button">
            <IconChevronDown />
          </button>
        </div>
      )}
    </div>
  );

  return <MarkdownLinks onLinkClick={onLinkClick}><MarkdownCodeBlocks options={codeBlockOptions} texts={texts}>{verlauf}</MarkdownCodeBlocks></MarkdownLinks>;
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
        const state = stepState(message);
        const running = state === "running" || state === "thinking";
        const label = thinking ? texts.thinkingChip : tool?.name ?? message.text;
        const content = (
          <>
            {thinking ? (
              <IconSpark size={11} />
            ) : (
              <IconTool className={tool?.isError ? "qsl-chip__icon--error" : undefined} size={11} />
            )}
            {mitText && <span className="qsl-chip__label">{label}</span>}
            {mitText && <span className="qsl-chip__state">{state === "done" && <IconCheck size={10} />}</span>}
          </>
        );
        const classes = `${mitText ? "" : " qsl-chip--icon"} qsl-chip--${state}${running ? " qsl-pulse" : ""}`;
        if (!expandierbar) {
          return (
            <span className={`qsl-chip qsl-chip--still${classes}`} key={message.key} title={label}>
              {content}
            </span>
          );
        }
        return (
          <button
            aria-haspopup="dialog"
            className={`qsl-chip${classes}`}
            key={message.key}
            onClick={(event) => setDetail({ key: message.key, position: { x: event.clientX, y: event.clientY } })}
            title={label}
            type="button"
          >
            {content}
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

/** Aufeinanderfolgende Schritte hinter einer Kopfzeile; aufgeklappt stehen sie einzeilig darunter. */
function StepGroup({
  messages,
  aktiv,
  expandierbar,
  texts,
  toolArgumentsText,
}: {
  messages: Message[];
  aktiv: boolean;
  expandierbar: boolean;
  texts: ChatTexts;
  toolArgumentsText: (tool: ToolInfo) => string;
}) {
  const [offen, setOffen] = useState(false);
  const kopf = useRef<HTMLButtonElement>(null);
  const vonUntenEingeklappt = useRef(false);
  useLayoutEffect(() => {
    if (!offen && vonUntenEingeklappt.current) {
      vonUntenEingeklappt.current = false;
      kopf.current?.scrollIntoView({ block: "nearest" });
    }
  }, [offen]);
  const letzte = messages[messages.length - 1];
  const fehler = messages.some((message) => message.tool?.isError);
  const anzahl = messages.length === 1 ? texts.stepGroupOne : texts.stepGroupMany.replace("{count}", String(messages.length));
  const laufend = aktiv ? (letzte.role === "thinking" ? texts.thinkingChip : letzte.tool?.name ?? letzte.text) : undefined;

  return (
    <div className="qsl-step qsl-stepgroup">
      <button
        aria-expanded={offen}
        className={`qsl-trace qsl-trace--compact qsl-stepgroup__toggle${aktiv ? " qsl-pulse" : ""}`}
        onClick={() => setOffen((wert) => !wert)}
        ref={kopf}
        type="button"
      >
        <IconChevronRight className="qsl-stepgroup__chevron" size={12} />
        <IconLayers className={fehler ? "qsl-trace__icon qsl-trace__icon--error" : "qsl-trace__icon"} size={12} />
        <span className="qsl-trace__line">
          {anzahl}
          {laufend && <span className="qsl-trace__running">{laufend} {texts.toolRunning}</span>}
        </span>
      </button>
      {offen && (
        <div className="qsl-stepgroup__lines">
          {messages.map((message) => (
            <TraceLine expandierbar={expandierbar} key={message.key} message={message} texts={texts} toolArgumentsText={toolArgumentsText} />
          ))}
          {messages.length >= collapseAtBottomFrom && (
            <button
              className="qsl-trace qsl-trace--compact qsl-stepgroup__toggle qsl-stepgroup__collapse"
              onClick={() => {
                vonUntenEingeklappt.current = true;
                setOffen(false);
              }}
              type="button"
            >
              <IconChevronRight className="qsl-stepgroup__chevron" size={12} />
              <span className="qsl-trace__line">{texts.stepGroupCollapse}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Ein Schritt als eine Zeile; mit Freigabe oeffnet ein Klick die Details im Popover. */
function TraceLine({
  message,
  className,
  expandierbar,
  texts,
  toolArgumentsText,
}: {
  message: Message;
  className?: string;
  expandierbar: boolean;
  texts: ChatTexts;
  toolArgumentsText: (tool: ToolInfo) => string;
}) {
  const [detailPosition, setDetailPosition] = useState<{ x: number; y: number }>();
  const classes = `${className ? `${className} ` : ""}qsl-trace qsl-trace--compact${message.role === "thinking" ? " qsl-trace--thinking" : ""}`;
  const inhalt = (
    <>
      <TraceIcon message={message} />
      <span className="qsl-trace__line"><TraceText message={message} texts={texts} /></span>
    </>
  );
  if (!expandierbar) {
    return <div className={classes}>{inhalt}</div>;
  }
  return (
    <>
      <button
        aria-expanded={detailPosition !== undefined}
        aria-haspopup="dialog"
        className={classes}
        onClick={(event) => setDetailPosition({ x: event.clientX, y: event.clientY })}
        type="button"
      >
        {inhalt}
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

function TraceIcon({ message }: { message: Message }) {
  return message.role === "thinking"
    ? <IconSpark className="qsl-trace__icon" size={12} />
    : <IconTool className={message.tool?.isError ? "qsl-trace__icon qsl-trace__icon--error" : "qsl-trace__icon"} size={12} />;
}

function TraceText({ message, texts }: { message: Message; texts: ChatTexts }) {
  return (
    <>
      {message.text}
      {message.tool && message.tool.result === undefined && <span className="qsl-trace__running">{texts.toolRunning}</span>}
    </>
  );
}

function Bubble({
  message,
  bubbleOptions,
  messageActions,
  detailMode,
  dicht,
  expandierbar,
  texts,
  toolArgumentsText,
  onAnswerQuestion,
}: {
  message: Message;
  bubbleOptions?: BubbleOptions;
  messageActions?: MessageActionsOptions;
  detailMode: DetailMode;
  dicht: boolean;
  expandierbar: boolean;
  texts: ChatTexts;
  toolArgumentsText: (tool: ToolInfo) => string;
  onAnswerQuestion?: (callId: string, text: string) => void;
}) {
  const schritt = dicht ? "qsl-step qsl-step--dense" : "qsl-step";

  if (message.role === "thinking" || (message.role === "tool" && message.tool)) {
    if (detailMode === "compact") {
      return <TraceLine className={schritt} expandierbar={expandierbar} message={message} texts={texts} toolArgumentsText={toolArgumentsText} />;
    }
    const tool = message.tool;
    return (
      <div className={`${schritt} qsl-trace${message.role === "thinking" ? " qsl-trace--thinking" : ""}`}>
        <TraceIcon message={message} />
        <div className="qsl-trace__body">
          <div className="qsl-trace__line"><TraceText message={message} texts={texts} /></div>
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
          texts={texts}
          onAnswer={(text) => onAnswerQuestion?.(message.question!.callId, text)}
        />
      </div>
    );
  }

  if (message.role === "system") {
    return (
      <div className={`${schritt} qsl-system`}>
        <Markdown text={message.text} />
      </div>
    );
  }

  const content = message.text.trim();
  if (!content && message.role !== "user") return null;
  const plain = bubbleOptions?.variant === "plain";
  const isBubble = !plain && (message.role === "user" || message.bubble || bubbleOptions?.variant === "bubbles");
  const side = (message.role === "user" ? bubbleOptions?.userSide : bubbleOptions?.assistantSide)
    ?? message.bubble?.side ?? (message.role === "user" ? "end" : "start");
  const label = bubbleOptions?.showSender === false ? undefined
    : bubbleOptions?.senderLabel?.(message) ?? message.bubble?.label ?? (bubbleOptions?.showSender ? message.role : undefined);
  const body = <>
    {label && <span className="qsl-bubble__label">{label}</span>}
    <Markdown text={message.role === "user" ? message.text : content} />
    <MessageActions message={message} options={messageActions} texts={texts} />
  </>;
  if (isBubble) {
    const user = message.role === "user" && !message.bubble;
    return <div className={`${schritt} ${user ? "qsl-user" : "qsl-bubble"}`} style={{ justifyContent: side === "end" ? "flex-end" : "flex-start" }}>
      <div style={{ background: message.bubble?.color ?? (user ? undefined : "var(--qsl-accent)"), maxWidth: bubbleOptions?.maxWidth }}>
        {body}
      </div>
    </div>;
  }
  return <div className={`${schritt} qsl-answer`}>{body}</div>;
}
