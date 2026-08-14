import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SessionInfo, SessionState, SessionStore } from "./types";

function titelAus(state: SessionState): string {
  const erste = state.events.find((event) => event.kind === "user");
  const text = erste && erste.kind === "user" ? erste.text : "Neue Unterhaltung";
  return text.length > 80 ? `${text.slice(0, 80)} ...` : text;
}

export class MemorySessionStore implements SessionStore {
  private readonly states = new Map<string, SessionState>();

  async load(id: string): Promise<SessionState | undefined> {
    return this.states.get(id);
  }

  async save(state: SessionState): Promise<void> {
    this.states.set(state.id, state);
  }

  async list(): Promise<SessionInfo[]> {
    return [...this.states.values()]
      .map((state) => ({ id: state.id, title: titelAus(state), updatedAt: state.updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async delete(id: string): Promise<void> {
    this.states.delete(id);
  }
}

/** Eine JSON-Datei je Unterhaltung; geschrieben wird atomar ueber eine Temp-Datei. */
export class FileSessionStore implements SessionStore {
  constructor(private readonly dir: string) {}

  async load(id: string): Promise<SessionState | undefined> {
    try {
      return JSON.parse(await readFile(this.pfad(id), "utf8")) as SessionState;
    } catch {
      return undefined;
    }
  }

  async save(state: SessionState): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const temp = `${this.pfad(state.id)}.tmp`;
    await writeFile(temp, JSON.stringify(state), "utf8");
    await rename(temp, this.pfad(state.id));
  }

  async list(): Promise<SessionInfo[]> {
    let dateien: string[];
    try {
      dateien = await readdir(this.dir);
    } catch {
      return [];
    }
    const infos: SessionInfo[] = [];
    for (const datei of dateien) {
      if (!datei.endsWith(".json")) {
        continue;
      }
      const state = await this.load(datei.slice(0, -5));
      if (state) {
        infos.push({ id: state.id, title: titelAus(state), updatedAt: state.updatedAt });
      }
    }
    return infos.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async delete(id: string): Promise<void> {
    await rm(this.pfad(id), { force: true });
  }

  private pfad(id: string): string {
    return join(this.dir, `${id}.json`);
  }
}
