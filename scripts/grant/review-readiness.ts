import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const OUT_DIR = path.join(REPO_ROOT, "artifacts/grant-demo");

type ReviewCheck = {
  id: string;
  ok: boolean;
  detail: string;
  evidence?: string;
};

type JsonRecord = Record<string, unknown>;

const requiredFiles = [
  "LICENSE-BOUNDARY.md",
  "LICENSE-PROTOCOL-MIT",
  "grant/ef-protocol-replay-kit/README.md",
  "grant/ef-protocol-replay-kit/00-abstract.md",
  "grant/ef-protocol-replay-kit/01-protocol-boundary.md",
  "grant/ef-protocol-replay-kit/02-event-schema.md",
  "grant/ef-protocol-replay-kit/03-artifact-schema.md",
  "grant/ef-protocol-replay-kit/04-replay-rules.md",
  "grant/ef-protocol-replay-kit/05-threat-model.md",
  "grant/ef-protocol-replay-kit/06-demo-transcript.md",
  "grant/ef-protocol-replay-kit/07-budget-and-milestones.md",
  "grant/ef-protocol-replay-kit/08-review-readiness.md",
  "grant/ef-protocol-replay-kit/09-license-plan.md",
  "grant/ef-protocol-replay-kit/10-api-replay-transcript.md",
  "grant/ef-protocol-replay-kit/11-cryptography-review.md",
  "grant/ef-protocol-replay-kit/12-external-review-intake.md",
  "grant/ef-protocol-replay-kit/13-contract-hardening-status.md",
  "grant/ef-protocol-replay-kit/14-reviewer-handoff.md",
  "grant/ef-protocol-replay-kit/15-threshold-custody-hardening.md",
  "grant/ef-protocol-replay-kit/16-replay-test-vectors.md",
  "grant/ef-protocol-replay-kit/17-repo-strategy-audit.md",
  "grant/ef-protocol-replay-kit/18-external-review-index.md",
  "grant/ef-protocol-replay-kit/19-grant-track-issue.md",
  "grant/ef-protocol-replay-kit/20-submission-gate.md",
  "grant/ef-protocol-replay-kit/21-protocol-package-publication.md",
  "grant/ef-protocol-replay-kit/22-negative-invariant-audit.md",
  "grant/ef-protocol-replay-kit/LICENSE-CC-BY-4.0.md",
  "grant/ef-protocol-replay-kit/office-hours-brief.md",
  "grant/ef-protocol-replay-kit/scope-boundary.md",
  "artifacts/grant-demo/LICENSE-CC0.md",
  "artifacts/grant-demo/full-lifecycle-report.json",
  "artifacts/grant-demo/api-replay-report.json",
  "artifacts/grant-demo/chain-replay-report.json",
  "artifacts/grant-demo/crypto-review-report.json",
  "artifacts/grant-demo/threshold-custody-report.json",
  "artifacts/grant-demo/replay-test-vectors-report.json",
  "artifacts/grant-demo/contract-hardening-report.json",
  "artifacts/grant-demo/packet-lint-report.json",
  "artifacts/grant-demo/reviewer-handoff-report.json",
  "artifacts/grant-demo/repo-strategy-audit-report.json",
  "artifacts/grant-demo/submission-gate-report.json",
  "artifacts/grant-demo/protocol-publication-report.json",
  "artifacts/grant-demo/negative-invariant-report.json",
  "artifacts/grant-demo/external-review-index.json",
  "artifacts/grant-demo/evidence-manifest.json",
  "artifacts/grant-demo/production-slice-export.json",
  "artifacts/grant-demo/community-export.json",
  "artifacts/grant-demo/tampered-production-slice-export.json",
  "packages/replay/test/fixtures/clean-production-slice-export.json",
  "packages/replay/test/fixtures/clean-community-export.json",
  "packages/replay/test/fixtures/tampered-result-hash.json",
  "packages/replay/test/fixtures/missing-archive-artifact.json",
  "packages/replay/test/fixtures/reordered-events.json",
  "packages/replay/src/cli.ts",
  "packages/replay/src/verifyBundle.ts",
  "packages/replay/src/verifyApi.ts",
  "packages/replay/src/verifyChain.ts",
  "packages/replay/src/rebuildState.ts",
  "packages/replay/src/checks.ts",
  "packages/replay/src/tamper.ts",
  "packages/contracts/src/PCToken.sol",
  "packages/contracts/src/ProtocolAccess.sol",
  "packages/contracts/src/StakeManager.sol",
  "packages/contracts/src/QuestionRegistry.sol",
  "packages/contracts/src/ChallengeCourt.sol",
  "packages/contracts/src/CredentialRegistry.sol",
  "packages/contracts/src/PollManager.sol",
  "packages/contracts/src/TallyManager.sol",
  "packages/contracts/src/ResultArchive.sol",
  "packages/contracts/src/AdoptionRegistry.sol",
  "packages/contracts/src/PopularConsensus.sol",
  "packages/contracts/src/PopularConsensusDeployment.sol",
  "packages/contracts/test/PopularConsensus.t.sol",
  "scripts/check-protocol-boundaries.ts",
  "scripts/grant/full-lifecycle-demo.ts",
  "scripts/grant/api-replay-demo.ts",
  "scripts/grant/chain-replay-demo.ts",
  "scripts/grant/crypto-review.ts",
  "scripts/grant/threshold-custody.ts",
  "scripts/grant/replay-test-vectors.ts",
  "scripts/grant/contract-hardening.ts",
  "scripts/grant/packet-lint.ts",
  "scripts/grant/reviewer-handoff.ts",
  "scripts/grant/repo-strategy-audit.ts",
  "scripts/grant/submission-gate.ts",
  "scripts/grant/protocol-publication.ts",
  "scripts/grant/negative-invariant-audit.ts",
  "scripts/grant/external-review-index.ts",
  "scripts/grant/evidence-manifest.ts"
];

