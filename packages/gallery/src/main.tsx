import { createRoot } from "react-dom/client";
import "quassel/foundation.css";
import "quassel/base.css";
import "quassel/chat.css";
import "./gallery.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(<App />);
