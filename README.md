# create-fungi-app

create-fungi-app creates a small App with Caps UI and one typed Agar backend
method, running in a local standalone Oyster. Most people want
[Oyster](https://docs.fungi.computer/reference/packages/#oyster) to run Apps or
[Shiitake](https://docs.fungi.computer/reference/packages/#shiitake) to run
Agents.

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
`README.md` includes an installation example using
`@fungi.computer/oyster/pack`.

## Core concepts

The template declares its backend definition and declaration in `package.json`.
`src/backend/methods.ts` owns the input, output and implementation of `greet`;
the UI calls that method through Agar's host-admitted capability.

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
