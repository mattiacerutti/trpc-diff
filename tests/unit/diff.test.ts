import { describe, expect, it } from "vitest";
import { diffContracts } from "@/diff";
import type { IDiffFinding, IOpenApiDocument } from "@/types";

interface ITestSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  enum?: string[];
  minLength?: number;
  items?: unknown;
}

function createDocument(requestSchema: ITestSchema | undefined, responseSchema: ITestSchema): IOpenApiDocument {
  return {
    openapi: "3.0.0",
    info: {
      title: "test",
      version: "1.0.0",
    },
    paths: {
      "/mutation/test": {
        post: {
          operationId: "test.operation",
          requestBody: requestSchema
            ? {
                required: true,
                content: {
                  "application/json": {
                    schema: requestSchema,
                  },
                },
              }
            : undefined,
          responses: {
            "200": {
              description: "Successful response",
              content: {
                "application/json": {
                  schema: responseSchema,
                },
              },
            },
          },
        },
      },
    },
  };
}

const OPTIONAL_BASE_REQUEST_SCHEMA: ITestSchema = {
  type: "object",
  properties: {
    entityId: {
      type: "string",
    },
  },
};

const REQUIRED_BASE_REQUEST_SCHEMA: ITestSchema = {
  ...OPTIONAL_BASE_REQUEST_SCHEMA,
  required: ["entityId"],
};

const BASE_REQUEST_SCHEMA_CASES = [
  ["optional base entityId", OPTIONAL_BASE_REQUEST_SCHEMA],
  ["required base entityId", REQUIRED_BASE_REQUEST_SCHEMA],
] as const;

const BASE_REQUEST_SCHEMA = REQUIRED_BASE_REQUEST_SCHEMA;

const OPTIONAL_BASE_RESPONSE_SCHEMA: ITestSchema = {
  type: "object",
  properties: {
    id: {
      type: "string",
    },
  },
};

const REQUIRED_BASE_RESPONSE_SCHEMA: ITestSchema = {
  ...OPTIONAL_BASE_RESPONSE_SCHEMA,
  required: ["id"],
};

const BASE_RESPONSE_SCHEMA_CASES = [
  ["optional base id", OPTIONAL_BASE_RESPONSE_SCHEMA],
  ["required base id", REQUIRED_BASE_RESPONSE_SCHEMA],
] as const;

const BASE_RESPONSE_SCHEMA = REQUIRED_BASE_RESPONSE_SCHEMA;

