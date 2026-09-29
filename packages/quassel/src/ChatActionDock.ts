import { createContext } from "react";

/** Target of open actions: undefined = in the transcript, null = the dock above the input is not mounted yet. */
export const ChatActionDock = createContext<HTMLElement | null | undefined>(undefined);
