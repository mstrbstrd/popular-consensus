import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAnswerSchema } from "../../packages/shared/src/index.ts";
import {
  anonymousBallotProofHash,
  anonymousPollScope,
  ballotCommitment,
  createCoordinatorKeypair,
  decryptBallot,
  deriveNullifier,
  encryptBallot,
  issueDemoCredential,
  tallyEncryptedBallots,
  verifyAnonymousBallotProof,
  verifyDemoCredential
} from "../../packages/privacy/src/index.ts";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const OUT_DIR = path.join(REPO_ROOT, "artifacts/grant-demo");

type CryptoReviewCheck = {
  id: string;
  ok: boolean;
  detail: string;
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const checks: CryptoReviewCheck[] = [];
  const coordinator = createCoordinatorKeypair();
  const wrongCoordinator = createCoordinatorKeypair();
  const credential = issueDemoCredential("demo-resident", "resident-vancouver", "issuer-demo");
  const nullifier = deriveNullifier(credential.secret, "poll-1", credential.schemaId);
  const otherPollNullifier = deriveNullifier(credential.secret, "poll-2", credential.schemaId);
  const otherSchemaNullifier = deriveNullifier(credential.secret, "poll-1", "resident-burnaby");
  const firstPayload = encryptBallot("support", coordinator.publicKeyPem);
  const secondPayload = encryptBallot("support", coordinator.publicKeyPem);
  const decrypted = decryptBallot(firstPayload, coordinator.privateKeyPem);
  const tally = tallyEncryptedBallots([firstPayload], coordinator.privateKeyPem, getAnswerSchema("answer-binary-support-oppose"));
  const scope = anonymousPollScope("poll-1", credential.schemaId);
  const anonymousProofHash = anonymousBallotProofHash({
    protocol: "popular-consensus",
    schemaVersion: "anonymous-ballot-proof-v1",
    proofSystem: "SemaphoreV4",
    groupId: "group-vancouver",
    groupRoot: "12345",
    signal: ballotCommitment(firstPayload, nullifier),
    scope,
    nullifier,
    proof: { merkleTreeDepth: 20, points: ["1", "2", "3", "4", "5", "6", "7", "8"] }
  });
  const malformedProofAccepted = await verifyAnonymousBallotProof(
    {
      protocol: "popular-consensus",
      schemaVersion: "anonymous-ballot-proof-v1",
      proofSystem: "SemaphoreV4",
      groupId: "group-vancouver",
      groupRoot: "12345",
      signal: ballotCommitment(firstPayload, nullifier),
      scope,
      nullifier,
      proof: {}
    },
    { groupRoot: "12345", signal: ballotCommitment(firstPayload, nullifier), scope }
  );

  add("credential-secret-hash-verifies", verifyDemoCredential(credential.secret, credential.secretHash), "Demo credential secret hash verifies before nullifier derivation");
  add("nullifier-deterministic", nullifier === deriveNullifier(credential.secret, "poll-1", credential.schemaId), "Nullifier is deterministic for one credential, poll, and schema");
  add("nullifier-poll-scoped", nullifier !== otherPollNullifier, "Nullifier changes across polls");
  add("nullifier-schema-scoped", nullifier !== otherSchemaNullifier, "Nullifier changes across credential schemas");
  add("ballot-encryption-randomized", firstPayload.ciphertext !== secondPayload.ciphertext && firstPayload.iv !== secondPayload.iv, "Same response encrypts to different ciphertext and IV");
  add("ballot-decrypts-with-coordinator-key", decrypted.type === "single_choice" && decrypted.choice === "support", "Coordinator private key decrypts the ballot");
  add("wrong-key-rejected", throws(() => decryptBallot(firstPayload, wrongCoordinator.privateKeyPem)), "Wrong coordinator private key cannot decrypt ballot payload");
  add(
    "ciphertext-tamper-rejected",
    throws(() => decryptBallot({ ...firstPayload, ciphertext: `${firstPayload.ciphertext.slice(0, -4)}AAAA` }, coordinator.privateKeyPem)),
    "AES-GCM rejects ciphertext tampering"
  );
  add(
    "auth-tag-tamper-rejected",
    throws(() => decryptBallot({ ...firstPayload, authTag: Buffer.alloc(16).toString("base64") }, coordinator.privateKeyPem)),
    "AES-GCM rejects authentication tag tampering"
  );
  add("aggregate-tally-no-raw-ballot", tally.turnout === 1 && tally.counts.support === 1 && !JSON.stringify(tally.aggregate).includes("demo-resident"), "Tally publishes aggregate counts without holder alias");
  add("anonymous-proof-hash-formed", anonymousProofHash.startsWith("sha256:"), "Anonymous proof hash is content-addressed");
  add("malformed-semaphore-proof-rejected", malformedProofAccepted === false, "Malformed Semaphore proof is rejected, not accepted as a hash-only claim");

  const failedChecks = checks.filter((check) => !check.ok);
  const report = {
    protocol: "popular-consensus",
    schemaVersion: "ef-protocol-replay-kit-crypto-review-report-v1",
    generatedAt: new Date().toISOString(),
    command: "pnpm grant:crypto-review",
    status: failedChecks.length === 0 ? "EvidenceReady" : "Mismatch",
    checksPassed: checks.length - failedChecks.length,
    checksTotal: checks.length,
    failedChecks: failedChecks.map((check) => check.id),
    primitives: [
      "X25519 key agreement for demo coordinator ballot encryption",
      "AES-256-GCM authenticated encryption for ballot payloads",
      "SHA-256 content-addressed commitments and nullifiers",
      "Semaphore V4 verification path for anonymous ballot proofs"
    ],
    productionNonClaims: [
      "No external cryptography audit has been completed.",
      "No production threshold key ceremony or key custody process is implemented.",
      "No production threshold decryption engine is claimed by this report.",
      "Demo credential membership proofs are not a production zero-knowledge credential system."
    ],
    checks
  };

  const reportPath = path.join(OUT_DIR, "crypto-review-report.json");
  const transcriptPath = path.join(OUT_DIR, "crypto-review-transcript.txt");
  await writeJson(reportPath, report);
  await writeFile(
    transcriptPath,
    [
      "Popular Consensus Protocol Replay Kit crypto review evidence",
      "",
      "Command: pnpm grant:crypto-review",
      `Status: ${report.status}`,
      `Checks: ${report.checksPassed}/${report.checksTotal}`,
      "",
      "Production non-claims:",
      ...report.productionNonClaims.map((claim) => `- ${claim}`),
      "",
      "Checks:",
      ...checks.map((check) => `- ${check.ok ? "PASS" : "FAIL"} ${check.id}: ${check.detail}`)
    ].join("\n") + "\n",
    "utf8"
  );

  if (failedChecks.length > 0) {
    throw new Error(`Crypto review checks failed: ${failedChecks.map((check) => check.id).join(", ")}`);
  }

  console.log("EF Protocol Replay Kit crypto review evidence: EvidenceReady");
  console.log(`Report: ${relative(reportPath)}`);
  console.log(`Transcript: ${relative(transcriptPath)}`);

  function add(id: string, ok: boolean, detail: string) {
    checks.push({ id, ok, detail });
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

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function relative(filePath: string) {
  return path.relative(REPO_ROOT, filePath);
}
