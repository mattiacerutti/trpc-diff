import { createSchema } from "zod-openapi";
import { z } from "zod";
import type {
  IOpenApiDocument,
  IOpenApiOperation,
  IProcedure,
  IRouter,
  IProcedureWrapper,
  IOpenApiPathItem,
} from "./types";

function mergeInputs(inputs: z.ZodType[] | undefined) {
  if (!inputs || inputs.length === 0) {
    return null;
  }

  if (inputs.length === 1) {
    return inputs[0]!;
  }

  return inputs.slice(1).reduce<z.ZodType>((merged, input) => z.intersection(merged, input), inputs[0]!);
}

function toSyntheticPath(procedureType: IProcedure["type"], procedurePath: string) {
  return `/${procedureType}/${procedurePath}`;
}

function schemaToOpenApiSchema(schema: z.ZodType, io: "input" | "output") {
  if (schema.def.type === "void") {
    return {};
  }

  return createSchema(schema, { io, openapiVersion: "3.0.0" }).schema;
}

export function createOperation(procedurePath: string, procedure: IProcedure): IOpenApiOperation {
  const inputSchema = mergeInputs(procedure.inputs);
  const requestBodySchema = inputSchema ? schemaToOpenApiSchema(inputSchema, "input") : undefined;

  return {
    operationId: procedurePath,
    requestBody: requestBodySchema
      ? {
          required: true,
          content: {
            "application/json": {
              schema: requestBodySchema,
            },
          },
        }
      : undefined,
    responses: {
      "200": {
        description: "Successful response",
        content: {
          "application/json": {
            schema: procedure.output ? schemaToOpenApiSchema(procedure.output, "output") : {},
          },
        },
      },
    },
  };
}

function isProcedure(value: IRouter | IProcedureWrapper): value is IProcedureWrapper {
  return "type" in value._def;
}

function collectPaths(router: IRouter, prefix: string[] = []): Record<string, IOpenApiPathItem> {
  const paths: Record<string, IOpenApiPathItem> = {};

  for (const [key, value] of Object.entries(router._def.procedures)) {
    if (!isProcedure(value)) {
      Object.assign(paths, collectPaths(value, [...prefix, key]));
      continue;
    }

    const procedurePath = [...prefix, key].join(".");
    const pathKey = toSyntheticPath(value._def.type, [...prefix, key].join("/"));
    paths[pathKey] = { post: createOperation(procedurePath, value._def) };
  }

  return paths;
}

export function generateContract(router: IRouter): IOpenApiDocument {
  return {
    openapi: "3.0.0",
    info: {
      title: "tRPC Contract Diff",
      version: "1.0.0",
    },
    paths: collectPaths(router),
  };
}
