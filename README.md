<div align="center">
  <h1>trpc-diff</h1>
  <p>Detect breaking changes in tRPC routers before they hit production.</p>
</div>

## What it does

`tRPC-diff` converts your tRPC router to an OpenAPI contract and diffs two versions to find breaking changes.

Under the hood it uses:

- [**zod-openapi**](https://github.com/samchungy/zod-openapi) to generate the OpenAPI contract from your Zod schemas
- [**oasdiff-js**](https://github.com/mattiacerutti/oasdiff-js) (JavaScript bindings for oasdiff) to detect breaking changes between contracts

## Install

```bash
npm install -D trpc-diff
# or
bun add -D trpc-diff
```

> **Note:** `trpc-diff` depends on `oasdiff-js`, which downloads a native Go binary during its postinstall step. Some package managers (Bun, npm with `--ignore-scripts`, CI environments) may block this. If you get a "binary not found" error, see [Troubleshooting](#troubleshooting).

## Quick start

**1. Create a config file**

Create `trpc-diff.config.ts` in your project root and point it at your router module:

```ts
export default {
  routerModule: "./src/server/router.ts",
  routerExport: "appRouter",
};
```

- `routerModule` — path to the module that exports your router (required)
- `routerExport` — the named export to read from that module (optional, uses default export if not present)

**2. Generate a contract snapshot**

```bash
npx trpc-diff generate --output contract-base.json
```

**3. Diff against another version**

```bash
npx trpc-diff diff --base contract-base.json --head contract-head.json
```

The command exits with code `1` if breaking changes are found.

Use `--json` for machine-readable output:

```bash
npx trpc-diff diff --base base.json --head head.json --json
```

## Configuration

The config file must default-export an object with a `routerModule` string:

```ts
export default {
  routerModule: "./src/server/router.ts",
  routerExport: "appRouter",
};
```

| Option         | Type     | Required | Description                                                    |
| -------------- | -------- | -------- | -------------------------------------------------------------- |
| `routerModule` | `string` | yes      | Path to the module that exports your router                    |
| `routerExport` | `string` | no       | Named export to read from the module (default: default export) |

### Severity levels

`severityLevels` emulates an [`oasdiff-levels.txt`](https://github.com/oasdiff/oasdiff/blob/main/docs/BREAKING-CHANGES.md#customizing-severity-levels) file. Each key is a check id and each value is a level (`err`, `warn`, `info`, or `none`).

```ts
export default {
  routerModule: "./src/server/router.ts",
  routerExport: "appRouter",
  severityLevels: {
    // treat removing request properties as breaking
    "request-property-removed": "err",
    // ignore response enum value additions
    "response-body-enum-value-added": "none",
  },
};
```

#### Defaults

By default, only `request-property-removed` is overridden to `none` (removing request properties is considered compatible). This matches typical tRPC behavior where Zod input schemas are non-strict by default making extra properties ignored, so removing a field from the schema doesn't necessarily break existing clients.

Everything else follows [oasdiff's default severity levels](https://github.com/oasdiff/oasdiff/blob/main/docs/BREAKING-CHANGES.md#customizing-severity-levels).

Run `npx oasdiff checks` to see all available check ids and their default levels.

## CLI reference

```
npx trpc-diff generate --output <path> [--config <path>]
npx trpc-diff diff --base <path> --head <path> [--config <path>] [--json]
```

| Flag       | Description                                          |
| ---------- | ---------------------------------------------------- |
| `--output` | Where to write the generated contract                |
| `--base`   | Path to the base contract                            |
| `--head`   | Path to the head contract                            |
| `--config` | Path to config file (default: `trpc-diff.config.ts`) |
| `--json`   | Output diff results as JSON                          |

## Programmatic usage

### Generate and diff contracts

```ts
import { generateContract, diffContracts } from "trpc-diff";

const base = generateContract(routerV1);
const head = generateContract(routerV2);

const result = await diffContracts(base, head);

if (!result.compatible) {
  console.log("Breaking changes found:", result.findings);
}
```

### Load a router from config

```ts
import { loadConfig, loadRouter, generateContract } from "trpc-diff";

const config = await loadConfig("./trpc-diff.config.ts");
const router = await loadRouter(config, process.cwd());
const contract = generateContract(router);
```

### Types

```ts
import type { ITrpcDiffConfig, IRouter, IProcedure } from "trpc-diff";

// IConfig — shape of your config file
// IRouter — shape of a tRPC router as seen by trpc-diff
// IProcedure — shape of a single procedure (query, mutation, or subscription)
```

## Troubleshooting

### Binary not found after install

`trpc-diff` depends on `oasdiff-js`, which downloads a native Go binary during its postinstall step. If your package manager blocks lifecycle scripts, see the [oasdiff-js troubleshooting guide](https://github.com/mattiacerutti/oasdiff-js#troubleshooting) for platform-specific fixes (Bun, npm, pnpm, yarn, and CI environments).

### "missing the '_def.procedures' property required for a tRPC router"

If you see this error, `trpc-diff` found the export you specified but it is not a valid tRPC router. Make sure:

- `routerModule` points to the right file
- `routerExport` matches the export name in that file
- The export is actually a tRPC router (not a procedure or other object)

## License

[MIT](./LICENSE)
