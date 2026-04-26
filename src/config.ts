import path from "node:path";
import {pathToFileURL} from "node:url";
import type {ITrpcContractConfig} from "./types";

export async function loadConfig(configPath: string, cwd: string = process.cwd()): Promise<ITrpcContractConfig> {
  const absoluteConfigPath = path.resolve(cwd, configPath);
  const imported = await import(pathToFileURL(absoluteConfigPath).href);
  const rawConfig = imported.default ?? imported.config;

  if (!rawConfig || typeof rawConfig !== "object") {
    throw new Error(`Invalid config at ${absoluteConfigPath}. Expected a default export.`);
  }

  return resolveConfig(rawConfig as ITrpcContractConfig);
}

export function resolveConfig(config: ITrpcContractConfig): ITrpcContractConfig {
  if (!config.router) {
    throw new Error("Missing required config field 'router'.");
  }

  return config;
}
