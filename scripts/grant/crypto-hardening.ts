import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashJson } from "../../packages/artifacts/src/index.ts";
import {
  BALLOT_ENCRYPTION_V2_SUITE,
  ballotCommitment,
  ballotEncryptionContextHash,
  createBallotEncryptionContext,
  createCoordinatorKeypair,
  decryptBallot,
  encryptBallot
} from "../../packages/privacy/src/index.ts";
import { createProductionSliceFixture, verifyProductionSlice, type ProductionSliceVerificationInput } from "../../packages/protocol-slice/src/index.ts";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const OUT_DIR = path.join(REPO_ROOT, "artifacts/grant-demo");

type CryptoHardeningCheck = {
  id: string;
  ok: boolean;
  detail: string;
  expected?: unknown;
  actual?: unknown;
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const checks: CryptoHardeningCheck[] = [];
  const coordinator = createCoordinatorKeypair();
  const wrongCoordinator = createCoordinatorKeypair();
  const context = createBallotEncryptionContext({
    pollId: "poll-crypto-hardening",
    questionId: "question-crypto-hardening",
    credentialSchemaId: "credential-crypto-hardening",
    tallyPublicKeyId: coordinator.publicKeyId
  });
  const wrongContext = createBallotEncryptionContext({ ...context, pollId: "poll-wrong" });
  const firstPayload = encryptBallot("support", coordinator, context);
  const secondPayload = encryptBallot("support", coordinator, context);
  const nullifier = hashJson({ protocol: "pc-crypto-hardening-nullifier-v1", pollId: context.pollId });
  const commitment = ballotCommitment(firstPayload, nullifier, context);

  add("v2-envelope-emitted", firstPayload.version === "pc-encrypted-ballot-v2", "Ballot encryption emits the v2 envelope.", "pc-encrypted-ballot-v2", firstPayload.version);
  add("v2-suite-recorded", firstPayload.suite === BALLOT_ENCRYPTION_V2_SUITE, "The v2 envelope records the hardened suite.", BALLOT_ENCRYPTION_V2_SUITE, firstPayload.suite);
  add("recipient-key-bound", firstPayload.recipientPublicKeyId === coordinator.publicKeyId, "The envelope binds to the tally recipient key id.", coordinator.publicKeyId, firstPayload.recipientPublicKeyId);
  add("context-hash-bound", firstPayload.contextHash === ballotEncryptionContextHash(context), "The envelope binds poll/question/schema/tally-key context.", ballotEncryptionContextHash(context), firstPayload.contextHash);
  const decrypted = decryptBallot(firstPayload, coordinator.privateKeyPem, context);
  add("context-decrypts", decrypted.type === "single_choice" && decrypted.choice === "support", "The correct key and context decrypt the ballot.");
  add("wrong-key-rejected", throws(() => decryptBallot(firstPayload, wrongCoordinator.privateKeyPem, context)), "A wrong recipient key cannot decrypt the ballot.");
  add("wrong-context-rejected", throws(() => decryptBallot(firstPayload, coordinator.privateKeyPem, wrongContext)), "A wrong poll context is rejected before plaintext is returned.");
  add("aad-tamper-rejected", throws(() => decryptBallot({ ...firstPayload, aadHash: "sha256:tampered" }, coordinator.privateKeyPem, context)), "AAD hash tampering is rejected.");
  add("ciphertext-tamper-rejected", throws(() => decryptBallot({ ...firstPayload, ciphertext: `${firstPayload.ciphertext.slice(0, -4)}AAAA` }, coordinator.privateKeyPem, context)), "AES-GCM ciphertext tampering is rejected.");
  add("randomized-encryption", firstPayload.ciphertext !== secondPayload.ciphertext && firstPayload.iv !== secondPayload.iv, "The same response encrypts to different ciphertext and IV.");
  add("plaintext-not-exported", !JSON.stringify(firstPayload).includes("support"), "The encrypted payload does not expose the plaintext ballot.");
  add("commitment-formed", commitment.startsWith("sha256:"), "The ballot commitment is content-addressed and context-bound.");

  const golden = createProductionSliceFixture().input;
  const goldenReport = verifyProductionSlice(golden);
  add("production-slice-v2-golden", goldenReport.status === "Verified", "The production slice verifies with v2 encrypted payloads.", "Verified", goldenReport.status);
  add("production-slice-v2-checks-pass", goldenReport.counts.failedChecks === 0, "All production-slice replay checks pass.", 0, goldenReport.counts.failedChecks);
  addReplayFailure("replay-rejects-v1-payload", golden, ["ballot-ballot-1-encrypted-payload-version"], (input) => {
    input.ballots[0].encryptedPayload = {
      version: "pc-encrypted-ballot-v1",
      ephemeralPublicKeyPem: "legacy-ephemeral",
      iv: "legacy-iv",
      authTag: "legacy-auth-tag",
      ciphertext: "legacy-ciphertext"
    };
  });
  addReplayFailure("replay-rejects-wrong-context", golden, ["ballot-ballot-1-encrypted-payload-context", "ballot-ballot-1-commitment"], (input) => {
    if (input.ballots[0].encryptedPayload.version === "pc-encrypted-ballot-v2") input.ballots[0].encryptedPayload.contextHash = "sha256:wrong-context";
  });
  addReplayFailure("replay-rejects-wrong-recipient", golden, ["ballot-ballot-1-encrypted-payload-recipient", "ballot-ballot-1-commitment"], (input) => {
    if (input.ballots[0].encryptedPayload.version === "pc-encrypted-ballot-v2") input.ballots[0].encryptedPayload.recipientPublicKeyId = "tally-key-wrong";
  });
  addReplayFailure("replay-rejects-wrong-tally-setup-share", golden, ["share-decryption-share-tally-member-1-tally-key-setup", "share-decryption-share-tally-member-1-signature"], (input) => {
    input.decryptionShares[0].tallyKeySetupHash = "sha256:wrong-setup";
  });
  addReplayFailure("replay-rejects-wrong-result-binding-share", golden, ["share-decryption-share-tally-member-1-result-binding", "share-decryption-share-tally-member-1-signature"], (input) => {
    input.decryptionShares[0].resultArtifactBindingHash = "sha256:wrong-result-binding";
  });

  const failedChecks = checks.filter((check) => !check.ok);
  const report = {
    protocol: "popular-consensus",
    schemaVersion: "ef-protocol-replay-kit-crypto-hardening-report-v1",
    generatedAt: new Date().toISOString(),
    command: "pnpm grant:crypto-hardening",
    status: failedChecks.length === 0 ? "CryptoHardeningEvidenceReady" : "Mismatch",
    formalSubmissionReady: false,
    productionDeploymentReady: false,
    checksPassed: checks.length - failedChecks.length,
    checksTotal: checks.length,
    failedChecks: failedChecks.map((check) => check.id),
    primitives: [
      "X25519 shared secret with HKDF-SHA256 key derivation",
      "AES-256-GCM authenticated encryption with explicit associated data",
      "poll/question/schema/tally-key context hash binding",
      "threshold decryption-share signatures over tally setup and result-binding evidence"
    ],
    productionNonClaims: [
      "No external cryptography audit has been completed.",
      "No production distributed key generation ceremony is claimed.",
      "No production threshold decryption engine is claimed.",
      "No production key custody or recovery runbook has been externally reviewed."
    ],
    checks
  };

  const reportPath = path.join(OUT_DIR, "crypto-hardening-report.json");
  const transcriptPath = path.join(OUT_DIR, "crypto-hardening-transcript.txt");
  await writeJson(reportPath, report);
  await writeFile(
    transcriptPath,
    [
      "Popular Consensus Protocol Replay Kit crypto hardening evidence",
      "",
      "Command: pnpm grant:crypto-hardening",
      `Status: ${report.status}`,
      `Formal submission ready: ${report.formalSubmissionReady}`,
      `Production deployment ready: ${report.productionDeploymentReady}`,
      `Checks: ${report.checksPassed}/${report.checksTotal}`,
      "",
      "Production non-claims:",
      ...report.productionNonClaims.map((claim) => `- ${claim}`),
      "",
      "Failed checks:",
      ...(failedChecks.length > 0 ? failedChecks.map((check) => `- ${check.id}: ${check.detail}`) : ["- none"])
    ].join("\n") + "\n",
    "utf8"
  );

  if (failedChecks.length > 0) throw new Error(`Crypto hardening checks failed: ${failedChecks.map((check) => check.id).join(", ")}`);

  console.log("EF Protocol Replay Kit crypto hardening evidence: CryptoHardeningEvidenceReady");
  console.log(`Report: ${relative(reportPath)}`);
  console.log(`Transcript: ${relative(transcriptPath)}`);
  console.log("Production deployment ready: false");

  function add(id: string, ok: boolean, detail: string, expected?: unknown, actual?: unknown) {
    checks.push({ id, ok, detail, expected, actual });
  }

  function addReplayFailure(id: string, fixture: ProductionSliceVerificationInput, expectedFailedChecks: string[], mutate: (input: ProductionSliceVerificationInput) => void) {
    const input = clone(fixture);
    mutate(input);
    const report = verifyProductionSlice(input);
    const failed = report.checks.filter((check) => !check.ok).map((check) => check.id);
    add(
      id,
      report.status === "Mismatch" && expectedFailedChecks.every((check) => failed.includes(check)),
      "Replay fails closed for a malformed crypto/custody fixture.",
      expectedFailedChecks,
      failed
    );
  }
}

function throws(callback: () => unknown) {
  try {
    callback();
    return false;
  } catch {
    return true;
  }
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
