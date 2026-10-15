import process from "node:process";
import { URL } from "node:url";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
test("a named project scaffolds without a terminal and preserves existing files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "create-fungi-app-"));
  try {
    const run = () =>
      spawnSync(
        process.execPath,
        ["--import", import.meta.resolve("tsx"), cli, "my-app", "--no-install"],
        {
          cwd: directory,
          encoding: "utf8",
          env: process.env,
        },
      );
    const result = run();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const project = join(directory, "my-app");
    const manifest = JSON.parse(
      await readFile(join(project, "package.json"), "utf8"),
    );
    assert.equal(manifest.name, "my-app");
    assert.equal(manifest.fungi.backendDefinition, "src/backend/methods.ts");
    assert.equal(manifest.fungi.backendDeclaration, undefined);
    assert.deepEqual(manifest.fungi.app.capabilities, []);
    assert.ok(manifest.scripts.dev);
    assert.ok(manifest.scripts.build);
    const original = await readFile(join(project, "src/App.tsx"), "utf8");
    assert.notEqual(run().status, 0);
    assert.equal(
      await readFile(join(project, "src/App.tsx"), "utf8"),
      original,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a failed App command exits without publishing private filesystem details", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fungi-app-private-path-"));
  try {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        import.meta.resolve("tsx"),
        fileURLToPath(new URL("../src/app-cli.ts", import.meta.url)),
        "build",
      ],
      {
        cwd: directory,
        encoding: "utf8",
        env: { PATH: process.env.PATH, HOME: directory },
      },
    );
    const output = result.stdout + result.stderr;
    assert.equal(result.status, 1);
    assert.match(output, /App command failed\./);
    assert.ok(
      !output.includes(directory),
      "Underlying filesystem paths must stay out of command output",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
