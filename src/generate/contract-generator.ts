import type { AnyProcedure, AnyRouter } from "@trpc/server";
import type { IGenerateContractOptions, IOpenApiDocument, IOpenApiOperation, IOpenApiPathItem } from "@/types";
import { IParserAdapter } from "@/generate/adapters";

interface RuntimeProcedureDef {
  type: "query" | "mutation" | "subscription";
  procedure: true;
  inputs: unknown[];
  output?: unknown;
}

type RuntimeProcedure = AnyProcedure & { _def: RuntimeProcedureDef };

export class ContractGenerator {
  private readonly options: Required<IGenerateContractOptions>;
  private readonly adapters: IParserAdapter[];

  public constructor(adapters: IParserAdapter[], options: IGenerateContractOptions) {
    this.adapters = adapters;
    this.options = {
      exitOnMissingAdapter: options.exitOnMissingAdapter ?? true,
    };
  }

  public generate(router: AnyRouter): IOpenApiDocument {
    return {
      openapi: "3.0.0",
      info: {
        title: "tRPC Contract Diff",
        version: "1.0.0",
      },
      paths: this.collectPaths(router),
    };
  }

  private collectPaths(router: AnyRouter): Record<string, IOpenApiPathItem> {
    const paths: Record<string, IOpenApiPathItem> = {};

    const toSyntheticPath = (procedureType: RuntimeProcedureDef["type"], procedurePath: string) => {
      return `/${procedureType}/${procedurePath.replace(/\./g, "/")}`;
    };

    for (const [procedurePath, value] of Object.entries(router._def.procedures)) {
      if (!this._isProcedure(value)) {
        console.warn(`[trpc-diff] Invalid procedure at path \`${procedurePath}\`, skipping.`);
        continue;
      }

      const pathKey = toSyntheticPath(value._def.type, procedurePath);
      paths[pathKey] = {
        post: this.createOperation(procedurePath, value),
      };
    }

    return paths;
  }

  private createOperation(procedurePath: string, procedure: RuntimeProcedure): IOpenApiOperation {
    const def = procedure._def;
    const inputSchema = this.buildInputSchema(def.inputs);
    const outputSchema = this.buildOutputSchema(def.output) || {};

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

  private buildInputSchema(inputs: unknown[]): unknown | undefined {
    if (inputs.length === 0) {
      return undefined;
    }

    const groups = new Map<IParserAdapter, unknown[]>();

    for (const input of inputs) {
      const adapter = this.adapters.find((a) => a.isParser(input));
      if (!adapter) {
        this._handleMissingAdapter("input");
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

    return this._mergeOpenApiSchemas(schemas);
  }

  private buildOutputSchema(output: unknown): unknown | undefined {
    if (output === undefined) {
      return undefined;
    }

    const adapter = this.adapters.find((a) => a.isParser(output));
    if (!adapter) {
      this._handleMissingAdapter("output");
      return undefined;
    }
    return adapter.toSchema(output, "output");
  }

  private _isProcedure(value: unknown): value is RuntimeProcedure {
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

  private _mergeOpenApiSchemas(schemas: unknown[]): unknown {
    if (schemas.length === 0) {
      return {};
    }
    if (schemas.length === 1) {
      return schemas[0]!;
    }
    return { allOf: schemas };
  }

  private _handleMissingAdapter(kind: "input" | "output") {
    const message = `[trpc-diff] No adapter found for ${kind} parser.`;

    if (this.options.exitOnMissingAdapter) {
      throw new Error(message);
    }

    console.warn(message);
  }
}
