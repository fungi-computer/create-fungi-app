# create-fungi-app

create-fungi-app creates a small App with Caps UI and one typed Agar backend
method, running in a local standalone Oyster. Most people want
[Oyster](https://docs.fungi.computer/oyster/) to run Apps or
[Shiitake](https://docs.fungi.computer/shiitake/) to run Agents.

## Quick start

Use Node 24.20.0, npm 11.19.0 and Git for Oyster's pinned build toolchain.

```sh
npm create fungi-app@latest my-app
cd my-app
npm run dev
```

Use `-- --no-install` to generate files without installing dependencies. With no
directory argument, Lantern asks for the project name and whether to install.
Existing directories are refused.

Open the loopback URL printed by the development command. Click **Say hello** to
call the backend. Save an edit in `src/` to rebuild the App and reload its page.

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
