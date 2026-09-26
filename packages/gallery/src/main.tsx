import { createRoot } from "react-dom/client";
import "quassel/chat.css";
import "./themes.css";
import "./gallery.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(<App />);
