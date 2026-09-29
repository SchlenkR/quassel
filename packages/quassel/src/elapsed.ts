import { useSyncExternalStore } from "react";
import { type ChatTexts, fillText } from "./texts";

const tickMs = 500;

/** Under a minute "{seconds} s" from texts, then m:ss, from an hour on h:mm:ss. */
export function formatElapsed(ms: number, texts: Pick<ChatTexts, "toolElapsedSeconds">): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  if (total < 60) return fillText(texts.toolElapsedSeconds, { seconds: total });
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total / 60) % 60;
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

/** One interval for every subscriber; it runs only while someone listens. */
export function createTicker(intervalMs = tickMs) {
  const listeners = new Set<() => void>();
  let now = Date.now();
  let timer: ReturnType<typeof setInterval> | undefined;
  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      if (timer === undefined) {
        now = Date.now();
        timer = setInterval(() => {
          now = Date.now();
          listeners.forEach((notify) => notify());
        }, intervalMs);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && timer !== undefined) {
          clearInterval(timer);
          timer = undefined;
        }
      };
    },
    now(): number {
      const current = Date.now();
      if (timer === undefined && (current - now >= intervalMs || current < now)) now = current;
      return now;
    },
    active: (): boolean => timer !== undefined,
  };
}

export const elapsedTicker = createTicker();

const nothingOnServer = () => undefined;

/** Milliseconds since start in whole seconds, so a row renders only when its display changes; undefined on the server. */
export function useElapsed(start: number): number | undefined {
  return useSyncExternalStore(elapsedTicker.subscribe, () => Math.floor((elapsedTicker.now() - start) / 1000) * 1000, nothingOnServer);
}
