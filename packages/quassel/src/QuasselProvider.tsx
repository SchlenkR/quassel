import { createContext, useContext, useMemo, type ComponentType, type ReactNode } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Popover, PopoverContent } from "./ui/popover";
import { StopButton } from "./ui/stop-button";
import { Toggle } from "./ui/toggle";

export type QuasselButtonVariant = "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
export type QuasselButtonSize = "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";

export interface QuasselButtonProps {
  variant?: QuasselButtonVariant;
  size?: QuasselButtonSize;
  className?: string;
  disabled?: boolean;
  title?: string;
  "aria-label"?: string;
  "aria-pressed"?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}

export interface QuasselToggleProps {
  variant?: "default" | "outline";
  size?: "default" | "sm" | "lg";
  className?: string;
  disabled?: boolean;
  title?: string;
  pressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  children?: ReactNode;
}

export interface QuasselCardProps {
  size?: "default" | "sm";
  className?: string;
  children?: ReactNode;
}

export interface QuasselStopButtonProps {
  label: string;
  busy?: boolean;
  size?: QuasselButtonSize;
  className?: string;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
}

export interface QuasselPopoverProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}

export interface QuasselPopoverAnchor {
  getBoundingClientRect: () => DOMRect;
  contextElement?: Element;
}

export interface QuasselPopoverContentProps {
  anchor?: QuasselPopoverAnchor;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right" | "inline-start" | "inline-end";
  sideOffset?: number;
  collisionPadding?: number;
  className?: string;
  "aria-label"?: string;
  children?: ReactNode;
}

/** The primitives quassel renders; a host replaces any of them through QuasselProvider. */
export interface QuasselComponents {
  Button: ComponentType<QuasselButtonProps>;
  Toggle: ComponentType<QuasselToggleProps>;
  Card: ComponentType<QuasselCardProps>;
  StopButton: ComponentType<QuasselStopButtonProps>;
  Popover: ComponentType<QuasselPopoverProps>;
  PopoverContent: ComponentType<QuasselPopoverContentProps>;
}

export const defaultComponents: QuasselComponents = { Button, Toggle, Card, StopButton, Popover, PopoverContent };

interface QuasselSettings {
  components: QuasselComponents;
  allowUrl?: (url: string) => boolean;
}

const QuasselContext = createContext<QuasselSettings>({ components: defaultComponents });

export function QuasselProvider({ components, allowUrl, children }: {
  /** Replaces single primitives; the rest stay the built-in ones or those of an outer provider. */
  components?: Partial<QuasselComponents>;
  /** Keeps Markdown link and image URLs that the default policy (http, https, mailto, tel, ftp, irc, xmpp, relative) would drop. */
  allowUrl?: (url: string) => boolean;
  children: ReactNode;
}) {
  const outer = useContext(QuasselContext);
  const value = useMemo(() => ({
    components: { ...outer.components, ...components },
    allowUrl: allowUrl ?? outer.allowUrl,
  }), [outer, components, allowUrl]);
  return <QuasselContext.Provider value={value}>{children}</QuasselContext.Provider>;
}

export const useQuasselComponents = (): QuasselComponents => useContext(QuasselContext).components;

export const useAllowUrl = (): ((url: string) => boolean) | undefined => useContext(QuasselContext).allowUrl;
