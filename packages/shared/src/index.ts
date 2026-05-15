import { z } from "zod";

export const AuthorityLevelSchema = z.enum(["Advisory", "Recognized", "Binding"]);
export const CommunityVisibilitySchema = z.enum(["Public", "Private"]);
export const CommunityKindSchema = z.enum(["Group", "Profile"]);
export const QuestionAudienceSchema = z.enum(["Public", "Followers", "Members"]);
export const FeedModeSchema = z.enum(["global", "for-you", "following", "profile", "community"]);
export const CommunityRegistryStatusSchema = z.enum(["Active", "Pending", "Rejected", "Suspended"]);
export const MembershipSourceStatusSchema = z.enum(["Active", "Inactive"]);
export const MembershipSourceTypeSchema = z.enum(["DirectJoin", "ChildCommunity", "Seed", "ProposalCreator"]);
export const CommunityChildProposalStatusSchema = z.enum(["Pending", "Approved", "ApprovedByMembers", "Rejected"]);
export const CommunityChildProposalVoteSchema = z.enum(["Support", "Oppose"]);
export const PollResultModeSchema = z.enum(["PeopleVote", "CommunitiesSignal", "ShowBoth"]);
export const QuestionStatusSchema = z.enum([
  "Drafted",
  "Submitted",
  "Challenged",
  "Amendment",
  "Rejected",
  "Accepted",
  "Open",
  "Closed",
  "ResultPublished",
  "ResultChallenged",
  "Corrected",
  "Finalized",
  "Archived"
]);

export const AnswerSchemaKindSchema = z.enum([
  "Binary",
  "MultipleChoice",
  "Approval",
  "RankedChoice",
  "Likert",
  "Score",
  "Budget",
  "Numeric",
  "ShortText",
  "LongText"
]);

export const ResponseShapeSchema = z.enum([
  "SingleChoice",
  "MultipleChoice",
  "RankedChoice",
  "Scale",
  "BudgetAllocation",
  "Numeric",
  "FreeText"
]);

export const TallyMethodSchema = z.enum([
  "PluralityCounts",
  "ApprovalCounts",
  "InstantRunoff",
  "BordaCount",
  "ScaleDistribution",
  "BudgetTotals",
  "NumericSummary",
  "TextCountOnly"
]);

export const PrivacyModeSchema = z.enum(["PrivateEncrypted", "PublicResponse", "PrivateAggregateOnly"]);
export const DisplayModeSchema = z.enum(["Buttons", "RadioGroup", "Checkboxes", "RankInputs", "Scale", "BudgetInputs", "NumberInput", "TextArea"]);

export const AnswerOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().default("")
});

export const AnswerValidationRulesSchema = z.object({
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  step: z.number().positive().optional(),
  budgetTotal: z.number().positive().optional(),
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().positive().optional()
});

export const AnswerSchemaSchema = z.object({
  answerSchemaId: z.string(),
  kind: AnswerSchemaKindSchema,
  label: z.string(),
  description: z.string(),
  responseShape: ResponseShapeSchema,
  options: z.array(AnswerOptionSchema),
  optionsHash: z.string(),
  minSelections: z.number().int().nonnegative(),
  maxSelections: z.number().int().positive(),
  allowsAbstain: z.boolean(),
  allowsReplacement: z.boolean(),
  validationCircuitId: z.string(),
  validationRules: AnswerValidationRulesSchema,
  tallyMethod: TallyMethodSchema,
  privacyMode: PrivacyModeSchema,
  displayMode: DisplayModeSchema
});

export const SingleChoiceResponseSchema = z.object({
  type: z.literal("single_choice"),
  choice: z.string()
});

export const MultipleChoiceResponseSchema = z.object({
  type: z.literal("multiple_choice"),
  choices: z.array(z.string())
});

export const RankedChoiceResponseSchema = z.object({
  type: z.literal("ranked_choice"),
  ranking: z.array(z.string())
});

export const ScaleResponseSchema = z.object({
  type: z.literal("scale"),
  value: z.number()
});

export const BudgetResponseSchema = z.object({
  type: z.literal("budget_allocation"),
  allocations: z.record(z.string(), z.number())
});

export const NumericResponseSchema = z.object({
  type: z.literal("numeric"),
  value: z.number()
});

export const FreeTextResponseSchema = z.object({
  type: z.literal("free_text"),
  text: z.string()
});

export const BallotResponseSchema = z.discriminatedUnion("type", [
  SingleChoiceResponseSchema,
  MultipleChoiceResponseSchema,
  RankedChoiceResponseSchema,
  ScaleResponseSchema,
  BudgetResponseSchema,
  NumericResponseSchema,
  FreeTextResponseSchema
]);

export type AnswerSchema = z.infer<typeof AnswerSchemaSchema>;
export type BallotResponse = z.infer<typeof BallotResponseSchema>;

export const BuiltInAnswerSchemas: AnswerSchema[] = [
  {
    answerSchemaId: "answer-binary-support-oppose",
    kind: "Binary",
    label: "Support / Oppose",
    description: "A two-option advisory response with an optional abstain response.",
    responseShape: "SingleChoice",
    options: [
      { id: "support", label: "Support", description: "I support the proposal as worded." },
      { id: "oppose", label: "Oppose", description: "I oppose the proposal as worded." }
    ],
    optionsHash: "schema:binary-support-oppose:v1",
    minSelections: 1,
    maxSelections: 1,
    allowsAbstain: true,
    allowsReplacement: false,
    validationCircuitId: "circuit:finite-domain-single-choice:v1",
    validationRules: {},
    tallyMethod: "PluralityCounts",
    privacyMode: "PrivateEncrypted",
    displayMode: "Buttons"
  },
  {
    answerSchemaId: "answer-yes-no",
    kind: "Binary",
    label: "Yes / No",
    description: "A neutral yes/no version of binary multiple choice.",
    responseShape: "SingleChoice",
    options: [
      { id: "yes", label: "Yes", description: "Yes." },
      { id: "no", label: "No", description: "No." }
    ],
    optionsHash: "schema:yes-no:v1",
    minSelections: 1,
    maxSelections: 1,
    allowsAbstain: true,
    allowsReplacement: false,
    validationCircuitId: "circuit:finite-domain-single-choice:v1",
    validationRules: {},
    tallyMethod: "PluralityCounts",
    privacyMode: "PrivateEncrypted",
    displayMode: "Buttons"
  },
  {
    answerSchemaId: "answer-true-false",
    kind: "Binary",
    label: "True / False",
    description: "A neutral true/false format for factual or claim-review questions.",
    responseShape: "SingleChoice",
    options: [
      { id: "true", label: "True", description: "The statement is true." },
      { id: "false", label: "False", description: "The statement is false." }
    ],
    optionsHash: "schema:true-false:v1",
    minSelections: 1,
    maxSelections: 1,
    allowsAbstain: true,
    allowsReplacement: false,
    validationCircuitId: "circuit:finite-domain-single-choice:v1",
    validationRules: {},
    tallyMethod: "PluralityCounts",
    privacyMode: "PrivateEncrypted",
    displayMode: "Buttons"
  },
  {
    answerSchemaId: "answer-single-choice-civic-priority",
    kind: "MultipleChoice",
    label: "Single-Select Multiple Choice",
    description: "Respondents choose one option from a fixed list.",
    responseShape: "SingleChoice",
    options: [
      { id: "safety", label: "Safety", description: "Prioritize safety improvements." },
      { id: "accessibility", label: "Accessibility", description: "Prioritize accessibility improvements." },
      { id: "affordability", label: "Affordability", description: "Prioritize affordability." },
      { id: "frequency", label: "Service frequency", description: "Prioritize more frequent service." }
    ],
    optionsHash: "schema:single-choice-civic-priority:v1",
    minSelections: 1,
    maxSelections: 1,
    allowsAbstain: true,
    allowsReplacement: false,
    validationCircuitId: "circuit:finite-domain-single-choice:v1",
    validationRules: {},
    tallyMethod: "PluralityCounts",
    privacyMode: "PrivateEncrypted",
    displayMode: "RadioGroup"
  },
  {
    answerSchemaId: "answer-approval-civic-priorities",
    kind: "Approval",
    label: "Approval / Select All",
    description: "Respondents may approve any number of compatible options.",
    responseShape: "MultipleChoice",
    options: [
      { id: "safety", label: "Safety upgrades", description: "Protected crossings, lighting, and traffic calming." },
      { id: "service", label: "More service", description: "More frequent or extended service." },
      { id: "affordability", label: "Lower fares", description: "Fare relief or targeted discounts." },
      { id: "accessibility", label: "Accessibility", description: "Elevators, ramps, and accessible stops." }
    ],
    optionsHash: "schema:approval-civic-priorities:v1",
    minSelections: 0,
    maxSelections: 4,
    allowsAbstain: true,
    allowsReplacement: false,
    validationCircuitId: "circuit:finite-domain-multiple-choice:v1",
    validationRules: {},
    tallyMethod: "ApprovalCounts",
    privacyMode: "PrivateEncrypted",
    displayMode: "Checkboxes"
  },
  {
    answerSchemaId: "answer-ranked-policy-options",
    kind: "RankedChoice",
    label: "Ranked Choice",
    description: "Respondents rank options in order of preference.",
    responseShape: "RankedChoice",
    options: [
      { id: "pilot", label: "Short pilot", description: "Run a short trial before deciding." },
      { id: "limited", label: "Limited rollout", description: "Adopt with limits and review." },
      { id: "full", label: "Full rollout", description: "Adopt the policy broadly." },
      { id: "no-change", label: "No change", description: "Keep the current approach." }
    ],
    optionsHash: "schema:ranked-policy-options:v1",
    minSelections: 1,
    maxSelections: 4,
    allowsAbstain: true,
    allowsReplacement: false,
    validationCircuitId: "circuit:finite-domain-ranked-choice:v1",
    validationRules: {},
    tallyMethod: "BordaCount",
    privacyMode: "PrivateEncrypted",
    displayMode: "RankInputs"
  },
  {
    answerSchemaId: "answer-likert-agreement-5",
    kind: "Likert",
    label: "Five-Point Agreement Scale",
    description: "Respondents choose a level of agreement from 1 to 5.",
    responseShape: "Scale",
    options: [],
    optionsHash: "schema:likert-agreement-5:v1",
    minSelections: 1,
    maxSelections: 1,
    allowsAbstain: true,
    allowsReplacement: false,
    validationCircuitId: "circuit:bounded-scale:v1",
    validationRules: { minValue: 1, maxValue: 5, step: 1 },
    tallyMethod: "ScaleDistribution",
    privacyMode: "PrivateEncrypted",
    displayMode: "Scale"
  },
  {
    answerSchemaId: "answer-score-0-10",
    kind: "Score",
    label: "Zero-to-Ten Score",
    description: "Respondents score a proposal or experience from 0 to 10.",
    responseShape: "Scale",
    options: [],
    optionsHash: "schema:score-0-10:v1",
    minSelections: 1,
    maxSelections: 1,
    allowsAbstain: true,
    allowsReplacement: false,
    validationCircuitId: "circuit:bounded-scale:v1",
    validationRules: { minValue: 0, maxValue: 10, step: 1 },
    tallyMethod: "ScaleDistribution",
    privacyMode: "PrivateEncrypted",
    displayMode: "Scale"
  },
  {
    answerSchemaId: "answer-budget-allocation-100",
    kind: "Budget",
    label: "Budget Allocation",
    description: "Respondents allocate 100 civic budget points across options.",
    responseShape: "BudgetAllocation",
    options: [
      { id: "maintenance", label: "Maintenance", description: "Maintain existing services." },
      { id: "expansion", label: "Expansion", description: "Expand access or coverage." },
      { id: "safety", label: "Safety", description: "Improve safety." },
      { id: "reserves", label: "Reserves", description: "Hold funds for future needs." }
    ],
    optionsHash: "schema:budget-allocation-100:v1",
    minSelections: 1,
    maxSelections: 4,
    allowsAbstain: true,
    allowsReplacement: false,
    validationCircuitId: "circuit:budget-allocation:v1",
    validationRules: { budgetTotal: 100, minValue: 0, maxValue: 100, step: 1 },
    tallyMethod: "BudgetTotals",
    privacyMode: "PrivateEncrypted",
    displayMode: "BudgetInputs"
  },
  {
    answerSchemaId: "answer-numeric-estimate",
    kind: "Numeric",
    label: "Numeric Estimate",
    description: "Respondents submit one bounded numeric estimate; tally publishes summary statistics.",
    responseShape: "Numeric",
    options: [],
    optionsHash: "schema:numeric-estimate:v1",
    minSelections: 1,
    maxSelections: 1,
    allowsAbstain: true,
    allowsReplacement: false,
    validationCircuitId: "circuit:bounded-numeric:v1",
    validationRules: { minValue: 0, maxValue: 1000000 },
    tallyMethod: "NumericSummary",
    privacyMode: "PrivateEncrypted",
    displayMode: "NumberInput"
  },
  {
    answerSchemaId: "answer-short-text",
    kind: "ShortText",
    label: "Short Form",
    description: "Respondents submit a short private text response; MVP tally publishes counts, not raw text.",
    responseShape: "FreeText",
    options: [],
    optionsHash: "schema:short-text:v1",
    minSelections: 1,
    maxSelections: 1,
    allowsAbstain: true,
    allowsReplacement: false,
    validationCircuitId: "circuit:text-length:v1",
    validationRules: { minLength: 1, maxLength: 280 },
    tallyMethod: "TextCountOnly",
    privacyMode: "PrivateAggregateOnly",
    displayMode: "TextArea"
  },
  {
    answerSchemaId: "answer-long-text",
    kind: "LongText",
    label: "Long Form",
    description: "Respondents submit a longer private text response; MVP tally publishes counts, not raw text.",
    responseShape: "FreeText",
    options: [],
    optionsHash: "schema:long-text:v1",
    minSelections: 1,
    maxSelections: 1,
    allowsAbstain: true,
    allowsReplacement: false,
    validationCircuitId: "circuit:text-length:v1",
    validationRules: { minLength: 1, maxLength: 5000 },
    tallyMethod: "TextCountOnly",
    privacyMode: "PrivateAggregateOnly",
    displayMode: "TextArea"
  }
];

export const AnswerSchemaById: Record<string, AnswerSchema> = Object.fromEntries(
  BuiltInAnswerSchemas.map((schema) => [schema.answerSchemaId, schema])
);

export function getAnswerSchema(answerSchemaId: string): AnswerSchema {
  const schema = AnswerSchemaById[answerSchemaId];
  if (!schema) throw new Error(`Unknown answer schema: ${answerSchemaId}`);
  return schema;
}

export function choiceToBallotResponse(choice: string): BallotResponse {
  return choice === "abstain" ? { type: "single_choice", choice: "abstain" } : { type: "single_choice", choice };
}

export function validateBallotResponse(answerSchema: AnswerSchema, response: BallotResponse): BallotResponse {
  const optionIds = new Set(answerSchema.options.map((option) => option.id));
  const validChoice = (choice: string) => optionIds.has(choice) || (answerSchema.allowsAbstain && choice === "abstain");

  if (answerSchema.allowsAbstain && response.type === "single_choice" && response.choice === "abstain") return response;

  if (answerSchema.responseShape === "SingleChoice") {
    if (response.type !== "single_choice" || !validChoice(response.choice)) throw new Error("Response must choose one valid option");
    return response;
  }

  if (answerSchema.responseShape === "MultipleChoice") {
    if (response.type !== "multiple_choice") throw new Error("Response must choose one or more valid options");
    const uniqueChoices = Array.from(new Set(response.choices));
    if (uniqueChoices.length < answerSchema.minSelections || uniqueChoices.length > answerSchema.maxSelections) {
      throw new Error("Response has an invalid number of selections");
    }
    if (!uniqueChoices.every((choice) => optionIds.has(choice))) throw new Error("Response contains an invalid option");
    return { ...response, choices: uniqueChoices };
  }

  if (answerSchema.responseShape === "RankedChoice") {
    if (response.type !== "ranked_choice") throw new Error("Response must rank valid options");
    const uniqueRanking = Array.from(new Set(response.ranking));
    if (uniqueRanking.length !== response.ranking.length) throw new Error("Response cannot rank the same option more than once");
    if (uniqueRanking.length < answerSchema.minSelections || uniqueRanking.length > answerSchema.maxSelections) {
      throw new Error("Response has an invalid ranking length");
    }
    if (!uniqueRanking.every((choice) => optionIds.has(choice))) throw new Error("Response ranks an invalid option");
    return { ...response, ranking: uniqueRanking };
  }

  if (answerSchema.responseShape === "Scale") {
    if (response.type !== "scale") throw new Error("Response must use the configured scale");
    const min = answerSchema.validationRules.minValue ?? 1;
    const max = answerSchema.validationRules.maxValue ?? 5;
    const step = answerSchema.validationRules.step ?? 1;
    if (response.value < min || response.value > max || (response.value - min) % step !== 0) throw new Error("Response is outside the allowed scale");
    return response;
  }

  if (answerSchema.responseShape === "BudgetAllocation") {
    if (response.type !== "budget_allocation") throw new Error("Response must allocate the configured budget");
    const budgetTotal = answerSchema.validationRules.budgetTotal ?? 100;
    const normalized = Object.fromEntries(answerSchema.options.map((option) => [option.id, response.allocations[option.id] ?? 0]));
    const values = Object.values(normalized);
    if (!values.every((value) => Number.isFinite(value) && value >= 0)) throw new Error("Budget allocations must be non-negative numbers");
    const total = values.reduce((sum, value) => sum + value, 0);
    if (total !== budgetTotal) throw new Error(`Budget allocations must total ${budgetTotal}`);
    return { ...response, allocations: normalized };
  }

  if (answerSchema.responseShape === "Numeric") {
    if (response.type !== "numeric") throw new Error("Response must be numeric");
    const min = answerSchema.validationRules.minValue ?? Number.NEGATIVE_INFINITY;
    const max = answerSchema.validationRules.maxValue ?? Number.POSITIVE_INFINITY;
    if (!Number.isFinite(response.value) || response.value < min || response.value > max) throw new Error("Numeric response is outside the allowed range");
    return response;
  }

  if (answerSchema.responseShape === "FreeText") {
    if (response.type !== "free_text") throw new Error("Response must be text");
    const text = response.text.trim();
    const min = answerSchema.validationRules.minLength ?? 1;
    const max = answerSchema.validationRules.maxLength ?? 5000;
    if (text.length < min || text.length > max) throw new Error("Text response length is outside the allowed range");
    return { ...response, text };
  }

  throw new Error("Unsupported response shape");
}

