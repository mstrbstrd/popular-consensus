import { describe, expect, it } from "vitest";
import { BuiltInAnswerSchemas, getAnswerSchema, type BallotResponse } from "@pc/shared";
import {
  ballotCommitment,
  createCoordinatorKeypair,
  decryptBallot,
  deriveNullifier,
  encryptBallot,
  issueDemoCredential,
  tallyEncryptedBallots,
  verifyDemoCredential
} from "./index";

const privacyCases: Array<{
  schemaId: string;
  response: BallotResponse;
  expectedAggregate: Record<string, unknown>;
  rawTextNotPublished?: string;
}> = [
  {
    schemaId: "answer-binary-support-oppose",
    response: { type: "single_choice", choice: "support" },
    expectedAggregate: { counts: { support: 1, oppose: 0, abstain: 0 } }
  },
  {
    schemaId: "answer-yes-no",
    response: { type: "single_choice", choice: "yes" },
    expectedAggregate: { counts: { yes: 1, no: 0, abstain: 0 } }
  },
  {
    schemaId: "answer-true-false",
    response: { type: "single_choice", choice: "true" },
    expectedAggregate: { counts: { true: 1, false: 0, abstain: 0 } }
  },
  {
    schemaId: "answer-single-choice-civic-priority",
    response: { type: "single_choice", choice: "frequency" },
    expectedAggregate: { counts: { frequency: 1 } }
  },
  {
    schemaId: "answer-approval-civic-priorities",
    response: { type: "multiple_choice", choices: ["safety", "service"] },
    expectedAggregate: { counts: { safety: 1, service: 1 } }
  },
  {
    schemaId: "answer-ranked-policy-options",
    response: { type: "ranked_choice", ranking: ["limited", "full", "no-change"] },
    expectedAggregate: { firstChoiceCounts: { limited: 1 }, bordaScores: { limited: 3, full: 2, "no-change": 1 } }
  },
  {
    schemaId: "answer-likert-agreement-5",
    response: { type: "scale", value: 4 },
    expectedAggregate: { distribution: { "4": 1 }, average: 4 }
  },
  {
    schemaId: "answer-score-0-10",
    response: { type: "scale", value: 8 },
    expectedAggregate: { distribution: { "8": 1 }, average: 8 }
  },
  {
    schemaId: "answer-budget-allocation-100",
    response: { type: "budget_allocation", allocations: { maintenance: 40, expansion: 30, safety: 20, reserves: 10 } },
    expectedAggregate: { totals: { maintenance: 40, expansion: 30, safety: 20, reserves: 10 } }
  },
  {
    schemaId: "answer-numeric-estimate",
    response: { type: "numeric", value: 42 },
    expectedAggregate: { count: 1, min: 42, max: 42, average: 42 }
  },
  {
    schemaId: "answer-short-text",
    response: { type: "free_text", text: "Fill potholes" },
    expectedAggregate: { responseCount: 1 },
    rawTextNotPublished: "Fill potholes"
  },
  {
    schemaId: "answer-long-text",
    response: { type: "free_text", text: "Add shelters and lighting at every high-use stop." },
    expectedAggregate: { responseCount: 1 },
    rawTextNotPublished: "Add shelters and lighting"
  }
];

describe("MACI-derived privacy helpers", () => {
  it("encrypts ballots, derives duplicate-resistant nullifiers, and tallies aggregates", () => {
    const coordinator = createCoordinatorKeypair();
    const credential = issueDemoCredential("demo-resident", "resident-vancouver", "issuer-demo");
    const nullifier = deriveNullifier(credential.secret, "poll-1", credential.schemaId);
    const payload = encryptBallot("support", coordinator.publicKeyPem);

    expect(verifyDemoCredential(credential.secret, credential.secretHash)).toBe(true);
    expect(nullifier).toEqual(deriveNullifier(credential.secret, "poll-1", credential.schemaId));
    expect(ballotCommitment(payload, nullifier)).toContain("sha256:");

    const tally = tallyEncryptedBallots([payload], coordinator.privateKeyPem, getAnswerSchema("answer-binary-support-oppose"));
    expect(tally.counts.support).toBe(1);
    expect(tally.turnout).toBe(1);
    expect(tally.proofReference).toContain("sha256:");
  });

  it("encrypts and tallies schema-driven approval ballots", () => {
    const coordinator = createCoordinatorKeypair();
    const schema = getAnswerSchema("answer-approval-civic-priorities");
    const payload = encryptBallot({ type: "multiple_choice", choices: ["safety", "service"] }, coordinator.publicKeyPem);
    const tally = tallyEncryptedBallots([payload], coordinator.privateKeyPem, schema);

    expect(tally.aggregate).toMatchObject({
      answerSchemaId: "answer-approval-civic-priorities",
      counts: { safety: 1, service: 1 },
      turnout: 1
    });
  });

  it("has privacy coverage for every built-in answer schema", () => {
    expect(privacyCases.map((testCase) => testCase.schemaId)).toEqual(BuiltInAnswerSchemas.map((schema) => schema.answerSchemaId));
  });

  it.each(privacyCases)("encrypts, decrypts, validates, and tallies $schemaId ballots", ({ schemaId, response, expectedAggregate, rawTextNotPublished }) => {
    const coordinator = createCoordinatorKeypair();
    const schema = getAnswerSchema(schemaId);
    const payload = encryptBallot(response, coordinator.publicKeyPem);
    const decrypted = decryptBallot(payload, coordinator.privateKeyPem);
    const tally = tallyEncryptedBallots([payload], coordinator.privateKeyPem, schema);

    expect(decrypted).toMatchObject(response);
    expect(tally.invalidBallots).toBe(0);
    expect(tally.aggregate).toMatchObject({
      answerSchemaId: schemaId,
      turnout: 1,
      ...expectedAggregate
    });
    expect(tally.proofReference).toContain("sha256:");
    if (rawTextNotPublished) expect(JSON.stringify(tally.aggregate)).not.toContain(rawTextNotPublished);
  });

  it("counts schema-invalid encrypted ballots without adding them to turnout", () => {
    const coordinator = createCoordinatorKeypair();
    const payload = encryptBallot({ type: "single_choice", choice: "not-valid" }, coordinator.publicKeyPem);
    const tally = tallyEncryptedBallots([payload], coordinator.privateKeyPem, getAnswerSchema("answer-binary-support-oppose"));

    expect(tally.invalidBallots).toBe(1);
    expect(tally.turnout).toBe(0);
    expect(tally.aggregate).toMatchObject({ counts: { support: 0, oppose: 0, abstain: 0 } });
  });
});
