import { readdir, readFile, writeFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const OUT_DIR = path.join(REPO_ROOT, "artifacts/grant-demo");

type NegativeInvariantCheck = {
  id: string;
  ok: boolean;
  invariant: string;
  detail: string;
  evidence?: string[];
};

type JsonRecord = Record<string, unknown>;

const protocolRoots = [
  "packages/shared",
  "packages/artifacts",
  "packages/privacy",
  "packages/protocol-slice",
  "packages/replay",
  "packages/contracts"
];

const protocolSourceRoots = protocolRoots.map((root) => path.join(root, "src"));
const protocolPackageManifests = protocolRoots.map((root) => path.join(root, "package.json"));
const forbiddenPlatformPackages = ["@pc/api", "@pc/web", "@pc/db"];
const forbiddenRelativePlatformRoots = ["apps/api", "apps/web", "packages/db"];
const forbiddenClientTerms = ["@pc/web", "apps/web", "playwright", "next/", "next ", "react", "use client", "build:e2e", " e2e"];
const productScopeTerms = ["data-union", "paid report", "paid-report", "customer workflow", "customer sales", "buyer approval", "rewards ux", "reward distribution"];
const tokenPitchTerms = ["tokenomics", "token launch"];
const grantEvidenceFiles = [
  "artifacts/grant-demo/full-lifecycle-report.json",
  "artifacts/grant-demo/production-slice-export.json",
  "artifacts/grant-demo/community-export.json",
  "artifacts/grant-demo/tampered-production-slice-export.json",
  "packages/replay/test/fixtures/clean-production-slice-export.json",
  "packages/replay/test/fixtures/clean-community-export.json",
  "packages/replay/test/fixtures/tampered-result-hash.json",
  "packages/replay/test/fixtures/missing-archive-artifact.json",
  "packages/replay/test/fixtures/reordered-events.json"
];

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const packageJson = await readJson("package.json");
  const checks: NegativeInvariantCheck[] = [];

  checks.push(await protocolManifestBoundaryCheck());
  checks.push(await protocolSourceBoundaryCheck());
  checks.push(await grantScriptsAvoidClientCheck(packageJson));
  checks.push(await grantScopeExcludesProductCheck());
  checks.push(await grantEvidenceExcludesProductRecordsCheck());
  checks.push(await noTokenCenteredPitchCheck());
  checks.push(await productionNonClaimsCheck());
  checks.push(await licenseBoundaryCheck());
  checks.push(await replaySourceOfTrustCheck());
  checks.push(await protocolPublicationNonClaimCheck());

  const failedChecks = checks.filter((entry) => !entry.ok);
  const report = {
    protocol: "popular-consensus",
    schemaVersion: "ef-protocol-replay-kit-negative-invariant-audit-v1",
    generatedAt: new Date().toISOString(),
    command: "pnpm grant:negative-invariants",
    status: failedChecks.length === 0 ? "NegativeInvariantsPreserved" : "Mismatch",
    formalSubmissionReady: false,
    productionDeploymentReady: false,
    checksPassed: checks.length - failedChecks.length,
    checksTotal: checks.length,
    failedChecks: failedChecks.map((entry) => entry.id),
    notes: [
      "Legacy data-union schema code may exist elsewhere in the monorepo; this audit checks that grant evidence and replay-kit artifacts do not rely on it.",
      "The audit checks negative-space constraints for grant review and does not replace external cryptography or EF review."
    ],
    checks
  };

  const reportPath = path.join(OUT_DIR, "negative-invariant-report.json");
  const transcriptPath = path.join(OUT_DIR, "negative-invariant-transcript.txt");
  await writeJson(reportPath, report);
  await writeFile(
    transcriptPath,
    [
      "Popular Consensus Protocol Replay Kit negative invariant audit",
      "",
      "Command: pnpm grant:negative-invariants",
      `Status: ${report.status}`,
      `Formal submission ready: ${report.formalSubmissionReady}`,
      `Production deployment ready: ${report.productionDeploymentReady}`,
      `Checks: ${report.checksPassed}/${report.checksTotal}`,
      "",
      "Failed checks:",
      ...(failedChecks.length > 0 ? failedChecks.map((entry) => `- ${entry.id}: ${entry.detail}`) : ["- none"]),
      "",
      "Notes:",
      ...report.notes.map((entry) => `- ${entry}`)
    ].join("\n") + "\n",
    "utf8"
  );

  if (failedChecks.length > 0) {
    throw new Error(`Negative invariant audit failed: ${failedChecks.map((entry) => entry.id).join(", ")}`);
  }

  console.log("EF Protocol Replay Kit negative invariant audit: NegativeInvariantsPreserved");
  console.log(`Report: ${relative(reportPath)}`);
  console.log(`Transcript: ${relative(transcriptPath)}`);
  console.log("Formal submission ready: false");
}

