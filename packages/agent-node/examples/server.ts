import { createServer } from "node:http";
import { createChatHandler, FileSessionStore, SessionManager } from "../src/index";

const manager = new SessionManager(
  {
    baseUrl: process.env.QUASSEL_BASE_URL ?? "http://localhost:11434/v1",
    model: process.env.QUASSEL_MODEL ?? "qwen3:4b",
    apiKey: process.env.QUASSEL_API_KEY,
    temperature: 0.7,
    systemPrompt:
      "Du bist der quassel-Demo-Assistent. Antworte knapp und auf Deutsch. " +
      "Wenn nach Uhrzeit oder Datum gefragt wird, benutze das Werkzeug uhrzeit.",
    tools: [
      {
        name: "uhrzeit",
        description: "Liefert die aktuelle Server-Uhrzeit mit Datum und Zeitzone.",
        parameters: { type: "object", properties: {}, required: [] },
        run: () => new Date().toString(),
      },
    ],
  },
  new FileSessionStore(new URL("../.sessions", import.meta.url).pathname),
);

const handler = createChatHandler({ manager });
const port = Number(process.env.PORT ?? 3300);

createServer(async (req, res) => {
  if (!(await handler(req, res))) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Nicht gefunden" }));
  }
}).listen(port, () => {
  console.log(`quassel-Demo-Server auf http://localhost:${port}/chat/<session-id>/stream`);
});
