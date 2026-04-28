<div align="center">
  <h1>trpc-diff</h1>
  <p>Detect breaking changes in tRPC routers before they hit production.</p>
</div>

## What it does

`trpc-diff` converts your tRPC router to an OpenAPI contract and diffs two contracts to find breaking changes.

Under the hood it uses:

- [**zod-openapi**](https://github.com/samchungy/zod-openapi) to generate the OpenAPI contract from your Zod schemas
- [**oasdiff-js**](https://github.com/mattiacerutti/oasdiff-js) (JavaScript bindings for oasdiff) to detect breaking changes between contracts

## Install

```bash
npm install -D trpc-diff
# or
bun add -D trpc-diff
```

## Usage

Import your router, generate a contract, and diff it against another version.

### Generate a contract

```ts
import { generateContract } from "trpc-diff";
import { appRouter } from "./server/router";

const contract = generateContract(appRouter);

// write to disk or pass directly to diffContracts
await Bun.write("contract.json", JSON.stringify(contract, null, 2));
```

### Diff two contracts

```ts
import { diffContracts } from "trpc-diff";
import base from "./contract-base.json";
import head from "./contract-head.json";

const result = await diffContracts(base, head);

if (!result.compatible) {
  console.log("Breaking changes found:");
  for (const finding of result.findings) {
    console.log(`- ${finding.code} at ${finding.entity}`);
  }
}
```

### Custom severity levels

```ts
const result = await diffContracts(base, head, {
  severityLevels: {
    // treat removing request properties as breaking
    "request-property-removed": "err",
    // ignore response enum value additions
    "response-body-enum-value-added": "none",
  },
});
```

Each key is a check id and each value is a level (`err`, `warn`, `info`, or `none`). This emulates an [`oasdiff-levels.txt`](https://github.com/oasdiff/oasdiff/blob/main/docs/BREAKING-CHANGES.md#customizing-severity-levels) file.

#### Defaults

By default, only `request-property-removed` is overridden to `none` (removing request properties is considered compatible). This matches typical tRPC behavior where Zod input schemas are non-strict by default, so removing a field from the schema doesn't necessarily break existing clients.

Everything else follows [oasdiff's default severity levels](https://github.com/oasdiff/oasdiff/blob/main/docs/BREAKING-CHANGES.md#customizing-severity-levels).

To see all available check ids and their default levels, install `@oasdiff-js/oasdiff-js` directly and run:

```bash
npx oasdiff checks
```

### Using it in CI

Since the library is runtime-agnostic, you can diff PRs in CI by generating contracts in each checkout with the same runtime your app uses.

```yaml
- name: Generate base contract
  run: bun run scripts/generate-contract.ts --out base.json

- name: Generate head contract
  run: bun run scripts/generate-contract.ts --out head.json

- name: Diff contracts
  run: bun run scripts/diff-contracts.ts --base base.json --head head.json
```

## API reference

### `generateContract(router: IRouter): IOpenApiDocument`

Converts a tRPC router to an OpenAPI 3.0 contract.

### `diffContracts(base, head, options?): Promise<IDiffResult>`

Diffs two OpenAPI contracts for breaking changes.

| Parameter                | Type                     | Description                 |
| ------------------------ | ------------------------ | --------------------------- |
| `base`                   | `IOpenApiDocument`       | Base contract               |
| `head`                   | `IOpenApiDocument`       | Head contract               |
| `options.severityLevels` | `Record<string, string>` | Optional severity overrides |

Returns `{ compatible: boolean; findings: IDiffFinding[] }`.

## Design

`trpc-diff` is a library and not a CLI tool because tRPC routers are runtime values.

Extracting their schemas requires executing the module that defines them, which in turn requires the correct runtime, module resolver, and loader for your specific project. Rather than bundling a TypeScript loader or importing user code on your behalf, the library exposes the primitives so you can run them in your own runtime context.

## License

[MIT](./LICENSE)
