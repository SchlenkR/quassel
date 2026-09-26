import { AgentSession } from "./session";
import { AgentConfig, SessionInfo, SessionStore } from "./types";
import { MemorySessionStore } from "./store";

const ID_MUSTER = /^[A-Za-z0-9_-]{1,64}$/;

/** Haelt lebende Sessions im Speicher und laedt persistierte bei Bedarf nach. */
export class SessionManager {
  private readonly sessions = new Map<string, AgentSession>();

  constructor(
    private readonly config: AgentConfig,
    private readonly store: SessionStore = new MemorySessionStore(),
  ) {}

  async get(id: string): Promise<AgentSession> {
    if (!ID_MUSTER.test(id)) {
      throw new Error(`Ungültige Session-Id: ${id}`);
    }
    const vorhanden = this.sessions.get(id);
    if (vorhanden) {
      return vorhanden;
    }
    const state = await this.store.load(id);
    const session = new AgentSession(id, this.config, this.store, state);
    this.sessions.set(id, session);
    return session;
  }

  async list(): Promise<SessionInfo[]> {
    return this.store.list();
  }

  async delete(id: string): Promise<void> {
    this.sessions.get(id)?.stop();
    this.sessions.delete(id);
    await this.store.delete(id);
  }
}
