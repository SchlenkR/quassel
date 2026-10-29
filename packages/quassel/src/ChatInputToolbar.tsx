import { PaperclipIcon, SendIcon, XIcon } from "lucide-react";
import { cn } from "./ui/cn";
import { useFileInput } from "./ui/useFileInput";
import { useQuasselComponents } from "./QuasselProvider";
import { KeyboardEvent, ReactNode, Ref, useCallback, useContext, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChatTexts, defaultTexts, fillText } from "./texts";
import type { ChatAttachmentInput } from "./events";
import { attachmentCapabilityError, attachmentMediaType, encodeAttachment, formatAttachmentSize, MAX_CHAT_ATTACHMENTS, maxAttachmentSizeLabel, validateAttachmentSelection } from "./attachments";
import { ChatSendContext } from "./ChatSendContext";
import type { ChatMicrophone, SendShortcut } from "./options";
import { ComposerPrimaryAction } from "./ComposerPrimaryAction";

type DraftAttachment = { id: number; file: File } & (
  | { status: "reading" }
  | { status: "ready"; input: ChatAttachmentInput }
  | { status: "error"; error: string }
);

// Below this panel width, accompanying labels collapse to their icons.
const COMPACT_WIDTH_PX = 480;

const errorClasses = "qsl:px-3 qsl:py-2 qsl:text-small qsl:text-destructive";
const attachmentItemClasses = "qsl:relative qsl:flex qsl:w-[190px] qsl:max-w-full qsl:min-w-0 qsl:flex-col qsl:overflow-hidden qsl:rounded-lg qsl:border qsl:border-border qsl:text-small";
const attachmentMediaClasses = "qsl:block qsl:h-[112px] qsl:w-full qsl:bg-secondary qsl:object-contain";

/** A toolbar button, declarative: icon, text or both - plus click handler. */
export interface ToolbarAction {
  icon?: ReactNode;
  label?: string;
  title?: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
}

/** Hosts control the draft from outside, e.g. to insert a template for editing. */
export interface ChatInputHandle {
  /** Replaces the draft, focuses the input and puts the caret at the end. */
  insert: (text: string) => void;
  focus: () => void;
  reset: () => void;
  submit: (onSubmit?: (text: string, attachments?: ChatAttachmentInput[]) => void | Promise<void>, options?: { allowEmpty?: boolean }) => Promise<void>;
}

