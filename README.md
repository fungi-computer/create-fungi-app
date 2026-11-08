# create-fungi-app

create-fungi-app creates a small App with Caps UI and one typed Agar backend
method, running in a local standalone Oyster. Most people want
[Oyster](https://docs.fungi.computer/oyster/) to run Apps or
[Shiitake](https://docs.fungi.computer/shiitake/) to run Agents.

## Quick start

Build and test an App locally without Docker, a Fungi Computer, or a Cloudflare
account.

Use Node 24.20.0, npm 11.19.0 and Git for Oyster's pinned build toolchain.

```sh
npm create fungi-app@latest my-app
cd my-app
npm run dev
```

Use `-- --no-install` to generate files without installing dependencies. In a
terminal, running `npm create fungi-app@latest` with no directory asks for the
project name and whether to install; without a terminal, pass the directory
argument. Existing directories are refused.

Open the loopback URL printed by the development command. Click **Say hello** to
call the backend. Save an edit in `src/` to rebuild the App and reload its page.

You can also test the typed backend over HTTP while development is running:

```sh
curl --fail-with-body http://127.0.0.1:61343/apps/app/methods/greet \
  -H 'Content-Type: application/json' \
  -d '{"name":"Oyster"}'
# {"message":"Hello, Oyster!"}
```

Stop development with Ctrl+C. To build a Release without starting a server:

```sh
npm run build
```

This writes `dist/release.json` and `dist/artifacts/`; it does not deploy or
publish anything.

### What runs locally

- `npm run dev` uses the existing Oyster builder, then runs
  `wrangler dev --local` on loopback. Workerd executes the host Worker and the
  App's Durable Object backend through Worker Loader. Local R2 serves the built
  UI and assets; Wrangler keeps local state under `.wrangler/`.
- `npm run build` runs Node/npm and the App compiler on your machine against an
  isolated snapshot of saved files. It does not allocate a build Computer.
- The template is React/Caps UI, one typed Agar `greet` method, a Durable Object
  facet, and a minimal Oyster Worker/config. It declares no Computer or
  container.

Wrangler configurations that include a container-backed Computer need Docker to
build and run that Computer locally. That is separate from compiling and running
this App.

Without an attached Computer, Computer files, shell commands, processes and port
previews are unavailable. Hosted repository build jobs also need their
configured execution backend. The starter does not emulate Team sign-in/grants
or funded provider services, and does not map your laptop's files into a
Computer. Development admits local requests as its owner; use it for trusted
source, not as a production authentication or isolation proof.

### Measured startup

In a Linux trial on October 28, 2026, the locally packed candidate took **53.8
seconds** from starting the scaffold command to the first working browser
greeting, under the conditions below:

| Step                                   | Elapsed |
| -------------------------------------- | ------- |
| Scaffold and install                   | 42.3 s  |
| Scaffold → first working App greeting  | 53.8 s  |
| Saved UI/backend edit → changed result | 11.0 s  |
| Separate `npm run build`               | 10.6 s  |

The cold run used a fresh HOME and empty npm cache on Linux, with Docker blocked
and no inherited Fungi or Cloudflare credentials. Node/npm/Git were already
installed. The packed-release proof served Fungi packages from local tarballs
and downloaded other dependencies from npm. Packing and toolchain/browser
installation were outside the clock. The saved-edit measurement reused the
running App. These are observed times, not a two-minute guarantee on another
machine or network.

## Examples

To create the App without installing dependencies:

```sh
npm create fungi-app@latest my-app -- --no-install
cd my-app
npm install
npm run dev
```

To build a Release from your saved files, run this inside the generated App:

```sh
npm run build
```

The build writes `dist/release.json` and `dist/artifacts/`. The generated
`README.md` shows `oyster install ./dist` (or `./dist/release.json`) using
`OYSTER_URL` and `OYSTER_OWNER_KEY`. The CLI delegates to the existing
`@fungi.computer/oyster/pack` uploader; it does not deploy an Oyster.

To use committed source instead, push the generated App to a Bonsai repository
and choose **Make this an App** in repository Settings. The root
`package.json#fungi.build` supplies the recipe. Registration does not build or
install. Subsequent accepted main pushes build the new commit on a hosted
backend and install only after success and within existing approval. New
permissions require owner consent and leave the previous Release unchanged.

## Core concepts

The template declares its backend definition, declaration, and build recipe in
`package.json`. `fungi.build` owns the UI entry, backend entry, asset bounds,
and recipe kind. Paths are relative to the App directory. Build and dev read
that metadata from your saved files; there is no second recipe inside the
command. `src/backend/methods.ts` owns the input, output and implementation of
`greet`; the UI calls that method through Agar's host-admitted capability.

`npm run dev` uses Oyster's builder and a standalone Worker on Wrangler. Its
development host admits local requests as its owner. The generated
`oyster/worker.ts` uses key authentication for a deployed host.

`npm run build` captures saved files, including uncommitted edits, in an
isolated Git snapshot. It leaves your repository history alone and records that
snapshot in the Release's provenance. Dependency installation uses
`package-lock.json`. Building creates the Release locally. Installing it into an
Oyster and publishing packages are separate operations.

## License

MIT licensed. See [LICENSE](LICENSE).
