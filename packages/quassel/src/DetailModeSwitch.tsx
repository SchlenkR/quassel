import { CircleDotIcon, EyeOffIcon, ListCollapseIcon, ListIcon, type LucideIcon, ShapesIcon, TagsIcon, TextAlignJustifyIcon } from "lucide-react";
import { useQuasselComponents } from "./QuasselProvider";
import { DetailMode } from "./types";
import { ChatTexts, defaultTexts } from "./texts";

export const DETAIL_MODES: readonly DetailMode[] = ["off", "current", "icons", "chips", "grouped", "compact", "full"];

const TEXT_KEYS: Record<DetailMode, keyof ChatTexts> = {
  off: "detailModeOff",
  current: "detailModeCurrent",
  icons: "detailModeIcons",
  chips: "detailModeChips",
  grouped: "detailModeGrouped",
  compact: "detailModeCompact",
  full: "detailModeFull",
};

const ICONS: Record<DetailMode, LucideIcon> = {
  off: EyeOffIcon,
  current: CircleDotIcon,
  icons: ShapesIcon,
  chips: TagsIcon,
  grouped: ListCollapseIcon,
  compact: ListIcon,
  full: TextAlignJustifyIcon,
};

export const detailModeLabel = (mode: DetailMode, texts?: Partial<ChatTexts>): string =>
  ({ ...defaultTexts, ...texts })[TEXT_KEYS[mode]];

/**
 * An icon button that cycles the detail level of the thinking and tool steps. The order comes
 * from `modes`, the current value shows in the icon and in the tooltip.
 */
export function DetailModeSwitch({
  mode,
  onChange,
  modes = DETAIL_MODES,
  texts,
  className,
}: {
  mode: DetailMode;
  onChange: (mode: DetailMode) => void;
  /** Selection and order of cycling; the default is all modes. */
  modes?: readonly DetailMode[];
  texts?: Partial<ChatTexts>;
  className?: string;
}) {
  const allTexts = { ...defaultTexts, ...texts };
  const { Button } = useQuasselComponents();
  const current = modes.indexOf(mode);
  const next = modes[(current < 0 ? 0 : current + 1) % modes.length];
  const Icon = ICONS[mode];
  const title = `${allTexts.detailModeTitle}: ${detailModeLabel(mode, texts)}`;
  return (
    <Button aria-label={title} className={className} onClick={() => onChange(next)} size="icon-sm" title={title} variant="ghost">
      <Icon />
    </Button>
  );
}
