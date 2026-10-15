import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scaffoldApp } from "create-fungi-app";

const directory = await mkdtemp(join(tmpdir(), "fungi-app-stranger-"));
try {
  await scaffoldApp(join(directory, "my-app"));
  const manifest = JSON.parse(
    await readFile(join(directory, "my-app/package.json"), "utf8"),
  );
  assert.equal(manifest.name, "my-app");
  assert.equal(manifest.fungi.backendDefinition, "src/backend/methods.ts");
  assert.match(manifest.fungi.appId, /^app_[a-z0-9]{1,63}$/);
} finally {
  await rm(directory, { recursive: true, force: true });
}
