import type { CSSProperties, ReactNode } from "react";
import type { Message } from "./types";

export interface ChatAppearance {
  messageGap?: CSSProperties["marginTop"];
  denseMessageGap?: CSSProperties["marginTop"];
  toolGroupGap?: CSSProperties["rowGap"];
  toolRowPadding?: CSSProperties["paddingBlock"];
}

export interface TimestampOptions {
  position?: "aside" | "above";
  format?: "time" | "date-time" | "relative";
  locale?: string;
  timeZone?: string;
  showDaySeparators?: boolean;
  /** Label of a day separator, e.g. "Today, Saturday 31 October"; default: the long date. */
  dayLabel?: (date: Date) => string;
}

export interface CodeBlockOptions {
  wrap?: boolean;
  maxHeight?: CSSProperties["maxHeight"];
  showCopyButton?: boolean;
}

export interface BubbleOptions {
  userBackgroundFullWidth?: boolean;
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
  copyFormatted?: boolean | ((message: Message) => boolean);
  edit?: (message: Message) => void | Promise<void>;
  retry?: (message: Message) => void | Promise<void>;
  custom?: (message: Message) => readonly MessageAction[];
}

export type SendShortcut = "enter" | "mod-enter";

export interface MicrophonePress {
  source: "pointer" | "keyboard" | "virtual";
  timeStamp: number;
}

export interface ChatMicrophone {
  state: "idle" | "preparing" | "recording" | "transcribing";
  level?: number;
  onPressStart: (press: MicrophonePress) => void;
  onPressEnd: (press: MicrophonePress) => void;
  onCancel: () => void;
  label?: string;
}

const cssLength = (value: string | number | undefined) => typeof value === "number" ? `${value}px` : value;

export const appearanceStyle = (appearance?: ChatAppearance): CSSProperties => ({
  "--qsl-chat-message-gap": cssLength(appearance?.messageGap),
  "--qsl-chat-dense-message-gap": cssLength(appearance?.denseMessageGap),
  "--qsl-tool-group-gap": cssLength(appearance?.toolGroupGap),
  "--qsl-tool-row-padding": cssLength(appearance?.toolRowPadding),
} as CSSProperties);