describe("diffContracts input compatibility", () => {
  it.each(BASE_REQUEST_SCHEMA_CASES)(
    "keeps optional request property additions compatible (%s)",
    async (_caseName, baseRequestSchema) => {
      const base = createDocument(baseRequestSchema, BASE_RESPONSE_SCHEMA);
      const head = createDocument(
        {
          type: "object",
          properties: {
            entityId: {
              type: "string",
            },
            details: {
              type: "string",
            },
          },
          required: baseRequestSchema.required,
        },
        BASE_RESPONSE_SCHEMA,
      );

      const result = await diffContracts(base, head);

      expect(result.compatible).toBe(true);
      expect(result.findings).toHaveLength(0);
    },
  );

  it.each(BASE_REQUEST_SCHEMA_CASES)(
    "flags required request property additions as breaking (%s)",
    async (_caseName, baseRequestSchema) => {
      const base = createDocument(baseRequestSchema, BASE_RESPONSE_SCHEMA);
      const head = createDocument(
        {
          type: "object",
          properties: {
            entityId: {
              type: "string",
            },
            type: {
              type: "string",
            },
          },
          required: baseRequestSchema.required ? [...baseRequestSchema.required, "type"] : ["type"],
        },
        BASE_RESPONSE_SCHEMA,
      );

      const result = await diffContracts(base, head);

      expect(result.compatible).toBe(false);
      expect(result.findings.some((finding: IDiffFinding) => finding.code === "request.body.scope.remove")).toBe(true);
    },
  );

  it.each(BASE_REQUEST_SCHEMA_CASES)(
    "keeps optional request property removals compatible (%s)",
    async (_caseName, baseRequestSchema) => {
      const base = createDocument(
        {
          type: "object",
          properties: {
            entityId: {
              type: "string",
            },
            details: {
              type: "string",
            },
          },
          required: baseRequestSchema.required,
        },
        BASE_RESPONSE_SCHEMA,
      );
      const head = createDocument(baseRequestSchema, BASE_RESPONSE_SCHEMA);

      const result = await diffContracts(base, head);

      expect(result.compatible).toBe(true);
      expect(result.findings).toHaveLength(0);
    },
  );

  it.each(BASE_REQUEST_SCHEMA_CASES)(
    "keeps required request property removals compatible (%s)",
    async (_caseName, baseRequestSchema) => {
      const base = createDocument(
        {
          type: "object",
          properties: {
            entityId: {
              type: "string",
            },
            type: {
              type: "string",
            },
          },
          required: baseRequestSchema.required ? [...baseRequestSchema.required, "type"] : ["type"],
        },
        BASE_RESPONSE_SCHEMA,
      );
      const head = createDocument(baseRequestSchema, BASE_RESPONSE_SCHEMA);

      const result = await diffContracts(base, head);

      expect(result.compatible).toBe(true);
      expect(result.findings).toHaveLength(0);
    },
  );

  it("flags required request type narrowing as breaking", async () => {
    const base = createDocument(
      {
        type: "object",
        properties: {
          entityId: {
            type: "string",
          },
        },
        required: ["entityId"],
      },
      BASE_RESPONSE_SCHEMA,
    );
    const head = createDocument(
      {
        type: "object",
        properties: {
          entityId: {
            type: "string",
            minLength: 5,
          },
        },
        required: ["entityId"],
      },
      BASE_RESPONSE_SCHEMA,
    );

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(false);
    expect(result.findings.some((finding: IDiffFinding) => finding.code === "request.body.scope.remove")).toBe(true);
  });

  it("keeps required request type widening compatible", async () => {
    const base = createDocument(
      {
        type: "object",
        properties: {
          entityId: {
            type: "string",
            minLength: 5,
          },
        },
        required: ["entityId"],
      },
      BASE_RESPONSE_SCHEMA,
    );
    const head = createDocument(
      {
        type: "object",
        properties: {
          entityId: {
            type: "string",
          },
        },
        required: ["entityId"],
      },
      BASE_RESPONSE_SCHEMA,
    );

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("flags required request primitive type changes as breaking", async () => {
    const base = createDocument(
      {
        type: "object",
        properties: {
          entityId: {
            type: "string",
          },
        },
        required: ["entityId"],
      },
      BASE_RESPONSE_SCHEMA,
    );
    const head = createDocument(
      {
        type: "object",
        properties: {
          entityId: {
            type: "integer",
          },
        },
        required: ["entityId"],
      },
      BASE_RESPONSE_SCHEMA,
    );

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(false);
    expect(result.findings.some((finding: IDiffFinding) => finding.code === "request.body.scope.remove")).toBe(true);
  });

  it("flags optional request properties becoming required as breaking", async () => {
    const base = createDocument(OPTIONAL_BASE_REQUEST_SCHEMA, BASE_RESPONSE_SCHEMA);
    const head = createDocument(
      {
        type: "object",
        properties: {
          entityId: {
            type: "string",
          },
        },
        required: ["entityId"],
      },
      BASE_RESPONSE_SCHEMA,
    );

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(false);
    expect(result.findings.some((finding: IDiffFinding) => finding.code === "request.body.scope.remove")).toBe(true);
  });

  it("keeps required request properties becoming optional compatible", async () => {
    const base = createDocument(
      {
        type: "object",
        properties: {
          entityId: {
            type: "string",
          },
        },
        required: ["entityId"],
      },
      BASE_RESPONSE_SCHEMA,
    );
    const head = createDocument(OPTIONAL_BASE_REQUEST_SCHEMA, BASE_RESPONSE_SCHEMA);

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("keeps request enum value additions compatible", async () => {
    const base = createDocument(
      {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["draft", "published"],
          },
        },
        required: ["status"],
      },
      BASE_RESPONSE_SCHEMA,
    );
    const head = createDocument(
      {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["draft", "published", "archived"],
          },
        },
        required: ["status"],
      },
      BASE_RESPONSE_SCHEMA,
    );

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("flags request enum value removals as breaking", async () => {
    const base = createDocument(
      {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["draft", "published"],
          },
        },
        required: ["status"],
      },
      BASE_RESPONSE_SCHEMA,
    );
    const head = createDocument(
      {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["published"],
          },
        },
        required: ["status"],
      },
      BASE_RESPONSE_SCHEMA,
    );

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(false);
    expect(result.findings.some((finding: IDiffFinding) => finding.code === "request.body.scope.remove")).toBe(true);
  });
});

