import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { applyEvent, ChatEvent, Message } from "@quassel/events";

/**
 * Verbindet die Chat-Komponenten mit einem @quassel/agent-node-Endpunkt: ein dauerhafter
 * SSE-Strom liefert erst den Verlauf, dann live; Senden und Stoppen sind eigene Aufrufe
 * und erreichen so auch einen laufenden Turn. Bricht der Strom ab, verbindet der Hook
 * nach 3 Sekunden neu.
 */
export function useChat(baseUrl: string, headers: Record<string, string> = {}): {
  messages: Message[];
  running: boolean;
  connected: boolean;
  send: (text: string) => Promise<void>;
  stop: () => Promise<void>;
} {
  const [messages, dispatch] = useReducer(applyEvent, [] as Message[]);
  const [running, setRunning] = useState(false);
  const [connected, setConnected] = useState(false);
  const url = useRef(baseUrl);
  url.current = baseUrl;
  const zusatz = useRef(headers);
  zusatz.current = headers;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function verbinden() {
      while (active) {
        try {
          const response = await fetch(`${url.current}/stream`, {
            headers: { Accept: "text/event-stream", ...zusatz.current },
            signal: controller.signal,
          });
          if (!response.ok || !response.body) {
            throw new Error(`Stream fehlgeschlagen: ${response.status}`);
          }
          setConnected(true);
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let puffer = "";
          for (;;) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            puffer += decoder.decode(value, { stream: true });
            const teile = puffer.split("\n\n");
            puffer = teile.pop() ?? "";
            for (const teil of teile) {
              const daten = teil
                .split("\n")
                .filter((zeile) => zeile.startsWith("data:"))
                .map((zeile) => zeile.slice(5).trim())
                .join("");
              if (!daten) {
                continue;
              }
              const event = JSON.parse(daten) as ChatEvent;
              if (event.kind === "status") {
                setRunning(event.running);
              }
              dispatch(event);
            }
          }
        } catch {
          if (!active) {
            return;
          }
        }
        setConnected(false);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    void verbinden();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const send = useCallback(async (text: string) => {
    await fetch(`${url.current}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...zusatz.current },
      body: JSON.stringify({ text }),
    });
  }, []);

  const stop = useCallback(async () => {
    await fetch(`${url.current}/stop`, { method: "POST", headers: { ...zusatz.current } });
  }, []);

  return { messages, running, connected, send, stop };
}
