import { useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  ChatInputToolbar,
  ChatMessages,
  ChatPanel,
  DetailMode,
  DetailModeSwitch,
  Message,
  TimestampSwitch,
  type ChatTexts,
} from "quassel";
import "quassel/foundation.css";
import "quassel/base.css";
import "quassel/chat.css";
import "./themes.css";
import "./showcase.css";

const texts: Partial<ChatTexts> = {
  working: "Working ...",
  toolRunning: "running ...",
  toolStillRunning: "Tool running ...",
  thinkingChip: "Thinking",
  stepGroupOne: "1 step",
  stepGroupMany: "{count} steps",
  stepGroupCollapse: "Collapse",
  thinkingTitle: "Thinking",
  toolTitle: "Tool call",
  argumentsLabel: "Arguments",
  resultLabel: "Result",
  close: "Close",
  jumpToEnd: "Jump to end",
  send: "Send",
  sendIntoRun: "Send into the running turn",
  stop: "Stop",
  placeholder: "Write a message ...",
  steeringPlaceholder: "Steer the running turn ...",
  timestamps: "Timestamps",
  detailModeTitle: "Step detail",
  detailModeOff: "answers only",
  detailModeIcons: "icons",
  detailModeChips: "chips",
  detailModeGrouped: "grouped",
  detailModeCompact: "one line",
  detailModeFull: "everything",
  questionSubmit: "Use selection",
  questionPlaceholder: "... or answer freely",
  questionAnswer: "Answer",
  copyMessage: "Copy",
  copied: "Copied",
};

const at = (minute: number) => `2026-09-26T09:${String(minute).padStart(2, "0")}:00Z`;

const tool = (key: string, name: string, args: string, result: string | undefined, minute: number, isError = false): Message => ({
  key,
  role: "tool",
  text: `${name} ${args}`,
  closed: true,
  at: at(minute),
  tool: { id: key, name, arguments: args, result, isError },
});

const research: Message[] = [
  { key: "u1", role: "user", text: "Which of our open issues are about the login page?", closed: true, at: at(12) },
  { key: "th1", role: "thinking", text: "Search the tracker, then group the hits by topic.", closed: true, at: at(12) },
  tool("t1", "search_issues", '{ "query": "login" }', '{ "hits": 7 }', 12),
  tool("t2", "read_issue", '{ "id": 412 }', '{ "title": "Password reset mail arrives late" }', 12),
  tool("t3", "read_issue", '{ "id": 415 }', '{ "title": "Remember me is ignored on Safari" }', 13),
  {
    key: "a1",
    role: "assistant",
    closed: true,
    at: at(13),
    text: [
      "Seven open issues touch the login page. They fall into three groups:",
      "",
      "| Topic | Issues | Oldest |",
      "|---|---|---|",
      "| Password reset | 3 | #398 |",
      "| Session handling | 2 | #412 |",
      "| Layout on mobile | 2 | #420 |",
      "",
      "The **session handling** issues share a root cause: the `remember_me` cookie is set without `SameSite`.",
    ].join("\n"),
  },
  { key: "u2", role: "user", text: "Fix the cookie and open a pull request.", closed: true, at: at(14) },
  tool("t4", "read_file", '{ "path": "src/auth/session.ts" }', "...", 14),
  tool("t5", "edit_file", '{ "path": "src/auth/session.ts" }', '{ "changed": 1 }', 14),
  tool("t6", "run_tests", '{ "filter": "auth" }', undefined, 15),
];

const steps: Message[] = [
  { key: "s-u", role: "user", text: "Summarize yesterday's build failures.", closed: true, at: at(20) },
  { key: "s-th", role: "thinking", text: "List the failed runs, then read their logs.", closed: true, at: at(20) },
  tool("s-1", "list_runs", '{ "status": "failed" }', '{ "runs": 3 }', 20),
  tool("s-2", "read_log", '{ "run": 881 }', "...", 20),
  tool("s-3", "read_log", '{ "run": 884 }', '{ "error": "log expired" }', 21, true),
  tool("s-4", "read_log", '{ "run": 887 }', "...", 21),
  {
    key: "s-a",
    role: "assistant",
    closed: true,
    at: at(21),
    text: "Two of three failures are the same flaky test in `checkout.spec.ts`. The log of run 884 has expired.",
  },
];

