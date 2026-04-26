import type {z} from "zod";

export interface IProcedureDef {
  type: "query" | "mutation" | "subscription";
  inputs?: z.ZodType[];
  output?: z.ZodType;
}

export interface IRouterLike {
  _def: {
    procedures: Record<string, {_def: IProcedureDef}>;
  };
}

export interface ITrpcContractConfig {
  router: IRouterLike;
  severityLevels?: Record<string, string>;
}

interface IOpenApiResponse {
  description: string;
  content?: Record<string, {schema?: unknown}>;
}

export interface IOpenApiOperation {
  operationId: string;
  requestBody?: {
    required: boolean;
    content: Record<string, {schema?: unknown}>;
  };
  responses: Record<string, IOpenApiResponse>;
}

interface IOpenApiPathItem {
  post: IOpenApiOperation;
}

export interface IOpenApiDocument {
  openapi: "3.0.0";
  info: {
    title: string;
    version: "1.0.0";
  };
  paths: Record<string, IOpenApiPathItem>;
}

export interface IDiffFinding {
  action: string;
  code: string;
  destinationSpecEntityDetails?: Array<{
    location?: string;
    value?: unknown;
  }>;
  entity: string;
  sourceSpecEntityDetails?: Array<{
    location?: string;
    value?: unknown;
  }>;
}

export interface IDiffResult {
  compatible: boolean;
  findings: IDiffFinding[];
}
