import { type ReactNode, useRef, useState } from "react";
import { SmilePlusIcon } from "lucide-react";
import { cn } from "./ui/cn";
import type { ChatAttachment, ChatAuthor, ChatBadge, ChatCard, ChatReaction, ChatThread, Message } from "./types";
import { type ChatTexts, defaultTexts, fillText } from "./texts";
import { Markdown } from "./Markdown";
import { MessageActions } from "./MessageActions";
import { mentionMarkdown } from "./threads";
import { messageDate, timestampLabel } from "./timestamps";
import type { MessageActionsOptions, TimestampOptions } from "./options";

export type DecorationPlace = "header" | "thread";

export interface PartyHooks {
  currentUserId?: string;
  activeThreadKey?: string;
  onOpenThread?: (message: Message) => void;
  onToggleReaction?: (message: Message, key: string) => void;
  reactionChoices?: readonly string[];
  renderReaction?: (key: string) => ReactNode | undefined;
  renderCard?: (card: ChatCard, message: Message) => ReactNode | undefined;
  renderAttachment?: (attachment: ChatAttachment, message: Message) => ReactNode | undefined;
  renderAvatar?: (author: ChatAuthor, message: Message) => ReactNode | undefined;
  renderThreadSummary?: (message: Message, thread: ChatThread) => ReactNode | undefined;
  renderMessageDecorations?: (message: Message, place: DecorationPlace) => ReactNode;
}

const badgeTones: Record<NonNullable<ChatBadge["tone"]>, string> = {
  neutral: "qsl:bg-secondary qsl:text-muted-foreground",
  accent: "qsl:bg-primary/15 qsl:text-primary",
  success: "qsl:bg-success/15 qsl:text-success",
  warning: "qsl:bg-warning/15 qsl:text-warning",
  danger: "qsl:bg-destructive/15 qsl:text-destructive",
};

const chipClasses = "qsl:inline-flex qsl:h-6 qsl:items-center qsl:gap-[5px] qsl:rounded-full qsl:px-2 qsl:text-small qsl:transition-colors qsl:[&_svg]:size-[13px]";

export function authorOf(message: Message): ChatAuthor {
  return message.author ?? { id: message.sender ?? message.role, name: message.bubble?.label ?? message.sender ?? message.role };
}

