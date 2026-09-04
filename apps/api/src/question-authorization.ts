import { createHash, createPublicKey, verify } from "node:crypto";
import {
  QuestionAcceptanceSnapshotSchema,
  SignedAcceptQuestionCommandSchema,
  questionAcceptanceSigningText
} from "../../../packages/shared/src/question-authorization";

export type AcceptanceRejection =
  | "INVALID_COMMAND" | "INVALID_SNAPSHOT" | "WRONG_NETWORK" | "ACTOR_MISMATCH"
  | "COMMAND_NOT_YET_VALID" | "COMMAND_EXPIRED" | "COMMAND_LIFETIME_INVALID"
  | "KEY_NOT_VALID" | "SIGNATURE_INVALID" | "CAPABILITY_DENIED"
  | "NONCE_MISMATCH" | "NONCE_EXHAUSTED" | "TARGET_MISMATCH" | "STALE_STATE"
  | "REVISION_EXHAUSTED" | "COMMUNITY_UNAVAILABLE" | "QUESTION_STATE_INVALID" | "SELF_APPROVAL"
  | "DISPUTE_PENDING" | "CHALLENGE_WINDOW_OPEN" | "EMERGENCY_SUSPENDED";

export type QuestionAcceptanceDecision =
  | { outcome: "Rejected"; code: AcceptanceRejection }
  | {
      outcome: "AuthorizedTransition";
      actor: { principalId: string; keyId: string; capabilityId: string };
      commandId: string;
      commandHash: string;
      communityId: string;
      questionId: string;
      expectedRevision: number;
      nextRevision: number;
      expectedNonce: string;
      nextNonce: string;
      fromStatus: "Submitted";
      toStatus: "Accepted";
      evaluatedAt: string;
    };

/** No I/O, clock reads, writes, or public receipts. The caller must read the
 * snapshot and atomically apply ALL effects in one serializable transaction.
 * An AuthorizedTransition is not evidence that a command was durably applied.
 */
export function evaluateQuestionAcceptance(input: unknown, trustedSnapshot: unknown): QuestionAcceptanceDecision {
  const reject = (code: AcceptanceRejection): QuestionAcceptanceDecision => ({ outcome: "Rejected", code });
  const envelope = SignedAcceptQuestionCommandSchema.safeParse(input);
  if (!envelope.success) return reject("INVALID_COMMAND");
  const snapshot = QuestionAcceptanceSnapshotSchema.safeParse(trustedSnapshot);
  if (!snapshot.success) return reject("INVALID_SNAPSHOT");
  const { command: c, authorization } = envelope.data;
  const s = snapshot.data;
  const q = s.question;
  const now = s.evaluatedAt;
  if (c.networkId !== s.networkId) return reject("WRONG_NETWORK");
  if (c.principalId !== s.principalId || s.principalStatus !== "Active") return reject("ACTOR_MISMATCH");
  if (c.expiresAt <= c.issuedAt || Date.parse(c.expiresAt) - Date.parse(c.issuedAt) > 300_000) {
    return reject("COMMAND_LIFETIME_INVALID");
  }
  if (now < c.issuedAt) return reject("COMMAND_NOT_YET_VALID");
  if (now >= c.expiresAt) return reject("COMMAND_EXPIRED");
  const key = s.verificationMethod;
  if (!key || key.id !== c.keyId || key.principalId !== c.principalId || key.status !== "Active"
      || c.issuedAt < key.validFrom || now < key.validFrom || now >= key.validUntil) {
    return reject("KEY_NOT_VALID");
  }
  const signedText = questionAcceptanceSigningText(c);
  try {
    // Accept only a public SPKI key from the trusted resolver, never a key
    // supplied in the command or a private-key PEM coerced into a public key.
    if (!key.publicKeyPem.startsWith("-----BEGIN PUBLIC KEY-----")) return reject("KEY_NOT_VALID");
    const publicKey = createPublicKey(key.publicKeyPem);
    if (publicKey.asymmetricKeyType !== "ed25519") return reject("KEY_NOT_VALID");
    if (!verify(null, Buffer.from(signedText, "utf8"), publicKey, Buffer.from(authorization.signatureHex, "hex"))) {
      return reject("SIGNATURE_INVALID");
    }
  } catch {
    return reject("KEY_NOT_VALID");
  }
  if (c.nonce !== s.nextNonce) return reject("NONCE_MISMATCH");
  const nextNonce = (BigInt(s.nextNonce) + 1n).toString();
  if (nextNonce.length > 20) return reject("NONCE_EXHAUSTED");
  if (q.id !== c.payload.questionId || q.communityId !== c.payload.communityId) return reject("TARGET_MISMATCH");
  const grant = s.capabilities.find((g) => g.principalId === c.principalId
    && g.communityId === q.communityId && (g.questionId === null || g.questionId === q.id)
    && g.action === "QuestionAccept" && g.status === "Active"
    && g.validFrom <= now && now < g.validUntil);
  if (!grant) return reject("CAPABILITY_DENIED");
  if (q.revision !== c.payload.expectedRevision || q.version !== c.payload.expectedQuestionVersion) return reject("STALE_STATE");
  if (q.revision === Number.MAX_SAFE_INTEGER) return reject("REVISION_EXHAUSTED");
  if (q.communityStatus !== "Active") return reject("COMMUNITY_UNAVAILABLE");
  if (q.emergencySuspended) return reject("EMERGENCY_SUSPENDED");
  if (q.proposerPrincipalId === c.principalId) return reject("SELF_APPROVAL");
  if (q.status !== "Submitted") return reject("QUESTION_STATE_INVALID");
  if (q.unresolvedChallenges > 0 || q.unresolvedAppeals > 0) return reject("DISPUTE_PENDING");
  if (now < q.challengeWindowEndsAt) return reject("CHALLENGE_WINDOW_OPEN");
  return {
    outcome: "AuthorizedTransition",
    actor: { principalId: c.principalId, keyId: c.keyId, capabilityId: grant.id },
    commandId: c.commandId,
    commandHash: `sha256:${createHash("sha256").update(signedText, "utf8").digest("hex")}`,
    communityId: q.communityId,
    questionId: q.id,
    expectedRevision: q.revision,
    nextRevision: q.revision + 1,
    expectedNonce: c.nonce,
    nextNonce,
    fromStatus: "Submitted",
    toStatus: "Accepted",
    evaluatedAt: now
  };
}
