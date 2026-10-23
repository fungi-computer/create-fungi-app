#!/usr/bin/env node
import { starterIds } from "./ids.js";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { watch } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";
import { parseArgs } from "node:util";
import { Cli } from "@fungi.computer/lantern";
import {
  readBuildManifest,
  appBuildRecipe,
  createAppPublisher,
  createLocalArtifactWriter,
  createLocalBuildExecutor,
  createLocalDirectorySourceCapture,
} from "@fungi.computer/oyster/build";
import {
  InstallationObservationError,
  installRelease,
} from "@fungi.computer/oyster/pack";
import { parseReleaseId } from "@fungi.computer/puffball";
import { releaseSchema } from "@fungi.computer/puffball/effect";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { z } from "zod";

const cli = new Cli({ brand: "fungi" });
const root = process.cwd();
const lifecycle = new AbortController();
const shutdown = { interrupted: false };
process.once("SIGINT", () => {
  shutdown.interrupted = true;
  lifecycle.abort();
});
process.once("SIGTERM", () => {
  shutdown.interrupted = true;
  lifecycle.abort();
});

async function build(out: string) {
  const manifest = readBuildManifest(
    await readFile(join(root, "package.json"), "utf8"),
  );
  const appId = manifest.fungi.appId;
  if (appId === undefined) throw new Error("App manifest requires fungi.appId");
  const recipe = appBuildRecipe(manifest, "");
  const publisher = createAppPublisher({
    config: { appId, recipe },
    sourceCapture: createLocalDirectorySourceCapture(root),
    buildExecutor: createLocalBuildExecutor(),
    artifactWriter: createLocalArtifactWriter(
      join(out, "artifacts"),
      recipe.assets,
    ),
    releaseCatalog: { createRelease: (release) => Promise.resolve(release) },
  });
  const release = await Effect.runPromise(
    Effect.scoped(
      publisher.createCandidate(parseReleaseId(starterIds.release.generate())),
    ),
    { signal: lifecycle.signal },
  );
  await mkdir(out, { recursive: true });
  const encoded = Schema.encodeUnknownSync(
    Schema.fromJsonString(releaseSchema),
  )(release);
  await writeFile(join(out, "release.json"), `${encoded}\n`);
  return encoded;
}

async function dev(port: number) {
  const directory = join(root, ".botanical/dev");
  const out = join(directory, "release");
  const key = randomBytes(24).toString("hex");
  const origin = `http://127.0.0.1:${String(port)}`;
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, ".dev.vars"),
    `OYSTER_OWNER_KEY=${key}\nOYSTER_ORIGIN=${origin}\n`,
    {
      mode: 0o600,
    },
  );
  const config = z
    .record(z.string(), z.unknown())
    .parse(
      JSON.parse(await readFile(join(root, "oyster/wrangler.json"), "utf8")),
    );
  await writeFile(
    join(directory, "wrangler.json"),
    JSON.stringify({ ...config, main: "dev-worker.ts" }),
  );
  // Wrangler injects its reload script into the local host page. The ordinary
  // standalone Worker retains Oyster's production CSP.
  const developmentCsp = `default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; frame-src 'self'; connect-src 'self' ws://127.0.0.1:${String(port)}; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;
  const worker = (
    release: string,
  ) => `import worker from "../../oyster/worker.ts";
