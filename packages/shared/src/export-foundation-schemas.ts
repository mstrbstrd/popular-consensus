import { z } from "zod";
import {
  CreateQuestionIntentSchema,
  ContributionPolicyVersionSchema,
  PrivacyProfileDraftSchema,
  RewardPolicyVersionSchema,
  RequestAggregateUseIntentSchema
} from "./foundation";

// Structural interchange only: JSON Schema cannot express the cross-field time
// comparison or establish authorization, consent, funding, or cryptographic truth.
const schemas = {
  CreateQuestionIntent: CreateQuestionIntentSchema,
  ContributionPolicyVersion: ContributionPolicyVersionSchema,
  PrivacyProfileDraft: PrivacyProfileDraftSchema,
  RewardPolicyVersion: RewardPolicyVersionSchema,
  RequestAggregateUseIntent: RequestAggregateUseIntentSchema
};
console.log(JSON.stringify({
  schemaVersion: "foundation-schema-bundle-v0.2-draft",
  status: "DraftNotIntegrated",
  validationScope: "StructuralOnly",
  semanticRules: {
    CreateQuestionIntent: ["closesAt must be strictly after opensAt"]
  },
  schemas: Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [
    name, z.toJSONSchema(schema, { target: "draft-2020-12" })
  ]))
}, null, 2));
