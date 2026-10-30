import { URL } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const destination = join(repository, ".botanical/create-fungi-app/archives");
const packages = new Map();
const workspaces = JSON.parse(
  execFileSync("pnpm", ["list", "--recursive", "--depth=-1", "--json"], {
    cwd: repository,
    encoding: "utf8",
  }),
);
for (const { path: directory } of workspaces) {
  const manifest = JSON.parse(
    await readFile(join(directory, "package.json"), "utf8"),
  );
  packages.set(manifest.name, { directory, manifest });
}
const closure = new Set();
function visit(name) {
  if (closure.has(name)) return;
  const entry = packages.get(name);
  if (!entry || entry.manifest.private)
    throw new Error(`Public archive unavailable: ${name}`);
  closure.add(name);
  for (const dependency of Object.keys(entry.manifest.dependencies ?? {})) {
    if (dependency.startsWith("@fungi.computer/")) visit(dependency);
  }
}
visit("create-fungi-app");
visit("@fungi.computer/agar");
visit("@fungi.computer/caps");
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const name of closure) {
  execFileSync("pnpm", ["pack", "--pack-destination", resolve(destination)], {
    cwd: packages.get(name).directory,
    stdio: "inherit",
  });
}