export function tallyBallotResponses(answerSchema: AnswerSchema, responses: BallotResponse[]) {
  const aggregateBase = {
    answerSchemaId: answerSchema.answerSchemaId,
    kind: answerSchema.kind,
    responseShape: answerSchema.responseShape,
    tallyMethod: answerSchema.tallyMethod
  };

  if (answerSchema.responseShape === "SingleChoice") {
    const counts = Object.fromEntries(answerSchema.options.map((option) => [option.id, 0])) as Record<string, number>;
    if (answerSchema.allowsAbstain) counts.abstain = 0;
    for (const response of responses) {
      if (response.type === "single_choice") counts[response.choice] = (counts[response.choice] ?? 0) + 1;
    }
    return { ...aggregateBase, counts, turnout: responses.length };
  }

  if (answerSchema.responseShape === "MultipleChoice") {
    const counts = Object.fromEntries(answerSchema.options.map((option) => [option.id, 0])) as Record<string, number>;
    for (const response of responses) {
      if (response.type === "multiple_choice") {
        for (const choice of response.choices) counts[choice] = (counts[choice] ?? 0) + 1;
      }
    }
    return { ...aggregateBase, counts, turnout: responses.length };
  }

  if (answerSchema.responseShape === "RankedChoice") {
    const firstChoiceCounts = Object.fromEntries(answerSchema.options.map((option) => [option.id, 0])) as Record<string, number>;
    const bordaScores = Object.fromEntries(answerSchema.options.map((option) => [option.id, 0])) as Record<string, number>;
    const maxRank = answerSchema.options.length;
    for (const response of responses) {
      if (response.type === "ranked_choice") {
        if (response.ranking[0]) firstChoiceCounts[response.ranking[0]] += 1;
        response.ranking.forEach((choice, index) => {
          bordaScores[choice] += maxRank - index - 1;
        });
      }
    }
    return { ...aggregateBase, firstChoiceCounts, bordaScores, turnout: responses.length };
  }

  if (answerSchema.responseShape === "Scale") {
    const min = answerSchema.validationRules.minValue ?? 1;
    const max = answerSchema.validationRules.maxValue ?? 5;
    const distribution: Record<string, number> = {};
    for (let value = min; value <= max; value += answerSchema.validationRules.step ?? 1) distribution[String(value)] = 0;
    const values = responses.flatMap((response) => (response.type === "scale" ? [response.value] : []));
    for (const value of values) distribution[String(value)] = (distribution[String(value)] ?? 0) + 1;
    const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    return { ...aggregateBase, distribution, average, turnout: responses.length };
  }

  if (answerSchema.responseShape === "BudgetAllocation") {
    const totals = Object.fromEntries(answerSchema.options.map((option) => [option.id, 0])) as Record<string, number>;
    for (const response of responses) {
      if (response.type === "budget_allocation") {
        for (const option of answerSchema.options) totals[option.id] += response.allocations[option.id] ?? 0;
      }
    }
    const averages = Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, responses.length ? value / responses.length : 0]));
    return { ...aggregateBase, totals, averages, turnout: responses.length };
  }

  if (answerSchema.responseShape === "Numeric") {
    const values = responses.flatMap((response) => (response.type === "numeric" ? [response.value] : []));
    return {
      ...aggregateBase,
      count: values.length,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
      turnout: responses.length
    };
  }

  const textLengths = responses.flatMap((response) => (response.type === "free_text" ? [response.text.length] : []));
  return {
    ...aggregateBase,
    responseCount: textLengths.length,
    averageLength: textLengths.length ? textLengths.reduce((sum, value) => sum + value, 0) / textLengths.length : null,
    turnout: responses.length
  };
}

export const QuestionSpecSchema = z.object({
  questionId: z.string(),
  version: z.number().int().positive(),
  title: z.string().min(1),
  bodyHash: z.string(),
  answerSchemaId: z.string(),
  credentialSchemaId: z.string(),
  communityId: z.string().nullable(),
  audience: QuestionAudienceSchema.default("Public"),
  topicIds: z.array(z.string()),
  geoScope: z.string().nullable(),
  sponsorDisclosureHash: z.string().nullable(),
  methodologyLabel: z.string(),
  authorityLevel: AuthorityLevelSchema,
  opensAt: z.number().int(),
  closesAt: z.number().int(),
  challengeWindowEndsAt: z.number().int(),
  proposer: z.string(),
  proposalBondId: z.string(),
  adoptionPolicyId: z.string().nullable().optional(),
  currentStatus: QuestionStatusSchema
});

export const CredentialSchemaSchema = z.object({
  credentialSchemaId: z.string(),
  name: z.string(),
  issuerRegistryId: z.string(),
  eligibilityClaimHash: z.string(),
  nullifierDomainRule: z.string(),
  expiresAfter: z.number().int().nullable(),
  revocationRoot: z.string().nullable(),
  status: z.enum(["Proposed", "Active", "Deprecated", "Retired"])
});

export const CredentialIssuerSchema = z.object({
  issuerId: z.string(),
  publicKey: z.string(),
  schemaIds: z.array(z.string()),
  metadataHash: z.string(),
  stakeId: z.string().nullable(),
  status: z.enum(["Pending", "Active", "Suspended", "Removed"])
});

export const CredentialIssuerAnnotationSchema = z.object({
  issuerId: z.string(),
  status: z.string(),
  schemaIds: z.array(z.string()),
  metadataHash: z.string(),
  suspensionHash: z.string().nullable(),
  affectedQuestionIds: z.array(z.string()),
  note: z.string()
});

export const CredentialRevocationRootSchema = z.object({
  schemaId: z.string(),
  revokedCredentialCount: z.number().int().nonnegative(),
  leafHashes: z.array(z.string()),
  revocationHashes: z.array(z.string()),
  previousRoot: z.string().nullable()
});

export const CommunityCredentialTrustPolicyModeSchema = z.enum(["AllowList", "Open"]);

export const CommunityCredentialTrustPolicySchema = z.object({
  id: z.string(),
  communityId: z.string(),
  credentialSchemaId: z.string(),
  trustedIssuerIds: z.array(z.string()),
  mode: CommunityCredentialTrustPolicyModeSchema,
  status: z.enum(["Active", "Superseded", "Suspended"]),
  policyHash: z.string(),
  createdBy: z.string(),
  createdAt: z.union([z.number().int(), z.string().datetime(), z.date()]),
  updatedAt: z.union([z.number().int(), z.string().datetime(), z.date()]).optional()
});

export const ProposalBondSchema = z.object({
  bondId: z.string(),
  owner: z.string(),
  questionId: z.string().nullable(),
  challengeId: z.string().nullable(),
  resultChallengeId: z.string().nullable().optional(),
  challengeAppealId: z.string().nullable().optional(),
  jurorAssignmentId: z.string().nullable().optional(),
  amountPc: z.number().int().nonnegative(),
  bondType: z.enum(["Proposal", "Challenge", "Appeal"]),
  status: z.enum(["Escrowed", "Refunded", "Slashed", "PartiallySlashed"]),
  slashedPc: z.number().int().nonnegative(),
  refundedPc: z.number().int().nonnegative(),
  rewardPc: z.number().int().nonnegative(),
  treasuryPc: z.number().int().nonnegative(),
  settledAt: z.number().int().nullable()
});

export const TreasuryLedgerEntryTypeSchema = z.enum([
  "Escrow",
  "Refund",
  "Reward",
  "TreasuryFee",
  "DataUnionPayment",
  "DataUnionRevenue",
  "ParticipantPoolCredit",
  "OperatorPoolCredit"
]);
export const TreasuryLedgerDirectionSchema = z.enum(["Debit", "Credit"]);
export const TreasuryLedgerAccountRoleSchema = z.enum(["Participant", "CommunityTreasury", "ParticipantPool", "OperatorPool", "DataBuyer"]);

export const TreasuryLedgerEntrySchema = z.object({
  id: z.string(),
  communityId: z.string(),
  accountId: z.string(),
  accountRole: TreasuryLedgerAccountRoleSchema,
  entryType: TreasuryLedgerEntryTypeSchema,
  direction: TreasuryLedgerDirectionSchema,
  amountPc: z.number().int().nonnegative(),
  balanceImpactPc: z.number().int(),
  bondId: z.string().nullable().optional(),
  bondType: z.enum(["Proposal", "Challenge", "Appeal"]).nullable().optional(),
  sourceType: z.enum(["ProposalBond", "QuestionChallengeBond", "ResultChallengeBond", "AppealBond", "DataUnionAccessGrant"]),
  sourceId: z.string(),
  questionId: z.string().nullable(),
  challengeId: z.string().nullable(),
  resultChallengeId: z.string().nullable(),
  challengeAppealId: z.string().nullable(),
  dataUnionProductId: z.string().nullable().optional(),
  dataUnionAccessGrantId: z.string().nullable().optional(),
  createdAt: z.union([z.number().int(), z.string().datetime(), z.date()])
});

export const TreasuryLedgerTotalsSchema = z.object({
  entryCount: z.number().int().nonnegative(),
  escrowedPc: z.number().int().nonnegative(),
  refundedPc: z.number().int().nonnegative(),
  rewardedPc: z.number().int().nonnegative(),
  treasuryPc: z.number().int().nonnegative(),
  dataUnionRevenuePc: z.number().int().nonnegative().default(0),
  participantPoolPc: z.number().int().nonnegative().default(0),
  operatorPoolPc: z.number().int().nonnegative().default(0),
  openEscrowPc: z.number().int().nonnegative(),
  treasuryBalancePc: z.number().int().nonnegative(),
  participantNetPc: z.record(z.string(), z.number().int())
});

export const ChallengeSchema = z.object({
  challengeId: z.string(),
  targetType: z.enum(["Question", "CredentialSchema", "Issuer", "Result", "AdoptionPolicy"]),
  targetId: z.string(),
  reasonCode: z.string(),
  evidenceHash: z.string(),
  challenger: z.string(),
  challengeBondId: z.string(),
  jurorPoolId: z.string(),
  ruling: z.enum(["Pending", "Sustained", "Rejected", "Remanded"]),
  resolutionHash: z.string().nullable()
});

export const ChallengeRulingSchema = z.enum(["Sustained", "Rejected", "Remanded"]);

export const ChallengeAppealTargetTypeSchema = z.enum(["QuestionChallenge", "ResultChallenge"]);
export const ChallengeAppealStatusSchema = z.enum(["Pending", "Upheld", "Overturned"]);
export const JurorTargetTypeSchema = z.enum(["QuestionChallenge", "ResultChallenge", "ChallengeAppeal"]);
export const JurorConflictStatusSchema = z.enum(["PendingDisclosure", "Clear", "ConflictDeclared"]);
export const JurorAssignmentStatusSchema = z.enum(["Selected", "Withdrawn"]);

export const ChallengeAppealSchema = z
  .object({
    id: z.string(),
    questionId: z.string(),
    targetType: ChallengeAppealTargetTypeSchema,
    challengeId: z.string().nullable(),
    resultChallengeId: z.string().nullable(),
    appellantId: z.string(),
    appealBondId: z.string(),
    appealedRuling: ChallengeRulingSchema,
    appealHash: z.string(),
    appeal: z.string().optional(),
    status: ChallengeAppealStatusSchema,
    resolutionHash: z.string().nullable(),
    resolution: z.string().nullable().optional(),
    resolvedBy: z.string().nullable(),
    createdAt: z.union([z.string().datetime(), z.date()]).optional(),
    resolvedAt: z.union([z.string().datetime(), z.date()]).nullable().optional()
  })
  .passthrough();

export const JurorAssignmentSchema = z
  .object({
    id: z.string(),
    questionId: z.string(),
    targetType: JurorTargetTypeSchema,
    challengeId: z.string().nullable(),
    resultChallengeId: z.string().nullable(),
    challengeAppealId: z.string().nullable(),
    jurorId: z.string(),
    selectedBy: z.string(),
    selectionHash: z.string(),
    selectionReason: z.string().optional(),
    conflictDisclosureHash: z.string().nullable(),
    conflictDisclosure: z.string().nullable().optional(),
    conflictStatus: JurorConflictStatusSchema,
    status: JurorAssignmentStatusSchema,
    createdAt: z.union([z.string().datetime(), z.date()]).optional(),
    updatedAt: z.union([z.string().datetime(), z.date()]).optional()
  })
  .passthrough();

export const ResultChallengeReasonSchema = z.enum([
  "OmittedBallotCommitment",
  "InvalidBallotIncluded",
  "PrivacyThresholdViolation",
  "TallyProofFailure",
  "MethodologyMismatch",
  "ArchiveMismatch"
]);

export const EncryptedBallotSchema = z.object({
  pollId: z.string(),
  questionId: z.string(),
  ballotCommitment: z.string(),
  encryptedPayloadHash: z.string(),
  tallyPublicKeyId: z.string(),
  nullifier: z.string(),
  proofHash: z.string(),
  proofSystem: z.string().default("DemoCredentialProof"),
  eligibilityGroupId: z.string().nullable().optional(),
  eligibilityGroupRoot: z.string().nullable().optional(),
  representedCommunityId: z.string().nullable().optional(),
  representedCommunityPath: z.string().nullable().optional(),
  submittedAt: z.number().int()
});

export const NullifierRecordSchema = z.object({
  pollId: z.string(),
  credentialSchemaId: z.string(),
  nullifier: z.string(),
  ballotCommitment: z.string()
});

export const TallyConfigSchema = z.object({
  pollId: z.string(),
  tallyCommitteeId: z.string(),
  threshold: z.number().int().positive(),
  publicKeyId: z.string(),
  tallyCircuitId: z.string(),
  privacyThreshold: z.number().int().nonnegative(),
  resultChallengeWindowEndsAt: z.number().int()
});

export const TallyCommitteeStatusSchema = z.enum(["Proposed", "Active", "Retired", "Failed"]);

export const TallyCommitteeSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  name: z.string(),
  memberIds: z.array(z.string()),
  threshold: z.number().int().positive(),
  status: TallyCommitteeStatusSchema,
  metadataHash: z.string(),
  activationHash: z.string().nullable().optional(),
  failureHash: z.string().nullable().optional(),
  createdBy: z.string(),
  activatedBy: z.string().nullable().optional(),
  failedBy: z.string().nullable().optional(),
  failedAt: z.union([z.number().int(), z.string().datetime(), z.date()]).nullable().optional(),
  replacementForId: z.string().nullable().optional(),
  createdAt: z.union([z.number().int(), z.string().datetime(), z.date()]),
  updatedAt: z.union([z.number().int(), z.string().datetime(), z.date()]).optional()
});

export const TallyKeySetupStatusSchema = z.enum(["Active", "Retired", "Failed"]);

export const TallyKeySetupSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  committeeId: z.string(),
  publicKeyId: z.string(),
  publicKeyPem: z.string(),
  publicKeyHash: z.string(),
  memberIds: z.array(z.string()),
  memberKeyCommitmentHashes: z.array(z.string()),
  threshold: z.number().int().positive(),
  transcriptHash: z.string(),
  setupHash: z.string(),
  status: TallyKeySetupStatusSchema,
  createdBy: z.string(),
  createdAt: z.union([z.number().int(), z.string().datetime(), z.date()]),
  updatedAt: z.union([z.number().int(), z.string().datetime(), z.date()]).optional()
});

export const TallyDecryptionShareStatusSchema = z.enum(["Accepted", "Rejected"]);

export const TallyDecryptionShareSchema = z.object({
  id: z.string(),
  pollId: z.string(),
  questionId: z.string(),
  communityId: z.string(),
  committeeId: z.string(),
  keySetupId: z.string(),
  memberId: z.string(),
  shareHash: z.string(),
  proofHash: z.string(),
  artifactHash: z.string(),
  status: TallyDecryptionShareStatusSchema,
  submittedAt: z.union([z.number().int(), z.string().datetime(), z.date()])
});

export const ResultFinalStatusSchema = z.enum(["Published", "Challenged", "Corrected", "Finalized"]);

export const TallyResultSchema = z.object({
  pollId: z.string(),
  questionVersionHash: z.string(),
  resultArtifactHash: z.string(),
  aggregateCountsHash: z.string(),
  individualResultHash: z.string().nullable().optional(),
  communityBlockResultHash: z.string().nullable().optional(),
  tallyProofHash: z.string(),
  tallyPublicationProofHash: z.string().nullable().optional(),
  turnout: z.number().int().nonnegative(),
  invalidBallots: z.number().int().nonnegative(),
  privacyReportHash: z.string(),
  publishedAt: z.number().int(),
  finalStatus: ResultFinalStatusSchema
});

export const ResultChallengeSchema = z.object({
  challengeId: z.string(),
  pollId: z.string(),
  resultId: z.string(),
  reasonCode: ResultChallengeReasonSchema,
  evidenceHash: z.string(),
  challenger: z.string(),
  challengeBondId: z.string(),
  jurorPoolId: z.string(),
  ruling: z.enum(["Pending", "Sustained", "Rejected", "Remanded"]),
  resolutionHash: z.string().nullable()
});

export const CommunityAdoptionPolicySchema = z.object({
  policyId: z.string(),
  communityId: z.string(),
  authorityLevel: AuthorityLevelSchema,
  eligibleQuestionTypes: z.array(z.string()),
  credentialSchemaIds: z.array(z.string()),
  quorumRuleHash: z.string(),
  approvalRuleHash: z.string(),
  legalHandoffHash: z.string().nullable(),
  forkRuleHash: z.string(),
  proposalHash: z.string().nullable().optional(),
  activationHash: z.string().nullable().optional(),
  suspensionReasonHash: z.string().nullable().optional(),
  proposedBy: z.string().nullable().optional(),
  adoptedBy: z.string().nullable().optional(),
  suspendedBy: z.string().nullable().optional(),
  effectiveAt: z.number().int(),
  status: z.enum(["Proposed", "Active", "Suspended", "Retired"]),
  createdAt: z.number().int().optional(),
  updatedAt: z.number().int().optional()
});

export const RegistryEventSchema = z.object({
  eventId: z.string(),
  eventType: z.string(),
  subjectId: z.string(),
  actor: z.string(),
  previousHash: z.string().nullable(),
  newHash: z.string(),
  emittedAt: z.number().int()
});

