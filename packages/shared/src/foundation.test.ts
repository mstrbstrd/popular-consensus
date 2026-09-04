import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  FoundationIdSchema,
  FoundationHashSchema,
  FoundationTimeSchema,
  FoundationAmountSchema,
  CreateQuestionIntentSchema,
  ContributionPolicyVersionSchema,
  PrivacyProfileDraftSchema,
  RewardPolicyVersionSchema,
  RequestAggregateUseIntentSchema
} from "./foundation";

const hash = `sha256:${"a".repeat(64)}`;
const question = {
  schemaVersion: "question-intent-v0.2-draft",
  communityId: "community-1",
  bodyHash: hash,
  answerSchemaHash: hash,
  eligibilityPolicyHash: hash,
  privacyProfileHash: hash,
  methodologyHash: hash,
  sponsorDisclosureHash: hash,
  authorityLevel: "Advisory",
  opensAt: "2026-09-01T00:00:00.000Z",
  closesAt: "2026-09-02T00:00:00.000Z"
};
const contribution = {
  schemaVersion: "contribution-policy-v0.2-draft",
  id: "contribution-policy-1",
  communityId: "community-1",
  version: 1,
  participationRequiresCommercialConsent: false,
  commercialUse: { mode: "Disabled" },
  withdrawalAppliesTo: "FutureOptionalUse",
  publishedOutputRecallGuaranteed: false
};
const optIn = {
  mode: "ExplicitOptIn",
  requiresIndividualConsent: true,
  requiresCommunityAuthorization: true,
  requiresPrivacyReview: true,
  rawPrivateResponseExportAllowed: false,
  permittedPurposeHashes: [hash]
};
const privacy = {
  schemaVersion: "privacy-profile-v0.2-draft",
  id: "privacy-profile-1",
  version: 1,
  assurance: "DesignTarget",
  privateAnswersPublicByDefault: false,
  reusableSecretsInRequestsAllowed: false,
  publicIdentityAnswerLinkAllowed: false,
  payoutAnswerLinkAllowed: false,
  silentDowngradeAllowed: false,
  networkAnonymity: "NotProvided",
  receiptFreeness: "NotProvided",
  coercionResistance: "NotProvided",
  publicationPolicyHash: hash
};
const reward = {
  schemaVersion: "reward-policy-v0.2-draft",
  id: "reward-policy-1",
  communityId: "community-1",
  version: 1,
  reward: { mode: "FixedParticipation", assetId: "CAD", amountMinor: "4500" },
  answerDependent: false,
  majorityDependent: false,
  fundingRequiredBeforeParticipation: true,
  earnedRewardsSurvivePublicationSuppression: true,
  payoutRequiresAnswerDisclosure: false,
  disputePolicyHash: hash
};
const dataUse = {
  schemaVersion: "aggregate-use-intent-v0.2-draft",
  communityId: "community-1",
  contributionPolicyHash: hash,
  privacyProfileHash: hash,
  purposeHash: hash,
  datasetCommitmentHash: hash,
  reportDefinitionHash: hash,
  individualConsentEvidenceHash: hash,
  communityAuthorizationHash: hash,
  outputClass: "PrivacyReviewedAggregate"
};
const cases = [
  { name: "question", schema: CreateQuestionIntentSchema, input: question },
  { name: "contribution", schema: ContributionPolicyVersionSchema, input: contribution },
  { name: "privacy", schema: PrivacyProfileDraftSchema, input: privacy },
  { name: "reward", schema: RewardPolicyVersionSchema, input: reward },
  { name: "data use", schema: RequestAggregateUseIntentSchema, input: dataUse }
];