async function protocolManifestBoundaryCheck(): Promise<NegativeInvariantCheck> {
  const violations: string[] = [];
  for (const manifestPath of protocolPackageManifests) {
    const manifest = await readJson(manifestPath);
    const dependencies = [
      ...Object.keys(recordValue(manifest.dependencies)),
      ...Object.keys(recordValue(manifest.devDependencies)),
      ...Object.keys(recordValue(manifest.peerDependencies)),
      ...Object.keys(recordValue(manifest.optionalDependencies))
    ];
    for (const dependency of dependencies) {
      if (forbiddenPlatformPackages.includes(dependency)) violations.push(`${manifestPath}: ${dependency}`);
    }
  }
  return check(
    "protocol-manifests-do-not-import-platform",
    violations.length === 0,
    "Protocol packages must not declare platform package dependencies.",
    violations.length === 0 ? "No forbidden platform package dependencies found." : `Forbidden dependencies: ${violations.join(", ")}`,
    protocolPackageManifests
  );
}

async function protocolSourceBoundaryCheck(): Promise<NegativeInvariantCheck> {
  const violations: string[] = [];
  for (const root of protocolSourceRoots) {
    const absoluteRoot = path.join(REPO_ROOT, root);
    if (!(await pathExists(absoluteRoot))) continue;
    for (const file of await listSourceFiles(absoluteRoot)) {
      const source = await readAbsolute(file);
      for (const occurrence of findImportSpecifiers(source)) {
        if (forbiddenPlatformPackages.some((name) => occurrence.specifier === name || occurrence.specifier.startsWith(`${name}/`))) {
          violations.push(`${relative(file)} imports ${occurrence.specifier}`);
        }
        if (occurrence.specifier.startsWith(".")) {
          const target = path.resolve(path.dirname(file), occurrence.specifier);
          for (const rootPath of forbiddenRelativePlatformRoots) {
            if (isInside(target, path.join(REPO_ROOT, rootPath))) violations.push(`${relative(file)} imports ${rootPath}`);
          }
        }
      }
    }
  }
  return check(
    "protocol-source-does-not-import-platform",
    violations.length === 0,
    "Protocol source must not import platform paths or packages.",
    violations.length === 0 ? "No forbidden source imports found." : `Forbidden imports: ${violations.join("; ")}`,
    protocolSourceRoots
  );
}

async function grantScriptsAvoidClientCheck(packageJson: JsonRecord): Promise<NegativeInvariantCheck> {
  const scriptViolations: string[] = [];
  const packageScripts = recordValue(packageJson.scripts);
  for (const [name, value] of Object.entries(packageScripts)) {
    if (!name.startsWith("grant:")) continue;
    const command = String(value).toLowerCase();
    const hit = forbiddenClientTerms.find((term) => command.includes(term));
    if (hit) scriptViolations.push(`${name}: ${hit}`);
  }
  for (const file of await listSourceFiles(path.join(REPO_ROOT, "scripts/grant"))) {
    const source = await readAbsolute(file);
    for (const occurrence of findImportSpecifiers(source)) {
      const specifier = occurrence.specifier.toLowerCase();
      const hit = forbiddenClientTerms.find((term) => specifier.includes(term.trim()));
      if (hit) scriptViolations.push(`${relative(file)} imports ${occurrence.specifier}`);
    }
  }
  return check(
    "grant-path-has-no-web-client-dependency",
    scriptViolations.length === 0,
    "Grant demos and evidence scripts must not depend on the web client or e2e stack.",
    scriptViolations.length === 0 ? "No web-client/e2e dependencies found in grant scripts." : `Client dependencies found: ${scriptViolations.join("; ")}`,
    ["package.json", "scripts/grant"]
  );
}

