import { useEffect, useState } from "react";

const SPUR = 13;
const GRUNDTAKT_MS = 90;
const SZENENWECHSEL_MS = 2600;

/** Eine Zelle je Figur: Emoji und Satzzeichen teilen sich kein Raster, geschobener Text ruckelt. */
function bahn(figuren: Record<number, string>): string[] {
  return Array.from({ length: SPUR }, (_, x) => figuren[x] ?? " ");
}

interface Szene {
  id: string;
  takt: number;
  laufend?: true;
  zeichne: (schritt: number, wort: string) => string | string[];
}

/**
 * Kleine Szenen, in denen etwas Erkennbares passiert - der Zustand aendert sich sichtbar,
 * statt dass nur eine Figur vorbeilaeuft. Szenen mit Bewegung geben ihre Bahn als Zellen
 * zurueck, alle anderen als schlichten Text.
 */
const SZENEN: Szene[] = [
  {
    // Buchstaben rattern und rasten von links nacheinander ein.
    id: "slot",
    takt: 1,
    zeichne: (schritt, wort) => {
      const zeichen = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      return [...wort]
        .map((z, i) => {
          if (z === " ") return " ";
          const rastet = 2 + i * 2;
          if (schritt >= rastet) return z;
          return zeichen[(schritt * (7 + i * 3) + i * 11) % zeichen.length];
        })
        .join("");
    },
  },
  {
    id: "denken",
    takt: 2,
    zeichne: (schritt) => {
      const takt = schritt % 10;
      if (takt >= 8) return "\u{1F929}\u{1F4A1}";
      return "\u{1F914}" + "\u{1F4AD}".repeat(Math.min(takt, 3));
    },
  },
  {
    // Fliegt nach rechts und zieht ihren Schweif hinterher.
    id: "rakete",
    takt: 2,
    laufend: true,
    zeichne: (schritt) => {
      const x = schritt % SPUR;
      return bahn({ [x - 2]: "\u00b7", [x - 1]: "\u{1F4A8}", [x]: "\u{1F680}" });
    },
  },
  {
    // Die Maus fuehrt, die Katze haelt Abstand - beide laufen rechts raus.
    id: "katzemaus",
    takt: 2,
    laufend: true,
    zeichne: (schritt) => {
      const x = schritt % (SPUR + 4);
      return bahn({ [x - 4]: "\u{1F408}", [x]: "\u{1F401}" });
    },
  },
  {
    id: "bauen",
    takt: 2,
    zeichne: (schritt) => {
      const x = schritt % (SPUR + 1);
      const figuren: Record<number, string> = {};
      for (let i = 0; i < SPUR; i++) {
        figuren[i] = i < x ? "\u{1F7E9}" : "\u2B1C";
      }
      figuren[x] = schritt % 2 === 0 ? "\u{1F528}" : "\u{1F6E0}\uFE0F";
      return bahn(figuren);
    },
  },
  {
    // Die Punkte bleiben stehen und werden einzeln gefressen.
    id: "pacman",
    takt: 2,
    laufend: true,
    zeichne: (schritt) => {
      const x = schritt % SPUR;
      const figuren: Record<number, string> = {};
      for (let i = x + 1; i < SPUR; i++) {
        figuren[i] = "\u00b7";
      }
      figuren[x] = schritt % 2 === 0 ? "\u{1F7E1}" : "\u{1F315}";
      return bahn(figuren);
    },
  },
  {
    // Aus einem Samen wird ein Baum, dann von vorn.
    id: "wachsen",
    takt: 2,
    zeichne: (schritt) => {
      const stufen = ["\u{1F331}", "\u{1F331}", "\u{1F33F}", "\u{1F33F}", "\u{1F343}", "\u{1F333}", "\u{1F333}", "\u{1F333}"];
      return stufen[schritt % stufen.length];
    },
  },
  {
    // Das Ei bekommt Risse, das Kueken schluepft.
    id: "schluepfen",
    takt: 2,
    zeichne: (schritt) => {
      const takt = schritt % 12;
      if (takt < 4) return "\u{1F95A}";
      if (takt < 6) return "\u{1F95A}\u2728";
      if (takt < 9) return "\u{1F423}";
      return "\u{1F425}";
    },
  },
  {
    // Die Waage schwingt und pendelt sich ein.
    id: "waage",
    takt: 2,
    zeichne: (schritt) => {
      const takt = schritt % 12;
      const stellung = takt < 8 ? ["/-\\", "\\-/"][takt % 2] : "-=-";
      return "\u2696\uFE0F " + stellung;
    },
  },
  {
    // Morse-artiges Signal, das sich zu einem OK aufloest.
    id: "signal",
    takt: 2,
    zeichne: (schritt) => {
      const takt = schritt % 14;
      if (takt >= 11) return "\u{1F4E1} OK";
      const muster = ["\u00b7", "\u00b7\u00b7", "\u00b7-", "-\u00b7", "\u00b7\u00b7-", "-\u00b7\u00b7"];
      return "\u{1F4E1} " + muster[takt % muster.length];
    },
  },
  {
    // Sanduhr: der Sand laeuft durch, dann wird gedreht.
    id: "sanduhr",
    takt: 2,
    zeichne: (schritt) => {
      const takt = schritt % 12;
      const koerner = "\u00b7".repeat(Math.max(0, 5 - Math.floor(takt / 2)));
      return (takt < 10 ? "\u23F3" : "\u231B") + " " + koerner;
    },
  },
  {
    // Puzzleteile rasten nacheinander ein.
    id: "puzzle",
    takt: 2,
    zeichne: (schritt) => {
      const x = schritt % (SPUR + 2);
      const figuren: Record<number, string> = {};
      for (let i = 0; i < SPUR; i++) {
        figuren[i] = i < x ? "\u{1F9E9}" : "\u00b7";
      }
      return bahn(figuren);
    },
  },
];

