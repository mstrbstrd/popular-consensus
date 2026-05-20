import {
  createCipheriv,
  createDecipheriv,
  createHash,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  createPublicKey,
  createPrivateKey
} from "node:crypto";
import { hashJson } from "@pc/artifacts";
import {
  choiceToBallotResponse,
  tallyBallotResponses,
  validateBallotResponse,
  type AnswerSchema,
  type BallotResponse,
  type CredentialMembershipProof
} from "@pc/shared";

export type CoordinatorKeypair = {
  publicKeyPem: string;
  privateKeyPem: string;
  publicKeyId: string;
};

export type DemoCredential = {
  credentialId: string;
  holderAlias: string;
  schemaId: string;
  issuerId: string;
  secret: string;
  secretHash: string;
};

export const BALLOT_ENCRYPTION_V2_SUITE = "X25519-HKDF-SHA256-AES-256-GCM";

export type BallotEncryptionContext = {
  protocol: "popular-consensus";
  schemaVersion: "ballot-encryption-context-v1";
  pollId: string;
  questionId: string;
  credentialSchemaId: string;
  tallyPublicKeyId: string;
};

export type TallyRecipientPublicKey = {
  publicKeyPem: string;
  publicKeyId?: string;
};

export type EncryptedBallotPayloadV1 = {
  version: "pc-encrypted-ballot-v1";
  ephemeralPublicKeyPem: string;
  iv: string;
  authTag: string;
  ciphertext: string;
};

export type EncryptedBallotPayloadV2 = {
  version: "pc-encrypted-ballot-v2";
  suite: typeof BALLOT_ENCRYPTION_V2_SUITE;
  ephemeralPublicKeyPem: string;
  recipientPublicKeyId: string;
  contextHash: string;
  aadHash: string;
  iv: string;
  authTag: string;
  ciphertext: string;
};

export type EncryptedBallotPayload = EncryptedBallotPayloadV1 | EncryptedBallotPayloadV2;

export type CryptoEvidenceReport = {
  protocol: "popular-consensus";
  schemaVersion: string;
  status: "EvidenceReady" | "Mismatch";
  checksPassed: number;
  checksTotal: number;
  failedChecks: string[];
  productionDeploymentReady: false;
};

export type AnonymousBallotProof = {
  protocol: "popular-consensus";
  schemaVersion: "anonymous-ballot-proof-v1";
  proofSystem: "SemaphoreV4";
  groupId: string;
  groupRoot: string;
  signal: string;
  scope: string;
  nullifier: string;
  proof: unknown;
};

export type AnonymousBallotProofContext = {
  groupRoot: string;
  signal: string;
  scope: string;
};

export type ParticipationReceipt = {
  protocol: "popular-consensus";
  schemaVersion: "private-participation-receipt-v1";
  pollId: string;
  receiptSecret: string;
  receiptHash: string;
};

export type TallySummary = {
  aggregate: ReturnType<typeof tallyBallotResponses>;
  counts: Record<string, number>;
  turnout: number;
  invalidBallots: number;
  proofReference: string;
};

export function createCoordinatorKeypair(): CoordinatorKeypair {
  const pair = generateKeyPairSync("x25519");
  const publicKeyPem = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
  const privateKeyPem = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  return {
    publicKeyPem,
    privateKeyPem,
    publicKeyId: tallyPublicKeyId(publicKeyPem)
  };
}

export function tallyPublicKeyId(publicKeyPem: string): string {
  return sha256(publicKeyPem);
}

export function normalizeTallyPublicKeyPem(publicKeyPem: string): string {
  return createPublicKey(publicKeyPem).export({ type: "spki", format: "pem" }).toString();
}

export function createBallotEncryptionContext(input: {
  pollId: string;
  questionId: string;
  credentialSchemaId: string;
  tallyPublicKeyId: string;
}): BallotEncryptionContext {
  return {
    protocol: "popular-consensus",
    schemaVersion: "ballot-encryption-context-v1",
    pollId: input.pollId,
    questionId: input.questionId,
    credentialSchemaId: input.credentialSchemaId,
    tallyPublicKeyId: input.tallyPublicKeyId
  };
}

