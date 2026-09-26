import "./ChoiceCard.css";
import { useQuasselComponents, type PendingAction } from "quassel";

/** A host-owned rendering of a pending action: the options as buttons, the answer once resolved. */
export function ChoiceCard({ action, text, onChoose }: { action: PendingAction; text: string; onChoose: (option: string) => void }) {
  const { Button, Card } = useQuasselComponents();
  const options = (action.payload as { options?: string[] }).options ?? [];
  return (
    <Card className="choice-card" size="sm">
      <div>{text}</div>
      {action.status === undefined ? (
        <div className="choice-options">
          {options.map((option) => (
            <Button key={option} onClick={() => onChoose(option)} size="sm" variant="outline">{option}</Button>
          ))}
        </div>
      ) : (
        <div className="choice-answer">{String(action.result)}</div>
      )}
    </Card>
  );
}
