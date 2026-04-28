import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { initTRPC } from "@trpc/server";
import { createOperation, generateContract } from "@/generate";
import { zodOpenApiAdapter } from "@/index";

const t = initTRPC.create();

describe("createOperation", () => {
  it("builds an operation with input and output", () => {
    const procedure = t.procedure
      .input(z.object({ name: z.string() }))
      .output(z.object({ id: z.string() }))
      .mutation(() => ({ id: "1" }));

    const operation = createOperation("createUser", procedure, [zodOpenApiAdapter]);

    expect(operation.operationId).toBe("createUser");
    expect(operation.requestBody).toBeDefined();
    expect(operation.requestBody!.required).toBe(true);
    expect(operation.requestBody!.content!["application/json"]!.schema).toEqual({
      properties: { name: { type: "string" } },
      required: ["name"],
      type: "object",
    });
    expect(operation.responses["200"]!.content!["application/json"]!.schema).toEqual({
      additionalProperties: false,
      properties: { id: { type: "string" } },
      required: ["id"],
      type: "object",
    });
  });

  it("builds an operation without input", () => {
    const procedure = t.procedure.output(z.array(z.string())).query(() => ["foo"]);

    const operation = createOperation("getUsers", procedure, [zodOpenApiAdapter]);

    expect(operation.operationId).toBe("getUsers");
    expect(operation.requestBody).toBeUndefined();
    expect(operation.responses["200"]!.content!["application/json"]!.schema).toEqual({
      items: { type: "string" },
      type: "array",
    });
  });

  it("builds an operation without output", () => {
    const procedure = t.procedure.input(z.object({ id: z.string() })).mutation(() => undefined);

    const operation = createOperation("deleteUser", procedure, [zodOpenApiAdapter]);

    expect(operation.operationId).toBe("deleteUser");
    expect(operation.responses["200"]!.content!["application/json"]!.schema).toEqual({});
  });

  it("merges multiple inputs with intersection", () => {
    const procedure = t.procedure
      .input(z.object({ name: z.string() }))
      .input(z.object({ email: z.string() }))
      .output(z.object({ id: z.string() }))
      .mutation(() => ({ id: "1" }));

    const operation = createOperation("createUser", procedure, [zodOpenApiAdapter]);

    const requestSchema = operation.requestBody!.content!["application/json"]!.schema;
    expect(requestSchema).toBeDefined();
    expect(requestSchema).toHaveProperty("allOf");
  });

  it("skips and warns when an input adapter is missing by default", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const procedure = t.procedure
      .input(z.object({ name: z.string() }))
      .output(z.object({ id: z.string() }))
      .mutation(() => ({ id: "1" }));

    const operation = createOperation("createUser", procedure, []);

    expect(operation.requestBody).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith("[trpc-diff] No adapter found for input parser.");

    warnSpy.mockRestore();
  });

  it("skips and warns when an output adapter is missing by default", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const procedure = t.procedure.output(z.object({ id: z.string() })).mutation(() => ({ id: "1" }));

    const operation = createOperation("createUser", procedure, []);

    expect(operation.responses["200"]!.content!["application/json"]!.schema).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith("[trpc-diff] No adapter found for output parser.");

    warnSpy.mockRestore();
  });

  it("throws when an input adapter is missing and exitOnMissingAdapter is enabled", () => {
    const procedure = t.procedure
      .input(z.object({ name: z.string() }))
      .output(z.object({ id: z.string() }))
      .mutation(() => ({ id: "1" }));

    expect(() =>
      createOperation("createUser", procedure, [], {
        exitOnMissingAdapter: true,
      }),
    ).toThrowError("[trpc-diff] No adapter found for input parser.");
  });

  it("throws when an output adapter is missing and exitOnMissingAdapter is enabled", () => {
    const procedure = t.procedure.output(z.object({ id: z.string() })).mutation(() => ({ id: "1" }));

    expect(() =>
      createOperation("createUser", procedure, [], {
        exitOnMissingAdapter: true,
      }),
    ).toThrowError("[trpc-diff] No adapter found for output parser.");
  });
});

describe("generateContract", () => {
  it("converts a router with one procedure", () => {
    const router = t.router({
      createUser: t.procedure
        .input(z.object({ name: z.string() }))
        .output(z.object({ id: z.string() }))
        .mutation(() => ({ id: "1" })),
    });

    const doc = generateContract(router, [zodOpenApiAdapter]);

    expect(doc.openapi).toBe("3.0.0");
    expect(doc.paths).toHaveProperty("/mutation/createUser");
    expect(doc.paths).not.toHaveProperty("/query/createUser");
  });

  it("converts a router with mixed procedure types", () => {
    const router = t.router({
      getUser: t.procedure
        .input(z.object({ id: z.string() }))
        .output(z.object({ name: z.string() }))
        .query(() => ({ name: "Alice" })),
      createUser: t.procedure
        .input(z.object({ name: z.string() }))
        .output(z.object({ id: z.string() }))
        .mutation(() => ({ id: "1" })),
    });

    const doc = generateContract(router, [zodOpenApiAdapter]);

    expect(doc.paths).toHaveProperty("/query/getUser");
    expect(doc.paths).toHaveProperty("/mutation/createUser");
  });

  it("converts a router with multiple procedures", () => {
    const router = t.router({
      zebra: t.procedure.output(z.string()).query(() => "z"),
      apple: t.procedure.output(z.string()).query(() => "a"),
    });

    const doc = generateContract(router, [zodOpenApiAdapter]);

    expect(Object.keys(doc.paths)).toHaveLength(2);
    expect(doc.paths).toHaveProperty("/query/zebra");
    expect(doc.paths).toHaveProperty("/query/apple");
  });

  it("converts a subscription procedure", () => {
    const router = t.router({
      onEvent: t.procedure.subscription(async function* () {
        yield "event";
      }),
    });

    const doc = generateContract(router, [zodOpenApiAdapter]);

    expect(doc.paths).toHaveProperty("/subscription/onEvent");
  });

  it("converts nested routers", () => {
    const authRouter = t.router({
      me: t.procedure.output(z.object({ id: z.string() })).query(() => ({ id: "1" })),
      login: t.procedure
        .input(z.object({ email: z.string(), password: z.string() }))
        .output(z.object({ token: z.string() }))
        .mutation(() => ({ token: "abc" })),
    });

    const router = t.router({
      getUser: t.procedure
        .input(z.object({ id: z.string() }))
        .output(z.object({ name: z.string() }))
        .query(() => ({ name: "Alice" })),
      auth: authRouter,
    });

    const doc = generateContract(router, [zodOpenApiAdapter]);

    expect(doc.paths).toHaveProperty("/query/getUser");
    expect(doc.paths).toHaveProperty("/query/auth/me");
    expect(doc.paths).toHaveProperty("/mutation/auth/login");
    expect(doc.paths["/query/auth/me"]!.post.operationId).toBe("auth.me");
    expect(doc.paths["/mutation/auth/login"]!.post.operationId).toBe("auth.login");
  });
});