export function defaultBallotEncryptionContext(tallyPublicKeyId = "legacy-compatible-tally-key"): BallotEncryptionContext {
  return createBallotEncryptionContext({
    pollId: "legacy-compatible-poll",
    questionId: "legacy-compatible-question",
    credentialSchemaId: "legacy-compatible-credential-schema",
    tallyPublicKeyId
  });
}

export function ballotEncryptionContextHash(context: BallotEncryptionContext): string {
  return hashJson({
    protocol: "pc-ballot-encryption-context-v1",
    pollId: context.pollId,
    questionId: context.questionId,
    credentialSchemaId: context.credentialSchemaId,
    tallyPublicKeyId: context.tallyPublicKeyId
  });
}

export function ballotEncryptionAadHash(input: {
  suite: typeof BALLOT_ENCRYPTION_V2_SUITE;
  recipientPublicKeyId: string;
  contextHash: string;
}): string {
  return hashJson({
    protocol: "pc-ballot-encryption-aad-v1",
    suite: input.suite,
    recipientPublicKeyId: input.recipientPublicKeyId,
    contextHash: input.contextHash
  });
}

export function encryptedBallotContextMatches(payload: EncryptedBallotPayload, context: BallotEncryptionContext): boolean {
  return payload.version === "pc-encrypted-ballot-v2" && payload.contextHash === ballotEncryptionContextHash(context);
}

export function issueDemoCredential(holderAlias: string, schemaId: string, issuerId: string): DemoCredential {
  const secret = randomBytes(32).toString("hex");
  return {
    credentialId: credentialIdForDemoCredential(holderAlias, schemaId, issuerId, secret),
    holderAlias,
    schemaId,
    issuerId,
    secret,
    secretHash: hashDemoCredentialSecret(secret)
  };
}

export function credentialIdForDemoCredential(holderAlias: string, schemaId: string, issuerId: string, secret: string): string {
  return sha256(`${schemaId}:${issuerId}:${holderAlias}:${secret}`).slice(0, 34);
}

export function hashDemoCredentialSecret(secret: string): string {
  return sha256(secret);
}

export function verifyDemoCredential(secret: string, expectedSecretHash: string): boolean {
  return hashDemoCredentialSecret(secret) === expectedSecretHash;
}

export function deriveNullifier(credentialSecret: string, pollId: string, credentialSchemaId: string): string {
  return sha256(`pc:nullifier:${credentialSecret}:${pollId}:${credentialSchemaId}`);
}

export function createCredentialMembershipProof(
  credential: { credentialId: string; schemaId: string; issuerId: string; secretHash: string },
  credentialSecret: string,
  pollId: string
): CredentialMembershipProof {
  const nullifier = deriveNullifier(credentialSecret, pollId, credential.schemaId);
  const credentialCommitment = hashJson({
    protocol: "pc-credential-commitment-v1",
    credentialId: credential.credentialId,
    schemaId: credential.schemaId,
    issuerId: credential.issuerId,
    secretHash: credential.secretHash
  });
  const proofHash = hashJson({
    protocol: "credential-membership-nullifier-proof-v0",
    credentialCommitment,
    nullifier,
    pollId,
    credentialSchemaId: credential.schemaId
  });
  return {
    protocol: "popular-consensus",
    schemaVersion: "credential-membership-nullifier-proof-v0",
    credentialId: credential.credentialId,
    schemaId: credential.schemaId,
    issuerId: credential.issuerId,
    pollId,
    nullifier,
    credentialCommitment,
    proofHash
  };
}

export function verifyCredentialMembershipProof(
  proof: CredentialMembershipProof,
  credential: { credentialId: string; schemaId: string; issuerId: string; secretHash: string },
  credentialSecret: string,
  pollId: string
): boolean {
  if (!verifyDemoCredential(credentialSecret, credential.secretHash)) return false;
  return hashJson(proof) === hashJson(createCredentialMembershipProof(credential, credentialSecret, pollId));
}

export function anonymousPollScope(pollId: string, credentialSchemaId: string, pollVersion = "v1"): string {
  return hashJson({ protocol: "pc-anonymous-poll-scope-v1", pollId, credentialSchemaId, pollVersion });
}

