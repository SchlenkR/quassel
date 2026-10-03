import { createContext, ReactNode, useCallback, useContext, useRef } from "react";
import { Streamdown, type Components } from "streamdown";
import { CheckIcon, CopyIcon } from "lucide-react";
import { cn } from "./ui/cn";
import { useAllowUrl, useQuasselComponents, useResolveUrl } from "./QuasselProvider";
import type { CodeBlockOptions } from "./options";
import { type ChatTexts, defaultTexts } from "./texts";
import { copyChatText, useChatAction } from "./useChatAction";

export type LinkClickHandler = (href: string, label: string) => boolean;

const LinkClickContext = createContext<LinkClickHandler | undefined>(undefined);
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
    className={cn(scrollbar, "qsl:my-2 qsl:overflow-auto qsl:rounded-lg qsl:bg-secondary qsl:px-3 qsl:py-2 qsl:font-mono qsl:text-sm qsl:leading-relaxed qsl:in-data-[tone=on-color]:bg-black/30 qsl:in-data-[tone=on-color]:text-inherit")}
    style={{ maxHeight: options?.maxHeight, whiteSpace: options?.wrap ? "pre-wrap" : undefined, overflowWrap: options?.wrap ? "anywhere" : undefined }}>{children}</pre>;
  if (!options?.showCopyButton) return block;
  return <div className="qsl:relative">
    {block}
    <Button aria-label={label} className="qsl:absolute qsl:top-1 qsl:right-1 qsl:bg-secondary" disabled={action.status === "pending"} size="icon-sm" title={label} variant="ghost"
      onClick={() => { void action.invoke(() => copyChatText(code.current?.textContent ?? "", texts.clipboardUnavailable), texts.actionFailed); }}>
      {action.status === "done" ? <CheckIcon /> : <CopyIcon />}
    </Button>
    {action.error && <p className="qsl:text-sm qsl:text-destructive" role="alert">{action.error}</p>}
  </div>;
}

export function MarkdownLinks({ children, onLinkClick }: { children: ReactNode; onLinkClick?: LinkClickHandler }) {
  return <LinkClickContext.Provider value={onLinkClick}>{children}</LinkClickContext.Provider>;
}

function MarkdownLink({ href, children }: { href?: string; children?: ReactNode }) {
  const onLinkClick = useContext(LinkClickContext);
  if (!href || href === "streamdown:incomplete-link") {
    return <span>{children}</span>;
  }
  return (
    <a
      className="qsl:text-primary qsl:[text-underline-offset:2px] qsl:in-data-[tone=on-color]:text-inherit qsl:in-data-[tone=on-color]:underline"
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

const headingClasses = "qsl:mt-3 qsl:mb-1 qsl:text-[15px] qsl:font-medium";
const cellClasses = "qsl:max-w-[44ch] qsl:border qsl:border-border qsl:px-2 qsl:py-1 qsl:text-left qsl:align-top qsl:in-data-[tone=on-color]:border-white/35";

const components: Components = {
  h1: ({ children }) => <h1 className="qsl:mt-3 qsl:mb-1 qsl:text-lg qsl:font-semibold">{children}</h1>,
  h2: ({ children }) => <h2 className={headingClasses}>{children}</h2>,
  h3: ({ children }) => <h3 className={headingClasses}>{children}</h3>,
  h4: ({ children }) => <h4 className="qsl:mt-2 qsl:mb-1 qsl:text-base qsl:font-medium">{children}</h4>,
  h5: ({ children }) => <h5 className="qsl:mt-2 qsl:mb-1 qsl:text-base qsl:font-medium">{children}</h5>,
  h6: ({ children }) => <h6 className="qsl:mt-2 qsl:mb-1 qsl:text-base qsl:font-medium">{children}</h6>,
  p: ({ children }) => <p className="qsl:[p+&]:mt-2">{children}</p>,
  ul: ({ children }) => <ul className="qsl:my-2 qsl:list-disc qsl:pl-6 qsl:[li>&]:my-0">{children}</ul>,
  ol: ({ children }) => <ol className="qsl:my-2 qsl:list-decimal qsl:pl-6 qsl:[li>&]:my-0">{children}</ol>,
  li: ({ children }) => <li className="qsl:marker:text-muted-foreground qsl:in-data-[tone=on-color]:marker:text-inherit">{children}</li>,
  hr: () => <hr className="qsl:my-3 qsl:border-t qsl:border-border" />,
  img: ({ src, alt }) => <img alt={alt} className="qsl:h-auto qsl:max-w-full" src={typeof src === "string" ? src : undefined} />,
  blockquote: ({ children }) => (
    <blockquote className="qsl:my-1 qsl:border-l-2 qsl:border-border qsl:pl-3 qsl:text-muted-foreground qsl:in-data-[tone=on-color]:border-white/50 qsl:in-data-[tone=on-color]:text-inherit">{children}</blockquote>
  ),
  strong: ({ children }) => <strong className="qsl:font-medium">{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  a: ({ href, children }) => <MarkdownLink href={href}>{children}</MarkdownLink>,
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  code: ({ children, className }) => (
    <code className={cn(className, "qsl:rounded-sm qsl:bg-secondary qsl:px-1 qsl:py-0.5 qsl:font-mono qsl:text-sm qsl:[overflow-wrap:anywhere] qsl:in-data-[tone=on-color]:bg-white/20 qsl:in-data-[tone=on-color]:text-inherit", "qsl:[pre>&]:bg-transparent qsl:[pre>&]:p-0")}>{children}</code>
  ),
  // Without max-content the table shrinks to the container and stacks letters.
  table: ({ children }) => (
    <div className={cn(scrollbar, scrollCover, "qsl:my-2 qsl:overflow-x-auto")}>
      <table className="qsl:w-max qsl:min-w-full qsl:border-collapse qsl:text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => <th className={cn(cellClasses, "qsl:bg-secondary qsl:font-medium qsl:in-data-[tone=on-color]:bg-white/15 qsl:in-data-[tone=on-color]:text-inherit")}>{children}</th>,
  td: ({ children }) => <td className={cellClasses}>{children}</td>,
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
    <Streamdown
      className="space-y-0 text-inherit"
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
