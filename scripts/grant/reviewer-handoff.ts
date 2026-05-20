import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const OUT_DIR = path.join(REPO_ROOT, "artifacts/grant-demo");

type DependencyMode = "no-local-services" | "local-postgres" | "ephemeral-anvil" | "local-postgres-and-ephemeral-anvil";

type ReviewerCommand = {
  id: string;
  command: string;
  packageScript: string;
  dependencyMode: DependencyMode;
  purpose: string;
  expectedStatus: string;
  outputs: string[];
};

type HandoffCheck = {
  id: string;
  ok: boolean;
  detail: string;
  evidence?: string;
};

type PackageJson = {
  scripts?: Record<string, string>;
};

const reviewerCommands: ReviewerCommand[] = [
  {
    id: "quick-machine-evidence",
    command: "pnpm grant:check",
    packageScript: "grant:check",
    dependencyMode: "no-local-services",
    purpose: "Regenerate the backend lifecycle fixture, replay bundle evidence, grant packet lint, crypto inventory, threshold custody hardening, replay test vectors, contract-hardening evidence, repo strategy audit, submission gate, protocol publication status, negative invariant audit, external review index, manifest, readiness report, and replay tests.",
    expectedStatus: "All machine checks pass while formalSubmissionReady remains false.",
    outputs: [
      "artifacts/grant-demo/full-lifecycle-report.json",
      "artifacts/grant-demo/crypto-review-report.json",
      "artifacts/grant-demo/threshold-custody-report.json",
      "artifacts/grant-demo/replay-test-vectors-report.json",
      "artifacts/grant-demo/contract-hardening-report.json",
      "artifacts/grant-demo/repo-strategy-audit-report.json",
      "artifacts/grant-demo/submission-gate-report.json",
      "artifacts/grant-demo/protocol-publication-report.json",
      "artifacts/grant-demo/negative-invariant-report.json",
      "artifacts/grant-demo/external-review-index.json",
      "artifacts/grant-demo/packet-lint-report.json",
      "artifacts/grant-demo/evidence-manifest.json",
      "artifacts/grant-demo/review-readiness-report.json"
    ]
  },
  {
    id: "db-backed-api-replay",
    command: "pnpm grant:api-replay",
    packageScript: "grant:api-replay",
    dependencyMode: "local-postgres",
    purpose: "Drive the public civic-record API and verify the exported record through pc-replay verify-api.",
    expectedStatus: "Verified",
    outputs: ["artifacts/grant-demo/api-replay-report.json", "artifacts/grant-demo/api-replay-transcript.txt"]
  },
  {
    id: "local-chain-replay",
    command: "pnpm grant:chain-replay",
    packageScript: "grant:chain-replay",
    dependencyMode: "ephemeral-anvil",
    purpose: "Deploy the protocol modules to an ephemeral local chain and replay decoded Solidity logs.",
    expectedStatus: "Verified",
    outputs: ["artifacts/grant-demo/chain-replay-report.json", "artifacts/grant-demo/chain-replay-transcript.txt"]
  },
  {
    id: "full-local-gate",
    command: "pnpm grant:full-check",
    packageScript: "grant:full-check",
    dependencyMode: "local-postgres-and-ephemeral-anvil",
    purpose: "Run typecheck, repo tests, contract build, DB-backed API replay, local-chain replay, and quick machine evidence checks.",
    expectedStatus: "Machine evidence ready, formal submission still blocked on human review.",
    outputs: [
      "artifacts/grant-demo/api-replay-report.json",
      "artifacts/grant-demo/chain-replay-report.json",
      "artifacts/grant-demo/review-readiness-report.json",
      "artifacts/grant-demo/evidence-manifest.json"
    ]
  }
];

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const packageJson = JSON.parse(await readFile(path.join(REPO_ROOT, "package.json"), "utf8")) as PackageJson;
  const scripts = packageJson.scripts ?? {};
  const checks: HandoffCheck[] = [];

  for (const command of reviewerCommands) {
    checks.push(
      check(
        `script-${command.packageScript}`,
        typeof scripts[command.packageScript] === "string" && scripts[command.packageScript].length > 0,
        `${command.packageScript} is declared in package.json`,
        "package.json"
      )
    );
  }

  checks.push(
    check(
      "quick-command-avoids-local-services",
      !containsAny(scripts["grant:check"], ["grant:api-replay", "grant:chain-replay", "docker compose", "db:migrate"]),
      "pnpm grant:check stays suitable for no-service reviewer reproduction",
      "package.json"
    )
  );
  checks.push(
    check(
      "full-check-covers-api-replay",
      containsAll(scripts["grant:full-check"], ["typecheck", "test", "contracts:build", "grant:api-replay", "grant:chain-replay", "grant:check"]),
      "pnpm grant:full-check covers the broad local evidence gate",
      "package.json"
    )
  );

  const packetReadme = await readText("grant/ef-protocol-replay-kit/README.md");
  checks.push(
    check(
      "packet-readme-documents-quick-path",
      packetReadme.includes("pnpm grant:check") && packetReadme.includes("Reviewer Quick Start"),
      "Packet README documents the quick reviewer path",
      "grant/ef-protocol-replay-kit/README.md"
    )
  );
  checks.push(
    check(
      "packet-readme-documents-full-path",
      packetReadme.includes("pnpm grant:full-check") && packetReadme.includes("Full Local Evidence Gate"),
      "Packet README documents the full local evidence gate",
      "grant/ef-protocol-replay-kit/README.md"
    )
  );

  const handoffDoc = await readText("grant/ef-protocol-replay-kit/14-reviewer-handoff.md");
  for (const command of reviewerCommands) {
    checks.push(
      check(
        `handoff-doc-${command.packageScript}`,
        handoffDoc.includes(command.command) && handoffDoc.includes(command.dependencyMode),
        `Reviewer handoff doc includes ${command.command} and its dependency mode`,
        "grant/ef-protocol-replay-kit/14-reviewer-handoff.md"
      )
    );
  }

  const failedChecks = checks.filter((entry) => !entry.ok);
  const report = {
    protocol: "popular-consensus",
    schemaVersion: "ef-protocol-replay-kit-reviewer-handoff-v1",
    generatedAt: new Date().toISOString(),
    command: "pnpm grant:reviewer-handoff",
    status: failedChecks.length === 0 ? "ReviewerHandoffReady" : "Mismatch",
    formalSubmissionReady: false,
    productionDeploymentReady: false,
    dependencyModes: Array.from(new Set(reviewerCommands.map((entry) => entry.dependencyMode))),
    reviewerCommands,
    checksPassed: checks.length - failedChecks.length,
    checksTotal: checks.length,
    failedChecks: failedChecks.map((entry) => entry.id),
    checks
  };

  const reportPath = path.join(OUT_DIR, "reviewer-handoff-report.json");
  const transcriptPath = path.join(OUT_DIR, "reviewer-handoff-transcript.txt");
  await writeJson(reportPath, report);
  await writeFile(
    transcriptPath,
    [
      "Popular Consensus Protocol Replay Kit reviewer handoff",
      "",
      "Command: pnpm grant:reviewer-handoff",
      `Status: ${report.status}`,
      `Formal submission ready: ${report.formalSubmissionReady}`,
      `Production deployment ready: ${report.productionDeploymentReady}`,
      `Checks: ${report.checksPassed}/${report.checksTotal}`,
      "",
      "Reviewer commands:",
      ...reviewerCommands.map((entry) => `- ${entry.command} [${entry.dependencyMode}]: ${entry.expectedStatus}`),
      "",
      "Failed checks:",
      ...(failedChecks.length > 0 ? failedChecks.map((entry) => `- ${entry.id}: ${entry.detail}`) : ["- none"])
    ].join("\n") + "\n",
    "utf8"
  );

  if (failedChecks.length > 0) {
    throw new Error(`Reviewer handoff checks failed: ${failedChecks.map((entry) => entry.id).join(", ")}`);
  }

  console.log("EF Protocol Replay Kit reviewer handoff: ReviewerHandoffReady");
  console.log(`Report: ${relative(reportPath)}`);
  console.log(`Transcript: ${relative(transcriptPath)}`);
  console.log("Formal submission ready: false");
}

async function readText(file: string): Promise<string> {
  return readFile(path.join(REPO_ROOT, file), "utf8");
}

function check(id: string, ok: boolean, detail: string, evidence?: string): HandoffCheck {
  return { id, ok, detail, evidence };
}

function containsAny(value: string | undefined, needles: string[]) {
  return typeof value === "string" && needles.some((needle) => value.includes(needle));
}

function containsAll(value: string | undefined, needles: string[]) {
  return typeof value === "string" && needles.every((needle) => value.includes(needle));
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function relative(filePath: string) {
  return path.relative(REPO_ROOT, filePath);
}