export interface WorkingScenesProps {
  /** Wort fuer die Slot-Szene, Default QUASSEL. */
  word?: string;
  /** Text fuer Screenreader, Default "Arbeitet ...". */
  label?: string;
}

/**
 * Der Default-Working-Indikator: zufaellig rotierende Mini-Szenen. Zufaellige Reihenfolge
 * und Startphase, damit dieselben Szenen nie wie eine Schleife wirken. Ueber die
 * working-Prop von ChatMessages laesst er sich komplett ersetzen.
 */
export function WorkingScenes({ word = "QUASSEL", label = "Arbeitet ..." }: WorkingScenesProps) {
  const [szene, setSzene] = useState(() => SZENEN[Math.floor(Math.random() * SZENEN.length)]);
  const [versatz, setVersatz] = useState(() => Math.floor(Math.random() * 20));
  const [frameTick, setFrameTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSzene((bisher) => {
        const andere = SZENEN.filter((s) => s.id !== bisher.id);
        return andere[Math.floor(Math.random() * andere.length)];
      });
      setVersatz(Math.floor(Math.random() * 20));
      setFrameTick(0);
    }, SZENENWECHSEL_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setFrameTick((value) => value + 1), GRUNDTAKT_MS);
    return () => window.clearInterval(timer);
  }, []);

  const bild = szene.zeichne(Math.floor(frameTick / szene.takt) + (szene.laufend ? versatz : 0), word);
  return (
    <div aria-label={label} className="qsl-working" role="status">
      <span aria-hidden="true" className="qsl-working__stage" key={szene.id}>
        <span className="qsl-working__character">
          {typeof bild === "string"
            ? bild
            : bild.map((zelle, i) => (
                <span className="qsl-working__cell" key={i}>
                  {zelle}
                </span>
              ))}
        </span>
      </span>
    </div>
  );
}
