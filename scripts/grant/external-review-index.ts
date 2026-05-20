import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const OUT_DIR = path.join(REPO_ROOT, "artifacts/grant-demo");
const execFileAsync = promisify(execFile);

type JsonRecord = Record<string, unknown>;

type ReviewEvidence = {
  id: string;
  path: string;
  expectedStatus: string;
  actualStatus: string | null;
  ok: boolean;
  checksPassed: number | null;
  checksTotal: number | null;
};

const evidenceReports = [
  { id: "full-lifecycle", path: "artifacts/grant-demo/full-lifecycle-report.json", expectedStatus: "Verified" },
  { id: "api-replay", path: "artifacts/grant-demo/api-replay-report.json", expectedStatus: "Verified" },
  { id: "chain-replay", path: "artifacts/grant-demo/chain-replay-report.json", expectedStatus: "Verified" },
  { id: "crypto-review", path: "artifacts/grant-demo/crypto-review-report.json", expectedStatus: "EvidenceReady" },
  { id: "crypto-hardening", path: "artifacts/grant-demo/crypto-hardening-report.json", expectedStatus: "CryptoHardeningEvidenceReady" },
  { id: "threshold-custody", path: "artifacts/grant-demo/threshold-custody-report.json", expectedStatus: "ThresholdCustodyEvidenceReady" },
  { id: "replay-test-vectors", path: "artifacts/grant-demo/replay-test-vectors-report.json", expectedStatus: "ReplayTestVectorsReady" },
  { id: "contract-hardening", path: "artifacts/grant-demo/contract-hardening-report.json", expectedStatus: "ContractHardeningEvidenceReady" },
  { id: "packet-lint", path: "artifacts/grant-demo/packet-lint-report.json", expectedStatus: "PacketReady" },
  { id: "reviewer-handoff", path: "artifacts/grant-demo/reviewer-handoff-report.json", expectedStatus: "ReviewerHandoffReady" },
  { id: "repo-strategy-audit", path: "artifacts/grant-demo/repo-strategy-audit-report.json", expectedStatus: "RepoStrategyEvidenceReady" },
  { id: "submission-gate", path: "artifacts/grant-demo/submission-gate-report.json", expectedStatus: "SubmissionGateEvidenceReady" },
  { id: "protocol-publication", path: "artifacts/grant-demo/protocol-publication-report.json", expectedStatus: "ProtocolPackagePublicationEvidenceReady" },
  { id: "negative-invariants", path: "artifacts/grant-demo/negative-invariant-report.json", expectedStatus: "NegativeInvariantsPreserved" }
];

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const reports = new Map<string, JsonRecord>();
  const evidence: ReviewEvidence[] = [];
  const sourceSnapshot = await buildSourceSnapshot();

  for (const report of evidenceReports) {
    const value = await readJson(report.path);
    reports.set(report.id, value);
    const checksPassed = numeric(get(value, "checksPassed")) ?? numeric(get(value, "replay.checksPassed"));
    const checksTotal = numeric(get(value, "checksTotal")) ?? numeric(get(value, "replay.checksTotal"));
    const actualStatus = stringValue(value.status);
    evidence.push({
      id: report.id,
      path: report.path,
      expectedStatus: report.expectedStatus,
      actualStatus,
      ok: actualStatus === report.expectedStatus && (checksPassed === null || checksTotal === null || checksPassed === checksTotal),
      checksPassed,
      checksTotal
    });
  }

  const fullLifecycle = reports.get("full-lifecycle") ?? {};
  const apiReplay = reports.get("api-replay") ?? {};
  const chainReplay = reports.get("chain-replay") ?? {};
  const failedEvidence = evidence.filter((entry) => !entry.ok);
  const index = {
    protocol: "popular-consensus",
    schemaVersion: "ef-protocol-replay-kit-external-review-index-v1",
    generatedAt: new Date().toISOString(),
    command: "pnpm grant:external-review-index",
    status: failedEvidence.length === 0 ? "ExternalReviewIndexReady" : "Mismatch",
    formalSubmissionReady: false,
    productionDeploymentReady: false,
    sourceSnapshot,
    reviewerStartHere: [
      {
        command: "pnpm grant:check",
        dependencyMode: "no-local-services",
        purpose: "Regenerate the deterministic protocol slice, machine evidence, reviewer handoff, strategy audit, manifest, and replay tests."
      },
      {
        command: "pnpm grant:api-replay",
        dependencyMode: "local-postgres",
        purpose: "Drive the public API lifecycle and verify civic-record/replay-check endpoints through @pc/replay."
      },
      {
        command: "pnpm grant:chain-replay",
        dependencyMode: "ephemeral-anvil",
        purpose: "Deploy protocol modules locally and verify decoded Solidity logs through @pc/replay."
      },
      {
        command: "pnpm grant:crypto-hardening",
        dependencyMode: "no-local-services",
        purpose: "Regenerate v2 encrypted-ballot context binding and threshold-share fail-closed crypto evidence."
      },
      {
        command: "pnpm grant:full-check",
        dependencyMode: "local-postgres-and-ephemeral-anvil",
        purpose: "Run typecheck, tests, contract build, API replay, chain replay, and the quick grant gate."
      }
    ],
    keyHashes: {
      fullLifecycle: {
        resultArtifactHash: get(fullLifecycle, "hashes.resultArtifactHash"),
        archiveHash: get(fullLifecycle, "hashes.archiveHash"),
        eventStreamHash: get(fullLifecycle, "hashes.eventStreamHash")
      },
      apiReplay: {
        questionId: apiReplay.questionId ?? null,
        resultArtifactHash: apiReplay.resultArtifactHash ?? null,
        archiveHash: apiReplay.archiveHash ?? null,
        eventStreamHash: apiReplay.eventStreamHash ?? null
      },
      chainReplay: {
        deployment: get(chainReplay, "deployment.path") ?? "artifacts/grant-demo/chain-local-deployment.json",
        questionId: get(chainReplay, "lifecycle.questionId") ?? get(chainReplay, "question.questionId") ?? null,
        eventCount: get(chainReplay, "replay.eventCount") ?? get(chainReplay, "replay.events") ?? null
      }
    },
    evidence,
    failedChecks: failedEvidence.map((entry) => entry.id),
    humanBlockers: [
      "External cryptography review has not been completed.",
      "Production threshold ceremony/custody evidence has not been completed.",
      "Production decryption-share proof system has not been externally reviewed.",
      "EF Office Hours or equivalent reviewer feedback has not been incorporated."
    ]
  };

  const reportPath = path.join(OUT_DIR, "external-review-index.json");
  const markdownPath = path.join(OUT_DIR, "external-review-index.md");
  await writeJson(reportPath, index);
  await writeFile(markdownPath, markdownFor(index), "utf8");

  if (failedEvidence.length > 0) {
    throw new Error(`External review index failed: ${failedEvidence.map((entry) => entry.id).join(", ")}`);
  }

  console.log("EF Protocol Replay Kit external review index: ExternalReviewIndexReady");
  console.log(`Report: ${relative(reportPath)}`);
  console.log(`Index: ${relative(markdownPath)}`);
  console.log("Formal submission ready: false");
}

