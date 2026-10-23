import { connectApp } from "@fungi.computer/agar";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "@fungi.computer/caps/styles.css";
import "@fungi.computer/caps/fonts.css";

const root = document.getElementById("app");
if (root === null) throw new Error("App mount is missing.");
const session = await connectApp({
  host: "parent",
});
window.addEventListener("pagehide", () => session.dispose(), { once: true });
createRoot(root).render(<App session={session} />);
