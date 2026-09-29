import { createContext } from "react";

/** Ziel offener Aktionen: undefined = im Verlauf, null = das Dock über der Eingabe ist noch nicht eingehängt. */
export const ChatActionDock = createContext<HTMLElement | null | undefined>(undefined);