export function anonymousBallotProofHash(proof: AnonymousBallotProof): string {
  return hashJson({
    protocol: proof.protocol,
    schemaVersion: proof.schemaVersion,
    proofSystem: proof.proofSystem,
    groupId: proof.groupId,
    groupRoot: proof.groupRoot,
    signal: proof.signal,
    scope: proof.scope,
    nullifier: proof.nullifier,
    proof: proof.proof
  });
}

export async function verifyAnonymousBallotProof(
  proof: AnonymousBallotProof,
  context: AnonymousBallotProofContext
): Promise<boolean> {
  if (proof.protocol !== "popular-consensus") return false;
  if (proof.schemaVersion !== "anonymous-ballot-proof-v1") return false;
  if (proof.proofSystem !== "SemaphoreV4") return false;
  if (!sameFieldValue(proof.groupRoot, context.groupRoot)) return false;
  if (!sameFieldValue(proof.signal, context.signal)) return false;
  if (!sameFieldValue(proof.scope, context.scope)) return false;

  const semaphoreProof = normalizeSemaphoreProof(proof);
  if (!semaphoreProof) return false;

  try {
    const { verifyProof } = await import("@semaphore-protocol/core");
    return await verifyProof(semaphoreProof as Parameters<typeof verifyProof>[0]);
  } catch {
    return false;
  }
}

export function createParticipationReceipt(pollId: string): ParticipationReceipt {
  const receiptSecret = randomBytes(32).toString("hex");
  return {
    protocol: "popular-consensus",
    schemaVersion: "private-participation-receipt-v1",
    pollId,
    receiptSecret,
    receiptHash: participationReceiptHash(receiptSecret)
  };
}

export function participationReceiptHash(receiptSecret: string): string {
  return hashJson({ protocol: "pc-private-participation-receipt-v1", receiptSecret });
}

export function encryptBallot(
  response: BallotResponse | string,
  recipient: string | TallyRecipientPublicKey,
  context?: BallotEncryptionContext
): EncryptedBallotPayloadV2 {
  const coordinatorPublicKeyPem = typeof recipient === "string" ? recipient : recipient.publicKeyPem;
  const recipientPublicKeyId = typeof recipient === "string" ? tallyPublicKeyId(coordinatorPublicKeyPem) : (recipient.publicKeyId ?? tallyPublicKeyId(coordinatorPublicKeyPem));
  const encryptionContext = context ?? defaultBallotEncryptionContext(recipientPublicKeyId);
  const contextHash = ballotEncryptionContextHash(encryptionContext);
  const aadHash = ballotEncryptionAadHash({
    suite: BALLOT_ENCRYPTION_V2_SUITE,
    recipientPublicKeyId,
    contextHash
  });
  const ephemeral = generateKeyPairSync("x25519");
  const sharedSecret = diffieHellman({
    privateKey: ephemeral.privateKey,
    publicKey: createPublicKey(coordinatorPublicKeyPem)
  });
  const key = deriveBallotAeadKey(sharedSecret, contextHash, recipientPublicKeyId);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(ballotAadBuffer({ suite: BALLOT_ENCRYPTION_V2_SUITE, recipientPublicKeyId, contextHash, aadHash }));
  const normalizedResponse = typeof response === "string" ? choiceToBallotResponse(response) : response;
  const plaintext = Buffer.from(JSON.stringify(normalizedResponse), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    version: "pc-encrypted-ballot-v2",
    suite: BALLOT_ENCRYPTION_V2_SUITE,
    ephemeralPublicKeyPem: ephemeral.publicKey.export({ type: "spki", format: "pem" }).toString(),
    recipientPublicKeyId,
    contextHash,
    aadHash,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: ciphertext.toString("base64")
  };
}

