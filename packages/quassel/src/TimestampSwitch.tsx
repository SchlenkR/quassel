import { ClockFadingIcon, ClockIcon } from "lucide-react";
import { useQuasselComponents } from "./QuasselProvider";
import { type ChatTexts, defaultTexts } from "./texts";

export function TimestampSwitch({ showTimestamps, onChange, texts, className }: {
  showTimestamps: boolean;
  onChange: (showTimestamps: boolean) => void;
  texts?: Partial<ChatTexts>;
  className?: string;
}) {
  const labels = { ...defaultTexts, ...texts };
  const { Button } = useQuasselComponents();
  const title = showTimestamps ? labels.hideTimestamps : labels.showTimestamps;
  return (
    <Button aria-label={title} aria-pressed={showTimestamps} className={className}
      onClick={() => onChange(!showTimestamps)} size="icon-sm" title={title} variant="ghost">
      {showTimestamps ? <ClockIcon /> : <ClockFadingIcon />}
    </Button>
  );
}
