import { describe, expect, it } from "vitest";
import {
  BuiltInAnswerSchemas,
  CanonicalProtocolBoundary,
  CanonicalProtocolBoundarySchema,
  CreateCommunityRequestSchema,
  MinimumProtocolCommitments,
  ProtocolCommitmentSchema,
  ProposeAdoptionPolicyRequestSchema,
  CreateUserRequestSchema,
  PublicApiV0ResponseSchemas,
  QuestionSpecSchema,
  getAnswerSchema,
  tallyBallotResponses,
  validateBallotResponse,
  type BallotResponse
} from "./index";

const formatCases: Array<{
  schemaId: string;
  validResponses: BallotResponse[];
  invalidResponse: BallotResponse;
  expectedAggregate: Record<string, unknown>;
  rawTextNotPublished?: string;
}> = [
  {
    schemaId: "answer-binary-support-oppose",
    validResponses: [{ type: "single_choice", choice: "support" }],
    invalidResponse: { type: "single_choice", choice: "invalid-option" },
    expectedAggregate: { counts: { support: 1, oppose: 0, abstain: 0 } }
  },
  {
    schemaId: "answer-yes-no",
    validResponses: [{ type: "single_choice", choice: "yes" }],
    invalidResponse: { type: "single_choice", choice: "support" },
    expectedAggregate: { counts: { yes: 1, no: 0, abstain: 0 } }
  },
  {
    schemaId: "answer-true-false",
    validResponses: [{ type: "single_choice", choice: "true" }],
    invalidResponse: { type: "single_choice", choice: "yes" },
    expectedAggregate: { counts: { true: 1, false: 0, abstain: 0 } }
  },
  {
    schemaId: "answer-single-choice-civic-priority",
    validResponses: [{ type: "single_choice", choice: "frequency" }],
    invalidResponse: { type: "single_choice", choice: "service" },
    expectedAggregate: {
      counts: { safety: 0, accessibility: 0, affordability: 0, frequency: 1, abstain: 0 }
    }
  },
  {
    schemaId: "answer-approval-civic-priorities",
    validResponses: [{ type: "multiple_choice", choices: ["safety", "service"] }],
    invalidResponse: { type: "multiple_choice", choices: ["not-a-priority"] },
    expectedAggregate: { counts: { safety: 1, service: 1, affordability: 0, accessibility: 0 } }
  },
  {
    schemaId: "answer-ranked-policy-options",
    validResponses: [{ type: "ranked_choice", ranking: ["limited", "full", "no-change"] }],
    invalidResponse: { type: "ranked_choice", ranking: ["pilot", "pilot"] },
    expectedAggregate: {
      firstChoiceCounts: { pilot: 0, limited: 1, full: 0, "no-change": 0 },
      bordaScores: { pilot: 0, limited: 3, full: 2, "no-change": 1 }
    }
  },
  {
    schemaId: "answer-likert-agreement-5",
    validResponses: [{ type: "scale", value: 4 }],
    invalidResponse: { type: "scale", value: 6 },
    expectedAggregate: { distribution: { "1": 0, "2": 0, "3": 0, "4": 1, "5": 0 }, average: 4 }
  },
  {
    schemaId: "answer-score-0-10",
    validResponses: [{ type: "scale", value: 8 }],
    invalidResponse: { type: "scale", value: 11 },
    expectedAggregate: { distribution: { "8": 1 }, average: 8 }
  },
  {
    schemaId: "answer-budget-allocation-100",
    validResponses: [
      {
        type: "budget_allocation",
        allocations: { maintenance: 40, expansion: 30, safety: 20, reserves: 10 }
      }
    ],
    invalidResponse: {
      type: "budget_allocation",
      allocations: { maintenance: 40, expansion: 30, safety: 20, reserves: 0 }
    },
    expectedAggregate: {
      totals: { maintenance: 40, expansion: 30, safety: 20, reserves: 10 },
      averages: { maintenance: 40, expansion: 30, safety: 20, reserves: 10 }
    }
  },
  {
    schemaId: "answer-numeric-estimate",
    validResponses: [{ type: "numeric", value: 42 }],
    invalidResponse: { type: "numeric", value: -1 },
    expectedAggregate: { count: 1, min: 42, max: 42, average: 42 }
  },
  {
    schemaId: "answer-short-text",
    validResponses: [{ type: "free_text", text: "Fill potholes" }],
    invalidResponse: { type: "free_text", text: "   " },
    expectedAggregate: { responseCount: 1 },
    rawTextNotPublished: "Fill potholes"
  },
  {
    schemaId: "answer-long-text",
    validResponses: [{ type: "free_text", text: "Add shelters and lighting at every high-use stop." }],
    invalidResponse: { type: "free_text", text: "" },
    expectedAggregate: { responseCount: 1 },
    rawTextNotPublished: "Add shelters and lighting"
  }
];

