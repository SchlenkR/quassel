import { createRoot } from "react-dom/client";
import "@quassel/foundation";
import "@quassel/foundation/base.css";
import "@quassel/chat-react/chat.css";
import "./gallery.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(<App />);
