import { cn } from "./ui/cn";
import { type CSSProperties, ReactNode, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createChatScroll } from "./chat-scroll";
import { ChatAnnouncement, DetailMode, Message, PendingAction, prettyJson, stepState, ToolInfo } from "./types";
import { ChatTexts, defaultTexts } from "./texts";
import { Markdown, MarkdownCodeBlocks, MarkdownLinks, markdownPlainText, type LinkClickHandler } from "./Markdown";
import { StepPopover } from "./StepPopover";
import { PendingActionCard } from "./PendingActionCard";
import { WorkingScenes } from "./WorkingScenes";
import { attachmentDownloadUrl, formatAttachmentSize } from "./attachments";
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, LayersIcon, SparklesIcon, WrenchIcon } from "lucide-react";
import { appearanceStyle, type ChatAppearance, type TimestampOptions, type CodeBlockOptions, type BubbleOptions, type MessageActionsOptions } from "./options";
import { messageDate, timestampDay, timestampLabel } from "./timestamps";
import { formatElapsed, useElapsed } from "./elapsed";
import { MessageActions } from "./MessageActions";
import { ChatSendContext } from "./ChatSendContext";
import { ChatActionDock } from "./ChatActionDock";
import { announce as announceText } from "./announce";
import { useQuasselComponents } from "./QuasselProvider";

const stepClasses = "qsl:mt-[var(--qsl-chat-message-gap,16px)]";
const denseStepClasses = "qsl:mt-[var(--qsl-chat-dense-message-gap,8px)]";

const traceClasses = "qsl:flex qsl:w-full qsl:gap-2 qsl:pl-6 qsl:text-left qsl:text-trace qsl:leading-[1.375] qsl:text-muted-foreground";
const traceButtonClasses = "qsl:cursor-pointer qsl:rounded-md qsl:py-1 qsl:pr-2 qsl:transition-colors qsl:hover:bg-secondary qsl:hover:text-foreground qsl:focus-visible:bg-secondary qsl:focus-visible:text-foreground qsl:focus-visible:outline-none";
const traceIconClasses = "qsl:mt-0.5 qsl:flex-none qsl:opacity-60";
const traceErrorIconClasses = "qsl:mt-0.5 qsl:flex-none qsl:text-destructive qsl:opacity-100";
const traceLineClasses = "qsl:min-w-0 qsl:self-baseline qsl:font-mono qsl:[overflow-wrap:anywhere]";
const traceRunningClasses = "qsl:ml-1.5 qsl:opacity-60";

const chipClasses = cn(
  "qsl:inline-flex qsl:max-w-[220px] qsl:items-center qsl:gap-[5px] qsl:rounded-full qsl:border qsl:border-border-soft qsl:px-2.5 qsl:py-0.5",
  "qsl:font-mono qsl:text-meta qsl:leading-[1.6] qsl:text-muted-foreground qsl:transition-colors",
  "qsl:data-[state=running]:border-[color-mix(in_srgb,var(--qsl-primary)_40%,var(--qsl-border-soft))]",
  "qsl:data-[state=thinking]:border-[color-mix(in_srgb,var(--qsl-primary)_40%,var(--qsl-border-soft))]",
  "qsl:data-[state=error]:border-[color-mix(in_srgb,var(--qsl-destructive)_45%,var(--qsl-border-soft))]",
  "qsl:data-[state=done]:opacity-85",
);
const chipInteractiveClasses = "qsl:cursor-pointer qsl:hover:border-border qsl:hover:bg-secondary qsl:hover:text-foreground qsl:focus-visible:border-border qsl:focus-visible:bg-secondary qsl:focus-visible:text-foreground qsl:focus-visible:outline-none qsl:data-[state=done]:hover:opacity-100 qsl:data-[state=done]:focus-visible:opacity-100";

const collapseAtBottomFrom = 11;

const maxAnnouncementsAtOnce = 2;

const bubbleBodyClasses = "qsl:relative qsl:max-w-[86%] qsl:px-3 qsl:py-2 qsl:leading-[var(--qsl-chat-line-height,1.625)] qsl:[overflow-wrap:anywhere] qsl:@max-[620px]/chat:max-w-full";

function isStep(message?: Message): boolean {
  return !!message && (message.role === "thinking" || message.role === "tool");
}

function isOpenAction(message: Message): message is Message & { action: PendingAction } {
  return message.role === "action" && message.action !== undefined && message.action.status === undefined;
}

function defaultArgumentsText(tool: ToolInfo): string {
  return prettyJson(tool.arguments);
}

/**
 * The transcript: its own scroll container with autoscroll while you are at the bottom, and a
 * jump-to-end button as soon as you are reading. Usable read-only without a composer.
 */