const protocolPackageManifests = [
  "packages/shared/package.json",
  "packages/artifacts/package.json",
  "packages/privacy/package.json",
  "packages/protocol-slice/package.json",
  "packages/replay/package.json",
  "packages/contracts/package.json"
];

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const checks: ReviewCheck[] = [];

  for (const file of requiredFiles) {
    checks.push(await fileExistsCheck(file));
  }

  const fullLifecycle = await readJson("artifacts/grant-demo/full-lifecycle-report.json");
  checks.push(check("full-lifecycle-verified", fullLifecycle.status === "Verified", "Backend lifecycle report is Verified", "artifacts/grant-demo/full-lifecycle-report.json"));
  checks.push(
    check(
      "full-lifecycle-tamper-mismatch",
      get(fullLifecycle, "tamper.actualStatus") === "Mismatch",
      "Tampered production slice produces Mismatch",
      "artifacts/grant-demo/full-lifecycle-report.json"
    )
  );
  checks.push(
    check(
      "full-lifecycle-duplicate-nullifier-mismatch",
      get(fullLifecycle, "duplicateNullifier.actualStatus") === "Mismatch",
      "Duplicate nullifier fixture produces Mismatch",
      "artifacts/grant-demo/full-lifecycle-report.json"
    )
  );

  const apiReplay = await readJson("artifacts/grant-demo/api-replay-report.json");
  checks.push(check("api-replay-verified", apiReplay.status === "Verified", "Public API replay report is Verified", "artifacts/grant-demo/api-replay-report.json"));
  checks.push(
    check(
      "api-replay-checks-pass",
      numeric(apiReplay.checksPassed) === numeric(apiReplay.checksTotal),
      "All public API replay checks pass",
      "artifacts/grant-demo/api-replay-report.json"
    )
  );

  const chainReplay = await readJson("artifacts/grant-demo/chain-replay-report.json");
  checks.push(check("chain-replay-verified", chainReplay.status === "Verified", "Local chain replay report is Verified", "artifacts/grant-demo/chain-replay-report.json"));
  checks.push(
    check(
      "chain-replay-checks-pass",
      get(chainReplay, "replay.checksPassed") === get(chainReplay, "replay.checksTotal"),
      "All local chain replay checks pass",
      "artifacts/grant-demo/chain-replay-report.json"
    )
  );
  checks.push(
    check(
      "chain-replay-duplicate-nullifier-rejected",
      get(chainReplay, "duplicateNullifier.actual") === "rejected",
      "Duplicate nullifier is rejected by the local contract lifecycle",
      "artifacts/grant-demo/chain-replay-report.json"
    )
  );

  const cryptoReview = await readJson("artifacts/grant-demo/crypto-review-report.json");
  checks.push(check("crypto-review-evidence-ready", cryptoReview.status === "EvidenceReady", "Crypto evidence inventory is EvidenceReady", "artifacts/grant-demo/crypto-review-report.json"));
  checks.push(
    check(
      "crypto-review-checks-pass",
      numeric(cryptoReview.checksPassed) === numeric(cryptoReview.checksTotal),
      "All crypto evidence checks pass",
      "artifacts/grant-demo/crypto-review-report.json"
    )
  );
  checks.push(
    check(
      "crypto-review-nonclaims-present",
      JSON.stringify(cryptoReview.productionNonClaims ?? []).includes("No external cryptography audit has been completed"),
      "Crypto review report includes external-audit non-claim",
      "artifacts/grant-demo/crypto-review-report.json"
    )
  );

  const thresholdCustody = await readJson("artifacts/grant-demo/threshold-custody-report.json");
  checks.push(
    check(
      "threshold-custody-evidence-ready",
      thresholdCustody.status === "ThresholdCustodyEvidenceReady",
      "Threshold custody evidence report is ThresholdCustodyEvidenceReady",
      "artifacts/grant-demo/threshold-custody-report.json"
    )
  );
  checks.push(
    check(
      "threshold-custody-checks-pass",
      numeric(thresholdCustody.checksPassed) === numeric(thresholdCustody.checksTotal),
      "All threshold custody hardening cases pass",
      "artifacts/grant-demo/threshold-custody-report.json"
    )
  );
  checks.push(
    check(
      "threshold-custody-production-nonclaim",
      thresholdCustody.productionDeploymentReady === false,
      "Threshold custody report does not claim production deployment readiness",
      "artifacts/grant-demo/threshold-custody-report.json"
    )
  );

  const replayTestVectors = await readJson("artifacts/grant-demo/replay-test-vectors-report.json");
  checks.push(
    check(
      "replay-test-vectors-ready",
      replayTestVectors.status === "ReplayTestVectorsReady",
      "Replay test vector report is ReplayTestVectorsReady",
      "artifacts/grant-demo/replay-test-vectors-report.json"
    )
  );
  checks.push(
    check(
      "replay-test-vectors-checks-pass",
      numeric(replayTestVectors.checksPassed) === numeric(replayTestVectors.checksTotal),
      "All replay test vectors have the expected status",
      "artifacts/grant-demo/replay-test-vectors-report.json"
    )
  );
  checks.push(
    check(
      "replay-test-vectors-cover-clean-and-tampered",
      JSON.stringify(replayTestVectors.vectors ?? []).includes("clean-community-export") &&
        JSON.stringify(replayTestVectors.vectors ?? []).includes("tampered-result-hash") &&
        JSON.stringify(replayTestVectors.vectors ?? []).includes("missing-archive-artifact") &&
        JSON.stringify(replayTestVectors.vectors ?? []).includes("reordered-events"),
      "Replay test vectors cover clean bundle and core tamper fixtures",
      "artifacts/grant-demo/replay-test-vectors-report.json"
    )
  );

  const contractHardening = await readJson("artifacts/grant-demo/contract-hardening-report.json");
  checks.push(
    check(
      "contract-hardening-evidence-ready",
      contractHardening.status === "ContractHardeningEvidenceReady",
      "Contract hardening evidence report is ContractHardeningEvidenceReady",
      "artifacts/grant-demo/contract-hardening-report.json"
    )
  );
  checks.push(
    check(
      "contract-hardening-checks-pass",
      numeric(contractHardening.checksPassed) === numeric(contractHardening.checksTotal),
      "All contract access-control assumption checks pass",
      "artifacts/grant-demo/contract-hardening-report.json"
    )
  );
  checks.push(
    check(
      "contract-hardening-production-nonclaim",
      contractHardening.productionDeploymentReady === false,
      "Contract hardening report does not claim production deployment readiness",
      "artifacts/grant-demo/contract-hardening-report.json"
    )
  );

  const packetLint = await readJson("artifacts/grant-demo/packet-lint-report.json");
  checks.push(check("packet-lint-ready", packetLint.status === "PacketReady", "Grant packet lint report is PacketReady", "artifacts/grant-demo/packet-lint-report.json"));
  checks.push(
    check(
      "packet-lint-checks-pass",
      numeric(packetLint.checksPassed) === numeric(packetLint.checksTotal),
      "All packet lint checks pass",
      "artifacts/grant-demo/packet-lint-report.json"
    )
  );

  const reviewerHandoff = await readJson("artifacts/grant-demo/reviewer-handoff-report.json");
  checks.push(
    check(
      "reviewer-handoff-ready",
      reviewerHandoff.status === "ReviewerHandoffReady",
      "Reviewer handoff report is ReviewerHandoffReady",
      "artifacts/grant-demo/reviewer-handoff-report.json"
    )
  );
  checks.push(
    check(
      "reviewer-handoff-keeps-nonclaims",
      reviewerHandoff.formalSubmissionReady === false && reviewerHandoff.productionDeploymentReady === false,
      "Reviewer handoff keeps formal submission and production deployment non-claims explicit",
      "artifacts/grant-demo/reviewer-handoff-report.json"
    )
  );

  const repoStrategyAudit = await readJson("artifacts/grant-demo/repo-strategy-audit-report.json");
  checks.push(
    check(
      "repo-strategy-audit-ready",
      repoStrategyAudit.status === "RepoStrategyEvidenceReady",
      "Repo strategy audit report is RepoStrategyEvidenceReady",
      "artifacts/grant-demo/repo-strategy-audit-report.json"
    )
  );
  checks.push(
    check(
      "repo-strategy-audit-checks-pass",
      numeric(repoStrategyAudit.checksPassed) === numeric(repoStrategyAudit.checksTotal),
      "All repo strategy audit checks pass",
      "artifacts/grant-demo/repo-strategy-audit-report.json"
    )
  );
  checks.push(
    check(
      "repo-strategy-audit-keeps-nonclaims",
      repoStrategyAudit.formalSubmissionReady === false && repoStrategyAudit.productionDeploymentReady === false,
      "Repo strategy audit keeps formal submission and production deployment non-claims explicit",
      "artifacts/grant-demo/repo-strategy-audit-report.json"
    )
  );

  const submissionGate = await readJson("artifacts/grant-demo/submission-gate-report.json");
  checks.push(
    check(
      "submission-gate-ready",
      submissionGate.status === "SubmissionGateEvidenceReady",
      "Submission gate report is SubmissionGateEvidenceReady",
      "artifacts/grant-demo/submission-gate-report.json"
    )
  );
  checks.push(
    check(
      "submission-gate-keeps-nonclaims",
      submissionGate.formalSubmissionReady === false && submissionGate.productionDeploymentReady === false,
      "Submission gate keeps formal submission and production deployment non-claims explicit",
      "artifacts/grant-demo/submission-gate-report.json"
    )
  );

  const protocolPublication = await readJson("artifacts/grant-demo/protocol-publication-report.json");
  checks.push(
    check(
      "protocol-publication-ready",
      protocolPublication.status === "ProtocolPackagePublicationEvidenceReady",
      "Protocol package publication report is ProtocolPackagePublicationEvidenceReady",
      "artifacts/grant-demo/protocol-publication-report.json"
    )
  );
  checks.push(
    check(
      "protocol-publication-keeps-npm-nonclaim",
      protocolPublication.sourceReuseReady === true && protocolPublication.npmPublicationReady === false,
      "Protocol package publication report claims source reuse but not npm publication readiness",
      "artifacts/grant-demo/protocol-publication-report.json"
    )
  );

  const negativeInvariants = await readJson("artifacts/grant-demo/negative-invariant-report.json");
  checks.push(
    check(
      "negative-invariants-preserved",
      negativeInvariants.status === "NegativeInvariantsPreserved",
      "Negative invariant audit report is NegativeInvariantsPreserved",
      "artifacts/grant-demo/negative-invariant-report.json"
    )
  );
  checks.push(
    check(
      "negative-invariants-keep-nonclaims",
      negativeInvariants.formalSubmissionReady === false && negativeInvariants.productionDeploymentReady === false,
      "Negative invariant audit keeps formal submission and production deployment non-claims explicit",
      "artifacts/grant-demo/negative-invariant-report.json"
    )
  );

  const externalReviewIndex = await readJson("artifacts/grant-demo/external-review-index.json");
  checks.push(
    check(
      "external-review-index-ready",
      externalReviewIndex.status === "ExternalReviewIndexReady",
      "External review index is ExternalReviewIndexReady",
      "artifacts/grant-demo/external-review-index.json"
    )
  );
  checks.push(
    check(
      "external-review-index-keeps-nonclaims",
      externalReviewIndex.formalSubmissionReady === false && externalReviewIndex.productionDeploymentReady === false,
      "External review index keeps formal submission and production deployment non-claims explicit",
      "artifacts/grant-demo/external-review-index.json"
    )
  );

  const evidenceManifest = await readJson("artifacts/grant-demo/evidence-manifest.json");
  checks.push(check("evidence-manifest-ready", evidenceManifest.status === "ManifestReady", "Evidence manifest is ManifestReady", "artifacts/grant-demo/evidence-manifest.json"));
  checks.push(
    check(
      "evidence-manifest-hash-present",
      typeof evidenceManifest.manifestHash === "string" && evidenceManifest.manifestHash.startsWith("sha256:"),
      "Evidence manifest has a content hash",
      "artifacts/grant-demo/evidence-manifest.json"
    )
  );
  checks.push(
    check(
      "evidence-manifest-covers-review-files",
      numeric(evidenceManifest.entryCount) !== null && numeric(evidenceManifest.entryCount)! >= 45,
      "Evidence manifest covers grant packet, reports, source, and tests",
      "artifacts/grant-demo/evidence-manifest.json"
    )
  );

  for (const manifest of protocolPackageManifests) {
    const value = await readJson(manifest);
    checks.push(check(`protocol-license-${path.basename(path.dirname(manifest))}`, value.license === "MIT", `${manifest} declares MIT for protocol slice`, manifest));
  }

  const licenseBoundary = await readText("LICENSE-BOUNDARY.md");
  checks.push(
    check(
      "license-boundary-not-monorepo-wide",
      licenseBoundary.includes("does not license the entire monorepo"),
      "License boundary does not imply whole-monorepo open-source licensing",
      "LICENSE-BOUNDARY.md"
    )
  );

  const reviewReadiness = await readText("grant/ef-protocol-replay-kit/08-review-readiness.md");
  checks.push(
    check(
      "known-human-blockers-documented",
      reviewReadiness.includes("external cryptography review/threshold ceremony evidence and EF feedback remain open"),
      "Readiness doc keeps human blockers explicit",
      "grant/ef-protocol-replay-kit/08-review-readiness.md"
    )
  );

  const failedChecks = checks.filter((entry) => !entry.ok);
  const humanBlockers = [
    "External cryptography review and production threshold ceremony evidence are not complete.",
    "EF Office Hours or equivalent grant reviewer feedback has not been incorporated."
  ];
  const report = {
    protocol: "popular-consensus",
    schemaVersion: "ef-protocol-replay-kit-review-readiness-report-v1",
    generatedAt: new Date().toISOString(),
    command: "pnpm grant:review-readiness",
    status: failedChecks.length === 0 ? "MachineEvidenceReady" : "Mismatch",
    formalSubmissionReady: false,
    checksPassed: checks.length - failedChecks.length,
    checksTotal: checks.length,
    failedChecks: failedChecks.map((entry) => entry.id),
    humanBlockers,
    requiredCommands: [
      "pnpm install --frozen-lockfile",
      "pnpm typecheck",
      "pnpm test",
      "pnpm contracts:build",
      "pnpm grant:check",
      "pnpm grant:api-replay",
      "pnpm grant:chain-replay",
      "pnpm grant:crypto-review",
      "pnpm grant:threshold-custody",
      "pnpm grant:replay-test-vectors",
      "pnpm grant:contract-hardening",
      "pnpm grant:packet-lint",
      "pnpm grant:reviewer-handoff",
      "pnpm grant:repo-strategy-audit",
      "pnpm grant:submission-gate",
      "pnpm grant:protocol-publication",
      "pnpm grant:negative-invariants",
      "pnpm grant:external-review-index",
      "pnpm grant:evidence-manifest",
      "pnpm grant:review-readiness",
      "pnpm grant:full-check"
    ],
    checks
  };

  const reportPath = path.join(OUT_DIR, "review-readiness-report.json");
  const transcriptPath = path.join(OUT_DIR, "review-readiness-transcript.txt");
  await writeJson(reportPath, report);
  await writeFile(
    transcriptPath,
    [
      "Popular Consensus Protocol Replay Kit review readiness",
      "",
      "Command: pnpm grant:review-readiness",
      `Status: ${report.status}`,
      `Formal submission ready: ${report.formalSubmissionReady}`,
      `Checks: ${report.checksPassed}/${report.checksTotal}`,
      "",
      "Human blockers:",
      ...humanBlockers.map((blocker) => `- ${blocker}`),
      "",
      "Failed checks:",
      ...(failedChecks.length > 0 ? failedChecks.map((entry) => `- ${entry.id}`) : ["- none"])
    ].join("\n") + "\n",
    "utf8"
  );

  if (failedChecks.length > 0) {
    throw new Error(`Review readiness checks failed: ${failedChecks.map((entry) => entry.id).join(", ")}`);
  }

  console.log("EF Protocol Replay Kit review readiness: MachineEvidenceReady");
  console.log(`Report: ${relative(reportPath)}`);
  console.log(`Transcript: ${relative(transcriptPath)}`);
  console.log("Formal submission ready: false");
}

async function fileExistsCheck(file: string): Promise<ReviewCheck> {
  try {
    const stats = await readFile(path.join(REPO_ROOT, file), "utf8");
    return check(`file-${slug(file)}`, stats.length > 0, `${file} exists and is non-empty`, file);
  } catch {
    return check(`file-${slug(file)}`, false, `${file} is missing`, file);
  }
}

function check(id: string, ok: boolean, detail: string, evidence?: string): ReviewCheck {
  return { id, ok, detail, evidence };
}

async function readJson(file: string): Promise<JsonRecord> {
  return JSON.parse(await readText(file)) as JsonRecord;
}

async function readText(file: string): Promise<string> {
  return readFile(path.join(REPO_ROOT, file), "utf8");
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function get(value: unknown, dottedPath: string): unknown {
  return dottedPath.split(".").reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), value);
}

function numeric(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function slug(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function relative(filePath: string) {
  return path.relative(REPO_ROOT, filePath);
}
