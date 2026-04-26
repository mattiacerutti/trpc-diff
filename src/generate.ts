import {createSchema} from "zod-openapi";
import {z} from "zod";
import type {IOpenApiDocument, IOpenApiOperation, IProcedure, IRouter} from "./types";

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

  return createSchema(schema, {io, openapiVersion: "3.0.0"}).schema;
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

export function generateContract(router: IRouter): IOpenApiDocument {
  const paths = Object.fromEntries(
    Object.entries(router._def.procedures).map(([procedurePath, procedure]) => [
      toSyntheticPath(procedure._def.type, procedurePath),
      {post: createOperation(procedurePath, procedure._def)},
    ])
  );

  return {
    openapi: "3.0.0",
    info: {
      title: "tRPC Contract Diff",
      version: "1.0.0",
    },
    paths,
  };
}
