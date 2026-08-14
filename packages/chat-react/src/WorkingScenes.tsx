import { useEffect, useState } from "react";

const SPUR = 13;
const GRUNDTAKT_MS = 90;
const SZENENWECHSEL_MS = 2600;

/** Eine Zelle je Figur: Emoji und Satzzeichen teilen sich kein Raster, geschobener Text ruckelt. */
function bahn(figuren: Record<number, string>, breite = SPUR): string[] {
  return Array.from({ length: breite }, (_, x) => figuren[x] ?? " ");
}

interface Szene {
  id: string;
  takt: number;
  laufend?: true;
  zeichne: (schritt: number) => string | string[];
}

/**
 * Kleine Szenen, in denen etwas Erkennbares passiert - der Zustand aendert sich sichtbar,
 * statt dass nur eine Figur vorbeilaeuft. Szenen mit Bewegung geben ihre Bahn als Zellen
 * zurueck, alle anderen als schlichten Text.
 */
const SZENEN: Szene[] = [
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
      return bahn({ [x - 2]: "·", [x - 1]: "\u{1F4A8}", [x]: "\u{1F680}" });
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
        figuren[i] = "·";
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
      if (takt < 6) return "\u{1F95A}✨";
      if (takt < 9) return "\u{1F423}";
      return "\u{1F425}";
    },
  },
  {
    // Morse-artiges Signal, das sich zu einem OK aufloest.
    id: "signal",
    takt: 2,
    zeichne: (schritt) => {
      const takt = schritt % 14;
      if (takt >= 11) return "\u{1F4E1} OK";
      const muster = ["·", "··", "·-", "-·", "··-", "-··"];
      return "\u{1F4E1} " + muster[takt % muster.length];
    },
  },
  {
    // Sanduhr: der Sand laeuft durch, dann wird gedreht.
    id: "sanduhr",
    takt: 2,
    zeichne: (schritt) => {
      const takt = schritt % 12;
      const koerner = "·".repeat(Math.max(0, 5 - Math.floor(takt / 2)));
      return (takt < 10 ? "⏳" : "⌛") + " " + koerner;
    },
  },
  {
    // Ei, Kueken, Henne - und die legt das naechste Ei.
    id: "huhn-kreislauf",
    takt: 3,
    zeichne: (schritt) => {
      const takt = schritt % 16;
      if (takt < 3) return "\u{1F95A}";
      if (takt < 5) return "\u{1F95A}✨";
      if (takt < 8) return "\u{1F423}";
      if (takt < 11) return "\u{1F424}";
      if (takt < 14) return "\u{1F414}";
      return "\u{1F414}\u{1F95A}";
    },
  },
  {
    // Hut, Funken - und das Kaninchen tuermt.
    id: "zauberhut",
    takt: 3,
    zeichne: (schritt) => {
      const takt = schritt % 14;
      if (takt < 4) return "\u{1F3A9}";
      if (takt < 7) return "\u{1F3A9}✨";
      if (takt < 11) return "\u{1F3A9}\u{1F407}";
      return "\u{1F407}\u{1F4A8}";
    },
  },
  {
    // Rot, Gelb, Gruen - und ab.
    id: "ampel",
    takt: 3,
    zeichne: (schritt) => {
      const takt = schritt % 12;
      if (takt < 4) return "\u{1F534}";
      if (takt < 6) return "\u{1F7E1}";
      if (takt < 8) return "\u{1F7E2}";
      return "\u{1F697}\u{1F4A8}";
    },
  },
  {
    // Klingeln, verschlafen, losrennen.
    id: "wecker",
    takt: 2,
    zeichne: (schritt) => {
      const takt = schritt % 14;
      if (takt < 5) return takt % 2 === 0 ? "⏰" : "\u{1F514}";
      if (takt < 8) return "\u{1F634}";
      if (takt < 10) return "\u{1F633}";
      return "\u{1F3C3}\u{1F4A8}";
    },
  },
  {
    // Schnecke kriecht zur Flagge - und feiert.
    id: "schnecke",
    takt: 4,
    zeichne: (schritt) => {
      const takt = schritt % 8;
      if (takt < 5) return bahn({ [takt]: "\u{1F40C}", 4: "\u{1F3C1}" }, 5);
      return bahn({ 4: "\u{1F389}" }, 5);
    },
  },
];

export interface WorkingScenesProps {
  /** Text fuer Screenreader, Default "Arbeitet ...". */
  label?: string;
}

/**
 * Der Default-Working-Indikator: zufaellig rotierende Mini-Szenen. Zufaellige Reihenfolge
 * und Startphase, damit dieselben Szenen nie wie eine Schleife wirken. Ueber die
 * working-Prop von ChatMessages laesst er sich komplett ersetzen.
 */
export function WorkingScenes({ label = "Arbeitet ..." }: WorkingScenesProps) {
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

  const bild = szene.zeichne(Math.floor(frameTick / szene.takt) + (szene.laufend ? versatz : 0));
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
