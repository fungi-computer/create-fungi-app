import { projectName, scaffoldApp } from "create-fungi-app";

const name: string = projectName.parse("my-app");
const created: Promise<void> = scaffoldApp(name);
void created;
