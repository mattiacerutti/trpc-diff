import type { AnyProcedure, AnyRouter } from "@trpc/server";
import type { IOpenApiDocument, IOpenApiOperation, IOpenApiPathItem, ParserOpenApiAdapter } from "./types";

interface RuntimeProcedureDef {
  type: "query" | "mutation" | "subscription";
  procedure: true;
  inputs: unknown[];
  output?: unknown;
}

type RuntimeProcedure = AnyProcedure & { _def: RuntimeProcedureDef };

function findAdapter(value: unknown, adapters: ParserOpenApiAdapter[]) {
  return adapters.find((a) => a.isParser(value));
}

function mergeOpenApiSchemas(schemas: unknown[]): unknown {
  if (schemas.length === 0) {
    return {};
  }
  if (schemas.length === 1) {
    return schemas[0]!;
  }
  return { allOf: schemas };
}

function buildInputSchema(inputs: unknown[], adapters: ParserOpenApiAdapter[]): unknown | undefined {
  if (inputs.length === 0) {
    return undefined;
  }

  const groups = new Map<ParserOpenApiAdapter, unknown[]>();

  for (const input of inputs) {
    const adapter = adapters.find((a) => a.isParser(input));
    if (!adapter) {
      console.warn("[trpc-diff] No adapter found for input parser, skipping.");
      continue;
    }
    if (!groups.has(adapter)) {
      groups.set(adapter, []);
    }
    groups.get(adapter)!.push(input);
  }

  const schemas: unknown[] = [];
  for (const [adapter, group] of groups) {
    const merged = adapter.mergeInputs(group as never[]);
    if (merged) {
      schemas.push(adapter.toSchema(merged, "input"));
    }
  }

  if (schemas.length === 0) {
    return undefined;
  }

  return mergeOpenApiSchemas(schemas);
}

function buildOutputSchema(output: unknown, adapters: ParserOpenApiAdapter[]): unknown | undefined {
  if (output === undefined) {
    return undefined;
  }

  const adapter = findAdapter(output, adapters);
  if (!adapter) {
    console.warn("[trpc-diff] No adapter found for output parser, skipping.");
    return undefined;
  }
  return adapter.toSchema(output, "output");
}

function toSyntheticPath(procedureType: RuntimeProcedureDef["type"], procedurePath: string) {
  return `/${procedureType}/${procedurePath.replace(/\./g, "/")}`;
}

export function createOperation(
  procedurePath: string,
  procedure: RuntimeProcedure,
  adapters: ParserOpenApiAdapter[],
): IOpenApiOperation {
  const def = procedure._def;
  const inputSchema = buildInputSchema(def.inputs, adapters);
  const outputSchema = buildOutputSchema(def.output, adapters) || {};

  return {
    operationId: procedurePath,
    requestBody: inputSchema
      ? {
          required: true,
          content: {
            "application/json": {
              schema: inputSchema,
            },
          },
        }
      : undefined,
    responses: {
      "200": {
        description: "Successful response",
        content: {
          "application/json": {
            schema: outputSchema,
          },
        },
      },
    },
  };
}

function isProcedure(value: unknown): value is RuntimeProcedure {
  if (typeof value !== "function") {
    return false;
  }

  const def = (value as { _def?: unknown })._def;
  if (typeof def !== "object" || def === null) {
    return false;
  }

  const procedureDef = def as Partial<RuntimeProcedureDef>;

  return (
    procedureDef.procedure === true &&
    Array.isArray(procedureDef.inputs) &&
    (procedureDef.type === "query" || procedureDef.type === "mutation" || procedureDef.type === "subscription")
  );
}

function collectPaths(router: AnyRouter, adapters: ParserOpenApiAdapter[]): Record<string, IOpenApiPathItem> {
  const paths: Record<string, IOpenApiPathItem> = {};

  for (const [procedurePath, value] of Object.entries(router._def.procedures)) {
    if (!isProcedure(value)) {
      console.warn(`[trpc-diff] Invalid procedure at path \`${procedurePath}\`, skipping.`);
      continue;
    }

    const pathKey = toSyntheticPath(value._def.type, procedurePath);
    paths[pathKey] = {
      post: createOperation(procedurePath, value, adapters),
    };
  }

  return paths;
}

export function generateContract(router: AnyRouter, adapters: ParserOpenApiAdapter[]): IOpenApiDocument {
  return {
    openapi: "3.0.0",
    info: {
      title: "tRPC Contract Diff",
      version: "1.0.0",
    },
    paths: collectPaths(router, adapters),
  };
}