export const ReputationEventSchema = z.object({
  eventId: z.string(),
  account: z.string(),
  reason: z.enum([
    "AcceptedAmendment",
    "SuccessfulChallenge",
    "JurorService",
    "TallyService",
    "ModeratorService",
    "GovernanceService"
  ]),
  weight: z.number(),
  sourceId: z.string(),
  emittedAt: z.number().int()
});

export const UserAccountSchema = z.object({
  id: z.string(),
  username: z.string(),
  profileId: z.string().nullable().optional(),
  profileHash: z.string().nullable().optional(),
  profileCommunityId: z.string().nullable().optional(),
  smartAccountAddress: z.string().nullable().optional(),
  smartAccountKind: z.string().optional(),
  displayName: z.string(),
  bio: z.string().nullable(),
  reputation: z.number().int(),
  createdAt: z.number().int()
});

export const CommunitySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  kind: CommunityKindSchema.default("Group"),
  parentId: z.string().nullable().optional(),
  path: z.string().optional(),
  depth: z.number().int().nonnegative().optional(),
  registryStatus: CommunityRegistryStatusSchema.default("Active").optional(),
  profileUserId: z.string().nullable().optional(),
  visibility: CommunityVisibilitySchema,
  credentialSchemaId: z.string(),
  defaultAuthorityLevel: AuthorityLevelSchema,
  createdBy: z.string(),
  createdAt: z.number().int()
});

export const CommunityMemberSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  userId: z.string(),
  role: z.enum(["Owner", "Moderator", "Member"]),
  status: z.enum(["Active", "Pending", "Removed"]),
  createdAt: z.number().int()
});

export const CommunityMembershipSourceSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  userId: z.string(),
  sourceType: MembershipSourceTypeSchema.or(z.string()),
  sourceKey: z.string(),
  sourceCommunityId: z.string().nullable().optional(),
  status: MembershipSourceStatusSchema.or(z.string()),
  createdAt: z.union([z.number().int(), z.string().datetime(), z.date()]),
  updatedAt: z.union([z.number().int(), z.string().datetime(), z.date()]).optional()
});

export const CommunityRegistryPolicySchema = z.object({
  id: z.string(),
  communityId: z.string(),
  approvalThresholdPercent: z.number().int().min(1).max(100),
  quorumPercent: z.number().int().min(0).max(100),
  reviewWindowHours: z.number().int().positive(),
  status: z.string(),
  createdBy: z.string(),
  createdAt: z.union([z.number().int(), z.string().datetime(), z.date()]),
  updatedAt: z.union([z.number().int(), z.string().datetime(), z.date()]).optional()
});

export const CommunityChildProposalRecordSchema = z.object({
  id: z.string(),
  parentId: z.string(),
  proposedCommunityId: z.string(),
  proposerId: z.string(),
  title: z.string(),
  description: z.string(),
  status: CommunityChildProposalStatusSchema.or(z.string()),
  proposalHash: z.string(),
  thresholdPercent: z.number().int().min(1).max(100),
  quorumPercent: z.number().int().min(0).max(100),
  approvedBy: z.string().nullable().optional(),
  rejectedBy: z.string().nullable().optional(),
  resolutionHash: z.string().nullable().optional(),
  createdAt: z.union([z.number().int(), z.string().datetime(), z.date()]),
  resolvedAt: z.union([z.number().int(), z.string().datetime(), z.date()]).nullable().optional(),
  updatedAt: z.union([z.number().int(), z.string().datetime(), z.date()]).optional()
});

export const CommunityChildProposalVoteRecordSchema = z.object({
  id: z.string(),
  proposalId: z.string(),
  voterId: z.string(),
  vote: CommunityChildProposalVoteSchema.or(z.string()),
  voteHash: z.string(),
  createdAt: z.union([z.number().int(), z.string().datetime(), z.date()])
});

export const CommunityFollowSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  userId: z.string(),
  followHash: z.string(),
  createdAt: z.union([z.number().int(), z.string().datetime(), z.date()])
});

export const TopicFollowSchema = z.object({
  id: z.string(),
  topicId: z.string(),
  userId: z.string(),
  followHash: z.string(),
  createdAt: z.union([z.number().int(), z.string().datetime(), z.date()])
});

export const CommunityForkSchema = z.object({
  id: z.string(),
  sourceCommunityId: z.string(),
  forkName: z.string(),
  forkSlug: z.string(),
  reasonHash: z.string(),
  metadataHash: z.string(),
  sourceExportHash: z.string(),
  sourceManifestHash: z.string(),
  createdBy: z.string(),
  createdAt: z.union([z.number().int(), z.string().datetime(), z.date()])
});

export const CommunityFrontendViewSchema = z.enum(["Overview", "Questions", "Archives", "Results", "Discussion", "Adoption", "Forks"]);

export const CommunityFrontendConfigSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  configHash: z.string(),
  createdBy: z.string(),
  createdAt: z.union([z.number().int(), z.string().datetime(), z.date()]),
  updatedAt: z.union([z.number().int(), z.string().datetime(), z.date()])
});

export const StewardPowerRoleSchema = z.enum(["Owner", "Moderator"]);
export const StewardPowerActionSchema = z.enum([
  "AdoptionPolicy",
  "GovernanceParameters",
  "FrontendConfig",
  "ForkExport",
  "JurorSelection",
  "EmergencySuspension",
  "TechnicalUpgrade"
]);

export const StewardPowerSchema = z.object({
  role: StewardPowerRoleSchema,
  actions: z.array(StewardPowerActionSchema),
  limits: z.array(z.string())
});

export const CommunityEmergencySuspensionStatusSchema = z.enum(["Active", "Resolved"]);
export const CommunityEmergencySuspensionScopeSchema = z.enum(["ProtocolActions"]);

export const CommunityEmergencySuspensionSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  scope: CommunityEmergencySuspensionScopeSchema,
  reasonHash: z.string(),
  resolutionHash: z.string().nullable().optional(),
  suspendedBy: z.string(),
  resolvedBy: z.string().nullable().optional(),
  status: CommunityEmergencySuspensionStatusSchema,
  createdAt: z.union([z.number().int(), z.string().datetime(), z.date()]),
  resolvedAt: z.union([z.number().int(), z.string().datetime(), z.date()]).nullable().optional(),
  updatedAt: z.union([z.number().int(), z.string().datetime(), z.date()])
});

export const GovernanceParameterStatusSchema = z.enum(["Proposed", "Active", "Retired"]);

export const GovernanceParameterSetSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  proposalBondPc: z.number().int().nonnegative(),
  challengeBondPc: z.number().int().nonnegative(),
  appealBondPc: z.number().int().nonnegative(),
  protocolFeePc: z.number().int().nonnegative(),
  successfulChallengeRewardPc: z.number().int().nonnegative(),
  failedChallengeProposerRewardPc: z.number().int().nonnegative(),
  jurorRewardWeight: z.number().int(),
  successfulChallengeReputation: z.number().int(),
  acceptedAmendmentReputation: z.number().int(),
  privacyThreshold: z.number().int().nonnegative(),
  challengeWindowHours: z.number().int().positive(),
  resultChallengeWindowHours: z.number().int().positive(),
  pollDurationHours: z.number().int().positive(),
  reputationDecayRule: z.string().min(1),
  proposalHash: z.string(),
  activationHash: z.string().nullable().optional(),
  proposedBy: z.string(),
  activatedBy: z.string().nullable().optional(),
  status: GovernanceParameterStatusSchema,
  effectiveAt: z.union([z.number().int(), z.string().datetime(), z.date()]),
  createdAt: z.union([z.number().int(), z.string().datetime(), z.date()]),
  updatedAt: z.union([z.number().int(), z.string().datetime(), z.date()])
});

export const DataUnionPolicyStatusSchema = z.enum(["Proposed", "Active", "Suspended"]);
export const DataUnionConsentStatusSchema = z.enum(["Active", "Revoked"]);
export const DataUnionProductStatusSchema = z.enum(["Published", "Retired"]);
export const DataUnionAccessGrantStatusSchema = z.enum(["Active", "Revoked"]);
export const DataUnionProductTypeSchema = z.enum(["AggregateResultDataset", "MethodologyExport"]);
export const DataUnionConsentScopeSchema = z.enum(["AggregateAnalytics", "SponsoredResearch", "PublicInterestResearch"]);
export const DataUnionBuyerTypeSchema = z.enum(["ApprovedCustomer", "ResearchPartner", "PublicInterest", "CommunityPartner"]);

export const DataUnionRevenueSplitSchema = z
  .object({
    communityTreasuryPercent: z.number().int().min(0).max(100).default(70),
    participantPoolPercent: z.number().int().min(0).max(100).default(20),
    operatorPoolPercent: z.number().int().min(0).max(100).default(10)
  })
  .refine(
    (value) => value.communityTreasuryPercent + value.participantPoolPercent + value.operatorPoolPercent === 100,
    "Data-union revenue split must total 100 percent"
  );

export const DataUnionPolicySchema = z.object({
  id: z.string(),
  communityId: z.string(),
  title: z.string(),
  purposeHash: z.string(),
  allowedProductTypes: z.array(DataUnionProductTypeSchema),
  minimumCohortSize: z.number().int().positive(),
  consentRevocationRuleHash: z.string(),
  dataRetentionDays: z.number().int().positive(),
  revenueSplit: DataUnionRevenueSplitSchema,
  status: DataUnionPolicyStatusSchema,
  policyHash: z.string(),
  activationHash: z.string().nullable().optional(),
  proposedBy: z.string(),
  activatedBy: z.string().nullable().optional(),
  effectiveAt: z.union([z.number().int(), z.string().datetime(), z.date()]).nullable().optional(),
  createdAt: z.union([z.number().int(), z.string().datetime(), z.date()]),
  updatedAt: z.union([z.number().int(), z.string().datetime(), z.date()])
});

export const DataUnionConsentSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  policyId: z.string(),
  userId: z.string(),
  scope: DataUnionConsentScopeSchema,
  status: DataUnionConsentStatusSchema,
  consentHash: z.string(),
  revokedHash: z.string().nullable().optional(),
  createdAt: z.union([z.number().int(), z.string().datetime(), z.date()]),
  revokedAt: z.union([z.number().int(), z.string().datetime(), z.date()]).nullable().optional(),
  updatedAt: z.union([z.number().int(), z.string().datetime(), z.date()])
});

export const DataUnionProductSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  policyId: z.string(),
  resultId: z.string(),
  productType: DataUnionProductTypeSchema,
  title: z.string(),
  descriptionHash: z.string(),
  dataProductHash: z.string(),
  privacyReportHash: z.string(),
  methodologyHash: z.string(),
  minimumCohortSize: z.number().int().positive(),
  cohortSize: z.number().int().nonnegative(),
  pricePc: z.number().int().nonnegative(),
  status: DataUnionProductStatusSchema,
  createdBy: z.string(),
  createdAt: z.union([z.number().int(), z.string().datetime(), z.date()]),
  updatedAt: z.union([z.number().int(), z.string().datetime(), z.date()])
});

export const DataUnionAccessGrantSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  productId: z.string(),
  buyerId: z.string(),
  buyerType: DataUnionBuyerTypeSchema,
  purposeHash: z.string(),
  licenseHash: z.string(),
  paymentPc: z.number().int().nonnegative(),
  treasuryPc: z.number().int().nonnegative(),
  participantPoolPc: z.number().int().nonnegative(),
  operatorPoolPc: z.number().int().nonnegative(),
  accessHash: z.string(),
  status: DataUnionAccessGrantStatusSchema,
  grantedBy: z.string(),
  createdAt: z.union([z.number().int(), z.string().datetime(), z.date()]),
  revokedAt: z.union([z.number().int(), z.string().datetime(), z.date()]).nullable().optional()
});

export const DiscussionPostKindSchema = z.enum(["Comment", "Source", "ProArgument", "ConArgument", "ClarifyingQuestion", "ModeratorNote"]);
export const DiscussionViewKeySchema = z.enum(["comments", "sources", "proArguments", "conArguments", "clarifyingQuestions", "moderatorNotes"]);
export const DiscussionViewDefinitions = [
  { key: "comments", kind: "Comment", label: "Comments" },
  { key: "sources", kind: "Source", label: "Sources" },
  { key: "proArguments", kind: "ProArgument", label: "Pro" },
  { key: "conArguments", kind: "ConArgument", label: "Con" },
  { key: "clarifyingQuestions", kind: "ClarifyingQuestion", label: "Clarifying" },
  { key: "moderatorNotes", kind: "ModeratorNote", label: "Moderator" }
] as const;

export const DiscussionPostSchema = z.object({
  id: z.string(),
  questionId: z.string(),
  authorId: z.string(),
  kind: DiscussionPostKindSchema,
  bodyHash: z.string(),
  body: z.string().optional(),
  parentId: z.string().nullable(),
  status: z.enum(["Published", "Hidden"]),
  createdAt: z.number().int()
});

export const DiscussionModerationActionSchema = z.enum(["HidePost", "RestorePost"]);
export const DiscussionModerationReasonCodeSchema = z.enum([
  "Threats",
  "Doxxing",
  "TargetedHarassment",
  "Spam",
  "Impersonation",
  "IllegalContent",
  "CoordinatedManipulation",
  "GraphicOrExploitativeMaterial",
  "BadFaithDisruption",
  "Other"
]);
export const DiscussionModerationAppealStatusSchema = z.enum(["Pending", "Upheld", "Overturned"]);

export const DiscussionModerationRecordSchema = z.object({
  id: z.string(),
  questionId: z.string(),
  postId: z.string(),
  postBodyHash: z.string(),
  moderatorId: z.string(),
  action: DiscussionModerationActionSchema,
  reasonCode: DiscussionModerationReasonCodeSchema,
  reasonHash: z.string(),
  reason: z.string().optional(),
  previousStatus: z.enum(["Published", "Hidden"]),
  newStatus: z.enum(["Published", "Hidden"]),
  createdAt: z.union([z.number().int(), z.string().datetime(), z.date()])
});

export const DiscussionModerationAppealSchema = z.object({
  id: z.string(),
  moderationRecordId: z.string(),
  appellantId: z.string(),
  appealHash: z.string(),
  appeal: z.string().optional(),
  status: DiscussionModerationAppealStatusSchema,
  resolutionHash: z.string().nullable(),
  resolution: z.string().nullable().optional(),
  resolvedBy: z.string().nullable(),
  createdAt: z.union([z.number().int(), z.string().datetime(), z.date()]),
  resolvedAt: z.union([z.number().int(), z.string().datetime(), z.date()]).nullable()
});

export const ArchiveRecordSchema = z.object({
  id: z.string(),
  questionId: z.string(),
  archiveHash: z.string(),
  archivedBy: z.string(),
  createdAt: z.number().int()
});

export const ProtocolCommitmentKindSchema = z.enum([
  "question-version",
  "bond",
  "challenge",
  "ruling",
  "result-hash",
  "adoption-policy",
  "archive",
  "data-union"
]);

export const ProtocolCommitmentSchema = z.object({
  kind: ProtocolCommitmentKindSchema,
  subject: z.string(),
  description: z.string(),
  eventTypes: z.array(z.string()).min(1),
  requiredHashes: z.array(z.string()),
  requiredArtifacts: z.array(z.string()),
  replayChecks: z.array(z.string()),
  contractModule: z.string()
});

export type ProtocolCommitment = z.infer<typeof ProtocolCommitmentSchema>;
export type CanonicalProtocolModule = z.infer<typeof CanonicalProtocolModuleSchema>;
export type CanonicalStateMachine = z.infer<typeof CanonicalStateMachineSchema>;

export const ProtocolCommitmentRecordStatusSchema = z.enum(["Committed", "Replayed", "Mismatch"]);

export const ProtocolCommitmentRecordSchema = z
  .object({
    id: z.string(),
    kind: ProtocolCommitmentKindSchema,
    contractModule: z.string(),
    subjectId: z.string(),
    eventType: z.string(),
    sourceEventId: z.string(),
    commitmentHash: z.string(),
    payloadHash: z.string(),
    status: ProtocolCommitmentRecordStatusSchema,
    createdAt: z.union([z.string().datetime(), z.date()]).optional(),
    payload: z.unknown().optional()
  })
  .passthrough();

export const ProtocolTransactionResultStatusSchema = z.enum(["Applied", "Rejected", "Indexed"]);

export const ProtocolTransactionResultSchema = z
  .object({
    id: z.string(),
    sourceType: z.string(),
    sourceModule: z.string(),
    transactionType: z.string(),
    subjectId: z.string(),
    actor: z.string(),
    eventType: z.string(),
    eventHash: z.string(),
    resultHash: z.string(),
    payloadHash: z.string(),
    status: ProtocolTransactionResultStatusSchema,
    createdAt: z.union([z.string().datetime(), z.date()]).optional(),
    payload: z.unknown().optional()
  })
  .passthrough();