describe("diffContracts output compatibility", () => {
  it.each(BASE_RESPONSE_SCHEMA_CASES)(
    "keeps output property additions compatible (%s)",
    async (_caseName, baseResponseSchema) => {
      const base = createDocument(BASE_REQUEST_SCHEMA, baseResponseSchema);
      const head = createDocument(BASE_REQUEST_SCHEMA, {
        type: "object",
        properties: {
          id: {
            type: "string",
          },
          name: {
            type: "string",
          },
        },
        required: baseResponseSchema.required,
      });

      const result = await diffContracts(base, head);

      expect(result.compatible).toBe(true);
      expect(result.findings).toHaveLength(0);
    },
  );

  it.each(BASE_RESPONSE_SCHEMA_CASES)(
    "keeps required output property additions compatible (%s)",
    async (_caseName, baseResponseSchema) => {
      const base = createDocument(BASE_REQUEST_SCHEMA, baseResponseSchema);
      const head = createDocument(BASE_REQUEST_SCHEMA, {
        type: "object",
        properties: {
          id: {
            type: "string",
          },
          name: {
            type: "string",
          },
        },
        required: baseResponseSchema.required ? [...baseResponseSchema.required, "name"] : ["name"],
      });

      const result = await diffContracts(base, head);

      expect(result.compatible).toBe(true);
      expect(result.findings).toHaveLength(0);
    },
  );

  it.each(BASE_RESPONSE_SCHEMA_CASES)(
    "flags required output property removals as breaking (%s)",
    async (_caseName, baseResponseSchema) => {
      const base = createDocument(BASE_REQUEST_SCHEMA, {
        type: "object",
        properties: {
          id: {
            type: "string",
          },
          name: {
            type: "string",
          },
        },
        required: baseResponseSchema.required ? [...baseResponseSchema.required, "name"] : ["name"],
      });
      const head = createDocument(BASE_REQUEST_SCHEMA, baseResponseSchema);

      const result = await diffContracts(base, head);

      expect(result.compatible).toBe(false);
      expect(result.findings.some((finding: IDiffFinding) => finding.code === "response.body.scope.add")).toBe(true);
    },
  );

  it.each(BASE_RESPONSE_SCHEMA_CASES)(
    "flags optional output property removals as breaking (%s)",
    async (_caseName, baseResponseSchema) => {
      const base = createDocument(BASE_REQUEST_SCHEMA, {
        type: "object",
        properties: {
          id: {
            type: "string",
          },
          name: {
            type: "string",
          },
        },
        required: baseResponseSchema.required,
      });
      const head = createDocument(BASE_REQUEST_SCHEMA, baseResponseSchema);

      const result = await diffContracts(base, head);

      expect(result.compatible).toBe(false);
      expect(result.findings.some((finding: IDiffFinding) => finding.code === "response.body.scope.add")).toBe(true);
    },
  );

  it("flags required output type widening as breaking", async () => {
    const base = createDocument(BASE_REQUEST_SCHEMA, {
      type: "object",
      properties: {
        id: {
          type: "string",
          minLength: 5,
        },
      },
      required: ["id"],
    });
    const head = createDocument(BASE_REQUEST_SCHEMA, BASE_RESPONSE_SCHEMA);

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(false);
    expect(result.findings.some((finding: IDiffFinding) => finding.code === "response.body.scope.add")).toBe(true);
  });

  it("keeps required output type narrowing compatible", async () => {
    const base = createDocument(BASE_REQUEST_SCHEMA, BASE_RESPONSE_SCHEMA);
    const head = createDocument(BASE_REQUEST_SCHEMA, {
      type: "object",
      properties: {
        id: {
          type: "string",
          minLength: 5,
        },
      },
      required: ["id"],
    });

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("flags required output primitive type changes as breaking", async () => {
    const base = createDocument(BASE_REQUEST_SCHEMA, BASE_RESPONSE_SCHEMA);
    const head = createDocument(BASE_REQUEST_SCHEMA, {
      type: "object",
      properties: {
        id: {
          type: "integer",
        },
      },
      required: ["id"],
    });

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(false);
    expect(result.findings.some((finding: IDiffFinding) => finding.code === "response.body.scope.add")).toBe(true);
  });

  it("flags required output becoming optional as breaking", async () => {
    const base = createDocument(BASE_REQUEST_SCHEMA, BASE_RESPONSE_SCHEMA);
    const head = createDocument(BASE_REQUEST_SCHEMA, {
      type: "object",
      properties: {
        id: {
          type: "string",
        },
      },
    });

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(false);
    expect(result.findings.some((finding: IDiffFinding) => finding.code === "response.body.scope.add")).toBe(true);
  });

  it("keeps optional output properties becoming required compatible", async () => {
    const base = createDocument(BASE_REQUEST_SCHEMA, {
      type: "object",
      properties: {
        id: {
          type: "string",
        },
      },
    });
    const head = createDocument(BASE_REQUEST_SCHEMA, BASE_RESPONSE_SCHEMA);

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("flags output enum value additions as breaking", async () => {
    const base = createDocument(BASE_REQUEST_SCHEMA, {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["draft", "published"],
        },
      },
      required: ["status"],
    });
    const head = createDocument(BASE_REQUEST_SCHEMA, {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["draft", "published", "archived"],
        },
      },
      required: ["status"],
    });

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(false);
    expect(result.findings.some((finding: IDiffFinding) => finding.code === "response.body.scope.add")).toBe(true);
  });

  it("keeps output enum value removals compatible", async () => {
    const base = createDocument(BASE_REQUEST_SCHEMA, {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["draft", "published"],
        },
      },
      required: ["status"],
    });
    const head = createDocument(BASE_REQUEST_SCHEMA, {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["published"],
        },
      },
      required: ["status"],
    });

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(true);
    expect(result.findings).toHaveLength(0);
  });
});

describe("diffContracts severity levels", () => {
  it("uses defaults that treat request property removal as compatible", async () => {
    const base = createDocument(
      {
        type: "object",
        properties: {
          entityId: { type: "string" },
          details: { type: "string" },
        },
        required: ["entityId", "details"],
      },
      { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    );
    const head = createDocument(
      {
        type: "object",
        properties: {
          entityId: { type: "string" },
        },
        required: ["entityId"],
      },
      { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    );

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("allows overriding defaults via options", async () => {
    const base = createDocument(
      {
        type: "object",
        properties: {
          entityId: { type: "string" },
          details: { type: "string" },
        },
        required: ["entityId", "details"],
      },
      { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    );
    const head = createDocument(
      {
        type: "object",
        properties: {
          entityId: { type: "string" },
        },
        required: ["entityId"],
      },
      { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    );

    const result = await diffContracts(base, head, {
      severityLevels: { "request-property-removed": "err" },
    });

    expect(result.compatible).toBe(false);
    expect(result.findings.some((finding: IDiffFinding) => finding.code === "request.body.scope.remove")).toBe(true);
  });
});
