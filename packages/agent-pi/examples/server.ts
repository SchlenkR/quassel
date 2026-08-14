import { createServer } from "node:http";
import { createChatHandler } from "@quassel/agent-node";
import { PiSessionManager } from "../src/index";

const manager = new PiSessionManager({
  cwd: new URL("../../..", import.meta.url).pathname,
  sessionDir: new URL("../.pi-sessions", import.meta.url).pathname,
  appendSystemPrompt: "Antworte auf Deutsch und halte dich kurz.",
});

const handler = createChatHandler({ manager });
const port = Number(process.env.PORT ?? 3301);

createServer(async (req, res) => {
  if (!(await handler(req, res))) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Nicht gefunden" }));
  }
}).listen(port, () => {
  console.log(`quassel-Pi-Server auf http://localhost:${port}/chat/<session-id>/stream`);
});