export function ChatMessages({
  messages,
  owner,
  detailMode = "current",
  running = false,
  working,
  stepsExpandable = true,
  texts,
  toolArgumentsText = defaultArgumentsText,
  renderTool,
  renderAction,
  onDismissAction,
  onLinkClick,
  emptyState,
  className,
  scrollerClassName,
  showTimestamps = false,
  announce,
  scrollerRef,
  maxWidth,
  horizontalPadding,
  jumpToEndThreshold = 120,
  appearance,
  timestampOptions,
  codeBlockOptions,
  bubbleOptions,
  messageActions,
  toolElapsedThreshold = 3000,
}: {
  messages: Message[];
  /** Contributions with this Message.sender appear without a speech bubble; null keeps the message defaults. */
  owner?: string | null;
  detailMode?: DetailMode;
  running?: boolean;
  working?: ReactNode;
  /** false = thinking and tool steps cannot be expanded (no popover). */
  stepsExpandable?: boolean;
  texts?: Partial<ChatTexts>;
  toolArgumentsText?: (tool: ToolInfo) => string;
  /** Custom rendering for single tools; undefined = default rendering. */
  renderTool?: (tool: ToolInfo) => ReactNode | undefined;
  /** Rendering of a pending action by its owner; undefined = generic card. */
  renderAction?: (action: PendingAction, text: string) => ReactNode | undefined;
  onDismissAction?: (actionId: string) => void;
  /** Intercepts clicks on Markdown links; true = handled, the browser does not follow. */
  onLinkClick?: LinkClickHandler;
  emptyState?: ReactNode;
  className?: string;
  /** Host classes for the scroll container (data-quassel-transcript). */
  scrollerClassName?: string;
  /** true = subtle HH:MM column to the left of each block (Message.at). */
  showTimestamps?: boolean;
  /** Screen reader announcement of finished answers and new actions; false = the host announces itself. */
  announce?: false | ((announcement: ChatAnnouncement) => string | undefined);
  /** Exposes the scroll container so hosts can scroll without querying the DOM. */
  scrollerRef?: (element: HTMLDivElement | null) => void;
  maxWidth?: CSSProperties["maxWidth"];
  horizontalPadding?: CSSProperties["paddingInline"];
  jumpToEndThreshold?: number;
  appearance?: ChatAppearance;
  timestampOptions?: TimestampOptions;
  codeBlockOptions?: CodeBlockOptions;
  bubbleOptions?: BubbleOptions;
  messageActions?: MessageActionsOptions;
  /** Milliseconds before a running tool call shows its elapsed time (from Message.at) while running; false = never. */
  toolElapsedThreshold?: number | false;
}) {
  const allTexts = { ...defaultTexts, ...texts };
  const { Button } = useQuasselComponents();
  const scrollArea = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const scrollbarDragging = useRef(false);
  const touchY = useRef<number | undefined>(undefined);
  const [showJumpToEnd, setShowJumpToEnd] = useState(false);
  const [scroll] = useState(() => createChatScroll());
  const sendScope = useContext(ChatSendContext);
  const dock = useContext(ChatActionDock);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!showTimestamps || timestampOptions?.format !== "relative") return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [showTimestamps, timestampOptions?.format]);

  // The transcript at mount time and whole batches (reset with replay) count as known, not as new.
  const announced = useRef<ReadonlySet<string>>(new Set(messages.map((message) => message.key)));
  useEffect(() => {
    const due = messages.filter((message, index) => !announced.current.has(message.key) && (
      message.role === "action"
        ? isOpenAction(message)
        : message.role === "assistant" && message.text.trim() !== "" && (message.closed === true || (!running && index === messages.length - 1))
    ));
    if (due.length === 0) {
      return;
    }
    announced.current = new Set([...announced.current, ...due.map((message) => message.key)]);
    if (announce === false || due.length > maxAnnouncementsAtOnce) {
      return;
    }
    due
      .map((message) => announce
        ? announce({ kind: message.role === "action" ? "action" : "reply", message })
        : markdownPlainText(message.text))
      .forEach((text) => text && announceText(text));
  }, [messages, running, announce]);
  const updateJumpVisibility = useCallback((viewport: HTMLDivElement) => {
    if (viewport.clientHeight > 0) setShowJumpToEnd(viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop > jumpToEndThreshold);
  }, [jumpToEndThreshold]);
  useLayoutEffect(() => sendScope?.subscribe(() => {
    const viewport = scrollArea.current;
    if (!viewport) return;
    scroll.jump(viewport);
    updateJumpVisibility(viewport);
  }), [sendScope, scroll, updateJumpVisibility]);

  const pauseUp = (viewport: HTMLDivElement, target: EventTarget) => {
    let element = target instanceof Element ? target : null;
    while (element && element !== viewport) {
      if (element.scrollTop > 0 && /auto|scroll/.test(getComputedStyle(element).overflowY)) return;
      element = element.parentElement;
    }
    scroll.pause(viewport);
  };

  const checkEnd = useCallback(() => {
    const area = scrollArea.current;
    if (area) {
      scroll.scroll(area, scrollbarDragging.current);
      updateJumpVisibility(area);
    }
  }, [scroll, updateJumpVisibility]);

  useEffect(() => {
    const finishDrag = () => {
      if (scrollbarDragging.current && scrollArea.current) scroll.scroll(scrollArea.current, true);
      scrollbarDragging.current = false;
    };
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
    return () => {
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [scroll]);

  // Content growth does not change the follow mode; lazily loaded media and the composer count too.
  useLayoutEffect(() => {
    const area = scrollArea.current;
    if (!area) return;
    const align = () => {
      scroll.layout(area, scrollbarDragging.current);
      updateJumpVisibility(area);
    };
    align();
    const observer = new ResizeObserver(align);
    observer.observe(area);
    if (threadRef.current) observer.observe(threadRef.current, { box: "border-box" });
    return () => observer.disconnect();
  });

  const visible = useMemo(
    () => {
      // Your own inputs after the running step do not end it; any other message does.
      const lastNonUser = messages.reduce((last, message, index) => message.role === "user" ? last : index, -1);
      return messages.filter((message, index) => {
        if (dock !== undefined && isOpenAction(message)) {
          return false;
        }
        if (detailMode === "current" && isStep(message)) {
          return running && index === lastNonUser
            && (message.role === "thinking" ? !message.closed : stepState(message) === "running");
        }
        if ((message.role === "thinking" || message.role === "assistant") && message.text.trim() === "" && !message.attachments?.length) {
          return false;
        }
        if (message.role === "thinking" || message.role === "tool") {
          return detailMode !== "off";
        }
        return true;
      });
    },
    [messages, detailMode, running, dock],
  );
  const openActions = dock ? messages.filter(isOpenAction) : [];

  const withTime = (content: ReactNode, key: string, at: string | undefined, dense = false): ReactNode =>
    showTimestamps
      ? (
        <div className={cn("qsl:flex qsl:items-baseline qsl:gap-2", dense ? denseStepClasses : stepClasses)} key={`time-${key}`}>
          <time dateTime={messageDate(at)?.toISOString()} className={cn("qsl:flex-none qsl:text-meta qsl:tabular-nums qsl:text-muted-foreground qsl:opacity-85",
            timestampOptions?.format && timestampOptions.format !== "time" ? "qsl:w-[clamp(60px,20%,120px)]" : "qsl:w-[34px]")}>
            {messageDate(at) ? timestampLabel(messageDate(at)!, timestampOptions, now) : ""}
          </time>
          <div className="qsl:min-w-0 qsl:flex-1 qsl:[&>*:first-child]:mt-0">{content}</div>
        </div>
      )
      : content;

  // In the chip modes consecutive steps move together into one wrapping line, in grouped mode into one expandable line.
  const chipMode = detailMode === "current" || detailMode === "chips" || detailMode === "icons";
  const elapsedAfter = running && toolElapsedThreshold !== false ? toolElapsedThreshold : undefined;
  const groupMode = detailMode === "grouped";
  const blocks: ReactNode[] = [];
  let lastDay: string | undefined;
  let group: Message[] = [];
  const closeGroup = () => {
    if (group.length > 0) {
      const runningStep = running ? [...group].reverse().find((message) => ["running", "thinking"].includes(stepState(message))) : undefined;
      blocks.push(withTime(
        groupMode ? (
          <StepGroup
            elapsedAfter={elapsedAfter}
            expandable={stepsExpandable}
            runningStep={runningStep}
            key={group[0].key}
            messages={group}
            texts={allTexts}
            toolArgumentsText={toolArgumentsText}
          />
        ) : (
          <StepRow
            elapsedAfter={elapsedAfter}
            expandable={stepsExpandable}
            key={group[0].key}
            messages={group}
            withText={detailMode !== "icons"}
            texts={allTexts}
            toolArgumentsText={toolArgumentsText}
            toolLabel={detailMode === "current" && !stepsExpandable ? allTexts.currentTool : undefined}
          />
        ),
        group[0].key,
        group[0].at,
      ));
      group = [];
    }
  };
  visible.forEach((message, index) => {
    const date = timestampOptions?.showDaySeparators ? messageDate(message.at) : undefined;
    if (date) {
      const day = timestampDay(date, timestampOptions);
      if (day.key !== lastDay) {
        closeGroup();
        blocks.push(<div className={cn(stepClasses, "qsl:text-center qsl:text-xs qsl:text-muted-foreground")} data-chat="day-separator" data-day={day.key} key={`day-${message.key}`}>{day.label}</div>);
        lastDay = day.key;
      }
    }
    const customRendering = message.role === "tool" && message.tool && detailMode !== "current" ? renderTool?.(message.tool) : undefined;
    if (customRendering !== undefined) {
      closeGroup();
      blocks.push(withTime(
        <div className={stepClasses} key={message.key}>
          {customRendering}
        </div>,
        message.key,
        message.at,
      ));
      return;
    }
    if ((chipMode || groupMode) && isStep(message)) {
      group = [...group, message];
      return;
    }
    closeGroup();
    const dense = isStep(message) && isStep(visible[index - 1]);
    blocks.push(withTime(
      <Bubble
        detailMode={detailMode}
        dense={dense}
        elapsedAfter={elapsedAfter}
        expandable={stepsExpandable}
        key={message.key}
        message={message}
        plain={owner != null && message.sender === owner}
        texts={allTexts}
        toolArgumentsText={toolArgumentsText}
        renderAction={renderAction}
        onDismissAction={onDismissAction}
        bubbleOptions={bubbleOptions}
        messageActions={messageActions}
      />,
      message.key,
      message.at,
      dense,
    ));
  });
  closeGroup();

  const transcript = (
    <div className={cn("qsl:@container/chat qsl:relative qsl:flex qsl:min-h-0 qsl:flex-1 qsl:flex-col", className)} data-quassel="" style={{
      ...appearanceStyle(appearance),
      "--qsl-chat-content-max-width": typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth,
      "--qsl-chat-horizontal-padding": typeof horizontalPadding === "number" ? `${horizontalPadding}px` : horizontalPadding,
    } as CSSProperties}>
      <div
        aria-label={allTexts.transcript}
        className={cn(
          "qsl:min-h-0 qsl:flex-1 qsl:cursor-default qsl:overflow-y-auto qsl:text-[length:var(--qsl-chat-font-size,13px)] qsl:text-foreground",
          "qsl:[--qsl-fade-edge:calc(100%_-_var(--qsl-composer-height,0px))]",
          "qsl:[-webkit-mask-image:linear-gradient(to_bottom,#000_calc(var(--qsl-fade-edge)_-_40px),transparent_calc(var(--qsl-fade-edge)_+_16px))]",
          "qsl:[mask-image:linear-gradient(to_bottom,#000_calc(var(--qsl-fade-edge)_-_40px),transparent_calc(var(--qsl-fade-edge)_+_16px))]",
          "qsl:in-data-[tone=material]:p-0",
          scrollerClassName,
        )}
        data-quassel-transcript=""
        onScroll={checkEnd}
        onWheel={(event) => { if (!event.ctrlKey && event.deltaY < 0) pauseUp(event.currentTarget, event.target); }}
        onKeyDown={(event) => {
          const editable = event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable=true]");
          if (!editable && (["ArrowUp", "PageUp", "Home"].includes(event.key) || event.target === event.currentTarget && event.key === " " && event.shiftKey)) pauseUp(event.currentTarget, event.target);
        }}
        onPointerDown={(event) => {
          const viewport = event.currentTarget;
          scrollbarDragging.current = event.clientX >= viewport.getBoundingClientRect().right - Math.max(16, viewport.offsetWidth - viewport.clientWidth);
        }}
        onTouchStart={(event) => { touchY.current = event.touches[0]?.clientY; }}
        onTouchMove={(event) => {
          const next = event.touches[0]?.clientY;
          if (next !== undefined && touchY.current !== undefined && next > touchY.current) pauseUp(event.currentTarget, event.target);
          touchY.current = next;
        }}
        role="region"
        tabIndex={0}
        ref={(element) => {
          scrollArea.current = element;
          scrollerRef?.(element);
        }}
      >
        {visible.length === 0 && !running ? (
          emptyState ?? null
        ) : (
          <div
            aria-busy={running || undefined}
            className={cn(
              "qsl:mx-auto qsl:w-[calc(100%_-_2_*_var(--qsl-chat-horizontal-padding,24px))] qsl:max-w-[var(--qsl-chat-content-max-width,none)] qsl:pt-2",
              "qsl:pb-[calc(var(--qsl-composer-height,0px)_+_max(3.25em,40px))]",
              "qsl:in-data-[tone=material]:[&>*:first-child]:mt-0",
            )}
            ref={threadRef}
          >
            {blocks}
            {running && (working ?? <WorkingScenes label={allTexts.working} />)}
          </div>
        )}
      </div>
      {showJumpToEnd && (
        <div className="qsl:pointer-events-none qsl:absolute qsl:inset-x-0 qsl:bottom-[calc(var(--qsl-composer-height,0px)_+_12px)] qsl:z-10 qsl:flex qsl:justify-center">
          <Button aria-label={allTexts.jumpToEnd} className="qsl:pointer-events-auto qsl:rounded-full qsl:border qsl:border-primary-foreground/20 qsl:shadow-md" size="icon" title={allTexts.jumpToEnd} variant="default" onClick={() => {
            if (scrollArea.current) {
              scroll.jump(scrollArea.current);
              updateJumpVisibility(scrollArea.current);
            }
          }}>
            <ChevronDownIcon />
          </Button>
        </div>
      )}
      {dock && openActions.length > 0 && createPortal(
        <div className="qsl:flex qsl:flex-col qsl:gap-[var(--qsl-chat-dense-message-gap,8px)] qsl:text-[length:var(--qsl-chat-font-size,13px)] qsl:text-foreground" style={appearanceStyle(appearance)}>
          {openActions.map((message) => (
            <div key={message.key}>
              <ActionContent action={message.action} onDismissAction={onDismissAction} renderAction={renderAction} text={message.text} texts={allTexts} />
            </div>
          ))}
        </div>,
        dock,
      )}
    </div>
  );

  return <MarkdownLinks onLinkClick={onLinkClick}><MarkdownCodeBlocks options={codeBlockOptions} texts={allTexts}>{transcript}</MarkdownCodeBlocks></MarkdownLinks>;
}