describe("QuestionSpecSchema", () => {
  it("defaults authority to an explicit advisory-compatible value", () => {
    const parsed = QuestionSpecSchema.parse({
      questionId: "q1",
      version: 1,
      title: "Transit pilot?",
      bodyHash: "h1",
      answerSchemaId: "binary",
      credentialSchemaId: "resident",
      communityId: "vancouver",
      topicIds: ["transportation"],
      geoScope: "Vancouver",
      sponsorDisclosureHash: "s1",
      methodologyLabel: "Verified city resident response, self-selected sample",
      authorityLevel: "Advisory",
      opensAt: 1,
      closesAt: 2,
      challengeWindowEndsAt: 1,
      proposer: "demo-proposer",
      proposalBondId: "b1",
      currentStatus: "Submitted"
    });

    expect(parsed.authorityLevel).toBe("Advisory");
  });
});

describe("adoption policy request schemas", () => {
  it("keeps policy proposals advisory by default", () => {
    const parsed = ProposeAdoptionPolicyRequestSchema.parse({});

    expect(parsed.authorityLevel).toBe("Advisory");
  });

  it("requires legal handoff metadata before binding authority can be proposed", () => {
    expect(() =>
      ProposeAdoptionPolicyRequestSchema.parse({
        authorityLevel: "Binding",
        quorumRule: "Two-thirds member quorum.",
        approvalRule: "Majority approval after board notice.",
        forkRule: "Members may fork records under cooperative bylaws."
      })
    ).toThrow("Binding adoption policies require explicit legal handoff metadata.");
  });
});

describe("answer schemas", () => {
  it("defines common civic poll formats as typed schemas", () => {
    expect(BuiltInAnswerSchemas.map((schema) => schema.answerSchemaId)).toEqual([
      "answer-binary-support-oppose",
      "answer-yes-no",
      "answer-true-false",
      "answer-single-choice-civic-priority",
      "answer-approval-civic-priorities",
      "answer-ranked-policy-options",
      "answer-likert-agreement-5",
      "answer-score-0-10",
      "answer-budget-allocation-100",
      "answer-numeric-estimate",
      "answer-short-text",
      "answer-long-text"
    ]);
    expect(BuiltInAnswerSchemas.map((schema) => schema.kind)).toEqual(
      expect.arrayContaining([
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
      ])
    );
  });

  it.each(formatCases)("validates and tallies $schemaId responses", ({ schemaId, validResponses, expectedAggregate, rawTextNotPublished }) => {
    const schema = getAnswerSchema(schemaId);
    const validated = validResponses.map((response) => validateBallotResponse(schema, response));
    const aggregate = tallyBallotResponses(schema, validated);

    expect(aggregate).toMatchObject({
      answerSchemaId: schemaId,
      turnout: validResponses.length,
      ...expectedAggregate
    });
    if (rawTextNotPublished) expect(JSON.stringify(aggregate)).not.toContain(rawTextNotPublished);
  });

  it.each(formatCases)("rejects invalid $schemaId responses", ({ schemaId, invalidResponse }) => {
    const schema = getAnswerSchema(schemaId);

    expect(() => validateBallotResponse(schema, invalidResponse)).toThrow();
  });
});

