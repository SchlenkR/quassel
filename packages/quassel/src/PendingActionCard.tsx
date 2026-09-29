import { CheckIcon, XIcon } from "lucide-react";
import { useQuasselComponents } from "./QuasselProvider";
import type { PendingAction } from "./types";

const cardClasses = "qsl:gap-2.5 qsl:bg-background qsl:px-3.5 qsl:text-sm";

const resultText = (result: unknown): string =>
  typeof result === "string" ? result : result === null || result === undefined ? "" : JSON.stringify(result);

/**
 * The rendering of a pending action without a contribution from its owner: title, the hint
 * that input is expected, and dismissing. Only the plugin knows the form.
 */
export function PendingActionCard({
  text,
  action,
  waitingLabel,
  dismissLabel,
  dismissedLabel,
  onDismiss,
}: {
  text: string;
  action: PendingAction;
  waitingLabel: string;
  dismissLabel: string;
  dismissedLabel: string;
  onDismiss?: () => void;
}) {
  const { Button, Card } = useQuasselComponents();
  if (action.status !== undefined) {
    return (
      <Card className={cardClasses} size="sm">
        <div className="qsl:leading-normal">{text}</div>
        <div className="qsl:flex qsl:items-center qsl:gap-1.5 qsl:text-sm qsl:text-muted-foreground" data-action="resolved">
          {action.status === "approved" ? <CheckIcon className="qsl:text-success" size={12} /> : <XIcon size={12} />}
          {action.status === "approved" ? resultText(action.result) : dismissedLabel}
        </div>
      </Card>
    );
  }

  return (
    <Card className={cardClasses} size="sm">
      <div className="qsl:leading-normal">{text}</div>
      <div className="qsl:flex qsl:items-center qsl:justify-between qsl:gap-2">
        <span className="qsl:text-sm qsl:text-muted-foreground" data-action="waiting">{waitingLabel}</span>
        {onDismiss && (
          <Button onClick={onDismiss} size="sm" variant="outline">{dismissLabel}</Button>
        )}
      </div>
    </Card>
  );
}
