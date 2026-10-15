import process from "node:process";
import console from "node:console";
import { URL, fileURLToPath } from "node:url";
const { fetch } = globalThis;
// Run against packed archives only: no workspace links or inherited HOME.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, expect } from "playwright/test";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";

const archiveDirectory = resolve(process.argv[2]);
const archives = new Map();
for (const filename of await readdir(archiveDirectory)) {
  if (!filename.endsWith(".tgz")) continue;
  const path = join(archiveDirectory, filename);
  const manifest = JSON.parse(
    execFileSync("tar", ["-xOf", path, "package/package.json"], {
      encoding: "utf8",
    }),
  );
  assert.notEqual(manifest.private, true, `${manifest.name} is private`);
  archives.set(manifest.name, {
    manifest,
    path,
    filename,
    integrity: `sha512-${createHash("sha512")
      .update(await readFile(path))
      .digest("base64")}`,
  });
}
assert.ok(archives.has("create-fungi-app"));
assert.ok(archives.has("@fungi.computer/oyster"));
// A read-only npm fixture serves the exact packed manifests and archives.
// npm itself still owns resolution, installation and initializer dispatch.
let registryOrigin;
const registry = createServer((request, response) => {
  const pathname = decodeURIComponent(
    new URL(request.url, "http://localhost").pathname,
  );
  const tarball = [...archives.values()].find(
    (archive) => pathname === `/tarballs/${archive.filename}`,
  );
  if (tarball) {
    response.setHeader("Content-Type", "application/octet-stream");
    createReadStream(tarball.path).pipe(response);
    return;
  }
  const archive = archives.get(pathname.slice(1));
  if (!archive) {
    response
      .writeHead(307, { Location: `https://registry.npmjs.org${request.url}` })
      .end();
    return;
  }
  const { manifest, integrity, filename } = archive;
  response.setHeader("Content-Type", "application/json");
  response.end(
    JSON.stringify({
      name: manifest.name,
      "dist-tags": { latest: manifest.version },
      versions: {
        [manifest.version]: {
          ...manifest,
          dist: {
            integrity,
            tarball: `${registryOrigin}/tarballs/${filename}`,
          },
        },
      },
    }),
  );
});
await new Promise((done) => registry.listen(0, "127.0.0.1", done));
registryOrigin = `http://127.0.0.1:${registry.address().port}`;
const directory = await mkdtemp(join(tmpdir(), "fungi-app-clean-home-"));
const home = join(directory, "home");
await mkdir(home);
const env = {
  PATH: process.env.PATH,
  HOME: home,
  CI: "true",
  npm_config_yes: "true",
  npm_config_registry: registryOrigin,
  npm_config_cache: join(home, "npm-cache"),
  npm_config_userconfig: join(home, "npmrc"),
  WRANGLER_SEND_METRICS: "false",
};
await writeFile(env.npm_config_userconfig, `registry=${registryOrigin}\n`);
const children = new Set();
function command(args, cwd, longRunning = false, executable = "npm") {
  const child = spawn(executable, args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  children.add(child);
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });
  const stopped = new Promise((done, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      children.delete(child);
      if (code === 0 || longRunning) done();
      else reject(new Error(`npm ${args[0]} failed:\n${output}`));
    });
  });
  return { child, stopped, output: () => output };
}
let browser;
try {
  await command(
    ["create", "fungi-app@latest", "my-app", "--", "--no-install"],
    directory,
  ).stopped;
  const appDirectory = join(directory, "my-app");
  await command(["install", "--no-audit", "--no-fund"], appDirectory).stopped;
  await command(["exec", "--", "tsc", "-p", "tsconfig.json"], appDirectory)
    .stopped;
  await command(["run", "build"], appDirectory).stopped;
  const release = JSON.parse(
    await readFile(join(appDirectory, "dist/release.json"), "utf8"),
  );
  const manifest = JSON.parse(
    await readFile(join(appDirectory, "package.json"), "utf8"),
  );
  assert.equal(release.appId, manifest.fungi.appId);
  const origin = "http://127.0.0.1:61347";
  const celld = process.env.CELLD_PLATFORM_CELLD;
  let authorization = {};
  let ownerKey;
  let dev;
  if (celld) {
    // Exercise the identical standalone root with celld's ordinary dev CLI.
    const key = randomBytes(24).toString("hex");
    ownerKey = key;
    authorization = { Authorization: `Bearer ${key}` };
    const config = JSON.parse(
      await readFile(join(appDirectory, "oyster/wrangler.json"), "utf8"),
    );
    delete config.$schema;
    await writeFile(
      join(appDirectory, "wrangler.json"),
      JSON.stringify({
        ...config,
        main: "oyster/worker.ts",
        vars: { OYSTER_OWNER_KEY: key, OYSTER_ORIGIN: origin },
      }),
      { mode: 0o600 },
    );
    env.CELLD_ESBUILD = join(appDirectory, "node_modules/.bin/esbuild");
    env.CELLD_READY_FLEET_GATE_MS = "0";
    env.CELLD_V8_HEAP_LIMIT_MB = "256";
    dev = command(
      [
        "dev",
        appDirectory,
        "--host",
        "127.0.0.1",
        "--port",
        "61347",
        "--no-watch",
      ],
      appDirectory,
      true,
      celld,
    );
    for (let attempt = 0; ; attempt++) {
      const readiness = await Effect.runPromise(
        Effect.result(
          Effect.tryPromise({
            try: () => fetch(`${origin}/login`, { headers: authorization }),
            catch: (cause) =>
              new Error("celld readiness request failed.", { cause }),
          }),
        ),
      );
      if (Result.isSuccess(readiness) && readiness.success.ok) break;
      if (attempt >= 240 || dev.child.exitCode !== null)
        throw new Error("celld did not become ready", {
          cause: Result.isFailure(readiness)
            ? Redacted.make(readiness.failure)
            : undefined,
        });
      await delay(500);
    }
    env.FUNGI_APP_PROOF_KEY = key;
    await writeFile(
      join(appDirectory, ".install-proof.mjs"),
      `import { installRelease } from "@fungi.computer/oyster/pack";
const response = await installRelease({ directory: "dist", url: ${JSON.stringify(origin)}, key: process.env.FUNGI_APP_PROOF_KEY, installationId: "app" });
if (!response.ok) throw new Error("Release installation refused: " + response.status);
`,
    );
    await command(["exec", "--", "node", ".install-proof.mjs"], appDirectory)
      .stopped;
    delete env.FUNGI_APP_PROOF_KEY;
  } else {
    dev = command(["run", "dev", "--", "--port", "61347"], appDirectory, true);
    for (let attempt = 0; ; attempt++) {
      if (dev.output().includes("App ready at")) break;
      assert.ok(
        attempt < 240 && dev.child.exitCode === null,
        `App dev did not become ready:\n${dev.output()}`,
      );
      await delay(500);
    }
  }
  const result = await fetch(`${origin}/apps/app/methods/greet`, {
    method: "POST",
    headers: { ...authorization, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Oyster" }),
  });
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { message: "Hello, Oyster!" });
  browser = await chromium.launch();
  const page = await browser.newPage();
  if (ownerKey !== undefined) {
    const signedIn = await page.request.post(`${origin}/login`, {
      form: { key: ownerKey },
      maxRedirects: 0,
    });
    assert.equal(signedIn.status(), 303, "Oyster sign-in failed");
  }
  await page.goto(`${origin}/apps/app/`);
  const frame = page.frameLocator("#oyster-app");
  const button = frame.getByRole("button", { name: "Say hello" });
  const buttonBounds = await button.boundingBox();
  const containerBounds = await button.locator("..").boundingBox();
  assert.ok(
    buttonBounds && containerBounds,
    "Starter controls must be visible",
  );
  assert.ok(
    buttonBounds.width < containerBounds.width / 2,
    "Say hello must keep its intrinsic width rather than stretching across the App",
  );
  const methodRoute = "**/apps/app/methods/greet";
  await page.route(methodRoute, (route) =>
    route.fulfill({ status: 503, body: "Backend unavailable" }),
  );
  await button.click();
  await expect(frame.getByRole("status")).toHaveText(
    "Could not reach the backend. Try again.",
  );
  await expect(button).toBeEnabled();
  await page.unroute(methodRoute);
  await button.click();
  await expect(frame.getByRole("status")).toHaveText("Hello, friend!");
  const proofDirectory = fileURLToPath(
    new URL("../../../.botanical/create-fungi-app/proof/", import.meta.url),
  );
  await mkdir(proofDirectory, { recursive: true });
  await page.screenshot({
    path: join(proofDirectory, celld ? "celld.png" : "workerd.png"),
    fullPage: true,
  });
  if (!celld) {
    const ui = join(appDirectory, "src/App.tsx");
    await writeFile(
      ui,
      (await readFile(ui, "utf8")).replace(
        ">My App</CardTitle>",
        ">My edited App</CardTitle>",
      ),
    );
    const source = join(appDirectory, "src/backend/methods.ts");
    await writeFile(
      source,
      (await readFile(source, "utf8")).replace("Hello,", "Welcome,"),
    );
    await expect(
      frame.getByRole("heading", { name: "My edited App" }),
    ).toBeVisible({ timeout: 120000 });
    await expect(async () => {
      await frame.getByRole("button", { name: "Say hello" }).click();
      await expect(frame.getByRole("status")).toHaveText("Welcome, friend!");
    }).toPass({ timeout: 120000 });
  }
  console.log(
    celld
      ? "PASS clean HOME packed npm create → npm run build → celld dev: standalone App UI and typed method"
      : "PASS clean HOME packed npm create → npm run build → wrangler dev: App UI, typed method and saved-edit live reload",
  );
} finally {
  if (browser) await browser.close();
  await Promise.all(
    [...children].map(async (child) => {
      const closed = new Promise((done) => child.once("close", done));
      if (child.exitCode === null && child.signalCode === null)
        process.kill(-child.pid, "SIGTERM");
      await closed;
    }),
  );
  await new Promise((done) => registry.close(done));
  await rm(directory, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 100,
  });
}
