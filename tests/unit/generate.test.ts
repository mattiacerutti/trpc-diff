import {describe, expect, it} from "vitest";
import {z} from "zod";
import {createOperation, generateContract} from "@/generate";

describe("createOperation", () => {
  it("builds an operation with input and output", () => {
    const operation = createOperation("createUser", {
      type: "mutation",
      inputs: [z.object({name: z.string()})],
      output: z.object({id: z.string()}),
    });

    expect(operation.operationId).toBe("createUser");
    expect(operation.requestBody).toBeDefined();
    expect(operation.requestBody!.required).toBe(true);
    expect(operation.requestBody!.content!["application/json"]!.schema).toEqual({
      properties: {name: {type: "string"}},
      required: ["name"],
      type: "object",
    });
    expect(operation.responses["200"]!.content!["application/json"]!.schema).toEqual({
      additionalProperties: false,
      properties: {id: {type: "string"}},
      required: ["id"],
      type: "object",
    });
  });

  it("builds an operation without input", () => {
    const operation = createOperation("getUsers", {
      type: "query",
      output: z.array(z.string()),
    });

    expect(operation.operationId).toBe("getUsers");
    expect(operation.requestBody).toBeUndefined();
    expect(operation.responses["200"]!.content!["application/json"]!.schema).toEqual({
      items: {type: "string"},
      type: "array",
    });
  });

  it("builds an operation without output", () => {
    const operation = createOperation("deleteUser", {
      type: "mutation",
      inputs: [z.object({id: z.string()})],
    });

    expect(operation.operationId).toBe("deleteUser");
    expect(operation.responses["200"]!.content!["application/json"]!.schema).toEqual({});
  });

  it("merges multiple inputs with intersection", () => {
    const operation = createOperation("createUser", {
      type: "mutation",
      inputs: [z.object({name: z.string()}), z.object({email: z.string()})],
      output: z.object({id: z.string()}),
    });

    const requestSchema = operation.requestBody!.content!["application/json"]!.schema;
    expect(requestSchema).toBeDefined();
    expect(requestSchema).toHaveProperty("allOf");
  });
});

describe("routerToOpenApiDocument", () => {
  it("converts a router with one procedure", () => {
    const doc = generateContract({
      _def: {
        procedures: {
          createUser: {
            _def: {
              type: "mutation",
              inputs: [z.object({name: z.string()})],
              output: z.object({id: z.string()}),
            },
          },
        },
      },
    });

    expect(doc.openapi).toBe("3.0.0");
    expect(doc.paths).toHaveProperty("/mutation/createUser");
    expect(doc.paths).not.toHaveProperty("/query/createUser");
  });

  it("converts a router with mixed procedure types", () => {
    const doc = generateContract({
      _def: {
        procedures: {
          getUser: {
            _def: {
              type: "query",
              inputs: [z.object({id: z.string()})],
              output: z.object({name: z.string()}),
            },
          },
          createUser: {
            _def: {
              type: "mutation",
              inputs: [z.object({name: z.string()})],
              output: z.object({id: z.string()}),
            },
          },
        },
      },
    });

    expect(doc.paths).toHaveProperty("/query/getUser");
    expect(doc.paths).toHaveProperty("/mutation/createUser");
  });

  it("converts a router with multiple procedures", () => {
    const doc = generateContract({
      _def: {
        procedures: {
          zebra: {
            _def: {
              type: "query",
              output: z.string(),
            },
          },
          apple: {
            _def: {
              type: "query",
              output: z.string(),
            },
          },
        },
      },
    });

    expect(Object.keys(doc.paths)).toHaveLength(2);
    expect(doc.paths).toHaveProperty("/query/zebra");
    expect(doc.paths).toHaveProperty("/query/apple");
  });

  it("converts a subscription procedure", () => {
    const doc = generateContract({
      _def: {
        procedures: {
          onEvent: {
            _def: {
              type: "subscription",
              output: z.string(),
            },
          },
        },
      },
    });

    expect(doc.paths).toHaveProperty("/subscription/onEvent");
  });

  it("converts nested routers", () => {
    const doc = generateContract({
      _def: {
        procedures: {
          getUser: {
            _def: {
              type: "query",
              inputs: [z.object({id: z.string()})],
              output: z.object({name: z.string()}),
            },
          },
          auth: {
            _def: {
              procedures: {
                me: {
                  _def: {
                    type: "query",
                    output: z.object({id: z.string()}),
                  },
                },
                login: {
                  _def: {
                    type: "mutation",
                    inputs: [z.object({email: z.string(), password: z.string()})],
                    output: z.object({token: z.string()}),
                  },
                },
              },
            },
          },
        },
      },
    });

    expect(doc.paths).toHaveProperty("/query/getUser");
    expect(doc.paths).toHaveProperty("/query/auth/me");
    expect(doc.paths).toHaveProperty("/mutation/auth/login");
    expect(doc.paths["/query/auth/me"]!.post.operationId).toBe("auth.me");
    expect(doc.paths["/mutation/auth/login"]!.post.operationId).toBe("auth.login");
  });
});
