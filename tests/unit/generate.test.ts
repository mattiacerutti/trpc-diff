import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { initTRPC } from "@trpc/server";
import { generateContract } from "@/generate";
import { zodAdapter } from "@/generate/adapters";

const t = initTRPC.create();

describe("operation generation", () => {
  it("builds an operation with input and output", () => {
    const doc = generateContract(
      t.router({
        createUser: t.procedure
          .input(z.object({ name: z.string() }))
          .output(z.object({ id: z.string() }))
          .mutation(() => ({ id: "1" })),
      }),
      [zodAdapter],
    );

    const operation = doc.paths["/mutation/createUser"]!.post;

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
    const doc = generateContract(
      t.router({
        getUsers: t.procedure.output(z.array(z.string())).query(() => ["foo"]),
      }),
      [zodAdapter],
    );

    const operation = doc.paths["/query/getUsers"]!.post;

    expect(operation.operationId).toBe("getUsers");
    expect(operation.requestBody).toBeUndefined();
    expect(operation.responses["200"]!.content!["application/json"]!.schema).toEqual({
      items: { type: "string" },
      type: "array",
    });
  });

  it("builds an operation without output", () => {
    const doc = generateContract(
      t.router({
        deleteUser: t.procedure.input(z.object({ id: z.string() })).mutation(() => undefined),
      }),
      [zodAdapter],
    );

    const operation = doc.paths["/mutation/deleteUser"]!.post;

    expect(operation.operationId).toBe("deleteUser");
    expect(operation.responses["200"]!.content!["application/json"]!.schema).toEqual({});
  });

  it("merges multiple inputs with intersection", () => {
    const doc = generateContract(
      t.router({
        createUser: t.procedure
          .input(z.object({ name: z.string() }))
          .input(z.object({ email: z.string() }))
          .output(z.object({ id: z.string() }))
          .mutation(() => ({ id: "1" })),
      }),
      [zodAdapter],
    );

    const operation = doc.paths["/mutation/createUser"]!.post;

    const requestSchema = operation.requestBody!.content!["application/json"]!.schema;
    expect(requestSchema).toBeDefined();
    expect(requestSchema).toHaveProperty("allOf");
  });

  it("skips and warns when an input adapter is missing and exitOnMissingAdapter is disabled", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const doc = generateContract(
      t.router({
        createUser: t.procedure
          .input(z.object({ name: z.string() }))
          .output(z.object({ id: z.string() }))
          .mutation(() => ({ id: "1" })),
      }),
      [],
      { exitOnMissingAdapter: false },
    );

    const operation = doc.paths["/mutation/createUser"]!.post;

    expect(operation.requestBody).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith("[trpc-diff] No adapter found for input parser.");

    warnSpy.mockRestore();
  });

  it("skips and warns when an output adapter is missing and exitOnMissingAdapter is disabled", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const doc = generateContract(
      t.router({
        createUser: t.procedure.output(z.object({ id: z.string() })).mutation(() => ({ id: "1" })),
      }),
      [],
      { exitOnMissingAdapter: false },
    );

    const operation = doc.paths["/mutation/createUser"]!.post;

    expect(operation.responses["200"]!.content!["application/json"]!.schema).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith("[trpc-diff] No adapter found for output parser.");

    warnSpy.mockRestore();
  });

  it("throws by default when an input adapter is missing", () => {
    expect(() =>
      generateContract(
        t.router({
          createUser: t.procedure
            .input(z.object({ name: z.string() }))
            .output(z.object({ id: z.string() }))
            .mutation(() => ({ id: "1" })),
        }),
        [],
      ),
    ).toThrowError("[trpc-diff] No adapter found for input parser.");
  });

  it("throws by default when an output adapter is missing", () => {
    expect(() =>
      generateContract(
        t.router({
          createUser: t.procedure.output(z.object({ id: z.string() })).mutation(() => ({ id: "1" })),
        }),
        [],
      ),
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

    const doc = generateContract(router, [zodAdapter]);

    expect(doc.openapi).toBe("3.0.0");
    expect(doc.paths).toHaveProperty("/mutation/createUser");
    expect(doc.paths).not.toHaveProperty("/query/createUser");
  });

  it("converts a router with multiple procedures", () => {
    const router = t.router({
      zebra: t.procedure.output(z.string()).query(() => "z"),
      apple: t.procedure.output(z.string()).query(() => "a"),
    });

    const doc = generateContract(router, [zodAdapter]);

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

    const doc = generateContract(router, [zodAdapter]);

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

    const doc = generateContract(router, [zodAdapter]);

    expect(doc.paths).toHaveProperty("/query/getUser");
    expect(doc.paths).toHaveProperty("/query/auth/me");
    expect(doc.paths).toHaveProperty("/mutation/auth/login");
    expect(doc.paths["/query/auth/me"]!.post.operationId).toBe("auth.me");
    expect(doc.paths["/mutation/auth/login"]!.post.operationId).toBe("auth.login");
  });
});