export const MinimumProtocolCommitments = [
  {
    kind: "question-version",
    subject: "Question body, answer schema, credential schema, authority metadata, and amendment history.",
    description: "Every public question version must anchor the content hash and metadata needed to rebuild the civic record.",
    eventTypes: ["QuestionSubmitted", "QuestionAmended"],
    requiredHashes: ["bodyHash", "sponsorDisclosureHash", "answerSchemaId", "credentialSchemaId", "adoptionPolicyId"],
    requiredArtifacts: ["question-body", "sponsor-disclosure"],
    replayChecks: ["question-body-hash-from-events", "archive-question-body-hash", "archive-body-artifact-hash"],
    contractModule: "QuestionRegistry"
  },
  {
    kind: "bond",
    subject: "Proposal, challenge, result-challenge, reward, refund, slash, and treasury accounting.",
    description: "Economic curation commitments must be visible independently of application balances.",
    eventTypes: ["BondEscrowed", "BondSettled"],
    requiredHashes: ["proposalBondId", "challengeBondId", "amountPc", "status", "slashedPc", "refundedPc", "rewardPc", "treasuryPc"],
    requiredArtifacts: [],
    replayChecks: ["event-previous-hash-continuity"],
    contractModule: "StakeManager"
  },
  {
    kind: "challenge",
    subject: "Question and result challenge openings, evidence hashes, challengers, and escrow bonds.",
    description: "Challenge openings must anchor why a civic object was disputed and where public evidence lives.",
    eventTypes: ["ChallengeOpened", "ResultChallenged", "ChallengeAppealed", "ResultChallengeAppealed"],
    requiredHashes: ["evidenceHash", "challengeBondId", "reasonCode", "targetId"],
    requiredArtifacts: ["question-challenge-evidence", "result-challenge-evidence", "challenge-appeal"],
    replayChecks: ["archive-manifest-references", "event-previous-hash-continuity"],
    contractModule: "ChallengeCourt"
  },
  {
    kind: "ruling",
    subject: "Juror selection, conflict disclosures, question rulings, result rulings, resolution hashes, corrected result artifacts, and settlement effects.",
    description: "Rulings must anchor the selected juror, conflict disclosure, decision, public rationale artifact, and any corrected result commitment.",
    eventTypes: ["JurorSelected", "JurorConflictDisclosed", "ChallengeRuled", "ResultChallengeRuled", "ResultCorrected", "ChallengeAppealRuled"],
    requiredHashes: ["selectionHash", "conflictDisclosureHash", "resolutionHash", "ruling", "correctedArtifactHash", "challengeBondId"],
    requiredArtifacts: ["juror-selection", "juror-conflict-disclosure", "question-challenge-resolution", "result-challenge-resolution", "challenge-appeal-resolution", "result-artifact-correction"],
    replayChecks: ["result-artifact-hash-from-events", "archive-result-artifact-hash", "event-previous-hash-continuity"],
    contractModule: "ChallengeCourt"
  },
  {
    kind: "result-hash",
    subject: "Aggregate counts, tally proof reference, privacy report, turnout, invalid ballot count, and final status.",
    description: "Published and corrected results must be independently verifiable from public result artifacts and lifecycle events.",
    eventTypes: ["ResultPublished", "ResultCorrected", "ResultFinalized"],
    requiredHashes: ["resultArtifactHash", "aggregateCountsHash", "tallyProofHash", "privacyReportHash", "turnout", "invalidBallots", "finalStatus"],
    requiredArtifacts: ["result-artifact", "result-artifact-correction"],
    replayChecks: ["result-artifact-hash-from-events", "result-final-status-from-events", "archive-result-record-hash", "archive-result-artifact-hash"],
    contractModule: "ResultArchive"
  },
  {
    kind: "adoption-policy",
    subject: "Community authority levels, quorum and approval rules, governance parameters, steward powers, legal handoff, fork rule, activation, and suspension.",
    description: "Authority and process-rule changes must be inspectable so clients can distinguish advisory, recognized, and binding civic records.",
    eventTypes: [
      "AdoptionPolicyProposed",
      "AdoptionPolicyActivated",
      "AdoptionPolicySuspended",
      "GovernanceParametersProposed",
      "GovernanceParametersActivated",
      "CommunityEmergencySuspended",
      "CommunityEmergencyResolved"
    ],
    requiredHashes: [
      "proposalHash",
      "activationHash",
      "suspensionReasonHash",
      "quorumRuleHash",
      "approvalRuleHash",
      "legalHandoffHash",
      "forkRuleHash",
      "parameterSetHash",
      "emergencyReasonHash",
      "emergencyResolutionHash"
    ],
    requiredArtifacts: [
      "adoption-policy-proposal",
      "adoption-policy-activation",
      "adoption-policy-suspension",
      "governance-parameter-proposal",
      "governance-parameter-activation",
      "community-emergency-suspension",
      "community-emergency-resolution"
    ],
    replayChecks: ["event-previous-hash-continuity"],
    contractModule: "AdoptionRegistry"
  },
  {
    kind: "archive",
    subject: "Final question archive hash, artifact manifest, referenced artifacts, event snapshot, and archived-by authority.",
    description: "Archived records must be reproducible from content-addressed exports without trusting the live database.",
    eventTypes: ["QuestionArchived"],
    requiredHashes: ["archiveHash", "artifactManifestHash", "resultArtifactHash", "archivedBy"],
    requiredArtifacts: ["question-archive", "artifact-manifest", "artifact-export-bundle"],
    replayChecks: ["archive-hash-from-events", "archive-artifact-hash", "archive-manifest-hash", "archive-manifest-references", "archive-event-snapshot"],
    contractModule: "QuestionRegistry"
  },
  {
    kind: "data-union",
    subject: "Community data-union policy, consent, aggregate data product, buyer access, and revenue routing records.",
    description:
      "Commercial aggregate-data access must be opt-in, revocable for future use, privacy-thresholded, and auditable without exposing raw ballots or identifiable responses.",
    eventTypes: [
      "DataUnionPolicyProposed",
      "DataUnionPolicyActivated",
      "DataUnionConsentRecorded",
      "DataUnionConsentRevoked",
      "DataUnionProductPublished",
      "DataUnionAccessGranted"
    ],
    requiredHashes: [
      "policyHash",
      "activationHash",
      "consentHash",
      "revokedHash",
      "dataProductHash",
      "privacyReportHash",
      "accessHash",
      "revenueSplitHash"
    ],
    requiredArtifacts: [
      "data-union-policy",
      "data-union-policy-activation",
      "data-union-consent",
      "data-union-consent-revocation",
      "data-union-product",
      "data-union-access-grant"
    ],
    replayChecks: ["data-union-policy-active-before-product", "data-union-cohort-threshold", "data-union-revenue-split"],
    contractModule: "DataUnionRegistry"
  }
] satisfies ProtocolCommitment[];

export const CanonicalProtocolModuleIdSchema = z.enum([
  "QuestionRegistry",
  "StakeManager",
  "ChallengeCourt",
  "PollManager",
  "TallyManager",
  "AdoptionRegistry",
  "ResultArchive",
  "CredentialRegistry",
  "DataUnionRegistry",
  "SocialGraph"
]);

export const CanonicalProtocolModuleSchema = z.object({
  id: CanonicalProtocolModuleIdSchema,
  label: z.string(),
  owns: z.array(z.string()),
  transactionTypes: z.array(z.string()),
  eventTypes: z.array(z.string()),
  indexesTo: z.array(z.string())
});

export const CanonicalStateTransitionSchema = z.object({
  from: z.string(),
  to: z.string(),
  eventType: z.string(),
  module: CanonicalProtocolModuleIdSchema,
  guard: z.string(),
  writes: z.array(z.string())
});

export const CanonicalStateMachineSchema = z.object({
  id: z.string(),
  entity: z.string(),
  module: CanonicalProtocolModuleIdSchema,
  states: z.array(z.string()).min(1),
  initialState: z.string(),
  terminalStates: z.array(z.string()),
  transitions: z.array(CanonicalStateTransitionSchema)
});

export const CanonicalProtocolBoundarySchema = z.object({
  protocol: z.literal("popular-consensus"),
  schemaVersion: z.literal("canonical-appchain-boundary-v0"),
  modules: z.array(CanonicalProtocolModuleSchema),
  stateMachines: z.array(CanonicalStateMachineSchema)
});

export const CanonicalProtocolModules = [
  {
    id: "QuestionRegistry",
    label: "Question registry",
    owns: ["question versions", "question lifecycle state", "question archive eligibility", "community fork references"],
    transactionTypes: ["submitQuestion", "amendQuestion", "acceptQuestion", "rejectQuestion", "recordFork"],
    eventTypes: ["QuestionSubmitted", "QuestionAmended", "QuestionAccepted", "QuestionRejected", "CommunityForked"],
    indexesTo: ["questions", "civicRecord", "archives", "communityExport"]
  },
  {
    id: "StakeManager",
    label: "Stake and treasury manager",
    owns: ["proposal bonds", "challenge bonds", "appeal bonds", "bond settlement", "treasury/reward ledger entries"],
    transactionTypes: ["escrowBond", "settleBond", "slashBond", "refundBond", "creditReward"],
    eventTypes: ["BondEscrowed", "BondSettled"],
    indexesTo: ["treasuryLedger", "civicRecord", "communityExport"]
  },
  {
    id: "ChallengeCourt",
    label: "Challenge and juror court",
    owns: ["challenge openings", "juror assignment", "conflict disclosure", "rulings", "appeals"],
    transactionTypes: ["openChallenge", "selectJuror", "discloseConflict", "ruleChallenge", "appealRuling", "ruleAppeal"],
    eventTypes: ["ChallengeOpened", "ResultChallenged", "JurorSelected", "JurorConflictDisclosed", "ChallengeRuled", "ResultChallengeRuled", "ChallengeAppealed", "ResultChallengeAppealed", "ChallengeAppealRuled"],
    indexesTo: ["civicRecord", "challengeAppeals", "jurorAssignments", "communityExport"]
  },
  {
    id: "PollManager",
    label: "Poll manager",
    owns: ["poll configuration", "poll open/close state", "ballot commitments", "nullifiers", "encrypted payload hashes"],
    transactionTypes: ["configurePoll", "openPoll", "submitBallot", "closePoll"],
    eventTypes: ["PollOpened", "BallotAccepted", "PollClosed"],
    indexesTo: ["civicRecord", "communityExport"]
  },
  {
    id: "TallyManager",
    label: "Threshold tally manager",
    owns: ["tally committee lifecycle", "threshold public keys", "decryption shares", "publication proof references"],
    transactionTypes: ["proposeCommittee", "activateCommittee", "failCommittee", "publishTallyKey", "submitDecryptionShare", "publishTallyProof"],
    eventTypes: ["TallyCommitteeProposed", "TallyCommitteeActivated", "TallyCommitteeFailed", "TallyKeySetupPublished", "TallyDecryptionShareSubmitted", "ResultPublished"],
    indexesTo: ["tallyCommittees", "tallyKeySetups", "tallyDecryptionShares", "resultArtifacts", "communityExport"]
  },
  {
    id: "AdoptionRegistry",
    label: "Community adoption and parameter registry",
    owns: ["adoption policies", "governance parameters", "steward powers", "emergency suspensions"],
    transactionTypes: ["proposeAdoptionPolicy", "activateAdoptionPolicy", "suspendAdoptionPolicy", "proposeParameters", "activateParameters", "suspendCommunity", "resolveSuspension"],
    eventTypes: ["AdoptionPolicyProposed", "AdoptionPolicyActivated", "AdoptionPolicySuspended", "GovernanceParametersProposed", "GovernanceParametersActivated", "CommunityEmergencySuspended", "CommunityEmergencyResolved"],
    indexesTo: ["governanceParameters", "stewardPowers", "communityExport"]
  },
  {
    id: "ResultArchive",
    label: "Result and archive registry",
    owns: ["result artifact commitments", "result finalization", "archive manifests", "export roots"],
    transactionTypes: ["publishResult", "correctResult", "finalizeResult", "archiveQuestion"],
    eventTypes: ["ResultPublished", "ResultCorrected", "ResultFinalized", "QuestionArchived"],
    indexesTo: ["resultArtifacts", "archives", "archiveExport", "communityExport"]
  },
  {
    id: "CredentialRegistry",
    label: "Credential registry",
    owns: ["credential schemas", "issuer registry", "credential issuance", "credential revocations", "issuer suspension", "revocation roots", "community trust policies"],
    transactionTypes: ["registerCredentialSchema", "registerIssuer", "issueCredential", "revokeCredential", "suspendIssuer", "publishRevocationRoot", "setTrustPolicy"],
    eventTypes: [
      "CredentialSchemaRegistered",
      "CredentialIssuerRegistered",
      "CredentialIssued",
      "CredentialRevoked",
      "CredentialIssuerSuspended",
      "CredentialRevocationRootUpdated",
      "CommunityCredentialTrustPolicySet"
    ],
    indexesTo: ["credentialTrustPolicies", "civicRecord", "communityExport"]
  },
  {
    id: "DataUnionRegistry",
    label: "Community data-union registry",
    owns: ["data-union policies", "member consent records", "aggregate data products", "access grants", "commercial aggregate revenue splits"],
    transactionTypes: ["proposeDataUnionPolicy", "activateDataUnionPolicy", "recordDataUnionConsent", "revokeDataUnionConsent", "publishDataUnionProduct", "grantDataUnionAccess"],
    eventTypes: [
      "DataUnionPolicyProposed",
      "DataUnionPolicyActivated",
      "DataUnionConsentRecorded",
      "DataUnionConsentRevoked",
      "DataUnionProductPublished",
      "DataUnionAccessGranted"
    ],
    indexesTo: ["dataUnion", "treasuryLedger", "resultArtifacts", "communityExport"]
  },
  {
    id: "SocialGraph",
    label: "Portable social graph",
    owns: ["user accounts", "community membership", "profile identifiers", "discussion records", "moderation records", "follow records", "reputation events"],
    transactionTypes: [
      "createUser",
      "createCommunity",
      "joinCommunity",
      "publishProfile",
      "updateCommunityFrontendConfig",
      "publishDiscussion",
      "moderateDiscussion",
      "appealModeration",
      "resolveModerationAppeal",
      "followCommunity",
      "followProfile",
      "followTopic",
      "recordReputation"
    ],
    eventTypes: [
      "UserCreated",
      "CommunityCreated",
      "CommunityJoined",
      "ProfilePublished",
      "CommunityFrontendConfigUpdated",
      "DiscussionPosted",
      "DiscussionModerated",
      "DiscussionModerationAppealed",
      "DiscussionModerationAppealResolved",
      "CommunityFollowed",
      "ProfileFollowed",
      "TopicFollowed",
      "ReputationEventRecorded"
    ],
    indexesTo: ["profileRecord", "questionDiscussion", "questionModeration", "discovery", "reputationEvents", "communityExport"]
  }
];

export const CanonicalStateMachines = [
  {
    id: "question-lifecycle-v0",
    entity: "Question",
    module: "QuestionRegistry",
    states: ["Submitted", "Challenged", "Amendment", "Rejected", "Accepted", "Open", "Closed", "ResultPublished", "ResultChallenged", "Corrected", "Finalized", "Archived"],
    initialState: "Submitted",
    terminalStates: ["Rejected", "Archived"],
    transitions: [
      { from: "Submitted", to: "Challenged", eventType: "ChallengeOpened", module: "ChallengeCourt", guard: "challenge bond escrowed", writes: ["challengeId", "challengeBondId"] },
      { from: "Submitted", to: "Accepted", eventType: "QuestionAccepted", module: "QuestionRegistry", guard: "curator or recognized policy accepts", writes: ["status"] },
      { from: "Submitted", to: "Rejected", eventType: "QuestionRejected", module: "QuestionRegistry", guard: "challenge sustained or curator rejects", writes: ["status"] },
      { from: "Accepted", to: "Open", eventType: "PollOpened", module: "PollManager", guard: "poll configured and open window reached", writes: ["pollStatus"] },
      { from: "Open", to: "Closed", eventType: "PollClosed", module: "PollManager", guard: "close window reached or steward closes", writes: ["pollStatus"] },
      { from: "Closed", to: "ResultPublished", eventType: "ResultPublished", module: "TallyManager", guard: "tally publication proof verified", writes: ["resultArtifactHash", "tallyProofHash"] },
      { from: "ResultPublished", to: "ResultChallenged", eventType: "ResultChallenged", module: "ChallengeCourt", guard: "result challenge bond escrowed", writes: ["resultChallengeId"] },
      { from: "ResultChallenged", to: "Corrected", eventType: "ResultCorrected", module: "ResultArchive", guard: "challenge or appeal requires correction", writes: ["resultArtifactHash"] },
      { from: "ResultPublished", to: "Finalized", eventType: "ResultFinalized", module: "ResultArchive", guard: "challenge window closed or challenges resolved", writes: ["finalStatus"] },
      { from: "Finalized", to: "Archived", eventType: "QuestionArchived", module: "ResultArchive", guard: "archive manifest verifies", writes: ["archiveHash"] }
    ]
  },
  {
    id: "poll-lifecycle-v0",
    entity: "Poll",
    module: "PollManager",
    states: ["Configured", "Open", "Closed", "ResultPublished"],
    initialState: "Configured",
    terminalStates: ["ResultPublished"],
    transitions: [
      { from: "Configured", to: "Open", eventType: "PollOpened", module: "PollManager", guard: "question accepted and tally key configured", writes: ["status"] },
      { from: "Open", to: "Open", eventType: "BallotAccepted", module: "PollManager", guard: "credential proof valid and nullifier unused", writes: ["ballotCommitment", "nullifier"] },
      { from: "Open", to: "Closed", eventType: "PollClosed", module: "PollManager", guard: "poll close rule satisfied", writes: ["status"] },
      { from: "Closed", to: "ResultPublished", eventType: "ResultPublished", module: "TallyManager", guard: "threshold tally publication proof verified", writes: ["resultId"] }
    ]
  },
  {
    id: "tally-lifecycle-v0",
    entity: "Tally",
    module: "TallyManager",
    states: ["CommitteeProposed", "CommitteeActive", "KeyPublished", "SharesOpen", "ThresholdMet", "ProofVerified", "Published", "CommitteeFailed"],
    initialState: "CommitteeProposed",
    terminalStates: ["Published", "CommitteeFailed"],
    transitions: [
      { from: "CommitteeProposed", to: "CommitteeActive", eventType: "TallyCommitteeActivated", module: "TallyManager", guard: "community steward activates committee", writes: ["activationHash"] },
      { from: "CommitteeActive", to: "KeyPublished", eventType: "TallyKeySetupPublished", module: "TallyManager", guard: "threshold public key artifact verifies", writes: ["setupHash", "publicKeyId"] },
      { from: "KeyPublished", to: "SharesOpen", eventType: "PollClosed", module: "PollManager", guard: "poll closes with threshold key setup", writes: ["pollStatus"] },
      { from: "SharesOpen", to: "ThresholdMet", eventType: "TallyDecryptionShareSubmitted", module: "TallyManager", guard: "accepted unique shares meet threshold", writes: ["shareHash", "proofHash"] },
      { from: "ThresholdMet", to: "ProofVerified", eventType: "ResultPublished", module: "TallyManager", guard: "publication proof validates key and share references", writes: ["tallyPublicationProofHash"] },
      { from: "ProofVerified", to: "Published", eventType: "ResultPublished", module: "ResultArchive", guard: "result artifact stores proof reference", writes: ["resultArtifactHash"] },
      { from: "CommitteeActive", to: "CommitteeFailed", eventType: "TallyCommitteeFailed", module: "TallyManager", guard: "failure artifact published", writes: ["failureHash"] }
    ]
  },
  {
    id: "bond-lifecycle-v0",
    entity: "Bond",
    module: "StakeManager",
    states: ["Escrowed", "Settled"],
    initialState: "Escrowed",
    terminalStates: ["Settled"],
    transitions: [
      { from: "Escrowed", to: "Settled", eventType: "BondSettled", module: "StakeManager", guard: "ruling, finalization, or archive settles bond", writes: ["slashedPc", "refundedPc", "rewardPc", "treasuryPc"] }
    ]
  },
  {
    id: "adoption-policy-lifecycle-v0",
    entity: "AdoptionPolicy",
    module: "AdoptionRegistry",
    states: ["Proposed", "Active", "Suspended", "Superseded"],
    initialState: "Proposed",
    terminalStates: ["Suspended", "Superseded"],
    transitions: [
      { from: "Proposed", to: "Active", eventType: "AdoptionPolicyActivated", module: "AdoptionRegistry", guard: "activation artifact and authority metadata verify", writes: ["activationHash", "effectiveAt"] },
      { from: "Active", to: "Suspended", eventType: "AdoptionPolicySuspended", module: "AdoptionRegistry", guard: "suspension artifact published", writes: ["suspensionReasonHash"] },
      { from: "Active", to: "Superseded", eventType: "AdoptionPolicyActivated", module: "AdoptionRegistry", guard: "new policy replaces old active policy", writes: ["status"] }
    ]
  },
  {
    id: "archive-lifecycle-v0",
    entity: "Archive",
    module: "ResultArchive",
    states: ["Pending", "Archived"],
    initialState: "Pending",
    terminalStates: ["Archived"],
    transitions: [
      { from: "Pending", to: "Archived", eventType: "QuestionArchived", module: "ResultArchive", guard: "artifact manifest and export bundle verify", writes: ["archiveHash", "artifactManifestHash"] }
    ]
  }
];