async function grantScopeExcludesProductCheck(): Promise<NegativeInvariantCheck> {
  const scopeBoundary = await readText("grant/ef-protocol-replay-kit/scope-boundary.md");
  const officeHours = await readText("grant/ef-protocol-replay-kit/office-hours-brief.md");
  const issueDraft = await readText("grant/ef-protocol-replay-kit/19-grant-track-issue.md");
  const combined = `${scopeBoundary}\n${officeHours}\n${issueDraft}`.toLowerCase();
  const requiredExclusions = ["out of scope", "paid report", "customer", "token launch", "data-union"];
  const missing = requiredExclusions.filter((term) => !combined.includes(term));
  return check(
    "grant-scope-excludes-product-and-data-union",
    missing.length === 0,
    "Grant scope must exclude product monetization, customer workflows, token launch, and data-union monetization.",
    missing.length === 0 ? "Product/data-union exclusions are explicit." : `Missing exclusions: ${missing.join(", ")}`,
    ["grant/ef-protocol-replay-kit/scope-boundary.md", "grant/ef-protocol-replay-kit/office-hours-brief.md", "grant/ef-protocol-replay-kit/19-grant-track-issue.md"]
  );
}

async function grantEvidenceExcludesProductRecordsCheck(): Promise<NegativeInvariantCheck> {
  const violations: string[] = [];
  for (const file of grantEvidenceFiles) {
    const text = (await readText(file)).toLowerCase();
    const hit = [...productScopeTerms, ...tokenPitchTerms].find((term) => text.includes(term));
    if (hit) violations.push(`${file}: ${hit}`);
  }
  return check(
    "grant-evidence-does-not-use-product-records",
    violations.length === 0,
    "Grant exports, reports, and replay fixtures must not rely on product/data-union monetization records.",
    violations.length === 0 ? "No product/data-union/token records found in grant evidence fixtures." : `Product-scope evidence found: ${violations.join("; ")}`,
    grantEvidenceFiles
  );
}

async function noTokenCenteredPitchCheck(): Promise<NegativeInvariantCheck> {
  const abstract = (await readText("grant/ef-protocol-replay-kit/00-abstract.md")).toLowerCase();
  const officeHours = (await readText("grant/ef-protocol-replay-kit/office-hours-brief.md")).toLowerCase();
  const officeHoursPitch = officeHours.split("## out of scope")[0] ?? officeHours;
  const pitchText = `${abstract}\n${officeHoursPitch}`;
  const hits = ["tokenomics", "token launch", "pctoken"].filter((term) => pitchText.includes(term));
  return check(
    "grant-pitch-is-not-token-centered",
    hits.length === 0,
    "Grant pitch must not center token launch or tokenomics.",
    hits.length === 0 ? "No token-centered pitch terms found in abstract or pre-scope office-hours brief." : `Token-centered pitch terms found: ${hits.join(", ")}`,
    ["grant/ef-protocol-replay-kit/00-abstract.md", "grant/ef-protocol-replay-kit/office-hours-brief.md"]
  );
}

async function productionNonClaimsCheck(): Promise<NegativeInvariantCheck> {
  const reports = [
    "artifacts/grant-demo/review-readiness-report.json",
    "artifacts/grant-demo/reviewer-handoff-report.json",
    "artifacts/grant-demo/repo-strategy-audit-report.json",
    "artifacts/grant-demo/submission-gate-report.json",
    "artifacts/grant-demo/external-review-index.json",
    "artifacts/grant-demo/contract-hardening-report.json",
    "artifacts/grant-demo/threshold-custody-report.json"
  ];
  const violations: string[] = [];
  for (const file of reports) {
    const report = await readJson(file);
    if (report.formalSubmissionReady === true) violations.push(`${file}: formalSubmissionReady true`);
    if (report.productionDeploymentReady === true) violations.push(`${file}: productionDeploymentReady true`);
  }
  const cryptoDoc = await readText("grant/ef-protocol-replay-kit/11-cryptography-review.md");
  const thresholdDoc = await readText("grant/ef-protocol-replay-kit/15-threshold-custody-hardening.md");
  if (!cryptoDoc.includes("production threshold key ceremony or custody")) violations.push("cryptography review missing production custody non-claim");
  if (!thresholdDoc.includes("not enough for a production privacy claim")) violations.push("threshold custody doc missing production privacy non-claim");
  return check(
    "no-production-privacy-or-deployment-overclaim",
    violations.length === 0,
    "Reports and crypto docs must not claim formal submission or production privacy/deployment readiness.",
    violations.length === 0 ? "Production and formal-submission non-claims remain explicit." : `Overclaims found: ${violations.join("; ")}`,
    [...reports, "grant/ef-protocol-replay-kit/11-cryptography-review.md", "grant/ef-protocol-replay-kit/15-threshold-custody-hardening.md"]
  );
}

