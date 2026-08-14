import { IncomingMessage, ServerResponse } from "node:http";
import { ChatSessionProvider } from "./types";

export interface ChatHandlerOptions {
  manager: ChatSessionProvider;
  prefix?: string;
  cors?: boolean;
}

/**
 * Framework-freier HTTP-Adapter. Routen unter dem Prefix (default /chat):
 *   GET    /:id/stream   SSE - erst Verlauf, dann live, mit Keepalive-Pings
 *   POST   /:id/send     { text } - startet einen Lauf oder funkt dazwischen
 *   POST   /:id/stop     bricht den laufenden Turn ab
 *   GET    /sessions     persistierte Unterhaltungen
 *   DELETE /:id          loescht eine Unterhaltung
 * Rueckgabe true heisst: Anfrage wurde behandelt.
 */
export function createChatHandler({ manager, prefix = "/chat", cors = true }: ChatHandlerOptions) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const url = new URL(req.url ?? "/", "http://intern");
    if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) {
      return false;
    }
    if (cors) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return true;
    }

    const teile = url.pathname.slice(prefix.length).split("/").filter(Boolean);
    try {
      if (req.method === "GET" && teile.length === 1 && teile[0] === "sessions") {
        antworteJson(res, 200, await manager.list());
        return true;
      }
      if (req.method === "DELETE" && teile.length === 1) {
        await manager.delete(teile[0]);
        antworteJson(res, 200, { ok: true });
        return true;
      }
      if (teile.length !== 2) {
        antworteJson(res, 404, { error: "Unbekannte Route" });
        return true;
      }
      const [id, aktion] = teile;
      const session = await manager.get(id);

      if (req.method === "GET" && aktion === "stream") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        const abmelden = session.subscribe((event) => {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        });
        const ping = setInterval(() => res.write(": ping\n\n"), 15000);
        req.on("close", () => {
          clearInterval(ping);
          abmelden();
        });
        return true;
      }
      if (req.method === "POST" && aktion === "send") {
        const body = await leseJson(req);
        const text = typeof body?.text === "string" ? body.text.trim() : "";
        if (!text) {
          antworteJson(res, 400, { error: "text fehlt" });
          return true;
        }
        session.send(text);
        antworteJson(res, 202, { ok: true });
        return true;
      }
      if (req.method === "POST" && aktion === "stop") {
        session.stop();
        antworteJson(res, 200, { ok: true });
        return true;
      }
      antworteJson(res, 404, { error: "Unbekannte Route" });
    } catch (error) {
      antworteJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  };
}

function antworteJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function leseJson(req: IncomingMessage): Promise<Record<string, unknown> | undefined> {
  const stuecke: Buffer[] = [];
  for await (const stueck of req) {
    stuecke.push(stueck as Buffer);
  }
  const text = Buffer.concat(stuecke).toString("utf8");
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}