describe("foundation v0.2 draft: structural validation, not authorization", () => {
  it.each(cases)("preserves explicit $name input without mutating it", ({ schema, input }) => {
    const before = structuredClone(input);
    expect(schema.parse(input)).toEqual(before);
    expect(input).toEqual(before);
  });

  for (const { name, schema, input } of cases) {
    it.each(["userId", "proposer", "creatorId", "steward", "juror", "memberId", "credentialSecret", "privateKeyPem", "unknown"])(
      `${name}: rejects caller/secret/unknown field %s`, (field) => {
        expect(schema.safeParse({ ...input, [field]: "not-permitted" }).success).toBe(false);
      }
    );
    it(`${name}: requires every field and an exact schema version`, () => {
      for (const field of Object.keys(input)) {
        const missing: Record<string, unknown> = { ...input };
        delete missing[field];
        expect(schema.safeParse(missing).success).toBe(false);
      }
      expect(schema.safeParse({ ...input, schemaVersion: "v999" }).success).toBe(false);
    });
  }

  it.each(["Binding", "Recognized"])("question: cannot self-assert %s authority", (authorityLevel) => {
    expect(CreateQuestionIntentSchema.safeParse({ ...question, authorityLevel }).success).toBe(false);
  });
  it.each([question.opensAt, "2026-08-31T23:59:59.999Z"])("question: rejects invalid close %s", (closesAt) => {
    const result = CreateQuestionIntentSchema.safeParse({ ...question, closesAt });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.message.startsWith("WINDOW_INVALID"))).toBe(true);
  });
  it("question: accepts a one-millisecond positive window", () => {
    expect(CreateQuestionIntentSchema.safeParse({ ...question, closesAt: "2026-09-01T00:00:00.001Z" }).success).toBe(true);
  });

  it("consent: allows disabled commercial use and explicit bounded opt-in", () => {
    expect(ContributionPolicyVersionSchema.safeParse(contribution).success).toBe(true);
    expect(ContributionPolicyVersionSchema.safeParse({ ...contribution, commercialUse: optIn }).success).toBe(true);
  });
  it.each(["requiresIndividualConsent", "requiresCommunityAuthorization", "requiresPrivacyReview"])(
    "consent: cannot disable %s", (field) => {
      expect(ContributionPolicyVersionSchema.safeParse({ ...contribution, commercialUse: { ...optIn, [field]: false } }).success).toBe(false);
    }
  );
  it.each([
    { participationRequiresCommercialConsent: true },
    { publishedOutputRecallGuaranteed: true },
    { withdrawalAppliesTo: "AllPublishedCopies" },
    { commercialUse: { ...optIn, rawPrivateResponseExportAllowed: true } },
    { commercialUse: { ...optIn, permittedPurposeHashes: [] } },
    { commercialUse: { ...optIn, permittedPurposeHashes: Array(33).fill(hash) } },
    { commercialUse: { ...optIn, bypassPrivacyReview: true } },
    { commercialUse: { mode: "Disabled", permittedPurposeHashes: [hash] } }
  ])("consent: rejects broadened or contradictory permission %#", (patch) => {
    expect(ContributionPolicyVersionSchema.safeParse({ ...contribution, ...patch }).success).toBe(false);
  });

  it.each([
    "privateAnswersPublicByDefault", "reusableSecretsInRequestsAllowed",
    "publicIdentityAnswerLinkAllowed", "payoutAnswerLinkAllowed", "silentDowngradeAllowed"
  ])("privacy: rejects permission to expose %s", (field) => {
    expect(PrivacyProfileDraftSchema.safeParse({ ...privacy, [field]: true }).success).toBe(false);
  });
  it.each(["assurance", "networkAnonymity", "receiptFreeness", "coercionResistance"])(
    "privacy: cannot label %s Verified", (field) => {
      expect(PrivacyProfileDraftSchema.safeParse({ ...privacy, [field]: "Verified" }).success).toBe(false);
    }
  );

  it.each([
    { answerDependent: true }, { majorityDependent: true },
    { fundingRequiredBeforeParticipation: false },
    { earnedRewardsSurvivePublicationSuppression: false },
    { payoutRequiresAnswerDisclosure: true },
    { reward: { ...reward.reward, preferredAnswer: "support" } },
    { reward: { mode: "None", amountMinor: "4500" } }
  ])("rewards: rejects prohibited incentives %#", (patch) => {
    expect(RewardPolicyVersionSchema.safeParse({ ...reward, ...patch }).success).toBe(false);
  });
  it("rewards: permits unpaid participation without requiring an asset", () => {
    expect(RewardPolicyVersionSchema.safeParse({ ...reward, reward: { mode: "None" } }).success).toBe(true);
  });
  it.each(["0", "-1", "+1", "01", "1.5", "1e6", " 10", "10\n", "9".repeat(79), 4500])(
    "amount: rejects ambiguous/nonpositive/oversized value %s", (value) => {
      expect(FoundationAmountSchema.safeParse(value).success).toBe(false);
    }
  );
  it("amount: preserves large integer strings without floating-point loss", () => {
    expect(FoundationAmountSchema.parse("9007199254740993")).toBe("9007199254740993");
  });
  it.each(["", "../escape", "account id", "account\n", "x".repeat(129)])("id: rejects %j", (value) => {
    expect(FoundationIdSchema.safeParse(value).success).toBe(false);
  });
  it.each(["sha256:abc", hash.toUpperCase(), `${hash}\n`, hash.slice(1), "../secret"])("hash: rejects %j", (value) => {
    expect(FoundationHashSchema.safeParse(value).success).toBe(false);
  });
  it.each([
    "2026-09-01T00:00:00Z", "2026-09-01T00:00:00.000+00:00",
    "2026-09-01T00:00:00.000", "2026-02-30T00:00:00.000Z",
    "2026-09-01T00:00:00.000Z\n", 1788220800000
  ])("time: rejects noncanonical/invalid time %j", (value) => {
    expect(FoundationTimeSchema.safeParse(value).success).toBe(false);
  });
  it.each([0, -1, 1.5, "1", Number.MAX_SAFE_INTEGER + 1])("version: rejects %j", (version) => {
    expect(ContributionPolicyVersionSchema.safeParse({ ...contribution, version }).success).toBe(false);
  });
  it("data use: rejects raw output and missing approval references", () => {
    expect(RequestAggregateUseIntentSchema.safeParse({ ...dataUse, outputClass: "RawPrivateAnswers" }).success).toBe(false);
    const { individualConsentEvidenceHash: omitted, ...withoutConsent } = dataUse;
    expect(omitted).toBe(hash);
    expect(RequestAggregateUseIntentSchema.safeParse(withoutConsent).success).toBe(false);
  });
  it.each(cases)("exports strict $name structural JSON Schema", ({ schema }) => {
    const document = z.toJSONSchema(schema, { target: "draft-2020-12" });
    expect(document.type).toBe("object");
    expect(document.additionalProperties).toBe(false);
  });
});
