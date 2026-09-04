import { z } from "zod";

/**
 * Additive v0.2 draft schemas. Not imported by the current API.
 * Parsing validates shape and declared policy only. It does NOT authenticate a
 * caller, verify a proof/hash, authorize data use, establish funding, or provide
 * privacy. See docs/protocol-foundation/README.md for the enforcement boundary.
 */
export const FoundationIdSchema = z.string().min(1).max(128)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*(?![\s\S])/);
export const FoundationHashSchema = z.string().length(71).regex(/^sha256:[0-9a-f]{64}$/);
export const FoundationTimeSchema = z.iso.datetime({ precision: 3 }).length(24);
export const FoundationVersionSchema = z.number().int().positive();
export const FoundationAmountSchema = z.string().max(78).regex(/^[1-9][0-9]*(?![\s\S])/);

// Business intent identifies resources, never the caller. Authorization must
// eventually be verified outside this payload against canonical state.
export const CreateQuestionIntentSchema = z.object({
  schemaVersion: z.literal("question-intent-v0.2-draft"),
  communityId: FoundationIdSchema,
  bodyHash: FoundationHashSchema,
  answerSchemaHash: FoundationHashSchema,
  eligibilityPolicyHash: FoundationHashSchema,
  privacyProfileHash: FoundationHashSchema,
  methodologyHash: FoundationHashSchema,
  sponsorDisclosureHash: FoundationHashSchema,
  authorityLevel: z.literal("Advisory"),
  opensAt: FoundationTimeSchema,
  closesAt: FoundationTimeSchema
}).strict().superRefine((value, context) => {
  // Fixed UTC millisecond strings sort chronologically once validated.
  if (value.closesAt <= value.opensAt) {
    context.addIssue({
      code: "custom",
      path: ["closesAt"],
      message: "WINDOW_INVALID: closesAt must be after opensAt"
    });
  }
});

export const CommercialUsePolicySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("Disabled") }).strict(),
  z.object({
    mode: z.literal("ExplicitOptIn"),
    requiresIndividualConsent: z.literal(true),
    requiresCommunityAuthorization: z.literal(true),
    requiresPrivacyReview: z.literal(true),
    rawPrivateResponseExportAllowed: z.literal(false),
    permittedPurposeHashes: z.array(FoundationHashSchema).min(1).max(32)
  }).strict()
]);

export const ContributionPolicyVersionSchema = z.object({
  schemaVersion: z.literal("contribution-policy-v0.2-draft"),
  id: FoundationIdSchema,
  communityId: FoundationIdSchema,
  version: FoundationVersionSchema,
  participationRequiresCommercialConsent: z.literal(false),
  commercialUse: CommercialUsePolicySchema,
  withdrawalAppliesTo: z.literal("FutureOptionalUse"),
  publishedOutputRecallGuaranteed: z.literal(false)
}).strict();

// This object records requirements, not attained guarantees. A production
// profile and its reviewed cryptographic/evidence bindings remain open work.
export const PrivacyProfileDraftSchema = z.object({
  schemaVersion: z.literal("privacy-profile-v0.2-draft"),
  id: FoundationIdSchema,
  version: FoundationVersionSchema,
  assurance: z.literal("DesignTarget"),
  privateAnswersPublicByDefault: z.literal(false),
  reusableSecretsInRequestsAllowed: z.literal(false),
  publicIdentityAnswerLinkAllowed: z.literal(false),
  payoutAnswerLinkAllowed: z.literal(false),
  silentDowngradeAllowed: z.literal(false),
  networkAnonymity: z.literal("NotProvided"),
  receiptFreeness: z.literal("NotProvided"),
  coercionResistance: z.literal("NotProvided"),
  publicationPolicyHash: FoundationHashSchema
}).strict();

export const ParticipationRewardSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("None") }).strict(),
  z.object({
    mode: z.literal("FixedParticipation"),
    assetId: FoundationIdSchema,
    amountMinor: FoundationAmountSchema
  }).strict()
]);

export const RewardPolicyVersionSchema = z.object({
  schemaVersion: z.literal("reward-policy-v0.2-draft"),
  id: FoundationIdSchema,
  communityId: FoundationIdSchema,
  version: FoundationVersionSchema,
  reward: ParticipationRewardSchema,
  answerDependent: z.literal(false),
  majorityDependent: z.literal(false),
  fundingRequiredBeforeParticipation: z.literal(true),
  earnedRewardsSurvivePublicationSuppression: z.literal(true),
  payoutRequiresAnswerDisclosure: z.literal(false),
  disputePolicyHash: FoundationHashSchema
}).strict();

// References are mandatory but are NOT themselves proof of permission. The
// future data-use engine must load and verify every referenced record, scope,
// validity, withdrawal state, and release policy before authorizing any use.
export const RequestAggregateUseIntentSchema = z.object({
  schemaVersion: z.literal("aggregate-use-intent-v0.2-draft"),
  communityId: FoundationIdSchema,
  contributionPolicyHash: FoundationHashSchema,
  privacyProfileHash: FoundationHashSchema,
  purposeHash: FoundationHashSchema,
  datasetCommitmentHash: FoundationHashSchema,
  reportDefinitionHash: FoundationHashSchema,
  individualConsentEvidenceHash: FoundationHashSchema,
  communityAuthorizationHash: FoundationHashSchema,
  outputClass: z.literal("PrivacyReviewedAggregate")
}).strict();

export type CreateQuestionIntent = z.infer<typeof CreateQuestionIntentSchema>;
export type ContributionPolicyVersion = z.infer<typeof ContributionPolicyVersionSchema>;
export type PrivacyProfileDraft = z.infer<typeof PrivacyProfileDraftSchema>;
export type RewardPolicyVersion = z.infer<typeof RewardPolicyVersionSchema>;
export type RequestAggregateUseIntent = z.infer<typeof RequestAggregateUseIntentSchema>;
