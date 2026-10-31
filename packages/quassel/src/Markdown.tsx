import { createContext, ReactNode, useCallback, useContext, useRef } from "react";
import { Streamdown, type Components } from "streamdown";
import { CheckIcon, CopyIcon } from "lucide-react";
import { cn } from "./ui/cn";
import { useAllowUrl, useQuasselComponents, useResolveUrl } from "./QuasselProvider";
import type { CodeBlockOptions } from "./options";
import { type ChatTexts, defaultTexts } from "./texts";
import { copyChatText, useChatAction } from "./useChatAction";
import { mentionHrefPrefix } from "./threads";

const mentionClasses = cn(
  "qsl:rounded-[4px] qsl:px-[3px] qsl:font-medium",
  "qsl:bg-[var(--qsl-mention-background,color-mix(in_srgb,var(--qsl-primary)_14%,transparent))] qsl:text-[var(--qsl-mention-foreground,var(--qsl-primary))]",
  "qsl:data-self:bg-[var(--qsl-mention-self-background,color-mix(in_srgb,var(--qsl-warning)_22%,transparent))] qsl:data-self:text-[var(--qsl-mention-self-foreground,inherit)]",
);

export type LinkClickHandler = (href: string, label: string) => boolean;

const LinkClickContext = createContext<LinkClickHandler | undefined>(undefined);
const MentionContext = createContext<string | undefined>(undefined);

/** Marks mentions of this user id as addressed to the reader. */
export function MarkdownMentions({ children, currentUserId }: { children: ReactNode; currentUserId?: string }) {
  return <MentionContext.Provider value={currentUserId}>{children}</MentionContext.Provider>;
}
const CodeBlockContext = createContext<{ options?: CodeBlockOptions; texts: ChatTexts }>({ texts: defaultTexts });

export function MarkdownCodeBlocks({ children, options, texts }: { children: ReactNode; options?: CodeBlockOptions; texts: ChatTexts }) {
  return <CodeBlockContext.Provider value={{ options, texts }}>{children}</CodeBlockContext.Provider>;
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const { options, texts } = useContext(CodeBlockContext);
  const { Button } = useQuasselComponents();
  const code = useRef<HTMLPreElement>(null);
  const action = useChatAction();
  const label = action.status === "done" ? texts.copied : texts.copyCode;
  const block = <pre ref={code} data-chat="code-block"
    className={cn(scrollbar, "qsl:overflow-auto qsl:overscroll-contain")}
    style={{ maxHeight: options?.maxHeight, whiteSpace: options?.wrap ? "pre-wrap" : undefined, overflowWrap: options?.wrap ? "anywhere" : undefined }}>{children}</pre>;
  if (!options?.showCopyButton) return block;
  return <div className="qsl:relative">
    {block}
    <Button aria-label={label} className="qsl:absolute qsl:top-1 qsl:right-1 qsl:bg-secondary" disabled={action.status === "pending"} size="icon-sm" title={label} variant="ghost"
      onClick={() => { void action.invoke(() => copyChatText(code.current?.textContent ?? "", texts.clipboardUnavailable), texts.actionFailed); }}>
      {action.status === "done" ? <CheckIcon /> : <CopyIcon />}
    </Button>
    {action.error && <p className="qsl:text-small qsl:text-destructive" role="alert">{action.error}</p>}
  </div>;
}

export function MarkdownLinks({ children, onLinkClick }: { children: ReactNode; onLinkClick?: LinkClickHandler }) {
  return <LinkClickContext.Provider value={onLinkClick}>{children}</LinkClickContext.Provider>;
}

function MarkdownLink({ href, children }: { href?: string; children?: ReactNode }) {
  const onLinkClick = useContext(LinkClickContext);
  const currentUserId = useContext(MentionContext);
  if (href?.startsWith(mentionHrefPrefix)) {
    const id = decodeURIComponent(href.slice(mentionHrefPrefix.length));
    return <span className={mentionClasses} data-chat="mention" data-mention-id={id} data-self={id === currentUserId || undefined}>{children}</span>;
  }
  if (!href || href === "streamdown:incomplete-link") {
    return <span>{children}</span>;
  }
  return (
    <a
      href={href}
      onClick={(event) => {
        if (href && onLinkClick?.(href, event.currentTarget.textContent ?? "")) {
          event.preventDefault();
        }
      }}
      rel="noreferrer"
      target="_blank"
    >
      {children}
    </a>
  );
}