export const CanonicalProtocolBoundary = {
  protocol: "popular-consensus",
  schemaVersion: "canonical-appchain-boundary-v0",
  modules: CanonicalProtocolModules,
  stateMachines: CanonicalStateMachines
};

export const PublicApiV0DateTimeSchema = z.union([z.string().datetime(), z.date()]);

export const PublicApiV0PageSchema = z.object({
  limit: z.number().int().positive().max(100),
  cursor: z.string(),
  nextCursor: z.string().nullable(),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean()
});

export const PublicApiV0ProtocolSchemaVersionSchema = z.enum([
  "canonical-appchain-boundary-v0",
  "public-testnet-readiness-v0",
  "communities-index-v0",
  "public-civic-record-v0",
  "challenge-appeals-v0",
  "juror-assignments-v0",
  "governance-parameters-v0",
  "treasury-ledger-v0",
  "data-union-v0",
  "steward-powers-v0",
  "upgrade-safety-v0",
  "credential-trust-policies-v0",
  "tally-committees-v0",
  "tally-key-setups-v0",
  "tally-decryption-shares-v0",
  "question-discussion-v0",
  "question-moderation-v0",
  "profile-record-v0",
  "discovery-index-v0",
  "reputation-events-v0",
  "reputation-export-v0",
  "reputation-replay-v0",
  "archive-export-v0",
  "community-export-v0",
  "community-import-replay-v0",
  "registry-events-v0",
  "protocol-transactions-v0",
  "protocol-indexer-replay-v0",
  "archives-index-v0",
  "result-artifacts-index-v0",
  "replay-check-v0",
  "minimum-commitments-v0",
  "commitments-index-v0",
  "artifact-read-v0"
]);

const PublicApiV0RecordSchema = z.record(z.string(), z.unknown());

const PublicApiV0ProtocolBaseSchema = z
  .object({
    protocol: z.literal("popular-consensus"),
    schemaVersion: PublicApiV0ProtocolSchemaVersionSchema,
    ids: PublicApiV0RecordSchema,
    hashes: PublicApiV0RecordSchema,
    statuses: PublicApiV0RecordSchema,
    authority: PublicApiV0RecordSchema,
    page: PublicApiV0PageSchema.optional()
  })
  .passthrough();

export const PublicApiV0CommunitiesProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("communities-index-v0"),
  page: PublicApiV0PageSchema
}).passthrough();

export const PublicApiV0PublicTestnetReadinessProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("public-testnet-readiness-v0")
}).passthrough();

export const PublicApiV0CivicRecordProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("public-civic-record-v0")
}).passthrough();

export const PublicApiV0ChallengeAppealsProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("challenge-appeals-v0")
}).passthrough();

export const PublicApiV0JurorAssignmentsProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("juror-assignments-v0")
}).passthrough();

export const PublicApiV0GovernanceParametersProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("governance-parameters-v0")
}).passthrough();

export const PublicApiV0TreasuryLedgerProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("treasury-ledger-v0")
}).passthrough();

export const PublicApiV0DataUnionProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("data-union-v0")
}).passthrough();

export const PublicApiV0StewardPowersProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("steward-powers-v0")
}).passthrough();

export const PublicApiV0UpgradeSafetyProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("upgrade-safety-v0")
}).passthrough();

export const PublicApiV0CredentialTrustPoliciesProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("credential-trust-policies-v0")
}).passthrough();

export const PublicApiV0TallyCommitteesProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("tally-committees-v0")
}).passthrough();

export const PublicApiV0TallyKeySetupsProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("tally-key-setups-v0")
}).passthrough();

export const PublicApiV0TallyDecryptionSharesProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("tally-decryption-shares-v0")
}).passthrough();

export const PublicApiV0QuestionDiscussionProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("question-discussion-v0")
}).passthrough();

export const PublicApiV0QuestionModerationProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("question-moderation-v0")
}).passthrough();

export const PublicApiV0ProfileRecordProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("profile-record-v0")
}).passthrough();

export const PublicApiV0DiscoveryProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("discovery-index-v0")
}).passthrough();

export const PublicApiV0ReputationEventsProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("reputation-events-v0")
}).passthrough();

export const PublicApiV0ReputationExportProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("reputation-export-v0")
}).passthrough();

export const PublicApiV0ReputationReplayProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("reputation-replay-v0")
}).passthrough();

export const PublicApiV0ArchiveExportProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("archive-export-v0")
}).passthrough();

export const PublicApiV0CommunityExportProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("community-export-v0")
}).passthrough();

export const PublicApiV0CommunityImportReplayProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("community-import-replay-v0")
}).passthrough();

export const PublicApiV0RegistryEventsProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("registry-events-v0"),
  page: PublicApiV0PageSchema
}).passthrough();

export const PublicApiV0ProtocolTransactionsProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("protocol-transactions-v0"),
  page: PublicApiV0PageSchema
}).passthrough();

export const PublicApiV0ProtocolIndexerReplayProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("protocol-indexer-replay-v0")
}).passthrough();

export const PublicApiV0ArchivesProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("archives-index-v0"),
  page: PublicApiV0PageSchema
}).passthrough();

export const PublicApiV0ResultArtifactsProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("result-artifacts-index-v0"),
  page: PublicApiV0PageSchema
}).passthrough();

export const PublicApiV0ReplayCheckProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("replay-check-v0")
}).passthrough();

export const PublicApiV0MinimumCommitmentsProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("minimum-commitments-v0")
}).passthrough();

export const PublicApiV0CommitmentsProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("commitments-index-v0"),
  page: PublicApiV0PageSchema
}).passthrough();

export const PublicApiV0ArtifactReadProtocolSchema = PublicApiV0ProtocolBaseSchema.extend({
  schemaVersion: z.literal("artifact-read-v0")
}).passthrough();

export const PublicApiV0CommunityResponseSchema = CommunitySchema.omit({ createdAt: true })
  .extend({
    createdAt: PublicApiV0DateTimeSchema,
    memberCount: z.number().int().nonnegative(),
    questionCount: z.number().int().nonnegative(),
    isMember: z.boolean(),
    activeUserRole: CommunityMemberSchema.shape.role.nullable()
  })
  .passthrough();

export const PublicApiV0ArchiveRecordResponseSchema = ArchiveRecordSchema.omit({ createdAt: true })
  .extend({ createdAt: PublicApiV0DateTimeSchema })
  .passthrough();

export const PublicApiV0RegistryEventResponseSchema = z
  .object({
    id: z.string(),
    eventType: z.string(),
    subjectId: z.string(),
    actor: z.string(),
    previousHash: z.string().nullable(),
    newHash: z.string(),
    sourceType: z.string().optional(),
    sourceTransactionId: z.string().nullable().optional(),
    sourceTransactionHash: z.string().nullable().optional(),
    sourceModule: z.string().nullable().optional(),
    transactionType: z.string().nullable().optional(),
    emittedAt: PublicApiV0DateTimeSchema
  })
  .passthrough();

export const PublicApiV0ProtocolTransactionResultResponseSchema = ProtocolTransactionResultSchema.omit({ createdAt: true })
  .extend({ createdAt: PublicApiV0DateTimeSchema })
  .passthrough();

export const PublicApiV0QuestionResponseSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    status: QuestionStatusSchema,
    communityId: z.string().nullable(),
    authorityLevel: AuthorityLevelSchema,
    resultMode: PollResultModeSchema.optional(),
    adoptionPolicyId: z.string().nullable().optional(),
    credentialSchemaId: z.string(),
    answerSchemaId: z.string(),
    answerSchema: AnswerSchemaSchema.optional()
  })
  .passthrough();

export const PublicApiV0DiscussionPostResponseSchema = DiscussionPostSchema.omit({ createdAt: true })
  .extend({ createdAt: PublicApiV0DateTimeSchema })
  .passthrough();

export const PublicApiV0DiscussionViewSchema = z
  .object({
    key: DiscussionViewKeySchema,
    kind: DiscussionPostKindSchema,
    label: z.string(),
    count: z.number().int().nonnegative(),
    posts: z.array(PublicApiV0DiscussionPostResponseSchema)
  })
  .passthrough();

const PublicApiV0ChallengeResponseSchema = z
  .object({
    id: z.string(),
    evidenceHash: z.string(),
    resolutionHash: z.string().nullable(),
    ruling: z.string(),
    reasonCode: z.string(),
    challenger: z.string(),
    challengeBondId: z.string()
  })
  .passthrough();

export const PublicApiV0ChallengeAppealResponseSchema = ChallengeAppealSchema.omit({ createdAt: true, resolvedAt: true })
  .extend({
    createdAt: PublicApiV0DateTimeSchema,
    resolvedAt: PublicApiV0DateTimeSchema.nullable().optional()
  })
  .passthrough();

export const PublicApiV0JurorAssignmentResponseSchema = JurorAssignmentSchema.omit({ createdAt: true, updatedAt: true })
  .extend({
    createdAt: PublicApiV0DateTimeSchema,
    updatedAt: PublicApiV0DateTimeSchema.optional()
  })
  .passthrough();

export const PublicApiV0GovernanceParameterResponseSchema = GovernanceParameterSetSchema.omit({
  effectiveAt: true,
  createdAt: true,
  updatedAt: true
})
  .extend({
    effectiveAt: PublicApiV0DateTimeSchema,
    createdAt: PublicApiV0DateTimeSchema,
    updatedAt: PublicApiV0DateTimeSchema
  })
  .passthrough();

export const PublicApiV0CivicRecordResultSchema = z
  .object({
    pollId: z.string(),
    resultArtifactHash: z.string(),
    aggregateCountsHash: z.string(),
    individualResultHash: z.string().nullable().optional(),
    communityBlockResultHash: z.string().nullable().optional(),
    tallyProofHash: z.string(),
    tallyPublicationProofHash: z.string().nullable().optional(),
    turnout: z.number().int().nonnegative(),
    invalidBallots: z.number().int().nonnegative(),
    privacyReportHash: z.string(),
    finalStatus: ResultFinalStatusSchema,
    authorityLevel: AuthorityLevelSchema
  })
  .passthrough();

export const PublicApiV0ArtifactReferenceSchema = z
  .object({
    kind: z.string(),
    hash: z.string(),
    role: z.string().optional()
  })
  .passthrough();

export const PublicApiV0ArtifactManifestSchema = z
  .object({
    protocol: z.literal("popular-consensus"),
    schemaVersion: z.literal("artifact-manifest-v1"),
    references: z.array(PublicApiV0ArtifactReferenceSchema)
  })
  .passthrough();

export const PublicApiV0ArtifactExportBundleEntrySchema = PublicApiV0ArtifactReferenceSchema.extend({
  computedHash: z.string(),
  value: z.unknown()
}).passthrough();

export const PublicApiV0ArtifactExportBundleSchema = z
  .object({
    protocol: z.literal("popular-consensus"),
    schemaVersion: z.literal("artifact-export-bundle-v1"),
    root: PublicApiV0ArtifactExportBundleEntrySchema.optional(),
    manifest: PublicApiV0ArtifactManifestSchema,
    manifestHash: z.string(),
    artifacts: z.array(PublicApiV0ArtifactExportBundleEntrySchema)
  })
  .passthrough();

export const PublicApiV0ArchiveIndexRecordSchema = PublicApiV0ArchiveRecordResponseSchema.extend({
  question: z
    .object({
      id: z.string(),
      title: z.string(),
      status: QuestionStatusSchema,
      communityId: z.string().nullable(),
      authorityLevel: AuthorityLevelSchema,
      adoptionPolicyId: z.string().nullable(),
      poll: z
        .object({
          id: z.string(),
          result: z
            .object({
              resultArtifactHash: z.string(),
              finalStatus: ResultFinalStatusSchema
            })
            .nullable()
        })
        .nullable()
    })
    .passthrough()
}).passthrough();

export const PublicApiV0ResultArtifactResponseSchema = z
  .object({
    resultId: z.string(),
    pollId: z.string(),
    questionId: z.string(),
    communityId: z.string().nullable(),
    authorityLevel: AuthorityLevelSchema,
    adoptionPolicyId: z.string().nullable(),
    credentialSchemaId: z.string(),
    resultArtifactHash: z.string(),
    aggregateCountsHash: z.string(),
    tallyProofHash: z.string(),
    tallyPublicationProofHash: z.string().nullable().optional(),
    privacyReportHash: z.string(),
    turnout: z.number().int().nonnegative(),
    invalidBallots: z.number().int().nonnegative(),
    finalStatus: ResultFinalStatusSchema,
    publishedAt: PublicApiV0DateTimeSchema
  })
  .passthrough();

export const PublicApiV0ReplayCheckSchema = z
  .object({
    id: z.string(),
    ok: z.boolean(),
    expected: z.unknown().optional(),
    actual: z.unknown().optional(),
    detail: z.string().optional()
  })
  .passthrough();

export const PublicApiV0ReplayRebuiltStateSchema = z
  .object({
    questionStatus: QuestionStatusSchema.nullable(),
    pollStatus: z.string().nullable(),
    resultFinalStatus: ResultFinalStatusSchema.nullable(),
    bodyHash: z.string().nullable(),
    resultArtifactHash: z.string().nullable(),
    archiveHash: z.string().nullable()
  })
  .passthrough();

export const PublicApiV0CommunityImportReplayRebuiltSchema = z
  .object({
    communityId: z.string().nullable(),
    slug: z.string().nullable(),
    source: z.literal("export-bundle"),
    readOnly: z.literal(true),
    questionCount: z.number().int().nonnegative(),
    policyCount: z.number().int().nonnegative(),
    forkCount: z.number().int().nonnegative(),
    archiveCount: z.number().int().nonnegative(),
    eventCount: z.number().int().nonnegative(),
    commitmentCount: z.number().int().nonnegative(),
    artifactCount: z.number().int().nonnegative(),
    frontendConfigHash: z.string().nullable(),
    artifactManifestHash: z.string().nullable()
  })
  .passthrough();

export const PublicApiV0ProtocolIndexerReplayModuleSchema = z
  .object({
    sourceModule: z.string(),
    transactionCount: z.number().int().nonnegative(),
    eventCount: z.number().int().nonnegative(),
    subjectCount: z.number().int().nonnegative(),
    eventTypes: z.array(z.string()),
    latestResultHash: z.string().nullable()
  })
  .passthrough();

export const PublicApiV0ProtocolIndexerReplaySubjectSchema = z
  .object({
    subjectId: z.string(),
    sourceModules: z.array(z.string()),
    eventTypes: z.array(z.string()),
    transactionCount: z.number().int().nonnegative(),
    eventCount: z.number().int().nonnegative(),
    latestEventType: z.string().nullable(),
    latestEventHash: z.string().nullable(),
    latestNewHash: z.string().nullable(),
    latestResultHash: z.string().nullable()
  })
  .passthrough();

export const PublicApiV0ProtocolIndexerReplayRebuiltSchema = z
  .object({
    source: z.literal("protocol-transactions"),
    readOnly: z.literal(true),
    transactionCount: z.number().int().nonnegative(),
    eventCount: z.number().int().nonnegative(),
    subjectCount: z.number().int().nonnegative(),
    moduleCount: z.number().int().nonnegative(),
    transactionStreamHash: z.string(),
    eventStreamHash: z.string(),
    latestResultHash: z.string().nullable(),
    latestEventHash: z.string().nullable(),
    modules: z.array(PublicApiV0ProtocolIndexerReplayModuleSchema),
    subjects: z.array(PublicApiV0ProtocolIndexerReplaySubjectSchema)
  })
  .passthrough();

export const PublicApiV0CommunitiesResponseSchema = z
  .object({
    protocol: PublicApiV0CommunitiesProtocolSchema,
    page: PublicApiV0PageSchema,
    communities: z.array(PublicApiV0CommunityResponseSchema)
  })
  .passthrough();

export const PublicApiV0CivicRecordResponseSchema = z
  .object({
    protocol: PublicApiV0CivicRecordProtocolSchema,
    question: PublicApiV0QuestionResponseSchema,
    events: z.array(PublicApiV0RegistryEventResponseSchema),
    commitments: z.array(ProtocolCommitmentRecordSchema),
    challenges: z.array(PublicApiV0ChallengeResponseSchema),
    resultChallenges: z.array(PublicApiV0ChallengeResponseSchema),
    challengeAppeals: z.array(PublicApiV0ChallengeAppealResponseSchema).optional(),
    jurorAssignments: z.array(PublicApiV0JurorAssignmentResponseSchema).optional(),
    credentialIssuerAnnotations: z.array(CredentialIssuerAnnotationSchema).optional(),
    result: PublicApiV0CivicRecordResultSchema.nullable(),
    archiveRecord: PublicApiV0ArchiveRecordResponseSchema.nullable(),
    discussionCount: z.number().int().nonnegative()
  })
  .passthrough();

