import { SquareIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "./cn";
import { Button } from "./button";
import { Spinner } from "./spinner";

/** The one stop glyph: a filled red square; never used as a state icon. */
export function StopGlyph({ className, ...props }: Omit<ComponentProps<typeof SquareIcon>, "fill">) {
  return <SquareIcon aria-hidden className={cn("qsl:text-destructive", className)} fill="currentColor" {...props} />;
}

const stopButtonClass = "qsl:text-destructive qsl:hover:bg-destructive/10 qsl:hover:text-destructive qsl:dark:hover:bg-destructive/20";

/** Every stop button looks the same: the glyph as icon, the word in the tooltip, red at rest and on hover. */
export function StopButton({ label, busy = false, className, title, ...props }: Omit<ComponentProps<typeof Button>, "children" | "variant"> & {
  label: string;
  busy?: boolean;
}) {
  return <Button aria-busy={busy || undefined} aria-label={label} className={cn(stopButtonClass, className)} title={title ?? label} variant="ghost" {...props}>
    {busy ? <Spinner /> : <StopGlyph />}
  </Button>;
}
