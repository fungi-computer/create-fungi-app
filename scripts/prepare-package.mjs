import { URL } from "node:url";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import * as z from "zod";

const root = new URL("../", import.meta.url);
const destination = new URL(".botanical/package/", root);
const manifest = z
  .record(z.string(), z.unknown())
  .parse(JSON.parse(await readFile(new URL("package.json", root), "utf8")));
const template = z
  .object({
    dependencies: z.record(z.string(), z.string()),
    devDependencies: z.record(z.string(), z.string()),
  })
  .loose()
  .parse(
    JSON.parse(await readFile(new URL("template/package.json", root), "utf8")),
  );
for (const dependencies of [template.dependencies, template.devDependencies]) {
  for (const name of Object.keys(dependencies)) {
    const path =
      name === "create-fungi-app"
        ? "package.json"
        : name.startsWith("@fungi.computer/")
          ? `../${name.slice("@fungi.computer/".length)}/package.json`
          : undefined;
    if (path !== undefined) {
      const dependency = z
        .object({ version: z.string() })
        .parse(JSON.parse(await readFile(new URL(path, root), "utf8")));
      dependencies[name] = dependency.version;
    }
  }
}
delete manifest.scripts;
delete manifest.botanical;
delete manifest.devDependencies;
delete manifest.publishConfig;
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const path of ["dist", "template", "docs/api", "README.md", "LICENSE"])
  await cp(new URL(path, root), new URL(path, destination), {
    recursive: true,
  });
await writeFile(
  new URL("template/package.json", destination),
  `${JSON.stringify(template, null, 2)}\n`,
);
await writeFile(
  new URL("package.json", destination),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
