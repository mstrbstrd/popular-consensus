import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hashJson, verifyArtifactManifest } from "@pc/artifacts";
import { prisma } from "@pc/db";
import {
  BuiltInAnswerSchemas,
  CanonicalProtocolBoundarySchema,
  PublicApiV0ArchiveExportResponseSchema,
  PublicApiV0ArchivesResponseSchema,
  PublicApiV0ArtifactReadResponseSchema,
  PublicApiV0ChallengeAppealsResponseSchema,
  PublicApiV0CivicRecordResponseSchema,
  PublicApiV0CommunitiesResponseSchema,
  PublicApiV0CommunityExportResponseSchema,
  PublicApiV0CommunityImportReplayResponseSchema,
  PublicApiV0CommitmentsResponseSchema,
  PublicApiV0DiscoveryResponseSchema,
  PublicApiV0CredentialTrustPoliciesResponseSchema,
  PublicApiV0GovernanceParametersResponseSchema,
  PublicApiV0MinimumCommitmentsResponseSchema,
  PublicApiV0QuestionDiscussionResponseSchema,
  PublicApiV0JurorAssignmentsResponseSchema,
  PublicApiV0QuestionModerationResponseSchema,
  PublicApiV0ProfileRecordResponseSchema,
  PublicApiV0ProtocolTransactionsResponseSchema,
  PublicApiV0ProtocolIndexerReplayResponseSchema,
  PublicApiV0PublicTestnetReadinessResponseSchema,
  PublicApiV0RegistryEventsResponseSchema,
  PublicApiV0ReputationEventsResponseSchema,
  PublicApiV0ReputationExportResponseSchema,
  PublicApiV0ReputationReplayResponseSchema,
  PublicApiV0ReplayCheckResponseSchema,
  PublicApiV0ResultArtifactsResponseSchema,
  PublicApiV0StewardPowersResponseSchema,
  PublicApiV0TallyCommitteesResponseSchema,
  PublicApiV0TallyDecryptionSharesResponseSchema,
  PublicApiV0TallyKeySetupsResponseSchema,
  PublicApiV0TreasuryLedgerResponseSchema,
  PublicApiV0UpgradeSafetyResponseSchema,
  type BallotResponse
} from "@pc/shared";
import { config } from "./config";
import { buildServer } from "./server";
import { resetDemoData } from "./seed";

const runDatabaseTests = process.env.RUN_DB_TESTS === "true";

const apiFormatCases: Array<{
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

async function acceptQuestion(app: ReturnType<typeof buildServer>, questionId: string, curator = "demo-curator") {
  const response = await app.inject({
    method: "POST",
    url: `/questions/${questionId}/accept`,
    payload: { curator }
  });
  expect(response.statusCode).toBe(200);
  return response;
}

describe("api", () => {
  it("exposes a health endpoint without leaking ballot contents", async () => {
    const app = buildServer();
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true });
    const commitments = await app.inject({ method: "GET", url: "/public/protocol/commitments" });
    expect(commitments.statusCode).toBe(200);
    PublicApiV0MinimumCommitmentsResponseSchema.parse(commitments.json());
    expect(commitments.json().protocol).toMatchObject({
      schemaVersion: "minimum-commitments-v0",
      statuses: { commitmentCount: 7 }
    });
    expect(commitments.json().commitments.map((commitment: { kind: string }) => commitment.kind)).toEqual(
      expect.arrayContaining(["question-version", "bond", "challenge", "ruling", "result-hash", "adoption-policy", "archive"])
    );
    const boundary = await app.inject({ method: "GET", url: "/public/protocol/appchain-boundary" });
    expect(boundary.statusCode).toBe(200);
    const parsedBoundary = CanonicalProtocolBoundarySchema.parse(boundary.json());
    expect(parsedBoundary.schemaVersion).toBe("canonical-appchain-boundary-v0");
    expect(parsedBoundary.modules.map((module) => module.id)).toEqual(
      expect.arrayContaining([
        "QuestionRegistry",
        "StakeManager",
        "ChallengeCourt",
        "PollManager",
        "TallyManager",
        "AdoptionRegistry",
        "ResultArchive"
      ])
    );
    const readiness = await app.inject({ method: "GET", url: "/public/protocol/testnet-readiness" });
    expect(readiness.statusCode).toBe(200);
    PublicApiV0PublicTestnetReadinessResponseSchema.parse(readiness.json());
    expect(readiness.json()).toMatchObject({
      status: "PendingExternalOperators",
      protocol: {
        schemaVersion: "public-testnet-readiness-v0",
        statuses: {
          readinessStatus: "PendingExternalOperators",
          pendingGates: expect.arrayContaining(["matching-replay-hashes", "operator-attestations"])
        },
        authority: {
          runbook: "docs/public-testnet-operator-runbook.md",
          environmentTemplate: "infra/public-testnet.env.example",
          attestationDirectory: "docs/public-testnet-attestations",
          launchSummary: "docs/public-testnet-launch-summary.md",
          attestationCollector: "pnpm testnet:collect-attestation",
          launchSummaryWriter: "pnpm testnet:write-launch-summary",
          attestationVerifier: "pnpm testnet:verify-attestations",
          completionRule: "external-operator-attestations-required"
        }
      },
      attestationTemplate: {
        schemaVersion: "public-testnet-operator-attestation-v0",
        operatorRole: "replay-verifier",
        checks: {
          governanceParameterDrill: "passed",
          adoptionPolicyDrill: "passed",
          emergencySuspensionDrill: "passed",
          communityExportReplay: "Verified",
          forkMetadata: "passed",
          upgradeSafetyDrill: "passed"
        }
      }
    });
    expect(readiness.json().operatorRequirements.map((requirement: { role: string }) => requirement.role)).toEqual(
      expect.arrayContaining(["deployer", "api-indexer", "replay-verifier", "community-steward"])
    );
    expect(readiness.json().requiredEndpoints).toEqual(
      expect.arrayContaining(["GET /public/protocol/testnet-readiness", "GET /registry/protocol-transactions/replay"])
    );
    expect(readiness.json().requiredCommands).toEqual(
        expect.arrayContaining(["cp infra/public-testnet.env.example .env.public-testnet", "pnpm typecheck", "pnpm testnet:collect-attestation -- --operator-id <operator-id> --operator-contact <contact-or-public-key> --independence-statement <independence-claim> --role <role> --git-commit <commit> --chain-id <chain-id> --rpc-url <rpc-url> --api-base-url <api-base-url> --community-id <community-id> --out docs/public-testnet-attestations/<operator-id>.json", "pnpm testnet:write-launch-summary -- --decision GO --independence-reviewed --testnet-window <window>", "pnpm testnet:verify-attestations"])
    );
    expect(readiness.json().completionGates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "operator-attestations", evidence: expect.arrayContaining(["pnpm testnet:collect-attestation"]) }),
        expect.objectContaining({ id: "launch-summary", evidence: expect.arrayContaining(["docs/public-testnet-launch-summary.md", "pnpm testnet:verify-attestations"]) })
      ])
    );
    await app.close();
  });
});

