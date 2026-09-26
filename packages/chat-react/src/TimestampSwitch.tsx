import { ChatTexts, defaultTexts } from "./texts";
import { IconClock } from "./icons";

export function TimestampSwitch({
  showTimestamps,
  onChange,
  collapsible = true,
  texts,
  className,
}: {
  showTimestamps: boolean;
  onChange: (showTimestamps: boolean) => void;
  collapsible?: boolean;
  texts?: Partial<ChatTexts>;
  className?: string;
}) {
  const label = texts?.timestamps ?? defaultTexts.timestamps;
  const classes = showTimestamps ? "qsl-icon-button qsl-icon-button--active" : "qsl-icon-button";
  return (
    <button
      aria-label={label}
      aria-pressed={showTimestamps}
      className={className ? `${classes} ${className}` : classes}
      onClick={() => onChange(!showTimestamps)}
      title={label}
      type="button"
    >
      <IconClock />
      <span className={collapsible ? "qsl-collapsible" : undefined}>{label}</span>
    </button>
  );
}
