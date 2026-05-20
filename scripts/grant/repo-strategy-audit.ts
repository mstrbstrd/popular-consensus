import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const OUT_DIR = path.join(REPO_ROOT, "artifacts/grant-demo");

type StrategyRequirement = {
  id: string;
  requirement: string;
  evidence: string[];
  verify: (context: AuditContext) => boolean;
};

type AuditContext = {
  packageJson: Record<string, unknown>;
  files: Map<string, string>;
  json: Map<string, Record<string, unknown>>;
};

const requiredTextFiles = [
  "README.md",
  "LICENSE-BOUNDARY.md",
  "grant/ef-protocol-replay-kit/README.md",
  "grant/ef-protocol-replay-kit/00-abstract.md",
  "grant/ef-protocol-replay-kit/01-protocol-boundary.md",
  "grant/ef-protocol-replay-kit/04-replay-rules.md",
  "grant/ef-protocol-replay-kit/08-review-readiness.md",
  "grant/ef-protocol-replay-kit/09-license-plan.md",
  "grant/ef-protocol-replay-kit/12-external-review-intake.md",
  "grant/ef-protocol-replay-kit/14-reviewer-handoff.md",
  "grant/ef-protocol-replay-kit/16-replay-test-vectors.md",
  "grant/ef-protocol-replay-kit/17-repo-strategy-audit.md",
  "grant/ef-protocol-replay-kit/19-grant-track-issue.md",
  "grant/ef-protocol-replay-kit/20-submission-gate.md",
  "grant/ef-protocol-replay-kit/21-protocol-package-publication.md",
  "grant/ef-protocol-replay-kit/22-negative-invariant-audit.md",
  "grant/ef-protocol-replay-kit/23-crypto-hardening-evidence.md",
  "grant/ef-protocol-replay-kit/scope-boundary.md",
  "packages/replay/README.md",
  "scripts/check-protocol-boundaries.ts"
];

const requiredJsonFiles = [
  "artifacts/grant-demo/full-lifecycle-report.json",
  "artifacts/grant-demo/api-replay-report.json",
  "artifacts/grant-demo/chain-replay-report.json",
  "artifacts/grant-demo/crypto-review-report.json",
  "artifacts/grant-demo/crypto-hardening-report.json",
  "artifacts/grant-demo/threshold-custody-report.json",
  "artifacts/grant-demo/replay-test-vectors-report.json",
  "artifacts/grant-demo/contract-hardening-report.json",
  "artifacts/grant-demo/packet-lint-report.json",
  "artifacts/grant-demo/reviewer-handoff-report.json",
  "artifacts/grant-demo/review-readiness-report.json",
  "artifacts/grant-demo/submission-gate-report.json",
  "artifacts/grant-demo/protocol-publication-report.json",
  "artifacts/grant-demo/negative-invariant-report.json",
  "artifacts/grant-demo/evidence-manifest.json"
];