/** Consecutive steps as chips side by side; the line wraps when space runs out. */
function StepRow({
  messages,
  withText,
  expandable,
  elapsedAfter,
  texts,
  toolArgumentsText,
  toolLabel,
}: {
  messages: Message[];
  withText: boolean;
  expandable: boolean;
  elapsedAfter: number | undefined;
  texts: ChatTexts;
  toolArgumentsText: (tool: ToolInfo) => string;
  toolLabel?: string;
}) {
  const [detail, setDetail] = useState<{ key: string; position: { x: number; y: number } }>();
  const open = expandable && detail && messages.find((message) => message.key === detail.key);

  return (
    <div className={cn(stepClasses, "qsl:flex qsl:flex-wrap qsl:items-center qsl:gap-x-1.5 qsl:gap-y-1 qsl:pl-6")} data-step="row">
      {messages.map((message) => {
        const thinking = message.role === "thinking";
        const tool = message.tool;
        const state = stepState(message);
        const running = state === "running" || state === "thinking";
        const label = thinking ? texts.thinkingChip : toolLabel ?? (tool?.name || message.text || texts.toolChip);
        const content = (
          <>
            {thinking ? (
              <SparklesIcon size={11} />
            ) : (
              <WrenchIcon className={tool?.isError ? "qsl:text-destructive" : undefined} size={11} />
            )}
            {withText && <span className="qsl:min-w-0 qsl:self-baseline qsl:overflow-hidden qsl:text-ellipsis qsl:whitespace-nowrap">{label}</span>}
            {withText && <ToolElapsed after={elapsedAfter} className="qsl:flex-none qsl:self-baseline" message={message} texts={texts} />}
            {withText && <span className="qsl:inline-flex qsl:w-2.5 qsl:flex-none qsl:items-center qsl:justify-center qsl:text-success">{state === "done" && <CheckIcon size={10} />}</span>}
          </>
        );
        const classes = cn(chipClasses, !withText && "qsl:p-1", running && "qsl:animate-fade-pulse qsl:motion-reduce:animate-none");
        if (!expandable) {
          return (
            <span className={classes} data-kind={thinking ? "thinking" : "tool"} data-state={state} data-step="chip" key={message.key} title={label}>
              {content}
            </span>
          );
        }
        return (
          <button
            aria-haspopup="dialog"
            className={cn(classes, chipInteractiveClasses)}
            data-kind={thinking ? "thinking" : "tool"}
            data-state={state}
            data-step="chip"
            key={message.key}
            onClick={(event) => setDetail({ key: message.key, position: { x: event.clientX, y: event.clientY } })}
            title={label}
            type="button"
          >
            {content}
          </button>
        );
      })}
      {open && detail && (
        <StepPopover
          message={open}
          position={detail.position}
          texts={texts}
          toolArgumentsText={toolArgumentsText}
          onClose={() => setDetail(undefined)}
        />
      )}
    </div>
  );
}

