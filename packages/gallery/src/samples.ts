import type { Message } from "quassel";

const at = (minute: number) => `2026-09-26T09:${String(minute).padStart(2, "0")}:00Z`;

const tool = (key: string, name: string, args: string, result: string | undefined, minute: number, isError = false): Message => ({
  key,
  role: "tool",
  text: `${name} ${args}`,
  closed: true,
  at: at(minute),
  tool: { id: key, name, arguments: args, result, isError },
});

export const research: Message[] = [
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

export const steps: Message[] = [
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

export const actions: Message[] = [
  { key: "q-u", role: "user", text: "Prepare the release notes for 2.4.", closed: true, at: at(30) },
  {
    key: "q-1",
    role: "action",
    text: "Which audience are the notes for?",
    closed: true,
    at: at(30),
    action: { actionId: "c1", owner: "choice", payload: { options: ["Developers", "End users"] }, status: "approved", result: "End users" },
  },
  { key: "q-a", role: "assistant", text: "Got it - plain language, no internals.", closed: true, at: at(31) },
  {
    key: "q-2",
    role: "action",
    text: "Which change should lead the notes?",
    closed: true,
    at: at(31),
    action: { actionId: "c2", owner: "choice", payload: { options: ["Dark mode", "Faster search", "CSV export"] } },
  },
  {
    key: "q-3",
    role: "action",
    text: "Publish the draft to the team wiki?",
    closed: true,
    at: at(32),
    action: { actionId: "c3", owner: null, payload: {} },
  },
];

export const party: Message[] = [
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
    bubble: { color: "#14a06d", side: "end", label: "Reviewer" },
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

export const tokens: Message[] = [
  ...steps,
  {
    key: "k-u",
    role: "user",
    text: "Skip the flaky test for now.",
    closed: true,
    at: at(22),
    steered: true,
    attachments: [{ name: "flaky-runs.csv", mediaType: "text/csv", size: 2048, url: "data:text/csv,run" }],
  },
  {
    key: "k-q",
    role: "action",
    text: "Rerun the pipeline without the flaky test?",
    closed: true,
    at: at(22),
    action: { actionId: "k1", owner: null, payload: {}, status: "dismissed", result: null },
  },
];