async function licenseBoundaryCheck(): Promise<NegativeInvariantCheck> {
  const boundary = await readText("LICENSE-BOUNDARY.md");
  const plan = await readText("grant/ef-protocol-replay-kit/09-license-plan.md");
  const publication = await readJson("artifacts/grant-demo/protocol-publication-report.json");
  const ok =
    boundary.includes("does not license the entire monorepo") &&
    boundary.includes("Platform Code") &&
    plan.includes("Do not imply that the whole monorepo is MIT licensed") &&
    publication.sourceReuseReady === true &&
    publication.npmPublicationReady === false;
  return check(
    "license-boundary-is-not-blurred",
    ok,
    "Protocol, packet, artifact, platform, and npm-publication boundaries must stay separate.",
    ok ? "License and publication boundaries are explicit." : "License or publication boundary evidence is missing.",
    ["LICENSE-BOUNDARY.md", "grant/ef-protocol-replay-kit/09-license-plan.md", "artifacts/grant-demo/protocol-publication-report.json"]
  );
}

async function replaySourceOfTrustCheck(): Promise<NegativeInvariantCheck> {
  const boundary = await readText("grant/ef-protocol-replay-kit/01-protocol-boundary.md");
  const readme = await readText("grant/ef-protocol-replay-kit/README.md");
  const replayRules = await readText("grant/ef-protocol-replay-kit/04-replay-rules.md");
  const ok =
    boundary.includes("must not be the source of protocol truth") &&
    readme.includes("without relying on the application database as the source of truth") &&
    replayRules.includes("replay verifier checks");
  return check(
    "replay-remains-source-of-trust",
    ok,
    "Grant packet must make replay/export verification the trust source, not the platform database or UI.",
    ok ? "Replay/source-of-truth language is present." : "Replay/source-of-truth language is incomplete.",
    ["grant/ef-protocol-replay-kit/01-protocol-boundary.md", "grant/ef-protocol-replay-kit/README.md", "grant/ef-protocol-replay-kit/04-replay-rules.md"]
  );
}

async function protocolPublicationNonClaimCheck(): Promise<NegativeInvariantCheck> {
  const report = await readJson("artifacts/grant-demo/protocol-publication-report.json");
  const ok = report.sourceReuseReady === true && report.npmPublicationReady === false && report.noPublishGuardActive === true;
  return check(
    "protocol-source-reuse-does-not-claim-npm-publication",
    ok,
    "Protocol source reuse must not be blurred into npm publication readiness.",
    ok ? "Source reuse is ready while npm publication remains a non-claim." : "Protocol publication status is ambiguous.",
    ["artifacts/grant-demo/protocol-publication-report.json"]
  );
}

async function listSourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", "dist", "build", "coverage", ".next", ".turbo"].includes(entry.name)) return [];
        return listSourceFiles(entryPath);
      }
      return [".ts", ".tsx", ".js", ".mjs", ".cjs", ".sol"].includes(path.extname(entry.name)) ? [entryPath] : [];
    })
  );
  return files.flat();
}

function findImportSpecifiers(source: string) {
  const specifiers: Array<{ specifier: string; index: number }> = [];
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier) specifiers.push({ specifier, index: match.index ?? 0 });
    }
  }
  return specifiers;
}

async function readJson(file: string): Promise<JsonRecord> {
  return JSON.parse(await readText(file)) as JsonRecord;
}

async function readText(file: string): Promise<string> {
  return readAbsolute(path.join(REPO_ROOT, file));
}

async function readAbsolute(file: string): Promise<string> {
  return readFile(file, "utf8");
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function recordValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function check(id: string, ok: boolean, invariant: string, detail: string, evidence?: string[]): NegativeInvariantCheck {
  return { id, ok, invariant, detail, evidence };
}

function isInside(target: string, root: string) {
  const relativePath = path.relative(root, target);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function relative(filePath: string) {
  return path.relative(REPO_ROOT, filePath);
}
