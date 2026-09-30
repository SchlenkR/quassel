import { MessagesSquareIcon, MessageSquareIcon } from "lucide-react";
import { useQuasselComponents } from "./QuasselProvider";
import { type TranscriptMode } from "./types";
import { type ChatTexts, defaultTexts } from "./texts";

export function TranscriptModeSwitch({ mode, onChange, texts, className }: {
  mode: TranscriptMode;
  onChange: (mode: TranscriptMode) => void;
  texts?: Partial<ChatTexts>;
  className?: string;
}) {
  const labels = { ...defaultTexts, ...texts };
  const { Button } = useQuasselComponents();
  const latest = mode === "latest";
  const title = latest ? labels.showAllMessages : labels.showLatestExchange;
  return (
    <Button aria-label={title} aria-pressed={latest} className={className}
      onClick={() => onChange(latest ? "all" : "latest")} size="icon-sm" title={title} variant="ghost">
      {latest ? <MessageSquareIcon /> : <MessagesSquareIcon />}
    </Button>
  );
}
