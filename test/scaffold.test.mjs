import process from "node:process";
import { URL } from "node:url";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
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
          env: { PATH: process.env.PATH, HOME: directory },
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
    assert.equal(manifest.fungi.build.kind, "source-html");
    assert.equal(manifest.fungi.build.entry, "index.html");
    assert.equal(manifest.fungi.build.backend.entry, "src/backend/index.ts");
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

test("App build uses the recipe in the working package manifest", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fungi-app-recipe-"));
  try {
    await writeFile(
      join(directory, "package.json"),
      JSON.stringify({
        name: "manifest-recipe",
        fungi: {
          appId: "app_manifestrecipe",
          build: {
            kind: "bundled-html",
            entry: "bundle/index.html",
            assetBase: "./",
            assets: {
              maxManifestBytes: 1024,
              maxObjects: 2,
              maxObjectBytes: 1024,
              maxTotalBytes: 1048576,
            },
            backend: null,
            maxOutputBytes: 1048576,
          },
        },
      }),
    );
    await mkdir(join(directory, "bundle"));
    await writeFile(
      join(directory, "bundle/index.html"),
      "<!doctype html><title>Manifest-owned page</title>",
    );
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
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const release = JSON.parse(
      await readFile(join(directory, "dist/release.json"), "utf8"),
    );
    assert.equal(release.appId, "app_manifestrecipe");
    const artifactDirectory = join(directory, "dist/artifacts");
    const artifacts = await Promise.all(
      (await readdir(artifactDirectory)).map((name) =>
        readFile(join(artifactDirectory, name), "utf8"),
      ),
    );
    assert.ok(
      artifacts.some((content) => content.includes("Manifest-owned page")),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

for (const { args, message } of [
  {
    args: ["My-App", "--no-install"],
    message:
      "Choose a directory with a valid npm package name, such as my-app.",
  },
  {
    args: ["one", "two", "--no-install"],
    message: "Provide one project directory, such as my-app.",
  },
  {
    args: ["--wat"],
    message: "Unknown option. Run create-fungi-app --help for usage.",
  },
  {
    args: [],
    message:
      "Provide a project directory when running without a terminal: npm create fungi-app@latest my-app",
  },
]) {
  test(`invalid initializer input explains how to continue: ${JSON.stringify(args)}`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "fungi-app-input-"));
    try {
      const result = spawnSync(
        process.execPath,
        ["--import", import.meta.resolve("tsx"), cli, ...args],
        {
          cwd: directory,
          encoding: "utf8",
          env: { PATH: process.env.PATH, HOME: directory },
        },
      );
      assert.equal(result.status, 1);
      const output = result.stdout + result.stderr;
      assert.ok(output.includes(message), output);
      assert.ok(!output.includes(directory), output);
      assert.deepEqual(await readdir(directory), []);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}
