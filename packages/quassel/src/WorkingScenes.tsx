import { useEffect, useState } from "react";
import { cn } from "./ui/cn";

const TRACK = 13;
const BASE_TICK_MS = 90;
const SCENE_CHANGE_MS = 2600;

/** One cell per figure: emoji and punctuation share no grid, shifted text judders. */
function track(figures: Record<number, string>, width = TRACK): string[] {
  return Array.from({ length: width }, (_, x) => figures[x] ?? " ");
}

interface Scene {
  id: string;
  tick: number;
  moving?: true;
  compact?: true;
  draw: (step: number) => string | string[];
}

/**
 * Small scenes in which something recognizable happens - the state changes visibly instead
 * of a figure just walking past. Scenes with movement return their track as cells, all others
 * as plain text.
 */
const SCENES: Scene[] = [
  {
    id: "thinking",
    tick: 2,
    draw: (step) => {
      const tick = step % 10;
      if (tick >= 8) return "\u{1F929}\u{1F4A1}";
      return "\u{1F914}" + "\u{1F4AD}".repeat(Math.min(tick, 3));
    },
  },
  {
    // Flies to the right, dragging its tail behind.
    id: "rocket",
    tick: 2,
    moving: true,
    draw: (step) => {
      const x = step % TRACK;
      return track({ [x - 2]: "·", [x - 1]: "\u{1F4A8}", [x]: "\u{1F680}" });
    },
  },
  {
    // The dots stay put and are eaten one by one.
    id: "pacman",
    tick: 2,
    moving: true,
    draw: (step) => {
      const x = step % TRACK;
      const figures: Record<number, string> = {};
      for (let i = x + 1; i < TRACK; i++) {
        figures[i] = "·";
      }
      figures[x] = step % 2 === 0 ? "\u{1F7E1}" : "\u{1F315}";
      return track(figures);
    },
  },
  {
    // A seed becomes a tree, then start over.
    id: "growing",
    compact: true,
    tick: 2,
    draw: (step) => {
      const stages = ["\u{1F331}", "\u{1F331}", "\u{1F33F}", "\u{1F33F}", "\u{1F343}", "\u{1F333}", "\u{1F333}", "\u{1F333}"];
      return stages[step % stages.length];
    },
  },
  {
    // The egg cracks, the chick hatches.
    id: "hatching",
    compact: true,
    tick: 2,
    draw: (step) => {
      const tick = step % 12;
      if (tick < 4) return "\u{1F95A}";
      if (tick < 6) return "\u{1F95A}*";
      if (tick < 9) return "\u{1F423}";
      return "\u{1F425}";
    },
  },
  {
    // Morse-like signal that resolves into an OK.
    id: "signal",
    tick: 2,
    draw: (step) => {
      const tick = step % 14;
      if (tick >= 11) return "\u{1F4E1} OK";
      const pattern = ["·", "··", "·-", "-·", "··-", "-··"];
      return "\u{1F4E1} " + pattern[tick % pattern.length];
    },
  },
  {
    // Hourglass: the sand runs through, then it is flipped.
    id: "hourglass",
    tick: 2,
    draw: (step) => {
      const tick = step % 12;
      const grains = "·".repeat(Math.max(0, 5 - Math.floor(tick / 2)));
      return (tick < 10 ? "⏳" : "⌛") + " " + grains;
    },
  },
  {
    // Egg, chick, hen - and she lays the next egg.
    id: "chicken-cycle",
    compact: true,
    tick: 3,
    draw: (step) => {
      const tick = step % 16;
      if (tick < 3) return "\u{1F95A}";
      if (tick < 5) return "\u{1F95A}*";
      if (tick < 8) return "\u{1F423}";
      if (tick < 11) return "\u{1F424}";
      if (tick < 14) return "\u{1F414}";
      return "\u{1F414}\u{1F95A}";
    },
  },
  {
    // Hat, sparks - and the rabbit bolts.
    id: "magic-hat",
    compact: true,
    tick: 3,
    draw: (step) => {
      const tick = step % 14;
      if (tick < 4) return "\u{1F3A9}";
      if (tick < 7) return "\u{1F3A9}*";
      if (tick < 11) return "\u{1F3A9}\u{1F407}";
      return "\u{1F407}\u{1F4A8}";
    },
  },
  {
    // Red, yellow, green - and off.
    id: "traffic-light",
    compact: true,
    tick: 3,
    draw: (step) => {
      const tick = step % 12;
      if (tick < 4) return "\u{1F534}";
      if (tick < 6) return "\u{1F7E1}";
      if (tick < 8) return "\u{1F7E2}";
      return "\u{1F697}\u{1F4A8}";
    },
  },
  {
    // Ringing, oversleeping, running off.
    id: "alarm-clock",
    compact: true,
    tick: 2,
    draw: (step) => {
      const tick = step % 14;
      if (tick < 5) return tick % 2 === 0 ? "⏰" : "\u{1F514}";
      if (tick < 8) return "\u{1F634}";
      if (tick < 10) return "\u{1F633}";
      return "\u{1F3C3}\u{1F4A8}";
    },
  },
  {
    // A snail crawls to the flag - and celebrates.
    id: "snail",
    tick: 4,
    draw: (step) => {
      const tick = step % 8;
      if (tick < 5) return track({ [tick]: "\u{1F40C}", 4: "\u{1F3C1}" }, 5);
      return track({ 4: "\u{1F389}" }, 5);
    },
  },
];