export function initials(author: ChatAuthor): string {
  return author.initials ?? author.name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function Avatar({ author, size = 32 }: { author: ChatAuthor; size?: number }) {
  return author.avatarUrl
    ? <img alt="" className="qsl:block qsl:flex-none qsl:rounded-[var(--qsl-avatar-radius,50%)] qsl:object-cover" data-chat="avatar" height={size} src={author.avatarUrl} style={{ width: size, height: size }} width={size} />
    : <span aria-hidden="true" className="qsl:grid qsl:flex-none qsl:place-items-center qsl:rounded-[var(--qsl-avatar-radius,50%)] qsl:bg-[var(--qsl-avatar-background,var(--qsl-secondary))] qsl:font-semibold qsl:text-[var(--qsl-avatar-foreground,var(--qsl-muted-foreground))]"
      data-chat="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>{initials(author)}</span>;
}

export function PartyMessage({
  message,
  grouped,
  highlighted,
  inThreadView,
  texts,
  timestampOptions,
  messageActions,
  hooks,
  attachments,
}: {
  message: Message;
  grouped: boolean;
  highlighted: boolean;
  inThreadView: boolean;
  texts: ChatTexts;
  timestampOptions?: TimestampOptions;
  messageActions?: MessageActionsOptions;
  hooks: PartyHooks;
  attachments: ReactNode;
}) {
  const textRef = useRef<HTMLDivElement>(null);
  const author = authorOf(message);
  const date = messageDate(message.at);
  const time = date ? timestampLabel(date, timestampOptions) : undefined;
  const cards = (message.cards ?? []).map((card, index) => {
    const content = hooks.renderCard?.(card, message);
    return content === undefined || content === null ? null : <div data-card-kind={card.kind} key={card.key ?? `${card.kind}-${index}`}>{content}</div>;
  }).filter((card) => card !== null);
  const thread = !inThreadView && message.thread && message.thread.count > 0 ? message.thread : undefined;
  return (
    <div
      className={cn(
        "qsl:group/message qsl:relative qsl:mx-[calc(var(--qsl-party-row-inset,12px)*-1)] qsl:grid qsl:grid-cols-[var(--qsl-avatar-size,32px)_minmax(0,1fr)] qsl:gap-x-3 qsl:rounded-[var(--qsl-party-row-radius,10px)] qsl:px-[var(--qsl-party-row-inset,12px)] qsl:transition-colors",
        grouped ? "qsl:mt-0 qsl:py-0.5" : "qsl:mt-[var(--qsl-chat-dense-message-gap,3px)] qsl:py-[var(--qsl-party-row-padding,8px)]",
        highlighted && "qsl:bg-[var(--qsl-highlight-background,color-mix(in_srgb,var(--qsl-warning)_12%,transparent))] qsl:shadow-[inset_2px_0_0_var(--qsl-highlight-edge,var(--qsl-warning))]",
      )}
      data-highlighted={highlighted || undefined}
      data-message="party"
      data-message-key={message.key}
      data-grouped={grouped || undefined}
    >
      <div className="qsl:pt-px">{!grouped && (hooks.renderAvatar?.(author, message) ?? <Avatar author={author} />)}</div>
      <div className="qsl:min-w-0">
        {!grouped && (
          <div className="qsl:flex qsl:min-w-0 qsl:flex-wrap qsl:items-baseline qsl:gap-x-2 qsl:gap-y-0.5" data-chat="message-header">
            <span className="qsl:font-semibold qsl:whitespace-nowrap" data-chat="author">{author.name}</span>
            {time && <time className="qsl:text-small qsl:whitespace-nowrap qsl:text-muted-foreground qsl:tabular-nums" dateTime={date?.toISOString()}>{time}</time>}
            {message.edited && <span className="qsl:text-small qsl:text-muted-foreground" data-chat="edited">{texts.edited ?? defaultTexts.edited}</span>}
            {message.badges?.map((badge) => (
              <span className={cn("qsl:inline-flex qsl:items-center qsl:self-center qsl:rounded-full qsl:px-2 qsl:py-px qsl:text-small qsl:font-medium", badgeTones[badge.tone ?? "neutral"])}
                data-chat="badge" data-tone={badge.tone ?? "neutral"} key={badge.label}>{badge.label}</span>
            ))}
            {hooks.renderMessageDecorations?.(message, "header")}
          </div>
        )}
        <div className={cn(!grouped && "qsl:mt-0.5")} data-chat="message-text" ref={textRef}>
          <Markdown text={mentionMarkdown(message.text, message.mentions)} />
        </div>
        {attachments}
        {cards.length > 0 && <div className="qsl:mt-2.5 qsl:flex qsl:flex-col qsl:items-start qsl:gap-2" data-chat="cards">{cards}</div>}
        <Reactions hooks={hooks} message={message} texts={texts} />
        {thread && <ThreadSummary hooks={hooks} message={message} texts={texts} thread={thread} timestampOptions={timestampOptions} />}
        <div className="qsl:absolute qsl:top-1 qsl:right-2 qsl:[&>[data-chat=message-actions]]:mt-0" data-chat="party-actions">
          <MessageActions contentRef={textRef} message={message} options={messageActions} side="end" texts={texts} />
        </div>
      </div>
    </div>
  );
}

function Reactions({ message, hooks, texts }: { message: Message; hooks: PartyHooks; texts: ChatTexts }) {
  const [picking, setPicking] = useState(false);
  const reactions = (message.reactions ?? []).filter((reaction) => reaction.count > 0);
  const toggle = hooks.onToggleReaction;
  const choices = toggle ? hooks.reactionChoices ?? [] : [];
  if (reactions.length === 0 && choices.length === 0) return null;
  const mine = (reaction: ChatReaction) => reaction.mine ?? (hooks.currentUserId !== undefined && !!reaction.userIds?.includes(hooks.currentUserId));
  const icon = (key: string) => hooks.renderReaction?.(key) ?? key;
  const label = (key: string, count: number) => fillText(texts.reaction ?? defaultTexts.reaction!, { reaction: key, count });
  const unused = choices.filter((key) => !reactions.some((reaction) => reaction.key === key));
  return (
    <div className={cn("qsl:mt-2 qsl:flex qsl:flex-wrap qsl:items-center qsl:gap-1.5", reactions.length === 0 && !picking && "qsl:hidden qsl:group-hover/message:flex qsl:focus-within:flex")} data-chat="reactions">
      {reactions.map((reaction) => {
        const own = mine(reaction);
        const classes = cn(chipClasses, own
          ? "qsl:bg-[var(--qsl-reaction-mine-background,color-mix(in_srgb,var(--qsl-primary)_14%,transparent))] qsl:text-[var(--qsl-reaction-mine-foreground,var(--qsl-primary))]"
          : "qsl:bg-[var(--qsl-reaction-background,var(--qsl-background))] qsl:text-muted-foreground qsl:shadow-[var(--qsl-reaction-shadow,0_0_0_1px_var(--qsl-border-soft))]");
        const content = <>{icon(reaction.key)}<span className="qsl:tabular-nums">{reaction.count}</span></>;
        return toggle
          ? <button aria-label={label(reaction.key, reaction.count)} aria-pressed={own} className={cn(classes, "qsl:cursor-pointer qsl:hover:brightness-95")} data-chat="reaction" data-mine={own || undefined}
            key={reaction.key} onClick={() => toggle(message, reaction.key)} title={label(reaction.key, reaction.count)} type="button">{content}</button>
          : <span aria-label={label(reaction.key, reaction.count)} className={classes} data-chat="reaction" data-mine={own || undefined} key={reaction.key} role="img">{content}</span>;
      })}
      {toggle && picking && unused.map((key) => (
        <button aria-label={key} className={cn(chipClasses, "qsl:cursor-pointer qsl:bg-[var(--qsl-reaction-background,var(--qsl-background))] qsl:text-muted-foreground qsl:shadow-[var(--qsl-reaction-shadow,0_0_0_1px_var(--qsl-border-soft))] qsl:hover:text-foreground")}
          data-chat="reaction-choice" key={key} onClick={() => { setPicking(false); toggle(message, key); }} title={key} type="button">{icon(key)}</button>
      ))}
      {toggle && unused.length > 0 && (
        <button aria-expanded={picking} aria-label={texts.addReaction ?? defaultTexts.addReaction} className={cn(chipClasses, "qsl:cursor-pointer qsl:px-1.5 qsl:text-muted-foreground qsl:hover:bg-secondary qsl:hover:text-foreground")}
          data-chat="add-reaction" onClick={() => setPicking((value) => !value)} title={texts.addReaction ?? defaultTexts.addReaction} type="button"><SmilePlusIcon /></button>
      )}
    </div>
  );
}

function ThreadSummary({ message, thread, hooks, texts, timestampOptions }: {
  message: Message;
  thread: ChatThread;
  hooks: PartyHooks;
  texts: ChatTexts;
  timestampOptions?: TimestampOptions;
}) {
  const custom = hooks.renderThreadSummary?.(message, thread);
  if (custom !== undefined) return <div className="qsl:mt-2" data-chat="thread-summary">{custom}</div>;
  const count = thread.count === 1 ? texts.threadReplyOne ?? defaultTexts.threadReplyOne! : fillText(texts.threadReplyMany ?? defaultTexts.threadReplyMany!, { count: thread.count });
  const last = messageDate(thread.lastReplyAt);
  const active = hooks.activeThreadKey === message.key;
  const others = thread.participants.filter((participant) => participant.id !== message.author?.id);
  const content = <>
    {others.length > 0 && <span className="qsl:flex qsl:gap-[3px]">{others.slice(0, 5).map((participant) => <span key={participant.id}>{hooks.renderAvatar?.(participant, message) ?? <Avatar author={participant} size={20} />}</span>)}</span>}
    <span className="qsl:font-semibold qsl:text-[var(--qsl-thread-summary-foreground,var(--qsl-primary))]">{count}</span>
    {hooks.renderMessageDecorations?.(message, "thread")}
    {last && <span className="qsl:min-w-0 qsl:overflow-hidden qsl:text-small qsl:text-ellipsis qsl:text-muted-foreground">{fillText(texts.threadLastReply ?? defaultTexts.threadLastReply!, { time: timestampLabel(last, timestampOptions) })}</span>}
  </>;
  const classes = cn(
    "qsl:mt-2 qsl:-ml-1.5 qsl:inline-flex qsl:max-w-full qsl:items-center qsl:gap-2 qsl:rounded-[var(--qsl-thread-summary-radius,8px)] qsl:py-1 qsl:pr-2.5 qsl:pl-1.5 qsl:whitespace-nowrap qsl:transition-colors",
    active && "qsl:bg-[var(--qsl-thread-summary-active,color-mix(in_srgb,var(--qsl-primary)_12%,transparent))]",
  );
  return hooks.onOpenThread
    ? <button aria-label={fillText(texts.openThread ?? defaultTexts.openThread!, { count })} aria-pressed={active} className={cn(classes, "qsl:cursor-pointer qsl:text-left",
      !active && "qsl:hover:bg-[var(--qsl-thread-summary-hover,var(--qsl-secondary))] qsl:focus-visible:bg-[var(--qsl-thread-summary-hover,var(--qsl-secondary))] qsl:focus-visible:outline-none")}
      data-chat="thread-summary" onClick={() => hooks.onOpenThread?.(message)} type="button">{content}</button>
    : <div className={classes} data-chat="thread-summary">{content}</div>;
}

export function Divider({ label, kind }: { label: string; kind: "day" | "unread" | "thread" }) {
  return (
    <div className={cn(
      "qsl:mt-[var(--qsl-chat-message-gap,10px)] qsl:mb-1 qsl:flex qsl:items-center qsl:gap-3 qsl:text-small qsl:font-medium qsl:whitespace-nowrap",
      "qsl:before:h-px qsl:before:flex-1 qsl:before:content-[''] qsl:after:h-px qsl:after:flex-1 qsl:after:content-['']",
      kind === "unread"
        ? "qsl:text-[var(--qsl-unread-color,var(--qsl-primary))] qsl:before:bg-[color-mix(in_srgb,var(--qsl-unread-color,var(--qsl-primary))_35%,transparent)] qsl:after:bg-[color-mix(in_srgb,var(--qsl-unread-color,var(--qsl-primary))_35%,transparent)]"
        : "qsl:text-muted-foreground qsl:before:bg-border-soft qsl:after:bg-border-soft",
    )} data-chat={kind === "day" ? "day-separator" : kind === "unread" ? "unread-divider" : "thread-divider"} role="separator">{label}</div>
  );
}
