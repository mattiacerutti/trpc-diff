import path from "node:path";
import { pathToFileURL } from "node:url";
import type { IRouter, IConfig } from "./types";

export async function loadConfig(configPath: string, cwd: string = process.cwd()): Promise<IConfig> {
  const absoluteConfigPath = path.resolve(cwd, configPath);
  const imported = await import(pathToFileURL(absoluteConfigPath).href);
  const rawConfig = imported.default ?? imported.config;

  if (!rawConfig || typeof rawConfig !== "object") {
    throw new Error(`Config at ${absoluteConfigPath} must default-export an object.`);
  }

  if (!("routerModule" in rawConfig) || typeof rawConfig.routerModule !== "string") {
    throw new Error(`Config at ${absoluteConfigPath} must include 'routerModule' as a string.`);
  }

  return rawConfig as IConfig;
}

export async function loadRouter(config: IConfig, cwd: string): Promise<IRouter> {
  const absoluteModulePath = path.resolve(cwd, config.routerModule);
  const imported = await import(pathToFileURL(absoluteModulePath).href);

  const router = config.routerExport ? imported[config.routerExport] : imported.default;

  const exportDesc = config.routerExport ? `export '${config.routerExport}'` : "default export";

  if (!router || typeof router !== "object") {
    throw new Error(`The ${exportDesc} of '${config.routerModule}' is missing or not an object.`);
  }

  if (!router._def || typeof router._def.procedures !== "object") {
    throw new Error(`The ${exportDesc} of '${config.routerModule}' is missing the '_def.procedures' property required for a tRPC router.`);
  }

  return router as IRouter;
}
