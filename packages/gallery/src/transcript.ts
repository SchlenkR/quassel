import { Message } from "@quassel/chat-react";

/** Ein fertiger Verlauf für die Nur-Lesen-Schublade. */
export const transcript: Message[] = [
  {
    key: "1",
    role: "user",
    text: "Wie sieht der Energieverbrauch der letzten Woche aus?",
    closed: true,
  },
  {
    key: "2",
    role: "thinking",
    text: "Der Nutzer will eine Wochenübersicht. Ich hole die Tageswerte und rechne den Schnitt aus.",
    closed: true,
  },
  {
    key: "3",
    role: "tool",
    text: 'lade_tageswerte { bereich: "letzte Woche" }',
    closed: true,
    tool: {
      id: "t1",
      name: "lade_tageswerte",
      arguments: '{ "bereich": "letzte Woche", "einheit": "kWh" }',
      result: '{ "tage": 7, "summe": 1284, "spitze": { "tag": "Mittwoch", "wert": 231 } }',
    },
  },
  {
    key: "4",
    role: "assistant",
    text: [
      "Die letzte Woche in Kürze:",
      "",
      "- **Summe**: 1284 kWh",
      "- **Schnitt**: rund 183 kWh pro Tag",
      "- **Spitze**: Mittwoch mit 231 kWh",
      "",
      "| Tag | kWh |",
      "|---|---|",
      "| Montag | 176 |",
      "| Dienstag | 189 |",
      "| Mittwoch | 231 |",
      "| Donnerstag | 174 |",
      "",
      "Der Mittwoch fällt auf - soll ich da reinschauen?",
    ].join("\n"),
    closed: true,
  },
  {
    key: "5",
    role: "user",
    text: "Ja, bitte.",
    closed: true,
  },
  {
    key: "6",
    role: "tool",
    text: 'lade_stundenwerte { tag: "Mittwoch" }',
    closed: true,
    tool: {
      id: "t2",
      name: "lade_stundenwerte",
      arguments: '{ "tag": "Mittwoch" }',
      result: '{ "fehler": "Zeitreihe hat eine Lücke zwischen 02:00 und 04:00" }',
      isError: true,
    },
  },
  {
    key: "7",
    role: "assistant",
    text: "Beim Mittwoch gibt es eine Lücke in der Zeitreihe (02:00 bis 04:00) - die Stundenauflösung ist darum nur teilweise belastbar. Die Spitze lag am Nachmittag zwischen 14:00 und 16:00.",
    closed: true,
  },
];