// Horizontal scrollbars stay visible - otherwise the overflow cannot be found.
const scrollbar = "qsl:[scrollbar-width:thin] qsl:[&::-webkit-scrollbar]:block qsl:[&::-webkit-scrollbar]:h-2 qsl:[&::-webkit-scrollbar-thumb]:rounded-full qsl:[&::-webkit-scrollbar-thumb]:bg-border";

// The cover strips hide the cut at the edge; --qsl-scroll-cover comes from the surrounding bubble.
const scrollCover = "qsl:bg-[linear-gradient(to_right,var(--qsl-scroll-cover,var(--qsl-background))_50%,transparent)_left/20px_100%_no-repeat_local,linear-gradient(to_left,var(--qsl-scroll-cover,var(--qsl-background))_50%,transparent)_right/20px_100%_no-repeat_local,linear-gradient(to_right,#00000047,transparent)_left/14px_100%_no-repeat_scroll,linear-gradient(to_left,#00000047,transparent)_right/14px_100%_no-repeat_scroll]";

const components: Components = {
  h1: ({ children }) => <h1>{children}</h1>,
  h2: ({ children }) => <h2>{children}</h2>,
  h3: ({ children }) => <h3>{children}</h3>,
  h4: ({ children }) => <h4>{children}</h4>,
  h5: ({ children }) => <h5>{children}</h5>,
  h6: ({ children }) => <h6>{children}</h6>,
  p: ({ children }) => <p>{children}</p>,
  ul: ({ children }) => <ul>{children}</ul>,
  ol: ({ children }) => <ol>{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  hr: () => <hr />,
  img: ({ src, alt }) => <img alt={alt} className="qsl:h-auto qsl:max-w-full" src={typeof src === "string" ? src : undefined} />,
  blockquote: ({ children }) => (
    <blockquote>{children}</blockquote>
  ),
  strong: ({ children }) => <strong>{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  a: ({ href, children }) => <MarkdownLink href={href}>{children}</MarkdownLink>,
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  code: ({ children, className }) => (
    <code className={className}>{children}</code>
  ),
  // Without max-content the table shrinks to the container and stacks letters.
  table: ({ children }) => (
    <div className={cn(scrollbar, scrollCover, "qsl:overflow-x-auto qsl:overscroll-x-contain")} data-quassel-table="">
      <table className="qsl:w-max qsl:min-w-full qsl:border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => <th>{children}</th>,
  td: ({ children }) => <td>{children}</td>,
};

function transformUrl(url: string, allowUrl?: (url: string) => boolean, resolveUrl?: (url: string) => string) {
  const resolved = resolveUrl ? resolveUrl(url) : url;
  if (allowUrl?.(resolved)) return resolved;
  const scheme = /^[^/?#]*:/.exec(resolved);
  return !scheme || /^(https?|mailto|tel|ftp|irc|ircs|xmpp):$/i.test(scheme[0]) ? resolved : "";
}

export function Markdown({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const allowUrl = useAllowUrl();
  const resolveUrl = useResolveUrl();
  const urlTransform = useCallback((url: string) => transformUrl(url, allowUrl, resolveUrl), [allowUrl, resolveUrl]);
  return (
    <div data-quassel="" data-quassel-markdown="">
    <Streamdown
      prefix="qsl"
      mode={streaming ? "streaming" : "static"}
      isAnimating={streaming}
      parseIncompleteMarkdown={streaming}
      components={components}
      controls={false}
      rehypePlugins={[]}
      urlTransform={urlTransform}
      skipHtml
    >
      {text}
    </Streamdown>
    </div>
  );
}

/** The same syntax as the renderer, as plain text without markup, e.g. for screen reader announcements. */
export function markdownPlainText(text: string): string {
  return text
    .split("\n")
    .filter((line) => !/^\s*```\w*\s*$/.test(line) && !isTableDivider(line))
    .map((line) => (line.trim().startsWith("|") ? splitTableRow(line).join(", ") : line)
      .replace(/^(#{1,6})\s+/, "")
      .replace(/^\s*>\s?/, "")
      .replace(/^\s*([-*+]|\d+[.)])\s+/, "")
      .replace(/!?\[([^\]]*)\]\(([^)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|`([^`]+)`/g, (_, link, _href, bold, boldUnderscore, italic, code) => link ?? bold ?? boldUnderscore ?? italic ?? code)
      .trim())
    .filter((line) => line !== "")
    .join("\n");
}

function splitTableRow(line: string): string[] {
  let row = line.trim();
  if (row.startsWith("|")) {
    row = row.slice(1);
  }
  if (row.endsWith("|")) {
    row = row.slice(0, -1);
  }
  return row.split("|").map((cell) => cell.trim());
}

function isTableDivider(line: string): boolean {
  return /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(line) && line.includes("-");
}