/** Consecutive steps behind a header line; expanded, they stand below it as single-line rows. */
function StepGroup({
  messages,
  runningStep,
  elapsedAfter,
  expandable,
  texts,
  toolArgumentsText,
}: {
  messages: Message[];
  /** The step the collapsed header names while the chat runs; undefined = nothing running. */
  runningStep: Message | undefined;
  elapsedAfter: number | undefined;
  expandable: boolean;
  texts: ChatTexts;
  toolArgumentsText: (tool: ToolInfo) => string;
}) {
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLButtonElement>(null);
  const collapsedFromBottom = useRef(false);
  useLayoutEffect(() => {
    if (!open && collapsedFromBottom.current) {
      collapsedFromBottom.current = false;
      header.current?.scrollIntoView({ block: "nearest" });
    }
  }, [open]);
  const active = runningStep !== undefined;
  const failed = messages.some((message) => message.tool?.isError);
  const count = messages.length === 1 ? texts.stepGroupOne : texts.stepGroupMany.replace("{count}", String(messages.length));
  const runningLabel = runningStep && (runningStep.role === "thinking" ? texts.thinkingChip : runningStep.tool?.name || runningStep.text || texts.toolChip);

  return (
    <div className={stepClasses} data-step="group">
      <button
        aria-expanded={open}
        className={cn(traceClasses, traceButtonClasses, "qsl:items-center qsl:pl-1", active && "qsl:animate-fade-pulse qsl:motion-reduce:animate-none")}
        onClick={() => setOpen((value) => !value)}
        ref={header}
        type="button"
      >
        <ChevronRightIcon className={cn("qsl:flex-none qsl:opacity-60 qsl:transition-transform", open && "qsl:rotate-90")} size={12} />
        <LayersIcon className={failed ? traceErrorIconClasses : traceIconClasses} size={12} />
        <span className={cn(traceLineClasses, "qsl:overflow-hidden qsl:text-ellipsis qsl:whitespace-nowrap")}>
          {count}
          {runningLabel && <span className={traceRunningClasses}>{runningLabel} {texts.toolRunning}</span>}
          {runningStep && <ToolElapsed after={elapsedAfter} message={runningStep} texts={texts} />}
        </span>
      </button>
      {open && (
        <div className="qsl:mt-0.5 qsl:flex qsl:flex-col qsl:gap-0.5 qsl:pl-3">
          {messages.map((message) => (
            <TraceLine className="qsl:pl-3" elapsedAfter={elapsedAfter} expandable={expandable} key={message.key} message={message} texts={texts} toolArgumentsText={toolArgumentsText} />
          ))}
        </div>
      )}
      {open && messages.length >= collapseAtBottomFrom && (
        <button
          className={cn(traceClasses, traceButtonClasses, "qsl:mt-0.5 qsl:items-center qsl:pl-1")}
          data-step="group-collapse"
          onClick={() => {
            collapsedFromBottom.current = true;
            setOpen(false);
          }}
          type="button"
        >
          <ChevronUpIcon className="qsl:flex-none qsl:opacity-60" size={12} />
          <span className={traceLineClasses}>{texts.stepGroupCollapse}</span>
        </button>
      )}
    </div>
  );
}

