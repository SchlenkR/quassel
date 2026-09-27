import { createContext, useContext, useMemo, type ComponentType, type ReactNode, type RefObject } from "react";
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

/** Where popovers mount: an element, a ref or a getter; resolved when the popover opens. */
export type QuasselPortalTarget = HTMLElement | ShadowRoot;
export type QuasselPortalContainer = QuasselPortalTarget | RefObject<QuasselPortalTarget | null> | (() => QuasselPortalTarget | null | undefined);

export interface QuasselPopoverContentProps {
  anchor?: QuasselPopoverAnchor;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right" | "inline-start" | "inline-end";
  sideOffset?: number;
  collisionPadding?: number;
  className?: string;
  "aria-label"?: string;
  /** The resolved portalContainer of QuasselProvider; undefined = document.body. */
  portalContainer?: QuasselPortalTarget;
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
  portalContainer?: QuasselPortalContainer;
}

const QuasselContext = createContext<QuasselSettings>({ components: defaultComponents });

export function QuasselProvider({ components, allowUrl, portalContainer, children }: {
  /** Replaces single primitives; the rest stay the built-in ones or those of an outer provider. */
  components?: Partial<QuasselComponents>;
  /** Keeps Markdown link and image URLs that the default policy (http, https, mailto, tel, ftp, irc, xmpp, relative) would drop. */
  allowUrl?: (url: string) => boolean;
  /** Mounts quassel's popovers inside this element instead of document.body, e.g. within the host's theme wrapper. */
  portalContainer?: QuasselPortalContainer;
  children: ReactNode;
}) {
  const outer = useContext(QuasselContext);
  const value = useMemo(() => ({
    components: { ...outer.components, ...components },
    allowUrl: allowUrl ?? outer.allowUrl,
    portalContainer: portalContainer ?? outer.portalContainer,
  }), [outer, components, allowUrl, portalContainer]);
  return <QuasselContext.Provider value={value}>{children}</QuasselContext.Provider>;
}

export const useQuasselComponents = (): QuasselComponents => useContext(QuasselContext).components;

export const useAllowUrl = (): ((url: string) => boolean) | undefined => useContext(QuasselContext).allowUrl;

export function useQuasselPortalContainer(): QuasselPortalTarget | undefined {
  const container = useContext(QuasselContext).portalContainer;
  const target = typeof container === "function" ? container() : container && "current" in container ? container.current : container;
  return target ?? undefined;
}
