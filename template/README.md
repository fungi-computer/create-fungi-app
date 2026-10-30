# My App

This App has Caps UI and one typed backend method. Oyster hosts both surfaces;
the UI calls `greet` through Agar's `app.methods` capability.

Use Node 24.20.0, npm 11.19.0 and Git, then:

```sh
npm install
npm run dev
```

No Docker, Fungi Computer, or Cloudflare account is needed. Open the printed
loopback URL and click **Say hello**, or test the same backend directly:

```sh
curl --fail-with-body http://127.0.0.1:61343/apps/app/methods/greet \
  -H 'Content-Type: application/json' \
  -d '{"name":"Oyster"}'
# {"message":"Hello, Oyster!"}
```

Development runs a standalone Oyster on loopback with Wrangler. Save an edit in
`src/` to rebuild the App and reload its page. The development host admits local
requests as its owner; use the ordinary key-authenticated `oyster/worker.ts` for
a deployed host, with `OYSTER_OWNER_KEY` as a secret and `OYSTER_ORIGIN` set to
its public origin. Each App Instance records that origin when it is installed.

The host Worker, Durable Objects, Worker Loader and Release assets run locally;
state stays under `.wrangler/`. No Computer or container is configured. Computer
files, shell commands, processes and port previews need an attached Computer.
Team sign-in/grants and funded provider services are not emulated. See the
[create-fungi-app quickstart](https://docs.fungi.computer/create-fungi-app/quickstart/)
for the measured cold-start time and the local/hosted boundary.

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

To install the Release into an existing Oyster, set its URL and owner key, then
use the ordinary Oyster CLI:

```sh
export OYSTER_URL=https://your-oyster.example
export OYSTER_OWNER_KEY='<your owner key>'
npx oyster install ./dist --installation-id my-app
# The manifest path is also accepted:
npx oyster install ./dist/release.json --installation-id my-app
```

Both forms use `installRelease` from `@fungi.computer/oyster/pack`: artifacts
upload before the installation request. A failed upload or installation exits
nonzero; the command does not provision or deploy an Oyster.

For repository-driven authoring, commit the App's root `package.json` and its
`fungi.build` recipe on main, push to a repository in Bonsai, then open its
Settings and choose **Make this an App**. Registration reads committed metadata,
not dirty working files, and does not build or install. Later accepted main
pushes build that exact commit on an attached hosted backend. Successful builds
may reuse existing approval; new permissions produce `needs_consent` and leave
any previous Release running. Local-only Computers return `no_backend`.

The same Release format is used by Fungi. Building creates the Release locally;
it does not install or publish it.

## Models and mascots

When adding Quaternius art, add `@fungi.computer/art-library` and `three` as
dependencies. Discover models through `@fungi.computer/art-library/models`: use
`models` and `searchModels(models, query)` to find candidates, then
`requireModel(models, id)` to pin a catalog ID rather than guessing filenames.

Load the selected asset with `modelLoader()` from
`@fungi.computer/art-library/three` and its `loadAsync(modelUrl)` method. This
loader wires the Meshopt decoder needed by compressed models; a bare
`GLTFLoader` does not.

Include the chosen model (and any referenced buffers/textures) in the Release's
built assets and use the emitted asset URL; the catalog row's `file` is not a
public Oyster URL. Keep `fungi.build.assetBase` as `"./"` and URLs
release-scoped under `/ui/<installation>/<release>/`. Resolve emitted relative
paths against the App document base, for example
`new URL("./assets/mascot.glb", document.baseURI).href` if that is the emitted
path. Never hard-code `/models/...`: its leading slash escapes the Release
prefix and requests an asset from the host root.