export { OysterBinding, OysterRegistry, OysterInstance, OysterInstallationExecutor } from "../../oyster/worker.ts";
export default { async fetch(request, env, context) {
  const headers = new Headers(request.headers);
  headers.set("Authorization", "Bearer " + env.OYSTER_OWNER_KEY);
  const response = await worker.fetch(new Request(request, { headers }), env, context);
  const result = new Response(response.body, response);
  if (new URL(request.url).pathname === "/apps/app/") result.headers.set("Content-Security-Policy", ${JSON.stringify(developmentCsp)});
  result.headers.set("X-Fungi-App-Release", ${JSON.stringify(z.object({ releaseId: z.string() }).parse(JSON.parse(release)).releaseId)});
  return result;
} };
`;
  let release = await cli.task("Building App", () => build(out));
  await writeFile(join(directory, "dev-worker.ts"), worker(release));
  const child = spawn(
    join(root, "node_modules/.bin/wrangler"),
    [
      "dev",
      "--local",
      "--ip",
      "127.0.0.1",
      "--port",
      String(port),
      "--live-reload",
      "--config",
      join(directory, "wrangler.json"),
      "--persist-to",
      join(root, ".wrangler"),
    ],
    {
      cwd: root,
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    },
  );
  for (const stream of [child.stdout, child.stderr]) {
    createInterface({ input: stream }).on("line", (line) => {
      cli.info(line.replaceAll(key, "[redacted]"));
    });
  }
  const stopped = new Promise<void>((done, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      if (lifecycle.signal.aborted || code === 0) done();
      else reject(new Error("Wrangler stopped before the App was closed."));
    });
  });
  // Attach the rejection handler immediately while startup and compilation run.
  void stopped.catch((cause: unknown) => {
    lifecycle.abort(cause);
  });
  const stop = () => {
    if (
      child.exitCode === null &&
      child.signalCode === null &&
      child.pid !== undefined
    )
      process.kill(-child.pid, "SIGTERM");
  };
  lifecycle.signal.addEventListener("abort", stop, { once: true });
  async function install() {
    const response = await installRelease({
      directory: out,
      url: origin,
      key,
      installationId: "app",
      signal: lifecycle.signal,
      onAdmitted: ({ installationId, requestId }) => {
        cli.info(
          `Installation ${installationId} accepted (request ${requestId}); observing authoritative status.`,
        );
      },
    });
    if (!response.ok)
      throw new Error(
        `Oyster refused the App installation (${String(response.status)}).`,
      );
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rebuilding = false;
  let pending = false;
  const rebuild = async () => {
    pending = true;
    if (rebuilding) return;
    rebuilding = true;
    try {
      while (pending && !lifecycle.signal.aborted) {
        pending = false;
        release = await cli.task("Rebuilding App", () => build(out));
        await install();
        await writeFile(join(directory, "dev-worker.ts"), worker(release));
        cli.info("App rebuilt; Wrangler is reloading the page.");
      }
    } catch (cause) {
      if (!lifecycle.signal.aborted) {
        Effect.runSync(
          Effect.logError("App rebuild failed.", Redacted.make(cause)),
        );
        if (cause instanceof InstallationObservationError)
          reportUnconfirmedInstallation(cause);
        else cli.info("App rebuild failed. Fix the source and save again.");
      }
    } finally {
      rebuilding = false;
    }
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      void rebuild();
    }, 150);
  };
  try {
    for (let attempt = 0; ; attempt++) {
      lifecycle.signal.throwIfAborted();
      const readiness = await Effect.runPromise(
        Effect.result(
          Effect.tryPromise({
            try: () => fetch(`${origin}/login`, { signal: lifecycle.signal }),
            catch: (cause) =>
              new Error("Wrangler readiness request failed.", { cause }),
          }),
        ),
      );
      lifecycle.signal.throwIfAborted();
      if (Result.isSuccess(readiness) && readiness.success.ok) break;
      if (attempt === 119)
        throw new Error("Wrangler did not start within one minute.", {
          cause: Result.isFailure(readiness)
            ? readiness.failure
            : new Error(
                `Wrangler returned HTTP ${String(readiness.success.status)}.`,
              ),
        });
      await delay(500, undefined, { signal: lifecycle.signal });
    }
    await install();
    watch(
      join(root, "src"),
      { recursive: true, signal: lifecycle.signal },
      schedule,
    );
    watch(root, { signal: lifecycle.signal }, (_event, filename) => {
      if (
        filename !== null &&
        ["index.html", "package.json", "package-lock.json"].includes(filename)
      )
        schedule();
    });
    cli.outro(`App ready at ${origin}/apps/app/`);
    await stopped;
  } finally {
    lifecycle.abort();
    clearTimeout(timer);
    stop();
    await stopped;
  }
}

function reportUnconfirmedInstallation(cause: InstallationObservationError) {
  cli.info(
    `Installation outcome unconfirmed (request ${cause.requestId}). Oyster may still finish; stopping observation does not cancel it.`,
  );
}

try {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      port: { type: "string", default: "61343" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) cli.info("fungi-app build | fungi-app dev [--port 61343]");
  else if (positionals.length !== 1)
    throw new Error("Choose fungi-app build or fungi-app dev.");
  else if (positionals[0] === "build") {
    await cli.task("Building Release", () => build(resolve(root, "dist")));
    cli.outro("Release ready in dist/release.json and dist/artifacts/.");
  } else if (positionals[0] === "dev")
    await dev(z.coerce.number().int().min(1).max(65535).parse(values.port));
  else throw new Error("Choose fungi-app build or fungi-app dev.");
} catch (cause) {
  if (!shutdown.interrupted) {
    if (cause instanceof InstallationObservationError)
      reportUnconfirmedInstallation(cause);
    Effect.runSync(
      Effect.logError("App command failed.", Redacted.make(cause)),
    );
    cli.cancel("App command failed.");
    process.exitCode = 1;
  }
}
