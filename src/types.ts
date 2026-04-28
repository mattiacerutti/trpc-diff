export interface IDiffContractsOptions {
  severityLevels?: Record<string, string>;
}

export interface IGenerateContractOptions {
  exitOnMissingAdapter?: boolean;
}

interface IOpenApiResponse {
  description: string;
  content?: Record<string, { schema?: unknown }>;
}

export interface IOpenApiOperation {
  operationId: string;
  requestBody?: {
    required: boolean;
    content: Record<string, { schema?: unknown }>;
  };
  responses: Record<string, IOpenApiResponse>;
}

export interface IOpenApiPathItem {
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
