import { describe, expect, it } from "vitest";
import { loadConfig, loadRouter } from "@/config";
import type { IConfig } from "@/types";

describe("loadConfig", () => {
  it("parses config with routerModule and routerExport", async () => {
    const config = await loadConfig("./tests/fixtures/config.ts", process.cwd());
    expect(config.routerModule).toBe("./tests/fixtures/router.ts");
    expect(config.routerExport).toBe("appRouter");
  });
});

describe("loadRouter", () => {
  it("loads named export", async () => {
    const config: IConfig = {
      routerModule: "./tests/fixtures/router.ts",
      routerExport: "appRouter",
    };
    const router = await loadRouter(config, process.cwd());
    expect(router._def.procedures.getUser).toBeDefined();
  });

  it("loads default export when routerExport is omitted", async () => {
    const config: IConfig = {
      routerModule: "./tests/fixtures/router.ts",
    };
    const router = await loadRouter(config, process.cwd());
    expect(router._def.procedures.createUser).toBeDefined();
  });

  it("throws when named export is missing", async () => {
    const config: IConfig = {
      routerModule: "./tests/fixtures/router.ts",
      routerExport: "missingRouter",
    };
    await expect(loadRouter(config, process.cwd())).rejects.toThrow(
      "The export 'missingRouter' of './tests/fixtures/router.ts' is missing or not an object.",
    );
  });

  it("throws when export is not a router", async () => {
    const config: IConfig = {
      routerModule: "./tests/fixtures/not-a-router.ts",
      routerExport: "notRouter",
    };
    await expect(loadRouter(config, process.cwd())).rejects.toThrow(
      "The export 'notRouter' of './tests/fixtures/not-a-router.ts' is missing or not an object.",
    );
  });
});