export const PublicApiV0ChallengeAppealsResponseSchema = z
  .object({
    protocol: PublicApiV0ChallengeAppealsProtocolSchema,
    questionId: z.string(),
    appeals: z.array(PublicApiV0ChallengeAppealResponseSchema)
  })
  .passthrough();

export const PublicApiV0JurorAssignmentsResponseSchema = z
  .object({
    protocol: PublicApiV0JurorAssignmentsProtocolSchema,
    questionId: z.string(),
    assignments: z.array(PublicApiV0JurorAssignmentResponseSchema)
  })
  .passthrough();

export const PublicApiV0GovernanceParametersResponseSchema = z
  .object({
    protocol: PublicApiV0GovernanceParametersProtocolSchema,
    communityId: z.string(),
    activeParameterSet: PublicApiV0GovernanceParameterResponseSchema.nullable(),
    parameterSets: z.array(PublicApiV0GovernanceParameterResponseSchema)
  })
  .passthrough();

export const PublicApiV0TreasuryLedgerResponseSchema = z
  .object({
    protocol: PublicApiV0TreasuryLedgerProtocolSchema,
    communityId: z.string(),
    entries: z.array(TreasuryLedgerEntrySchema),
    totals: TreasuryLedgerTotalsSchema
  })
  .passthrough();

export const PublicApiV0DataUnionResponseSchema = z
  .object({
    protocol: PublicApiV0DataUnionProtocolSchema,
    communityId: z.string(),
    activePolicy: DataUnionPolicySchema.nullable(),
    policies: z.array(DataUnionPolicySchema),
    consents: z.array(DataUnionConsentSchema),
    products: z.array(DataUnionProductSchema),
    accessGrants: z.array(DataUnionAccessGrantSchema)
  })
  .passthrough();

export const PublicApiV0CommunityEmergencySuspensionResponseSchema = CommunityEmergencySuspensionSchema.omit({
  createdAt: true,
  updatedAt: true,
  resolvedAt: true
})
  .extend({
    createdAt: PublicApiV0DateTimeSchema,
    updatedAt: PublicApiV0DateTimeSchema,
    resolvedAt: PublicApiV0DateTimeSchema.nullable().optional()
  })
  .passthrough();

export const PublicApiV0StewardPowerMemberResponseSchema = z
  .object({
    userId: z.string(),
    role: StewardPowerRoleSchema,
    status: z.string(),
    profileId: z.string().nullable().optional(),
    profileHash: z.string().nullable().optional()
  })
  .passthrough();

export const PublicApiV0StewardPowersResponseSchema = z
  .object({
    protocol: PublicApiV0StewardPowersProtocolSchema,
    communityId: z.string(),
    powers: z.array(StewardPowerSchema),
    activeStewards: z.array(PublicApiV0StewardPowerMemberResponseSchema),
    emergencySuspensions: z.array(PublicApiV0CommunityEmergencySuspensionResponseSchema),
    activeEmergencySuspension: PublicApiV0CommunityEmergencySuspensionResponseSchema.nullable()
  })
  .passthrough();

export const PublicApiV0UpgradeSafetyGateSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    status: z.enum(["Required", "Available", "Satisfied", "Engaged", "Pending"]),
    requirement: z.string(),
    evidence: z.array(z.string())
  })
  .passthrough();

export const PublicApiV0UpgradeSafetyModelSchema = z
  .object({
    schemaVersion: z.literal("upgrade-governance-safety-model-v0"),
    communityId: z.string(),
    status: z.string(),
    activationRule: z.string(),
    emergencyRule: z.string(),
    forkExitRule: z.string(),
    minimumReviewHours: z.number().int().nonnegative(),
    gates: z.array(PublicApiV0UpgradeSafetyGateSchema),
    upgradeClasses: z.array(z.string()),
    knownMvpLimits: z.array(z.string())
  })
  .passthrough();

export const PublicApiV0UpgradeSafetyResponseSchema = z
  .object({
    protocol: PublicApiV0UpgradeSafetyProtocolSchema,
    communityId: z.string(),
    model: PublicApiV0UpgradeSafetyModelSchema,
    gates: z.array(PublicApiV0UpgradeSafetyGateSchema),
    powers: z.array(StewardPowerSchema),
    activeStewards: z.array(PublicApiV0StewardPowerMemberResponseSchema),
    activeParameterSet: PublicApiV0GovernanceParameterResponseSchema.nullable(),
    activeEmergencySuspension: PublicApiV0CommunityEmergencySuspensionResponseSchema.nullable()
  })
  .passthrough();

export const PublicTestnetOperatorRoleSchema = z.enum(["deployer", "api-indexer", "replay-verifier", "community-steward"]);

export const PublicTestnetOperatorRequirementSchema = z
  .object({
    role: PublicTestnetOperatorRoleSchema,
    minimumCount: z.number().int().positive(),
    responsibility: z.string()
  })
  .passthrough();

export const PublicTestnetReadinessGateSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    status: z.enum(["Ready", "PendingExternalOperators", "Blocked"]),
    requirement: z.string(),
    evidence: z.array(z.string())
  })
  .passthrough();

export const PublicTestnetOperatorAttestationSchema = z
  .object({
    protocol: z.literal("popular-consensus"),
    schemaVersion: z.literal("public-testnet-operator-attestation-v0"),
    operatorId: z.string().min(1),
    operatorContact: z.string().min(1),
    operatorOrganization: z.string().min(1).nullable(),
    independenceStatement: z.string().min(20),
    operatorRole: PublicTestnetOperatorRoleSchema,
    gitCommit: z.string().min(1),
    chainId: z.string().min(1),
    rpcUrl: z.string().min(1),
    apiBaseUrl: z.string().nullable(),
    deploymentHash: z.string().nullable(),
    transactionStreamHash: z.string(),
    eventStreamHash: z.string(),
    upgradeSafetyModelHash: z.string(),
    checks: z.record(z.string(), z.string()),
    observations: z.array(z.string()),
    attestedAt: PublicApiV0DateTimeSchema
  })
  .passthrough();

export const PublicApiV0PublicTestnetReadinessResponseSchema = z
  .object({
    protocol: PublicApiV0PublicTestnetReadinessProtocolSchema,
    status: z.enum(["ReadyForOperatorLaunch", "PendingExternalOperators", "Blocked"]),
    operatorRequirements: z.array(PublicTestnetOperatorRequirementSchema),
    requiredCommands: z.array(z.string()),
    requiredEndpoints: z.array(z.string()),
    governanceDrills: z.array(z.string()),
    attestationTemplate: PublicTestnetOperatorAttestationSchema,
    completionGates: z.array(PublicTestnetReadinessGateSchema),
    knownLimitations: z.array(z.string())
  })
  .passthrough();

export const PublicApiV0CredentialTrustPolicyResponseSchema = CommunityCredentialTrustPolicySchema.omit({
  createdAt: true,
  updatedAt: true
})
  .extend({
    createdAt: PublicApiV0DateTimeSchema,
    updatedAt: PublicApiV0DateTimeSchema.optional()
  })
  .passthrough();

export const PublicApiV0CredentialTrustPoliciesResponseSchema = z
  .object({
    protocol: PublicApiV0CredentialTrustPoliciesProtocolSchema,
    communityId: z.string(),
    policies: z.array(PublicApiV0CredentialTrustPolicyResponseSchema)
  })
  .passthrough();

export const PublicApiV0TallyCommitteeResponseSchema = TallyCommitteeSchema.omit({
  createdAt: true,
  updatedAt: true
})
  .extend({
    createdAt: PublicApiV0DateTimeSchema,
    updatedAt: PublicApiV0DateTimeSchema.optional()
  })
  .passthrough();

export const PublicApiV0TallyCommitteesResponseSchema = z
  .object({
    protocol: PublicApiV0TallyCommitteesProtocolSchema,
    communityId: z.string(),
    activeCommittee: PublicApiV0TallyCommitteeResponseSchema.nullable(),
    committees: z.array(PublicApiV0TallyCommitteeResponseSchema)
  })
  .passthrough();

export const PublicApiV0TallyKeySetupResponseSchema = TallyKeySetupSchema.omit({
  createdAt: true,
  updatedAt: true
})
  .extend({
    createdAt: PublicApiV0DateTimeSchema,
    updatedAt: PublicApiV0DateTimeSchema.optional()
  })
  .passthrough();

export const PublicApiV0TallyKeySetupsResponseSchema = z
  .object({
    protocol: PublicApiV0TallyKeySetupsProtocolSchema,
    communityId: z.string(),
    activeKeySetup: PublicApiV0TallyKeySetupResponseSchema.nullable(),
    keySetups: z.array(PublicApiV0TallyKeySetupResponseSchema)
  })
  .passthrough();

export const PublicApiV0TallyDecryptionShareResponseSchema = TallyDecryptionShareSchema.omit({
  submittedAt: true
})
  .extend({
    submittedAt: PublicApiV0DateTimeSchema
  })
  .passthrough();

export const PublicApiV0TallyDecryptionSharesResponseSchema = z
  .object({
    protocol: PublicApiV0TallyDecryptionSharesProtocolSchema,
    pollId: z.string(),
    keySetupId: z.string().nullable(),
    threshold: z.number().int().nonnegative(),
    thresholdMet: z.boolean(),
    shares: z.array(PublicApiV0TallyDecryptionShareResponseSchema)
  })
  .passthrough();

export const PublicApiV0QuestionDiscussionResponseSchema = z
  .object({
    protocol: PublicApiV0QuestionDiscussionProtocolSchema,
    questionId: z.string(),
    discussion: z.array(PublicApiV0DiscussionPostResponseSchema),
    views: z.array(PublicApiV0DiscussionViewSchema)
  })
  .passthrough();

export const PublicApiV0QuestionModerationResponseSchema = z
  .object({
    protocol: PublicApiV0QuestionModerationProtocolSchema,
    questionId: z.string(),
    moderationRecords: z.array(DiscussionModerationRecordSchema),
    appeals: z.array(DiscussionModerationAppealSchema)
  })
  .passthrough();

export const PublicApiV0ProfileRecordResponseSchema = z
  .object({
    protocol: PublicApiV0ProfileRecordProtocolSchema,
    profile: UserAccountSchema.omit({ createdAt: true }).extend({ createdAt: PublicApiV0DateTimeSchema }).passthrough(),
    profileArtifact: z
      .object({
        hash: z.string(),
        artifact: z.unknown()
      })
      .nullable()
  })
  .passthrough();

export const PublicApiV0DiscoveryCommunitySchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    kind: CommunityKindSchema.default("Group"),
    parentId: z.string().nullable().optional(),
    path: z.string().optional(),
    depth: z.number().int().nonnegative().optional(),
    registryStatus: CommunityRegistryStatusSchema.default("Active").optional(),
    profileUserId: z.string().nullable().optional(),
    visibility: CommunityVisibilitySchema,
    memberCount: z.number().int().nonnegative(),
    questionCount: z.number().int().nonnegative(),
    followerCount: z.number().int().nonnegative(),
    followedByActiveUser: z.boolean()
  })
  .passthrough();

export const PublicApiV0DiscoveryTopicSchema = z
  .object({
    topicId: z.string(),
    questionCount: z.number().int().nonnegative(),
    communityCount: z.number().int().nonnegative(),
    followerCount: z.number().int().nonnegative(),
    followedByActiveUser: z.boolean()
  })
  .passthrough();

export const PublicApiV0DiscoveryResponseSchema = z
  .object({
    protocol: PublicApiV0DiscoveryProtocolSchema,
    communities: z.array(PublicApiV0DiscoveryCommunitySchema),
    profiles: z.array(PublicApiV0DiscoveryCommunitySchema).optional(),
    topics: z.array(PublicApiV0DiscoveryTopicSchema),
    communityFollows: z.array(CommunityFollowSchema),
    topicFollows: z.array(TopicFollowSchema)
  })
  .passthrough();

export const PublicApiV0ReputationEventSchema = z
  .object({
    id: z.string().optional(),
    eventId: z.string().optional(),
    account: z.string(),
    reason: z.string(),
    weight: z.number().int(),
    sourceId: z.string(),
    createdAt: PublicApiV0DateTimeSchema.optional(),
    emittedAt: z.union([z.number().int(), z.string().datetime(), z.date()]).optional()
  })
  .passthrough();

export const PublicApiV0ReputationTotalsSchema = z.record(z.string(), z.number().int());

export const PublicApiV0ReputationEventsResponseSchema = z
  .object({
    protocol: PublicApiV0ReputationEventsProtocolSchema,
    events: z.array(PublicApiV0ReputationEventSchema),
    totals: PublicApiV0ReputationTotalsSchema
  })
  .passthrough();

export const PublicApiV0ReputationExportResponseSchema = z
  .object({
    protocol: PublicApiV0ReputationExportProtocolSchema,
    events: z.array(PublicApiV0ReputationEventSchema),
    totals: PublicApiV0ReputationTotalsSchema,
    exportArtifact: z
      .object({
        hash: z.string(),
        artifact: z.unknown()
      })
      .passthrough()
  })
  .passthrough();

export const PublicApiV0ReputationReplayResponseSchema = z
  .object({
    protocol: PublicApiV0ReputationReplayProtocolSchema,
    status: z.enum(["Verified", "Mismatch"]),
    totals: PublicApiV0ReputationTotalsSchema,
    checks: z.array(PublicApiV0ReplayCheckSchema)
  })
  .passthrough();

export const PublicApiV0ArchiveExportResponseSchema = z
  .object({
    protocol: PublicApiV0ArchiveExportProtocolSchema,
    archiveRecord: PublicApiV0ArchiveRecordResponseSchema,
    bundle: PublicApiV0ArtifactExportBundleSchema
  })
  .passthrough();

export const PublicApiV0CommunityExportResponseSchema = z
  .object({
    protocol: PublicApiV0CommunityExportProtocolSchema,
    community: CommunitySchema.omit({ createdAt: true }).extend({ createdAt: PublicApiV0DateTimeSchema }).passthrough(),
    exportArtifact: z
      .object({
        hash: z.string(),
        artifact: z.unknown()
      })
      .passthrough(),
    bundle: PublicApiV0ArtifactExportBundleSchema
  })
  .passthrough();

export const PublicApiV0CommunityImportReplayResponseSchema = z
  .object({
    protocol: PublicApiV0CommunityImportReplayProtocolSchema,
    status: z.enum(["Verified", "Mismatch"]),
    readOnly: z.literal(true),
    rebuilt: PublicApiV0CommunityImportReplayRebuiltSchema,
    checks: z.array(PublicApiV0ReplayCheckSchema)
  })
  .passthrough();

export const PublicApiV0RegistryEventsResponseSchema = z
  .object({
    protocol: PublicApiV0RegistryEventsProtocolSchema,
    page: PublicApiV0PageSchema,
    events: z.array(PublicApiV0RegistryEventResponseSchema),
    commitments: z.array(ProtocolCommitmentRecordSchema)
  })
  .passthrough();

export const PublicApiV0ProtocolTransactionsResponseSchema = z
  .object({
    protocol: PublicApiV0ProtocolTransactionsProtocolSchema,
    page: PublicApiV0PageSchema,
    transactions: z.array(PublicApiV0ProtocolTransactionResultResponseSchema)
  })
  .passthrough();

export const PublicApiV0ProtocolIndexerReplayResponseSchema = z
  .object({
    protocol: PublicApiV0ProtocolIndexerReplayProtocolSchema,
    status: z.enum(["Verified", "Mismatch"]),
    readOnly: z.literal(true),
    rebuilt: PublicApiV0ProtocolIndexerReplayRebuiltSchema,
    transactions: z.array(PublicApiV0ProtocolTransactionResultResponseSchema),
    events: z.array(PublicApiV0RegistryEventResponseSchema),
    checks: z.array(PublicApiV0ReplayCheckSchema)
  })
  .passthrough();

export const PublicApiV0ArchivesResponseSchema = z
  .object({
    protocol: PublicApiV0ArchivesProtocolSchema,
    page: PublicApiV0PageSchema,
    archives: z.array(PublicApiV0ArchiveIndexRecordSchema)
  })
  .passthrough();

export const PublicApiV0ResultArtifactsResponseSchema = z
  .object({
    protocol: PublicApiV0ResultArtifactsProtocolSchema,
    page: PublicApiV0PageSchema,
    resultArtifacts: z.array(PublicApiV0ResultArtifactResponseSchema)
  })
  .passthrough();

export const PublicApiV0ReplayCheckResponseSchema = z
  .object({
    protocol: PublicApiV0ReplayCheckProtocolSchema,
    questionId: z.string(),
    status: z.enum(["Verified", "Mismatch"]),
    eventStreamHash: z.string(),
    rebuilt: PublicApiV0ReplayRebuiltStateSchema,
    checks: z.array(PublicApiV0ReplayCheckSchema)
  })
  .passthrough();

export const PublicApiV0MinimumCommitmentsResponseSchema = z
  .object({
    protocol: PublicApiV0MinimumCommitmentsProtocolSchema,
    commitments: z.array(ProtocolCommitmentSchema)
  })
  .passthrough();

export const PublicApiV0CommitmentsResponseSchema = z
  .object({
    protocol: PublicApiV0CommitmentsProtocolSchema,
    page: PublicApiV0PageSchema,
    commitments: z.array(ProtocolCommitmentRecordSchema)
  })
  .passthrough();

export const PublicApiV0ArtifactReadResponseSchema = z
  .object({
    protocol: PublicApiV0ArtifactReadProtocolSchema,
    hash: z.string(),
    artifact: z.unknown()
  })
  .passthrough();

