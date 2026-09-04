import { createHash } from "node:crypto";
import { AdmissionPrisma, type AdmissionClient } from "../../../packages/db/src/admission";
import {
  AppliedQuestionAcceptanceReceiptSchema,
  type AppliedQuestionAcceptanceReceipt
} from "../../../packages/shared/src/admission";
import { FoundationIdSchema } from "../../../packages/shared/src/foundation";
import {
  SignedAcceptQuestionCommandSchema,
  questionAcceptanceSigningText
} from "../../../packages/shared/src/question-authorization";
import { evaluateQuestionAcceptance, type AcceptanceRejection } from "./question-authorization";

export type AdmissionRejection = AcceptanceRejection | "PRINCIPAL_NOT_FOUND" | "QUESTION_NOT_FOUND"
  | "COMMAND_ID_CONFLICT" | "CONCURRENT_CONFLICT";
export type QuestionAdmissionResult =
  | { outcome: "Rejected"; code: AdmissionRejection }
  | { outcome: "Applied" | "AlreadyApplied"; receipt: AppliedQuestionAcceptanceReceipt };
const hash = (text: string) => `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
class AdmissionWriteConflict extends Error {}

function retryable(error: unknown): boolean {
  if (error instanceof AdmissionWriteConflict) return true;
  if (!(error instanceof AdmissionPrisma.PrismaClientKnownRequestError)) return false;
  return error.code === "P2034" || error.code === "P2002"
    || (error.code === "P2010" && ["40001", "40P01"].includes(String(error.meta?.code)));
}

type ReceiptRow = AdmissionPrisma.AdmissionCommandReceiptGetPayload<object>;
function receiptDto(row: ReceiptRow): AppliedQuestionAcceptanceReceipt {
  return AppliedQuestionAcceptanceReceiptSchema.parse({
    schemaVersion: "accept-question-receipt-v0.2-draft", trustProfile: "LocalDatabase",
    networkId: row.networkId, commandId: row.commandId, commandHash: row.commandHash,
    questionId: row.questionId, status: "Accepted", revision: Number(row.revision),
    acceptedAt: row.acceptedAt.toISOString(), eventHash: row.eventHash
  });
}

/**
 * The only application path into this local admission store. No filesystem,
 * payment, network or other irreversible effects occur inside the transaction.
 * Authorization data and time come from the database, NEVER the request.
 * Three full retries bound contention. All mutations roll back on any failure.
 */
export async function applyQuestionAcceptance(
  db: AdmissionClient, networkId: string, input: unknown
): Promise<QuestionAdmissionResult> {
  if (!FoundationIdSchema.safeParse(networkId).success) throw new Error("NETWORK_CONFIGURATION_INVALID");
  const parsed = SignedAcceptQuestionCommandSchema.safeParse(input);
  if (!parsed.success) return { outcome: "Rejected", code: "INVALID_COMMAND" };
  const envelope = parsed.data;
  const c = envelope.command;
  if (c.networkId !== networkId) return { outcome: "Rejected", code: "WRONG_NETWORK" };
  const signedText = questionAcceptanceSigningText(c);
  const envelopeHash = hash("popular-consensus:acceptance-envelope:v0.2-draft\n"
    + signedText + "\n" + envelope.authorization.signatureHex);
  const commandKey = { networkId, commandId: c.commandId };

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await db.$transaction(async (tx): Promise<QuestionAdmissionResult> => {
        const previous = await tx.admissionCommandReceipt.findUnique({ where: { networkId_commandId: commandKey } });
        if (previous) {
          // Possession of the EXACT signed command permits retrieval of its
          // original minimal receipt, even after expiry/revocation. No action
          // is reauthorized and neither current private state nor keys leak.
          if (previous.envelopeHash !== envelopeHash) return { outcome: "Rejected", code: "COMMAND_ID_CONFLICT" };
          const event = await tx.admissionAcceptanceEvent.findUnique({ where: { networkId_commandId: commandKey } });
          if (!event || event.eventHash !== previous.eventHash || event.questionId !== previous.questionId
              || event.revision !== previous.revision
              || hash("popular-consensus:acceptance-event:v0.2-draft\n" + event.payloadJson) !== previous.eventHash) {
            throw new Error("ADMISSION_HISTORY_INCOMPLETE");
          }
          return { outcome: "AlreadyApplied", receipt: receiptDto(previous) };
        }
        // Deterministic lock order: principal, verification method, community,
        // question, then grants. Revocation/suspension cannot overtake a locked
        // evaluation. Changes committed first cause fresh reads or full retry.
        await tx.$queryRaw`SELECT "id" FROM "AdmissionPrincipal"
          WHERE "networkId" = ${networkId} AND "id" = ${c.principalId} FOR UPDATE`;
        const principal = await tx.admissionPrincipal.findUnique({
          where: { networkId_id: { networkId, id: c.principalId } }
        });
        if (!principal) return { outcome: "Rejected", code: "PRINCIPAL_NOT_FOUND" };
        await tx.$queryRaw`SELECT "id" FROM "AdmissionVerificationMethod"
          WHERE "networkId" = ${networkId} AND "id" = ${c.keyId} FOR SHARE`;
        const key = await tx.admissionVerificationMethod.findUnique({ where: { networkId_id: { networkId, id: c.keyId } } });
        await tx.$queryRaw`SELECT "id" FROM "AdmissionCommunity"
          WHERE "networkId" = ${networkId} AND "id" = ${c.payload.communityId} FOR SHARE`;
        const community = await tx.admissionCommunity.findUnique({
          where: { networkId_id: { networkId, id: c.payload.communityId } }
        });
        if (!community) return { outcome: "Rejected", code: "COMMUNITY_UNAVAILABLE" };
        await tx.$queryRaw`SELECT "id" FROM "AdmissionQuestion"
          WHERE "networkId" = ${networkId} AND "id" = ${c.payload.questionId} FOR UPDATE`;
        const q = await tx.admissionQuestion.findUnique({ where: { networkId_id: { networkId, id: c.payload.questionId } } });
        if (!q) return { outcome: "Rejected", code: "QUESTION_NOT_FOUND" };
        await tx.$queryRaw`SELECT "id" FROM "AdmissionCapabilityGrant"
          WHERE "networkId" = ${networkId} AND "principalId" = ${c.principalId}
            AND "communityId" = ${c.payload.communityId}
          ORDER BY "id" LIMIT 129 FOR SHARE`;
        const grants = await tx.admissionCapabilityGrant.findMany({
          where: { networkId, principalId: c.principalId, communityId: c.payload.communityId },
          orderBy: { id: "asc" }, take: 129
        });
        // Read actual database clock AFTER waits, not transaction start time or
        // a caller timestamp. This is a local clock, not distributed finality.
        const [clock] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT date_trunc('milliseconds', clock_timestamp()) AS now`;
        const decision = evaluateQuestionAcceptance(envelope, {
          networkId, evaluatedAt: clock.now.toISOString(), principalId: principal.id,
          principalStatus: principal.status, nextNonce: principal.nextNonce,
          verificationMethod: key ? {
            id: key.id, principalId: key.principalId, status: key.status, publicKeyPem: key.publicKeyPem,
            validFrom: key.validFrom.toISOString(), validUntil: key.validUntil.toISOString()
          } : null,
          capabilities: grants.map((g) => ({
            id: g.id, principalId: g.principalId, communityId: g.communityId, questionId: g.questionId,
            action: g.action, status: g.status, validFrom: g.validFrom.toISOString(), validUntil: g.validUntil.toISOString()
          })),
          question: {
            id: q.id, communityId: q.communityId, communityStatus: community.status,
            proposerPrincipalId: q.proposerPrincipalId, revision: Number(q.revision), version: q.version,
            status: q.status, challengeWindowEndsAt: q.challengeWindowEndsAt.toISOString(),
            unresolvedChallenges: q.unresolvedChallenges, unresolvedAppeals: q.unresolvedAppeals,
            emergencySuspended: community.emergencySuspended
          }
        });
        if (decision.outcome === "Rejected") return decision;
        const nonceUpdate = await tx.admissionPrincipal.updateMany({
          where: { networkId, id: decision.actor.principalId, status: "Active", nextNonce: decision.expectedNonce },
          data: { nextNonce: decision.nextNonce }
        });
        const questionUpdate = await tx.admissionQuestion.updateMany({
          where: { networkId, id: q.id, revision: BigInt(decision.expectedRevision), version: q.version, status: "Submitted" },
          data: { revision: BigInt(decision.nextRevision), status: "Accepted" }
        });
        if (nonceUpdate.count !== 1 || questionUpdate.count !== 1) throw new AdmissionWriteConflict();
        const payloadJson = JSON.stringify([
          "question-accepted-v0.2-draft", networkId, decision.commandId, decision.commandHash,
          decision.actor.principalId, decision.actor.keyId, decision.actor.capabilityId,
          q.communityId, q.id, String(q.version), String(decision.expectedRevision), String(decision.nextRevision),
          decision.fromStatus, decision.toStatus, decision.evaluatedAt
        ]);
        const eventHash = hash("popular-consensus:acceptance-event:v0.2-draft\n" + payloadJson);
        const receipt = await tx.admissionCommandReceipt.create({ data: {
          ...commandKey, commandHash: decision.commandHash, envelopeHash, envelopeJson: JSON.stringify(envelope),
          principalId: decision.actor.principalId, keyId: decision.actor.keyId, capabilityId: decision.actor.capabilityId,
          nonce: decision.expectedNonce, questionId: q.id, communityId: q.communityId,
          revision: BigInt(decision.nextRevision), acceptedAt: clock.now, eventHash
        } });
        await tx.admissionAcceptanceEvent.create({ data: {
          ...commandKey, questionId: q.id, revision: BigInt(decision.nextRevision), eventHash, payloadJson
        } });
        return { outcome: "Applied", receipt: receiptDto(receipt) };
      }, { isolationLevel: AdmissionPrisma.TransactionIsolationLevel.Serializable, maxWait: 2_000, timeout: 5_000 });
    } catch (error) {
      if (!retryable(error)) throw error;
      if (attempt === 3) return { outcome: "Rejected", code: "CONCURRENT_CONFLICT" };
    }
  }
  throw new Error("ADMISSION_RETRY_INVARIANT");
}
