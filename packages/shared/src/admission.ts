import { z } from "zod";
import { CreateQuestionIntentSchema, FoundationHashSchema, FoundationIdSchema, FoundationTimeSchema } from "./foundation";

const WindowSchema = z.object({
  validFrom: FoundationTimeSchema,
  validUntil: FoundationTimeSchema
}).strict().refine((v) => v.validFrom < v.validUntil, { message: "WINDOW_INVALID" });

/** Operator-controlled LOCAL initialization, never an HTTP enrollment DTO. */
export const AdmissionBootstrapSchema = z.object({
  schemaVersion: z.literal("admission-bootstrap-v0.2-draft"),
  networkId: FoundationIdSchema,
  principals: z.array(z.object({ id: FoundationIdSchema }).strict()).min(2).max(128),
  verificationMethods: z.array(z.object({
    id: FoundationIdSchema,
    principalId: FoundationIdSchema,
    publicKeyPem: z.string().min(1).max(1024),
    validity: WindowSchema
  }).strict()).min(1).max(128),
  communities: z.array(z.object({ id: FoundationIdSchema }).strict()).min(1).max(32),
  questions: z.array(z.object({
    id: FoundationIdSchema,
    proposerPrincipalId: FoundationIdSchema,
    intent: CreateQuestionIntentSchema,
    challengeWindowEndsAt: FoundationTimeSchema
  }).strict().refine((q) => q.challengeWindowEndsAt <= q.intent.opensAt, { message: "WINDOW_INVALID" })).min(1).max(128),
  capabilities: z.array(z.object({
    id: FoundationIdSchema,
    principalId: FoundationIdSchema,
    communityId: FoundationIdSchema,
    questionId: FoundationIdSchema.nullable(),
    action: z.literal("QuestionAccept"),
    validity: WindowSchema
  }).strict()).min(1).max(128)
}).strict();

/** Restricted administrative receipt, not a canonical public-network event. */
export const AppliedQuestionAcceptanceReceiptSchema = z.object({
  schemaVersion: z.literal("accept-question-receipt-v0.2-draft"),
  trustProfile: z.literal("LocalDatabase"),
  networkId: FoundationIdSchema,
  commandId: FoundationIdSchema,
  commandHash: FoundationHashSchema,
  questionId: FoundationIdSchema,
  status: z.literal("Accepted"),
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  acceptedAt: FoundationTimeSchema,
  eventHash: FoundationHashSchema
}).strict();
export type AppliedQuestionAcceptanceReceipt = z.infer<typeof AppliedQuestionAcceptanceReceiptSchema>;