export const PublicApiV0ResponseSchemas = {
  appchainBoundary: CanonicalProtocolBoundarySchema,
  publicTestnetReadiness: PublicApiV0PublicTestnetReadinessResponseSchema,
  communities: PublicApiV0CommunitiesResponseSchema,
  civicRecord: PublicApiV0CivicRecordResponseSchema,
  challengeAppeals: PublicApiV0ChallengeAppealsResponseSchema,
  jurorAssignments: PublicApiV0JurorAssignmentsResponseSchema,
  governanceParameters: PublicApiV0GovernanceParametersResponseSchema,
  treasuryLedger: PublicApiV0TreasuryLedgerResponseSchema,
  dataUnion: PublicApiV0DataUnionResponseSchema,
  stewardPowers: PublicApiV0StewardPowersResponseSchema,
  upgradeSafety: PublicApiV0UpgradeSafetyResponseSchema,
  credentialTrustPolicies: PublicApiV0CredentialTrustPoliciesResponseSchema,
  tallyCommittees: PublicApiV0TallyCommitteesResponseSchema,
  tallyKeySetups: PublicApiV0TallyKeySetupsResponseSchema,
  tallyDecryptionShares: PublicApiV0TallyDecryptionSharesResponseSchema,
  questionDiscussion: PublicApiV0QuestionDiscussionResponseSchema,
  questionModeration: PublicApiV0QuestionModerationResponseSchema,
  profileRecord: PublicApiV0ProfileRecordResponseSchema,
  discovery: PublicApiV0DiscoveryResponseSchema,
  reputationEvents: PublicApiV0ReputationEventsResponseSchema,
  reputationExport: PublicApiV0ReputationExportResponseSchema,
  reputationReplay: PublicApiV0ReputationReplayResponseSchema,
  archiveExport: PublicApiV0ArchiveExportResponseSchema,
  communityExport: PublicApiV0CommunityExportResponseSchema,
  communityImportReplay: PublicApiV0CommunityImportReplayResponseSchema,
  registryEvents: PublicApiV0RegistryEventsResponseSchema,
  protocolTransactions: PublicApiV0ProtocolTransactionsResponseSchema,
  protocolIndexerReplay: PublicApiV0ProtocolIndexerReplayResponseSchema,
  archives: PublicApiV0ArchivesResponseSchema,
  resultArtifacts: PublicApiV0ResultArtifactsResponseSchema,
  replayCheck: PublicApiV0ReplayCheckResponseSchema,
  minimumCommitments: PublicApiV0MinimumCommitmentsResponseSchema,
  commitments: PublicApiV0CommitmentsResponseSchema,
  artifactRead: PublicApiV0ArtifactReadResponseSchema
} as const;

export type PublicApiV0Page = z.infer<typeof PublicApiV0PageSchema>;
export type PublicApiV0ResponseSchemas = typeof PublicApiV0ResponseSchemas;

export const CreateUserRequestSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, and underscores only."),
  displayName: z.string().min(1).max(60),
  bio: z.string().max(280).default("")
});

export const AuthControllerKindSchema = z.enum(["Passkey", "Wallet"]);

export const StartPasskeyRegistrationRequestSchema = z.object({
  username: CreateUserRequestSchema.shape.username,
  displayName: CreateUserRequestSchema.shape.displayName,
  bio: CreateUserRequestSchema.shape.bio
});

export const VerifyPasskeyRegistrationRequestSchema = z.object({
  challengeId: z.string().min(1),
  credential: z.object({
    id: z.string().min(1),
    rawId: z.string().min(1),
    type: z.literal("public-key"),
    response: z.object({
      clientDataJSON: z.string().min(1),
      attestationObject: z.string().min(1)
    })
  })
});

export const StartPasskeyLoginRequestSchema = z.object({
  username: z.string().min(1).optional()
});

export const VerifyPasskeyLoginRequestSchema = z.object({
  challengeId: z.string().min(1),
  credential: z.object({
    id: z.string().min(1),
    rawId: z.string().min(1),
    type: z.literal("public-key"),
    response: z.object({
      clientDataJSON: z.string().min(1),
      authenticatorData: z.string().min(1),
      signature: z.string().min(1),
      userHandle: z.string().min(1).optional()
    })
  })
});

const AaUserOperationSchema = z.object({
  sender: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Use an Ethereum address."),
  nonce: z.string().regex(/^[0-9]+$/, "Use a decimal nonce."),
  initCode: z.string().regex(/^0x[a-fA-F0-9]*$/, "Use hex initCode."),
  callData: z.string().regex(/^0x[a-fA-F0-9]*$/, "Use hex callData."),
  accountGasLimits: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Use bytes32 account gas limits."),
  preVerificationGas: z.string().regex(/^[0-9]+$/, "Use decimal preVerificationGas."),
  gasFees: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Use bytes32 gas fees."),
  paymasterAndData: z.string().regex(/^0x[a-fA-F0-9]*$/, "Use hex paymaster data."),
  signature: z.string().regex(/^0x[a-fA-F0-9]*$/, "Use hex signature.")
});

const PasskeyAssertionCredentialSchema = z.object({
  id: z.string().min(1),
  rawId: z.string().min(1),
  type: z.literal("public-key"),
  response: z.object({
    clientDataJSON: z.string().min(1),
    authenticatorData: z.string().min(1),
    signature: z.string().min(1),
    userHandle: z.string().min(1).optional()
  })
});

export const StartPasskeyDeploymentRequestSchema = z.object({
  controllerId: z.string().min(1).optional()
});

export const VerifyPasskeyDeploymentRequestSchema = z.object({
  challengeId: z.string().min(1),
  aaUserOperation: AaUserOperationSchema,
  credential: PasskeyAssertionCredentialSchema
});

export const StartWalletAuthRequestSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Use an Ethereum address."),
  username: CreateUserRequestSchema.shape.username.optional(),
  displayName: CreateUserRequestSchema.shape.displayName.optional(),
  bio: CreateUserRequestSchema.shape.bio.optional()
});

export const VerifyWalletAuthRequestSchema = z.object({
  challengeId: z.string().min(1),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Use an Ethereum address."),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/, "Use a hex signature."),
  aaUserOperation: AaUserOperationSchema.optional(),
  aaUserOperationSignature: z.string().regex(/^0x[a-fA-F0-9]+$/, "Use a hex UserOperation signature.").optional()
});

export const CreateCommunityRequestSchema = z.object({
  name: z.string().min(3).max(80),
  slug: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only.")
    .optional(),
  description: z.string().min(1).max(280),
  visibility: CommunityVisibilitySchema.default("Public"),
  kind: CommunityKindSchema.default("Group"),
  parentId: z.string().min(1).optional(),
  creatorId: z.string().min(1),
  credentialSchemaId: z.string().default("credential-vancouver-resident")
});

export const SetCommunityRegistryPolicyRequestSchema = z.object({
  steward: z.string().min(1),
  approvalThresholdPercent: z.number().int().min(1).max(100).default(66),
  quorumPercent: z.number().int().min(0).max(100).default(10),
  reviewWindowHours: z.number().int().positive().default(168)
});

export const ResolveCommunityChildProposalRequestSchema = z.object({
  curator: z.string().min(1),
  reason: z.string().min(1).max(1000).default("Resolved under the parent community registry policy.")
});

export const VoteCommunityChildProposalRequestSchema = z.object({
  voterId: z.string().min(1),
  vote: CommunityChildProposalVoteSchema.default("Support")
});

export const JoinCommunityRequestSchema = z.object({
  userId: z.string().min(1)
});

export const FollowCommunityRequestSchema = z.object({
  userId: z.string().min(1)
});

export const FollowTopicRequestSchema = z.object({
  userId: z.string().min(1)
});

export const ReputationReplayRequestSchema = z.object({
  events: z.array(PublicApiV0ReputationEventSchema),
  expectedTotals: PublicApiV0ReputationTotalsSchema.optional()
});

export const CreateCommunityForkRequestSchema = z.object({
  steward: z.string().min(1).default("demo-curator"),
  forkName: z.string().min(3).max(100),
  forkSlug: z
    .string()
    .min(3)
    .max(48)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only."),
  reason: z.string().min(1).max(1000),
  sourceExportHash: z.string().min(1)
});

export const CommunityImportReplayRequestSchema = z.object({
  bundle: PublicApiV0ArtifactExportBundleSchema
});

const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color.");

export const SetCommunityFrontendConfigRequestSchema = z.object({
  steward: z.string().min(1).default("demo-curator"),
  displayName: z.string().min(1).max(100),
  tagline: z.string().min(1).max(180).default(""),
  theme: z
    .object({
      primary: HexColorSchema.default("#1f6feb"),
      accent: HexColorSchema.default("#f2cc60"),
      background: HexColorSchema.default("#f7f8fa")
    })
    .default({ primary: "#1f6feb", accent: "#f2cc60", background: "#f7f8fa" }),
  enabledViews: z.array(CommunityFrontendViewSchema).min(1).default(["Overview", "Questions", "Archives", "Results", "Discussion", "Adoption", "Forks"]),
  navigation: z
    .array(
      z.object({
        label: z.string().min(1).max(32),
        view: CommunityFrontendViewSchema
      })
    )
    .default([
      { label: "Questions", view: "Questions" },
      { label: "Archives", view: "Archives" },
      { label: "Forks", view: "Forks" }
    ]),
  externalLinks: z
    .array(
      z.object({
        label: z.string().min(1).max(48),
        url: z.string().url()
      })
    )
    .max(8)
    .default([])
});

export const CreateCredentialSchemaRequestSchema = z.object({
  steward: z.string().min(1).default("demo-curator"),
  credentialSchemaId: z.string().min(3).max(80).regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only."),
  name: z.string().min(1).max(120),
  issuerRegistryId: z.string().min(1).default("issuer-registry-demo"),
  eligibilityClaim: z.string().min(1).default("Local demo eligibility claim"),
  nullifierDomainRule: z.string().min(1).default("H(secret, pollId, credentialSchemaId)"),
  expiresAfter: z.number().int().positive().nullable().default(null),
  revocationRoot: z.string().min(1).nullable().default(null)
});

export const CreateCredentialIssuerRequestSchema = z.object({
  steward: z.string().min(1).default("demo-curator"),
  issuerId: z.string().min(3).max(80).regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only."),
  publicKey: z.string().min(1).default("dev-issuer-public-key"),
  schemaIds: z.array(z.string().min(1)).min(1).default(["credential-vancouver-resident"]),
  metadata: z.string().min(1).default("Local demo credential issuer")
});

export const SuspendCredentialIssuerRequestSchema = z.object({
  steward: z.string().min(1).default("demo-curator"),
  reason: z.string().min(1).default("Issuer suspended under local MVP review.")
});

export const RevokeCredentialRequestSchema = z.object({
  steward: z.string().min(1).default("demo-curator"),
  reason: z.string().min(1).default("Credential revoked under local MVP review.")
});

export const SetCommunityCredentialTrustPolicyRequestSchema = z.object({
  steward: z.string().min(1).default("demo-curator"),
  credentialSchemaId: z.string().min(1).default("credential-vancouver-resident"),
  trustedIssuerIds: z.array(z.string().min(1)).min(1).default(["*"]),
  mode: CommunityCredentialTrustPolicyModeSchema.default("AllowList"),
  status: z.enum(["Active", "Superseded", "Suspended"]).default("Active")
});

export const CreateTallyCommitteeRequestSchema = z
  .object({
    steward: z.string().min(1).default("demo-curator"),
    name: z.string().min(1).max(120).default("Local Demo Tally Committee"),
    memberIds: z.array(z.string().min(1)).min(1).default(["demo-curator", "demo-challenger", "demo-resident"]),
    threshold: z.number().int().positive().default(2),
    metadata: z.string().min(1).default("Local MVP tally committee metadata. Threshold shares are not configured yet."),
    replacementForId: z.string().min(1).nullable().default(null)
  })
  .refine((value) => value.threshold <= new Set(value.memberIds).size, "Tally committee threshold cannot exceed unique member count.");

export const ActivateTallyCommitteeRequestSchema = z.object({
  steward: z.string().min(1).default("demo-curator"),
  activationRecord: z.string().min(1).default("Community steward activates this committee for tally metadata."),
  effectiveAt: z.union([z.string().datetime(), z.number().int(), z.date()]).optional()
});

export const FailTallyCommitteeRequestSchema = z.object({
  steward: z.string().min(1).default("demo-curator"),
  reason: z.string().min(1).default("Tally committee failed to maintain threshold tally responsibilities."),
  replacementExpected: z.boolean().default(true)
});

export const SetupTallyPublicKeyRequestSchema = z.object({
  steward: z.string().min(1).default("demo-curator"),
  publicKeyPem: z.string().min(1).optional(),
  ceremonyTranscript: z.string().min(1).default("Local MVP threshold tally public key setup ceremony."),
  memberKeyCommitmentHashes: z.array(z.string().min(1)).optional()
});

export const SubmitTallyDecryptionShareRequestSchema = z.object({
  memberId: z.string().min(1).default("demo-curator"),
  share: z.string().min(1).default("local-demo-threshold-decryption-share"),
  proof: z.string().min(1).default("local-demo-threshold-decryption-proof")
});

export const CreateQuestionRequestSchema = z.object({
  title: z.string().min(1).default("Should Vancouver pilot car-free Sundays on Commercial Drive?"),
  body: z.string().min(1).default("A city resident advisory poll on whether to pilot car-free Sundays on Commercial Drive for one summer season."),
  sponsorDisclosure: z.string().default("Sponsored by the Popular Consensus local transit demo fund."),
  proposer: z.string().default("demo-proposer"),
  communityId: z.string().default("community-vancouver"),
  audience: QuestionAudienceSchema.default("Public"),
  resultMode: PollResultModeSchema.default("ShowBoth"),
  answerSchemaId: z.string().default("answer-binary-support-oppose"),
  topicIds: z.array(z.string()).default(["transit", "public-space"]),
  geoScope: z.string().default("Vancouver"),
  methodologyLabel: z.string().default("Answered by community members who chose to take part"),
  credentialSchemaId: z.string().default("credential-vancouver-resident")
});

export const FeedQuerySchema = z.object({
  mode: FeedModeSchema.default("global"),
  userId: z.string().optional(),
  communityId: z.string().optional(),
  profileUserId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50)
});

export const CreateChallengeRequestSchema = z.object({
  reasonCode: z.string().default("MisleadingWording"),
  evidence: z.string().default("The initial wording should clarify that this is a pilot, not a permanent road closure."),
  challenger: z.string().default("demo-challenger")
});

export const AcceptQuestionRequestSchema = z.object({
  curator: z.string().default("demo-curator")
});

export const ChallengeRulingRequestSchema = z.object({
  ruling: ChallengeRulingSchema,
  juror: z.string().default("demo-curator"),
  conflictDisclosure: z.string().min(1).max(1000).default("No known conflict under local MVP juror rules."),
  resolution: z.string().min(1).default("Demo curator ruling under local MVP rules.")
});

export const SelectJurorRequestSchema = z.object({
  selectedBy: z.string().min(1).default("demo-curator"),
  jurorId: z.string().min(1).default("demo-curator"),
  selectionReason: z.string().min(1).max(1000).default("Selected under local MVP community curator rules.")
});

export const DiscloseJurorConflictRequestSchema = z.object({
  jurorId: z.string().min(1).default("demo-curator"),
  hasConflict: z.boolean().default(false),
  disclosure: z.string().min(1).max(1000).default("No known conflict under local MVP juror rules.")
});

export const CreateChallengeAppealRequestSchema = z.object({
  appellantId: z.string().min(1),
  appeal: z.string().min(1).max(2000)
});

export const ResolveChallengeAppealRequestSchema = z.object({
  juror: z.string().min(1).default("demo-curator"),
  ruling: z.enum(["Upheld", "Overturned"]),
  conflictDisclosure: z.string().min(1).max(1000).default("No known conflict under local MVP juror rules."),
  resolution: z.string().min(1).max(2000)
});

export const CreateDiscussionPostRequestSchema = z.object({
  authorId: z.string().min(1),
  kind: DiscussionPostSchema.shape.kind.default("Comment"),
  body: z.string().min(1).max(5000),
  parentId: z.string().min(1).nullable().default(null)
});

export const ModerateDiscussionPostRequestSchema = z.object({
  moderatorId: z.string().min(1),
  action: DiscussionModerationActionSchema.default("HidePost"),
  reasonCode: DiscussionModerationReasonCodeSchema.default("Other"),
  reason: z.string().min(1).max(1000)
});

export const CreateModerationAppealRequestSchema = z.object({
  appellantId: z.string().min(1),
  appeal: z.string().min(1).max(1000)
});

export const ResolveModerationAppealRequestSchema = z.object({
  moderatorId: z.string().min(1),
  ruling: z.enum(["Upheld", "Overturned"]),
  resolution: z.string().min(1).max(1000)
});

export const CreateResultChallengeRequestSchema = z.object({
  challenger: z.string().default("demo-challenger"),
  reasonCode: ResultChallengeReasonSchema.default("PrivacyThresholdViolation"),
  evidence: z.string().min(1).default("The published result artifact should be reviewed before finalization.")
});

export const ResultChallengeRulingRequestSchema = z.object({
  ruling: ChallengeRulingSchema,
  juror: z.string().default("demo-curator"),
  conflictDisclosure: z.string().min(1).max(1000).default("No known conflict under local MVP juror rules."),
  resolution: z.string().min(1).default("Demo curator ruling on result integrity.")
});

export const FinalizeResultRequestSchema = z.object({
  curator: z.string().min(1).default("demo-curator")
});

export const ArchiveQuestionRequestSchema = z.object({
  curator: z.string().min(1).default("demo-curator")
});

export const AmendmentRequestSchema = z.object({
  body: z.string().min(1),
  proposer: z.string().default("demo-proposer")
});

export const DemoResidentCredentialRequestSchema = z.object({
  holderAlias: z.string().min(1).default("demo-resident"),
  schemaId: z.string().min(1).default("credential-vancouver-resident"),
  issuerId: z.string().min(1).default("issuer-demo-resident")
});

export const WalletCredentialSchema = z.object({
  protocol: z.literal("popular-consensus"),
  schemaVersion: z.literal("wallet-credential-v0"),
  credentialId: z.string().min(1),
  holderAlias: z.string().min(1),
  schemaId: z.string().min(1),
  issuerId: z.string().min(1),
  secret: z.string().min(1),
  issuedAt: z.union([z.number().int(), z.string().datetime(), z.date()])
});

export const ExportWalletCredentialRequestSchema = z.object({
  credentialSecret: z.string().min(1)
});

export const ImportWalletCredentialRequestSchema = z.object({
  credential: WalletCredentialSchema
});

export const CredentialMembershipProofSchema = z.object({
  protocol: z.literal("popular-consensus"),
  schemaVersion: z.literal("credential-membership-nullifier-proof-v0"),
  credentialId: z.string().min(1),
  schemaId: z.string().min(1),
  issuerId: z.string().min(1),
  pollId: z.string().min(1),
  nullifier: z.string().min(1),
  credentialCommitment: z.string().min(1),
  proofHash: z.string().min(1)
});

