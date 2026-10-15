import { starterIds } from "./ids.js";
import { parseAppId } from "@fungi.computer/puffball";
import { cp, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as z from "zod";
import validatePackageName from "validate-npm-package-name";

/** A project directory name, also used as its npm package name. */
export const projectName = z
  .string()
  .refine((name) => validatePackageName(name).validForNewPackages, {
    message: "Choose a valid npm package name for your project directory.",
  });

/** Create a starter App in a new directory. Existing destinations are never overwritten. */
export async function scaffoldApp(directory: string): Promise<void> {
  const target = resolve(directory);
  const name = projectName.parse(basename(target));
  const template = fileURLToPath(new URL("../template/", import.meta.url));
  await mkdir(target);
  await cp(template, target, { recursive: true });
  await rename(resolve(target, "gitignore"), resolve(target, ".gitignore"));
  const manifest = z
    .object({ fungi: z.record(z.string(), z.unknown()) })
    .loose()
    .parse(JSON.parse(await readFile(resolve(target, "package.json"), "utf8")));
  await writeFile(
    resolve(target, "package.json"),
    `${JSON.stringify({ ...manifest, name, fungi: { ...manifest.fungi, appId: parseAppId(starterIds.app.generate()) } }, null, 2)}\n`,
  );
}
