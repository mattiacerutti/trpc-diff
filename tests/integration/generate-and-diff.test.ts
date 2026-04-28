import {describe, expect, it} from "vitest";
import {z} from "zod";
import {diffContracts} from "@/diff";
import {generateContract} from "@/generate";
import type {IDiffFinding} from "@/types";
import {mutation, query, router} from "./helpers";

describe("generate and diff integration", () => {
  it("detects compatible change when adding optional request field", async () => {
    const base = generateContract(
      router({
        createUser: mutation(z.object({name: z.string()}), z.object({id: z.string()})),
      })
    );

    const head = generateContract(
      router({
        createUser: mutation(z.object({name: z.string(), email: z.string().optional()}), z.object({id: z.string()})),
      })
    );

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("detects breaking change when adding required request field", async () => {
    const base = generateContract(
      router({
        createUser: mutation(z.object({name: z.string()}), z.object({id: z.string()})),
      })
    );

    const head = generateContract(
      router({
        createUser: mutation(z.object({name: z.string(), email: z.string()}), z.object({id: z.string()})),
      })
    );

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(false);
    expect(result.findings.some((f: IDiffFinding) => f.code === "request.body.scope.remove")).toBe(true);
  });

  it("detects compatible change when adding response field", async () => {
    const base = generateContract(
      router({
        getUser: query(z.object({id: z.string()}), z.object({name: z.string()})),
      })
    );

    const head = generateContract(
      router({
        getUser: query(z.object({id: z.string()}), z.object({name: z.string(), email: z.string()})),
      })
    );

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("detects breaking change when removing required response field", async () => {
    const base = generateContract(
      router({
        getUser: query(z.object({id: z.string()}), z.object({name: z.string(), email: z.string()})),
      })
    );

    const head = generateContract(
      router({
        getUser: query(z.object({id: z.string()}), z.object({name: z.string()})),
      })
    );

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(false);
    expect(result.findings.some((f: IDiffFinding) => f.code === "response.body.scope.add")).toBe(true);
  });

  it("detects breaking change when removing request enum value", async () => {
    const base = generateContract(
      router({
        updateStatus: mutation(z.object({status: z.enum(["draft", "published"])}), z.object({id: z.string()})),
      })
    );

    const head = generateContract(
      router({
        updateStatus: mutation(z.object({status: z.enum(["published"])}), z.object({id: z.string()})),
      })
    );

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(false);
    expect(result.findings.some((f: IDiffFinding) => f.code === "request.body.scope.remove")).toBe(true);
  });

  it("detects breaking change when adding response enum value", async () => {
    const base = generateContract(
      router({
        getStatus: query(z.object({id: z.string()}), z.object({status: z.enum(["draft", "published"])})),
      })
    );

    const head = generateContract(
      router({
        getStatus: query(z.object({id: z.string()}), z.object({status: z.enum(["draft", "published", "archived"])})),
      })
    );

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(false);
    expect(result.findings.some((f: IDiffFinding) => f.code === "response.body.scope.add")).toBe(true);
  });

  it("detects compatible change when narrowing response type", async () => {
    const base = generateContract(
      router({
        getUser: query(z.object({id: z.string()}), z.object({name: z.string(), age: z.number()})),
      })
    );

    const head = generateContract(
      router({
        getUser: query(z.object({id: z.string()}), z.object({name: z.string(), age: z.number().int().min(0).max(120)})),
      })
    );

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("detects breaking change when widening response type", async () => {
    const base = generateContract(
      router({
        getUser: query(z.object({id: z.string()}), z.object({name: z.string(), age: z.number().int().min(0).max(120)})),
      })
    );

    const head = generateContract(
      router({
        getUser: query(z.object({id: z.string()}), z.object({name: z.string(), age: z.number()})),
      })
    );

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(false);
    expect(result.findings.some((f: IDiffFinding) => f.code === "response.body.scope.add")).toBe(true);
  });

  it("detects breaking change when removing a nested procedure", async () => {
    const base = generateContract(
      router({
        auth: router({
          me: query(z.void(), z.object({id: z.string()})),
        }),
      })
    );

    const head = generateContract(
      router({
        auth: router({}),
      })
    );

    const result = await diffContracts(base, head);

    expect(result.compatible).toBe(false);
  });
});
