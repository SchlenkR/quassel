import { useState } from "react";
import {
  channelMessages,
  ChatInputToolbar,
  ChatMessages,
  ChatPanel,
  threadMessages,
  type ChatAuthor,
  type ChatCard,
  type ChatTexts,
  type Message,
} from "@schlenkr/quassel";
import "./team.css";

const mara: ChatAuthor = { id: "mara", name: "Mara Klein" };
const jonas: ChatAuthor = { id: "jonas", name: "Jonas Brandt" };
const lea: ChatAuthor = { id: "lea", name: "Lea Novak" };
const helper: ChatAuthor = { id: "helper", name: "Helper", initials: "H" };
const me = mara.id;
const reactionChoices = ["\u{1F44D}", "\u2764\uFE0F", "\u2705", "\u{1F440}"];

const day = (offset: number, time: string) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const [hours, minutes] = time.split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
};

type OrderCard = { title: string; customer: string; state: string };
type ApprovalCard = { to: string; subject: string; body: string; approved?: boolean };

const post = (key: string, author: ChatAuthor, at: string, text: string, extra: Partial<Message> = {}): Message =>
  ({ key, role: author.id === me ? "user" : "assistant", closed: true, author, at, text, ...extra });

const initial: Message[] = [
  post("m1", lea, day(-1, "16:42"), "The cargo bike for the Weber family is ready for pickup on Saturday. They asked whether we can fit the child seat too.", {
    cards: [{ kind: "order", key: "o1", data: { title: "Cargo bike service", customer: "Weber family", state: "Ready Saturday" } satisfies OrderCard }],
    reactions: [{ key: reactionChoices[0], count: 2, userIds: ["mara", "jonas"] }, { key: reactionChoices[1], count: 1, userIds: ["jonas"] }],
  }),
  post("r1", jonas, day(-1, "17:31"), "The seat fits, I need about 30 minutes for it.", { parentId: "m1" }),
  post("r2", mara, day(-1, "18:02"), "Good, add it to the invoice at the usual rate.", { parentId: "m1" }),
  post("r3", helper, day(0, "08:31"), "I drafted the pickup message for the Weber family. Send it like this?", {
    parentId: "m1",
    cards: [{ kind: "approval", key: "a1", data: { to: "Weber family", subject: "Your cargo bike is ready", body: "Hello, your cargo bike including the child seat is ready for pickup on Saturday from 10:00." } satisfies ApprovalCard }],
  }),
  post("m2", mara, day(0, "08:40"), "I am in the shop until 13:00 today. The spare keys are in the top drawer."),
  post("m3", jonas, day(0, "09:14"), "The brake pads for the e-bikes are still missing. @Mara Klein can you call the supplier on Monday? You know them best.", {
    mentions: [{ id: "mara", name: "Mara Klein" }],
  }),
  post("r4", helper, day(0, "09:15"), "I found the supplier's direct number and set a reminder for Monday 9:00.", { parentId: "m3" }),
  post("m4", lea, day(0, "09:30"), "New price list is up, please check the labour rates by Friday.", {
    attachments: [{ name: "price-list-2026.pdf", mediaType: "application/pdf", size: 248_000, url: "data:application/pdf,price" }],
  }),
];

const approvalOf = (message: Message) => message.cards?.find((card) => card.kind === "approval")?.data as ApprovalCard | undefined;

export function TeamChat({ texts, initialThread }: { texts?: Partial<ChatTexts>; initialThread?: string }) {
  const [messages, setMessages] = useState(initial);
  const [thread, setThread] = useState<string | undefined>(initialThread);
  const update = (key: string, change: (message: Message) => Message) => setMessages((all) => all.map((message) => message.key === key ? change(message) : message));
  const toggleReaction = (target: Message, key: string) => update(target.key, (message) => {
    const reactions = message.reactions ?? [];
    const existing = reactions.find((reaction) => reaction.key === key);
    const mine = existing?.userIds?.includes(me) ?? false;
    const userIds = mine ? existing!.userIds!.filter((id) => id !== me) : [...existing?.userIds ?? [], me];
    const next = existing ? reactions.map((reaction) => reaction.key === key ? { ...reaction, userIds, count: userIds.length } : reaction) : [...reactions, { key, userIds, count: 1 }];
    return { ...message, reactions: next.filter((reaction) => reaction.count > 0) };
  });
  const approve = (target: Message) => update(target.key, (message) => ({
    ...message,
    cards: message.cards?.map((card) => card.kind === "approval" ? { ...card, data: { ...card.data as ApprovalCard, approved: true } } : card),
  }));
  const send = (text: string) => setMessages((all) => [...all, post(crypto.randomUUID(), mara, new Date().toISOString(), text, thread ? { parentId: thread } : {})]);
  const pending = (parent: Message) => messages.some((message) => message.parentId === parent.key && approvalOf(message) && !approvalOf(message)!.approved);
  const view = thread ? threadMessages(messages, thread) : channelMessages(messages);
  const renderCard = (card: ChatCard, message: Message) => {
    if (card.kind === "order") {
      const order = card.data as OrderCard;
      return <div className="team-card"><span className="team-card-icon">W</span><div><b>{order.title}</b><div className="team-muted">{order.customer} - {order.state}</div></div></div>;
    }
    if (card.kind === "approval") {
      const draft = card.data as ApprovalCard;
      return <div className="team-draft">
        <div className="team-muted">To: {draft.to}</div>
        <b>{draft.subject}</b>
        <p>{draft.body}</p>
        {draft.approved
          ? <span className="team-done">Approved and sent</span>
          : <button className="team-primary" onClick={() => approve(message)} type="button">Approve and send</button>}
      </div>;
    }
    return undefined;
  };
  return (
    <ChatPanel
      className="panel showcase-panel"
      composer={<ChatInputToolbar onSend={send} rows={1} texts={{ ...texts, placeholder: thread ? "Reply in thread ..." : "Message #workshop ..." }} />}
      maxWidth={760}
    >
      {thread && <div className="team-thread-bar"><button className="toggle" onClick={() => setThread(undefined)} type="button">Back to #workshop</button></div>}
      <ChatMessages
        activeThreadKey={thread}
        currentUserId={me}
        layout="multi-party"
        messages={view}
        onOpenThread={(message) => setThread(message.key)}
        onToggleReaction={toggleReaction}
        reactionChoices={reactionChoices}
        renderCard={renderCard}
        renderMessageDecorations={(message, place) => place === "thread" && pending(message) ? <span className="team-chip">Approval pending</span> : null}
        texts={texts}
        threadParentKey={thread}
        timestampOptions={{ showDaySeparators: true, locale: "en-GB" }}
        unreadFromKey={thread ? undefined : "m3"}
      />
    </ChatPanel>
  );
}
