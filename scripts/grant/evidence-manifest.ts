import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const OUT_DIR = path.join(REPO_ROOT, "artifacts/grant-demo");

type EvidenceEntry = {
  path: string;
  kind: "doc" | "license" | "report" | "transcript" | "export" | "source" | "test";
  bytes: number;
  sha256: string;
};

const evidenceFiles: Array<{ path: string; kind: EvidenceEntry["kind"] }> = [
  { path: "LICENSE-BOUNDARY.md", kind: "license" },
  { path: "LICENSE-PROTOCOL-MIT", kind: "license" },
  { path: "grant/ef-protocol-replay-kit/LICENSE-CC-BY-4.0.md", kind: "license" },
  { path: "artifacts/grant-demo/LICENSE-CC0.md", kind: "license" },
  { path: "grant/ef-protocol-replay-kit/README.md", kind: "doc" },
  { path: "grant/ef-protocol-replay-kit/00-abstract.md", kind: "doc" },
  { path: "grant/ef-protocol-replay-kit/01-protocol-boundary.md", kind: "doc" },
  { path: "grant/ef-protocol-replay-kit/02-event-schema.md", kind: "doc" },
  { path: "grant/ef-protocol-replay-kit/03-artifact-schema.md", kind: "doc" },
  { path: "grant/ef-protocol-replay-kit/04-replay-rules.md", kind: "doc" },
  { path: "grant/ef-protocol-replay-kit/05-threat-model.md", kind: "doc" },
  { path: "grant/ef-protocol-replay-kit/06-demo-transcript.md", kind: "doc" },
  { path: "grant/ef-protocol-replay-kit/07-budget-and-milestones.md", kind: "doc" },
  { path: "grant/ef-protocol-replay-kit/08-review-readiness.md", kind: "doc" },
  { path: "grant/ef-protocol-replay-kit/09-license-plan.md", kind: "doc" },
  { path: "grant/ef-protocol-replay-kit/10-api-replay-transcript.md", kind: "doc" },
  { path: "grant/ef-protocol-replay-kit/11-cryptography-review.md", kind: "doc" },
  { path: "grant/ef-protocol-replay-kit/12-external-review-intake.md", kind: "doc" },
  { path: "grant/ef-protocol-replay-kit/13-contract-hardening-status.md", kind: "doc" },
  { path: "grant/ef-protocol-replay-kit/14-reviewer-handoff.md", kind: "doc" },
  { path: "grant/ef-protocol-replay-kit/15-threshold-custody-hardening.md", kind: "doc" },
  { path: "grant/ef-protocol-replay-kit/16-replay-test-vectors.md", kind: "doc" },
  { path: "grant/ef-protocol-replay-kit/17-repo-strategy-audit.md", kind: "doc" },
  { path: "grant/ef-protocol-replay-kit/18-external-review-index.md", kind: "doc" },
  { path: "grant/ef-protocol-replay-kit/19-grant-track-issue.md", kind: "doc" },
  { path: "grant/ef-protocol-replay-kit/20-submission-gate.md", kind: "doc" },
  { path: "grant/ef-protocol-replay-kit/21-protocol-package-publication.md", kind: "doc" },
  { path: "grant/ef-protocol-replay-kit/22-negative-invariant-audit.md", kind: "doc" },
  { path: "grant/ef-protocol-replay-kit/23-crypto-hardening-evidence.md", kind: "doc" },
  { path: "grant/ef-protocol-replay-kit/office-hours-brief.md", kind: "doc" },
  { path: "grant/ef-protocol-replay-kit/scope-boundary.md", kind: "doc" },
  { path: "artifacts/grant-demo/full-lifecycle-report.json", kind: "report" },
  { path: "artifacts/grant-demo/api-replay-report.json", kind: "report" },
  { path: "artifacts/grant-demo/chain-replay-report.json", kind: "report" },
  { path: "artifacts/grant-demo/crypto-review-report.json", kind: "report" },
  { path: "artifacts/grant-demo/crypto-hardening-report.json", kind: "report" },
  { path: "artifacts/grant-demo/threshold-custody-report.json", kind: "report" },
  { path: "artifacts/grant-demo/replay-test-vectors-report.json", kind: "report" },
  { path: "artifacts/grant-demo/contract-hardening-report.json", kind: "report" },
  { path: "artifacts/grant-demo/packet-lint-report.json", kind: "report" },
  { path: "artifacts/grant-demo/reviewer-handoff-report.json", kind: "report" },
  { path: "artifacts/grant-demo/repo-strategy-audit-report.json", kind: "report" },
  { path: "artifacts/grant-demo/submission-gate-report.json", kind: "report" },
  { path: "artifacts/grant-demo/protocol-publication-report.json", kind: "report" },
  { path: "artifacts/grant-demo/negative-invariant-report.json", kind: "report" },
  { path: "artifacts/grant-demo/external-review-index.json", kind: "report" },
  { path: "artifacts/grant-demo/api-replay-transcript.txt", kind: "transcript" },
  { path: "artifacts/grant-demo/chain-replay-transcript.txt", kind: "transcript" },
  { path: "artifacts/grant-demo/crypto-review-transcript.txt", kind: "transcript" },
  { path: "artifacts/grant-demo/crypto-hardening-transcript.txt", kind: "transcript" },
  { path: "artifacts/grant-demo/threshold-custody-transcript.txt", kind: "transcript" },
  { path: "artifacts/grant-demo/replay-test-vectors-transcript.txt", kind: "transcript" },
  { path: "artifacts/grant-demo/contract-hardening-transcript.txt", kind: "transcript" },
  { path: "artifacts/grant-demo/packet-lint-transcript.txt", kind: "transcript" },
  { path: "artifacts/grant-demo/reviewer-handoff-transcript.txt", kind: "transcript" },
  { path: "artifacts/grant-demo/repo-strategy-audit-transcript.txt", kind: "transcript" },
  { path: "artifacts/grant-demo/submission-gate-transcript.txt", kind: "transcript" },
  { path: "artifacts/grant-demo/protocol-publication-transcript.txt", kind: "transcript" },
  { path: "artifacts/grant-demo/negative-invariant-transcript.txt", kind: "transcript" },
  { path: "artifacts/grant-demo/external-review-index.md", kind: "transcript" },
  { path: "artifacts/grant-demo/production-slice-export.json", kind: "export" },
  { path: "artifacts/grant-demo/community-export.json", kind: "export" },
  { path: "artifacts/grant-demo/tampered-production-slice-export.json", kind: "export" },
  { path: "packages/replay/test/fixtures/clean-production-slice-export.json", kind: "test" },
  { path: "packages/replay/test/fixtures/clean-community-export.json", kind: "test" },
  { path: "packages/replay/test/fixtures/tampered-result-hash.json", kind: "test" },
  { path: "packages/replay/test/fixtures/missing-archive-artifact.json", kind: "test" },
  { path: "packages/replay/test/fixtures/reordered-events.json", kind: "test" },
  { path: "packages/replay/src/index.ts", kind: "source" },
  { path: "packages/replay/src/cli.ts", kind: "source" },
  { path: "packages/replay/src/types.ts", kind: "source" },
  { path: "packages/replay/src/checks.ts", kind: "source" },
  { path: "packages/replay/src/rebuildState.ts", kind: "source" },
  { path: "packages/replay/src/verifyBundle.ts", kind: "source" },
  { path: "packages/replay/src/verifyApi.ts", kind: "source" },
  { path: "packages/replay/src/verifyChain.ts", kind: "source" },
  { path: "packages/replay/src/tamper.ts", kind: "source" },
  { path: "packages/replay/src/onchainEventAdapter.ts", kind: "source" },
  { path: "packages/contracts/src/PCToken.sol", kind: "source" },
  { path: "packages/contracts/src/ProtocolAccess.sol", kind: "source" },
  { path: "packages/contracts/src/StakeManager.sol", kind: "source" },
  { path: "packages/contracts/src/QuestionRegistry.sol", kind: "source" },
  { path: "packages/contracts/src/ChallengeCourt.sol", kind: "source" },
  { path: "packages/contracts/src/CredentialRegistry.sol", kind: "source" },
  { path: "packages/contracts/src/PollManager.sol", kind: "source" },
  { path: "packages/contracts/src/TallyManager.sol", kind: "source" },
  { path: "packages/contracts/src/ResultArchive.sol", kind: "source" },
  { path: "packages/contracts/src/AdoptionRegistry.sol", kind: "source" },
  { path: "packages/contracts/src/PopularConsensus.sol", kind: "source" },
  { path: "packages/contracts/src/PopularConsensusDeployment.sol", kind: "source" },
  { path: "packages/replay/src/index.test.ts", kind: "test" },
  { path: "packages/replay/src/verifyChain.test.ts", kind: "test" },
  { path: "packages/replay/src/onchainEventAdapter.test.ts", kind: "test" },
  { path: "packages/contracts/test/PopularConsensus.t.sol", kind: "test" },
  { path: "scripts/check-protocol-boundaries.ts", kind: "source" },
  { path: "scripts/grant/full-lifecycle-demo.ts", kind: "source" },
  { path: "scripts/grant/api-replay-demo.ts", kind: "source" },
  { path: "scripts/grant/chain-replay-demo.ts", kind: "source" },
  { path: "scripts/grant/crypto-review.ts", kind: "source" },
  { path: "scripts/grant/crypto-hardening.ts", kind: "source" },
  { path: "scripts/grant/threshold-custody.ts", kind: "source" },
  { path: "scripts/grant/replay-test-vectors.ts", kind: "source" },
  { path: "scripts/grant/contract-hardening.ts", kind: "source" },
  { path: "scripts/grant/packet-lint.ts", kind: "source" },
  { path: "scripts/grant/reviewer-handoff.ts", kind: "source" },
  { path: "scripts/grant/repo-strategy-audit.ts", kind: "source" },
  { path: "scripts/grant/submission-gate.ts", kind: "source" },
  { path: "scripts/grant/protocol-publication.ts", kind: "source" },
  { path: "scripts/grant/negative-invariant-audit.ts", kind: "source" },
  { path: "scripts/grant/external-review-index.ts", kind: "source" },
  { path: "scripts/grant/review-readiness.ts", kind: "source" },
  { path: "scripts/grant/evidence-manifest.ts", kind: "source" }
];

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const entries: EvidenceEntry[] = [];
  for (const file of evidenceFiles) {
    entries.push(await entryFor(file.path, file.kind));
  }

  const countsByKind = entries.reduce<Record<string, number>>((counts, entry) => {
    counts[entry.kind] = (counts[entry.kind] ?? 0) + 1;
    return counts;
  }, {});
  const manifestBody = {
    protocol: "popular-consensus",
    schemaVersion: "ef-protocol-replay-kit-evidence-manifest-v1",
    generatedAt: new Date().toISOString(),
    command: "pnpm grant:evidence-manifest",
    status: "ManifestReady",
    entryCount: entries.length,
    countsByKind,
    entries
  };
  const manifestHash = sha256(JSON.stringify(manifestBody));
  const manifest = { ...manifestBody, manifestHash };
  const manifestPath = path.join(OUT_DIR, "evidence-manifest.json");
  const transcriptPath = path.join(OUT_DIR, "evidence-manifest-transcript.txt");

  await writeJson(manifestPath, manifest);
  await writeFile(
    transcriptPath,
    [
      "Popular Consensus Protocol Replay Kit evidence manifest",
      "",
      "Command: pnpm grant:evidence-manifest",
      `Status: ${manifest.status}`,
      `Entries: ${manifest.entryCount}`,
      `Manifest hash: ${manifest.manifestHash}`,
      "",
      "Counts by kind:",
      ...Object.entries(countsByKind).map(([kind, count]) => `- ${kind}: ${count}`)
    ].join("\n") + "\n",
    "utf8"
  );

  console.log("EF Protocol Replay Kit evidence manifest: ManifestReady");
  console.log(`Report: ${path.relative(REPO_ROOT, manifestPath)}`);
  console.log(`Transcript: ${path.relative(REPO_ROOT, transcriptPath)}`);
  console.log(`Manifest hash: ${manifest.manifestHash}`);
}

async function entryFor(filePath: string, kind: EvidenceEntry["kind"]): Promise<EvidenceEntry> {
  const bytes = await readFile(path.join(REPO_ROOT, filePath));
  return {
    path: filePath,
    kind,
    bytes: bytes.length,
    sha256: sha256(bytes)
  };
}

function sha256(value: Buffer | string) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
