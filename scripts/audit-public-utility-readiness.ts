import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type Check = {
  id: string;
  passed: boolean;
  detail: string;
};

const root = process.cwd();
const strict = process.argv.includes("--strict");
const json = process.argv.includes("--json");

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function fileExists(relativePath: string): boolean {
  return existsSync(path.join(root, relativePath));
}

function fileContains(relativePath: string, value: string): boolean {
  return fileExists(relativePath) && read(relativePath).includes(value);
}

const requiredFoundationFiles = [
  "docs/public-utility-roadmap.md",
  "docs/trust-assumption-register.md",
  "docs/protocol-claims.md"
];

const requiredPublicGoodFiles = [
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "GOVERNANCE.md",
  "MAINTAINERS.md"
];

const checks: Check[] = [
  {
    id: "readiness-foundation",
    passed: requiredFoundationFiles.every(fileExists),
    detail: "Public-utility roadmap, trust register, and claims policy exist."
  },
  {
    id: "public-good-policies",
    passed: requiredPublicGoodFiles.every(fileExists),
    detail: `Missing: ${requiredPublicGoodFiles.filter((file) => !fileExists(file)).join(", ") || "none"}`
  },
  {
    id: "production-deployment-adapter",
    passed: fileExists("packages/contracts/scripts/deploy-public-testnet.mjs"),
    detail: "A dedicated guarded public-testnet deployment adapter must exist."
  },
  {
    id: "no-known-development-key-fallback",
    passed: !fileContains("packages/contracts/scripts/deploy-local.mjs", "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"),
    detail: "Known development private-key fallback remains in the local deploy adapter and must be impossible in public-testnet paths."
  },
  {
    id: "canonical-event-source",
    passed: !fileContains("apps/api/src/server.ts", 'const PROTOCOL_EVENT_SOURCE_TYPE = "local-devnet"'),
    detail: "The API still labels protocol events as local-devnet rather than indexing a canonical live network."
  },
  {
    id: "no-complete-tally-private-key",
    passed: !fileContains("packages/db/prisma/schema.prisma", "tallyPrivateKeyPem"),
    detail: "The production-shaped database schema must not contain a complete tally private key."
  },
  {
    id: "private-eligibility-proof",
    passed:
      !fileContains("packages/privacy/src/index.ts", "credentialSecret: string") &&
      !fileContains("packages/privacy/src/index.ts", "verifyDemoCredential"),
    detail: "Credential verification still relies on the reusable credential secret reaching verification code."
  },
  {
    id: "multi-operator-client",
    passed: !fileContains("apps/web/components/TransitDemo.tsx", "const apiBase =") && fileExists("apps/web/src/operators"),
    detail: "The web client still targets a single API endpoint and has no operator discovery/failover module."
  },
  {
    id: "replicated-artifact-storage",
    passed: fileExists("packages/artifacts/src/replicated.ts"),
    detail: "Only the local file artifact adapter is currently evidenced."
  },
  {
    id: "live-community-fork",
    passed: fileExists("docs/live-community-fork.md"),
    detail: "Community import remains read-only until a live continuation protocol is implemented and documented."
  },
  {
    id: "independent-public-testnet",
    passed: fileExists("docs/public-testnet-launch-summary.md") && fileContains("docs/decentralized-protocol-roadmap.md", "- [x] Run public testnet with independent operators."),
    detail: "Independent operator attestations and a reviewed GO launch summary remain required."
  },
  {
    id: "external-security-evidence",
    passed: fileExists("docs/security/external-review-summary.md"),
    detail: "Independent contract, cryptography, application, privacy, accessibility, and governance review evidence is not yet recorded."
  }
];

const passed = checks.filter((check) => check.passed).length;
const failed = checks.length - passed;
const status = failed === 0 ? "Ready" : "Not ready";

if (json) {
  console.log(JSON.stringify({ protocol: "popular-consensus", schemaVersion: "public-utility-readiness-v0", status, passed, failed, checks }, null, 2));
} else {
  console.log(`Popular Consensus public utility readiness: ${status}`);
  console.log(`${passed}/${checks.length} checks passed`);
  for (const check of checks) {
    console.log(`${check.passed ? "[pass]" : "[open]"} ${check.id}: ${check.detail}`);
  }
  if (failed > 0) {
    console.log("\nThese open checks are expected during implementation. Use --strict only when every public-utility gate should be complete.");
  }
}

if (strict && failed > 0) process.exitCode = 1;