export const CredentialProofRequestSchema = z.object({
  credentialId: z.string(),
  credentialSecret: z.string(),
  membershipProof: CredentialMembershipProofSchema.optional()
});

export const EncryptedBallotPayloadSchema = z.object({
  version: z.literal("pc-encrypted-ballot-v1"),
  ephemeralPublicKeyPem: z.string().min(1),
  iv: z.string().min(1),
  authTag: z.string().min(1),
  ciphertext: z.string().min(1)
});

export const AnonymousBallotProofSchema = z.object({
  protocol: z.literal("popular-consensus"),
  schemaVersion: z.literal("anonymous-ballot-proof-v1"),
  proofSystem: z.literal("SemaphoreV4"),
  groupId: z.string().min(1),
  groupRoot: z.string().min(1),
  signal: z.string().min(1),
  scope: z.string().min(1),
  nullifier: z.string().min(1),
  proof: z.record(z.string(), z.unknown())
});

export const DemoVoteRequestSchema = CredentialProofRequestSchema.extend({
  proofMode: z.literal("DemoCredential").optional(),
  choice: z.string().optional(),
  response: BallotResponseSchema.optional(),
  representedCommunityId: z.string().min(1).optional()
}).refine((value) => value.choice || value.response, "A ballot response is required");

export const AnonymousVoteRequestSchema = z.object({
  proofMode: z.literal("AnonymousZk"),
  encryptedPayload: EncryptedBallotPayloadSchema,
  ballotCommitment: z.string().min(1),
  anonymousProof: AnonymousBallotProofSchema,
  rewardReceiptHash: z.string().min(1),
  representedCommunityId: z.string().min(1).optional()
});

export const VoteRequestSchema = z.union([DemoVoteRequestSchema, AnonymousVoteRequestSchema]);

export const RegisterAnonymousEligibilityGroupRequestSchema = z.object({
  groupId: z.string().min(1),
  credentialSchemaId: z.string().min(1),
  issuerId: z.string().min(1),
  communityId: z.string().min(1).nullable().optional(),
  groupRoot: z.string().min(1),
  commitmentCount: z.number().int().nonnegative(),
  stewardId: z.string().min(1)
});

export const RedeemParticipationReceiptRequestSchema = z.object({
  pollId: z.string().min(1),
  receiptSecret: z.string().min(32),
  destinationAccount: z.string().min(1)
});

export const GovernanceParameterInputSchema = z.object({
  proposalBondPc: z.number().int().nonnegative().default(100),
  challengeBondPc: z.number().int().nonnegative().default(50),
  appealBondPc: z.number().int().nonnegative().default(50),
  protocolFeePc: z.number().int().nonnegative().default(5),
  successfulChallengeRewardPc: z.number().int().nonnegative().default(45),
  failedChallengeProposerRewardPc: z.number().int().nonnegative().default(20),
  jurorRewardWeight: z.number().int().default(2),
  successfulChallengeReputation: z.number().int().default(5),
  acceptedAmendmentReputation: z.number().int().default(2),
  privacyThreshold: z.number().int().nonnegative().default(1),
  challengeWindowHours: z.number().int().positive().default(1),
  resultChallengeWindowHours: z.number().int().positive().default(25),
  pollDurationHours: z.number().int().positive().default(24),
  reputationDecayRule: z.string().min(1).max(120).default("none-in-mvp")
});

export const ProposeGovernanceParametersRequestSchema = GovernanceParameterInputSchema.extend({
  steward: z.string().min(1).default("demo-curator"),
  rationale: z.string().min(1).max(1000).default("Community governance parameter update.")
});

export const ActivateGovernanceParametersRequestSchema = z.object({
  steward: z.string().min(1).default("demo-curator"),
  activationRecord: z.string().min(1).max(1000).default("Community steward activated governance parameters under local MVP rules."),
  effectiveAt: z.number().int().optional()
});

export const ProposeDataUnionPolicyRequestSchema = z.object({
  steward: z.string().min(1).default("demo-curator"),
  title: z.string().min(1).max(140).default("Community aggregate data-union policy"),
  purpose: z
    .string()
    .min(1)
    .max(1200)
    .default("Allow the community to publish opt-in, privacy-safe aggregate result products under transparent audit and revenue rules."),
  allowedProductTypes: z.array(DataUnionProductTypeSchema).min(1).default(["AggregateResultDataset"]),
  minimumCohortSize: z.number().int().positive().default(25),
  consentRevocationRule: z
    .string()
    .min(1)
    .max(1000)
    .default("A member can revoke future commercial aggregate participation; already published aggregate products remain in the audit log."),
  dataRetentionDays: z.number().int().positive().default(365),
  revenueSplit: DataUnionRevenueSplitSchema.default({
    communityTreasuryPercent: 70,
    participantPoolPercent: 20,
    operatorPoolPercent: 10
  })
});

export const ActivateDataUnionPolicyRequestSchema = z.object({
  steward: z.string().min(1).default("demo-curator"),
  activationRecord: z.string().min(1).max(1000).default("Community steward activated the data-union policy under local MVP rules."),
  effectiveAt: z.number().int().optional()
});

export const RecordDataUnionConsentRequestSchema = z.object({
  userId: z.string().min(1),
  policyId: z.string().min(1).optional(),
  scope: DataUnionConsentScopeSchema.default("AggregateAnalytics"),
  consentStatement: z
    .string()
    .min(1)
    .max(1000)
    .default("I opt in to privacy-safe aggregate data products governed by this community data-union policy.")
});

export const RevokeDataUnionConsentRequestSchema = z.object({
  userId: z.string().min(1),
  revocationReason: z.string().min(1).max(1000).default("Member revoked future data-union participation.")
});

export const PublishDataUnionProductRequestSchema = z.object({
  steward: z.string().min(1).default("demo-curator"),
  policyId: z.string().min(1).optional(),
  resultId: z.string().min(1),
  productType: DataUnionProductTypeSchema.default("AggregateResultDataset"),
  title: z.string().min(1).max(140),
  description: z.string().min(1).max(1200),
  methodology: z.string().min(1).max(2000).default("Privacy-safe aggregate result product derived from published tally artifacts."),
  privacyNotes: z
    .string()
    .min(1)
    .max(2000)
    .default("No identifiable responses or raw encrypted payloads are included. Product publication requires active consent count and result turnout to meet the policy cohort threshold."),
  pricePc: z.number().int().nonnegative().default(0)
});

export const GrantDataUnionAccessRequestSchema = z.object({
  steward: z.string().min(1).default("demo-curator"),
  buyerId: z.string().min(1),
  buyerType: DataUnionBuyerTypeSchema.default("ApprovedCustomer"),
  accessPurpose: z.string().min(1).max(1000),
  license: z
    .string()
    .min(1)
    .max(2000)
    .default("Access is limited to the named aggregate product and must not be used to identify respondents or reconstruct individual responses."),
  paymentPc: z.number().int().nonnegative().optional()
});

export const CreateCommunityEmergencySuspensionRequestSchema = z.object({
  steward: z.string().min(1).default("demo-curator"),
  scope: CommunityEmergencySuspensionScopeSchema.default("ProtocolActions"),
  reason: z.string().min(1).max(1000).default("Emergency pause for community protocol actions pending steward review.")
});

export const ResolveCommunityEmergencySuspensionRequestSchema = z.object({
  steward: z.string().min(1).default("demo-curator"),
  resolution: z.string().min(1).max(1000).default("Emergency pause resolved and normal protocol actions restored.")
});

export const ProposeAdoptionPolicyRequestSchema = z
  .object({
    steward: z.string().min(1).default("demo-curator"),
    authorityLevel: AuthorityLevelSchema.default("Advisory"),
    eligibleQuestionTypes: z.array(z.string().min(1)).min(1).default(["transit"]),
    credentialSchemaIds: z.array(z.string().min(1)).min(1).default(["credential-vancouver-resident"]),
    quorumRule: z.string().min(1).default("No quorum for local MVP advisory process."),
    approvalRule: z.string().min(1).default("Community steward activation under local MVP rules."),
    legalHandoff: z.string().min(1).optional(),
    forkRule: z.string().min(1).default("Community may fork metadata and archive references.")
  })
  .superRefine((value, ctx) => {
    if (value.authorityLevel === "Binding" && !value.legalHandoff) {
      ctx.addIssue({
        code: "custom",
        path: ["legalHandoff"],
        message: "Binding adoption policies require explicit legal handoff metadata."
      });
    }
  });

export const ActivateAdoptionPolicyRequestSchema = z.object({
  steward: z.string().min(1).default("demo-curator"),
  adoptionRecord: z.string().min(1).default("Community steward accepted the policy under existing local MVP rules."),
  effectiveAt: z.number().int().optional()
});

export const SuspendAdoptionPolicyRequestSchema = z.object({
  steward: z.string().min(1).default("demo-curator"),
  reason: z.string().min(1).default("Community steward suspended policy authority pending review.")
});

export type QuestionSpec = z.infer<typeof QuestionSpecSchema>;
export type CredentialSchema = z.infer<typeof CredentialSchemaSchema>;
export type CredentialIssuer = z.infer<typeof CredentialIssuerSchema>;
export type CredentialIssuerAnnotation = z.infer<typeof CredentialIssuerAnnotationSchema>;
export type CredentialRevocationRoot = z.infer<typeof CredentialRevocationRootSchema>;
export type CommunityCredentialTrustPolicy = z.infer<typeof CommunityCredentialTrustPolicySchema>;
export type WalletCredential = z.infer<typeof WalletCredentialSchema>;
export type CredentialMembershipProof = z.infer<typeof CredentialMembershipProofSchema>;
export type AnonymousBallotProof = z.infer<typeof AnonymousBallotProofSchema>;
export type AnonymousVoteRequest = z.infer<typeof AnonymousVoteRequestSchema>;
export type DemoVoteRequest = z.infer<typeof DemoVoteRequestSchema>;
export type ProposalBond = z.infer<typeof ProposalBondSchema>;
export type TreasuryLedgerEntry = z.infer<typeof TreasuryLedgerEntrySchema>;
export type TreasuryLedgerTotals = z.infer<typeof TreasuryLedgerTotalsSchema>;
export type DataUnionRevenueSplit = z.infer<typeof DataUnionRevenueSplitSchema>;
export type DataUnionPolicy = z.infer<typeof DataUnionPolicySchema>;
export type DataUnionConsent = z.infer<typeof DataUnionConsentSchema>;
export type DataUnionProduct = z.infer<typeof DataUnionProductSchema>;
export type DataUnionAccessGrant = z.infer<typeof DataUnionAccessGrantSchema>;
export type Challenge = z.infer<typeof ChallengeSchema>;
export type ChallengeRuling = z.infer<typeof ChallengeRulingSchema>;
export type ChallengeAppeal = z.infer<typeof ChallengeAppealSchema>;
export type ChallengeAppealTargetType = z.infer<typeof ChallengeAppealTargetTypeSchema>;
export type ChallengeAppealStatus = z.infer<typeof ChallengeAppealStatusSchema>;
export type JurorTargetType = z.infer<typeof JurorTargetTypeSchema>;
export type JurorConflictStatus = z.infer<typeof JurorConflictStatusSchema>;
export type JurorAssignmentStatus = z.infer<typeof JurorAssignmentStatusSchema>;
export type JurorAssignment = z.infer<typeof JurorAssignmentSchema>;
export type EncryptedBallot = z.infer<typeof EncryptedBallotSchema>;
export type NullifierRecord = z.infer<typeof NullifierRecordSchema>;
export type TallyConfig = z.infer<typeof TallyConfigSchema>;
export type TallyCommittee = z.infer<typeof TallyCommitteeSchema>;
export type TallyKeySetup = z.infer<typeof TallyKeySetupSchema>;
export type TallyDecryptionShare = z.infer<typeof TallyDecryptionShareSchema>;
export type TallyResult = z.infer<typeof TallyResultSchema>;
export type ResultChallenge = z.infer<typeof ResultChallengeSchema>;
export type CommunityAdoptionPolicy = z.infer<typeof CommunityAdoptionPolicySchema>;
export type RegistryEvent = z.infer<typeof RegistryEventSchema>;
export type ReputationEvent = z.infer<typeof ReputationEventSchema>;
export type UserAccount = z.infer<typeof UserAccountSchema>;
export type Community = z.infer<typeof CommunitySchema>;
export type CommunityMember = z.infer<typeof CommunityMemberSchema>;
export type CommunityMembershipSource = z.infer<typeof CommunityMembershipSourceSchema>;
export type CommunityRegistryPolicy = z.infer<typeof CommunityRegistryPolicySchema>;
export type CommunityChildProposalRecord = z.infer<typeof CommunityChildProposalRecordSchema>;
export type CommunityChildProposalVoteRecord = z.infer<typeof CommunityChildProposalVoteRecordSchema>;
export type CommunityFollow = z.infer<typeof CommunityFollowSchema>;
export type TopicFollow = z.infer<typeof TopicFollowSchema>;
export type CommunityFork = z.infer<typeof CommunityForkSchema>;
export type CommunityFrontendConfig = z.infer<typeof CommunityFrontendConfigSchema>;
export type StewardPower = z.infer<typeof StewardPowerSchema>;
export type CommunityEmergencySuspension = z.infer<typeof CommunityEmergencySuspensionSchema>;
export type GovernanceParameterSet = z.infer<typeof GovernanceParameterSetSchema>;
export type GovernanceParameterStatus = z.infer<typeof GovernanceParameterStatusSchema>;
export type DiscussionPostKind = z.infer<typeof DiscussionPostKindSchema>;
export type DiscussionViewKey = z.infer<typeof DiscussionViewKeySchema>;
export type DiscussionPost = z.infer<typeof DiscussionPostSchema>;
export type DiscussionModerationAction = z.infer<typeof DiscussionModerationActionSchema>;
export type DiscussionModerationRecord = z.infer<typeof DiscussionModerationRecordSchema>;
export type DiscussionModerationAppeal = z.infer<typeof DiscussionModerationAppealSchema>;
export type ArchiveRecord = z.infer<typeof ArchiveRecordSchema>;
export type FollowCommunityRequest = z.infer<typeof FollowCommunityRequestSchema>;
export type FollowTopicRequest = z.infer<typeof FollowTopicRequestSchema>;
export type SetCommunityRegistryPolicyRequest = z.infer<typeof SetCommunityRegistryPolicyRequestSchema>;
export type ResolveCommunityChildProposalRequest = z.infer<typeof ResolveCommunityChildProposalRequestSchema>;
export type VoteCommunityChildProposalRequest = z.infer<typeof VoteCommunityChildProposalRequestSchema>;
export type ReputationReplayRequest = z.infer<typeof ReputationReplayRequestSchema>;
export type CreateCommunityForkRequest = z.infer<typeof CreateCommunityForkRequestSchema>;
export type CommunityImportReplayRequest = z.infer<typeof CommunityImportReplayRequestSchema>;
export type SetCommunityFrontendConfigRequest = z.infer<typeof SetCommunityFrontendConfigRequestSchema>;
export type ProposeGovernanceParametersRequest = z.infer<typeof ProposeGovernanceParametersRequestSchema>;
export type ActivateGovernanceParametersRequest = z.infer<typeof ActivateGovernanceParametersRequestSchema>;
export type CreateCommunityEmergencySuspensionRequest = z.infer<typeof CreateCommunityEmergencySuspensionRequestSchema>;
export type ResolveCommunityEmergencySuspensionRequest = z.infer<typeof ResolveCommunityEmergencySuspensionRequestSchema>;
export type CreateCredentialSchemaRequest = z.infer<typeof CreateCredentialSchemaRequestSchema>;
export type CreateCredentialIssuerRequest = z.infer<typeof CreateCredentialIssuerRequestSchema>;
export type SuspendCredentialIssuerRequest = z.infer<typeof SuspendCredentialIssuerRequestSchema>;
export type RevokeCredentialRequest = z.infer<typeof RevokeCredentialRequestSchema>;
export type SetCommunityCredentialTrustPolicyRequest = z.infer<typeof SetCommunityCredentialTrustPolicyRequestSchema>;
export type CreateTallyCommitteeRequest = z.infer<typeof CreateTallyCommitteeRequestSchema>;
export type ActivateTallyCommitteeRequest = z.infer<typeof ActivateTallyCommitteeRequestSchema>;
export type FailTallyCommitteeRequest = z.infer<typeof FailTallyCommitteeRequestSchema>;
export type SetupTallyPublicKeyRequest = z.infer<typeof SetupTallyPublicKeyRequestSchema>;
export type SubmitTallyDecryptionShareRequest = z.infer<typeof SubmitTallyDecryptionShareRequestSchema>;
export type ExportWalletCredentialRequest = z.infer<typeof ExportWalletCredentialRequestSchema>;
export type ImportWalletCredentialRequest = z.infer<typeof ImportWalletCredentialRequestSchema>;
export type SelectJurorRequest = z.infer<typeof SelectJurorRequestSchema>;
export type DiscloseJurorConflictRequest = z.infer<typeof DiscloseJurorConflictRequestSchema>;
export type CreateChallengeAppealRequest = z.infer<typeof CreateChallengeAppealRequestSchema>;
export type ResolveChallengeAppealRequest = z.infer<typeof ResolveChallengeAppealRequestSchema>;
export type CreateDiscussionPostRequest = z.infer<typeof CreateDiscussionPostRequestSchema>;
export type ModerateDiscussionPostRequest = z.infer<typeof ModerateDiscussionPostRequestSchema>;
export type CreateModerationAppealRequest = z.infer<typeof CreateModerationAppealRequestSchema>;
export type ResolveModerationAppealRequest = z.infer<typeof ResolveModerationAppealRequestSchema>;
export type CreateResultChallengeRequest = z.infer<typeof CreateResultChallengeRequestSchema>;
export type ResultChallengeRulingRequest = z.infer<typeof ResultChallengeRulingRequestSchema>;
export type FinalizeResultRequest = z.infer<typeof FinalizeResultRequestSchema>;
export type ArchiveQuestionRequest = z.infer<typeof ArchiveQuestionRequestSchema>;
export type ProposeAdoptionPolicyRequest = z.infer<typeof ProposeAdoptionPolicyRequestSchema>;
export type ActivateAdoptionPolicyRequest = z.infer<typeof ActivateAdoptionPolicyRequestSchema>;
export type SuspendAdoptionPolicyRequest = z.infer<typeof SuspendAdoptionPolicyRequestSchema>;
