import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashJson } from "../../packages/artifacts/src/index.ts";
import { createProductionSliceExport, createProductionSliceFixture } from "../../packages/protocol-slice/src/index.ts";
import { tamperReplayValue, verifyReplayValue } from "../../packages/replay/src/index.ts";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const OUT_DIR = path.join(REPO_ROOT, "artifacts/grant-demo");

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  const fixture = createProductionSliceFixture();
  const exported = createProductionSliceExport(fixture.input);
  exported.generatedAt = fixture.input.generatedAt;

  const cleanReplay = verifyReplayValue(exported);
  const bundleReplay = verifyReplayValue(fixture.input.bundle);
  const tamperedExport = tamperReplayValue(exported, "resultArtifactHash");
  const tamperedReplay = verifyReplayValue(tamperedExport);
  const duplicateNullifierExport = JSON.parse(JSON.stringify(exported)) as typeof exported;
  duplicateNullifierExport.input.ballots[1].nullifier = duplicateNullifierExport.input.ballots[0].nullifier;
  const duplicateNullifierReplay = verifyReplayValue(duplicateNullifierExport);

  assertStatus("clean production-slice replay", cleanReplay.status, "Verified");
  assertStatus("clean artifact bundle replay", bundleReplay.status, "Verified");
  assertStatus("tampered result hash replay", tamperedReplay.status, "Mismatch");
  assertStatus("duplicate nullifier replay", duplicateNullifierReplay.status, "Mismatch");

  await mkdir(OUT_DIR, { recursive: true });

  const productionSlicePath = path.join(OUT_DIR, "production-slice-export.json");
  const communityExportPath = path.join(OUT_DIR, "community-export.json");
  const tamperedExportPath = path.join(OUT_DIR, "tampered-production-slice-export.json");
  const reportPath = path.join(OUT_DIR, "full-lifecycle-report.json");

  await writeJson(productionSlicePath, exported);
  await writeJson(communityExportPath, fixture.input.bundle);
  await writeJson(tamperedExportPath, tamperedExport);

  const failedTamperChecks = tamperedReplay.checks.filter((check) => !check.ok).map((check) => check.id);
  const failedDuplicateChecks = duplicateNullifierReplay.checks.filter((check) => !check.ok).map((check) => check.id);
  const report = {
    protocol: "popular-consensus",
    schemaVersion: "ef-protocol-replay-kit-demo-report-v1",
    generatedAt: new Date(fixture.input.generatedAt).toISOString(),
    command: "pnpm grant:demo",
    status: "Verified",
    scope: "Popular Consensus Protocol Replay Kit backend replay slice",
    ids: {
      communityId: fixture.input.question.communityId,
      questionId: fixture.input.question.id,
      pollId: fixture.input.poll.id,
      resultId: fixture.input.result.id,
      archiveId: fixture.input.archive.id
    },
    hashes: {
      resultArtifactHash: cleanReplay.productionSlice?.hashes.resultArtifactHash ?? null,
      archiveHash: cleanReplay.hashes.rootHash ?? null,
      artifactManifestHash: cleanReplay.hashes.manifestHash ?? null,
      transactionStreamHash: cleanReplay.hashes.transactionStreamHash ?? null,
      eventStreamHash: cleanReplay.hashes.eventStreamHash ?? null,
      communityExportHash: hashJson(fixture.input.bundle)
    },
    replay: {
      status: cleanReplay.status,
      mode: cleanReplay.mode,
      checksPassed: cleanReplay.checks.filter((check) => check.ok).length,
      checksTotal: cleanReplay.checks.length
    },
    bundleReplay: {
      status: bundleReplay.status,
      checksPassed: bundleReplay.checks.filter((check) => check.ok).length,
      checksTotal: bundleReplay.checks.length
    },
    duplicateNullifier: {
      expectedStatus: "Mismatch",
      actualStatus: duplicateNullifierReplay.status,
      failedChecks: failedDuplicateChecks
    },
    tamper: {
      field: "resultArtifactHash",
      expectedStatus: "Mismatch",
      actualStatus: tamperedReplay.status,
      failedChecks: failedTamperChecks
    },
    counts: cleanReplay.productionSlice?.counts ?? null,
    files: {
      productionSliceExport: relative(productionSlicePath),
      communityExport: relative(communityExportPath),
      tamperedProductionSliceExport: relative(tamperedExportPath),
      report: relative(reportPath)
    },
    contractDeploymentAddresses: null,
    notes: [
      "This is the grant-facing replay fixture path, not a full public-chain deployment.",
      "The demo proves export verification, duplicate-nullifier detection, threshold-share evidence, archive manifest checks, and tamper mismatch detection."
    ]
  };

  await writeJson(reportPath, report);

  console.log("EF Protocol Replay Kit demo: Verified");
  console.log(`Report: ${relative(reportPath)}`);
  console.log(`Production slice export: ${relative(productionSlicePath)}`);
  console.log(`Community export bundle: ${relative(communityExportPath)}`);
  console.log(`Tamper status: ${tamperedReplay.status}`);
}

function assertStatus(label: string, actual: string, expected: string) {
  if (actual !== expected) throw new Error(`${label} expected ${expected} but got ${actual}`);
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function relative(filePath: string) {
  return path.relative(REPO_ROOT, filePath);
}