describe("public API v0 response contracts", () => {
  it("exports versioned contracts for indexer/client responses", () => {
    expect(Object.keys(PublicApiV0ResponseSchemas)).toEqual([
      "appchainBoundary",
      "publicTestnetReadiness",
      "communities",
      "civicRecord",
      "challengeAppeals",
      "jurorAssignments",
      "governanceParameters",
      "treasuryLedger",
      "dataUnion",
      "stewardPowers",
      "upgradeSafety",
      "credentialTrustPolicies",
      "tallyCommittees",
      "tallyKeySetups",
      "tallyDecryptionShares",
      "questionDiscussion",
      "questionModeration",
      "profileRecord",
      "discovery",
      "reputationEvents",
      "reputationExport",
      "reputationReplay",
      "archiveExport",
      "communityExport",
      "communityImportReplay",
      "registryEvents",
      "protocolTransactions",
      "protocolIndexerReplay",
      "archives",
      "resultArtifacts",
      "replayCheck",
      "minimumCommitments",
      "commitments",
      "artifactRead"
    ]);

    PublicApiV0ResponseSchemas.appchainBoundary.parse(CanonicalProtocolBoundary);

    const page = { limit: 1, cursor: "0", nextCursor: null, total: 0, hasMore: false };
    PublicApiV0ResponseSchemas.publicTestnetReadiness.parse({
      protocol: {
        protocol: "popular-consensus",
        schemaVersion: "public-testnet-readiness-v0",
        ids: {},
        hashes: {},
        statuses: {},
        authority: {}
      },
      status: "PendingExternalOperators",
      operatorRequirements: [{ role: "replay-verifier", minimumCount: 3, responsibility: "Replay the public feed." }],
      requiredCommands: ["pnpm typecheck"],
      requiredEndpoints: ["GET /registry/protocol-transactions/replay"],
      governanceDrills: ["Export and replay a community bundle."],
      attestationTemplate: {
        protocol: "popular-consensus",
        schemaVersion: "public-testnet-operator-attestation-v0",
        operatorId: "<operator>",
        operatorContact: "<operator-contact>",
        operatorOrganization: "<operator-organization>",
        independenceStatement: "Independent public testnet operator evidence statement.",
        operatorRole: "replay-verifier",
        gitCommit: "<commit>",
        chainId: "<chain-id>",
        rpcUrl: "<rpc-url>",
        apiBaseUrl: null,
        deploymentHash: null,
        transactionStreamHash: "<transaction-stream-hash>",
        eventStreamHash: "<event-stream-hash>",
        upgradeSafetyModelHash: "<upgrade-safety-model-hash>",
        checks: { protocolIndexerReplay: "Verified" },
        observations: [],
        attestedAt: "2026-05-08T00:00:00.000Z"
      },
      completionGates: [{ id: "matching-replay-hashes", label: "Matching replay hashes", status: "PendingExternalOperators", requirement: "Three verifiers match.", evidence: [] }],
      knownLimitations: ["External attestations are still required."]
    });

    PublicApiV0ResponseSchemas.communities.parse({
      protocol: {
        protocol: "popular-consensus",
        schemaVersion: "communities-index-v0",
        page,
        ids: {},
        hashes: {},
        statuses: {},
        authority: {}
      },
      page,
      communities: []
    });

    PublicApiV0ResponseSchemas.protocolTransactions.parse({
      protocol: {
        protocol: "popular-consensus",
        schemaVersion: "protocol-transactions-v0",
        page,
        ids: {},
        hashes: {},
        statuses: {},
        authority: {}
      },
      page,
      transactions: []
    });

    PublicApiV0ResponseSchemas.protocolIndexerReplay.parse({
      protocol: {
        protocol: "popular-consensus",
        schemaVersion: "protocol-indexer-replay-v0",
        ids: {},
        hashes: {},
        statuses: {},
        authority: {}
      },
      status: "Verified",
      readOnly: true,
      rebuilt: {
        source: "protocol-transactions",
        readOnly: true,
        transactionCount: 0,
        eventCount: 0,
        subjectCount: 0,
        moduleCount: 0,
        transactionStreamHash: "sha256:empty",
        eventStreamHash: "sha256:empty",
        latestResultHash: null,
        latestEventHash: null,
        modules: [],
        subjects: []
      },
      transactions: [],
      events: [],
      checks: []
    });

    PublicApiV0ResponseSchemas.upgradeSafety.parse({
      protocol: {
        protocol: "popular-consensus",
        schemaVersion: "upgrade-safety-v0",
        ids: {},
        hashes: {},
        statuses: {},
        authority: {}
      },
      communityId: "community-vancouver",
      model: {
        schemaVersion: "upgrade-governance-safety-model-v0",
        communityId: "community-vancouver",
        status: "Published",
        activationRule: "proposal-plus-effective-at-activation",
        emergencyRule: "active suspension blocks protocol writes",
        forkExitRule: "community export can be forked",
        minimumReviewHours: 0,
        gates: [],
        upgradeClasses: [],
        knownMvpLimits: []
      },
      gates: [],
      powers: [],
      activeStewards: [],
      activeParameterSet: null,
      activeEmergencySuspension: null
    });

    expect(() =>
      PublicApiV0ResponseSchemas.communities.parse({
        protocol: {
          protocol: "popular-consensus",
          schemaVersion: "registry-events-v0",
          page,
          ids: {},
          hashes: {},
          statuses: {},
          authority: {}
        },
        page,
        communities: []
      })
    ).toThrow();
  });
});

