import type { CSSProperties, ReactNode } from "react";
import type { Message } from "./types";

export interface ChatAppearance {
  fontSize?: CSSProperties["fontSize"];
  lineHeight?: CSSProperties["lineHeight"];
  messageGap?: CSSProperties["marginTop"];
  denseMessageGap?: CSSProperties["marginTop"];
}

export interface TimestampOptions {
  format?: "time" | "date-time" | "relative";
  locale?: string;
  timeZone?: string;
  showDaySeparators?: boolean;
}

export interface CodeBlockOptions {
  wrap?: boolean;
  maxHeight?: CSSProperties["maxHeight"];
  showCopyButton?: boolean;
}

export interface BubbleOptions {
  variant?: "default" | "plain" | "bubbles";
  maxWidth?: CSSProperties["maxWidth"];
  userSide?: "start" | "end";
  assistantSide?: "start" | "end";
  showSender?: boolean;
  senderLabel?: (message: Message) => string | undefined;
}

export interface MessageAction {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  onClick: (message: Message) => void | Promise<void>;
}

export interface MessageActionsOptions {
  copy?: boolean | ((message: Message) => boolean);
  edit?: (message: Message) => void | Promise<void>;
  retry?: (message: Message) => void | Promise<void>;
  custom?: (message: Message) => readonly MessageAction[];
}

export type SendShortcut = "enter" | "mod-enter";

const length = (value: string | number | undefined) => typeof value === "number" ? `${value}px` : value;

export function appearanceStyle(appearance?: ChatAppearance): CSSProperties {
  return {
    "--qsl-chat-font-size": length(appearance?.fontSize),
    "--qsl-chat-line-height": appearance?.lineHeight,
    "--qsl-message-gap": length(appearance?.messageGap),
    "--qsl-dense-message-gap": length(appearance?.denseMessageGap),
  } as CSSProperties;
}