export function decryptBallot(payload: EncryptedBallotPayload, coordinatorPrivateKeyPem: string, context?: BallotEncryptionContext): BallotResponse {
  if (payload.version === "pc-encrypted-ballot-v1") return decryptBallotV1(payload, coordinatorPrivateKeyPem);
  if (context && payload.contextHash !== ballotEncryptionContextHash(context)) throw new Error("Encrypted ballot context does not match");
  if (payload.suite !== BALLOT_ENCRYPTION_V2_SUITE) throw new Error("Unsupported encrypted ballot suite");
  if (payload.aadHash !== ballotEncryptionAadHash(payload)) throw new Error("Encrypted ballot AAD hash does not match");
  const sharedSecret = diffieHellman({
    privateKey: createPrivateKey(coordinatorPrivateKeyPem),
    publicKey: createPublicKey(payload.ephemeralPublicKeyPem)
  });
  const key = deriveBallotAeadKey(sharedSecret, payload.contextHash, payload.recipientPublicKeyId);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
  decipher.setAAD(ballotAadBuffer(payload));
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final()
  ]).toString("utf8");
  return JSON.parse(plaintext) as BallotResponse;
}

export function ballotCommitment(payload: EncryptedBallotPayload, nullifier: string, context?: BallotEncryptionContext): string {
  if (payload.version === "pc-encrypted-ballot-v1") return hashJson({ payload, nullifier });
  if (context && payload.contextHash !== ballotEncryptionContextHash(context)) throw new Error("Encrypted ballot context does not match");
  return hashJson({
    protocol: "pc-ballot-commitment-v2",
    encryptedPayloadHash: hashJson(payload),
    nullifier,
    contextHash: payload.contextHash
  });
}

export function tallyEncryptedBallots(
  payloads: EncryptedBallotPayload[],
  coordinatorPrivateKeyPem: string,
  answerSchema: AnswerSchema,
  context?: BallotEncryptionContext
): TallySummary {
  const responses: BallotResponse[] = [];
  let invalidBallots = 0;

  for (const payload of payloads) {
    try {
      responses.push(validateBallotResponse(answerSchema, decryptBallot(payload, coordinatorPrivateKeyPem, context)));
    } catch {
      invalidBallots += 1;
    }
  }

  const aggregate = tallyBallotResponses(answerSchema, responses);
  const counts = "counts" in aggregate ? aggregate.counts : {};
  return {
    aggregate,
    counts,
    turnout: aggregate.turnout,
    invalidBallots,
    proofReference: hashJson({ aggregate, invalidBallots, turnout: aggregate.turnout, protocol: "pc-maci-derived-v1" })
  };
}

function decryptBallotV1(payload: EncryptedBallotPayloadV1, coordinatorPrivateKeyPem: string): BallotResponse {
  const sharedSecret = diffieHellman({
    privateKey: createPrivateKey(coordinatorPrivateKeyPem),
    publicKey: createPublicKey(payload.ephemeralPublicKeyPem)
  });
  const key = createHash("sha256").update(sharedSecret).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final()
  ]).toString("utf8");
  return JSON.parse(plaintext) as BallotResponse;
}

function deriveBallotAeadKey(sharedSecret: Buffer, contextHash: string, recipientPublicKeyId: string): Buffer {
  return Buffer.from(
    hkdfSync(
      "sha256",
      sharedSecret,
      Buffer.from(contextHash, "utf8"),
      Buffer.from(`pc-ballot-encryption-v2:${recipientPublicKeyId}`, "utf8"),
      32
    )
  );
}

function ballotAadBuffer(input: {
  suite: typeof BALLOT_ENCRYPTION_V2_SUITE;
  recipientPublicKeyId: string;
  contextHash: string;
  aadHash: string;
}): Buffer {
  return Buffer.from(
    JSON.stringify({
      protocol: "pc-ballot-encryption-aad-v1",
      suite: input.suite,
      recipientPublicKeyId: input.recipientPublicKeyId,
      contextHash: input.contextHash,
      aadHash: input.aadHash
    }),
    "utf8"
  );
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function normalizeSemaphoreProof(proof: AnonymousBallotProof) {
  if (!isRecord(proof.proof)) return null;
  const candidate = {
    ...proof.proof,
    merkleTreeRoot: proof.groupRoot,
    message: proof.signal,
    scope: proof.scope,
    nullifier: proof.nullifier
  };
  return candidate;
}

function sameFieldValue(left: string, right: string): boolean {
  return normalizeFieldValue(left) === normalizeFieldValue(right);
}

function normalizeFieldValue(value: string): string {
  return value.startsWith("0x") ? BigInt(value).toString() : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
