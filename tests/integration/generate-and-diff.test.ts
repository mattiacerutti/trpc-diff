import { describe, expect, it } from "vitest";
import { z } from "zod";
import { diffContracts, generateContract, zodOpenApiAdapter } from "@/index";
import type { IDiffFinding } from "@/types";

async function createTrpc() {
  const { initTRPC } = await import("@trpc/server");
  return initTRPC.create();
}

describe("generate and diff integration", () => {
  it("detects compatible change when adding optional request field", async () => {
    const t = await createTrpc();

    const base = generateContract(
      t.router({
        createUser: t.procedure
          .input(z.object({ name: z.string() }))
          .output(z.object({ id: z.string() }))
          .mutation(() => ({ id: "1" })),
      }),
      [zodOpenApiAdapter],
    );

    const head = generateContract(
      t.router({
        createUser: t.procedure
          .input(z.object({ name: z.string(), email: z.string().optional() }))
          .output(z.object({ id: z.string() }))
          .mutation(() => ({ id: "1" })),
      }),
      [zodOpenApiAdapter],
    );

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("detects breaking change when adding required request field", async () => {
    const t = await createTrpc();

    const base = generateContract(
      t.router({
        createUser: t.procedure
          .input(z.object({ name: z.string() }))
          .output(z.object({ id: z.string() }))
          .mutation(() => ({ id: "1" })),
      }),
      [zodOpenApiAdapter],
    );

    const head = generateContract(
      t.router({
        createUser: t.procedure
          .input(z.object({ name: z.string(), email: z.string() }))
          .output(z.object({ id: z.string() }))
          .mutation(() => ({ id: "1" })),
      }),
      [zodOpenApiAdapter],
    );

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(false);
    expect(result.findings.some((f: IDiffFinding) => f.code === "request.body.scope.remove")).toBe(true);
  });

  it("detects compatible change when adding response field", async () => {
    const t = await createTrpc();

    const base = generateContract(
      t.router({
        getUser: t.procedure
          .input(z.object({ id: z.string() }))
          .output(z.object({ name: z.string() }))
          .query(() => ({ name: "Alice" })),
      }),
      [zodOpenApiAdapter],
    );

    const head = generateContract(
      t.router({
        getUser: t.procedure
          .input(z.object({ id: z.string() }))
          .output(z.object({ name: z.string(), email: z.string() }))
          .query(() => ({ name: "Alice", email: "a@example.com" })),
      }),
      [zodOpenApiAdapter],
    );

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("detects breaking change when removing required response field", async () => {
    const t = await createTrpc();

    const base = generateContract(
      t.router({
        getUser: t.procedure
          .input(z.object({ id: z.string() }))
          .output(z.object({ name: z.string(), email: z.string() }))
          .query(() => ({ name: "Alice", email: "a@example.com" })),
      }),
      [zodOpenApiAdapter],
    );

    const head = generateContract(
      t.router({
        getUser: t.procedure
          .input(z.object({ id: z.string() }))
          .output(z.object({ name: z.string() }))
          .query(() => ({ name: "Alice" })),
      }),
      [zodOpenApiAdapter],
    );

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(false);
    expect(result.findings.some((f: IDiffFinding) => f.code === "response.body.scope.add")).toBe(true);
  });

  it("detects breaking change when removing request enum value", async () => {
    const t = await createTrpc();

    const base = generateContract(
      t.router({
        updateStatus: t.procedure
          .input(z.object({ status: z.enum(["draft", "published"]) }))
          .output(z.object({ id: z.string() }))
          .mutation(() => ({ id: "1" })),
      }),
      [zodOpenApiAdapter],
    );

    const head = generateContract(
      t.router({
        updateStatus: t.procedure
          .input(z.object({ status: z.enum(["published"]) }))
          .output(z.object({ id: z.string() }))
          .mutation(() => ({ id: "1" })),
      }),
      [zodOpenApiAdapter],
    );

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(false);
    expect(result.findings.some((f: IDiffFinding) => f.code === "request.body.scope.remove")).toBe(true);
  });

  it("detects breaking change when adding response enum value", async () => {
    const t = await createTrpc();

    const base = generateContract(
      t.router({
        getStatus: t.procedure
          .input(z.object({ id: z.string() }))
          .output(z.object({ status: z.enum(["draft", "published"]) }))
          .query(() => ({ status: "published" as const })),
      }),
      [zodOpenApiAdapter],
    );

    const head = generateContract(
      t.router({
        getStatus: t.procedure
          .input(z.object({ id: z.string() }))
          .output(z.object({ status: z.enum(["draft", "published", "archived"]) }))
          .query(() => ({ status: "published" as const })),
      }),
      [zodOpenApiAdapter],
    );

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(false);
    expect(result.findings.some((f: IDiffFinding) => f.code === "response.body.scope.add")).toBe(true);
  });

  it("detects compatible change when narrowing response type", async () => {
    const t = await createTrpc();

    const base = generateContract(
      t.router({
        getUser: t.procedure
          .input(z.object({ id: z.string() }))
          .output(z.object({ name: z.string(), age: z.number() }))
          .query(() => ({ name: "Alice", age: 30 })),
      }),
      [zodOpenApiAdapter],
    );

    const head = generateContract(
      t.router({
        getUser: t.procedure
          .input(z.object({ id: z.string() }))
          .output(z.object({ name: z.string(), age: z.number().int().min(0).max(120) }))
          .query(() => ({ name: "Alice", age: 30 })),
      }),
      [zodOpenApiAdapter],
    );

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("detects breaking change when widening response type", async () => {
    const t = await createTrpc();

    const base = generateContract(
      t.router({
        getUser: t.procedure
          .input(z.object({ id: z.string() }))
          .output(z.object({ name: z.string(), age: z.number().int().min(0).max(120) }))
          .query(() => ({ name: "Alice", age: 30 })),
      }),
      [zodOpenApiAdapter],
    );

    const head = generateContract(
      t.router({
        getUser: t.procedure
          .input(z.object({ id: z.string() }))
          .output(z.object({ name: z.string(), age: z.number() }))
          .query(() => ({ name: "Alice", age: 30 })),
      }),
      [zodOpenApiAdapter],
    );

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(false);
    expect(result.findings.some((f: IDiffFinding) => f.code === "response.body.scope.add")).toBe(true);
  });

  it("detects breaking change when removing a nested procedure", async () => {
    const t = await createTrpc();

    const base = generateContract(
      t.router({
        auth: t.router({
          me: t.procedure.output(z.object({ id: z.string() })).query(() => ({ id: "1" })),
        }),
      }),
      [zodOpenApiAdapter],
    );

    const head = generateContract(
      t.router({
        auth: t.router({}),
      }),
      [zodOpenApiAdapter],
    );

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(false);
  });

});