/** A composer with attachments, host slots and steering into a running turn. */
export function ChatInputToolbar({
  onSend,
  onStop,
  running = false,
  disabled = false,
  sendDisabled = false,
  layout = "card",
  detailsContainer,
  onErrorChange,
  inputAriaControls,
  rows = 3,
  maxRows,
  actions,
  toolbarLeft,
  toolbarRight,
  microphone,
  replaceInput,
  texts,
  handleRef,
  attachments: attachmentsEnabled = true,
  attachmentCapabilities,
  attachmentCapabilitiesError,
  onAttachmentsChange,
  initialValue = "",
  onDraftChange,
  sendShortcut = "enter",
  autoFocus = false,
  onAutoFocusSettled,
}: {
  onSend: (text: string, attachments?: ChatAttachmentInput[]) => void | Promise<void>;
  onStop?: () => void;
  running?: boolean;
  disabled?: boolean;
  sendDisabled?: boolean;
  layout?: "card" | "toolbar" | "inline" | "pill";
  detailsContainer?: HTMLElement | null;
  onErrorChange?: (error: string | undefined) => void;
  inputAriaControls?: string;
  rows?: number;
  maxRows?: number;
  actions?: ToolbarAction[];
  toolbarLeft?: ReactNode;
  toolbarRight?: ReactNode;
  microphone?: ChatMicrophone;
  replaceInput?: ReactNode;
  texts?: Partial<ChatTexts>;
  handleRef?: Ref<ChatInputHandle>;
  /** false = no attaching: neither button nor dropping or pasting files. */
  attachments?: boolean;
  attachmentCapabilities?: { input: readonly string[]; model: string };
  attachmentCapabilitiesError?: string;
  onAttachmentsChange?: (hasAttachments: boolean) => void;
  initialValue?: string;
  onDraftChange?: (text: string) => void;
  sendShortcut?: SendShortcut;
  autoFocus?: boolean;
  onAutoFocusSettled?: () => void;
}) {
  const sendScope = useContext(ChatSendContext);
  const allTexts = { ...defaultTexts, ...texts };
  const { Button, StopButton, Toggle } = useQuasselComponents();
  const [draft, setDraft] = useState(initialValue);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string>();
  const [failedSubmissions, setFailedSubmissions] = useState<{ id: number; draft: string; attachments: DraftAttachment[] }[]>([]);
  const nextFailedId = useRef(0);
  const pendingSend = useRef(false);
  const generation = useRef(0);
  useLayoutEffect(() => () => { generation.current += 1; }, []);
  const draftRevision = useRef(0);
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const attachmentsRef = useRef<DraftAttachment[]>([]);
  const nextAttachmentId = useRef(0);
  const [attachmentError, setAttachmentError] = useState<string>();
  const updateAttachments = (update: (current: DraftAttachment[]) => DraftAttachment[]) => {
    attachmentsRef.current = update(attachmentsRef.current);
    setAttachments(attachmentsRef.current);
  };
  const addFiles = (files: File[]) => {
    if (!files.length) return;
    if (disabled || pendingSend.current) {
      setAttachmentError(allTexts.attachmentsWhileBusy);
      return;
    }
    try {
      validateAttachmentSelection(attachmentsRef.current.map((entry) => entry.file), files, allTexts);
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : String(error));
      return;
    }
    setAttachmentError(undefined);
    const entries: DraftAttachment[] = files.map((file) => ({ id: ++nextAttachmentId.current, file, status: "reading" }));
    updateAttachments((current) => [...current, ...entries]);
    for (const entry of entries) {
      void encodeAttachment(entry.file).then(
        (input) => updateAttachments((current) => current.map((item) => item.id === entry.id ? { ...entry, status: "ready", input } : item)),
        () => updateAttachments((current) => current.map((item) => item.id === entry.id ? {
          ...entry, status: "error", error: allTexts.attachmentReadFailed,
        } : item)),
      );
    }
  };
  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  const autoFocusSettled = useRef(false);
  useEffect(() => {
    if (!autoFocus || autoFocusSettled.current) return;
    const input = textareaRef.current;
    if (!input) return;
    let frame = 0;
    const settle = () => {
      if (autoFocusSettled.current) return;
      autoFocusSettled.current = true;
      window.cancelAnimationFrame(frame);
      onAutoFocusSettled?.();
    };
    const onFocus = (event: FocusEvent) => { if (event.target !== input) settle(); };
    const focusWhenVisible = () => {
      if (autoFocusSettled.current) return;
      const dialog = [...document.querySelectorAll<HTMLElement>('[role="dialog"], dialog[open]')]
        .find((element) => element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && !element.contains(input));
      if (dialog) {
        settle();
        return;
      }
      const rect = input.getBoundingClientRect();
      const visible = input.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && rect.width > 0 && rect.height > 0 && !input.closest('[inert], [hidden], [aria-hidden="true"]')
        && document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === input;
      if (visible && !input.disabled && !input.readOnly && document.visibilityState === "visible") {
        input.focus({ preventScroll: true });
        if (document.activeElement === input) {
          settle();
          return;
        }
      }
      frame = window.requestAnimationFrame(focusWhenVisible);
    };
    window.addEventListener("pointerdown", settle, true);
    window.addEventListener("keydown", settle, true);
    window.addEventListener("focusin", onFocus);
    window.addEventListener("blur", settle);
    if (!disabled) frame = window.requestAnimationFrame(focusWhenVisible);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointerdown", settle, true);
      window.removeEventListener("keydown", settle, true);
      window.removeEventListener("focusin", onFocus);
      window.removeEventListener("blur", settle);
    };
  }, [autoFocus, disabled, onAutoFocusSettled]);
  const [compact, setCompact] = useState(false);
  const pendingFocus = useRef(false);
  const fileInput = useFileInput({
    disabled: disabled || sending,
    onFiles: addFiles,
    onPasteText: (text) => {
      const input = textareaRef.current;
      if (!input || disabled || pendingSend.current) return;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      draftRevision.current += 1;
      setDraft((current) => current.slice(0, start) + text + current.slice(end));
      pendingFocus.current = true;
    },
  });
  const toolbar = layout === "toolbar";
  const inline = layout === "inline";
  const pill = layout === "pill";
  const inputRows = inline || toolbar || pill ? 1 : rows;
  const inputMaxRows = toolbar ? 1 : pill ? (maxRows ?? 6) : inline ? (maxRows ?? 1) : maxRows;
  const microphoneBusy = pill && !!microphone && microphone.state !== "idle";
  const replacingInput = pill && replaceInput !== undefined && replaceInput !== null && typeof replaceInput !== "boolean";
  // The toolbar variant pulses while working; the host only sets the radius.
  const rootClasses = cn(
    "qsl:flex qsl:shrink-0 qsl:flex-col",
    pill ? "qsl:min-w-0" : "qsl:overflow-hidden qsl:rounded-[var(--qsl-input-card-radius,--theme(--radius-xl))] qsl:border qsl:border-border-strong qsl:bg-background qsl:shadow-bar qsl:transition-colors qsl:focus-within:border-primary qsl:in-data-[tone=material]:rounded-xl qsl:in-data-[tone=material]:border-glass-edge/50 qsl:in-data-[tone=material]:bg-background",
    toolbar && "qsl:h-full qsl:min-w-0 qsl:flex-row qsl:items-center qsl:rounded-lg qsl:data-[working=true]:animate-working-pulse qsl:data-[working=true]:border-primary qsl:motion-reduce:data-[working=true]:animate-none",
    fileInput.dragging && "qsl:outline-2 qsl:outline-offset-[3px] qsl:outline-dashed qsl:outline-primary",
  );
  const textareaClasses = cn(
    "qsl:resize-none qsl:overscroll-contain qsl:border-0 qsl:bg-transparent qsl:text-foreground qsl:placeholder:text-muted-foreground",
    !pill && "qsl:text-body qsl:focus:outline-none",
    pill ? "qsl:pill-input" : inline ? "qsl:min-w-0 qsl:flex-1 qsl:px-2.5 qsl:py-2" : toolbar ? "qsl:w-full qsl:min-w-0 qsl:flex-auto qsl:px-2 qsl:py-[3px]" : "qsl:px-3 qsl:pt-3 qsl:pb-2",
  );
  const toolbarRowClasses = cn(
    "qsl:flex qsl:items-center qsl:gap-2 qsl:border-t qsl:border-border-soft qsl:px-2 qsl:py-1.5 qsl:in-data-[tone=overseer-details]:flex-nowrap",
    inline && "qsl:flex-none qsl:gap-1 qsl:border-t-0 qsl:p-1",
    toolbar && "qsl:flex-wrap qsl:border-t-0",
  );
  const toolbarSideClasses = "qsl:flex qsl:min-w-0 qsl:items-center qsl:gap-2 qsl:in-data-[tone=overseer-details]:flex-nowrap";
  const changeDraft = useCallback((text: string) => {
    draftRevision.current += 1;
    setDraft(text);
  }, []);

  useImperativeHandle(handleRef, () => ({
    insert: (text: string) => {
      pendingFocus.current = true;
      changeDraft(text);
      const element = textareaRef.current;
      element?.focus();
      if (element?.value === text) element.setSelectionRange(text.length, text.length);
    },
    focus: () => textareaRef.current?.focus(),
    submit: (onSubmit, options) => send(onSubmit, options?.allowEmpty),
    reset: () => {
      generation.current += 1;
      pendingSend.current = false;
      pendingFocus.current = false;
      changeDraft("");
      updateAttachments(() => []);
      setSendError(undefined);
      setFailedSubmissions([]);
      setAttachmentError(undefined);
      setSending(false);
      fileInput.clearDragging();
    },
  }));

  useEffect(() => { onDraftChange?.(draft); }, [draft, onDraftChange]);

  useEffect(() => {
    if (!pendingFocus.current) {
      return;
    }
    pendingFocus.current = false;
    const element = textareaRef.current;
    if (element) {
      element.focus();
      element.setSelectionRange(element.value.length, element.value.length);
    }
  }, [draft, sending]);

  // Auto-grow: the height follows the content between rows and maxRows, then the textarea scrolls.
  const applyAutoGrow = useCallback(() => {
    const element = textareaRef.current;
    if (!element || inputMaxRows === undefined) {
      return;
    }
    const style = getComputedStyle(element);
    const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.5;
    const padding = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
    const maximum = lineHeight * Math.max(inputMaxRows, inputRows) + padding;
    element.style.height = "auto";
    const contentHeight = element.scrollHeight;
    element.style.height = `${Math.min(contentHeight, maximum)}px`;
    element.style.overflowY = contentHeight > maximum ? "auto" : "hidden";
  }, [inputMaxRows, inputRows]);

  useEffect(() => {
    applyAutoGrow();
  }, [draft, replacingInput, applyAutoGrow]);

  // Hosts may lay the composer out a frame later; re-measure once the width settles.
  useEffect(() => {
    const element = textareaRef.current;
    if (!element || inputMaxRows === undefined) {
      return;
    }
    let lastWidth = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth !== lastWidth) {
        lastWidth = element.clientWidth;
        applyAutoGrow();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [inputMaxRows, replacingInput, applyAutoGrow]);

  // Panel width instead of viewport width: the chat column can be arbitrarily narrow in the host.
  useEffect(() => {
    const element = rootRef.current;
    if (!element) {
      return;
    }
    const update = () => setCompact(element.clientWidth < COMPACT_WIDTH_PX);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const hasAttachments = attachments.length > 0;
  useEffect(() => { onAttachmentsChange?.(hasAttachments); }, [hasAttachments, onAttachmentsChange]);
  const capabilityError = hasAttachments && attachmentCapabilitiesError ? attachmentCapabilitiesError : attachmentCapabilities ? attachmentCapabilityError(attachments.map((entry) => ({
    name: entry.file.name, mediaType: attachmentMediaType(entry.file),
  })), attachmentCapabilities, allTexts) : undefined;
  const hasContent = draft.trim().length > 0 || attachments.length > 0;
  const preparing = attachments.some((entry) => entry.status === "reading");
  const attachmentBlocked = attachments.some((entry) => entry.status !== "ready");
  const currentError = sendError ?? attachmentError ?? capabilityError ?? attachments.find((entry) => entry.status === "error")?.error;
  useEffect(() => { onErrorChange?.(currentError); }, [currentError, onErrorChange]);

  const send = async (onSubmit = onSend, allowEmpty = false) => {
    const text = draft.trim();
    const snapshot = attachmentsRef.current;
    if ((!allowEmpty && !text && !snapshot.length) || disabled || sendDisabled || microphoneBusy || replacingInput || pendingSend.current || capabilityError || snapshot.some((entry) => entry.status !== "ready")) {
      return;
    }
    pendingSend.current = true;
    const sentGeneration = generation.current;
    const sentRevision = draftRevision.current;
    const sentDraft = draft;
    const focusOrigin = document.activeElement;
    const startedFocused = focusOrigin === textareaRef.current || rootRef.current?.contains(focusOrigin);
    let leftComposer = false;
    const observeFocus = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && !rootRef.current?.contains(target) && !detailsContainer?.contains(target)) leftComposer = true;
    };
    document.addEventListener("focusin", observeFocus);
    document.addEventListener("pointerdown", observeFocus);
    setSending(true);
    setSendError(undefined);
    setDraft("");
    updateAttachments(() => []);
    try {
      const inputs = snapshot.flatMap((entry) => entry.status === "ready" ? [entry.input] : []);
      await onSubmit(text, inputs.length ? inputs : undefined);
      if (generation.current === sentGeneration && (text || inputs.length)) sendScope?.notify();
    } catch (error) {
      if (generation.current !== sentGeneration) return;
      if (draftRevision.current === sentRevision) {
        setDraft(sentDraft);
        updateAttachments((current) => [...snapshot, ...current]);
      } else if (sentDraft || snapshot.length) {
        const failed = { id: ++nextFailedId.current, draft: sentDraft, attachments: snapshot };
        setFailedSubmissions((current) => [...current, failed]);
      }
      setSendError(error instanceof Error ? error.message : String(error));
    } finally {
      document.removeEventListener("focusin", observeFocus);
      document.removeEventListener("pointerdown", observeFocus);
      if (generation.current === sentGeneration) {
        pendingSend.current = false;
        pendingFocus.current = !!startedFocused && !leftComposer && document.hasFocus()
          && (!toolbar || focusOrigin !== textareaRef.current) && (document.activeElement === focusOrigin
            || (!toolbar && document.activeElement === document.body));
        setSending(false);
      }
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !composing.current && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229
      && (sendShortcut === "enter" || event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (!event.repeat) void send();
    }
  };

  const attachmentPreviews = (
    attachments.length > 0 && (
        <ul className="qsl:flex qsl:max-h-[240px] qsl:flex-wrap qsl:gap-2 qsl:overflow-y-auto qsl:overscroll-contain qsl:px-3 qsl:pt-2.5 qsl:in-data-[tone=overseer-details]:max-h-40 qsl:in-data-[tone=overseer-details]:overflow-y-auto" aria-label={allTexts.attachments}>
          {attachments.map((entry) => (
            <li className={attachmentItemClasses} key={entry.id}>
              {entry.status === "ready" && entry.input.mediaType.startsWith("image/") && (
                <img className={attachmentMediaClasses} src={`data:${entry.input.mediaType};base64,${entry.input.data}`} alt={entry.file.name} />
              )}
              {entry.status === "ready" && entry.input.mediaType.startsWith("video/") && (
                <video className={attachmentMediaClasses} controls preload="metadata" aria-label={entry.file.name} src={`data:${entry.input.mediaType};base64,${entry.input.data}`} />
              )}
              <div className="qsl:flex qsl:flex-col qsl:gap-1 qsl:p-2 qsl:pr-8 qsl:[overflow-wrap:anywhere]">
                <span className="qsl:font-medium" title={entry.file.name}>{entry.file.name}</span>
                <small>{formatAttachmentSize(entry.file.size)}</small>
                {entry.status === "reading" && <small role="status">{allTexts.attachmentPreparing}</small>}
                {entry.status === "error" && <small role="alert">{entry.error}</small>}
              </div>
              <Button
                aria-label={fillText(allTexts.removeAttachment, { name: entry.file.name })}
                className="qsl:absolute qsl:top-1 qsl:right-1"
                disabled={disabled || sending}
                onClick={() => {
                  updateAttachments((current) => current.filter((item) => item.id !== entry.id));
                  setAttachmentError(undefined);
                  textareaRef.current?.focus();
                }}
                size="icon-sm"
                title={fillText(allTexts.removeAttachment, { name: entry.file.name })}
                variant="outline"
              ><XIcon /></Button>
            </li>
          ))}
        </ul>
      )
  );
  const errors = <>
      {capabilityError && <p className={errorClasses} role="alert">{capabilityError}</p>}
      {attachmentError && <p className={errorClasses} role="alert">{attachmentError}</p>}
      {sendError && <p className={errorClasses} role="alert">{sendError}</p>}
      {failedSubmissions.map((failed) => <div className={cn(errorClasses, "qsl:flex qsl:flex-wrap qsl:items-center qsl:gap-2")} key={failed.id} role="status">
        <span>{allTexts.notSent} {failed.draft.slice(0, 100)}{failed.draft.length > 100 ? " ..." : ""}{failed.attachments.length > 0 ? ` ${fillText(allTexts.notSentAttachments, { count: failed.attachments.length })}` : ""} </span>
        <Button disabled={disabled || sending} size="sm" variant="outline" onClick={() => {
          try {
            validateAttachmentSelection(attachmentsRef.current.map((entry) => entry.file), failed.attachments.map((entry) => entry.file), allTexts);
          } catch (error) {
            setAttachmentError(error instanceof Error ? error.message : String(error));
            return;
          }
          draftRevision.current += 1;
          setDraft((current) => [current, failed.draft].filter(Boolean).join("\n\n"));
          updateAttachments((current) => [...current, ...failed.attachments]);
          setFailedSubmissions((current) => current.filter((entry) => entry.id !== failed.id));
          setAttachmentError(undefined);
          pendingFocus.current = true;
        }}>{allTexts.insertUnsent}</Button>
      </div>)}
  </>;
  const sendButtons = <>
          {running && onStop && !hasContent && <StopButton className="qsl:flex-none" label={allTexts.stop} onClick={onStop} size="icon-sm" />}
          {(!running || !onStop || hasContent) && (
            <Button
              aria-label={allTexts.send}
              className="qsl:flex-none"
              disabled={disabled || sendDisabled || sending || attachmentBlocked || !!capabilityError || !hasContent}
              onClick={() => { void send(); }}
              size="icon-sm"
              title={running ? allTexts.sendIntoRun : allTexts.send}
            >
              <SendIcon size={14} />
            </Button>
          )}
  </>;
  const actionButtons = actions?.map((action, index) => action.active === undefined ? (
    <Button aria-label={action.label ?? action.title} disabled={action.disabled} key={index} onClick={action.onClick} size="sm" title={action.title ?? action.label} variant="ghost">
      {action.icon}
      {action.label && <span className={action.icon ? "qsl:in-data-[compact=true]:hidden" : undefined}>{action.label}</span>}
    </Button>
  ) : (
    <Toggle aria-label={action.label ?? action.title} disabled={action.disabled} key={index} onPressedChange={() => action.onClick()} pressed={action.active} size="sm" title={action.title ?? action.label}>
      {action.icon}
      {action.label && <span className={action.icon ? "qsl:in-data-[compact=true]:hidden" : undefined}>{action.label}</span>}
    </Toggle>
  ));
  const attachButton = attachmentsEnabled && <Button
    aria-label={allTexts.attachFiles}
    disabled={disabled || sending}
    onClick={() => fileInput.inputRef.current?.click()}
    size="icon-sm"
    title={fillText(allTexts.attachFilesHint, { count: MAX_CHAT_ATTACHMENTS, size: maxAttachmentSizeLabel })}
    variant="ghost"
  >
    <PaperclipIcon />
  </Button>;
  const detailToolbar = (
      <div className={toolbarRowClasses} data-input="controls">
        <div className={cn(toolbarSideClasses, "qsl:in-data-[tone=overseer-details]:flex-none", inline || toolbar ? "qsl:flex-none" : "qsl:flex-auto")}>
          {attachButton}
          {preparing && <span className={cn("qsl:text-small qsl:text-muted-foreground", inline && "qsl:sr-only")} role="status">{allTexts.attachmentsPreparing}</span>}
          {actionButtons}
          {toolbarLeft}
        </div>
        <div className={cn(toolbarSideClasses, "qsl:in-data-[tone=overseer-details]:flex-1", inline || toolbar ? "qsl:flex-none" : "qsl:flex-[0_1_auto]")}>
          {toolbarRight}
          {!toolbar && sendButtons}
        </div>
      </div>
  );
  const details = <div className="qsl:min-w-0" data-compact={compact} data-quassel="">
    {attachmentPreviews}
    {errors}
    {detailToolbar}
  </div>;

  const input = (
      <textarea
        aria-controls={inputAriaControls}
        className={textareaClasses}
        aria-label={allTexts.placeholder}
        disabled={!toolbar && (disabled || microphoneBusy)}
        hidden={replacingInput}
        readOnly={toolbar && disabled}
        onChange={(event) => changeDraft(event.target.value)}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={() => { composing.current = false; }}
        onKeyDown={onKeyDown}
        placeholder={running ? allTexts.steeringPlaceholder : allTexts.placeholder}
        ref={textareaRef}
        rows={inputRows}
        value={draft}
      />
  );

  return (
    <div
      className={rootClasses}
      data-compact={compact}
      data-layout={layout}
      data-quassel=""
      data-working={running || sending}
      ref={rootRef}
      {...(attachmentsEnabled ? fileInput.dropProps : {})}
    >
      {attachmentsEnabled && <input
        aria-label={allTexts.attachFiles}
        hidden
        multiple
        type="file"
        {...fileInput.inputProps}
      />}
      {!toolbar && attachmentPreviews}
      {pill ? <>
        {errors}
        {preparing && <span className="qsl:sr-only" role="status">{allTexts.attachmentsPreparing}</span>}
        <div className="qsl:pill-row" data-input="pill">
          {(actionButtons?.length || toolbarLeft) && <div className="qsl:pill-slot" data-input="left">{actionButtons}{toolbarLeft}</div>}
          {input}
          {replacingInput && <div className="qsl:pill-replacement" data-input="replacement">{replaceInput}</div>}
          {(toolbarRight || attachmentsEnabled) && <div className="qsl:pill-slot" data-input="right">{toolbarRight}{attachButton}</div>}
          <ComposerPrimaryAction
            disabled={disabled}
            hasContent={hasContent}
            microphone={microphone}
            onSend={() => { void send(); }}
            onStop={onStop}
            running={running}
            sendDisabled={sendDisabled || attachmentBlocked || !!capabilityError || replacingInput}
            sending={sending}
            texts={allTexts}
          />
        </div>
      </> : inline ? <>{errors}<div className="qsl:flex qsl:min-w-0 qsl:items-end">{input}{detailToolbar}</div></> : input}
      {toolbar ? <>
        <div className="qsl:flex qsl:flex-none qsl:items-center qsl:gap-1 qsl:p-1">{sendButtons}</div>
        {detailsContainer && createPortal(details, detailsContainer)}
      </> : !inline && !pill && <>{errors}{detailToolbar}</>}

    </div>
  );
}
