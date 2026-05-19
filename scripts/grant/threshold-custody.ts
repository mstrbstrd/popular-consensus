import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createProductionSliceFixture,
  verifyProductionSlice,
  type ProductionSliceVerificationInput
} from "../../packages/protocol-slice/src/index.ts";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const OUT_DIR = path.join(REPO_ROOT, "artifacts/grant-demo");

type ThresholdCustodyCase = {
  id: string;
  detail: string;
  expectedStatus: "Verified" | "Mismatch";
  expectedFailedChecks: string[];
  mutate?: (input: ProductionSliceVerificationInput) => void;
};

type ThresholdCustodyCaseResult = {
  id: string;
  ok: boolean;
  detail: string;
  expectedStatus: ThresholdCustodyCase["expectedStatus"];
  actualStatus: string;
  expectedFailedChecks: string[];
  actualFailedChecks: string[];
};

const cases: ThresholdCustodyCase[] = [
  {
    id: "golden-threshold-slice-verifies",
    detail: "The baseline protocol slice includes threshold custody metadata, two accepted shares, unique members, and no private key material.",
    expectedStatus: "Verified",
    expectedFailedChecks: []
  },
  {
    id: "exported-private-key-material-rejected",
    detail: "Tally key setup must remain public metadata only; exported private key material is rejected.",
    expectedStatus: "Mismatch",
    expectedFailedChecks: ["tally-key-custody-model"],
    mutate: (input) => {
      input.tallyKeySetup.privateKeyMaterial = "exported" as ProductionSliceVerificationInput["tallyKeySetup"]["privateKeyMaterial"];
    }
  },
  {
    id: "duplicate-member-ids-rejected",
    detail: "Threshold membership cannot inflate committee size with duplicate member ids.",
    expectedStatus: "Mismatch",
    expectedFailedChecks: ["tally-member-ids-unique"],
    mutate: (input) => {
      input.tallyKeySetup.members[1].memberId = input.tallyKeySetup.members[0].memberId;
    }
  },
  {
    id: "duplicate-member-public-keys-rejected",
    detail: "Threshold membership cannot reuse one public key for multiple committee members.",
    expectedStatus: "Mismatch",
    expectedFailedChecks: ["tally-member-public-keys-unique"],
    mutate: (input) => {
      input.tallyKeySetup.members[1].publicKeyPem = input.tallyKeySetup.members[0].publicKeyPem;
    }
  },
  {
    id: "invalid-member-public-key-rejected",
    detail: "Threshold member public keys must parse as Ed25519 public keys.",
    expectedStatus: "Mismatch",
    expectedFailedChecks: ["tally-member-public-keys-valid"],
    mutate: (input) => {
      input.tallyKeySetup.members[0].publicKeyPem = "not-a-public-key";
    }
  },
  {
    id: "threshold-above-member-count-rejected",
    detail: "Threshold value cannot exceed the unique committee member count.",
    expectedStatus: "Mismatch",
    expectedFailedChecks: ["tally-threshold"],
    mutate: (input) => {
      input.tallyKeySetup.threshold = input.tallyKeySetup.members.length + 1;
    }
  },
  {
    id: "insufficient-accepted-shares-rejected",
    detail: "A result cannot pass replay if accepted shares fall below the configured threshold.",
    expectedStatus: "Mismatch",
    expectedFailedChecks: ["threshold-share-count", "result-threshold-share-count"],
    mutate: (input) => {
      input.decryptionShares = input.decryptionShares.slice(0, 1);
    }
  },
  {
    id: "unauthorized-accepted-share-rejected",
    detail: "Accepted decryption shares must come from members in the active tally key setup.",
    expectedStatus: "Mismatch",
    expectedFailedChecks: ["share-decryption-share-tally-member-1-authorized-member"],
    mutate: (input) => {
      input.decryptionShares[0].memberId = "tally-member-unauthorized";
    }
  },
  {
    id: "duplicate-accepted-share-hashes-rejected",
    detail: "Accepted decryption shares must have unique share hashes.",
    expectedStatus: "Mismatch",
    expectedFailedChecks: ["threshold-share-unique-hashes"],
    mutate: (input) => {
      input.decryptionShares[1].shareHash = input.decryptionShares[0].shareHash;
    }
  },
  {
    id: "tampered-share-aggregate-rejected",
    detail: "A decryption share must bind to the published aggregate counts hash.",
    expectedStatus: "Mismatch",
    expectedFailedChecks: ["share-decryption-share-tally-member-1-aggregate"],
    mutate: (input) => {
      input.decryptionShares[0].aggregateCountsHash = "sha256:tampered-aggregate";
    }
  }
];

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const results = cases.map(runCase);
  const failedCases = results.filter((entry) => !entry.ok);
  const report = {
    protocol: "popular-consensus",
    schemaVersion: "ef-protocol-replay-kit-threshold-custody-report-v1",
    generatedAt: new Date().toISOString(),
    command: "pnpm grant:threshold-custody",
    status: failedCases.length === 0 ? "ThresholdCustodyEvidenceReady" : "Mismatch",
    productionDeploymentReady: false,
    checksPassed: results.length - failedCases.length,
    checksTotal: results.length,
    failedChecks: failedCases.map((entry) => entry.id),
    evidenceScope: [
      "threshold committee metadata is public and private key material is rejected",
      "committee member ids and public keys must be unique",
      "member public keys must be valid Ed25519 keys",
      "accepted shares must meet threshold, come from authorized members, have unique hashes, and bind to the published aggregate"
    ],
    productionNonClaims: [
      "No distributed key generation implementation is claimed by this report.",
      "No production key ceremony or custody runbook has been externally reviewed.",
      "No cryptographic decryption-share proof system has been audited.",
      "This report verifies replay evidence and custody boundaries, not live production threshold decryption."
    ],
    results
  };

  const reportPath = path.join(OUT_DIR, "threshold-custody-report.json");
  const transcriptPath = path.join(OUT_DIR, "threshold-custody-transcript.txt");
  await writeJson(reportPath, report);
  await writeFile(
    transcriptPath,
    [
      "Popular Consensus Protocol Replay Kit threshold custody evidence",
      "",
      "Command: pnpm grant:threshold-custody",
      `Status: ${report.status}`,
      `Production deployment ready: ${report.productionDeploymentReady}`,
      `Checks: ${report.checksPassed}/${report.checksTotal}`,
      "",
      "Production non-claims:",
      ...report.productionNonClaims.map((claim) => `- ${claim}`),
      "",
      "Cases:",
      ...results.map((entry) => `- ${entry.ok ? "PASS" : "FAIL"} ${entry.id}: ${entry.actualStatus}`)
    ].join("\n") + "\n",
    "utf8"
  );

  if (failedCases.length > 0) {
    throw new Error(`Threshold custody checks failed: ${failedCases.map((entry) => entry.id).join(", ")}`);
  }

  console.log("EF Protocol Replay Kit threshold custody evidence: ThresholdCustodyEvidenceReady");
  console.log(`Report: ${relative(reportPath)}`);
  console.log(`Transcript: ${relative(transcriptPath)}`);
  console.log("Production deployment ready: false");
}

function runCase(testCase: ThresholdCustodyCase): ThresholdCustodyCaseResult {
  const input = clone(createProductionSliceFixture().input);
  testCase.mutate?.(input);
  const report = verifyProductionSlice(input);
  const actualFailedChecks = report.checks.filter((check) => !check.ok).map((check) => check.id);
  const expectedFailuresPresent = testCase.expectedFailedChecks.every((id) => actualFailedChecks.includes(id));
  const ok = report.status === testCase.expectedStatus && expectedFailuresPresent;
  return {
    id: testCase.id,
    ok,
    detail: testCase.detail,
    expectedStatus: testCase.expectedStatus,
    actualStatus: report.status,
    expectedFailedChecks: testCase.expectedFailedChecks,
    actualFailedChecks
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function relative(filePath: string) {
  return path.relative(REPO_ROOT, filePath);
}