const COMPACT_SCENES = SCENES.filter((scene) => scene.compact);

export interface WorkingScenesProps {
  /** Limits scenes to one or two visible characters for small status fields. */
  compact?: boolean;
  /** Text for screen readers, default "Working ...". */
  label?: string;
}

/**
 * The default working indicator: randomly rotating mini scenes. Random order and start phase,
 * so the same scenes never feel like a loop. The working prop of ChatMessages replaces it
 * completely.
 */
export function WorkingScenes({ label = "Working ...", compact = false }: WorkingScenesProps) {
  const scenes = compact ? COMPACT_SCENES : SCENES;
  const [sceneIndex, setSceneIndex] = useState(() => Math.floor(Math.random() * scenes.length));
  const [offset, setOffset] = useState(() => Math.floor(Math.random() * 20));
  const [frameTick, setFrameTick] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const scene = scenes[sceneIndex % scenes.length];

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener("change", update);
    update();
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setInterval(() => {
      setSceneIndex((previous) => (previous + 1 + Math.floor(Math.random() * (scenes.length - 1))) % scenes.length);
      setOffset(Math.floor(Math.random() * 20));
      setFrameTick(0);
    }, SCENE_CHANGE_MS);
    return () => window.clearInterval(timer);
  }, [reducedMotion, scenes]);

  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setInterval(() => setFrameTick((value) => value + 1), BASE_TICK_MS);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  const frame = scene.draw(Math.floor(frameTick / scene.tick) + (scene.moving ? offset : 0));
  return (
    <span aria-label={label} className={cn("qsl:flex qsl:items-center qsl:gap-2.5 qsl:text-[13px]", compact ? "qsl:text-inherit" : "qsl:mt-4 qsl:text-foreground")} data-chat="working" role="status">
      {!compact && <span aria-hidden="true" className="qsl:text-muted-foreground qsl:opacity-70">&gt;</span>}
      <span aria-hidden="true" className={cn("qsl:inline-block qsl:flex-none qsl:font-mono qsl:[font-variant-ligatures:none]", compact ? "qsl:w-[2.4em] qsl:text-center" : "qsl:w-[15rem]")} key={scene.id}>
        <span className="qsl:tracking-[0.02em] qsl:whitespace-pre qsl:motion-reduce:opacity-60">
          {typeof frame === "string"
            ? frame
            : frame.map((cell, index) => (
                <span className="qsl:inline-block qsl:w-[1.35em] qsl:text-center" key={index}>
                  {cell}
                </span>
              ))}
        </span>
      </span>
    </span>
  );
}
