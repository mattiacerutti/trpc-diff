#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {Command} from "commander";
import {diffContracts} from "./diff";
import {loadConfig, loadRouter} from "./config";
import {generateContract} from "./generate";
import type {IOpenApiDocument} from "./types";

const packageJson = JSON.parse(await fs.readFile(new URL("../package.json", import.meta.url), "utf8")) as {version?: string};

async function writeJson(filePath: string, value: unknown) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  await fs.mkdir(path.dirname(absolutePath), {recursive: true});
  await fs.writeFile(absolutePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

async function readJson(filePath: string) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const content = await fs.readFile(absolutePath, "utf8");
  return JSON.parse(content) as IOpenApiDocument;
}

const program = new Command()
  .name("trpc-contract-diff")
  .description("Generate and diff tRPC OpenAPI contracts")
  .version(packageJson.version ?? "0.0.0");

program
  .command("generate")
  .description("Generate an OpenAPI contract from a tRPC router")
  .option("--config <path>", "Path to the config file", "trpc-diff.config.ts")
  .requiredOption("--output <path>", "Path to write the generated contract")
  .action(async (options: {config: string; output: string}) => {
    const config = await loadConfig(options.config, process.cwd());
    const router = await loadRouter(config, process.cwd());
    const contract = generateContract(router);
    await writeJson(options.output, contract);
    console.log(`Generated contract at ${path.resolve(process.cwd(), options.output)}`);
  });

program
  .command("diff")
  .description("Compare two OpenAPI contracts for breaking changes")
  .option("--config <path>", "Path to the config file", "trpc-diff.config.ts")
  .requiredOption("--base <path>", "Path to the base contract")
  .requiredOption("--head <path>", "Path to the head contract")
  .option("--json", "Output results as JSON")
  .action(async (options: {config: string; base: string; head: string; json?: boolean}) => {
    const config = await loadConfig(options.config, process.cwd());
    const base = await readJson(options.base);
    const head = await readJson(options.head);
    const result = await diffContracts(base, head, {severityLevels: config.severityLevels});

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.compatible) {
      console.log("No breaking changes found.");
    } else {
      console.log("Breaking changes found:\n");
      for (const finding of result.findings) {
        const location = finding.sourceSpecEntityDetails?.[0]?.location ?? finding.destinationSpecEntityDetails?.[0]?.location ?? finding.entity;
        console.log(`- ${finding.code} at ${location}`);
      }
    }

    process.exitCode = result.compatible ? 0 : 1;
  });

await program.parseAsync();