const requirements: StrategyRequirement[] = [
  {
    id: "monorepo-kept-intact",
    requirement: "Keep the current monorepo intact for grant-readiness instead of splitting prematurely.",
    evidence: ["pnpm-workspace.yaml", "apps/api", "apps/web", "packages/replay", "grant/ef-protocol-replay-kit"],
    verify: (context) => hasScript(context, "grant:check") && text(context, "grant/ef-protocol-replay-kit/README.md").includes("monorepo")
  },
  {
    id: "protocol-platform-boundary-enforced",
    requirement: "Enforce protocol/platform dependency direction so platform may depend on protocol but protocol must not depend on platform.",
    evidence: ["scripts/check-protocol-boundaries.ts", "grant/ef-protocol-replay-kit/01-protocol-boundary.md", "pnpm protocol:boundary:check"],
    verify: (context) =>
      hasScript(context, "protocol:boundary:check") &&
      text(context, "grant/ef-protocol-replay-kit/01-protocol-boundary.md").includes("Protocol must not depend on platform") &&
      text(context, "scripts/check-protocol-boundaries.ts").includes("FORBIDDEN_PACKAGES")
  },
  {
    id: "grant-scope-packet-created",
    requirement: "Create the EF Protocol Replay Kit grant packet with scope, boundary, schemas, replay rules, threat model, milestones, review readiness, and office-hours brief.",
    evidence: ["grant/ef-protocol-replay-kit/*.md", "artifacts/grant-demo/packet-lint-report.json"],
    verify: (context) =>
      jsonValue(context, "artifacts/grant-demo/packet-lint-report.json", "status") === "PacketReady" &&
      text(context, "grant/ef-protocol-replay-kit/00-abstract.md").includes("Protocol Replay Kit") &&
      text(context, "grant/ef-protocol-replay-kit/scope-boundary.md").toLowerCase().includes("out of scope")
  },
  {
    id: "grant-track-issue-draft",
    requirement: "Prepare the EF Grant Track coordination issue or project-board handoff without claiming an external public issue exists.",
    evidence: ["grant/ef-protocol-replay-kit/19-grant-track-issue.md"],
    verify: (context) =>
      text(context, "grant/ef-protocol-replay-kit/19-grant-track-issue.md").includes("EF Grant Track: Protocol Replay Kit") &&
      text(context, "grant/ef-protocol-replay-kit/19-grant-track-issue.md").includes("Current Local Status") &&
      text(context, "grant/ef-protocol-replay-kit/19-grant-track-issue.md").includes("no public issue tracker target has been selected")
  },
  {
    id: "one-command-backend-lifecycle-demo",
    requirement: "Add a one-command backend lifecycle demo that verifies clean replay and intentional tamper mismatch.",
    evidence: ["pnpm grant:demo", "artifacts/grant-demo/full-lifecycle-report.json"],
    verify: (context) =>
      hasScript(context, "grant:demo") &&
      jsonValue(context, "artifacts/grant-demo/full-lifecycle-report.json", "status") === "Verified" &&
      jsonValue(context, "artifacts/grant-demo/full-lifecycle-report.json", "tamper.actualStatus") === "Mismatch"
  },
  {
    id: "standalone-replay-verifier",
    requirement: "Provide an independently usable replay verifier for bundle, API, chain, and tamper paths without the web client.",
    evidence: ["packages/replay", "pnpm replay:verify", "pc-replay verify-bundle", "pc-replay verify-api", "pc-replay verify-chain"],
    verify: (context) =>
      hasScript(context, "replay:verify") &&
      text(context, "packages/replay/README.md").includes("verify-bundle") &&
      text(context, "packages/replay/README.md").includes("verify-api") &&
      text(context, "packages/replay/README.md").includes("verify-chain")
  },
  {
    id: "api-and-chain-replay-evidence",
    requirement: "Prepare API replay and local-chain replay evidence for external reviewers.",
    evidence: ["artifacts/grant-demo/api-replay-report.json", "artifacts/grant-demo/chain-replay-report.json"],
    verify: (context) =>
      jsonValue(context, "artifacts/grant-demo/api-replay-report.json", "status") === "Verified" &&
      jsonValue(context, "artifacts/grant-demo/chain-replay-report.json", "status") === "Verified"
  },
  {
    id: "replay-test-vectors",
    requirement: "Publish checked clean and tampered replay test vectors.",
    evidence: ["packages/replay/test/fixtures/*.json", "artifacts/grant-demo/replay-test-vectors-report.json"],
    verify: (context) =>
      jsonValue(context, "artifacts/grant-demo/replay-test-vectors-report.json", "status") === "ReplayTestVectorsReady" &&
      numeric(jsonValue(context, "artifacts/grant-demo/replay-test-vectors-report.json", "checksPassed")) === numeric(jsonValue(context, "artifacts/grant-demo/replay-test-vectors-report.json", "checksTotal"))
  },
  {
    id: "contract-hardening-evidence",
    requirement: "Split and harden grant-critical contracts while keeping production custody non-claims explicit.",
    evidence: ["packages/contracts/src/*.sol", "artifacts/grant-demo/contract-hardening-report.json"],
    verify: (context) =>
      jsonValue(context, "artifacts/grant-demo/contract-hardening-report.json", "status") === "ContractHardeningEvidenceReady" &&
      jsonValue(context, "artifacts/grant-demo/contract-hardening-report.json", "moduleLayoutStatus") === "SplitModuleFilesWithAggregateEntrypoint" &&
      jsonValue(context, "artifacts/grant-demo/contract-hardening-report.json", "productionDeploymentReady") === false
  },
  {
    id: "crypto-nonclaims-and-threshold-custody",
    requirement: "Strengthen cryptography evidence without overstating production readiness.",
    evidence: ["artifacts/grant-demo/crypto-review-report.json", "artifacts/grant-demo/crypto-hardening-report.json", "artifacts/grant-demo/threshold-custody-report.json"],
    verify: (context) =>
      jsonValue(context, "artifacts/grant-demo/crypto-review-report.json", "status") === "EvidenceReady" &&
      jsonValue(context, "artifacts/grant-demo/crypto-hardening-report.json", "status") === "CryptoHardeningEvidenceReady" &&
      jsonValue(context, "artifacts/grant-demo/crypto-hardening-report.json", "productionDeploymentReady") === false &&
      jsonValue(context, "artifacts/grant-demo/threshold-custody-report.json", "status") === "ThresholdCustodyEvidenceReady" &&
      jsonValue(context, "artifacts/grant-demo/threshold-custody-report.json", "productionDeploymentReady") === false
  },
  {
    id: "external-review-handoff",
    requirement: "Prepare reviewer handoff and readiness evidence while keeping formal submission blocked on human review.",
    evidence: ["artifacts/grant-demo/reviewer-handoff-report.json", "artifacts/grant-demo/review-readiness-report.json"],
    verify: (context) =>
      jsonValue(context, "artifacts/grant-demo/reviewer-handoff-report.json", "status") === "ReviewerHandoffReady" &&
      jsonValue(context, "artifacts/grant-demo/review-readiness-report.json", "status") === "MachineEvidenceReady" &&
      jsonValue(context, "artifacts/grant-demo/review-readiness-report.json", "formalSubmissionReady") === false
  },
  {
    id: "submission-gate-evidence",
    requirement: "Translate the pre-submit checklist into evidence without treating EF feedback as an automated pass.",
    evidence: ["artifacts/grant-demo/submission-gate-report.json", "grant/ef-protocol-replay-kit/20-submission-gate.md"],
    verify: (context) =>
      jsonValue(context, "artifacts/grant-demo/submission-gate-report.json", "status") === "SubmissionGateEvidenceReady" &&
      jsonValue(context, "artifacts/grant-demo/submission-gate-report.json", "formalSubmissionReady") === false &&
      text(context, "grant/ef-protocol-replay-kit/20-submission-gate.md").includes("formalSubmissionReady: false")
  },
  {
    id: "platform-not-source-of-truth",
    requirement: "Avoid making the platform the source of protocol truth.",
    evidence: ["grant/ef-protocol-replay-kit/01-protocol-boundary.md", "artifacts/grant-demo/evidence-manifest.json", "pnpm protocol:boundary:check"],
    verify: (context) =>
      text(context, "grant/ef-protocol-replay-kit/01-protocol-boundary.md").includes("It must not be the source of protocol truth") &&
      text(context, "grant/ef-protocol-replay-kit/README.md").includes("without trusting the application database") &&
      numeric(jsonValue(context, "artifacts/grant-demo/evidence-manifest.json", "entryCount")) !== null
  },
  {
    id: "negative-invariants-preserved",
    requirement: "Preserve negative invariants against platform imports, product-scope creep, token pitch, production overclaims, license blur, and client demo dependencies.",
    evidence: ["artifacts/grant-demo/negative-invariant-report.json", "grant/ef-protocol-replay-kit/22-negative-invariant-audit.md"],
    verify: (context) =>
      jsonValue(context, "artifacts/grant-demo/negative-invariant-report.json", "status") === "NegativeInvariantsPreserved" &&
      jsonValue(context, "artifacts/grant-demo/negative-invariant-report.json", "formalSubmissionReady") === false &&
      jsonValue(context, "artifacts/grant-demo/negative-invariant-report.json", "productionDeploymentReady") === false &&
      text(context, "grant/ef-protocol-replay-kit/22-negative-invariant-audit.md").includes("must not do")
  },
  {
    id: "license-boundary-scoped",
    requirement: "Keep public-good protocol licensing scoped instead of accidentally licensing the whole monorepo.",
    evidence: ["LICENSE-BOUNDARY.md", "LICENSE-PROTOCOL-MIT", "grant/ef-protocol-replay-kit/09-license-plan.md"],
    verify: (context) =>
      text(context, "LICENSE-BOUNDARY.md").includes("does not license the entire monorepo") &&
      text(context, "grant/ef-protocol-replay-kit/09-license-plan.md").includes("Protocol packages")
  },
  {
    id: "protocol-package-publication-status",
    requirement: "Make protocol package source reuse explicit without claiming npm publication readiness.",
    evidence: ["artifacts/grant-demo/protocol-publication-report.json", "grant/ef-protocol-replay-kit/21-protocol-package-publication.md"],
    verify: (context) =>
      jsonValue(context, "artifacts/grant-demo/protocol-publication-report.json", "status") === "ProtocolPackagePublicationEvidenceReady" &&
      jsonValue(context, "artifacts/grant-demo/protocol-publication-report.json", "sourceReuseReady") === true &&
      jsonValue(context, "artifacts/grant-demo/protocol-publication-report.json", "npmPublicationReady") === false &&
      text(context, "grant/ef-protocol-replay-kit/21-protocol-package-publication.md").includes("not a claim that the protocol source is proprietary")
  }
];

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const context = await loadContext();
  const checks = requirements.map((requirement) => {
    const ok = requirement.verify(context);
    return {
      id: requirement.id,
      ok,
      requirement: requirement.requirement,
      evidence: requirement.evidence
    };
  });
  const failedChecks = checks.filter((check) => !check.ok);
  const report = {
    protocol: "popular-consensus",
    schemaVersion: "ef-protocol-replay-kit-repo-strategy-audit-v1",
    generatedAt: new Date().toISOString(),
    command: "pnpm grant:repo-strategy-audit",
    status: failedChecks.length === 0 ? "RepoStrategyEvidenceReady" : "Mismatch",
    formalSubmissionReady: false,
    productionDeploymentReady: false,
    checksPassed: checks.length - failedChecks.length,
    checksTotal: checks.length,
    failedChecks: failedChecks.map((check) => check.id),
    remainingHumanBlockers: [
      "External cryptography review has not been completed.",
      "Production threshold ceremony/custody evidence has not been completed.",
      "EF Office Hours or equivalent reviewer feedback has not been incorporated."
    ],
    checks
  };

  const reportPath = path.join(OUT_DIR, "repo-strategy-audit-report.json");
  const transcriptPath = path.join(OUT_DIR, "repo-strategy-audit-transcript.txt");
  await writeJson(reportPath, report);
  await writeFile(
    transcriptPath,
    [
      "Popular Consensus Protocol Replay Kit repo strategy audit",
      "",
      "Command: pnpm grant:repo-strategy-audit",
      `Status: ${report.status}`,
      `Formal submission ready: ${report.formalSubmissionReady}`,
      `Production deployment ready: ${report.productionDeploymentReady}`,
      `Checks: ${report.checksPassed}/${report.checksTotal}`,
      "",
      "Remaining human blockers:",
      ...report.remainingHumanBlockers.map((blocker) => `- ${blocker}`),
      "",
      "Failed checks:",
      ...(failedChecks.length > 0 ? failedChecks.map((check) => `- ${check.id}`) : ["- none"])
    ].join("\n") + "\n",
    "utf8"
  );

  if (failedChecks.length > 0) {
    throw new Error(`Repo strategy audit failed: ${failedChecks.map((check) => check.id).join(", ")}`);
  }

  console.log("EF Protocol Replay Kit repo strategy audit: RepoStrategyEvidenceReady");
  console.log(`Report: ${relative(reportPath)}`);
  console.log(`Transcript: ${relative(transcriptPath)}`);
  console.log("Formal submission ready: false");
}

async function loadContext(): Promise<AuditContext> {
  const files = new Map<string, string>();
  const json = new Map<string, Record<string, unknown>>();
  const packageJson = JSON.parse(await readFile(path.join(REPO_ROOT, "package.json"), "utf8")) as Record<string, unknown>;

  for (const file of requiredTextFiles) {
    files.set(file, await readText(file));
  }
  for (const file of requiredJsonFiles) {
    json.set(file, JSON.parse(await readText(file)) as Record<string, unknown>);
  }

  return { packageJson, files, json };
}

async function readText(file: string): Promise<string> {
  return readFile(path.join(REPO_ROOT, file), "utf8");
}

function text(context: AuditContext, file: string) {
  return context.files.get(file) ?? "";
}

function jsonValue(context: AuditContext, file: string, dottedPath: string): unknown {
  return dottedPath.split(".").reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), context.json.get(file));
}

function hasScript(context: AuditContext, scriptName: string): boolean {
  const scripts = isRecord(context.packageJson.scripts) ? context.packageJson.scripts : {};
  return typeof scripts[scriptName] === "string" && scripts[scriptName].length > 0;
}

function numeric(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function relative(filePath: string) {
  return path.relative(REPO_ROOT, filePath);
}