describe("canonical appchain boundary", () => {
  it("defines canonical modules and state machine invariants", () => {
    const boundary = CanonicalProtocolBoundarySchema.parse(CanonicalProtocolBoundary);
    const moduleIds = new Set(boundary.modules.map((module) => module.id));
    expect(moduleIds).toEqual(
      new Set([
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
      ])
    );

    expect(boundary.stateMachines.map((machine) => machine.id)).toEqual([
      "question-lifecycle-v0",
      "poll-lifecycle-v0",
      "tally-lifecycle-v0",
      "bond-lifecycle-v0",
      "adoption-policy-lifecycle-v0",
      "archive-lifecycle-v0"
    ]);

    for (const machine of boundary.stateMachines) {
      expect(moduleIds.has(machine.module)).toBe(true);
      expect(machine.states).toContain(machine.initialState);
      for (const terminalState of machine.terminalStates) expect(machine.states).toContain(terminalState);
      for (const transition of machine.transitions) {
        expect(moduleIds.has(transition.module)).toBe(true);
        expect(machine.states).toContain(transition.from);
        expect(machine.states).toContain(transition.to);
        expect(transition.writes.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("minimum protocol commitments", () => {
  it("defines the section 3 audit commitment set", () => {
    expect(MinimumProtocolCommitments.map((commitment) => commitment.kind)).toEqual([
      "question-version",
      "bond",
      "challenge",
      "ruling",
      "result-hash",
      "adoption-policy",
      "archive",
      "data-union"
    ]);
    for (const commitment of MinimumProtocolCommitments) {
      ProtocolCommitmentSchema.parse(commitment);
      expect(commitment.eventTypes.length).toBeGreaterThan(0);
    }
  });
});

describe("social request schemas", () => {
  it("accepts local accounts and public or private community creation", () => {
    expect(
      CreateUserRequestSchema.parse({
        username: "civic_builder",
        displayName: "Civic Builder"
      }).username
    ).toBe("civic_builder");

    expect(
      CreateCommunityRequestSchema.parse({
        name: "Neighborhood Assembly",
        description: "Private practice space for neighborhood governance.",
        visibility: "Private",
        creatorId: "user-civic_builder"
      }).visibility
    ).toBe("Private");
  });
});