const questions: Message[] = [
  { key: "q-u", role: "user", text: "Prepare the release notes for 2.4.", closed: true, at: at(30) },
  {
    key: "q-1",
    role: "question",
    text: "Which audience are the notes for?",
    closed: true,
    at: at(30),
    question: { callId: "c1", options: ["Developers", "End users"], answer: "End users" },
  },
  { key: "q-a", role: "assistant", text: "Got it - plain language, no internals.", closed: true, at: at(31) },
  {
    key: "q-2",
    role: "question",
    text: "Which changes should be highlighted?",
    closed: true,
    at: at(31),
    question: { callId: "c2", options: ["Dark mode", "Faster search", "CSV export", "Bug fixes"], multi: true },
  },
];

const party: Message[] = [
  { key: "p1", role: "user", text: "Plan and review the migration to the new API.", closed: true, at: at(40) },
  {
    key: "p2",
    role: "assistant",
    closed: true,
    at: at(40),
    bubble: { color: "#2a94fa", side: "start", label: "Planner" },
    text: "1. Add the new client next to the old one\n2. Switch reads first\n3. Switch writes behind a flag",
  },
  {
    key: "p3",
    role: "assistant",
    closed: true,
    at: at(41),
    bubble: { color: "#14a06d", side: "start", label: "Reviewer" },
    text: "Step 3 needs a rollback plan - writes are not idempotent yet.",
  },
  {
    key: "p4",
    role: "assistant",
    closed: true,
    at: at(41),
    bubble: { color: "#2a94fa", side: "start", label: "Planner" },
    text: "Agreed. I add an idempotency key before the switch.",
  },
];

function Frame({ caption, small, className, children }: { caption?: string; small?: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={`qsl-panel showcase-frame${small ? " showcase-frame--small" : ""}${className ? ` ${className}` : ""}`}>
      {caption && <div className="showcase-caption">{caption}</div>}
      {children}
    </div>
  );
}

function AgentScene() {
  const [detailMode, setDetailMode] = useState<DetailMode>("grouped");
  const [showTimestamps, setShowTimestamps] = useState(true);
  return (
    <Frame>
      <ChatPanel
        composer={
          <ChatInputToolbar
            onSend={() => undefined}
            onStop={() => undefined}
            rows={2}
            running
            texts={texts}
            toolbarLeft={<>
              <DetailModeSwitch mode={detailMode} onChange={setDetailMode} texts={texts} />
              <TimestampSwitch showTimestamps={showTimestamps} onChange={setShowTimestamps} texts={texts} />
            </>}
          />
        }
      >
        <ChatMessages
          detailMode={detailMode}
          messages={research}
          running
          showTimestamps={showTimestamps}
          texts={texts}
          timestampOptions={{ timeZone: "UTC", locale: "en" }}
        />
      </ChatPanel>
    </Frame>
  );
}

function DetailScene() {
  const modes: { mode: DetailMode; caption: string }[] = [
    { mode: "icons", caption: "icons" },
    { mode: "chips", caption: "chips" },
    { mode: "compact", caption: "one line" },
  ];
  return (
    <>
      {modes.map(({ mode, caption }) => (
        <Frame caption={caption} className="showcase-frame--short" key={mode} small>
          <ChatMessages detailMode={mode} messages={steps} texts={texts} />
        </Frame>
      ))}
    </>
  );
}

function QuestionScene() {
  return (
    <Frame className="showcase-frame--tall" small>
      <ChatMessages messages={questions} texts={texts} />
    </Frame>
  );
}

function PartyScene() {
  return (
    <Frame small>
      <ChatMessages bubbleOptions={{ variant: "bubbles" }} messages={party} texts={texts} />
    </Frame>
  );
}

function ThemeScene() {
  const themes = [
    { className: "", caption: "default" },
    { className: "theme-abendrot", caption: "sunset" },
    { className: "theme-smaragd", caption: "emerald" },
  ];
  return (
    <>
      {themes.map(({ className, caption }) => (
        <Frame caption={caption} className={`showcase-frame--short ${className}`} key={caption} small>
          <ChatMessages detailMode="chips" messages={steps} texts={texts} />
        </Frame>
      ))}
    </>
  );
}

const scenes: Record<string, () => ReactNode> = {
  agent: AgentScene,
  details: DetailScene,
  questions: QuestionScene,
  party: PartyScene,
  themes: ThemeScene,
};

const params = new URLSearchParams(location.search);
if (params.get("theme")) {
  document.documentElement.dataset.theme = params.get("theme")!;
}
const Scene = scenes[params.get("scene") ?? "agent"] ?? AgentScene;

createRoot(document.getElementById("root")!).render(
  <div className="showcase" data-shot>
    <Scene />
  </div>,
);