async function readJson(file: string): Promise<JsonRecord> {
  return JSON.parse(await readFile(path.join(REPO_ROOT, file), "utf8")) as JsonRecord;
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function markdownFor(index: {
  status: string;
  formalSubmissionReady: boolean;
  productionDeploymentReady: boolean;
  sourceSnapshot: Awaited<ReturnType<typeof buildSourceSnapshot>>;
  reviewerStartHere: Array<{ command: string; dependencyMode: string; purpose: string }>;
  evidence: ReviewEvidence[];
  humanBlockers: string[];
}) {
  return [
    "# External Review Index",
    "",
    `Status: ${index.status}`,
    `Formal submission ready: ${index.formalSubmissionReady}`,
    `Production deployment ready: ${index.productionDeploymentReady}`,
    "",
    "## Source Snapshot",
    "",
    `Git available: ${index.sourceSnapshot.gitAvailable}`,
    `Branch: ${index.sourceSnapshot.branch ?? "unknown"}`,
    `HEAD: ${index.sourceSnapshot.headCommit ?? "unknown"}`,
    `Dirty worktree: ${index.sourceSnapshot.dirty ?? "unknown"}`,
    `Status entries: ${index.sourceSnapshot.statusEntryCount ?? "unknown"}`,
    "",
    "## Reviewer Commands",
    "",
    "| Command | Dependency mode | Purpose |",
    "| --- | --- | --- |",
    ...index.reviewerStartHere.map((entry) => `| \`${entry.command}\` | \`${entry.dependencyMode}\` | ${entry.purpose} |`),
    "",
    "## Evidence Reports",
    "",
    "| Evidence | Status | Checks | Path |",
    "| --- | --- | ---: | --- |",
    ...index.evidence.map((entry) => {
      const checks = entry.checksPassed === null || entry.checksTotal === null ? "n/a" : `${entry.checksPassed}/${entry.checksTotal}`;
      return `| ${entry.id} | ${entry.actualStatus ?? "missing"} | ${checks} | \`${entry.path}\` |`;
    }),
    "",
    "## Human Blockers",
    "",
    ...index.humanBlockers.map((blocker) => `- ${blocker}`),
    ""
  ].join("\n");
}

async function buildSourceSnapshot() {
  try {
    const [headCommit, branch, statusShort] = await Promise.all([
      git(["rev-parse", "HEAD"]),
      git(["branch", "--show-current"]),
      git(["status", "--short"])
    ]);
    const statusEntries = statusShort.split(/\r?\n/).filter(Boolean);
    return {
      gitAvailable: true,
      headCommit,
      branch: branch || null,
      dirty: statusEntries.length > 0,
      statusEntryCount: statusEntries.length,
      statusPreview: statusEntries.slice(0, 25)
    };
  } catch (error) {
    return {
      gitAvailable: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function git(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd: REPO_ROOT });
  return stdout.trim();
}

function get(value: unknown, dottedPath: string): unknown {
  return dottedPath.split(".").reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), value);
}

function numeric(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function relative(filePath: string) {
  return path.relative(REPO_ROOT, filePath);
}
