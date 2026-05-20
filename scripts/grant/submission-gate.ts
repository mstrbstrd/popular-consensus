import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const OUT_DIR = path.join(REPO_ROOT, "artifacts/grant-demo");

type GateCheck = {
  id: string;
  ok: boolean;
  detail: string;
  evidence?: string;
};

type GateCriterion = {
  id: string;
  status: "evidence-ready" | "clean-run-required" | "human-blocked";
  evidence: string;
  note: string;
};

type JsonRecord = Record<string, unknown>;

const requiredScripts = ["typecheck", "test", "contracts:build", "grant:demo", "grant:crypto-hardening", "replay:verify"];

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const packageJson = await readJson("package.json");
  const replayPackageJson = await readJson("packages/replay/package.json");
  const scripts = isRecord(packageJson.scripts) ? packageJson.scripts : {};
  const replayBin = isRecord(replayPackageJson.bin) ? replayPackageJson.bin : {};
  const fullLifecycle = await readJson("artifacts/grant-demo/full-lifecycle-report.json");
  const cryptoHardening = await readJson("artifacts/grant-demo/crypto-hardening-report.json");
  const packetLint = await readJson("artifacts/grant-demo/packet-lint-report.json");
  const checks: GateCheck[] = [];

  for (const script of requiredScripts) {
    checks.push(
      check(
        `script-${script}`,
        typeof scripts[script] === "string" && scripts[script].length > 0,
        `${script} is declared in package.json`,
        "package.json"
      )
    );
  }

  checks.push(check("demo-verified", fullLifecycle.status === "Verified", "Full lifecycle demo report is Verified", "artifacts/grant-demo/full-lifecycle-report.json"));
  checks.push(
    check(
      "pc-replay-bin",
      replayBin["pc-replay"] === "src/cli.ts",
      "Replay package exposes the pc-replay CLI",
      "packages/replay/package.json"
    )
  );
  checks.push(
    check(
      "verify-bundle-documented",
      (await readText("packages/replay/README.md")).includes("pc-replay verify-bundle"),
      "Replay README documents pc-replay verify-bundle",
      "packages/replay/README.md"
    )
  );
  checks.push(
    check(
      "clean-bundle-verified",
      get(fullLifecycle, "bundleReplay.status") === "Verified",
      "Clean community bundle replay is Verified",
      "artifacts/grant-demo/full-lifecycle-report.json"
    )
  );
  checks.push(
    check(
      "tampered-bundle-mismatch",
      get(fullLifecycle, "tamper.actualStatus") === "Mismatch",
      "Tampered replay returns Mismatch",
      "artifacts/grant-demo/full-lifecycle-report.json"
    )
  );
  checks.push(check("packet-ready", packetLint.status === "PacketReady", "Grant packet lint is PacketReady", "artifacts/grant-demo/packet-lint-report.json"));
  checks.push(check("crypto-hardening-ready", cryptoHardening.status === "CryptoHardeningEvidenceReady" && cryptoHardening.productionDeploymentReady === false, "Crypto hardening evidence is ready without production deployment claims", "artifacts/grant-demo/crypto-hardening-report.json"));

  const scopeBoundary = await readText("grant/ef-protocol-replay-kit/scope-boundary.md");
  checks.push(
    check(
      "scope-excludes-product-monetization",
      includesAll(scopeBoundary.toLowerCase(), ["out of scope", "paid report", "customer sales", "token launch"]),
      "Scope boundary excludes product monetization and token launch claims",
      "grant/ef-protocol-replay-kit/scope-boundary.md"
    )
  );

  const licenseBoundary = await readText("LICENSE-BOUNDARY.md");
  const licensePlan = await readText("grant/ef-protocol-replay-kit/09-license-plan.md");
  checks.push(
    check(
      "license-plan-scoped",
      licenseBoundary.includes("does not license the entire monorepo") && licensePlan.includes("Protocol packages"),
      "Repo has a scoped public-good license plan",
      "LICENSE-BOUNDARY.md"
    )
  );

  const officeHours = await readText("grant/ef-protocol-replay-kit/office-hours-brief.md");
  checks.push(
    check(
      "office-hours-brief-exists",
      officeHours.includes("## Fit Questions") && officeHours.includes("alignment"),
      "Office Hours brief exists for alignment feedback",
      "grant/ef-protocol-replay-kit/office-hours-brief.md"
    )
  );

  const failedChecks = checks.filter((entry) => !entry.ok);
  const criteria: GateCriterion[] = [
    criterion("typecheck-command", "clean-run-required", "package.json", "`pnpm typecheck` is declared and must pass from the review checkout before formal submission."),
    criterion("test-command", "clean-run-required", "package.json", "`pnpm test` is declared and must pass from the review checkout before formal submission."),
    criterion("contracts-build-command", "clean-run-required", "package.json", "`pnpm contracts:build` is declared and must pass from the review checkout before formal submission."),
    criterion("grant-demo", fullLifecycle.status === "Verified" ? "evidence-ready" : "human-blocked", "artifacts/grant-demo/full-lifecycle-report.json", "Full lifecycle replay demo status."),
    criterion("pc-replay-verify-bundle", replayBin["pc-replay"] === "src/cli.ts" ? "evidence-ready" : "human-blocked", "packages/replay/package.json", "CLI entrypoint exists for external bundle replay."),
    criterion("tampered-bundle-fails", get(fullLifecycle, "tamper.actualStatus") === "Mismatch" ? "evidence-ready" : "human-blocked", "artifacts/grant-demo/full-lifecycle-report.json", "Tampered replay must fail with Mismatch."),
    criterion("crypto-hardening", cryptoHardening.status === "CryptoHardeningEvidenceReady" ? "evidence-ready" : "human-blocked", "artifacts/grant-demo/crypto-hardening-report.json", "V2 encrypted-ballot context binding and threshold-share fail-closed evidence."),
    criterion("grant-packet", packetLint.status === "PacketReady" ? "evidence-ready" : "human-blocked", "artifacts/grant-demo/packet-lint-report.json", "Packet lint proves grant docs are present and scoped."),
    criterion("scope-excludes-product-monetization", "evidence-ready", "grant/ef-protocol-replay-kit/scope-boundary.md", "Scope excludes product monetization and token launch claims."),
    criterion("license-plan", "evidence-ready", "LICENSE-BOUNDARY.md", "License plan is scoped to protocol/package/docs/artifact surfaces."),
    criterion("office-hours-feedback-incorporated", "human-blocked", "grant/ef-protocol-replay-kit/12-external-review-intake.md", "EF Office Hours or equivalent feedback has not been incorporated.")
  ];
  const cleanRunRequired = criteria.filter((entry) => entry.status === "clean-run-required").map((entry) => `${entry.id}: ${entry.note}`);
  const humanBlockers = criteria.filter((entry) => entry.status === "human-blocked").map((entry) => `${entry.id}: ${entry.note}`);

  const report = {
    protocol: "popular-consensus",
    schemaVersion: "ef-protocol-replay-kit-submission-gate-v1",
    generatedAt: new Date().toISOString(),
    command: "pnpm grant:submission-gate",
    status: failedChecks.length === 0 ? "SubmissionGateEvidenceReady" : "Mismatch",
    formalSubmissionReady: false,
    productionDeploymentReady: false,
    checksPassed: checks.length - failedChecks.length,
    checksTotal: checks.length,
    failedChecks: failedChecks.map((entry) => entry.id),
    criteria,
    cleanRunRequired,
    humanBlockers,
    checks
  };

  const reportPath = path.join(OUT_DIR, "submission-gate-report.json");
  const transcriptPath = path.join(OUT_DIR, "submission-gate-transcript.txt");
  await writeJson(reportPath, report);
  await writeFile(
    transcriptPath,
    [
      "Popular Consensus Protocol Replay Kit submission gate",
      "",
      "Command: pnpm grant:submission-gate",
      `Status: ${report.status}`,
      `Formal submission ready: ${report.formalSubmissionReady}`,
      `Production deployment ready: ${report.productionDeploymentReady}`,
      `Checks: ${report.checksPassed}/${report.checksTotal}`,
      "",
      "Clean-run required before formal submission:",
      ...cleanRunRequired.map((blocker) => `- ${blocker}`),
      "",
      "Blocked criteria:",
      ...humanBlockers.map((blocker) => `- ${blocker}`),
      "",
      "Failed checks:",
      ...(failedChecks.length > 0 ? failedChecks.map((entry) => `- ${entry.id}: ${entry.detail}`) : ["- none"])
    ].join("\n") + "\n",
    "utf8"
  );

  if (failedChecks.length > 0) {
    throw new Error(`Submission gate evidence failed: ${failedChecks.map((entry) => entry.id).join(", ")}`);
  }

  console.log("EF Protocol Replay Kit submission gate: SubmissionGateEvidenceReady");
  console.log(`Report: ${relative(reportPath)}`);
  console.log(`Transcript: ${relative(transcriptPath)}`);
  console.log("Formal submission ready: false");
}

function criterion(id: string, status: GateCriterion["status"], evidence: string, note: string): GateCriterion {
  return { id, status, evidence, note };
}

function check(id: string, ok: boolean, detail: string, evidence?: string): GateCheck {
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

function includesAll(value: string, needles: string[]) {
  return needles.every((needle) => value.includes(needle));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function relative(filePath: string) {
  return path.relative(REPO_ROOT, filePath);
}
