import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const OUT_DIR = path.join(REPO_ROOT, "artifacts/grant-demo");

type PackageManifest = {
  name?: string;
  private?: boolean;
  license?: string;
  main?: string;
  types?: string;
  bin?: Record<string, string>;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

type PublicationCheck = {
  id: string;
  ok: boolean;
  detail: string;
  evidence?: string;
};

const protocolPackageManifests = [
  "packages/shared/package.json",
  "packages/artifacts/package.json",
  "packages/privacy/package.json",
  "packages/protocol-slice/package.json",
  "packages/replay/package.json",
  "packages/contracts/package.json"
];

const forbiddenPlatformDependencies = ["@pc/api", "@pc/web", "@pc/db"];

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const packages = [];
  const checks: PublicationCheck[] = [];

  for (const manifestPath of protocolPackageManifests) {
    const manifest = (await readJson(manifestPath)) as PackageManifest;
    const packageId = path.basename(path.dirname(manifestPath));
    const dependencyNames = [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
      ...Object.keys(manifest.optionalDependencies ?? {})
    ];
    const forbiddenDependencies = dependencyNames.filter((name) => forbiddenPlatformDependencies.includes(name));
    const hasSourceEntrypoint = typeof manifest.main === "string" || manifestPath === "packages/contracts/package.json";
    const hasVerificationScript = Boolean(manifest.scripts?.test || manifest.scripts?.build || manifest.scripts?.verify);

    checks.push(check(`${packageId}-name`, typeof manifest.name === "string" && manifest.name.startsWith("@pc/"), `${manifestPath} has a scoped package name`, manifestPath));
    checks.push(check(`${packageId}-mit-license`, manifest.license === "MIT", `${manifestPath} declares MIT`, manifestPath));
    checks.push(check(`${packageId}-private-guard`, manifest.private === true, `${manifestPath} keeps accidental npm publish disabled`, manifestPath));
    checks.push(check(`${packageId}-source-entrypoint`, hasSourceEntrypoint, `${manifestPath} exposes source or contract build entrypoint`, manifestPath));
    checks.push(check(`${packageId}-verification-script`, hasVerificationScript, `${manifestPath} exposes a local verification script`, manifestPath));
    checks.push(check(`${packageId}-no-platform-deps`, forbiddenDependencies.length === 0, `${manifestPath} has no platform package dependencies`, manifestPath));

    packages.push({
      path: manifestPath,
      name: manifest.name ?? null,
      license: manifest.license ?? null,
      private: manifest.private === true,
      sourceEntrypoint: manifest.main ?? manifest.bin ?? "contracts-build",
      verificationScripts: Object.keys(manifest.scripts ?? {}).filter((script) => ["test", "typecheck", "build", "verify"].includes(script)),
      forbiddenPlatformDependencies: forbiddenDependencies
    });
  }

  const failedChecks = checks.filter((entry) => !entry.ok);
  const allPackagesHaveNoPublishGuard = packages.every((entry) => entry.private);
  const report = {
    protocol: "popular-consensus",
    schemaVersion: "ef-protocol-replay-kit-protocol-publication-v1",
    generatedAt: new Date().toISOString(),
    command: "pnpm grant:protocol-publication",
    status: failedChecks.length === 0 ? "ProtocolPackagePublicationEvidenceReady" : "Mismatch",
    sourceReuseReady: failedChecks.length === 0,
    npmPublicationReady: false,
    noPublishGuardActive: allPackagesHaveNoPublishGuard,
    checksPassed: checks.length - failedChecks.length,
    checksTotal: checks.length,
    failedChecks: failedChecks.map((entry) => entry.id),
    packages,
    nonClaims: [
      "The protocol packages are not claimed to be npm-publication-ready.",
      "The private package flag is treated as an accidental-publication guard, not as a proprietary license claim.",
      "Registry package names, build outputs, and publish access still need maintainer review before publication."
    ],
    checks
  };

  const reportPath = path.join(OUT_DIR, "protocol-publication-report.json");
  const transcriptPath = path.join(OUT_DIR, "protocol-publication-transcript.txt");
  await writeJson(reportPath, report);
  await writeFile(
    transcriptPath,
    [
      "Popular Consensus Protocol Replay Kit protocol package publication status",
      "",
      "Command: pnpm grant:protocol-publication",
      `Status: ${report.status}`,
      `Source reuse ready: ${report.sourceReuseReady}`,
      `NPM publication ready: ${report.npmPublicationReady}`,
      `No-publish guard active: ${report.noPublishGuardActive}`,
      `Checks: ${report.checksPassed}/${report.checksTotal}`,
      "",
      "Non-claims:",
      ...report.nonClaims.map((entry) => `- ${entry}`),
      "",
      "Failed checks:",
      ...(failedChecks.length > 0 ? failedChecks.map((entry) => `- ${entry.id}: ${entry.detail}`) : ["- none"])
    ].join("\n") + "\n",
    "utf8"
  );

  if (failedChecks.length > 0) {
    throw new Error(`Protocol package publication evidence failed: ${failedChecks.map((entry) => entry.id).join(", ")}`);
  }

  console.log("EF Protocol Replay Kit protocol publication evidence: ProtocolPackagePublicationEvidenceReady");
  console.log(`Report: ${relative(reportPath)}`);
  console.log(`Transcript: ${relative(transcriptPath)}`);
  console.log("NPM publication ready: false");
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(REPO_ROOT, file), "utf8"));
}

function check(id: string, ok: boolean, detail: string, evidence?: string): PublicationCheck {
  return { id, ok, detail, evidence };
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function relative(filePath: string) {
  return path.relative(REPO_ROOT, filePath);
}
