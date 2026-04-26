import {mkdtemp, writeFile, rm} from "node:fs/promises";
import path from "node:path";
import {tmpdir} from "node:os";
import {runOasdiffBreakingFromSpecs} from "oasdiff-js";
import type {IOasdiffChange} from "oasdiff-js";
import type {IDiffFinding, IDiffResult, IOpenApiDocument} from "./types";

const OASDIFF_BREAKING_LEVEL = 2;

const DEFAULT_SEVERITY_LEVELS: Record<string, string> = {
  "request-property-removed": "none",
};

function toFindingCode(changeId: string | undefined) {
  if (changeId?.includes("request")) {
    return "request.body.scope.remove";
  }

  if (changeId?.includes("response")) {
    return "response.body.scope.add";
  }

  return changeId ?? "oasdiff.change";
}

function toFinding(change: IOasdiffChange): IDiffFinding {
  const code = toFindingCode(change.id);

  return {
    action: "change",
    code,
    entity: code,
    sourceSpecEntityDetails: [
      {
        location: [change.operation, change.path].filter(Boolean).join(" "),
        value: change.text,
      },
    ],
  };
}

function isBreakingChange(change: IOasdiffChange) {
  return (change.level ?? 0) >= OASDIFF_BREAKING_LEVEL;
}

async function buildSeverityLevelsFile(levels: Record<string, string>): Promise<string> {
  const tempDir = await mkdtemp(path.join(tmpdir(), "trpc-diff-severity-"));
  const filePath = path.join(tempDir, "severity-levels.txt");

  const content = Object.entries(levels)
    .map(([id, level]) => `${id} ${level}`)
    .join("\n");

  await writeFile(filePath, content + "\n", "utf8");
  return filePath;
}

interface IDiffContractsOptions {
  severityLevels?: Record<string, string>;
}

export async function diffContracts(base: IOpenApiDocument, head: IOpenApiDocument, options: IDiffContractsOptions = {}): Promise<IDiffResult> {
  const severityLevels = {...DEFAULT_SEVERITY_LEVELS, ...options.severityLevels};
  const severityLevelsFile = await buildSeverityLevelsFile(severityLevels);

  try {
    const result = await runOasdiffBreakingFromSpecs(base, head, {
      format: "json",
      severityLevels: severityLevelsFile,
    });

    const findings = result.changes.filter(isBreakingChange).map(toFinding);

    return {
      compatible: findings.length === 0,
      findings,
    };
  } finally {
    await rm(path.dirname(severityLevelsFile), {recursive: true, force: true});
  }
}
