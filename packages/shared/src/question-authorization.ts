import { z } from "zod";
import { FoundationIdSchema, FoundationTimeSchema } from "./foundation";
import { QuestionStatusSchema } from "./index";

// Development adapter, not the final network or cryptographic protocol profile.
export const AcceptanceNonceSchema = z.string().max(20).regex(/^(0|[1-9][0-9]*)(?![\s\S])/);
const RevisionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const AcceptQuestionCommandSchema = z.object({
  schemaVersion: z.literal("accept-question-command-v0.2-draft"),
  networkId: FoundationIdSchema,
  commandId: FoundationIdSchema,
  commandType: z.literal("AcceptQuestion"),
  principalId: FoundationIdSchema,
  keyId: FoundationIdSchema,
  nonce: AcceptanceNonceSchema,
  issuedAt: FoundationTimeSchema,
  expiresAt: FoundationTimeSchema,
  payload: z.object({
    communityId: FoundationIdSchema,
    questionId: FoundationIdSchema,
    expectedRevision: RevisionSchema,
    expectedQuestionVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
  }).strict()
}).strict();

export const SignedAcceptQuestionCommandSchema = z.object({
  command: AcceptQuestionCommandSchema,
  authorization: z.object({
    kind: z.literal("PrincipalSignature"),
    algorithm: z.literal("Ed25519"),
    signatureHex: z.string().length(128).regex(/^[0-9a-f]{128}$/)
  }).strict()
}).strict();

// This is an internal trusted read model, NEVER an HTTP request body. Keys,
// capabilities, principal status and time must be resolved by the adapter.
export const QuestionAcceptanceSnapshotSchema = z.object({
  networkId: FoundationIdSchema,
  evaluatedAt: FoundationTimeSchema,
  principalId: FoundationIdSchema,
  principalStatus: z.enum(["Active", "Suspended", "Revoked"]),
  nextNonce: AcceptanceNonceSchema,
  verificationMethod: z.object({
    id: FoundationIdSchema,
    principalId: FoundationIdSchema,
    status: z.enum(["Active", "Suspended", "Revoked"]),
    publicKeyPem: z.string().min(1).max(1024),
    validFrom: FoundationTimeSchema,
    validUntil: FoundationTimeSchema
  }).strict().nullable(),
  capabilities: z.array(z.object({
    id: FoundationIdSchema,
    principalId: FoundationIdSchema,
    communityId: FoundationIdSchema,
    questionId: FoundationIdSchema.nullable(),
    action: FoundationIdSchema,
    status: z.enum(["Active", "Suspended", "Revoked"]),
    validFrom: FoundationTimeSchema,
    validUntil: FoundationTimeSchema
  }).strict()).max(128).refine((grants) => new Set(grants.map((g) => g.id)).size === grants.length,
    { message: "Duplicate capability IDs are ambiguous" }),
  question: z.object({
    id: FoundationIdSchema,
    communityId: FoundationIdSchema,
    communityStatus: z.enum(["Active", "Suspended", "Archived"]),
    proposerPrincipalId: FoundationIdSchema,
    revision: RevisionSchema,
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    status: QuestionStatusSchema,
    challengeWindowEndsAt: FoundationTimeSchema,
    unresolvedChallenges: z.number().int().nonnegative(),
    unresolvedAppeals: z.number().int().nonnegative(),
    emergencySuspended: z.boolean()
  }).strict()
}).strict();

export type AcceptQuestionCommand = z.infer<typeof AcceptQuestionCommandSchema>;
export type SignedAcceptQuestionCommand = z.infer<typeof SignedAcceptQuestionCommandSchema>;
export type QuestionAcceptanceSnapshot = z.infer<typeof QuestionAcceptanceSnapshotSchema>;

/** Fixed scalar tuple: every signed field is included, independent of JSON key order.
 * This is a versioned command encoding, NOT a general JCS/event implementation.
 */
export function questionAcceptanceSigningText(input: unknown): string {
  const c = AcceptQuestionCommandSchema.parse(input);
  return "popular-consensus:accept-question:ed25519:v0.2-draft\n" + JSON.stringify([
    c.schemaVersion, c.networkId, c.commandId, c.commandType, c.principalId,
    c.keyId, c.nonce, c.issuedAt, c.expiresAt,
    c.payload.communityId, c.payload.questionId,
    String(c.payload.expectedRevision), String(c.payload.expectedQuestionVersion)
  ]);
}
