# My App

This App has Caps UI and one typed backend method. Oyster hosts both surfaces;
the UI calls `greet` through Agar's `app.methods` capability.

Use Node 24.20.0, npm 11.19.0 and Git, then:

```sh
npm install
npm run dev
```

Development runs a standalone Oyster on loopback with Wrangler. Save an edit in
`src/` to rebuild the App and reload its page. The development host admits local
requests as its owner; use the ordinary key-authenticated `oyster/worker.ts` for
a deployed host, with `OYSTER_OWNER_KEY` as a secret and `OYSTER_ORIGIN` set to
its public origin. Each App Instance records that origin when it is installed.

`src/backend/methods.ts` declares the method's input and output schemas and its
handler. `src/backend/index.ts` exports the Durable Object facet. The
`fungi.backendDefinition` manifest entry tells Oyster's builder where the
definition lives; the builder derives the App's API and declaration from it and
the manifest's `fungi.app`.

```sh
npm run build
```

This writes `dist/release.json` and `dist/artifacts/`. Build captures the
current saved files into an isolated Git snapshot, including uncommitted edits;
it does not modify your repository or create a customer commit. The Release's
provenance names that exact snapshot. Dependency installation uses
`package-lock.json`.

To install the Release into an Oyster, use its public packing client:

```js
import { installRelease } from "@fungi.computer/oyster/pack";

const response = await installRelease({
  directory: "./dist",
  url: process.env.OYSTER_URL,
  key: process.env.OYSTER_OWNER_KEY,
});
if (!response.ok) throw new Error(`Installation refused: ${response.status}`);
```

The same Release format is used by Fungi. Building creates the Release locally;
it does not install or publish it.
