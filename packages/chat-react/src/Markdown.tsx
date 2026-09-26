import { createContext, ReactNode, useContext } from "react";
import type { CodeBlockOptions } from "./options";
import { defaultTexts, type ChatTexts } from "./texts";
import { ActionButton, copyText } from "./MessageActions";

const CodeBlockContext = createContext<{ options?: CodeBlockOptions; texts?: Partial<ChatTexts> }>({});

export function MarkdownCodeBlocks({ children, options, texts }: {
  children: ReactNode;
  options?: CodeBlockOptions;
  texts?: Partial<ChatTexts>;
}) {
  return <CodeBlockContext.Provider value={{ options, texts }}>{children}</CodeBlockContext.Provider>;
}

function CodeBlock({ text }: { text: string }) {
  const { options, texts } = useContext(CodeBlockContext);
  const labels = { ...defaultTexts, ...texts };
  const content = <pre style={{
    whiteSpace: options?.wrap ? "pre-wrap" : undefined,
    overflowWrap: options?.wrap ? "anywhere" : undefined,
    maxHeight: options?.maxHeight,
    overflowY: options?.maxHeight === undefined ? undefined : "auto",
  }}><code>{text}</code></pre>;
  return options?.showCopyButton ? <div className="qsl-code-block">
    <ActionButton label={labels.copyCode} successLabel={labels.copied} onClick={() => copyText(text, labels.copyFailed)} />
    {content}
  </div> : content;
}

/**
 * Schlanker Markdown-Renderer ohne Abhängigkeit: Überschriften, **fett**, *kursiv*,
 * `code`, Links, Listen, Blockquotes, Code-Blöcke und Tabellen. Bewusst sicher (reines
 * React, kein dangerouslySetInnerHTML) und streaming-robust: zeilenbasiert, unvollständige
 * Blöcke werden so weit gerendert wie vorhanden.
 */
/** true = der Host hat den Link behandelt, der Browser folgt ihm nicht. */
export type LinkClickHandler = (href: string, label: string) => boolean;

const LinkClickContext = createContext<LinkClickHandler | undefined>(undefined);

/** Faengt Klicks auf Markdown-Links im Teilbaum ab, z.B. fuer eigene Ziele der Gastseite. */
export function MarkdownLinks({ children, onLinkClick }: { children: ReactNode; onLinkClick?: LinkClickHandler }) {
  return <LinkClickContext.Provider value={onLinkClick}>{children}</LinkClickContext.Provider>;
}

function MarkdownLink({ href, label }: { href: string; label: string }) {
  const onLinkClick = useContext(LinkClickContext);
  return (
    <a
      href={href}
      onClick={(event) => {
        if (onLinkClick?.(href, label)) {
          event.preventDefault();
        }
      }}
      rel="noreferrer"
      target="_blank"
    >
      {label}
    </a>
  );
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    const fence = line.match(/^\s*```(\w*)\s*$/);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        i++;
      }
      blocks.push(
        <CodeBlock key={key++} text={body.join("\n")} />,
      );
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const header = splitTableRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      blocks.push(
        <div className="qsl-md-scroll" key={key++}>
          <table>
            <thead>
              <tr>
                {header.map((cell, ci) => (
                  <th key={ci}>{renderInline(cell, `th${key}_${ci}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {header.map((_, ci) => (
                    <td key={ci}>{renderInline(row[ci] ?? "", `td${key}_${ri}_${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      blocks.push(
        level === 1 ? (
          <h3 key={key++}>{renderInline(heading[2], `h${key}`)}</h3>
        ) : (
          <h4 key={key++}>{renderInline(heading[2], `h${key}`)}</h4>
        ),
      );
      i++;
      continue;
    }

    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      blocks.push(<blockquote key={key++}>{renderInline(quote[1], `q${key}`)}</blockquote>);
      i++;
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      blocks.push(
        <div className="qsl-md-bullet" key={key++}>
          <span>&bull;</span>
          <span>{renderInline(bullet[1], `l${key}`)}</span>
        </div>,
      );
      i++;
      continue;
    }

    const numbered = line.match(/^\s*(\d+)\.\s+(.*)$/);
    if (numbered) {
      blocks.push(
        <div className="qsl-md-bullet" key={key++}>
          <span>{numbered[1]}.</span>
          <span>{renderInline(numbered[2], `l${key}`)}</span>
        </div>,
      );
      i++;
      continue;
    }

    if (line.trim() === "") {
      blocks.push(<div className="qsl-md-gap" key={key++} />);
      i++;
      continue;
    }

    blocks.push(<p key={key++}>{renderInline(line, `l${key}`)}</p>);
    i++;
  }

  return <div className="qsl-md">{blocks}</div>;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      out.push(text.slice(last, match.index));
    }
    if (match[1] !== undefined) {
      out.push(<MarkdownLink href={match[2]} key={`${keyPrefix}a${i}`} label={match[1]} />);
    } else if (match[3] !== undefined) {
      out.push(<strong key={`${keyPrefix}b${i}`}>{match[3]}</strong>);
    } else if (match[4] !== undefined) {
      out.push(<em key={`${keyPrefix}i${i}`}>{match[4]}</em>);
    } else if (match[5] !== undefined) {
      out.push(<code key={`${keyPrefix}c${i}`}>{match[5]}</code>);
    }
    last = match.index + match[0].length;
    i++;
  }
  if (last < text.length) {
    out.push(text.slice(last));
  }
  return out;
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