/** One step as one line; when enabled, a click opens the details in the popover. */
function TraceLine({
  message,
  className,
  elapsedAfter,
  expandable,
  texts,
  toolArgumentsText,
}: {
  message: Message;
  className: string;
  elapsedAfter: number | undefined;
  expandable: boolean;
  texts: ChatTexts;
  toolArgumentsText: (tool: ToolInfo) => string;
}) {
  const [detailPosition, setDetailPosition] = useState<{ x: number; y: number }>();
  const thinking = message.role === "thinking";
  const tool = message.tool;
  const classes = cn(traceClasses, className);
  const line = cn(traceLineClasses, thinking && "qsl:font-sans qsl:italic qsl:whitespace-pre-wrap", "qsl:overflow-hidden qsl:text-ellipsis qsl:whitespace-nowrap");
  const content = (
    <>
      {thinking ? (
        <SparklesIcon className={traceIconClasses} size={12} />
      ) : (
        <WrenchIcon className={tool?.isError ? traceErrorIconClasses : traceIconClasses} size={12} />
      )}
      <span className={line}>
        {message.text}
        {tool && tool.result === undefined && <span className={traceRunningClasses}>{texts.toolRunning}</span>}
        <ToolElapsed after={elapsedAfter} message={message} texts={texts} />
      </span>
    </>
  );
  const marks = { "data-compact": "true", "data-kind": thinking ? "thinking" : "tool", "data-step": "line" } as const;
  if (!expandable) {
    return <div className={classes} {...marks}>{content}</div>;
  }
  return (
    <>
      <button
        aria-expanded={detailPosition !== undefined}
        aria-haspopup="dialog"
        className={cn(classes, traceButtonClasses)}
        {...marks}
        onClick={(event) => setDetailPosition({ x: event.clientX, y: event.clientY })}
        type="button"
      >
        {content}
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

/** Elapsed time of a running tool call since Message.at; aria-hidden, so the ticking number never reaches screen readers. */
function ToolElapsed({ message, after, texts, className = traceRunningClasses }: { message: Message; after: number | undefined; texts: ChatTexts; className?: string }) {
  const start = stepState(message) === "running" ? messageDate(message.at)?.getTime() : undefined;
  return after === undefined || start === undefined ? null : <Elapsed after={after} className={className} start={start} texts={texts} />;
}

function Elapsed({ start, after, className, texts }: { start: number; after: number; className: string; texts: ChatTexts }) {
  const elapsed = useElapsed(start);
  if (elapsed === undefined || elapsed < after) return null;
  return <span aria-hidden="true" className={cn(className, "qsl:tabular-nums")} data-step="elapsed">{formatElapsed(elapsed, texts)}</span>;
}

function Bubble({
  message,
  plain,
  detailMode,
  dense,
  elapsedAfter,
  expandable,
  texts,
  toolArgumentsText,
  renderAction,
  onDismissAction,
  bubbleOptions,
  messageActions,
}: {
  message: Message;
  plain: boolean;
  detailMode: DetailMode;
  dense: boolean;
  elapsedAfter: number | undefined;
  expandable: boolean;
  texts: ChatTexts;
  toolArgumentsText: (tool: ToolInfo) => string;
  renderAction?: (action: PendingAction, text: string) => ReactNode | undefined;
  onDismissAction?: (actionId: string) => void;
  bubbleOptions?: BubbleOptions;
  messageActions?: MessageActionsOptions;
}) {
  const stepSpacing = dense ? denseStepClasses : stepClasses;

  if (message.role === "thinking" || (message.role === "tool" && message.tool)) {
    if (detailMode === "compact") {
      return <TraceLine className={stepSpacing} elapsedAfter={elapsedAfter} expandable={expandable} message={message} texts={texts} toolArgumentsText={toolArgumentsText} />;
    }
    const thinking = message.role === "thinking";
    const tool = message.tool;
    const icon = thinking ? (
      <SparklesIcon className={traceIconClasses} size={12} />
    ) : (
      <WrenchIcon className={tool?.isError ? traceErrorIconClasses : traceIconClasses} size={12} />
    );
    const line = (
      <>
        {message.text}
        {tool && tool.result === undefined && <span className={traceRunningClasses}>{texts.toolRunning}</span>}
        <ToolElapsed after={elapsedAfter} message={message} texts={texts} />
      </>
    );
    return (
      <div className={cn(traceClasses, stepSpacing)} data-kind={thinking ? "thinking" : "tool"} data-step="detail">
        {icon}
        <div className="qsl:min-w-0 qsl:flex-1">
          <div className={cn(traceLineClasses, thinking && "qsl:font-sans qsl:italic qsl:whitespace-pre-wrap")}>{line}</div>
          {tool && (
            <div className="qsl:mt-0.5 qsl:border-l-2 qsl:border-border-soft qsl:pl-2">
              <pre className="qsl:mb-0.5 qsl:max-h-[208px] qsl:overflow-auto qsl:font-mono qsl:text-meta qsl:leading-[1.375] qsl:break-all qsl:whitespace-pre-wrap qsl:opacity-80">{toolArgumentsText(tool)}</pre>
              {tool.result !== undefined && (
                <pre className={cn("qsl:mb-0.5 qsl:max-h-[208px] qsl:overflow-auto qsl:font-mono qsl:text-meta qsl:leading-[1.375] qsl:break-all qsl:whitespace-pre-wrap qsl:opacity-80",
                  tool.isError && "qsl:text-destructive qsl:opacity-100")}>{prettyJson(tool.result)}</pre>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (message.role === "action" && message.action) {
    return (
      <div className={stepSpacing}>
        <ActionContent action={message.action} onDismissAction={onDismissAction} renderAction={renderAction} text={message.text} texts={texts} />
      </div>
    );
  }

  if (message.role === "system") {
    return (
      <div className={cn(stepSpacing, "qsl:border-l-2 qsl:border-destructive/50 qsl:pl-3 qsl:text-sm qsl:text-muted-foreground")} data-message="system">
        <Markdown text={message.text} />
        <MessageAttachments label={texts.attachments} message={message} />
      </div>
    );
  }

  if (!message.text.trim() && !message.attachments?.length) return null;

  const variant = bubbleOptions?.variant ?? "default";
  const useBubble = !plain && variant !== "plain" && (variant === "bubbles" || message.role === "user" || !!message.bubble);
  const side = (message.role === "user" ? bubbleOptions?.userSide : bubbleOptions?.assistantSide)
    ?? message.bubble?.side ?? (message.role === "user" ? "end" : "start");
  const sender = bubbleOptions?.senderLabel?.(message) ?? message.bubble?.label ?? message.sender;
  const showSender = bubbleOptions?.showSender ?? (!!message.bubble?.label && !plain);
  const content = <>
    {showSender && sender && <span className={cn("qsl:mb-[5px] qsl:table qsl:text-label qsl:leading-[1.45] qsl:font-semibold",
      useBubble && message.bubble && "qsl:rounded-full qsl:border qsl:border-white/30 qsl:bg-black/15 qsl:px-[7px] qsl:py-px qsl:tracking-[0.02em]")} data-chat="sender">{sender}</span>}
    <Markdown text={message.text} streaming={message.role === "assistant" && !message.closed} />
    <MessageAttachments label={texts.attachments} message={message} />
    {message.steered && <small className="qsl:mt-1 qsl:block qsl:text-label qsl:leading-[1.45] qsl:opacity-70" data-chat="steered">{texts.steered}</small>}
    <MessageActions message={message} options={messageActions} texts={texts} />
  </>;
  const cursor = message.role === "assistant" && message.textCursor ? JSON.stringify(message.textCursor) : undefined;
  if (!useBubble) return (
    <div data-chat-text-cursor={cursor} className={cn(stepSpacing, "qsl:group qsl:relative qsl:w-full qsl:leading-[var(--qsl-chat-line-height,1.625)] qsl:text-foreground")} data-message="answer">
      {content}
    </div>
  );
  return (
    <div data-chat-text-cursor={cursor} className={cn(stepSpacing, "qsl:flex", side === "end" ? "qsl:justify-end" : "qsl:justify-start")}
      data-message={message.role === "user" && !message.bubble && variant === "default" ? "user" : "bubble"} data-side={side}>
      <div className={cn(bubbleBodyClasses, "qsl:group", message.bubble
        ? "qsl:rounded-lg qsl:text-white qsl:[--qsl-scroll-cover:var(--qsl-primary)]"
        : "qsl:rounded-[var(--qsl-bubble-radius,10px_10px_4px_10px)] qsl:border qsl:border-border qsl:bg-secondary qsl:text-foreground qsl:[--qsl-scroll-cover:var(--qsl-secondary)] qsl:in-data-[tone=material]:rounded-[var(--qsl-bubble-radius,9px)] qsl:in-data-[tone=material]:border-glass-edge/20 qsl:in-data-[tone=material]:bg-primary/15 qsl:in-data-[tone=material]:text-foreground")}
        data-tone={message.bubble ? "on-color" : undefined}
        style={{ background: message.bubble?.color, maxWidth: bubbleOptions?.maxWidth }}>
        {content}
      </div>
    </div>
  );
}

function ActionContent({
  action,
  text,
  texts,
  renderAction,
  onDismissAction,
}: {
  action: PendingAction;
  text: string;
  texts: ChatTexts;
  renderAction?: (action: PendingAction, text: string) => ReactNode | undefined;
  onDismissAction?: (actionId: string) => void;
}) {
  return renderAction?.(action, text) ?? (
    <PendingActionCard
      action={action}
      dismissedLabel={texts.actionDismissed}
      dismissLabel={texts.dismissAction}
      onDismiss={onDismissAction ? () => onDismissAction(action.actionId) : undefined}
      text={text}
      waitingLabel={texts.pendingAction}
    />
  );
}

function MessageAttachments({ message, label }: { message: Message; label: string }) {
  if (!message.attachments?.length) return null;
  return (
    <ul className="qsl:mt-2.5 qsl:flex qsl:flex-wrap qsl:gap-2" aria-label={label}>
      {message.attachments.map((attachment, index) => (
        <li className="qsl:relative qsl:flex qsl:w-[190px] qsl:max-w-full qsl:min-w-0 qsl:flex-col qsl:overflow-hidden qsl:rounded-lg qsl:border qsl:border-border qsl:text-sm" key={`${attachment.url}-${index}`}>
          {attachment.mediaType.startsWith("image/") && <a href={attachmentDownloadUrl(attachment.url)} download={attachment.name}><img className="qsl:block qsl:h-[112px] qsl:w-full qsl:bg-secondary qsl:object-contain" src={attachment.url} alt={attachment.name} loading="lazy" /></a>}
          {attachment.mediaType.startsWith("video/") && <video className="qsl:block qsl:h-[112px] qsl:w-full qsl:bg-secondary qsl:object-contain" src={attachment.url} controls preload="metadata" aria-label={attachment.name} />}
          <div className="qsl:flex qsl:flex-col qsl:gap-1 qsl:p-2 qsl:[overflow-wrap:anywhere]">
            <a className="qsl:font-medium" href={attachmentDownloadUrl(attachment.url)} download={attachment.name}>{attachment.name}</a>
            <small>{formatAttachmentSize(attachment.size)}</small>
          </div>
        </li>
      ))}
    </ul>
  );
}
