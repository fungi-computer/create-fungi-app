#!/usr/bin/env node
import { spawn } from "node:child_process";
import { basename, resolve } from "node:path";
import { parseArgs } from "node:util";
import { Cli, isCancel } from "@fungi.computer/lantern";
import { projectName, scaffoldApp } from "./index.js";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

class InputError extends Error {}

const cli = new Cli({ brand: "fungi" });
try {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      "no-install": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    cli.info("npm create fungi-app@latest my-app [-- --no-install]");
  } else {
    if (positionals.length > 1)
      throw new InputError("Provide one project directory, such as my-app.");
    if (positionals.length === 0 && !cli.interactive)
      throw new InputError(
        "Provide a project directory when running without a terminal: npm create fungi-app@latest my-app",
      );
    cli.welcome("Create a Fungi App");
    const name =
      positionals[0] ??
      (await cli.text({
        message: "Where should we create your App?",
        placeholder: "my-app",
        validate: (value) =>
          projectName.safeParse(
            value === undefined ? undefined : basename(resolve(value)),
          ).success
            ? undefined
            : "Choose a directory with a valid npm package name.",
      }));
    if (isCancel(name)) {
      cli.cancel("App creation cancelled.");
    } else {
      const directory = name;
      if (!projectName.safeParse(basename(resolve(directory))).success)
        throw new InputError(
          "Choose a directory with a valid npm package name, such as my-app.",
        );
      await cli.task("Creating your App", async () => scaffoldApp(directory));
      const install = values["no-install"]
        ? false
        : cli.interactive
          ? await cli.confirm({
              message: "Install dependencies with npm?",
              initialValue: true,
            })
          : true;
      if (!isCancel(install) && install) {
        await cli.task(
          "Installing dependencies",
          () =>
            new Promise<void>((done, reject) => {
              const child = spawn("npm", ["install"], {
                cwd: resolve(directory),
                stdio: "inherit",
              });
              child.once("error", reject);
              child.once("exit", (code) => {
                if (code === 0) done();
                else reject(new Error("Dependency installation failed."));
              });
            }),
        );
      }
      cli.outro(
        `Ready. Run:\n  cd ${directory}\n${install === true ? "" : "  npm install\n"}  npm run dev`,
      );
    }
  }
} catch (cause) {
  const code =
    cause instanceof Error && "code" in cause ? cause.code : undefined;
  const message =
    cause instanceof InputError
      ? cause.message
      : code === "ERR_PARSE_ARGS_UNKNOWN_OPTION"
        ? "Unknown option. Run create-fungi-app --help for usage."
        : code === "EEXIST"
          ? "That directory already exists. Choose a new directory."
          : "App creation failed.";
  Effect.runSync(Effect.logError("App creation failed.", Redacted.make(cause)));
  cli.cancel(message);
  process.exitCode = 1;
}