describe.skipIf(!runDatabaseTests)("api transit poll integration", () => {
  const app = buildServer();

  beforeAll(async () => {
    await resetDemoData();
  });

  beforeEach(async () => {
    await resetDemoData();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("requires threshold key setup before creating non-demo polls", async () => {
    const previousDemoMode = config.demoMode;
    config.demoMode = false;
    const question = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should non-demo polls require threshold keys?",
        body: "Non-demo protocol mode must not create single-coordinator poll keys.",
        sponsorDisclosure: "Demo sponsor",
        proposer: "demo-proposer"
      }
    });
    config.demoMode = previousDemoMode;
    expect(question.statusCode).toBe(409);
    expect(question.json()).toMatchObject({ error: "Non-demo mode requires an active threshold tally key setup before creating polls" });
  });

  it("runs question, challenge, amendment, credential, vote, duplicate rejection, close, tally, result, archive, and adoption reads", async () => {
    const users = await app.inject({ method: "GET", url: "/users" });
    expect(users.statusCode).toBe(200);
    expect(users.json().users.map((user: { id: string }) => user.id)).toContain("demo-proposer");
    expect(users.json().users.find((user: { id: string }) => user.id === "demo-proposer")).toMatchObject({
      profileId: "did:pc:demo-proposer",
      profileHash: expect.stringMatching(/^sha256:/)
    });

    const newUser = await app.inject({
      method: "POST",
      url: "/users",
      payload: { username: "civic_builder", displayName: "Civic Builder" }
    });
    expect(newUser.statusCode).toBe(200);
    const newUserId = newUser.json().user.id as string;
    expect(newUser.json()).toMatchObject({
      user: { id: newUserId, profileId: `did:pc:${newUserId}`, profileHash: newUser.json().profileArtifact.hash },
      profileArtifact: {
        value: {
          artifactKind: "user-profile",
          schemaVersion: "pc-user-profile-v1",
          profileId: `did:pc:${newUserId}`,
          username: "civic_builder"
        }
      }
    });

    const profileResolve = await app.inject({ method: "GET", url: `/profiles/resolve?profileId=${encodeURIComponent(`did:pc:${newUserId}`)}` });
    expect(profileResolve.statusCode).toBe(200);
    PublicApiV0ProfileRecordResponseSchema.parse(profileResolve.json());
    expect(profileResolve.json()).toMatchObject({
      protocol: {
        schemaVersion: "profile-record-v0",
        ids: { userId: newUserId, profileId: `did:pc:${newUserId}` },
        hashes: { profileHash: newUser.json().profileArtifact.hash },
        statuses: { profileStatus: "Portable" }
      },
      profileArtifact: { hash: newUser.json().profileArtifact.hash }
    });

    const userProtocolTransactions = await app.inject({
      method: "GET",
      url: `/registry/protocol-transactions?subjectId=${newUserId}&sourceModule=SocialGraph`
    });
    expect(userProtocolTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(userProtocolTransactions.json());
    expect(userProtocolTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual(["UserCreated"]);

    const privateCommunity = await app.inject({
      method: "POST",
      url: "/communities",
      payload: {
        name: "Neighborhood Assembly",
        slug: "neighborhood-assembly",
        description: "Private practice space for neighborhood governance.",
        visibility: "Private",
        creatorId: newUserId
      }
    });
    expect(privateCommunity.statusCode).toBe(200);
    const privateCommunityId = privateCommunity.json().community.id as string;

    const communityCreatedTransactions = await app.inject({
      method: "GET",
      url: `/registry/protocol-transactions?subjectId=${privateCommunityId}&sourceModule=SocialGraph`
    });
    expect(communityCreatedTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(communityCreatedTransactions.json());
    expect(communityCreatedTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual([
      "CommunityCreated"
    ]);

    const blockedPrivateFeed = await app.inject({ method: "GET", url: `/questions?communityId=${privateCommunityId}` });
    expect(blockedPrivateFeed.statusCode).toBe(403);

    const privateQuestion = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should the assembly adopt rotating facilitation?",
        body: "Advisory process question for members.",
        sponsorDisclosure: "Sponsored by assembly members.",
        proposer: newUserId,
        communityId: privateCommunityId
      }
    });
    expect(privateQuestion.statusCode).toBe(200);

    const allowedPrivateFeed = await app.inject({ method: "GET", url: `/questions?communityId=${privateCommunityId}&userId=${newUserId}` });
    expect(allowedPrivateFeed.statusCode).toBe(200);
    expect(allowedPrivateFeed.json().questions).toHaveLength(1);

    const blockedPrivateExport = await app.inject({ method: "GET", url: `/communities/${privateCommunityId}/export` });
    expect(blockedPrivateExport.statusCode).toBe(403);
    const allowedPrivateExport = await app.inject({ method: "GET", url: `/communities/${privateCommunityId}/export?userId=${newUserId}` });
    expect(allowedPrivateExport.statusCode).toBe(200);
    PublicApiV0CommunityExportResponseSchema.parse(allowedPrivateExport.json());
    expect(allowedPrivateExport.json().exportArtifact.artifact).toMatchObject({
      artifactKind: "community-export",
      schemaVersion: "pc-community-export-v1",
      community: { id: privateCommunityId, visibility: "Private" }
    });
    expect(allowedPrivateExport.json().exportArtifact.artifact.questions).toHaveLength(1);
    expect(allowedPrivateExport.json().exportArtifact.artifact.profiles).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: newUserId, profileId: `did:pc:${newUserId}`, profileHash: newUser.json().profileArtifact.hash })])
    );
    expect(allowedPrivateExport.json().protocol).toMatchObject({
      ids: { profileIds: expect.arrayContaining([`did:pc:${newUserId}`]) },
      hashes: { profileHashes: expect.arrayContaining([newUser.json().profileArtifact.hash]) },
      statuses: { profileCount: 1 }
    });
    expect(allowedPrivateExport.json().bundle.artifacts).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "user-profile", hash: newUser.json().profileArtifact.hash })])
    );
    expect(allowedPrivateExport.json().bundle.root).toMatchObject({
      kind: "community-export",
      hash: allowedPrivateExport.json().exportArtifact.hash,
      computedHash: allowedPrivateExport.json().exportArtifact.hash
    });

    const filteredCommunities = await app.inject({ method: "GET", url: "/communities?visibility=Public&query=vancouver&limit=1" });
    expect(filteredCommunities.statusCode).toBe(200);
    PublicApiV0CommunitiesResponseSchema.parse(filteredCommunities.json());
    expect(filteredCommunities.json().page).toMatchObject({ limit: 1, cursor: "0", total: 1, hasMore: false });
    expect(filteredCommunities.json().communities[0]).toMatchObject({ id: "community-vancouver", visibility: "Public" });

    const created = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should Vancouver pilot a temporary bus priority lane?",
        body: "Advisory transit question for verified residents.",
        sponsorDisclosure: "Demo sponsor",
        proposer: "demo-proposer"
      }
    });
    expect(created.statusCode).toBe(200);
    const createdBody = created.json();
    const questionId = createdBody.question.id as string;
    const pollId = createdBody.question.poll.id as string;
    expect(createdBody.question.authorityLevel).toBe("Advisory");
    expect(createdBody.question.status).toBe("Submitted");
    expect(createdBody.question.poll.status).toBe("Configured");
    expect(createdBody.stakedPc).toBe("100");

    const questionProtocolTransactions = await app.inject({
      method: "GET",
      url: `/registry/protocol-transactions?subjectId=${questionId}&sourceModule=QuestionRegistry`
    });
    expect(questionProtocolTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(questionProtocolTransactions.json());
    expect(questionProtocolTransactions.json().transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "QuestionSubmitted",
          sourceModule: "QuestionRegistry",
          transactionType: "questionSubmitted",
          payload: expect.objectContaining({ schemaVersion: "local-protocol-transaction-result-v0" })
        })
      ])
    );

    const proposalBondTransactions = await app.inject({
      method: "GET",
      url: `/registry/protocol-transactions?subjectId=${createdBody.proposalBondId}&sourceModule=StakeManager`
    });
    expect(proposalBondTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(proposalBondTransactions.json());
    expect(proposalBondTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual(["BondEscrowed"]);

    const unopenedCredential = await app.inject({
      method: "POST",
      url: "/credentials/demo-resident",
      payload: { holderAlias: "resident-before-accept" }
    });
    expect(unopenedCredential.statusCode).toBe(200);
    const unopenedIssued = unopenedCredential.json().credential;
    const unopenedVote = await app.inject({
      method: "POST",
      url: `/polls/${pollId}/vote`,
      payload: { credentialId: unopenedIssued.credentialId, credentialSecret: unopenedIssued.secret, choice: "support" }
    });
    expect(unopenedVote.statusCode).toBe(409);
    expect(unopenedVote.json().error).toBe("Poll is not open");

    const challenge = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/challenges`,
      payload: { reasonCode: "MisleadingWording", evidence: "Clarify temporary scope.", challenger: "demo-challenger" }
    });
    expect(challenge.statusCode).toBe(200);
    expect(challenge.json().challenge.ruling).toBe("Pending");
    const challengeBondId = challenge.json().challenge.challengeBondId as string;
    const challengeProtocolTransactions = await app.inject({
      method: "GET",
      url: `/registry/protocol-transactions?subjectId=${questionId}&sourceModule=ChallengeCourt`
    });
    expect(challengeProtocolTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(challengeProtocolTransactions.json());
    expect(challengeProtocolTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toContain(
      "ChallengeOpened"
    );

    const challengeBondTransactions = await app.inject({
      method: "GET",
      url: `/registry/protocol-transactions?subjectId=${challengeBondId}&sourceModule=StakeManager`
    });
    expect(challengeBondTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(challengeBondTransactions.json());
    expect(challengeBondTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual(["BondEscrowed"]);

    const amendment = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/amendments`,
      payload: { body: "Advisory transit question for verified residents, scoped to a temporary pilot." }
    });
    expect(amendment.statusCode).toBe(200);
    expect(amendment.json().question.status).toBe("Submitted");
    expect(amendment.json().question.version).toBe(2);

    const amendedQuestionTransactions = await app.inject({
      method: "GET",
      url: `/registry/protocol-transactions?subjectId=${questionId}&sourceModule=QuestionRegistry`
    });
    expect(amendedQuestionTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(amendedQuestionTransactions.json());
    expect(amendedQuestionTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual(
      expect.arrayContaining(["QuestionSubmitted", "QuestionAmended"])
    );

    const remandedChallengeBondTransactions = await app.inject({
      method: "GET",
      url: `/registry/protocol-transactions?subjectId=${challengeBondId}&sourceModule=StakeManager`
    });
    expect(remandedChallengeBondTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(remandedChallengeBondTransactions.json());
    expect(remandedChallengeBondTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual(
      expect.arrayContaining(["BondEscrowed", "BondSettled"])
    );

    const accept = await acceptQuestion(app, questionId);
    expect(accept.json().question.status).toBe("Open");
    expect(accept.json().poll.status).toBe("Open");
    const acceptedQuestionTransactions = await app.inject({
      method: "GET",
      url: `/registry/protocol-transactions?subjectId=${questionId}&sourceModule=QuestionRegistry`
    });
    expect(acceptedQuestionTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(acceptedQuestionTransactions.json());
    expect(acceptedQuestionTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual(
      expect.arrayContaining(["QuestionSubmitted", "QuestionAccepted"])
    );

    const pollTransactions = await app.inject({
      method: "GET",
      url: `/registry/protocol-transactions?subjectId=${questionId}&sourceModule=PollManager`
    });
    expect(pollTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(pollTransactions.json());
    expect(pollTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toContain("PollOpened");

    const settledProposalBondTransactions = await app.inject({
      method: "GET",
      url: `/registry/protocol-transactions?subjectId=${createdBody.proposalBondId}&sourceModule=StakeManager`
    });
    expect(settledProposalBondTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(settledProposalBondTransactions.json());
    expect(settledProposalBondTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual(
      expect.arrayContaining(["BondEscrowed", "BondSettled"])
    );

    const lateAmendment = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/amendments`,
      payload: { body: "A late amendment after poll opening should fail." }
    });
    expect(lateAmendment.statusCode).toBe(409);
    expect(lateAmendment.json().error).toBe("Question cannot be amended in its current state");

    const credential = await app.inject({
      method: "POST",
      url: "/credentials/demo-resident",
      payload: { holderAlias: "resident-integration" }
    });
    expect(credential.statusCode).toBe(200);
    const issued = credential.json().credential;

    const signup = await app.inject({
      method: "POST",
      url: `/polls/${pollId}/signup`,
      payload: { credentialId: issued.credentialId, credentialSecret: issued.secret }
    });
    expect(signup.statusCode).toBe(200);
    expect(signup.json().accepted).toBe(true);

    const vote = await app.inject({
      method: "POST",
      url: `/polls/${pollId}/vote`,
      payload: { credentialId: issued.credentialId, credentialSecret: issued.secret, choice: "support" }
    });
    expect(vote.statusCode).toBe(200);
    expect(vote.json().ballot).not.toHaveProperty("encryptedPayloadJson");
    const ballotTransactions = await app.inject({
      method: "GET",
      url: `/registry/protocol-transactions?subjectId=${questionId}&sourceModule=PollManager`
    });
    expect(ballotTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(ballotTransactions.json());
    expect(ballotTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual(
      expect.arrayContaining(["PollOpened", "BallotAccepted"])
    );

    const duplicateVote = await app.inject({
      method: "POST",
      url: `/polls/${pollId}/vote`,
      payload: { credentialId: issued.credentialId, credentialSecret: issued.secret, choice: "oppose" }
    });
    expect(duplicateVote.statusCode).toBe(409);
    expect(duplicateVote.json().error).toBe("Duplicate ballot nullifier rejected");

    const close = await app.inject({ method: "POST", url: `/polls/${pollId}/close`, payload: {} });
    expect(close.statusCode).toBe(200);
    expect(close.json().poll.status).toBe("Closed");
    const closedPollTransactions = await app.inject({
      method: "GET",
      url: `/registry/protocol-transactions?subjectId=${questionId}&sourceModule=PollManager`
    });
    expect(closedPollTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(closedPollTransactions.json());
    expect(closedPollTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual(
      expect.arrayContaining(["PollOpened", "PollClosed"])
    );

    const tally = await app.inject({ method: "POST", url: `/polls/${pollId}/tally`, payload: {} });
    expect(tally.statusCode).toBe(200);
    expect(tally.json().artifact).toMatchObject({ artifactKind: "result-artifact", schemaVersion: "pc-result-artifact-v1" });
    expect(tally.json().artifact.counts.support).toBe(1);
    expect(tally.json().artifact.turnout).toBe(1);

    const results = await app.inject({ method: "GET", url: `/polls/${pollId}/results` });
    expect(results.statusCode).toBe(200);
    expect(results.json().artifact).not.toHaveProperty("encryptedPayloadJson");
    expect(results.json().authorityLevel).toBe("Advisory");

    const discussionPost = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/discussion`,
      payload: { authorId: "demo-resident", kind: "Comment", body: "The temporary scope is clear enough for a pilot." }
    });
    expect(discussionPost.statusCode).toBe(200);
    expect(discussionPost.json().bodyArtifact.value).toMatchObject({
      artifactKind: "discussion-post",
      schemaVersion: "pc-discussion-post-v1",
      kind: "Comment"
    });

    const discussion = await app.inject({ method: "GET", url: `/questions/${questionId}/discussion?userId=demo-resident` });
    expect(discussion.statusCode).toBe(200);
    expect(discussion.json().discussion[0]).toMatchObject({ authorId: "demo-resident", body: "The temporary scope is clear enough for a pilot." });

    const resultChallenge = await app.inject({
      method: "POST",
      url: `/polls/${pollId}/results/challenges`,
      payload: {
        challenger: "demo-challenger",
        reasonCode: "PrivacyThresholdViolation",
        evidence: "Review privacy threshold before final archive."
      }
    });
    expect(resultChallenge.statusCode).toBe(200);
    expect(resultChallenge.json().resultChallenge.ruling).toBe("Pending");
    expect(resultChallenge.json().evidenceArtifact.value).toMatchObject({
      artifactKind: "result-challenge-evidence",
      schemaVersion: "pc-result-challenge-evidence-v1"
    });
    const resultChallengeId = resultChallenge.json().resultChallenge.id as string;

    const blockedFinalize = await app.inject({ method: "POST", url: `/polls/${pollId}/finalize`, payload: { curator: "demo-curator" } });
    expect(blockedFinalize.statusCode).toBe(409);
    expect(blockedFinalize.json().error).toBe("Resolve pending result challenges before finalization");

    const resultRuling = await app.inject({
      method: "POST",
      url: `/polls/${pollId}/results/challenges/${resultChallengeId}/ruling`,
      payload: {
        ruling: "Sustained",
        juror: "demo-curator",
        resolution: "Annotate the result artifact with the privacy review before finalization."
      }
    });
    expect(resultRuling.statusCode).toBe(200);
    expect(resultRuling.json().resolutionArtifact.value).toMatchObject({
      artifactKind: "result-challenge-resolution",
      schemaVersion: "pc-result-challenge-resolution-v1"
    });
    expect(resultRuling.json().correctedArtifact.value).toMatchObject({
      artifactKind: "result-artifact-correction",
      schemaVersion: "pc-result-artifact-correction-v1"
    });
    expect(resultRuling.json().correctedArtifact.hash).toMatch(/^sha256:/);

    const resultChallengeProtocolTransactions = await app.inject({
      method: "GET",
      url: `/registry/protocol-transactions?subjectId=${questionId}&sourceModule=ChallengeCourt`
    });
    expect(resultChallengeProtocolTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(resultChallengeProtocolTransactions.json());
    expect(resultChallengeProtocolTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual(
      expect.arrayContaining(["ChallengeOpened", "ResultChallenged", "ResultChallengeRuled"])
    );

    const resultChallengeBondTransactions = await app.inject({
      method: "GET",
      url: `/registry/protocol-transactions?subjectId=${resultChallenge.json().resultChallenge.challengeBondId}&sourceModule=StakeManager`
    });
    expect(resultChallengeBondTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(resultChallengeBondTransactions.json());
    expect(resultChallengeBondTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual(
      expect.arrayContaining(["BondEscrowed", "BondSettled"])
    );

    const finalize = await app.inject({ method: "POST", url: `/polls/${pollId}/finalize`, payload: { curator: "demo-curator" } });
    expect(finalize.statusCode).toBe(200);
    expect(finalize.json().result.finalStatus).toBe("Finalized");

    const archive = await app.inject({ method: "POST", url: `/questions/${questionId}/archive`, payload: { curator: "demo-curator" } });
    expect(archive.statusCode).toBe(200);
    const archiveArtifact = archive.json().artifact;
    expect(archiveArtifact).toMatchObject({ artifactKind: "question-archive", schemaVersion: "pc-question-archive-v1" });
    expect(archiveArtifact.artifactManifest).toMatchObject({ protocol: "popular-consensus", schemaVersion: "artifact-manifest-v1" });
    expect(archiveArtifact.artifactManifestHash).toMatch(/^sha256:/);
    expect(archiveArtifact.artifactManifest.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "question-body", role: "body" }),
        expect.objectContaining({ kind: "result-artifact", role: "result" }),
        expect.objectContaining({ kind: "discussion-post", role: "discussion" })
      ])
    );
    const archiveVerification = await verifyArtifactManifest(config.artifactDir, archiveArtifact.artifactManifest);
    expect(archiveVerification).toMatchObject({ valid: true, manifestHash: archiveArtifact.artifactManifestHash });
    expect(archiveArtifact.events.map((event: { eventType: string }) => event.eventType)).toEqual(
      expect.arrayContaining(["QuestionSubmitted", "ResultChallenged", "ResultCorrected", "ResultFinalized"])
    );
    expect(archiveArtifact.discussion[0].body).toBe("The temporary scope is clear enough for a pilot.");

    const archiveExport = await app.inject({ method: "GET", url: `/questions/${questionId}/archive/export` });
    expect(archiveExport.statusCode).toBe(200);
    PublicApiV0ArchiveExportResponseSchema.parse(archiveExport.json());
    expect(archiveExport.json().protocol).toMatchObject({
      protocol: "popular-consensus",
      schemaVersion: "archive-export-v0",
      ids: { questionId, communityId: "community-vancouver", archiveRecordId: archiveExport.json().archiveRecord.id },
      hashes: { archiveHash: archiveExport.json().archiveRecord.archiveHash, archiveManifestHash: archiveArtifact.artifactManifestHash },
      statuses: { archiveStatus: "Exported" },
      authority: { archivedBy: "demo-curator" }
    });
    expect(archiveExport.json().bundle).toMatchObject({
      protocol: "popular-consensus",
      schemaVersion: "artifact-export-bundle-v1",
      manifestHash: archiveArtifact.artifactManifestHash,
      root: { kind: "question-archive", hash: archiveExport.json().archiveRecord.archiveHash, computedHash: archiveExport.json().archiveRecord.archiveHash }
    });
    expect(archiveExport.json().bundle.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "question-body", value: expect.objectContaining({ artifactKind: "question-body" }) }),
        expect.objectContaining({ kind: "discussion-post", value: expect.objectContaining({ body: "The temporary scope is clear enough for a pilot." }) })
      ])
    );
    expect(archiveExport.json().bundle.root).not.toHaveProperty("path");
    expect(archiveExport.json().bundle.artifacts[0]).not.toHaveProperty("path");

    const communityExport = await app.inject({ method: "GET", url: "/communities/community-vancouver/export" });
    expect(communityExport.statusCode).toBe(200);
    PublicApiV0CommunityExportResponseSchema.parse(communityExport.json());
    expect(communityExport.json().protocol).toMatchObject({
      protocol: "popular-consensus",
      schemaVersion: "community-export-v0",
      ids: {
        communityId: "community-vancouver",
        questionIds: expect.arrayContaining([questionId]),
        archiveRecordIds: expect.arrayContaining([archiveExport.json().archiveRecord.id])
      },
      hashes: {
        communityExportHash: communityExport.json().exportArtifact.hash,
        artifactManifestHash: communityExport.json().bundle.manifestHash,
        archiveHashes: expect.arrayContaining([archiveExport.json().archiveRecord.archiveHash]),
        resultArtifactHashes: expect.arrayContaining([resultRuling.json().correctedArtifact.hash])
      },
      statuses: {
        exportStatus: "Exported",
        archiveCount: 1
      },
      authority: {
        defaultAuthorityLevel: "Advisory",
        commitmentMode: "local-devnet-record"
      }
    });
    expect(communityExport.json().exportArtifact.artifact).toMatchObject({
      artifactKind: "community-export",
      schemaVersion: "pc-community-export-v1",
      community: { id: "community-vancouver", visibility: "Public" },
      policies: expect.arrayContaining([expect.objectContaining({ id: "policy-vancouver-advisory", status: "Active" })]),
      archives: expect.arrayContaining([expect.objectContaining({ questionId, archiveHash: archiveExport.json().archiveRecord.archiveHash })]),
      artifactManifestHash: communityExport.json().bundle.manifestHash
    });
    const exportedQuestion = communityExport
      .json()
      .exportArtifact.artifact.questions.find((question: { id: string }) => question.id === questionId);
    expect(exportedQuestion).toMatchObject({
      id: questionId,
      status: "Archived",
      archiveRecord: { archiveHash: archiveExport.json().archiveRecord.archiveHash },
      poll: {
        id: pollId,
        result: { resultArtifactHash: resultRuling.json().correctedArtifact.hash },
        ballotCommitmentRoot: expect.stringMatching(/^sha256:/),
        nullifierRoot: expect.stringMatching(/^sha256:/)
      }
    });
    expect(exportedQuestion.poll).not.toHaveProperty("tallyPrivateKeyPem");
    expect(communityExport.json().exportArtifact.artifact.events.map((event: { eventType: string }) => event.eventType)).toEqual(
      expect.arrayContaining(["QuestionSubmitted", "QuestionArchived", "BondEscrowed", "BondSettled"])
    );
    expect(communityExport.json().exportArtifact.artifact.commitments.map((commitment: { kind: string }) => commitment.kind)).toEqual(
      expect.arrayContaining(["question-version", "bond", "challenge", "ruling", "result-hash", "archive"])
    );
    expect(communityExport.json().bundle.root).toMatchObject({
      kind: "community-export",
      hash: communityExport.json().exportArtifact.hash,
      computedHash: communityExport.json().exportArtifact.hash
    });
    expect(communityExport.json().bundle.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "question-archive", hash: archiveExport.json().archiveRecord.archiveHash }),
        expect.objectContaining({ kind: "question-body", value: expect.objectContaining({ artifactKind: "question-body" }) }),
        expect.objectContaining({ kind: "adoption-policy-proposal", value: expect.objectContaining({ artifactKind: "adoption-policy-proposal" }) }),
        expect.objectContaining({ kind: "adoption-policy-activation", value: expect.objectContaining({ artifactKind: "adoption-policy-activation" }) })
      ])
    );
    expect(communityExport.json().bundle.root).not.toHaveProperty("path");
    expect(communityExport.json().bundle.artifacts[0]).not.toHaveProperty("path");

    const artifactRead = await app.inject({ method: "GET", url: `/artifacts/${archiveExport.json().archiveRecord.archiveHash}` });
    expect(artifactRead.statusCode).toBe(200);
    PublicApiV0ArtifactReadResponseSchema.parse(artifactRead.json());
    expect(artifactRead.json().protocol).toMatchObject({
      schemaVersion: "artifact-read-v0",
      ids: { artifactKind: "question-archive" },
      hashes: { artifactHash: archiveExport.json().archiveRecord.archiveHash, computedHash: archiveExport.json().archiveRecord.archiveHash },
      statuses: { verificationStatus: "Verified" },
      authority: { schemaVersion: "pc-question-archive-v1" }
    });

    const publicRecord = await app.inject({ method: "GET", url: `/public/questions/${questionId}/civic-record` });
    expect(publicRecord.statusCode).toBe(200);
    PublicApiV0CivicRecordResponseSchema.parse(publicRecord.json());
    expect(publicRecord.json().protocol).toMatchObject({
      protocol: "popular-consensus",
      schemaVersion: "public-civic-record-v0",
      ids: {
        questionId,
        communityId: "community-vancouver",
        pollId,
        archiveRecordId: archiveExport.json().archiveRecord.id,
        credentialSchemaId: "credential-vancouver-resident"
      },
      hashes: {
        archiveHash: archiveExport.json().archiveRecord.archiveHash,
        archiveManifestHash: archiveArtifact.artifactManifestHash,
        resultArtifactHash: resultRuling.json().correctedArtifact.hash
      },
      statuses: {
        questionStatus: "Archived",
        resultFinalStatus: "Finalized",
        archiveStatus: "Archived"
      },
      authority: {
        authorityLevel: "Advisory",
        communityVisibility: "Public",
        methodologyLabel: "Verified community member response, self-selected sample"
      }
    });
    expect(publicRecord.json().protocol.hashes.questionChallengeEvidenceHashes).toHaveLength(1);
    expect(publicRecord.json().protocol.hashes.resultChallengeEvidenceHashes).toHaveLength(1);
    expect(publicRecord.json().protocol.statuses.commitmentKinds).toEqual(
      expect.arrayContaining(["question-version", "challenge", "ruling", "result-hash", "archive"])
    );
    expect(publicRecord.json().protocol.authority.commitmentMode).toBe("local-devnet-record");
    expect(publicRecord.json().protocol.hashes.commitmentHashes).toHaveLength(publicRecord.json().commitments.length);
    expect(publicRecord.json().commitments.map((commitment: { kind: string }) => commitment.kind)).toEqual(
      expect.arrayContaining(["question-version", "challenge", "ruling", "result-hash", "archive"])
    );
    expect(publicRecord.json().result.finalStatus).toBe("Finalized");
    expect(publicRecord.json().archiveRecord.archiveHash).toMatch(/^sha256:/);

    const replayCheck = await app.inject({ method: "GET", url: `/public/questions/${questionId}/replay-check` });
    expect(replayCheck.statusCode).toBe(200);
    PublicApiV0ReplayCheckResponseSchema.parse(replayCheck.json());
    expect(replayCheck.json()).toMatchObject({
      status: "Verified",
      rebuilt: {
        questionStatus: "Archived",
        pollStatus: "ResultPublished",
        resultFinalStatus: "Finalized",
        bodyHash: archiveArtifact.question.bodyHash,
        resultArtifactHash: resultRuling.json().correctedArtifact.hash,
        archiveHash: archiveExport.json().archiveRecord.archiveHash
      },
      protocol: {
        schemaVersion: "replay-check-v0",
        statuses: { replayStatus: "Verified", failedChecks: [] },
        hashes: { archiveHash: archiveExport.json().archiveRecord.archiveHash }
      }
    });
    expect(replayCheck.json().checks.every((check: { ok: boolean }) => check.ok)).toBe(true);
    expect(replayCheck.json().checks.map((check: { id: string }) => check.id)).toEqual(
      expect.arrayContaining(["archive-manifest-references", "archive-event-snapshot", "result-artifact-hash-from-events"])
    );

    const registryEvents = await app.inject({ method: "GET", url: "/registry/events" });
    expect(registryEvents.statusCode).toBe(200);
    PublicApiV0RegistryEventsResponseSchema.parse(registryEvents.json());
    expect(registryEvents.json().protocol).toMatchObject({
      protocol: "popular-consensus",
      schemaVersion: "registry-events-v0",
      statuses: { latestEventType: "QuestionArchived" }
    });
    expect(registryEvents.json().protocol.hashes.eventStreamHash).toMatch(/^sha256:/);
    expect(registryEvents.json().protocol.statuses.commitmentCount).toBeGreaterThan(0);
    expect(registryEvents.json().events.every((event: { sourceTransactionId?: string }) => event.sourceTransactionId)).toBe(true);
    expect(registryEvents.json().commitments.map((commitment: { kind: string }) => commitment.kind)).toContain("result-hash");

    const protocolTransactions = await app.inject({ method: "GET", url: `/registry/protocol-transactions?subjectId=${questionId}&sourceModule=ResultArchive` });
    expect(protocolTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(protocolTransactions.json());
    expect(protocolTransactions.json().protocol).toMatchObject({
      schemaVersion: "protocol-transactions-v0",
      authority: { sourceTypes: ["local-devnet"], sourceModules: ["ResultArchive"] }
    });
    expect(protocolTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual(
      expect.arrayContaining(["ResultPublished", "ResultCorrected", "ResultFinalized", "QuestionArchived"])
    );
    expect(protocolTransactions.json().transactions[0]).toMatchObject({
      sourceType: "local-devnet",
      sourceModule: "ResultArchive",
      payload: { schemaVersion: "local-protocol-transaction-result-v0" }
    });

    const indexerReplay = await app.inject({ method: "GET", url: "/registry/protocol-transactions/replay" });
    expect(indexerReplay.statusCode).toBe(200);
    PublicApiV0ProtocolIndexerReplayResponseSchema.parse(indexerReplay.json());
    expect(indexerReplay.json()).toMatchObject({
      status: "Verified",
      readOnly: true,
      protocol: {
        schemaVersion: "protocol-indexer-replay-v0",
        statuses: { replayStatus: "Verified", failedChecks: [] },
        authority: {
          source: "protocol-transactions",
          readOnly: true,
          replayRule: "verify-transaction-results-and-rebuild-registry-events",
          boundaryVersion: "canonical-appchain-boundary-v0"
        }
      },
      rebuilt: {
        source: "protocol-transactions",
        readOnly: true
      }
    });
    expect(indexerReplay.json().rebuilt.modules.map((module: { sourceModule: string }) => module.sourceModule)).toEqual(
      expect.arrayContaining(["QuestionRegistry", "StakeManager", "ChallengeCourt", "PollManager", "ResultArchive", "CredentialRegistry", "SocialGraph"])
    );
    expect(indexerReplay.json().rebuilt.subjects.find((subject: { subjectId: string }) => subject.subjectId === questionId)).toMatchObject({
      eventTypes: expect.arrayContaining(["QuestionSubmitted", "QuestionArchived", "ResultFinalized"]),
      latestEventType: "QuestionArchived"
    });
    expect(indexerReplay.json().events.map((event: { eventType: string }) => event.eventType)).toEqual(
      expect.arrayContaining(["QuestionSubmitted", "BondEscrowed", "BallotAccepted", "ResultCorrected", "QuestionArchived"])
    );
    expect(indexerReplay.json().checks.every((check: { ok: boolean }) => check.ok)).toBe(true);
    expect(indexerReplay.json().checks.map((check: { id: string }) => check.id)).toEqual(
      expect.arrayContaining(["payload-hashes", "transaction-result-hashes", "canonical-module-event-types", "registry-event-reconstruction"])
    );

    const resultCommitments = await app.inject({ method: "GET", url: `/registry/commitments?subjectId=${questionId}&kind=result-hash&limit=10` });
    expect(resultCommitments.statusCode).toBe(200);
    PublicApiV0CommitmentsResponseSchema.parse(resultCommitments.json());
    expect(resultCommitments.json().protocol).toMatchObject({
      schemaVersion: "commitments-index-v0",
      authority: { mode: "local-devnet-record" }
    });
    expect(resultCommitments.json().commitments.map((commitment: { eventType: string }) => commitment.eventType)).toEqual([
      "ResultPublished",
      "ResultCorrected",
      "ResultFinalized"
    ]);
    expect(resultCommitments.json().commitments[0]).toMatchObject({
      kind: "result-hash",
      contractModule: "ResultArchive",
      payload: { schemaVersion: "devnet-commitment-v0" }
    });
    expect(resultCommitments.json().commitments[0].commitmentHash).toMatch(/^sha256:/);

    const publicEventsById = new Map(
      publicRecord.json().events.map((event: { id: string; eventType: string; subjectId: string; previousHash: string | null; newHash: string }) => [
        event.id,
        event
      ])
    );
    for (const commitment of publicRecord.json().commitments as Array<{
      kind: string;
      contractModule: string;
      sourceEventId: string;
      eventType: string;
      payloadHash: string;
      commitmentHash: string;
      payload: {
        kind: string;
        contractModule: string;
        sourceEvent: { id: string; eventType: string; subjectId: string; previousHash: string | null; newHash: string };
      };
    }>) {
      const sourceEvent = publicEventsById.get(commitment.sourceEventId);
      expect(sourceEvent).toBeTruthy();
      expect(commitment.payload).toMatchObject({
        kind: commitment.kind,
        contractModule: commitment.contractModule,
        sourceEvent
      });
      expect(commitment.payloadHash).toBe(hashJson(commitment.payload));
      expect(commitment.commitmentHash).toBe(hashJson({ kind: commitment.kind, contractModule: commitment.contractModule, payloadHash: commitment.payloadHash }));
    }
    const latestQuestionVersionCommitment = publicRecord
      .json()
      .commitments.filter((commitment: { kind: string }) => commitment.kind === "question-version")
      .at(-1);
    expect(latestQuestionVersionCommitment.payload.sourceEvent.newHash).toBe(publicRecord.json().protocol.hashes.questionBodyHash);
    expect(
      publicRecord
        .json()
        .commitments.find((commitment: { kind: string; eventType: string }) => commitment.kind === "result-hash" && commitment.eventType === "ResultCorrected")
        .payload.sourceEvent.newHash
    ).toBe(publicRecord.json().protocol.hashes.resultArtifactHash);
    expect(
      publicRecord
        .json()
        .commitments.find((commitment: { kind: string; eventType: string }) => commitment.kind === "archive" && commitment.eventType === "QuestionArchived")
        .payload.sourceEvent.newHash
    ).toBe(publicRecord.json().protocol.hashes.archiveHash);

    const filteredEvents = await app.inject({ method: "GET", url: `/registry/events?subjectId=${questionId}&eventType=QuestionArchived&limit=1` });
    expect(filteredEvents.statusCode).toBe(200);
    PublicApiV0RegistryEventsResponseSchema.parse(filteredEvents.json());
    expect(filteredEvents.json().page).toMatchObject({ limit: 1, cursor: "0", total: 1, hasMore: false });
    expect(filteredEvents.json().events[0]).toMatchObject({ subjectId: questionId, eventType: "QuestionArchived" });
    expect(filteredEvents.json().commitments[0]).toMatchObject({ kind: "archive", eventType: "QuestionArchived", contractModule: "QuestionRegistry" });
    expect(filteredEvents.json().protocol.page).toMatchObject({ limit: 1, total: 1 });

    const blockedFork = await app.inject({
      method: "POST",
      url: "/communities/community-vancouver/forks",
      payload: {
        steward: "demo-resident",
        forkName: "Resident fork",
        forkSlug: "resident-fork",
        reason: "Member should not be able to record a community fork.",
        sourceExportHash: communityExport.json().exportArtifact.hash
      }
    });
    expect(blockedFork.statusCode).toBe(403);

    const fork = await app.inject({
      method: "POST",
      url: "/communities/community-vancouver/forks",
      payload: {
        steward: "demo-curator",
        forkName: "Vancouver Transit Civic Archive",
        forkSlug: "vancouver-transit-civic-archive",
        reason: "Create an independently hosted read-only civic archive.",
        sourceExportHash: communityExport.json().exportArtifact.hash
      }
    });
    expect(fork.statusCode).toBe(200);
    expect(fork.json().fork).toMatchObject({
      sourceCommunityId: "community-vancouver",
      forkName: "Vancouver Transit Civic Archive",
      forkSlug: "vancouver-transit-civic-archive",
      sourceExportHash: communityExport.json().exportArtifact.hash,
      sourceManifestHash: communityExport.json().bundle.manifestHash,
      createdBy: "demo-curator"
    });
    expect(fork.json().metadataArtifact).toMatchObject({
      hash: fork.json().fork.metadataHash,
      value: {
        artifactKind: "community-fork",
        schemaVersion: "pc-community-fork-v1",
        sourceCommunityId: "community-vancouver",
        sourceExportHash: communityExport.json().exportArtifact.hash,
        sourceManifestHash: communityExport.json().bundle.manifestHash,
        sourceQuestionIds: expect.arrayContaining([questionId]),
        sourceArchiveHashes: expect.arrayContaining([archiveExport.json().archiveRecord.archiveHash])
      }
    });

    const forkRecords = await app.inject({ method: "GET", url: "/communities/community-vancouver/forks" });
    expect(forkRecords.statusCode).toBe(200);
    expect(forkRecords.json().forks).toEqual([expect.objectContaining({ id: fork.json().fork.id, metadataHash: fork.json().fork.metadataHash })]);

    const forkEvents = await app.inject({ method: "GET", url: "/registry/events?subjectId=community-vancouver&eventType=CommunityForked" });
    expect(forkEvents.statusCode).toBe(200);
    expect(forkEvents.json().events[0]).toMatchObject({
      eventType: "CommunityForked",
      subjectId: "community-vancouver",
      actor: "demo-curator",
      previousHash: communityExport.json().exportArtifact.hash,
      newHash: fork.json().fork.metadataHash
    });

    const forkProtocolTransactions = await app.inject({
      method: "GET",
      url: "/registry/protocol-transactions?subjectId=community-vancouver&sourceModule=QuestionRegistry"
    });
    expect(forkProtocolTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(forkProtocolTransactions.json());
    expect(forkProtocolTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toContain("CommunityForked");

    const exportAfterFork = await app.inject({ method: "GET", url: "/communities/community-vancouver/export" });
    expect(exportAfterFork.statusCode).toBe(200);
    PublicApiV0CommunityExportResponseSchema.parse(exportAfterFork.json());
    expect(exportAfterFork.json().protocol).toMatchObject({
      schemaVersion: "community-export-v0",
      ids: { forkIds: [fork.json().fork.id] },
      hashes: {
        forkMetadataHashes: [fork.json().fork.metadataHash],
        forkSourceExportHashes: [communityExport.json().exportArtifact.hash]
      },
      statuses: { forkCount: 1 }
    });
    expect(exportAfterFork.json().exportArtifact.artifact.forks).toEqual([
      expect.objectContaining({ id: fork.json().fork.id, metadataHash: fork.json().fork.metadataHash })
    ]);
    expect(exportAfterFork.json().exportArtifact.artifact.events.map((event: { eventType: string }) => event.eventType)).toContain("CommunityForked");
    expect(exportAfterFork.json().bundle.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "community-fork", hash: fork.json().fork.metadataHash }),
        expect.objectContaining({ kind: "community-export", hash: communityExport.json().exportArtifact.hash })
      ])
    );

    const missingFrontendConfig = await app.inject({ method: "GET", url: "/communities/community-vancouver/frontend-config" });
    expect(missingFrontendConfig.statusCode).toBe(200);
    expect(missingFrontendConfig.json()).toMatchObject({ communityId: "community-vancouver", frontendConfig: null, artifact: null });

    const blockedFrontendConfig = await app.inject({
      method: "POST",
      url: "/communities/community-vancouver/frontend-config",
      payload: {
        steward: "demo-resident",
        displayName: "Resident client",
        tagline: "This should not be accepted."
      }
    });
    expect(blockedFrontendConfig.statusCode).toBe(403);

    const frontendConfig = await app.inject({
      method: "POST",
      url: "/communities/community-vancouver/frontend-config",
      payload: {
        steward: "demo-curator",
        displayName: "Vancouver Transit Civic Archive",
        tagline: "Portable civic records for transit and public space.",
        theme: { primary: "#14532d", accent: "#facc15", background: "#f8fafc" },
        enabledViews: ["Overview", "Questions", "Archives", "Results", "Discussion", "Adoption", "Forks"],
        navigation: [
          { label: "Questions", view: "Questions" },
          { label: "Archives", view: "Archives" },
          { label: "Forks", view: "Forks" }
        ],
        externalLinks: [{ label: "Source repo", url: "https://example.org/popular-consensus" }]
      }
    });
    expect(frontendConfig.statusCode).toBe(200);
    expect(frontendConfig.json().frontendConfig).toMatchObject({
      communityId: "community-vancouver",
      configHash: frontendConfig.json().configArtifact.hash,
      createdBy: "demo-curator"
    });
    expect(frontendConfig.json().configArtifact).toMatchObject({
      value: {
        artifactKind: "community-frontend-config",
        schemaVersion: "pc-community-frontend-config-v1",
        communityId: "community-vancouver",
        displayName: "Vancouver Transit Civic Archive",
        theme: { primary: "#14532d", accent: "#facc15", background: "#f8fafc" }
      }
    });

    const frontendConfigRead = await app.inject({ method: "GET", url: "/communities/community-vancouver/frontend-config" });
    expect(frontendConfigRead.statusCode).toBe(200);
    expect(frontendConfigRead.json()).toMatchObject({
      frontendConfig: { configHash: frontendConfig.json().configArtifact.hash },
      artifact: { hash: frontendConfig.json().configArtifact.hash, value: { displayName: "Vancouver Transit Civic Archive" } }
    });

    const frontendEvents = await app.inject({
      method: "GET",
      url: "/registry/events?subjectId=community-vancouver&eventType=CommunityFrontendConfigUpdated"
    });
    expect(frontendEvents.statusCode).toBe(200);
    expect(frontendEvents.json().events[0]).toMatchObject({
      eventType: "CommunityFrontendConfigUpdated",
      subjectId: "community-vancouver",
      actor: "demo-curator",
      previousHash: null,
      newHash: frontendConfig.json().configArtifact.hash
    });

    const frontendProtocolTransactions = await app.inject({
      method: "GET",
      url: "/registry/protocol-transactions?subjectId=community-vancouver&sourceModule=SocialGraph"
    });
    expect(frontendProtocolTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(frontendProtocolTransactions.json());
    expect(frontendProtocolTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toContain(
      "CommunityFrontendConfigUpdated"
    );

    const exportAfterConfig = await app.inject({ method: "GET", url: "/communities/community-vancouver/export" });
    expect(exportAfterConfig.statusCode).toBe(200);
    PublicApiV0CommunityExportResponseSchema.parse(exportAfterConfig.json());
    expect(exportAfterConfig.json().protocol).toMatchObject({
      schemaVersion: "community-export-v0",
      ids: { frontendConfigId: frontendConfig.json().frontendConfig.id },
      hashes: { frontendConfigHash: frontendConfig.json().configArtifact.hash },
      statuses: { frontendConfigStatus: "Configured" }
    });
    expect(exportAfterConfig.json().exportArtifact.artifact).toMatchObject({
      frontendConfig: { configHash: frontendConfig.json().configArtifact.hash }
    });
    expect(exportAfterConfig.json().exportArtifact.artifact.events.map((event: { eventType: string }) => event.eventType)).toContain(
      "CommunityFrontendConfigUpdated"
    );
    expect(exportAfterConfig.json().bundle.artifacts).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "community-frontend-config", hash: frontendConfig.json().configArtifact.hash })])
    );

    const eventCountBeforeImportReplay = await prisma.registryEvent.count();
    const importReplay = await app.inject({
      method: "POST",
      url: "/communities/imports/replay",
      payload: { bundle: exportAfterConfig.json().bundle }
    });
    expect(importReplay.statusCode).toBe(200);
    PublicApiV0CommunityImportReplayResponseSchema.parse(importReplay.json());
    expect(importReplay.json()).toMatchObject({
      status: "Verified",
      readOnly: true,
      rebuilt: {
        communityId: "community-vancouver",
        slug: "vancouver-transit",
        source: "export-bundle",
        readOnly: true,
        questionCount: expect.any(Number),
        policyCount: expect.any(Number),
        forkCount: 1,
        archiveCount: 1,
        frontendConfigHash: frontendConfig.json().configArtifact.hash,
        artifactManifestHash: exportAfterConfig.json().bundle.manifestHash
      },
      protocol: {
        schemaVersion: "community-import-replay-v0",
        hashes: {
          artifactManifestHash: exportAfterConfig.json().bundle.manifestHash,
          frontendConfigHash: frontendConfig.json().configArtifact.hash
        },
        statuses: { replayStatus: "Verified", failedChecks: [] },
        authority: { importMode: "read-only", mutatesDatabase: false }
      }
    });
    expect(importReplay.json().checks.every((check: { ok: boolean }) => check.ok)).toBe(true);
    expect(importReplay.json().checks.map((check: { id: string }) => check.id)).toEqual(
      expect.arrayContaining(["root-hash", "manifest-references-present", "commitment-hashes", "read-only-import"])
    );
    expect(await prisma.registryEvent.count()).toBe(eventCountBeforeImportReplay);

    const tamperedBundle = JSON.parse(JSON.stringify(exportAfterConfig.json().bundle));
    tamperedBundle.root.value.community.name = "Tampered Archive";
    const tamperedReplay = await app.inject({
      method: "POST",
      url: "/communities/imports/replay",
      payload: { bundle: tamperedBundle }
    });
    expect(tamperedReplay.statusCode).toBe(200);
    PublicApiV0CommunityImportReplayResponseSchema.parse(tamperedReplay.json());
    expect(tamperedReplay.json().status).toBe("Mismatch");
    expect(tamperedReplay.json().checks.find((check: { id: string }) => check.id === "root-hash")).toMatchObject({ ok: false });

    const archives = await app.inject({ method: "GET", url: "/archives?communityId=community-vancouver&archivedBy=demo-curator&limit=1" });
    expect(archives.statusCode).toBe(200);
    PublicApiV0ArchivesResponseSchema.parse(archives.json());
    expect(archives.json().page).toMatchObject({ limit: 1, cursor: "0", total: 1, hasMore: false });
    expect(archives.json().archives[0]).toMatchObject({
      questionId,
      archiveHash: archiveExport.json().archiveRecord.archiveHash,
      question: { communityId: "community-vancouver", status: "Archived" }
    });
    expect(archives.json().protocol).toMatchObject({
      schemaVersion: "archives-index-v0",
      hashes: { archiveHashes: [archiveExport.json().archiveRecord.archiveHash] },
      authority: { archivedBy: ["demo-curator"], authorityLevels: ["Advisory"] }
    });

    const resultArtifacts = await app.inject({ method: "GET", url: `/results/artifacts?questionId=${questionId}&finalStatus=Finalized&limit=1` });
    expect(resultArtifacts.statusCode).toBe(200);
    PublicApiV0ResultArtifactsResponseSchema.parse(resultArtifacts.json());
    expect(resultArtifacts.json().page).toMatchObject({ limit: 1, cursor: "0", total: 1, hasMore: false });
    expect(resultArtifacts.json().resultArtifacts[0]).toMatchObject({
      questionId,
      pollId,
      finalStatus: "Finalized",
      resultArtifactHash: resultRuling.json().correctedArtifact.hash,
      authorityLevel: "Advisory"
    });
    expect(resultArtifacts.json().protocol).toMatchObject({
      schemaVersion: "result-artifacts-index-v0",
      hashes: { resultArtifactHashes: [resultRuling.json().correctedArtifact.hash] },
      authority: { authorityLevels: ["Advisory"], credentialSchemaIds: ["credential-vancouver-resident"] }
    });

    const history = await app.inject({ method: "GET", url: `/questions/${questionId}/history` });
    expect(history.statusCode).toBe(200);
    expect(history.json().events.map((event: { eventType: string }) => event.eventType)).toContain("QuestionAmended");
    expect(history.json().events.map((event: { eventType: string }) => event.eventType)).toContain("QuestionAccepted");
    expect(history.json().events.map((event: { eventType: string }) => event.eventType)).toContain("PollOpened");

    const bonds = await app.inject({ method: "GET", url: "/registry/bonds" });
    expect(bonds.statusCode).toBe(200);
    expect(bonds.json().bonds.some((bond: { id: string; status: string }) => bond.id === createdBody.proposalBondId && bond.status === "Refunded")).toBe(
      true
    );
    expect(bonds.json().bonds.some((bond: { id: string; status: string }) => bond.id === challengeBondId && bond.status === "Refunded")).toBe(true);

    const adoption = await app.inject({ method: "GET", url: "/communities/community-vancouver/adoption" });
    expect(adoption.statusCode).toBe(200);
    expect(adoption.json().defaultAuthorityLevel).toBe("Advisory");
  });

  it("returns portable discussion views for sources, arguments, questions, and moderator notes", async () => {
    const questionId = "question-transit-demo";
    const posts = [
      { kind: "Comment", body: "General public context." },
      { kind: "Source", body: "https://example.org/transit-study" },
      { kind: "ProArgument", body: "Bus priority could improve reliability." },
      { kind: "ConArgument", body: "Local loading zones need a mitigation plan." },
      { kind: "ClarifyingQuestion", body: "Which blocks are in scope?" },
      { kind: "ModeratorNote", body: "Keep claims tied to cited evidence." }
    ];

    for (const post of posts) {
      const response = await app.inject({
        method: "POST",
        url: `/questions/${questionId}/discussion`,
        payload: { authorId: "demo-resident", kind: post.kind, body: post.body }
      });
      expect(response.statusCode).toBe(200);
    }

    const response = await app.inject({ method: "GET", url: `/questions/${questionId}/discussion?userId=demo-resident` });
    expect(response.statusCode).toBe(200);
    const parsed = PublicApiV0QuestionDiscussionResponseSchema.parse(response.json());
    const viewsByKey = Object.fromEntries(parsed.views.map((view) => [view.key, view]));

    expect(parsed.protocol).toMatchObject({
      schemaVersion: "question-discussion-v0",
      ids: { questionId, communityId: "community-vancouver" },
      statuses: {
        totalPosts: posts.length,
        countsByKind: {
          Comment: 1,
          Source: 1,
          ProArgument: 1,
          ConArgument: 1,
          ClarifyingQuestion: 1,
          ModeratorNote: 1
        },
        publishedOnly: true
      },
      authority: {
        source: "discussion-post-artifacts",
        moderationStatus: "published-posts-only"
      }
    });
    expect(parsed.views.map((view) => view.key)).toEqual([
      "comments",
      "sources",
      "proArguments",
      "conArguments",
      "clarifyingQuestions",
      "moderatorNotes"
    ]);
    expect(viewsByKey.sources.posts[0]).toMatchObject({ kind: "Source", body: "https://example.org/transit-study" });
    expect(viewsByKey.proArguments.posts[0]).toMatchObject({ kind: "ProArgument", body: "Bus priority could improve reliability." });
    expect(viewsByKey.conArguments.posts[0]).toMatchObject({ kind: "ConArgument", body: "Local loading zones need a mitigation plan." });
    expect(viewsByKey.clarifyingQuestions.posts[0]).toMatchObject({ kind: "ClarifyingQuestion", body: "Which blocks are in scope?" });
    expect(viewsByKey.moderatorNotes.posts[0]).toMatchObject({ kind: "ModeratorNote", body: "Keep claims tied to cited evidence." });
    expect(response.json().protocol.hashes.bodyHashesByView.sources).toHaveLength(1);
  });

  it("records transparent discussion moderation actions and author appeals", async () => {
    const questionId = "question-transit-demo";
    const discussionPost = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/discussion`,
      payload: { authorId: "demo-resident", kind: "Comment", body: "This needs moderation review." }
    });
    expect(discussionPost.statusCode).toBe(200);
    const postId = discussionPost.json().post.id as string;

    const blockedModeration = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/discussion/${postId}/moderation`,
      payload: { moderatorId: "demo-resident", action: "HidePost", reasonCode: "Spam", reason: "Resident cannot moderate their own thread." }
    });
    expect(blockedModeration.statusCode).toBe(403);

    const moderation = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/discussion/${postId}/moderation`,
      payload: { moderatorId: "demo-curator", action: "HidePost", reasonCode: "Spam", reason: "Repeated duplicate content." }
    });
    expect(moderation.statusCode).toBe(200);
    expect(moderation.json().moderationArtifact.value).toMatchObject({
      artifactKind: "discussion-moderation",
      schemaVersion: "pc-discussion-moderation-v1",
      postId,
      reasonCode: "Spam",
      previousStatus: "Published",
      newStatus: "Hidden"
    });
    const moderationRecordId = moderation.json().moderationRecord.id as string;

    const hiddenDiscussion = await app.inject({ method: "GET", url: `/questions/${questionId}/discussion?userId=demo-resident` });
    expect(hiddenDiscussion.statusCode).toBe(200);
    expect(hiddenDiscussion.json().discussion).toHaveLength(0);

    const moderationLog = await app.inject({ method: "GET", url: `/questions/${questionId}/moderation?userId=demo-resident` });
    expect(moderationLog.statusCode).toBe(200);
    PublicApiV0QuestionModerationResponseSchema.parse(moderationLog.json());
    expect(moderationLog.json()).toMatchObject({
      protocol: {
        schemaVersion: "question-moderation-v0",
        statuses: {
          moderationRecordCount: 1,
          appealCount: 0,
          actionCounts: { HidePost: 1, RestorePost: 0 }
        },
        authority: { source: "discussion-moderation-artifacts", resultImpact: "none", appealModel: "author-appeal" }
      },
      moderationRecords: [
        {
          id: moderationRecordId,
          postId,
          postBodyHash: discussionPost.json().bodyArtifact.hash,
          reason: "Repeated duplicate content."
        }
      ],
      appeals: []
    });

    const blockedAppeal = await app.inject({
      method: "POST",
      url: `/moderation/${moderationRecordId}/appeals`,
      payload: { appellantId: "demo-challenger", appeal: "I was not the author." }
    });
    expect(blockedAppeal.statusCode).toBe(403);

    const appeal = await app.inject({
      method: "POST",
      url: `/moderation/${moderationRecordId}/appeals`,
      payload: { appellantId: "demo-resident", appeal: "This was a one-off clarification, not spam." }
    });
    expect(appeal.statusCode).toBe(200);
    expect(appeal.json().appealArtifact.value).toMatchObject({
      artifactKind: "discussion-moderation-appeal",
      schemaVersion: "pc-discussion-moderation-appeal-v1",
      moderationRecordId,
      appellantId: "demo-resident"
    });
    const appealId = appeal.json().appeal.id as string;

    const ruling = await app.inject({
      method: "POST",
      url: `/moderation/appeals/${appealId}/ruling`,
      payload: { moderatorId: "demo-curator", ruling: "Overturned", resolution: "Appeal accepted; restore the post." }
    });
    expect(ruling.statusCode).toBe(200);
    expect(ruling.json()).toMatchObject({
      postStatus: "Published",
      resolutionArtifact: {
        value: {
          artifactKind: "discussion-moderation-resolution",
          schemaVersion: "pc-discussion-moderation-resolution-v1",
          ruling: "Overturned"
        }
      },
      appeal: { id: appealId, status: "Overturned", resolution: "Appeal accepted; restore the post." }
    });

    const restoredDiscussion = await app.inject({ method: "GET", url: `/questions/${questionId}/discussion?userId=demo-resident` });
    expect(restoredDiscussion.statusCode).toBe(200);
    expect(restoredDiscussion.json().discussion[0]).toMatchObject({ id: postId, body: "This needs moderation review." });

    const resolvedLog = await app.inject({ method: "GET", url: `/questions/${questionId}/moderation?userId=demo-resident` });
    expect(resolvedLog.statusCode).toBe(200);
    PublicApiV0QuestionModerationResponseSchema.parse(resolvedLog.json());
    expect(resolvedLog.json()).toMatchObject({
      protocol: { statuses: { moderationRecordCount: 1, appealCount: 1, appealStatuses: { Overturned: 1 } } },
      appeals: [
        {
          id: appealId,
          moderationRecordId,
          appeal: "This was a one-off clarification, not spam.",
          status: "Overturned",
          resolution: "Appeal accepted; restore the post."
        }
      ]
    });

    const events = await app.inject({ method: "GET", url: `/registry/events?subjectId=${questionId}` });
    expect(events.statusCode).toBe(200);
    expect(events.json().events.map((event: { eventType: string }) => event.eventType)).toEqual(
      expect.arrayContaining(["DiscussionModerated", "DiscussionModerationAppealed", "DiscussionModerationAppealResolved"])
    );

    const socialGraphTransactions = await app.inject({
      method: "GET",
      url: `/registry/protocol-transactions?subjectId=${questionId}&sourceModule=SocialGraph`
    });
    expect(socialGraphTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(socialGraphTransactions.json());
    expect(socialGraphTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual(
      expect.arrayContaining(["DiscussionPosted", "DiscussionModerated", "DiscussionModerationAppealed", "DiscussionModerationAppealResolved"])
    );

    const communityExport = await app.inject({ method: "GET", url: "/communities/community-vancouver/export?userId=demo-curator" });
    expect(communityExport.statusCode).toBe(200);
    PublicApiV0CommunityExportResponseSchema.parse(communityExport.json());
    expect(communityExport.json().protocol).toMatchObject({
      statuses: { moderationRecordCount: 1, moderationAppealCount: 1 },
      hashes: {
        moderationReasonHashes: [moderation.json().moderationArtifact.hash],
        moderationAppealHashes: [appeal.json().appealArtifact.hash],
        moderationResolutionHashes: [ruling.json().resolutionArtifact.hash]
      }
    });
    expect(communityExport.json().exportArtifact.artifact).toMatchObject({
      moderationRecords: [expect.objectContaining({ id: moderationRecordId, reasonHash: moderation.json().moderationArtifact.hash })],
      moderationAppeals: [expect.objectContaining({ id: appealId, resolutionHash: ruling.json().resolutionArtifact.hash })]
    });
    expect(communityExport.json().bundle.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "discussion-moderation", hash: moderation.json().moderationArtifact.hash }),
        expect.objectContaining({ kind: "discussion-moderation-appeal", hash: appeal.json().appealArtifact.hash }),
        expect.objectContaining({ kind: "discussion-moderation-resolution", hash: ruling.json().resolutionArtifact.hash })
      ])
    );
  });

  it("publishes follow, topic, and community discovery data", async () => {
    const communityFollow = await app.inject({
      method: "POST",
      url: "/communities/community-vancouver/follow",
      payload: { userId: "demo-resident" }
    });
    expect(communityFollow.statusCode).toBe(200);
    expect(communityFollow.json().followArtifact.value).toMatchObject({
      artifactKind: "social-follow",
      schemaVersion: "pc-social-follow-v1",
      targetType: "Community",
      targetId: "community-vancouver",
      userId: "demo-resident",
      profileId: "did:pc:demo-resident"
    });

    const topicFollow = await app.inject({
      method: "POST",
      url: "/topics/transit/follow",
      payload: { userId: "demo-resident" }
    });
    expect(topicFollow.statusCode).toBe(200);
    expect(topicFollow.json().followArtifact.value).toMatchObject({
      artifactKind: "social-follow",
      schemaVersion: "pc-social-follow-v1",
      targetType: "Topic",
      targetId: "transit",
      topicId: "transit"
    });

    const communityFollowTransactions = await app.inject({
      method: "GET",
      url: "/registry/protocol-transactions?subjectId=community-vancouver&sourceModule=SocialGraph"
    });
    expect(communityFollowTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(communityFollowTransactions.json());
    expect(communityFollowTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toContain(
      "CommunityFollowed"
    );

    const topicFollowTransactions = await app.inject({
      method: "GET",
      url: "/registry/protocol-transactions?subjectId=topic:transit&sourceModule=SocialGraph"
    });
    expect(topicFollowTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(topicFollowTransactions.json());
    expect(topicFollowTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual(["TopicFollowed"]);

    const discovery = await app.inject({ method: "GET", url: "/discovery?userId=demo-resident" });
    expect(discovery.statusCode).toBe(200);
    PublicApiV0DiscoveryResponseSchema.parse(discovery.json());
    expect(discovery.json().protocol).toMatchObject({
      schemaVersion: "discovery-index-v0",
      ids: {
        activeUserId: "demo-resident",
        communityFollowIds: [communityFollow.json().follow.id],
        topicFollowIds: [topicFollow.json().follow.id]
      },
      hashes: {
        communityFollowHashes: [communityFollow.json().followArtifact.hash],
        topicFollowHashes: [topicFollow.json().followArtifact.hash]
      },
      statuses: { followedCommunityCount: 1, followedTopicCount: 1 },
      authority: { source: "visible-community-question-index", discoveryMode: "derived-topic-index" }
    });
    expect(discovery.json().communities.find((community: { id: string }) => community.id === "community-vancouver")).toMatchObject({
      followerCount: 1,
      followedByActiveUser: true
    });
    expect(discovery.json().topics.find((topic: { topicId: string }) => topic.topicId === "transit")).toMatchObject({
      questionCount: expect.any(Number),
      communityCount: expect.any(Number),
      followerCount: 1,
      followedByActiveUser: true
    });

    const communityExport = await app.inject({ method: "GET", url: "/communities/community-vancouver/export?userId=demo-resident" });
    expect(communityExport.statusCode).toBe(200);
    PublicApiV0CommunityExportResponseSchema.parse(communityExport.json());
    expect(communityExport.json().protocol).toMatchObject({
      statuses: { communityFollowCount: 1, topicFollowCount: 1 },
      hashes: {
        communityFollowHashes: [communityFollow.json().followArtifact.hash],
        topicFollowHashes: [topicFollow.json().followArtifact.hash]
      }
    });
    expect(communityExport.json().exportArtifact.artifact).toMatchObject({
      communityFollows: [expect.objectContaining({ id: communityFollow.json().follow.id, followHash: communityFollow.json().followArtifact.hash })],
      topicFollows: [expect.objectContaining({ id: topicFollow.json().follow.id, followHash: topicFollow.json().followArtifact.hash })]
    });
    expect(communityExport.json().bundle.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "social-follow", hash: communityFollow.json().followArtifact.hash, role: "community-follow" }),
        expect.objectContaining({ kind: "social-follow", hash: topicFollow.json().followArtifact.hash, role: "topic-follow" })
      ])
    );
  });

  it("registers credential schemas and issuers for the local credential registry", async () => {
    const seededSchemas = await app.inject({ method: "GET", url: "/credential-schemas" });
    expect(seededSchemas.statusCode).toBe(200);
    expect(seededSchemas.json().credentialSchemas.map((schema: { id: string }) => schema.id)).toContain("credential-vancouver-resident");

    const schema = await app.inject({
      method: "POST",
      url: "/credential-schemas",
      payload: {
        steward: "demo-curator",
        credentialSchemaId: "credential-neighborhood-member",
        name: "Neighborhood Member",
        issuerRegistryId: "issuer-registry-demo",
        eligibilityClaim: "Local neighborhood membership",
        nullifierDomainRule: "H(secret, pollId, credentialSchemaId)"
      }
    });
    expect(schema.statusCode).toBe(200);
    expect(schema.json().credentialSchema).toMatchObject({ id: "credential-neighborhood-member", status: "Active" });
    expect(schema.json().schemaArtifact.value).toMatchObject({
      artifactKind: "credential-schema",
      schemaVersion: "pc-credential-schema-v1"
    });

    const schemaTransactions = await app.inject({
      method: "GET",
      url: "/registry/protocol-transactions?subjectId=credential-neighborhood-member&sourceModule=CredentialRegistry"
    });
    expect(schemaTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(schemaTransactions.json());
    expect(schemaTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual([
      "CredentialSchemaRegistered"
    ]);

    const issuer = await app.inject({
      method: "POST",
      url: "/credential-issuers",
      payload: {
        steward: "demo-curator",
        issuerId: "issuer-neighborhood-member",
        publicKey: "dev-neighborhood-issuer-key",
        schemaIds: ["credential-neighborhood-member"],
        metadata: "Neighborhood member demo issuer"
      }
    });
    expect(issuer.statusCode).toBe(200);
    expect(issuer.json().credentialIssuer).toMatchObject({ id: "issuer-neighborhood-member", status: "Active" });
    expect(issuer.json().issuerArtifact.value).toMatchObject({
      artifactKind: "credential-issuer",
      schemaVersion: "pc-credential-issuer-v1"
    });

    const issuerRegistrationTransactions = await app.inject({
      method: "GET",
      url: "/registry/protocol-transactions?subjectId=issuer-neighborhood-member&sourceModule=CredentialRegistry"
    });
    expect(issuerRegistrationTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(issuerRegistrationTransactions.json());
    expect(issuerRegistrationTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual([
      "CredentialIssuerRegistered"
    ]);

    const affectedQuestion = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should suspended issuers annotate affected questions?",
        body: "A question using the neighborhood credential schema.",
        sponsorDisclosure: "Demo sponsor",
        proposer: "demo-proposer",
        credentialSchemaId: "credential-neighborhood-member"
      }
    });
    expect(affectedQuestion.statusCode).toBe(200);
    const affectedQuestionId = affectedQuestion.json().question.id as string;

    const suspension = await app.inject({
      method: "POST",
      url: "/credential-issuers/issuer-neighborhood-member/suspend",
      payload: { steward: "demo-curator", reason: "Issuer paused after review." }
    });
    expect(suspension.statusCode).toBe(200);
    expect(suspension.json().credentialIssuer).toMatchObject({ id: "issuer-neighborhood-member", status: "Suspended" });
    expect(suspension.json().suspensionArtifact.value).toMatchObject({
      artifactKind: "credential-issuer-suspension",
      schemaVersion: "pc-credential-issuer-suspension-v1"
    });

    const issuerLifecycleTransactions = await app.inject({
      method: "GET",
      url: "/registry/protocol-transactions?subjectId=issuer-neighborhood-member&sourceModule=CredentialRegistry"
    });
    expect(issuerLifecycleTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(issuerLifecycleTransactions.json());
    expect(issuerLifecycleTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual(
      expect.arrayContaining(["CredentialIssuerRegistered", "CredentialIssuerSuspended"])
    );

    const annotatedRecord = await app.inject({ method: "GET", url: `/public/questions/${affectedQuestionId}/civic-record` });
    expect(annotatedRecord.statusCode).toBe(200);
    PublicApiV0CivicRecordResponseSchema.parse(annotatedRecord.json());
    expect(annotatedRecord.json()).toMatchObject({
      protocol: {
        ids: { credentialIssuerIds: ["issuer-neighborhood-member"] },
        hashes: {
          credentialIssuerMetadataHashes: [issuer.json().issuerArtifact.hash],
          credentialIssuerSuspensionHashes: [suspension.json().suspensionArtifact.hash]
        },
        statuses: {
          credentialIssuerAnnotations: [
            {
              issuerId: "issuer-neighborhood-member",
              status: "Suspended",
              affectedQuestionIds: [affectedQuestionId]
            }
          ]
        }
      },
      credentialIssuerAnnotations: [
        {
          issuerId: "issuer-neighborhood-member",
          status: "Suspended",
          suspensionHash: suspension.json().suspensionArtifact.hash,
          affectedQuestionIds: [affectedQuestionId]
        }
      ]
    });

    const demoQuestion = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should suspended demo issuers block credentials?",
        body: "A default credential-schema poll used to prove suspended issuer effects.",
        sponsorDisclosure: "Demo sponsor",
        proposer: "demo-proposer"
      }
    });
    expect(demoQuestion.statusCode).toBe(200);
    const demoQuestionId = demoQuestion.json().question.id as string;
    const demoPollId = demoQuestion.json().question.poll.id as string;
    expect((await app.inject({ method: "POST", url: `/questions/${demoQuestionId}/accept`, payload: { curator: "demo-curator" } })).statusCode).toBe(200);
    const issuedBeforeSuspension = await app.inject({
      method: "POST",
      url: "/credentials/demo-resident",
      payload: { holderAlias: "issuer-suspension-voter" }
    });
    expect(issuedBeforeSuspension.statusCode).toBe(200);

    const demoIssuerSuspension = await app.inject({
      method: "POST",
      url: "/credential-issuers/issuer-demo-resident/suspend",
      payload: { steward: "demo-curator", reason: "Demo issuer paused to prove credential effects." }
    });
    expect(demoIssuerSuspension.statusCode).toBe(200);
    const blockedVote = await app.inject({
      method: "POST",
      url: `/polls/${demoPollId}/vote`,
      payload: {
        credentialId: issuedBeforeSuspension.json().credential.credentialId,
        credentialSecret: issuedBeforeSuspension.json().credential.secret,
        choice: "support"
      }
    });
    expect(blockedVote.statusCode).toBe(403);
    expect(blockedVote.json().error).toBe("Credential issuer is not active");

    const communityExport = await app.inject({ method: "GET", url: "/communities/community-vancouver/export?userId=demo-curator" });
    expect(communityExport.statusCode).toBe(200);
    PublicApiV0CommunityExportResponseSchema.parse(communityExport.json());
    expect(communityExport.json().protocol).toMatchObject({
      hashes: { credentialIssuerSuspensionHashes: expect.arrayContaining([suspension.json().suspensionArtifact.hash]) },
      statuses: { credentialIssuerAnnotationCount: expect.any(Number) },
      authority: { credentialIssuerAnnotationRule: "non-active credential issuers are annotated on affected questions by credential schema" }
    });
    expect(communityExport.json().exportArtifact.artifact.credentialIssuerAnnotations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issuerId: "issuer-neighborhood-member",
          suspensionHash: suspension.json().suspensionArtifact.hash,
          affectedQuestionIds: [affectedQuestionId]
        })
      ])
    );

    const events = await app.inject({ method: "GET", url: "/registry/events" });
    expect(events.statusCode).toBe(200);
    expect(events.json().events.map((event: { eventType: string }) => event.eventType)).toEqual(
      expect.arrayContaining(["CredentialSchemaRegistered", "CredentialIssuerRegistered", "CredentialIssuerSuspended"])
    );
  });

  it("enforces credential revocation roots and expiry windows", async () => {
    const question = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should credential revocation roots block revoked credentials?",
        body: "A poll used to prove revocation and expiry enforcement.",
        sponsorDisclosure: "Demo sponsor",
        proposer: "demo-proposer"
      }
    });
    expect(question.statusCode).toBe(200);
    const questionId = question.json().question.id as string;
    const pollId = question.json().question.poll.id as string;
    expect((await app.inject({ method: "POST", url: `/questions/${questionId}/accept`, payload: { curator: "demo-curator" } })).statusCode).toBe(200);

    const credential = await app.inject({
      method: "POST",
      url: "/credentials/demo-resident",
      payload: { holderAlias: "revocation-root-voter" }
    });
    expect(credential.statusCode).toBe(200);
    const issued = credential.json().credential;

    const revocation = await app.inject({
      method: "POST",
      url: `/credentials/${issued.credentialId}/revoke`,
      payload: { steward: "demo-curator", reason: "Holder no longer satisfies the demo eligibility rule." }
    });
    expect(revocation.statusCode).toBe(200);
    expect(revocation.json().revocationArtifact.value).toMatchObject({
      artifactKind: "credential-revocation",
      schemaVersion: "pc-credential-revocation-v1",
      credentialId: issued.credentialId,
      schemaId: "credential-vancouver-resident"
    });
    expect(revocation.json().revocationRoot.value).toMatchObject({
      artifactKind: "credential-revocation-root",
      schemaVersion: "pc-credential-revocation-root-v1",
      schemaId: "credential-vancouver-resident",
      revokedCredentialCount: 1,
      revocationHashes: [revocation.json().revocationArtifact.hash]
    });
    expect(revocation.json().credentialRevocation).toMatchObject({
      credentialId: issued.credentialId,
      schemaId: "credential-vancouver-resident",
      rootHash: revocation.json().revocationRoot.hash
    });

    const issuedCredentialTransactions = await app.inject({
      method: "GET",
      url: `/registry/protocol-transactions?subjectId=${issued.credentialId}&sourceModule=CredentialRegistry`
    });
    expect(issuedCredentialTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(issuedCredentialTransactions.json());
    expect(issuedCredentialTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual(
      expect.arrayContaining(["CredentialIssued", "CredentialRevoked"])
    );

    const revocationRootTransactions = await app.inject({
      method: "GET",
      url: "/registry/protocol-transactions?subjectId=credential-vancouver-resident&sourceModule=CredentialRegistry"
    });
    expect(revocationRootTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(revocationRootTransactions.json());
    expect(revocationRootTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toContain(
      "CredentialRevocationRootUpdated"
    );

    const schemas = await app.inject({ method: "GET", url: "/credential-schemas" });
    expect(schemas.statusCode).toBe(200);
    expect(schemas.json().credentialSchemas.find((schema: { id: string }) => schema.id === "credential-vancouver-resident")).toMatchObject({
      revocationRoot: revocation.json().revocationRoot.hash
    });

    const revokedVote = await app.inject({
      method: "POST",
      url: `/polls/${pollId}/vote`,
      payload: { credentialId: issued.credentialId, credentialSecret: issued.secret, choice: "support" }
    });
    expect(revokedVote.statusCode).toBe(403);
    expect(revokedVote.json().error).toBe("Credential is revoked");

    await prisma.credentialSchema.update({ where: { id: "credential-vancouver-resident" }, data: { expiresAfter: 1 } });
    const expiringCredential = await app.inject({
      method: "POST",
      url: "/credentials/demo-resident",
      payload: { holderAlias: "expired-window-voter" }
    });
    expect(expiringCredential.statusCode).toBe(200);
    const expiringIssued = expiringCredential.json().credential;
    await prisma.credential.update({
      where: { id: expiringIssued.credentialId },
      data: { createdAt: new Date(Date.now() - 2_000) }
    });

    const expiredVote = await app.inject({
      method: "POST",
      url: `/polls/${pollId}/vote`,
      payload: { credentialId: expiringIssued.credentialId, credentialSecret: expiringIssued.secret, choice: "support" }
    });
    expect(expiredVote.statusCode).toBe(403);
    expect(expiredVote.json().error).toBe("Credential is expired");

    const rootEvents = await app.inject({
      method: "GET",
      url: "/registry/events?subjectId=credential-vancouver-resident&eventType=CredentialRevocationRootUpdated"
    });
    expect(rootEvents.statusCode).toBe(200);
    expect(rootEvents.json().events).toEqual([
      expect.objectContaining({
        eventType: "CredentialRevocationRootUpdated",
        subjectId: "credential-vancouver-resident",
        newHash: revocation.json().revocationRoot.hash
      })
    ]);
  });

  it("exports and imports wallet-held credentials without publishing secrets", async () => {
    const question = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should wallet-held credentials move across clients?",
        body: "A poll used to prove credential import and export boundaries.",
        sponsorDisclosure: "Demo sponsor",
        proposer: "demo-proposer"
      }
    });
    expect(question.statusCode).toBe(200);
    const questionId = question.json().question.id as string;
    const pollId = question.json().question.poll.id as string;
    expect((await app.inject({ method: "POST", url: `/questions/${questionId}/accept`, payload: { curator: "demo-curator" } })).statusCode).toBe(200);

    const credential = await app.inject({
      method: "POST",
      url: "/credentials/demo-resident",
      payload: { holderAlias: "wallet-boundary-voter" }
    });
    expect(credential.statusCode).toBe(200);
    const issued = credential.json().credential;
    expect(credential.json()).toMatchObject({
      walletCredential: {
        protocol: "popular-consensus",
        schemaVersion: "wallet-credential-v0",
        credentialId: issued.credentialId,
        holderAlias: "wallet-boundary-voter",
        schemaId: "credential-vancouver-resident",
        issuerId: "issuer-demo-resident",
        secret: issued.secret
      },
      walletBoundary: {
        holderSecretLocation: "client-wallet",
        serverDoesNotStore: ["credentialSecret"]
      }
    });

    const blockedExport = await app.inject({
      method: "POST",
      url: `/credentials/${issued.credentialId}/export`,
      payload: { credentialSecret: "wrong-secret" }
    });
    expect(blockedExport.statusCode).toBe(403);

    const exported = await app.inject({
      method: "POST",
      url: `/credentials/${issued.credentialId}/export`,
      payload: { credentialSecret: issued.secret }
    });
    expect(exported.statusCode).toBe(200);
    expect(exported.json().walletCredential).toEqual(credential.json().walletCredential);

    await prisma.credential.delete({ where: { id: issued.credentialId } });
    const tamperedImport = await app.inject({
      method: "POST",
      url: "/credentials/import",
      payload: { credential: { ...exported.json().walletCredential, secret: "tampered-secret" } }
    });
    expect(tamperedImport.statusCode).toBe(400);
    expect(tamperedImport.json().error).toBe("Wallet credential id does not match its secret");

    const imported = await app.inject({
      method: "POST",
      url: "/credentials/import",
      payload: { credential: exported.json().walletCredential }
    });
    expect(imported.statusCode).toBe(200);
    expect(imported.json()).toMatchObject({
      imported: true,
      credential: { id: issued.credentialId, holderAlias: "wallet-boundary-voter" },
      walletBoundary: { importChecks: expect.arrayContaining(["not-expired", "not-revoked"]) }
    });

    const vote = await app.inject({
      method: "POST",
      url: `/polls/${pollId}/vote`,
      payload: { credentialId: issued.credentialId, credentialSecret: issued.secret, choice: "support" }
    });
    expect(vote.statusCode).toBe(200);

    const communityExport = await app.inject({ method: "GET", url: "/communities/community-vancouver/export?userId=demo-curator" });
    expect(communityExport.statusCode).toBe(200);
    expect(JSON.stringify(communityExport.json())).not.toContain(issued.secret);
  });

  it("accepts explicit credential membership and nullifier proofs for signup and voting", async () => {
    const question = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should nullifier proofs be verified before voting?",
        body: "A poll used to prove local membership/nullifier proof integration.",
        sponsorDisclosure: "Demo sponsor",
        proposer: "demo-proposer"
      }
    });
    expect(question.statusCode).toBe(200);
    const questionId = question.json().question.id as string;
    const pollId = question.json().question.poll.id as string;
    expect((await app.inject({ method: "POST", url: `/questions/${questionId}/accept`, payload: { curator: "demo-curator" } })).statusCode).toBe(200);

    const credential = await app.inject({
      method: "POST",
      url: "/credentials/demo-resident",
      payload: { holderAlias: "zk-proof-voter" }
    });
    expect(credential.statusCode).toBe(200);
    const issued = credential.json().credential;

    const proof = await app.inject({
      method: "POST",
      url: `/polls/${pollId}/credential-proof`,
      payload: { credentialId: issued.credentialId, credentialSecret: issued.secret }
    });
    expect(proof.statusCode).toBe(200);
    expect(proof.json().membershipProof).toMatchObject({
      protocol: "popular-consensus",
      schemaVersion: "credential-membership-nullifier-proof-v0",
      credentialId: issued.credentialId,
      schemaId: "credential-vancouver-resident",
      issuerId: "issuer-demo-resident",
      pollId,
      nullifier: expect.stringMatching(/^sha256:/),
      credentialCommitment: expect.stringMatching(/^sha256:/),
      proofHash: expect.stringMatching(/^sha256:/)
    });

    const signup = await app.inject({
      method: "POST",
      url: `/polls/${pollId}/signup`,
      payload: { credentialId: issued.credentialId, credentialSecret: issued.secret, membershipProof: proof.json().membershipProof }
    });
    expect(signup.statusCode).toBe(200);
    expect(signup.json()).toMatchObject({
      accepted: true,
      nullifier: proof.json().membershipProof.nullifier,
      membershipProof: proof.json().membershipProof
    });

    const tamperedVote = await app.inject({
      method: "POST",
      url: `/polls/${pollId}/vote`,
      payload: {
        credentialId: issued.credentialId,
        credentialSecret: issued.secret,
        membershipProof: { ...proof.json().membershipProof, nullifier: "sha256:tampered" },
        choice: "support"
      }
    });
    expect(tamperedVote.statusCode).toBe(403);
    expect(tamperedVote.json().error).toBe("Invalid credential membership proof");

    const vote = await app.inject({
      method: "POST",
      url: `/polls/${pollId}/vote`,
      payload: { credentialId: issued.credentialId, credentialSecret: issued.secret, membershipProof: proof.json().membershipProof, choice: "support" }
    });
    expect(vote.statusCode).toBe(200);
    expect(vote.json()).toMatchObject({
      membershipProof: proof.json().membershipProof,
      ballot: {
        nullifier: proof.json().membershipProof.nullifier,
        proofHash: expect.stringMatching(/^sha256:/)
      }
    });
  });

  it("enforces community credential trust policies across multiple issuers", async () => {
    const trustedIssuer = await app.inject({
      method: "POST",
      url: "/credential-issuers",
      payload: {
        steward: "demo-curator",
        issuerId: "issuer-community-trusted",
        publicKey: "dev-community-trusted-issuer-key",
        schemaIds: ["credential-vancouver-resident"],
        metadata: "Community trusted resident issuer"
      }
    });
    expect(trustedIssuer.statusCode).toBe(200);

    const policy = await app.inject({
      method: "POST",
      url: "/communities/community-vancouver/credential-trust-policies",
      payload: {
        steward: "demo-curator",
        credentialSchemaId: "credential-vancouver-resident",
        trustedIssuerIds: ["issuer-community-trusted"],
        mode: "AllowList"
      }
    });
    expect(policy.statusCode).toBe(200);
    expect(policy.json().policyArtifact.value).toMatchObject({
      artifactKind: "community-credential-trust-policy",
      schemaVersion: "pc-community-credential-trust-policy-v1",
      communityId: "community-vancouver",
      trustedIssuerIds: ["issuer-community-trusted"]
    });

    const policyTransactions = await app.inject({
      method: "GET",
      url: "/registry/protocol-transactions?subjectId=community-vancouver&sourceModule=CredentialRegistry"
    });
    expect(policyTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(policyTransactions.json());
    expect(policyTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toContain(
      "CommunityCredentialTrustPolicySet"
    );

    const policies = await app.inject({ method: "GET", url: "/communities/community-vancouver/credential-trust-policies?userId=demo-curator" });
    expect(policies.statusCode).toBe(200);
    PublicApiV0CredentialTrustPoliciesResponseSchema.parse(policies.json());
    expect(policies.json()).toMatchObject({
      protocol: {
        schemaVersion: "credential-trust-policies-v0",
        ids: {
          communityId: "community-vancouver",
          trustedIssuerIds: ["issuer-community-trusted"]
        },
        hashes: { policyHashes: [policy.json().policyArtifact.hash] },
        statuses: { activePolicyCount: 1 }
      },
      policies: [expect.objectContaining({ trustedIssuerIds: ["issuer-community-trusted"], mode: "AllowList", status: "Active" })]
    });

    const question = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should communities choose trusted credential issuers?",
        body: "A poll used to prove community issuer trust enforcement.",
        sponsorDisclosure: "Demo sponsor",
        proposer: "demo-proposer"
      }
    });
    expect(question.statusCode).toBe(200);
    const questionId = question.json().question.id as string;
    const pollId = question.json().question.poll.id as string;
    expect((await app.inject({ method: "POST", url: `/questions/${questionId}/accept`, payload: { curator: "demo-curator" } })).statusCode).toBe(200);

    const untrustedCredential = await app.inject({
      method: "POST",
      url: "/credentials/demo-resident",
      payload: { holderAlias: "untrusted-issuer-voter" }
    });
    expect(untrustedCredential.statusCode).toBe(200);
    const blockedVote = await app.inject({
      method: "POST",
      url: `/polls/${pollId}/vote`,
      payload: {
        credentialId: untrustedCredential.json().credential.credentialId,
        credentialSecret: untrustedCredential.json().credential.secret,
        choice: "support"
      }
    });
    expect(blockedVote.statusCode).toBe(403);
    expect(blockedVote.json().error).toBe("Credential issuer is not trusted by this community");

    const trustedCredential = await app.inject({
      method: "POST",
      url: "/credentials/demo-resident",
      payload: { holderAlias: "trusted-issuer-voter", issuerId: "issuer-community-trusted" }
    });
    expect(trustedCredential.statusCode).toBe(200);
    const acceptedVote = await app.inject({
      method: "POST",
      url: `/polls/${pollId}/vote`,
      payload: {
        credentialId: trustedCredential.json().credential.credentialId,
        credentialSecret: trustedCredential.json().credential.secret,
        choice: "support"
      }
    });
    expect(acceptedVote.statusCode).toBe(200);

    const communityExport = await app.inject({ method: "GET", url: "/communities/community-vancouver/export?userId=demo-curator" });
    expect(communityExport.statusCode).toBe(200);
    PublicApiV0CommunityExportResponseSchema.parse(communityExport.json());
    expect(communityExport.json().protocol).toMatchObject({
      hashes: { credentialTrustPolicyHashes: [policy.json().policyArtifact.hash] },
      statuses: { credentialTrustPolicyCount: 1, activeCredentialTrustPolicyCount: 1 },
      authority: { credentialTrustPolicyRule: "active community credential trust policies restrict accepted issuers by credential schema" }
    });
    expect(communityExport.json().exportArtifact.artifact.credentialTrustPolicies).toEqual([
      expect.objectContaining({ id: policy.json().policy.id, policyHash: policy.json().policyArtifact.hash })
    ]);
    expect(communityExport.json().bundle.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "community-credential-trust-policy", hash: policy.json().policyArtifact.hash })
      ])
    );
  });

  it("publishes tally committee metadata and activation lifecycle records", async () => {
    const proposed = await app.inject({
      method: "POST",
      url: "/communities/community-vancouver/tally-committees",
      payload: {
        steward: "demo-curator",
        name: "Vancouver Demo Threshold Committee",
        memberIds: ["demo-curator", "demo-challenger", "demo-resident"],
        threshold: 2,
        metadata: "Three local demo accounts hold future threshold tally responsibilities."
      }
    });
    expect(proposed.statusCode).toBe(200);
    expect(proposed.json().proposalArtifact.value).toMatchObject({
      artifactKind: "tally-committee-proposal",
      schemaVersion: "pc-tally-committee-proposal-v1",
      communityId: "community-vancouver",
      threshold: 2,
      memberIds: ["demo-curator", "demo-challenger", "demo-resident"]
    });
    const committeeId = proposed.json().committee.id as string;

    const initialCommittees = await app.inject({ method: "GET", url: "/communities/community-vancouver/tally-committees?userId=demo-curator" });
    expect(initialCommittees.statusCode).toBe(200);
    PublicApiV0TallyCommitteesResponseSchema.parse(initialCommittees.json());
    expect(initialCommittees.json()).toMatchObject({
      protocol: {
        schemaVersion: "tally-committees-v0",
        ids: { communityId: "community-vancouver", committeeIds: [committeeId], activeCommitteeId: null },
        hashes: { metadataHashes: [proposed.json().proposalArtifact.hash] },
        statuses: { committeeCount: 1, activeCommittee: false, Proposed: 1 }
      },
      activeCommittee: null
    });

    const activation = await app.inject({
      method: "POST",
      url: `/communities/community-vancouver/tally-committees/${committeeId}/activate`,
      payload: { steward: "demo-curator", activationRecord: "Activate committee metadata for local tally accountability." }
    });
    expect(activation.statusCode).toBe(200);
    expect(activation.json().activationArtifact.value).toMatchObject({
      artifactKind: "tally-committee-activation",
      schemaVersion: "pc-tally-committee-activation-v1",
      communityId: "community-vancouver",
      committeeId
    });

    const committees = await app.inject({ method: "GET", url: "/communities/community-vancouver/tally-committees?userId=demo-curator" });
    expect(committees.statusCode).toBe(200);
    expect(committees.json()).toMatchObject({
      protocol: {
        ids: { activeCommitteeId: committeeId },
        hashes: { activationHashes: [activation.json().activationArtifact.hash] },
        statuses: { activeCommittee: true, Active: 1 }
      },
      activeCommittee: { id: committeeId, threshold: 2, status: "Active" }
    });

    const keySetup = await app.inject({
      method: "POST",
      url: `/communities/community-vancouver/tally-committees/${committeeId}/key-setup`,
      payload: { steward: "demo-curator", ceremonyTranscript: "Demo committee publishes an aggregate threshold tally public key." }
    });
    expect(keySetup.statusCode).toBe(200);
    expect(keySetup.json().setupArtifact.value).toMatchObject({
      artifactKind: "tally-key-setup",
      schemaVersion: "pc-tally-key-setup-v1",
      communityId: "community-vancouver",
      committeeId,
      threshold: 2,
      memberIds: ["demo-curator", "demo-challenger", "demo-resident"]
    });
    const keySetupId = keySetup.json().keySetup.id as string;

    const keySetups = await app.inject({ method: "GET", url: "/communities/community-vancouver/tally-key-setups?userId=demo-curator" });
    expect(keySetups.statusCode).toBe(200);
    PublicApiV0TallyKeySetupsResponseSchema.parse(keySetups.json());
    expect(keySetups.json()).toMatchObject({
      protocol: {
        schemaVersion: "tally-key-setups-v0",
        ids: { communityId: "community-vancouver", activeKeySetupId: keySetupId, activeCommitteeId: committeeId },
        hashes: { setupHashes: [keySetup.json().setupArtifact.hash], activePublicKeyHash: keySetup.json().keySetup.publicKeyHash },
        statuses: { keySetupCount: 1, activeKeySetup: true, Active: 1 }
      },
      activeKeySetup: { id: keySetupId, committeeId, threshold: 2, status: "Active" }
    });
    const committeeTransactions = await app.inject({
      method: "GET",
      url: "/registry/protocol-transactions?subjectId=community-vancouver&sourceModule=TallyManager"
    });
    expect(committeeTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(committeeTransactions.json());
    expect(committeeTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual(
      expect.arrayContaining(["TallyCommitteeProposed", "TallyCommitteeActivated", "TallyKeySetupPublished"])
    );

    const question = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should tally committee metadata appear in result artifacts?",
        body: "A poll used to prove committee lifecycle metadata is carried into tally outputs.",
        sponsorDisclosure: "Demo sponsor",
        proposer: "demo-proposer"
      }
    });
    expect(question.statusCode).toBe(200);
    const questionId = question.json().question.id as string;
    const pollId = question.json().question.poll.id as string;
    expect((await app.inject({ method: "POST", url: `/questions/${questionId}/accept`, payload: { curator: "demo-curator" } })).statusCode).toBe(200);
    const credential = await app.inject({ method: "POST", url: "/credentials/demo-resident", payload: { holderAlias: "tally-committee-voter" } });
    expect(credential.statusCode).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/polls/${pollId}/vote`,
          payload: { credentialId: credential.json().credential.credentialId, credentialSecret: credential.json().credential.secret, choice: "support" }
        })
      ).statusCode
    ).toBe(200);
    expect((await app.inject({ method: "POST", url: `/polls/${pollId}/close`, payload: {} })).statusCode).toBe(200);

    const earlyTally = await app.inject({ method: "POST", url: `/polls/${pollId}/tally`, payload: {} });
    expect(earlyTally.statusCode).toBe(409);
    expect(earlyTally.json()).toMatchObject({ error: "Threshold decryption share threshold has not been met" });

    const shareOne = await app.inject({
      method: "POST",
      url: `/polls/${pollId}/decryption-shares`,
      payload: { memberId: "demo-curator", share: "curator-demo-share", proof: "curator-demo-proof" }
    });
    expect(shareOne.statusCode).toBe(200);
    expect(shareOne.json()).toMatchObject({ thresholdMet: false });
    expect(shareOne.json().shareArtifact.value).toMatchObject({
      artifactKind: "tally-decryption-share",
      schemaVersion: "pc-tally-decryption-share-v1",
      pollId,
      keySetupId,
      memberId: "demo-curator"
    });

    const shareTwo = await app.inject({
      method: "POST",
      url: `/polls/${pollId}/decryption-shares`,
      payload: { memberId: "demo-challenger", share: "challenger-demo-share", proof: "challenger-demo-proof" }
    });
    expect(shareTwo.statusCode).toBe(200);
    expect(shareTwo.json()).toMatchObject({ thresholdMet: true });
    const shareTransactions = await app.inject({
      method: "GET",
      url: `/registry/protocol-transactions?subjectId=${questionId}&sourceModule=TallyManager`
    });
    expect(shareTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(shareTransactions.json());
    expect(shareTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual([
      "TallyDecryptionShareSubmitted",
      "TallyDecryptionShareSubmitted"
    ]);

    const decryptionShares = await app.inject({ method: "GET", url: `/polls/${pollId}/decryption-shares?userId=demo-curator` });
    expect(decryptionShares.statusCode).toBe(200);
    PublicApiV0TallyDecryptionSharesResponseSchema.parse(decryptionShares.json());
    expect(decryptionShares.json()).toMatchObject({
      protocol: {
        schemaVersion: "tally-decryption-shares-v0",
        ids: { pollId, keySetupId, committeeId },
        hashes: {
          artifactHashes: [shareOne.json().shareArtifact.hash, shareTwo.json().shareArtifact.hash]
        },
        statuses: { threshold: 2, shareCount: 2, acceptedShareCount: 2, thresholdMet: true }
      },
      keySetupId,
      threshold: 2,
      thresholdMet: true
    });

    const previousDemoMode = config.demoMode;
    config.demoMode = false;
    const nonDemoTally = await app.inject({ method: "POST", url: `/polls/${pollId}/tally`, payload: {} });
    config.demoMode = previousDemoMode;
    expect(nonDemoTally.statusCode).toBe(501);
    expect(nonDemoTally.json()).toMatchObject({ error: "Non-demo mode requires threshold share decryption; coordinator fallback is disabled" });

    const tally = await app.inject({ method: "POST", url: `/polls/${pollId}/tally`, payload: {} });
    expect(tally.statusCode).toBe(200);
    const resultTransactions = await app.inject({
      method: "GET",
      url: `/registry/protocol-transactions?subjectId=${questionId}&sourceModule=ResultArchive`
    });
    expect(resultTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(resultTransactions.json());
    expect(resultTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toContain("ResultPublished");
    expect(tally.json().tallyPublicationProofArtifact.value).toMatchObject({
      artifactKind: "tally-publication-proof",
      schemaVersion: "pc-tally-publication-proof-v1",
      pollId,
      keySetupId,
      validationStatus: "Verified",
      decryptionShareArtifactHashes: [shareOne.json().shareArtifact.hash, shareTwo.json().shareArtifact.hash]
    });
    expect(tally.json().artifact).toMatchObject({
      tallyMode: "threshold-public-key-with-share-records-and-coordinator-fallback",
      proofReference: tally.json().tallyPublicationProofArtifact.hash,
      tallyPublicationProof: { hash: tally.json().tallyPublicationProofArtifact.hash, validationStatus: "Verified" },
      tallyCommittee: {
        id: committeeId,
        threshold: 2,
        metadataHash: proposed.json().proposalArtifact.hash,
        activationHash: activation.json().activationArtifact.hash,
        status: "Active"
      },
      tallyKeySetup: {
        id: keySetupId,
        committeeId,
        publicKeyId: keySetup.json().keySetup.publicKeyId,
        publicKeyHash: keySetup.json().keySetup.publicKeyHash,
        setupHash: keySetup.json().setupArtifact.hash,
        threshold: 2,
        status: "Active"
      },
      decryptionShares: {
        threshold: 2,
        thresholdMet: true,
        artifactHashes: [shareOne.json().shareArtifact.hash, shareTwo.json().shareArtifact.hash]
      }
    });

    const communityExport = await app.inject({ method: "GET", url: "/communities/community-vancouver/export?userId=demo-curator" });
    expect(communityExport.statusCode).toBe(200);
    PublicApiV0CommunityExportResponseSchema.parse(communityExport.json());
    expect(communityExport.json().protocol).toMatchObject({
      ids: { activeTallyCommitteeId: committeeId },
      hashes: {
        tallyCommitteeMetadataHashes: [proposed.json().proposalArtifact.hash],
        tallyCommitteeActivationHashes: [activation.json().activationArtifact.hash],
        tallyKeySetupHashes: [keySetup.json().setupArtifact.hash],
        activeTallyPublicKeyHash: keySetup.json().keySetup.publicKeyHash,
        tallyPublicationProofHashes: [tally.json().tallyPublicationProofArtifact.hash],
        tallyDecryptionShareArtifactHashes: [shareOne.json().shareArtifact.hash, shareTwo.json().shareArtifact.hash]
      },
      statuses: {
        tallyCommitteeCount: 1,
        activeTallyCommittee: true,
        tallyKeySetupCount: 1,
        activeTallyKeySetup: true,
        tallyDecryptionShareCount: 2,
        acceptedTallyDecryptionShareCount: 2
      },
      authority: {
        tallyCommitteeRule: "active committee metadata is public before threshold key setup replaces the local coordinator",
        tallyKeySetupRule: "active threshold public keys are artifact-backed; coordinator fallback is demo-only and disabled in non-demo mode",
        tallyDecryptionShareRule: "accepted decryption share records are required before threshold-key tally publication in local MVP",
        tallyPublicationProofRule: "result publication stores a proof artifact after validating key setup and decryption share references"
      }
    });
    expect(communityExport.json().exportArtifact.artifact.tallyCommittees).toEqual([
      expect.objectContaining({ id: committeeId, metadataHash: proposed.json().proposalArtifact.hash, activationHash: activation.json().activationArtifact.hash })
    ]);
    expect(communityExport.json().exportArtifact.artifact.tallyKeySetups).toEqual([
      expect.objectContaining({ id: keySetupId, setupHash: keySetup.json().setupArtifact.hash, publicKeyHash: keySetup.json().keySetup.publicKeyHash })
    ]);
    const exportedQuestion = communityExport.json().exportArtifact.artifact.questions.find((item: { id: string }) => item.id === questionId);
    expect(exportedQuestion).toBeTruthy();
    expect(exportedQuestion?.poll.decryptionShares).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ artifactHash: shareOne.json().shareArtifact.hash, memberId: "demo-curator" }),
        expect.objectContaining({ artifactHash: shareTwo.json().shareArtifact.hash, memberId: "demo-challenger" })
      ])
    );
    expect(communityExport.json().bundle.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "tally-committee-proposal", hash: proposed.json().proposalArtifact.hash }),
        expect.objectContaining({ kind: "tally-committee-activation", hash: activation.json().activationArtifact.hash }),
        expect.objectContaining({ kind: "tally-key-setup", hash: keySetup.json().setupArtifact.hash }),
        expect.objectContaining({ kind: "tally-publication-proof", hash: tally.json().tallyPublicationProofArtifact.hash }),
        expect.objectContaining({ kind: "tally-decryption-share", hash: shareOne.json().shareArtifact.hash }),
        expect.objectContaining({ kind: "tally-decryption-share", hash: shareTwo.json().shareArtifact.hash })
      ])
    );
  });

  it("records tally committee failure and replacement lifecycle", async () => {
    const proposed = await app.inject({
      method: "POST",
      url: "/communities/community-vancouver/tally-committees",
      payload: {
        steward: "demo-curator",
        name: "Committee To Replace",
        memberIds: ["demo-curator", "demo-challenger", "demo-resident"],
        threshold: 2,
        metadata: "Committee that will fail in the replacement-flow test."
      }
    });
    expect(proposed.statusCode).toBe(200);
    const committeeId = proposed.json().committee.id as string;

    expect(
      (
        await app.inject({
          method: "POST",
          url: `/communities/community-vancouver/tally-committees/${committeeId}/activate`,
          payload: { steward: "demo-curator", activationRecord: "Activate committee before failure." }
        })
      ).statusCode
    ).toBe(200);

    const keySetup = await app.inject({
      method: "POST",
      url: `/communities/community-vancouver/tally-committees/${committeeId}/key-setup`,
      payload: { steward: "demo-curator", ceremonyTranscript: "Key setup that should fail with the committee." }
    });
    expect(keySetup.statusCode).toBe(200);

    const failure = await app.inject({
      method: "POST",
      url: `/communities/community-vancouver/tally-committees/${committeeId}/fail`,
      payload: { steward: "demo-curator", reason: "Two members missed the tally ceremony.", replacementExpected: true }
    });
    expect(failure.statusCode).toBe(200);
    expect(failure.json().failureArtifact.value).toMatchObject({
      artifactKind: "tally-committee-failure",
      schemaVersion: "pc-tally-committee-failure-v1",
      communityId: "community-vancouver",
      committeeId,
      replacementExpected: true
    });
    expect(failure.json().committee).toMatchObject({ id: committeeId, status: "Failed", failureHash: failure.json().failureArtifact.hash });
    const failureTransactions = await app.inject({
      method: "GET",
      url: "/registry/protocol-transactions?subjectId=community-vancouver&sourceModule=TallyManager"
    });
    expect(failureTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(failureTransactions.json());
    expect(failureTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual(
      expect.arrayContaining(["TallyCommitteeProposed", "TallyCommitteeActivated", "TallyKeySetupPublished", "TallyCommitteeFailed"])
    );

    const failedCommittees = await app.inject({ method: "GET", url: "/communities/community-vancouver/tally-committees?userId=demo-curator" });
    expect(failedCommittees.statusCode).toBe(200);
    expect(failedCommittees.json()).toMatchObject({
      protocol: {
        hashes: { failureHashes: [failure.json().failureArtifact.hash] },
        statuses: { activeCommittee: false, Failed: 1 }
      },
      activeCommittee: null
    });

    const failedKeySetups = await app.inject({ method: "GET", url: "/communities/community-vancouver/tally-key-setups?userId=demo-curator" });
    expect(failedKeySetups.statusCode).toBe(200);
    expect(failedKeySetups.json()).toMatchObject({
      protocol: { statuses: { activeKeySetup: false, Active: 0, Failed: 1 } },
      activeKeySetup: null,
      keySetups: [expect.objectContaining({ id: keySetup.json().keySetup.id, status: "Failed" })]
    });

    const replacement = await app.inject({
      method: "POST",
      url: "/communities/community-vancouver/tally-committees",
      payload: {
        steward: "demo-curator",
        name: "Replacement Committee",
        memberIds: ["demo-curator", "demo-challenger", "demo-resident"],
        threshold: 2,
        metadata: "Replacement committee inherits the failed committee responsibilities.",
        replacementForId: committeeId
      }
    });
    expect(replacement.statusCode).toBe(200);
    expect(replacement.json().proposalArtifact.value).toMatchObject({ replacementForId: committeeId });
    const replacementId = replacement.json().committee.id as string;

    const activation = await app.inject({
      method: "POST",
      url: `/communities/community-vancouver/tally-committees/${replacementId}/activate`,
      payload: { steward: "demo-curator", activationRecord: "Activate replacement after failed committee." }
    });
    expect(activation.statusCode).toBe(200);

    const committees = await app.inject({ method: "GET", url: "/communities/community-vancouver/tally-committees?userId=demo-curator" });
    expect(committees.statusCode).toBe(200);
    expect(committees.json()).toMatchObject({
      protocol: { ids: { activeCommitteeId: replacementId }, statuses: { activeCommittee: true, Active: 1, Failed: 1 } },
      activeCommittee: { id: replacementId, replacementForId: committeeId, status: "Active" }
    });

    const communityExport = await app.inject({ method: "GET", url: "/communities/community-vancouver/export?userId=demo-curator" });
    expect(communityExport.statusCode).toBe(200);
    expect(communityExport.json().protocol).toMatchObject({
      ids: { activeTallyCommitteeId: replacementId, replacementTallyCommitteeIds: [committeeId] },
      hashes: { tallyCommitteeFailureHashes: [failure.json().failureArtifact.hash] },
      authority: {
        tallyCommitteeFailureRule: "failed committees are artifact-backed, deactivate their active key setups, and replacements point to the failed committee"
      }
    });
    expect(communityExport.json().bundle.artifacts).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "tally-committee-failure", hash: failure.json().failureArtifact.hash })])
    );
  });

  it("operates adoption policy proposal, activation, and suspension as explicit authority metadata", async () => {
    const blockedMemberProposal = await app.inject({
      method: "POST",
      url: "/communities/community-vancouver/adoption/proposals",
      payload: {
        steward: "demo-resident",
        authorityLevel: "Recognized",
        eligibleQuestionTypes: ["transit"],
        credentialSchemaIds: ["credential-vancouver-resident"],
        quorumRule: "Public notice plus member quorum.",
        approvalRule: "Moderator records community approval.",
        forkRule: "Community may fork policy metadata."
      }
    });
    expect(blockedMemberProposal.statusCode).toBe(403);

    const bindingWithoutHandoff = await app.inject({
      method: "POST",
      url: "/communities/community-vancouver/adoption/proposals",
      payload: {
        steward: "demo-curator",
        authorityLevel: "Binding",
        eligibleQuestionTypes: ["transit"],
        credentialSchemaIds: ["credential-vancouver-resident"],
        quorumRule: "Two-thirds member quorum.",
        approvalRule: "Majority approval after public notice.",
        forkRule: "Community may fork policy metadata."
      }
    });
    expect(bindingWithoutHandoff.statusCode).toBe(400);
    expect(bindingWithoutHandoff.json().error).toBe("Binding adoption policies require explicit legal handoff metadata.");

    const proposal = await app.inject({
      method: "POST",
      url: "/communities/community-vancouver/adoption/proposals",
      payload: {
        steward: "demo-curator",
        authorityLevel: "Recognized",
        eligibleQuestionTypes: ["transit"],
        credentialSchemaIds: ["credential-vancouver-resident"],
        quorumRule: "Public notice plus open comment period.",
        approvalRule: "Moderator records community approval before activation.",
        forkRule: "Community may fork policy metadata with archived references."
      }
    });
    expect(proposal.statusCode).toBe(200);
    expect(proposal.json().policy.status).toBe("Proposed");
    expect(proposal.json().proposalArtifact.value).toMatchObject({
      artifactKind: "adoption-policy-proposal",
      schemaVersion: "pc-adoption-policy-proposal-v1"
    });
    const policyId = proposal.json().policy.id as string;

    const beforeActivation = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should a proposed adoption policy elevate this poll?",
        body: "A matching transit question before adoption policy activation.",
        sponsorDisclosure: "Demo sponsor",
        proposer: "demo-proposer",
        topicIds: ["transit"]
      }
    });
    expect(beforeActivation.statusCode).toBe(200);
    expect(beforeActivation.json().question.authorityLevel).toBe("Advisory");
    expect(beforeActivation.json().question.adoptionPolicyId).not.toBe(policyId);

    const activation = await app.inject({
      method: "POST",
      url: `/communities/community-vancouver/adoption/policies/${policyId}/activate`,
      payload: {
        steward: "demo-curator",
        adoptionRecord: "Community moderator recorded recognition under existing demo rules."
      }
    });
    expect(activation.statusCode).toBe(200);
    expect(activation.json().policy).toMatchObject({ id: policyId, status: "Active", authorityLevel: "Recognized", adoptedBy: "demo-curator" });
    expect(activation.json().activationArtifact.value).toMatchObject({
      artifactKind: "adoption-policy-activation",
      schemaVersion: "pc-adoption-policy-activation-v1"
    });

    const recognized = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should an active adoption policy recognize this poll?",
        body: "A matching transit question after adoption policy activation.",
        sponsorDisclosure: "Demo sponsor",
        proposer: "demo-proposer",
        topicIds: ["transit"]
      }
    });
    expect(recognized.statusCode).toBe(200);
    const recognizedQuestionId = recognized.json().question.id as string;
    const recognizedPollId = recognized.json().question.poll.id as string;
    expect(recognized.json().question).toMatchObject({ authorityLevel: "Recognized", adoptionPolicyId: policyId });

    await acceptQuestion(app, recognizedQuestionId);
    const close = await app.inject({ method: "POST", url: `/polls/${recognizedPollId}/close`, payload: {} });
    expect(close.statusCode).toBe(200);
    const tally = await app.inject({ method: "POST", url: `/polls/${recognizedPollId}/tally`, payload: {} });
    expect(tally.statusCode).toBe(200);
    expect(tally.json().artifact).toMatchObject({ authorityLevel: "Recognized", adoptionPolicyId: policyId });

    const pendingRecognized = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should suspension pause an unpublished recognized poll?",
        body: "A matching transit question that should be paused back to advisory.",
        sponsorDisclosure: "Demo sponsor",
        proposer: "demo-proposer",
        topicIds: ["transit"]
      }
    });
    expect(pendingRecognized.statusCode).toBe(200);
    const pendingQuestionId = pendingRecognized.json().question.id as string;
    expect(pendingRecognized.json().question).toMatchObject({ authorityLevel: "Recognized", adoptionPolicyId: policyId });

    const suspension = await app.inject({
      method: "POST",
      url: `/communities/community-vancouver/adoption/policies/${policyId}/suspend`,
      payload: {
        steward: "demo-curator",
        reason: "Recognition paused pending community review."
      }
    });
    expect(suspension.statusCode).toBe(200);
    expect(suspension.json().policy).toMatchObject({ id: policyId, status: "Suspended", suspendedBy: "demo-curator" });
    expect(suspension.json().suspensionArtifact.value).toMatchObject({
      artifactKind: "adoption-policy-suspension",
      schemaVersion: "pc-adoption-policy-suspension-v1"
    });

    const downgraded = await app.inject({ method: "GET", url: `/questions/${pendingQuestionId}` });
    expect(downgraded.statusCode).toBe(200);
    expect(downgraded.json().question).toMatchObject({ authorityLevel: "Advisory", adoptionPolicyId: policyId });

    const afterSuspension = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should suspended policy authority apply?",
        body: "A matching transit question after adoption policy suspension.",
        sponsorDisclosure: "Demo sponsor",
        proposer: "demo-proposer",
        topicIds: ["transit"]
      }
    });
    expect(afterSuspension.statusCode).toBe(200);
    expect(afterSuspension.json().question.authorityLevel).toBe("Advisory");
    expect(afterSuspension.json().question.adoptionPolicyId).not.toBe(policyId);

    const adoption = await app.inject({ method: "GET", url: "/communities/community-vancouver/adoption" });
    expect(adoption.statusCode).toBe(200);
    expect(adoption.json().policies.find((policy: { id: string }) => policy.id === policyId).status).toBe("Suspended");
    expect(adoption.json().activePolicies.map((policy: { id: string }) => policy.id)).not.toContain(policyId);

    const events = await app.inject({ method: "GET", url: "/registry/events" });
    expect(events.statusCode).toBe(200);
    expect(events.json().events.map((event: { eventType: string }) => event.eventType)).toEqual(
      expect.arrayContaining(["AdoptionPolicyProposed", "AdoptionPolicyActivated", "AdoptionPolicySuspended"])
    );
    const policyTransactions = await app.inject({
      method: "GET",
      url: `/registry/protocol-transactions?subjectId=${policyId}&sourceModule=AdoptionRegistry`
    });
    expect(policyTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(policyTransactions.json());
    expect(policyTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual([
      "AdoptionPolicyProposed",
      "AdoptionPolicyActivated",
      "AdoptionPolicySuspended"
    ]);
  });

  it("applies community governance parameters to bonds, privacy, windows, and export metadata", async () => {
    const tunedParameters = {
      proposalBondPc: 120,
      challengeBondPc: 60,
      appealBondPc: 40,
      protocolFeePc: 6,
      successfulChallengeRewardPc: 54,
      failedChallengeProposerRewardPc: 30,
      jurorRewardWeight: 3,
      successfulChallengeReputation: 8,
      acceptedAmendmentReputation: 4,
      privacyThreshold: 2,
      challengeWindowHours: 2,
      resultChallengeWindowHours: 36,
      pollDurationHours: 48,
      reputationDecayRule: "none-in-mvp"
    };

    const defaults = await app.inject({ method: "GET", url: "/communities/community-vancouver/governance/parameters" });
    expect(defaults.statusCode).toBe(200);
    const defaultParameters = PublicApiV0GovernanceParametersResponseSchema.parse(defaults.json());
    expect(defaultParameters).toMatchObject({
      activeParameterSet: null,
      parameterSets: [],
      protocol: {
        schemaVersion: "governance-parameters-v0",
        statuses: { parameterSetCount: 0, active: "Default" },
        authority: { activeParameters: expect.objectContaining({ proposalBondPc: 100, privacyThreshold: 1 }) }
      }
    });
    const defaultSafety = await app.inject({ method: "GET", url: "/communities/community-vancouver/governance/upgrade-safety" });
    expect(defaultSafety.statusCode).toBe(200);
    PublicApiV0UpgradeSafetyResponseSchema.parse(defaultSafety.json());
    expect(defaultSafety.json()).toMatchObject({
      protocol: {
        schemaVersion: "upgrade-safety-v0",
        statuses: {
          safetyModelStatus: "Published",
          activeGovernanceParameterSet: "Default",
          pendingGates: ["independent-testnet-operators"]
        },
        authority: {
          activationRule: "proposal-artifact-plus-effective-at-activation-plus-independent-replay",
          minimumReviewHours: 72
        }
      },
      model: {
        schemaVersion: "upgrade-governance-safety-model-v0",
        minimumReviewHours: 72,
        upgradeClasses: expect.arrayContaining(["GovernanceParameters", "ProtocolImplementation"]),
        knownMvpLimits: expect.arrayContaining([expect.stringContaining("public testnet independent-operator gate remains pending")])
      },
      powers: expect.arrayContaining([expect.objectContaining({ role: "Owner", actions: expect.arrayContaining(["TechnicalUpgrade"]) })])
    });
    expect(defaultSafety.json().gates.map((gate: { id: string }) => gate.id)).toEqual(
      expect.arrayContaining(["public-proposal-artifact", "effective-at-timelock", "independent-indexer-replay", "fork-exit", "independent-testnet-operators"])
    );

    const blockedProposal = await app.inject({
      method: "POST",
      url: "/communities/community-vancouver/governance/parameters/proposals",
      payload: {
        steward: "demo-resident",
        rationale: "Members cannot unilaterally change governance parameters.",
        ...tunedParameters
      }
    });
    expect(blockedProposal.statusCode).toBe(403);

    const proposal = await app.inject({
      method: "POST",
      url: "/communities/community-vancouver/governance/parameters/proposals",
      payload: {
        steward: "demo-proposer",
        rationale: "Tune MVP governance economics and privacy defaults for community review.",
        ...tunedParameters
      }
    });
    expect(proposal.statusCode).toBe(200);
    expect(proposal.json().parameterSet).toMatchObject({ status: "Proposed", proposedBy: "demo-proposer", ...tunedParameters });
    expect(proposal.json().proposalArtifact.value).toMatchObject({
      artifactKind: "governance-parameter-proposal",
      schemaVersion: "pc-governance-parameter-proposal-v1",
      communityId: "community-vancouver",
      parameters: tunedParameters
    });
    const parameterSetId = proposal.json().parameterSet.id as string;

    const activation = await app.inject({
      method: "POST",
      url: `/communities/community-vancouver/governance/parameters/${parameterSetId}/activate`,
      payload: {
        steward: "demo-proposer",
        activationRecord: "Owner activated parameters after community review."
      }
    });
    expect(activation.statusCode).toBe(200);
    expect(activation.json().parameterSet).toMatchObject({ id: parameterSetId, status: "Active", activatedBy: "demo-proposer" });
    expect(activation.json().activationArtifact.value).toMatchObject({
      artifactKind: "governance-parameter-activation",
      schemaVersion: "pc-governance-parameter-activation-v1",
      communityId: "community-vancouver",
      parameterSetId
    });

    const activeRead = await app.inject({ method: "GET", url: "/communities/community-vancouver/governance/parameters" });
    expect(activeRead.statusCode).toBe(200);
    const activeParameters = PublicApiV0GovernanceParametersResponseSchema.parse(activeRead.json());
    expect(activeParameters).toMatchObject({
      activeParameterSet: { id: parameterSetId, status: "Active", ...tunedParameters },
      parameterSets: [expect.objectContaining({ id: parameterSetId })],
      protocol: {
        ids: { activeParameterSetId: parameterSetId, parameterSetIds: [parameterSetId] },
        hashes: {
          proposalHashes: [proposal.json().proposalArtifact.hash],
          activationHashes: [activation.json().activationArtifact.hash]
        },
        statuses: { parameterSetCount: 1, active: "Configured", Active: 1 },
        authority: { activeParameters: tunedParameters }
      }
    });
    const activeSafety = await app.inject({ method: "GET", url: "/communities/community-vancouver/governance/upgrade-safety" });
    expect(activeSafety.statusCode).toBe(200);
    PublicApiV0UpgradeSafetyResponseSchema.parse(activeSafety.json());
    expect(activeSafety.json()).toMatchObject({
      activeParameterSet: { id: parameterSetId },
      protocol: {
        ids: { activeParameterSetId: parameterSetId },
        hashes: {
          activeParameterProposalHash: proposal.json().proposalArtifact.hash,
          activeParameterActivationHash: activation.json().activationArtifact.hash
        },
        statuses: { activeGovernanceParameterSet: "Configured" }
      }
    });

    const created = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should active governance parameters tune this poll?",
        body: "A poll used to prove active parameter sets drive MVP protocol behavior.",
        sponsorDisclosure: "Demo sponsor",
        proposer: "demo-proposer"
      }
    });
    expect(created.statusCode).toBe(200);
    const questionId = created.json().question.id as string;
    const proposalBondId = created.json().proposalBondId as string;
    const createdQuestion = created.json().question;
    const createdAt = new Date(createdQuestion.createdAt).getTime();
    const hours = 1000 * 60 * 60;
    expect(created.json().stakedPc).toBe("120");
    expect(createdQuestion.poll.privacyThreshold).toBe(2);
    expect(new Date(createdQuestion.challengeWindowEndsAt).getTime() - createdAt).toBeGreaterThan(1.8 * hours);
    expect(new Date(createdQuestion.challengeWindowEndsAt).getTime() - createdAt).toBeLessThan(2.2 * hours);
    expect(new Date(createdQuestion.closesAt).getTime() - createdAt).toBeGreaterThan(47.8 * hours);
    expect(new Date(createdQuestion.closesAt).getTime() - createdAt).toBeLessThan(48.2 * hours);
    expect(new Date(createdQuestion.poll.resultChallengeEndsAt).getTime() - createdAt).toBeGreaterThan(35.8 * hours);
    expect(new Date(createdQuestion.poll.resultChallengeEndsAt).getTime() - createdAt).toBeLessThan(36.2 * hours);

    const challenge = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/challenges`,
      payload: { reasonCode: "MisleadingWording", evidence: "Parameterized challenge bond should apply.", challenger: "demo-challenger" }
    });
    expect(challenge.statusCode).toBe(200);
    expect(challenge.json().stakedPc).toBe("60");
    const challengeId = challenge.json().challenge.id as string;
    const challengeBondId = challenge.json().challenge.challengeBondId as string;

    const ruling = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/challenges/${challengeId}/ruling`,
      payload: {
        ruling: "Rejected",
        juror: "demo-curator",
        resolution: "Challenge rejected after applying the active governance parameters."
      }
    });
    expect(ruling.statusCode).toBe(200);
    expect(ruling.json().bonds.find((bond: { id: string }) => bond.id === challengeBondId)).toMatchObject({
      status: "Slashed",
      slashedPc: 60,
      treasuryPc: 6
    });
    expect(ruling.json().bonds.find((bond: { id: string }) => bond.id === proposalBondId)).toMatchObject({ rewardPc: 30 });

    const appeal = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/challenges/${challengeId}/appeals`,
      payload: { appellantId: "demo-challenger", appeal: "Appeal bond should also follow active parameters." }
    });
    expect(appeal.statusCode).toBe(200);
    expect(appeal.json().stakedPc).toBe("40");

    const events = await app.inject({ method: "GET", url: "/registry/events?subjectId=community-vancouver" });
    expect(events.statusCode).toBe(200);
    PublicApiV0RegistryEventsResponseSchema.parse(events.json());
    expect(events.json().events.map((event: { eventType: string }) => event.eventType)).toEqual(
      expect.arrayContaining(["GovernanceParametersProposed", "GovernanceParametersActivated"])
    );
    const parameterTransactions = await app.inject({
      method: "GET",
      url: "/registry/protocol-transactions?subjectId=community-vancouver&sourceModule=AdoptionRegistry"
    });
    expect(parameterTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(parameterTransactions.json());
    expect(parameterTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual(
      expect.arrayContaining(["GovernanceParametersProposed", "GovernanceParametersActivated"])
    );

    const communityExport = await app.inject({ method: "GET", url: "/communities/community-vancouver/export?userId=demo-curator" });
    expect(communityExport.statusCode).toBe(200);
    PublicApiV0CommunityExportResponseSchema.parse(communityExport.json());
    expect(communityExport.json().protocol).toMatchObject({
      ids: { activeGovernanceParameterSetId: parameterSetId },
      hashes: {
        governanceParameterProposalHashes: [proposal.json().proposalArtifact.hash],
        governanceParameterActivationHashes: [activation.json().activationArtifact.hash]
      },
      statuses: { governanceParameterSetCount: 1, governanceParameterStatus: "Configured" },
      authority: { activeGovernanceParameters: tunedParameters }
    });
    expect(communityExport.json().exportArtifact.artifact.governanceParameterSets).toEqual([
      expect.objectContaining({ id: parameterSetId, status: "Active", proposalHash: proposal.json().proposalArtifact.hash })
    ]);
    expect(communityExport.json().bundle.manifest.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "governance-parameter-proposal", hash: proposal.json().proposalArtifact.hash }),
        expect.objectContaining({ kind: "governance-parameter-activation", hash: activation.json().activationArtifact.hash })
      ])
    );
  });

  it("publishes steward powers and enforces emergency suspension rules", async () => {
    const powers = await app.inject({ method: "GET", url: "/communities/community-vancouver/steward-powers" });
    expect(powers.statusCode).toBe(200);
    PublicApiV0StewardPowersResponseSchema.parse(powers.json());
    expect(powers.json()).toMatchObject({
      protocol: {
        schemaVersion: "steward-powers-v0",
        statuses: { stewardCount: 2, activeEmergencySuspension: false },
        authority: {
          powerModel: "role-bound-artifact-backed-stewards",
          emergencyRule: "active suspension blocks protocol writes until a steward records a resolution artifact"
        }
      },
      powers: expect.arrayContaining([
        expect.objectContaining({ role: "Owner", actions: expect.arrayContaining(["GovernanceParameters", "EmergencySuspension"]) }),
        expect.objectContaining({ role: "Moderator", actions: expect.arrayContaining(["JurorSelection", "EmergencySuspension"]) })
      ]),
      activeStewards: expect.arrayContaining([
        expect.objectContaining({ userId: "demo-proposer", role: "Owner" }),
        expect.objectContaining({ userId: "demo-curator", role: "Moderator" })
      ]),
      activeEmergencySuspension: null
    });

    const openQuestion = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should emergency pauses block voting?",
        body: "An open poll used to prove emergency suspension enforcement.",
        sponsorDisclosure: "Demo sponsor",
        proposer: "demo-proposer"
      }
    });
    expect(openQuestion.statusCode).toBe(200);
    const openQuestionId = openQuestion.json().question.id as string;
    const openPollId = openQuestion.json().question.poll.id as string;
    expect((await app.inject({ method: "POST", url: `/questions/${openQuestionId}/accept`, payload: { curator: "demo-curator" } })).statusCode).toBe(200);

    const pendingQuestion = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should emergency pauses block poll opening?",
        body: "A pending poll used to prove emergency suspension enforcement.",
        sponsorDisclosure: "Demo sponsor",
        proposer: "demo-proposer"
      }
    });
    expect(pendingQuestion.statusCode).toBe(200);
    const pendingQuestionId = pendingQuestion.json().question.id as string;

    const blockedMemberSuspension = await app.inject({
      method: "POST",
      url: "/communities/community-vancouver/emergency-suspensions",
      payload: { steward: "demo-resident", reason: "Members cannot unilaterally pause the protocol." }
    });
    expect(blockedMemberSuspension.statusCode).toBe(403);

    const suspension = await app.inject({
      method: "POST",
      url: "/communities/community-vancouver/emergency-suspensions",
      payload: {
        steward: "demo-curator",
        reason: "Pause protocol writes during an urgent community process review."
      }
    });
    expect(suspension.statusCode).toBe(200);
    expect(suspension.json().suspension).toMatchObject({ communityId: "community-vancouver", status: "Active", suspendedBy: "demo-curator" });
    expect(suspension.json().suspensionArtifact.value).toMatchObject({
      artifactKind: "community-emergency-suspension",
      schemaVersion: "pc-community-emergency-suspension-v1",
      scope: "ProtocolActions"
    });
    const suspensionId = suspension.json().suspension.id as string;

    const duplicateSuspension = await app.inject({
      method: "POST",
      url: "/communities/community-vancouver/emergency-suspensions",
      payload: { steward: "demo-curator", reason: "A second active pause should not be allowed." }
    });
    expect(duplicateSuspension.statusCode).toBe(409);

    const blockedQuestion = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should this question be blocked during an emergency?",
        body: "Emergency suspension should prevent new civic lifecycle writes.",
        sponsorDisclosure: "Demo sponsor",
        proposer: "demo-proposer"
      }
    });
    expect(blockedQuestion.statusCode).toBe(423);
    expect(blockedQuestion.json()).toMatchObject({
      error: "Community protocol actions are paused by an active emergency suspension",
      suspension: { id: suspensionId, status: "Active" }
    });

    const blockedAccept = await app.inject({
      method: "POST",
      url: `/questions/${pendingQuestionId}/accept`,
      payload: { curator: "demo-curator" }
    });
    expect(blockedAccept.statusCode).toBe(423);

    const credential = await app.inject({
      method: "POST",
      url: "/credentials/demo-resident",
      payload: { holderAlias: "emergency-pause-voter" }
    });
    expect(credential.statusCode).toBe(200);
    const blockedVote = await app.inject({
      method: "POST",
      url: `/polls/${openPollId}/vote`,
      payload: { credentialId: credential.json().credential.credentialId, credentialSecret: credential.json().credential.secret, choice: "support" }
    });
    expect(blockedVote.statusCode).toBe(423);

    const suspendedPowers = await app.inject({ method: "GET", url: "/communities/community-vancouver/steward-powers" });
    expect(suspendedPowers.statusCode).toBe(200);
    PublicApiV0StewardPowersResponseSchema.parse(suspendedPowers.json());
    expect(suspendedPowers.json()).toMatchObject({
      protocol: {
        ids: { activeEmergencySuspensionId: suspensionId },
        hashes: { activeEmergencySuspensionReasonHash: suspension.json().suspensionArtifact.hash },
        statuses: { activeEmergencySuspension: true, emergencySuspensionStatuses: { Active: 1, Resolved: 0 } }
      },
      activeEmergencySuspension: { id: suspensionId, reasonHash: suspension.json().suspensionArtifact.hash }
    });
    const suspendedSafety = await app.inject({ method: "GET", url: "/communities/community-vancouver/governance/upgrade-safety" });
    expect(suspendedSafety.statusCode).toBe(200);
    PublicApiV0UpgradeSafetyResponseSchema.parse(suspendedSafety.json());
    expect(suspendedSafety.json()).toMatchObject({
      model: { status: "EmergencySuspensionActive" },
      protocol: {
        ids: { activeEmergencySuspensionId: suspensionId },
        hashes: { activeEmergencySuspensionReasonHash: suspension.json().suspensionArtifact.hash },
        statuses: { safetyModelStatus: "EmergencySuspensionActive", activeEmergencySuspension: true }
      },
      gates: expect.arrayContaining([expect.objectContaining({ id: "emergency-pause-limits", status: "Engaged" })]),
      activeEmergencySuspension: { id: suspensionId }
    });

    const resolution = await app.inject({
      method: "POST",
      url: `/communities/community-vancouver/emergency-suspensions/${suspensionId}/resolve`,
      payload: {
        steward: "demo-curator",
        resolution: "Community review complete; protocol writes may resume."
      }
    });
    expect(resolution.statusCode).toBe(200);
    expect(resolution.json().suspension).toMatchObject({ id: suspensionId, status: "Resolved", resolvedBy: "demo-curator" });
    expect(resolution.json().resolutionArtifact.value).toMatchObject({
      artifactKind: "community-emergency-resolution",
      schemaVersion: "pc-community-emergency-resolution-v1",
      suspensionId
    });

    const acceptedAfterResolution = await app.inject({
      method: "POST",
      url: `/questions/${pendingQuestionId}/accept`,
      payload: { curator: "demo-curator" }
    });
    expect(acceptedAfterResolution.statusCode).toBe(200);

    const resolvedPowers = await app.inject({ method: "GET", url: "/communities/community-vancouver/steward-powers" });
    expect(resolvedPowers.statusCode).toBe(200);
    expect(resolvedPowers.json().protocol.statuses).toMatchObject({
      activeEmergencySuspension: false,
      emergencySuspensionStatuses: { Active: 0, Resolved: 1 }
    });

    const events = await app.inject({ method: "GET", url: "/registry/events?subjectId=community-vancouver" });
    expect(events.statusCode).toBe(200);
    PublicApiV0RegistryEventsResponseSchema.parse(events.json());
    expect(events.json().events.map((event: { eventType: string }) => event.eventType)).toEqual(
      expect.arrayContaining(["CommunityEmergencySuspended", "CommunityEmergencyResolved"])
    );
    expect(events.json().commitments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "adoption-policy", eventType: "CommunityEmergencySuspended" }),
        expect.objectContaining({ kind: "adoption-policy", eventType: "CommunityEmergencyResolved" })
      ])
    );
    const emergencyTransactions = await app.inject({
      method: "GET",
      url: "/registry/protocol-transactions?subjectId=community-vancouver&sourceModule=AdoptionRegistry"
    });
    expect(emergencyTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(emergencyTransactions.json());
    expect(emergencyTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual(
      expect.arrayContaining(["CommunityEmergencySuspended", "CommunityEmergencyResolved"])
    );

    const communityExport = await app.inject({ method: "GET", url: "/communities/community-vancouver/export?userId=demo-curator" });
    expect(communityExport.statusCode).toBe(200);
    PublicApiV0CommunityExportResponseSchema.parse(communityExport.json());
    expect(communityExport.json().protocol).toMatchObject({
      ids: { emergencySuspensionIds: [suspensionId], activeEmergencySuspensionId: null },
      hashes: {
        emergencySuspensionReasonHashes: [suspension.json().suspensionArtifact.hash],
        emergencySuspensionResolutionHashes: [resolution.json().resolutionArtifact.hash]
      },
      statuses: { emergencySuspensionCount: 1, activeEmergencySuspension: false }
    });
    expect(communityExport.json().exportArtifact.artifact.emergencySuspensions).toEqual([
      expect.objectContaining({ id: suspensionId, status: "Resolved", reasonHash: suspension.json().suspensionArtifact.hash })
    ]);
    expect(communityExport.json().bundle.manifest.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "community-emergency-suspension", hash: suspension.json().suspensionArtifact.hash }),
        expect.objectContaining({ kind: "community-emergency-resolution", hash: resolution.json().resolutionArtifact.hash })
      ])
    );
  });

  it("settles civic TCR challenge bonds before rejected questions can open", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should this misleading question reach voters?",
        body: "A deliberately vague civic question used to exercise the challenge court.",
        sponsorDisclosure: "Demo sponsor",
        proposer: "demo-proposer"
      }
    });
    expect(created.statusCode).toBe(200);
    const questionId = created.json().question.id as string;
    const pollId = created.json().question.poll.id as string;
    const proposalBondId = created.json().proposalBondId as string;

    const challenge = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/challenges`,
      payload: { reasonCode: "Spam", evidence: "This should not be sent to voters.", challenger: "demo-challenger" }
    });
    expect(challenge.statusCode).toBe(200);
    const challengeId = challenge.json().challenge.id as string;
    const challengeBondId = challenge.json().challenge.challengeBondId as string;

    const blockedAccept = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/accept`,
      payload: { curator: "demo-curator" }
    });
    expect(blockedAccept.statusCode).toBe(409);
    expect(blockedAccept.json().error).toBe("Question is not ready for acceptance");

    const ruling = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/challenges/${challengeId}/ruling`,
      payload: {
        ruling: "Sustained",
        juror: "demo-curator",
        resolution: "Sustained because the proposal is not registry quality."
      }
    });
    expect(ruling.statusCode).toBe(200);
    expect(ruling.json().question.status).toBe("Rejected");

    const rejectedAccept = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/accept`,
      payload: { curator: "demo-curator" }
    });
    expect(rejectedAccept.statusCode).toBe(409);
    expect(rejectedAccept.json().error).toBe("Question is not ready for acceptance");

    const credential = await app.inject({
      method: "POST",
      url: "/credentials/demo-resident",
      payload: { holderAlias: "rejected-question-responder" }
    });
    expect(credential.statusCode).toBe(200);
    const issued = credential.json().credential;

    const rejectedVote = await app.inject({
      method: "POST",
      url: `/polls/${pollId}/vote`,
      payload: { credentialId: issued.credentialId, credentialSecret: issued.secret, choice: "support" }
    });
    expect(rejectedVote.statusCode).toBe(409);
    expect(rejectedVote.json().error).toBe("Poll is not open");

    const bonds = await app.inject({ method: "GET", url: "/registry/bonds" });
    expect(bonds.statusCode).toBe(200);
    const proposalBond = bonds.json().bonds.find((bond: { id: string }) => bond.id === proposalBondId);
    const challengeBond = bonds.json().bonds.find((bond: { id: string }) => bond.id === challengeBondId);
    expect(proposalBond).toMatchObject({ status: "Slashed", slashedPc: 100, treasuryPc: 5 });
    expect(challengeBond).toMatchObject({ status: "Refunded", refundedPc: 50, rewardPc: 45 });

    const ledger = await app.inject({ method: "GET", url: `/communities/community-vancouver/treasury/ledger?questionId=${questionId}` });
    expect(ledger.statusCode).toBe(200);
    PublicApiV0TreasuryLedgerResponseSchema.parse(ledger.json());
    expect(ledger.json()).toMatchObject({
      protocol: {
        schemaVersion: "treasury-ledger-v0",
        ids: {
          communityId: "community-vancouver",
          questionId,
          bondIds: expect.arrayContaining([proposalBondId, challengeBondId]),
          accountIds: expect.arrayContaining(["demo-proposer", "demo-challenger", "community:community-vancouver:treasury"])
        },
        statuses: {
          entryCount: 5,
          escrowedPc: 150,
          refundedPc: 50,
          rewardedPc: 45,
          treasuryPc: 5,
          openEscrowPc: 0,
          treasuryBalancePc: 5,
          participantNetPc: { "demo-proposer": -100, "demo-challenger": 45 }
        },
        authority: { accountingModel: "bond-derived-ledger", unit: "PC" }
      },
      totals: {
        entryCount: 5,
        escrowedPc: 150,
        refundedPc: 50,
        rewardedPc: 45,
        treasuryPc: 5,
        openEscrowPc: 0,
        treasuryBalancePc: 5,
        participantNetPc: { "demo-proposer": -100, "demo-challenger": 45 }
      },
      entries: expect.arrayContaining([
        expect.objectContaining({ bondId: proposalBondId, accountId: "demo-proposer", entryType: "Escrow", direction: "Debit", amountPc: 100 }),
        expect.objectContaining({ bondId: challengeBondId, accountId: "demo-challenger", entryType: "Refund", direction: "Credit", amountPc: 50 }),
        expect.objectContaining({ bondId: challengeBondId, accountId: "demo-challenger", entryType: "Reward", direction: "Credit", amountPc: 45 }),
        expect.objectContaining({
          bondId: proposalBondId,
          accountId: "community:community-vancouver:treasury",
          entryType: "TreasuryFee",
          direction: "Credit",
          amountPc: 5
        })
      ])
    });

    const reputation = await app.inject({ method: "GET", url: "/reputation/events" });
    expect(reputation.statusCode).toBe(200);
    PublicApiV0ReputationEventsResponseSchema.parse(reputation.json());
    expect(reputation.json().events.map((event: { reason: string }) => event.reason)).toEqual(
      expect.arrayContaining(["SuccessfulChallenge", "JurorService"])
    );
    expect(reputation.json().protocol).toMatchObject({
      schemaVersion: "reputation-events-v0",
      authority: { replayRule: "sum-weight-by-account", decayRule: "none-in-mvp" }
    });
    expect(reputation.json().totals["demo-challenger"]).toBeGreaterThan(0);
    const reputationProtocolTransactions = await app.inject({
      method: "GET",
      url: "/registry/protocol-transactions?sourceModule=SocialGraph&eventType=ReputationEventRecorded"
    });
    expect(reputationProtocolTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(reputationProtocolTransactions.json());
    expect(reputationProtocolTransactions.json().transactions.map((transaction: { actor: string }) => transaction.actor)).toEqual(
      expect.arrayContaining(["demo-challenger", "demo-curator"])
    );

    const reputationExport = await app.inject({ method: "GET", url: "/reputation/export?account=demo-challenger" });
    expect(reputationExport.statusCode).toBe(200);
    PublicApiV0ReputationExportResponseSchema.parse(reputationExport.json());
    expect(reputationExport.json()).toMatchObject({
      protocol: {
        schemaVersion: "reputation-export-v0",
        hashes: { reputationExportHash: reputationExport.json().exportArtifact.hash },
        statuses: { exportStatus: "Exported" }
      },
      exportArtifact: {
        value: {
          artifactKind: "reputation-export",
          schemaVersion: "pc-reputation-export-v1",
          account: "demo-challenger",
          replayRule: "sum-weight-by-account",
          decayRule: "none-in-mvp"
        }
      }
    });

    const replay = await app.inject({
      method: "POST",
      url: "/reputation/replay",
      payload: { events: reputationExport.json().events, expectedTotals: reputationExport.json().totals }
    });
    expect(replay.statusCode).toBe(200);
    PublicApiV0ReputationReplayResponseSchema.parse(replay.json());
    expect(replay.json()).toMatchObject({
      status: "Verified",
      totals: reputationExport.json().totals,
      protocol: {
        schemaVersion: "reputation-replay-v0",
        statuses: { replayStatus: "Verified", failedChecks: [] },
        authority: { readOnly: true }
      }
    });

    const communityExport = await app.inject({ method: "GET", url: "/communities/community-vancouver/export?userId=demo-curator" });
    expect(communityExport.statusCode).toBe(200);
    PublicApiV0CommunityExportResponseSchema.parse(communityExport.json());
    expect(communityExport.json().exportArtifact.artifact.reputationEvents.map((event: { reason: string }) => event.reason)).toEqual(
      expect.arrayContaining(["SuccessfulChallenge", "JurorService"])
    );
    expect(communityExport.json().protocol.statuses.reputationEventCount).toBeGreaterThan(0);
    expect(communityExport.json().protocol.statuses.treasuryLedgerEntryCount).toBeGreaterThanOrEqual(5);
    expect(communityExport.json().protocol.statuses.treasuryTotals).toMatchObject({ rewardedPc: 45, treasuryPc: 5 });
    expect(communityExport.json().exportArtifact.artifact.treasuryLedgerEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ bondId: proposalBondId, entryType: "TreasuryFee", amountPc: 5 }),
        expect.objectContaining({ bondId: challengeBondId, entryType: "Reward", amountPc: 45 })
      ])
    );
  });

  it("records formal challenge appeals before questions proceed", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should appeals pause accepted challenged questions?",
        body: "A clear question used to exercise challenge appeal holds.",
        sponsorDisclosure: "Demo sponsor",
        proposer: "demo-proposer"
      }
    });
    expect(created.statusCode).toBe(200);
    const questionId = created.json().question.id as string;

    const challenge = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/challenges`,
      payload: { reasonCode: "MisleadingWording", evidence: "Weak evidence that should be rejected.", challenger: "demo-challenger" }
    });
    expect(challenge.statusCode).toBe(200);
    const challengeId = challenge.json().challenge.id as string;
    const challengeBondId = challenge.json().challenge.challengeBondId as string;

    const ruling = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/challenges/${challengeId}/ruling`,
      payload: { ruling: "Rejected", juror: "demo-curator", resolution: "The challenge does not meet registry standards." }
    });
    expect(ruling.statusCode).toBe(200);
    expect(ruling.json().question.status).toBe("Accepted");

    const blockedAppeal = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/challenges/${challengeId}/appeals`,
      payload: { appellantId: "demo-proposer", appeal: "The proposer did not lose this ruling." }
    });
    expect(blockedAppeal.statusCode).toBe(403);

    const appeal = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/challenges/${challengeId}/appeals`,
      payload: { appellantId: "demo-challenger", appeal: "The evidence was enough to require a second look." }
    });
    expect(appeal.statusCode).toBe(200);
    expect(appeal.json().appealArtifact.value).toMatchObject({
      artifactKind: "challenge-appeal",
      schemaVersion: "pc-challenge-appeal-v1",
      targetType: "QuestionChallenge",
      appealedRuling: "Rejected"
    });
    const appealId = appeal.json().appeal.id as string;
    const appealBondId = appeal.json().appeal.appealBondId as string;

    const blockedAccept = await app.inject({ method: "POST", url: `/questions/${questionId}/accept`, payload: { curator: "demo-curator" } });
    expect(blockedAccept.statusCode).toBe(409);
    expect(blockedAccept.json().error).toBe("Resolve pending challenge appeals before opening the poll");

    const appealLog = await app.inject({ method: "GET", url: `/questions/${questionId}/challenge-appeals?userId=demo-challenger` });
    expect(appealLog.statusCode).toBe(200);
    PublicApiV0ChallengeAppealsResponseSchema.parse(appealLog.json());
    expect(appealLog.json()).toMatchObject({
      protocol: {
        schemaVersion: "challenge-appeals-v0",
        statuses: { appealCount: 1, Pending: 1 },
        authority: { appealModel: "losing-side-appeal-bond", appealBondPc: 50 }
      },
      appeals: [{ id: appealId, appeal: "The evidence was enough to require a second look.", status: "Pending" }]
    });

    const selfRuling = await app.inject({
      method: "POST",
      url: `/challenge-appeals/${appealId}/ruling`,
      payload: { juror: "demo-challenger", ruling: "Upheld", resolution: "Self-ruling should fail." }
    });
    expect(selfRuling.statusCode).toBe(403);

    const upheld = await app.inject({
      method: "POST",
      url: `/challenge-appeals/${appealId}/ruling`,
      payload: { juror: "demo-curator", ruling: "Upheld", resolution: "The original rejection stands." }
    });
    expect(upheld.statusCode).toBe(200);
    expect(upheld.json().resolutionArtifact.value).toMatchObject({
      artifactKind: "challenge-appeal-resolution",
      schemaVersion: "pc-challenge-appeal-resolution-v1",
      ruling: "Upheld"
    });

    const appealProtocolTransactions = await app.inject({
      method: "GET",
      url: `/registry/protocol-transactions?subjectId=${questionId}&sourceModule=ChallengeCourt`
    });
    expect(appealProtocolTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(appealProtocolTransactions.json());
    expect(appealProtocolTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual(
      expect.arrayContaining(["ChallengeOpened", "ChallengeRuled", "ChallengeAppealed", "ChallengeAppealRuled"])
    );

    const ruledChallengeBondTransactions = await app.inject({
      method: "GET",
      url: `/registry/protocol-transactions?subjectId=${challengeBondId}&sourceModule=StakeManager`
    });
    expect(ruledChallengeBondTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(ruledChallengeBondTransactions.json());
    expect(ruledChallengeBondTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual(
      expect.arrayContaining(["BondEscrowed", "BondSettled"])
    );

    const upheldAppealBondTransactions = await app.inject({
      method: "GET",
      url: `/registry/protocol-transactions?subjectId=${appealBondId}&sourceModule=StakeManager`
    });
    expect(upheldAppealBondTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(upheldAppealBondTransactions.json());
    expect(upheldAppealBondTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual(
      expect.arrayContaining(["BondEscrowed", "BondSettled"])
    );

    const accepted = await app.inject({ method: "POST", url: `/questions/${questionId}/accept`, payload: { curator: "demo-curator" } });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().question.status).toBe("Open");

    const overturnedQuestion = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should sustained challenge rulings be appealable?",
        body: "A second question used to exercise overturned appeals.",
        sponsorDisclosure: "Demo sponsor",
        proposer: "demo-proposer"
      }
    });
    expect(overturnedQuestion.statusCode).toBe(200);
    const overturnedQuestionId = overturnedQuestion.json().question.id as string;

    const sustainedChallenge = await app.inject({
      method: "POST",
      url: `/questions/${overturnedQuestionId}/challenges`,
      payload: { reasonCode: "Spam", evidence: "Overly harsh challenge.", challenger: "demo-challenger" }
    });
    expect(sustainedChallenge.statusCode).toBe(200);
    const sustainedChallengeId = sustainedChallenge.json().challenge.id as string;

    const sustained = await app.inject({
      method: "POST",
      url: `/questions/${overturnedQuestionId}/challenges/${sustainedChallengeId}/ruling`,
      payload: { ruling: "Sustained", juror: "demo-curator", resolution: "Initial ruling sustains the challenge." }
    });
    expect(sustained.statusCode).toBe(200);
    expect(sustained.json().question.status).toBe("Rejected");

    const proposerAppeal = await app.inject({
      method: "POST",
      url: `/questions/${overturnedQuestionId}/challenges/${sustainedChallengeId}/appeals`,
      payload: { appellantId: "demo-proposer", appeal: "The challenge was over-applied." }
    });
    expect(proposerAppeal.statusCode).toBe(200);
    const proposerAppealId = proposerAppeal.json().appeal.id as string;

    const overturned = await app.inject({
      method: "POST",
      url: `/challenge-appeals/${proposerAppealId}/ruling`,
      payload: { juror: "demo-curator", ruling: "Overturned", resolution: "Appeal accepted; restore the question to acceptance review." }
    });
    expect(overturned.statusCode).toBe(200);
    expect(overturned.json().appeal).toMatchObject({ status: "Overturned", resolution: "Appeal accepted; restore the question to acceptance review." });

    const civicRecord = await app.inject({ method: "GET", url: `/public/questions/${overturnedQuestionId}/civic-record` });
    expect(civicRecord.statusCode).toBe(200);
    PublicApiV0CivicRecordResponseSchema.parse(civicRecord.json());
    expect(civicRecord.json()).toMatchObject({
      protocol: {
        ids: { challengeAppealIds: [proposerAppealId] },
        statuses: { questionStatus: "Accepted", challengeAppealStatuses: { Overturned: 1 } }
      },
      challengeAppeals: [expect.objectContaining({ id: proposerAppealId, status: "Overturned" })]
    });

    const bonds = await app.inject({ method: "GET", url: "/registry/bonds" });
    expect(bonds.statusCode).toBe(200);
    expect(bonds.json().bonds.find((bond: { id: string }) => bond.id === appealBondId)).toMatchObject({
      bondType: "Appeal",
      status: "Slashed",
      slashedPc: 50,
      treasuryPc: 5
    });

    const events = await app.inject({ method: "GET", url: "/registry/events" });
    expect(events.statusCode).toBe(200);
    expect(events.json().events.map((event: { eventType: string }) => event.eventType)).toEqual(
      expect.arrayContaining(["ChallengeAppealed", "ChallengeAppealRuled", "BondEscrowed", "BondSettled"])
    );

    const communityExport = await app.inject({ method: "GET", url: "/communities/community-vancouver/export?userId=demo-curator" });
    expect(communityExport.statusCode).toBe(200);
    PublicApiV0CommunityExportResponseSchema.parse(communityExport.json());
    expect(communityExport.json().protocol.statuses.challengeAppealCount).toBe(2);
    expect(communityExport.json().exportArtifact.artifact.challengeAppeals.map((record: { id: string }) => record.id)).toEqual(
      expect.arrayContaining([appealId, proposerAppealId])
    );
    expect(communityExport.json().bundle.manifest.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "challenge-appeal", hash: appeal.json().appealArtifact.hash }),
        expect.objectContaining({ kind: "challenge-appeal-resolution", hash: upheld.json().resolutionArtifact.hash })
      ])
    );
  });

  it("records formal result challenge appeals before finalization", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should result appeals pause finalization?",
        body: "A poll used to exercise result challenge appeal holds.",
        sponsorDisclosure: "Demo sponsor",
        proposer: "demo-proposer"
      }
    });
    expect(created.statusCode).toBe(200);
    const questionId = created.json().question.id as string;
    const pollId = created.json().question.poll.id as string;

    const accepted = await app.inject({ method: "POST", url: `/questions/${questionId}/accept`, payload: { curator: "demo-curator" } });
    expect(accepted.statusCode).toBe(200);

    const credential = await app.inject({
      method: "POST",
      url: "/credentials/demo-resident",
      payload: { holderAlias: "result-appeal-responder" }
    });
    expect(credential.statusCode).toBe(200);
    const issued = credential.json().credential;

    const vote = await app.inject({
      method: "POST",
      url: `/polls/${pollId}/vote`,
      payload: { credentialId: issued.credentialId, credentialSecret: issued.secret, choice: "support" }
    });
    expect(vote.statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: `/polls/${pollId}/close`, payload: {} })).statusCode).toBe(200);
    const tally = await app.inject({ method: "POST", url: `/polls/${pollId}/tally`, payload: {} });
    expect(tally.statusCode).toBe(200);

    const resultChallenge = await app.inject({
      method: "POST",
      url: `/polls/${pollId}/results/challenges`,
      payload: {
        challenger: "demo-challenger",
        reasonCode: "TallyProofFailure",
        evidence: "The proof should be checked by a second juror."
      }
    });
    expect(resultChallenge.statusCode).toBe(200);
    const resultChallengeId = resultChallenge.json().resultChallenge.id as string;

    const resultRuling = await app.inject({
      method: "POST",
      url: `/polls/${pollId}/results/challenges/${resultChallengeId}/ruling`,
      payload: { ruling: "Rejected", juror: "demo-curator", resolution: "The published tally proof is valid." }
    });
    expect(resultRuling.statusCode).toBe(200);
    expect(resultRuling.json().correctedArtifact).toBeNull();

    const appeal = await app.inject({
      method: "POST",
      url: `/polls/${pollId}/results/challenges/${resultChallengeId}/appeals`,
      payload: { appellantId: "demo-challenger", appeal: "The tally proof review omitted an input commitment." }
    });
    expect(appeal.statusCode).toBe(200);
    expect(appeal.json().appealArtifact.value).toMatchObject({
      artifactKind: "challenge-appeal",
      schemaVersion: "pc-challenge-appeal-v1",
      targetType: "ResultChallenge",
      appealedRuling: "Rejected"
    });
    const appealId = appeal.json().appeal.id as string;

    const blockedFinalize = await app.inject({ method: "POST", url: `/polls/${pollId}/finalize`, payload: { curator: "demo-curator" } });
    expect(blockedFinalize.statusCode).toBe(409);
    expect(blockedFinalize.json().error).toBe("Resolve pending result challenge appeals before finalization");

    const appealRuling = await app.inject({
      method: "POST",
      url: `/challenge-appeals/${appealId}/ruling`,
      payload: { juror: "demo-curator", ruling: "Overturned", resolution: "Appeal accepted; publish a corrected result artifact." }
    });
    expect(appealRuling.statusCode).toBe(200);
    expect(appealRuling.json().correctedArtifact.value).toMatchObject({
      artifactKind: "result-artifact-correction",
      schemaVersion: "pc-result-artifact-correction-v1",
      correctionAppealId: appealId
    });

    const appealProtocolTransactions = await app.inject({
      method: "GET",
      url: `/registry/protocol-transactions?subjectId=${questionId}&sourceModule=ChallengeCourt`
    });
    expect(appealProtocolTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(appealProtocolTransactions.json());
    expect(appealProtocolTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual(
      expect.arrayContaining(["ResultChallenged", "ResultChallengeRuled", "ResultChallengeAppealed", "ChallengeAppealRuled"])
    );

    const appealResultArchiveTransactions = await app.inject({
      method: "GET",
      url: `/registry/protocol-transactions?subjectId=${questionId}&sourceModule=ResultArchive`
    });
    expect(appealResultArchiveTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(appealResultArchiveTransactions.json());
    expect(appealResultArchiveTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual(
      expect.arrayContaining(["ResultPublished", "ResultCorrected"])
    );

    const appealBondTransactions = await app.inject({
      method: "GET",
      url: `/registry/protocol-transactions?subjectId=${appeal.json().appeal.appealBondId}&sourceModule=StakeManager`
    });
    expect(appealBondTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(appealBondTransactions.json());
    expect(appealBondTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual(
      expect.arrayContaining(["BondEscrowed", "BondSettled"])
    );

    const result = await app.inject({ method: "GET", url: `/polls/${pollId}/results` });
    expect(result.statusCode).toBe(200);
    expect(result.json().result.finalStatus).toBe("Corrected");

    const finalized = await app.inject({ method: "POST", url: `/polls/${pollId}/finalize`, payload: { curator: "demo-curator" } });
    expect(finalized.statusCode).toBe(200);

    const appealLog = await app.inject({ method: "GET", url: `/questions/${questionId}/challenge-appeals?userId=demo-challenger` });
    expect(appealLog.statusCode).toBe(200);
    PublicApiV0ChallengeAppealsResponseSchema.parse(appealLog.json());
    expect(appealLog.json().appeals).toEqual([expect.objectContaining({ id: appealId, targetType: "ResultChallenge", status: "Overturned" })]);
  });

  it("records juror selection and conflict disclosures before challenge rulings", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should challenge jurors disclose conflicts?",
        body: "A registry question used to exercise juror assignment records.",
        sponsorDisclosure: "Demo sponsor",
        proposer: "demo-proposer"
      }
    });
    expect(created.statusCode).toBe(200);
    const questionId = created.json().question.id as string;

    const challenge = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/challenges`,
      payload: { reasonCode: "MisleadingWording", evidence: "Juror assignment should be public.", challenger: "demo-challenger" }
    });
    expect(challenge.statusCode).toBe(200);
    const challengeId = challenge.json().challenge.id as string;

    const conflictedJuror = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/challenges/${challengeId}/juror-selection`,
      payload: { selectedBy: "demo-curator", jurorId: "demo-proposer", selectionReason: "A party should not be eligible." }
    });
    expect(conflictedJuror.statusCode).toBe(403);
    expect(conflictedJuror.json().error).toBe("Juror has a direct conflict with this target");

    const selection = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/challenges/${challengeId}/juror-selection`,
      payload: { selectedBy: "demo-curator", jurorId: "demo-curator", selectionReason: "Neutral moderator available for review." }
    });
    expect(selection.statusCode).toBe(200);
    expect(selection.json().selectionArtifact.value).toMatchObject({
      artifactKind: "juror-selection",
      schemaVersion: "pc-juror-selection-v1",
      targetType: "QuestionChallenge",
      jurorId: "demo-curator",
      selectionRule: "community-curator-with-no-party-conflict"
    });
    const conflictedAssignmentId = selection.json().assignment.id as string;

    const conflict = await app.inject({
      method: "POST",
      url: `/juror-assignments/${conflictedAssignmentId}/conflict-disclosure`,
      payload: { jurorId: "demo-curator", hasConflict: true, disclosure: "I helped draft evidence for this challenge." }
    });
    expect(conflict.statusCode).toBe(200);
    expect(conflict.json().disclosureArtifact.value).toMatchObject({
      artifactKind: "juror-conflict-disclosure",
      schemaVersion: "pc-juror-conflict-disclosure-v1",
      hasConflict: true
    });

    const blockedRuling = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/challenges/${challengeId}/ruling`,
      payload: { ruling: "Rejected", juror: "demo-curator", resolution: "A conflicted assignment should block ruling." }
    });
    expect(blockedRuling.statusCode).toBe(409);
    expect(blockedRuling.json().error).toBe("Selected juror has disclosed a conflict for this target");

    const secondSelection = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/challenges/${challengeId}/juror-selection`,
      payload: { selectedBy: "demo-curator", jurorId: "demo-curator", selectionReason: "Conflict cleared after assigning a fresh record." }
    });
    expect(secondSelection.statusCode).toBe(200);
    const clearAssignmentId = secondSelection.json().assignment.id as string;

    const clearDisclosure = await app.inject({
      method: "POST",
      url: `/juror-assignments/${clearAssignmentId}/conflict-disclosure`,
      payload: { jurorId: "demo-curator", hasConflict: false, disclosure: "No direct financial, authorship, or party conflict." }
    });
    expect(clearDisclosure.statusCode).toBe(200);

    const ruling = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/challenges/${challengeId}/ruling`,
      payload: {
        ruling: "Rejected",
        juror: "demo-curator",
        conflictDisclosure: "No direct financial, authorship, or party conflict.",
        resolution: "Challenge rejected after neutral review."
      }
    });
    expect(ruling.statusCode).toBe(200);
    expect(ruling.json().resolutionArtifact.value).toMatchObject({
      jurorAssignmentId: clearAssignmentId,
      conflictDisclosureHash: clearDisclosure.json().disclosureArtifact.hash
    });

    const jurorProtocolTransactions = await app.inject({
      method: "GET",
      url: `/registry/protocol-transactions?subjectId=${questionId}&sourceModule=ChallengeCourt`
    });
    expect(jurorProtocolTransactions.statusCode).toBe(200);
    PublicApiV0ProtocolTransactionsResponseSchema.parse(jurorProtocolTransactions.json());
    expect(jurorProtocolTransactions.json().transactions.map((transaction: { eventType: string }) => transaction.eventType)).toEqual(
      expect.arrayContaining(["ChallengeOpened", "JurorSelected", "JurorConflictDisclosed", "ChallengeRuled"])
    );

    const assignments = await app.inject({ method: "GET", url: `/questions/${questionId}/juror-assignments?userId=demo-curator` });
    expect(assignments.statusCode).toBe(200);
    PublicApiV0JurorAssignmentsResponseSchema.parse(assignments.json());
    expect(assignments.json()).toMatchObject({
      protocol: {
        schemaVersion: "juror-assignments-v0",
        statuses: { assignmentCount: 2, conflictStatuses: { Clear: 1, ConflictDeclared: 1 } },
        authority: { selectionRule: "community-curator-with-no-party-conflict", disclosureRequiredBeforeRuling: true }
      },
      assignments: [
        expect.objectContaining({ id: conflictedAssignmentId, conflictStatus: "ConflictDeclared" }),
        expect.objectContaining({ id: clearAssignmentId, conflictStatus: "Clear" })
      ]
    });

    const civicRecord = await app.inject({ method: "GET", url: `/public/questions/${questionId}/civic-record` });
    expect(civicRecord.statusCode).toBe(200);
    PublicApiV0CivicRecordResponseSchema.parse(civicRecord.json());
    expect(civicRecord.json()).toMatchObject({
      protocol: {
        ids: { jurorAssignmentIds: expect.arrayContaining([conflictedAssignmentId, clearAssignmentId]) },
        hashes: {
          jurorSelectionHashes: expect.arrayContaining([selection.json().selectionArtifact.hash, secondSelection.json().selectionArtifact.hash]),
          jurorConflictDisclosureHashes: expect.arrayContaining([conflict.json().disclosureArtifact.hash, clearDisclosure.json().disclosureArtifact.hash])
        },
        statuses: { jurorConflictStatuses: { Clear: 1, ConflictDeclared: 1 } }
      },
      jurorAssignments: [
        expect.objectContaining({ id: conflictedAssignmentId, conflictStatus: "ConflictDeclared" }),
        expect.objectContaining({ id: clearAssignmentId, conflictStatus: "Clear" })
      ]
    });

    const communityExport = await app.inject({ method: "GET", url: "/communities/community-vancouver/export?userId=demo-curator" });
    expect(communityExport.statusCode).toBe(200);
    PublicApiV0CommunityExportResponseSchema.parse(communityExport.json());
    expect(communityExport.json().protocol.statuses.jurorAssignmentCount).toBeGreaterThanOrEqual(2);
    expect(communityExport.json().exportArtifact.artifact.jurorAssignments.map((assignment: { id: string }) => assignment.id)).toEqual(
      expect.arrayContaining([conflictedAssignmentId, clearAssignmentId])
    );
    expect(communityExport.json().bundle.manifest.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "juror-selection", hash: selection.json().selectionArtifact.hash }),
        expect.objectContaining({ kind: "juror-conflict-disclosure", hash: clearDisclosure.json().disclosureArtifact.hash })
      ])
    );
  });

  it("opens questions after rejected challenges settle without ballot-side rewards", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should a valid challenge be rejected?",
        body: "A clear advisory question used to exercise rejected challenge settlement.",
        sponsorDisclosure: "Demo sponsor",
        proposer: "demo-proposer"
      }
    });
    expect(created.statusCode).toBe(200);
    const questionId = created.json().question.id as string;

    const challenge = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/challenges`,
      payload: { reasonCode: "MisleadingWording", evidence: "A weak challenge.", challenger: "demo-challenger" }
    });
    expect(challenge.statusCode).toBe(200);
    const challengeId = challenge.json().challenge.id as string;

    const ruling = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/challenges/${challengeId}/ruling`,
      payload: {
        ruling: "Rejected",
        juror: "demo-curator",
        resolution: "Rejected because the question is clear enough for advisory polling."
      }
    });
    expect(ruling.statusCode).toBe(200);
    expect(ruling.json().question.status).toBe("Accepted");

    const accept = await acceptQuestion(app, questionId);
    expect(accept.json().question.status).toBe("Open");
    expect(accept.json().poll.status).toBe("Open");

    const bonds = await app.inject({ method: "GET", url: "/registry/bonds" });
    expect(bonds.statusCode).toBe(200);
    const challengeBond = bonds.json().bonds.find((bond: { id: string }) => bond.id === challenge.json().challenge.challengeBondId);
    expect(challengeBond).toMatchObject({ status: "Slashed", slashedPc: 50, treasuryPc: 5 });
  });

  it("blocks credential farming and limits a holder to one demo credential", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should a single holder be limited to one credential?",
        body: "A duplicate credential resistance question.",
        sponsorDisclosure: "Demo sponsor",
        proposer: "demo-proposer"
      }
    });
    expect(created.statusCode).toBe(200);
    const questionId = created.json().question.id as string;
    const pollId = created.json().question.poll.id as string;

    await acceptQuestion(app, questionId);

    const credential = await app.inject({
      method: "POST",
      url: "/credentials/demo-resident",
      payload: { holderAlias: "single-credential-holder" }
    });
    expect(credential.statusCode).toBe(200);
    const issued = credential.json().credential;

    const duplicateCredential = await app.inject({
      method: "POST",
      url: "/credentials/demo-resident",
      payload: { holderAlias: "single-credential-holder" }
    });
    expect(duplicateCredential.statusCode).toBe(409);
    expect(duplicateCredential.json().error).toBe("Demo resident credential already issued for this holder");

    const vote = await app.inject({
      method: "POST",
      url: `/polls/${pollId}/vote`,
      payload: { credentialId: issued.credentialId, credentialSecret: issued.secret, choice: "support" }
    });
    expect(vote.statusCode).toBe(200);

    const duplicateVote = await app.inject({
      method: "POST",
      url: `/polls/${pollId}/vote`,
      payload: { credentialId: issued.credentialId, credentialSecret: issued.secret, choice: "oppose" }
    });
    expect(duplicateVote.statusCode).toBe(409);
    expect(duplicateVote.json().error).toBe("Duplicate ballot nullifier rejected");

    await app.inject({ method: "POST", url: `/polls/${pollId}/close`, payload: {} });
    const tally = await app.inject({ method: "POST", url: `/polls/${pollId}/tally`, payload: {} });
    expect(tally.statusCode).toBe(200);
    expect(tally.json().artifact).toMatchObject({ counts: { support: 1, oppose: 0, abstain: 0 }, turnout: 1 });
  });

  it("requires curator roles and blocks proposal or challenge self-dealing", async () => {
    const question = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should curation require a role?",
        body: "A registry authority question.",
        sponsorDisclosure: "Demo sponsor",
        proposer: "demo-proposer"
      }
    });
    expect(question.statusCode).toBe(200);
    const questionId = question.json().question.id as string;

    const selfAccept = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/accept`,
      payload: { curator: "demo-proposer" }
    });
    expect(selfAccept.statusCode).toBe(403);
    expect(selfAccept.json().error).toBe("Proposer cannot accept their own question");

    const memberAccept = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/accept`,
      payload: { curator: "demo-resident" }
    });
    expect(memberAccept.statusCode).toBe(403);
    expect(memberAccept.json().error).toBe("Only community owners or moderators can curate registry items");

    const accepted = await acceptQuestion(app, questionId);
    expect(accepted.json().question.status).toBe("Open");

    const challengedQuestion = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should challenge rulings require a neutral curator?",
        body: "A challenge-court authority question.",
        sponsorDisclosure: "Demo sponsor",
        proposer: "demo-proposer"
      }
    });
    expect(challengedQuestion.statusCode).toBe(200);
    const challengedQuestionId = challengedQuestion.json().question.id as string;

    const selfChallenge = await app.inject({
      method: "POST",
      url: `/questions/${challengedQuestionId}/challenges`,
      payload: { reasonCode: "Spam", evidence: "Self challenge should fail.", challenger: "demo-proposer" }
    });
    expect(selfChallenge.statusCode).toBe(403);
    expect(selfChallenge.json().error).toBe("Proposer cannot challenge their own question");

    const challenge = await app.inject({
      method: "POST",
      url: `/questions/${challengedQuestionId}/challenges`,
      payload: { reasonCode: "MisleadingWording", evidence: "Neutral review required.", challenger: "demo-challenger" }
    });
    expect(challenge.statusCode).toBe(200);
    const challengeId = challenge.json().challenge.id as string;

    const proposerRuling = await app.inject({
      method: "POST",
      url: `/questions/${challengedQuestionId}/challenges/${challengeId}/ruling`,
      payload: { ruling: "Rejected", juror: "demo-proposer", resolution: "Self-ruling should fail." }
    });
    expect(proposerRuling.statusCode).toBe(403);
    expect(proposerRuling.json().error).toBe("Proposer cannot rule on their own question challenge");

    const challengerRuling = await app.inject({
      method: "POST",
      url: `/questions/${challengedQuestionId}/challenges/${challengeId}/ruling`,
      payload: { ruling: "Sustained", juror: "demo-challenger", resolution: "Self-ruling should fail." }
    });
    expect(challengerRuling.statusCode).toBe(403);
    expect(challengerRuling.json().error).toBe("Challenger cannot rule on their own challenge");

    const memberRuling = await app.inject({
      method: "POST",
      url: `/questions/${challengedQuestionId}/challenges/${challengeId}/ruling`,
      payload: { ruling: "Rejected", juror: "demo-resident", resolution: "Member ruling should fail." }
    });
    expect(memberRuling.statusCode).toBe(403);
    expect(memberRuling.json().error).toBe("Only community owners or moderators can curate registry items");

    const curatorRuling = await app.inject({
      method: "POST",
      url: `/questions/${challengedQuestionId}/challenges/${challengeId}/ruling`,
      payload: { ruling: "Rejected", juror: "demo-curator", resolution: "Neutral moderator ruling succeeds." }
    });
    expect(curatorRuling.statusCode).toBe(200);
    expect(curatorRuling.json().question.status).toBe("Accepted");
  });

  it("enforces social access and privacy invariants", async () => {
    const owner = await app.inject({
      method: "POST",
      url: "/users",
      payload: { username: "private_owner", displayName: "Private Owner" }
    });
    expect(owner.statusCode).toBe(200);
    const ownerId = owner.json().user.id as string;

    const outsider = await app.inject({
      method: "POST",
      url: "/users",
      payload: { username: "outside_member", displayName: "Outside Member" }
    });
    expect(outsider.statusCode).toBe(200);
    const outsiderId = outsider.json().user.id as string;

    const curator = await app.inject({
      method: "POST",
      url: "/users",
      payload: { username: "private_curator", displayName: "Private Curator" }
    });
    expect(curator.statusCode).toBe(200);
    const curatorId = curator.json().user.id as string;

    const duplicateUser = await app.inject({
      method: "POST",
      url: "/users",
      payload: { username: "private_owner", displayName: "Duplicate Owner" }
    });
    expect(duplicateUser.statusCode).toBe(409);
    expect(duplicateUser.json().error).toBe("Username is already taken");

    const community = await app.inject({
      method: "POST",
      url: "/communities",
      payload: {
        name: "Private Assembly",
        slug: "private-assembly",
        description: "Member-only governance practice.",
        visibility: "Private",
        creatorId: ownerId
      }
    });
    expect(community.statusCode).toBe(200);
    const communityId = community.json().community.id as string;

    const duplicateCommunity = await app.inject({
      method: "POST",
      url: "/communities",
      payload: {
        name: "Private Assembly Copy",
        slug: "private-assembly",
        description: "Duplicate slug attempt.",
        visibility: "Public",
        creatorId: ownerId
      }
    });
    expect(duplicateCommunity.statusCode).toBe(409);
    expect(duplicateCommunity.json().error).toBe("Community slug is already taken");

    const curatorJoin = await app.inject({
      method: "POST",
      url: `/communities/${communityId}/join`,
      payload: { userId: curatorId }
    });
    expect(curatorJoin.statusCode).toBe(200);
    await prisma.communityMember.update({
      where: { communityId_userId: { communityId, userId: curatorId } },
      data: { role: "Moderator" }
    });

    const outsiderProposal = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should outsiders propose here?",
        body: "This should be rejected.",
        sponsorDisclosure: "No sponsor.",
        proposer: outsiderId,
        communityId
      }
    });
    expect(outsiderProposal.statusCode).toBe(403);
    expect(outsiderProposal.json().error).toBe("Join this private community before proposing a question");

    const privateQuestion = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Should the private assembly rotate facilitation?",
        body: "Member-only advisory question.",
        sponsorDisclosure: "Sponsored by private members.",
        proposer: ownerId,
        communityId
      }
    });
    expect(privateQuestion.statusCode).toBe(200);
    const questionId = privateQuestion.json().question.id as string;
    const pollId = privateQuestion.json().question.poll.id as string;
    expect(privateQuestion.json().question.poll.status).toBe("Configured");

    const publicFeed = await app.inject({ method: "GET", url: "/questions" });
    expect(publicFeed.statusCode).toBe(200);
    expect(publicFeed.json().questions.map((question: { id: string }) => question.id)).not.toContain(questionId);

    const outsiderGlobalFeed = await app.inject({ method: "GET", url: `/questions?userId=${outsiderId}` });
    expect(outsiderGlobalFeed.statusCode).toBe(200);
    expect(outsiderGlobalFeed.json().questions.map((question: { id: string }) => question.id)).not.toContain(questionId);

    const ownerGlobalFeed = await app.inject({ method: "GET", url: `/questions?userId=${ownerId}` });
    expect(ownerGlobalFeed.statusCode).toBe(200);
    expect(ownerGlobalFeed.json().questions.map((question: { id: string }) => question.id)).toContain(questionId);

    const blockedDetail = await app.inject({ method: "GET", url: `/questions/${questionId}` });
    expect(blockedDetail.statusCode).toBe(403);

    const blockedOutsiderDetail = await app.inject({ method: "GET", url: `/questions/${questionId}?userId=${outsiderId}` });
    expect(blockedOutsiderDetail.statusCode).toBe(403);

    const ownerDetail = await app.inject({ method: "GET", url: `/questions/${questionId}?userId=${ownerId}` });
    expect(ownerDetail.statusCode).toBe(200);
    expect(ownerDetail.json().question.id).toBe(questionId);

    const blockedHistory = await app.inject({ method: "GET", url: `/questions/${questionId}/history?userId=${outsiderId}` });
    expect(blockedHistory.statusCode).toBe(403);

    const blockedChallenge = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/challenges`,
      payload: { challenger: outsiderId, reasonCode: "MisleadingWording", evidence: "Outsider challenge." }
    });
    expect(blockedChallenge.statusCode).toBe(403);

    const blockedAmendment = await app.inject({
      method: "POST",
      url: `/questions/${questionId}/amendments`,
      payload: { proposer: outsiderId, body: "Outsider amendment." }
    });
    expect(blockedAmendment.statusCode).toBe(403);

    await acceptQuestion(app, questionId, curatorId);

    const outsiderCredential = await app.inject({
      method: "POST",
      url: "/credentials/demo-resident",
      payload: { holderAlias: outsiderId }
    });
    expect(outsiderCredential.statusCode).toBe(200);
    const outsiderIssued = outsiderCredential.json().credential;

    const blockedSignup = await app.inject({
      method: "POST",
      url: `/polls/${pollId}/signup`,
      payload: { credentialId: outsiderIssued.credentialId, credentialSecret: outsiderIssued.secret }
    });
    expect(blockedSignup.statusCode).toBe(403);

    const ownerCredential = await app.inject({
      method: "POST",
      url: "/credentials/demo-resident",
      payload: { holderAlias: ownerId }
    });
    expect(ownerCredential.statusCode).toBe(200);
    const ownerIssued = ownerCredential.json().credential;

    const ownerVote = await app.inject({
      method: "POST",
      url: `/polls/${pollId}/vote`,
      payload: { credentialId: ownerIssued.credentialId, credentialSecret: ownerIssued.secret, choice: "support" }
    });
    expect(ownerVote.statusCode).toBe(200);
    expect(ownerVote.json().ballot).not.toHaveProperty("encryptedPayloadJson");

    await app.inject({ method: "POST", url: `/polls/${pollId}/close`, payload: {} });
    const tally = await app.inject({ method: "POST", url: `/polls/${pollId}/tally`, payload: {} });
    expect(tally.statusCode).toBe(200);

    const blockedResult = await app.inject({ method: "GET", url: `/polls/${pollId}/results?userId=${outsiderId}` });
    expect(blockedResult.statusCode).toBe(403);

    const ownerResult = await app.inject({ method: "GET", url: `/polls/${pollId}/results?userId=${ownerId}` });
    expect(ownerResult.statusCode).toBe(200);
    expect(ownerResult.json().artifact).not.toHaveProperty("encryptedPayloadJson");
    expect(ownerResult.json().artifact.counts.support).toBe(1);
  });

  it("creates and tallies a non-binary approval poll through the shared answer schema model", async () => {
    const schemas = await app.inject({ method: "GET", url: "/answer-schemas" });
    expect(schemas.statusCode).toBe(200);
    expect(schemas.json().answerSchemas.map((schema: { answerSchemaId: string }) => schema.answerSchemaId)).toContain(
      "answer-approval-civic-priorities"
    );

    const created = await app.inject({
      method: "POST",
      url: "/questions",
      payload: {
        title: "Which civic priorities should the community approve?",
        body: "Members may approve any compatible priorities.",
        sponsorDisclosure: "Demo sponsor",
        proposer: "demo-proposer",
        answerSchemaId: "answer-approval-civic-priorities"
      }
    });
    expect(created.statusCode).toBe(200);
    expect(created.json().question.answerSchema.label).toBe("Approval / Select All");
    const questionId = created.json().question.id as string;
    const pollId = created.json().question.poll.id as string;

    await acceptQuestion(app, questionId);

    const credential = await app.inject({
      method: "POST",
      url: "/credentials/demo-resident",
      payload: { holderAlias: "approval-responder" }
    });
    expect(credential.statusCode).toBe(200);
    const issued = credential.json().credential;

    const vote = await app.inject({
      method: "POST",
      url: `/polls/${pollId}/vote`,
      payload: {
        credentialId: issued.credentialId,
        credentialSecret: issued.secret,
        response: { type: "multiple_choice", choices: ["safety", "service"] }
      }
    });
    expect(vote.statusCode).toBe(200);

    await app.inject({ method: "POST", url: `/polls/${pollId}/close`, payload: {} });
    const tally = await app.inject({ method: "POST", url: `/polls/${pollId}/tally`, payload: {} });
    expect(tally.statusCode).toBe(200);
    expect(tally.json().artifact.aggregate).toMatchObject({
      answerSchemaId: "answer-approval-civic-priorities",
      counts: { safety: 1, service: 1 },
      turnout: 1
    });
    expect(tally.json().artifact).not.toHaveProperty("encryptedPayloadJson");
  });

  it("creates, votes, closes, and tallies every built-in answer format through the API", async () => {
    const schemas = await app.inject({ method: "GET", url: "/answer-schemas" });
    expect(schemas.statusCode).toBe(200);
    expect(schemas.json().answerSchemas.map((schema: { answerSchemaId: string }) => schema.answerSchemaId)).toEqual(
      BuiltInAnswerSchemas.map((schema) => schema.answerSchemaId)
    );
    expect(apiFormatCases.map((testCase) => testCase.schemaId)).toEqual(BuiltInAnswerSchemas.map((schema) => schema.answerSchemaId));

    for (const [index, testCase] of apiFormatCases.entries()) {
      const created = await app.inject({
        method: "POST",
        url: "/questions",
        payload: {
          title: `Format coverage question ${index + 1}: ${testCase.schemaId}`,
          body: "A schema coverage question for the MVP test matrix.",
          sponsorDisclosure: "Demo sponsor",
          proposer: "demo-proposer",
          answerSchemaId: testCase.schemaId
        }
      });
      expect(created.statusCode).toBe(200);
      expect(created.json().question.answerSchema.answerSchemaId).toBe(testCase.schemaId);
      const questionId = created.json().question.id as string;
      const pollId = created.json().question.poll.id as string;

      await acceptQuestion(app, questionId);

      const credential = await app.inject({
        method: "POST",
        url: "/credentials/demo-resident",
        payload: { holderAlias: `format-responder-${index}` }
      });
      expect(credential.statusCode).toBe(200);
      const issued = credential.json().credential;

      const vote = await app.inject({
        method: "POST",
        url: `/polls/${pollId}/vote`,
        payload: {
          credentialId: issued.credentialId,
          credentialSecret: issued.secret,
          response: testCase.response
        }
      });
      expect(vote.statusCode).toBe(200);
      expect(vote.json().ballot).not.toHaveProperty("encryptedPayloadJson");

      const close = await app.inject({ method: "POST", url: `/polls/${pollId}/close`, payload: {} });
      expect(close.statusCode).toBe(200);

      const tally = await app.inject({ method: "POST", url: `/polls/${pollId}/tally`, payload: {} });
      expect(tally.statusCode).toBe(200);
      expect(tally.json().artifact.aggregate).toMatchObject({
        answerSchemaId: testCase.schemaId,
        turnout: 1,
        ...testCase.expectedAggregate
      });
      expect(tally.json().artifact).not.toHaveProperty("encryptedPayloadJson");
      if (testCase.rawTextNotPublished) expect(JSON.stringify(tally.json().artifact)).not.toContain(testCase.rawTextNotPublished);
    }
  });
});
