import { DurableObject } from "cloudflare:workers";
import { appBackend } from "./methods.js";

export const MyApp = appBackend.implement(class extends DurableObject {});
