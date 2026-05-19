import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createProductionSliceExport, createProductionSliceFixture } from "../../packages/protocol-slice/src/index.ts";
import { tamperReplayValue, verifyReplayValue } from "../../packages/replay/src/index.ts";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const OUT_DIR = path.join(REPO_ROOT, "artifacts/grant-demo");
const FIXTURE_DIR = path.join(REPO_ROOT, "packages/replay/test/fixtures");

type ReplayTestVector = {
  id: string;
  file: string;
  mode: "production-slice" | "artifact-bundle";
  expectedStatus: "Verified" | "Mismatch";
  value: unknown;
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(FIXTURE_DIR, { recursive: true });

  const { input } = createProductionSliceFixture();
  const cleanProductionSlice = createProductionSliceExport(input);
  const cleanCommunityExport = input.bundle;
  const missingArchiveArtifact = clone(cleanCommunityExport);
  missingArchiveArtifact.root = undefined;

  const vectors: ReplayTestVector[] = [
    {
      id: "clean-production-slice-export",
      file: "clean-production-slice-export.json",
      mode: "production-slice",
      expectedStatus: "Verified",
      value: cleanProductionSlice
    },
    {
      id: "clean-community-export",
      file: "clean-community-export.json",
      mode: "artifact-bundle",
      expectedStatus: "Verified",
      value: cleanCommunityExport
    },
    {
      id: "tampered-result-hash",
      file: "tampered-result-hash.json",
      mode: "production-slice",
      expectedStatus: "Mismatch",
      value: tamperReplayValue(cleanProductionSlice, "resultArtifactHash")
    },
    {
      id: "missing-archive-artifact",
      file: "missing-archive-artifact.json",
      mode: "artifact-bundle",
      expectedStatus: "Mismatch",
      value: missingArchiveArtifact
    },
    {
      id: "reordered-events",
      file: "reordered-events.json",
      mode: "production-slice",
      expectedStatus: "Mismatch",
      value: tamperReplayValue(cleanProductionSlice, "eventStream")
    }
  ];

  const vectorResults = [];
  for (const vector of vectors) {
    const fixturePath = path.join(FIXTURE_DIR, vector.file);
    await writeJson(fixturePath, vector.value);
    const replay = verifyReplayValue(vector.value);
    vectorResults.push({
      id: vector.id,
      path: relative(fixturePath),
      mode: vector.mode,
      expectedStatus: vector.expectedStatus,
      actualStatus: replay.status,
      checksPassed: replay.checks.filter((check) => check.ok).length,
      checksTotal: replay.checks.length,
      failedChecks: replay.checks.filter((check) => !check.ok).map((check) => check.id)
    });
  }

  const failedVectors = vectorResults.filter((vector) => vector.actualStatus !== vector.expectedStatus);
  const report = {
    protocol: "popular-consensus",
    schemaVersion: "ef-protocol-replay-kit-test-vector-report-v1",
    generatedAt: new Date().toISOString(),
    command: "pnpm grant:replay-test-vectors",
    status: failedVectors.length === 0 ? "ReplayTestVectorsReady" : "Mismatch",
    fixtureDirectory: relative(FIXTURE_DIR),
    checksPassed: vectorResults.length - failedVectors.length,
    checksTotal: vectorResults.length,
    failedChecks: failedVectors.map((vector) => vector.id),
    vectors: vectorResults
  };

  const reportPath = path.join(OUT_DIR, "replay-test-vectors-report.json");
  const transcriptPath = path.join(OUT_DIR, "replay-test-vectors-transcript.txt");
  await writeJson(reportPath, report);
  await writeFile(
    transcriptPath,
    [
      "Popular Consensus Protocol Replay Kit replay test vectors",
      "",
      "Command: pnpm grant:replay-test-vectors",
      `Status: ${report.status}`,
      `Fixture directory: ${report.fixtureDirectory}`,
      `Checks: ${report.checksPassed}/${report.checksTotal}`,
      "",
      "Vectors:",
      ...vectorResults.map((vector) => `- ${vector.id}: ${vector.actualStatus} (${vector.path})`),
      "",
      "Failed vectors:",
      ...(failedVectors.length > 0 ? failedVectors.map((vector) => `- ${vector.id}`) : ["- none"])
    ].join("\n") + "\n",
    "utf8"
  );

  if (failedVectors.length > 0) {
    throw new Error(`Replay test vectors failed: ${failedVectors.map((vector) => vector.id).join(", ")}`);
  }

  console.log("EF Protocol Replay Kit replay test vectors: ReplayTestVectorsReady");
  console.log(`Report: ${relative(reportPath)}`);
  console.log(`Transcript: ${relative(transcriptPath)}`);
  console.log(`Fixtures: ${relative(FIXTURE_DIR)}`);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function relative(filePath: string) {
  return path.relative(REPO_ROOT, filePath);
}
