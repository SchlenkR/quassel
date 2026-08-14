import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ChatSessionProvider, SessionInfo } from "@quassel/agent-node";
import { PiChatConfig } from "./config";
import { PiSession } from "./session";

const ID_MUSTER = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Haelt lebende Pi-Sessions und merkt sich bei konfiguriertem sessionDir, welche
 * Pi-Session-Datei zu welcher quassel-Id gehoert - so ueberleben Unterhaltungen
 * einen Prozess-Neustart.
 */
export class PiSessionManager implements ChatSessionProvider {
  private readonly sessions = new Map<string, PiSession>();
  private zuordnung?: Record<string, string>;

  constructor(private readonly config: PiChatConfig = {}) {}

  async get(id: string): Promise<PiSession> {
    if (!ID_MUSTER.test(id)) {
      throw new Error(`Ungültige Session-Id: ${id}`);
    }
    const vorhanden = this.sessions.get(id);
    if (vorhanden) {
      return vorhanden;
    }
    const zuordnung = await this.ladeZuordnung();
    const bekannt = zuordnung[id];
    const sessionFile = bekannt && existsSync(bekannt) ? bekannt : undefined;
    const session = await PiSession.create(id, this.config, sessionFile, (datei) => {
      void this.merkeZuordnung(id, datei);
    });
    this.sessions.set(id, session);
    return session;
  }

  async list(): Promise<SessionInfo[]> {
    const zuordnung = await this.ladeZuordnung();
    const infos: SessionInfo[] = [];
    for (const [id, datei] of Object.entries(zuordnung)) {
      if (!existsSync(datei)) {
        continue;
      }
      const erste = await ersteNutzerZeile(datei);
      infos.push({ id, title: erste ?? "Unterhaltung", updatedAt: 0 });
    }
    for (const id of this.sessions.keys()) {
      if (!infos.some((info) => info.id === id)) {
        infos.push({ id, title: "Unterhaltung", updatedAt: 0 });
      }
    }
    return infos;
  }

  async delete(id: string): Promise<void> {
    this.sessions.get(id)?.stop();
    this.sessions.get(id)?.dispose();
    this.sessions.delete(id);
    const zuordnung = await this.ladeZuordnung();
    if (zuordnung[id]) {
      delete zuordnung[id];
      await this.speichereZuordnung(zuordnung);
    }
  }

  private get zuordnungsPfad(): string | undefined {
    return this.config.sessionDir ? join(this.config.sessionDir, "quassel-ids.json") : undefined;
  }

  private async ladeZuordnung(): Promise<Record<string, string>> {
    if (this.zuordnung) {
      return this.zuordnung;
    }
    const pfad = this.zuordnungsPfad;
    if (!pfad) {
      this.zuordnung = {};
      return this.zuordnung;
    }
    try {
      this.zuordnung = JSON.parse(await readFile(pfad, "utf8")) as Record<string, string>;
    } catch {
      this.zuordnung = {};
    }
    return this.zuordnung;
  }

  private async merkeZuordnung(id: string, datei: string): Promise<void> {
    const zuordnung = await this.ladeZuordnung();
    if (zuordnung[id] === datei) {
      return;
    }
    zuordnung[id] = datei;
    await this.speichereZuordnung(zuordnung);
  }

  private async speichereZuordnung(zuordnung: Record<string, string>): Promise<void> {
    const pfad = this.zuordnungsPfad;
    if (!pfad) {
      return;
    }
    await mkdir(this.config.sessionDir!, { recursive: true });
    await writeFile(pfad, JSON.stringify(zuordnung, null, 2), "utf8");
  }
}

/** Erste Nutzernachricht aus einer Pi-Session-Datei (JSONL) als Titel. */
async function ersteNutzerZeile(datei: string): Promise<string | undefined> {
  try {
    const inhalt = await readFile(datei, "utf8");
    for (const zeile of inhalt.split("\n")) {
      if (!zeile.trim()) {
        continue;
      }
      const eintrag = JSON.parse(zeile) as { message?: { role?: string; content?: unknown } };
      const message = eintrag.message;
      if (message?.role !== "user") {
        continue;
      }
      const text =
        typeof message.content === "string"
          ? message.content
          : Array.isArray(message.content)
            ? (message.content.find((teil) => (teil as { type?: string }).type === "text") as { text?: string } | undefined)
                ?.text ?? ""
            : "";
      if (text) {
        return text.length > 80 ? `${text.slice(0, 80)} ...` : text;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}
