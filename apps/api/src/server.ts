import cors from "@fastify/cors";
import { pathToFileURL } from "node:url";
import { getAddress, verifyMessage, type Hex } from "viem";
import {
  buildArtifactManifest,
  createFileArtifactStorage,
  hashArtifactManifest,
  hashJson,
  withArtifactSchema,
  type ArtifactExportBundle,
  type ArtifactReference,
  type ArtifactKind,
  type ArtifactManifest,
  type ArtifactStorageAdapter
} from "@pc/artifacts";
import { prisma, type Prisma } from "@pc/db";
import {
  AcceptQuestionRequestSchema,
  ActivateAdoptionPolicyRequestSchema,
  ActivateDataUnionPolicyRequestSchema,
  ActivateGovernanceParametersRequestSchema,
  ActivateTallyCommitteeRequestSchema,
  AmendmentRequestSchema,
  ArchiveQuestionRequestSchema,
  ApproveDataUnionBuyerRequestSchema,
  BuiltInAnswerSchemas,
  CanonicalProtocolBoundary,
  ChallengeRulingRequestSchema,
  CommunityImportReplayRequestSchema,
  CreateModerationAppealRequestSchema,
  CreateCredentialIssuerRequestSchema,
  CreateCredentialSchemaRequestSchema,
  CredentialProofRequestSchema,
  CreateChallengeAppealRequestSchema,
  CreateChallengeRequestSchema,
  CreateCommunityForkRequestSchema,
  CreateCommunityRequestSchema,
  CreateCommunityEmergencySuspensionRequestSchema,
  CreateDiscussionPostRequestSchema,
  CreateQuestionRequestSchema,
  CreateResultChallengeRequestSchema,
  CreateTallyCommitteeRequestSchema,
  CreateUserRequestSchema,
  DemoResidentCredentialRequestSchema,
  DiscloseJurorConflictRequestSchema,
  DiscussionPostKindSchema,
  DiscussionModerationReasonCodeSchema,
  DiscussionViewDefinitions,
  ExportWalletCredentialRequestSchema,
  FailTallyCommitteeRequestSchema,
  FeedQuerySchema,
  FinalizeResultRequestSchema,
  FollowCommunityRequestSchema,
  FollowTopicRequestSchema,
  GrantDataUnionAccessRequestSchema,
  ImportWalletCredentialRequestSchema,
  JoinCommunityRequestSchema,
  MinimumProtocolCommitments,
  ModerateDiscussionPostRequestSchema,
  ProposeAdoptionPolicyRequestSchema,
  ProposeDataUnionPolicyRequestSchema,
  ProposeGovernanceParametersRequestSchema,
  PublishDataUnionProductRequestSchema,
  RedeemParticipationReceiptRequestSchema,
  RedeemDataUnionClaimRequestSchema,
  ReputationReplayRequestSchema,
  RecordDataUnionSettlementRequestSchema,
  RegisterAnonymousEligibilityGroupRequestSchema,
  ResultChallengeRulingRequestSchema,
  ResolveChallengeAppealRequestSchema,
  ResolveCommunityChildProposalRequestSchema,
  ResolveCommunityEmergencySuspensionRequestSchema,
  ResolveModerationAppealRequestSchema,
  RevokeCredentialRequestSchema,
  RecordDataUnionConsentRequestSchema,
  RevokeDataUnionConsentRequestSchema,
  SelectJurorRequestSchema,
  SetCommunityCredentialTrustPolicyRequestSchema,
  SetCommunityFrontendConfigRequestSchema,
  SetCommunityRegistryPolicyRequestSchema,
  SetupTallyPublicKeyRequestSchema,
  StartPasskeyDeploymentRequestSchema,
  StartPasskeyLoginRequestSchema,
  StartPasskeyRegistrationRequestSchema,
  StartWalletAuthRequestSchema,
  SubmitTallyDecryptionShareRequestSchema,
  SuspendCredentialIssuerRequestSchema,
  SuspendAdoptionPolicyRequestSchema,
  VerifyPasskeyDeploymentRequestSchema,
  VerifyPasskeyLoginRequestSchema,
  VerifyPasskeyRegistrationRequestSchema,
  VerifyWalletAuthRequestSchema,
  VoteCommunityChildProposalRequestSchema,
  VoteRequestSchema,
  choiceToBallotResponse,
  getAnswerSchema,
  validateBallotResponse,
  type ChallengeAppealStatus,
  type ChallengeAppealTargetType,
  type CredentialMembershipProof,
  type CredentialIssuerAnnotation,
  type DataUnionAccessGrant,
  type DataUnionBuyer,
  type DataUnionClaim,
  type DataUnionConsent,
  type DataUnionPolicy,
  type DataUnionProduct,
  type DataUnionRevenueSplit,
  type DataUnionSettlement,
  type DemoVoteRequest,
  type DiscussionModerationAction,
  type DiscussionPostKind,
  type DiscussionViewKey,
  type JurorConflictStatus,
  type JurorTargetType,
  type StewardPower,
  type TreasuryLedgerEntry,
  type TreasuryLedgerTotals,
  type WalletCredential
} from "@pc/shared";
import {
  anonymousBallotProofHash,
  anonymousPollScope,
  ballotCommitment,
  createCoordinatorKeypair,
  createCredentialMembershipProof,
  credentialIdForDemoCredential,
  encryptBallot,
  hashDemoCredentialSecret,
  issueDemoCredential,
  normalizeTallyPublicKeyPem,
  participationReceiptHash,
  tallyEncryptedBallots,
  tallyPublicKeyId,
  verifyAnonymousBallotProof,
  verifyCredentialMembershipProof,
  verifyDemoCredential,
  type AnonymousBallotProof,
  type EncryptedBallotPayload
} from "@pc/privacy";
import {
  PRODUCTION_SLICE_CRYPTO_MODE,
  PRODUCTION_SLICE_PROOF_SYSTEM,
  createProductionSliceExport,
  credentialTrustPolicyHash as productionSliceCredentialTrustPolicyHash,
  decryptionShareHash as productionSliceDecryptionShareHash,
  decryptionShareSignaturePayload,
  eligibilityProofHash,
  eligibilityProofPublicInputsHash,
  eligibilityProofVerificationPayload,
  questionVersionHash as productionSliceQuestionVersionHash,
  signEd25519,
  tallyKeySetupHash as productionSliceTallyKeySetupHash,
  tallyPublicationProofHash as productionSliceTallyPublicationProofHash,
  verifyEd25519,
  type ProductionSliceBallot,
  type ProductionSliceChallenge,
  type ProductionSliceCredentialIssuer,
  type ProductionSliceCredentialSchema,
  type ProductionSliceEligibilityProof,
  type ProductionSlicePoll,
  type ProductionSliceQuestion,
  type ProductionSliceResult,
  type ProductionSliceResultArtifact,
  type ProductionSliceTallyDecryptionShare,
  type ProductionSliceTallyKeySetup,
  type ProductionSliceTrustPolicy,
  type ProductionSliceVerificationInput
} from "@pc/protocol-slice";
import Fastify, { type FastifyReply } from "fastify";
import { nanoid } from "nanoid";
import {
  attachPasskeySignature,
  attachWalletSignature,
  fromBundlerUserOperation,
  getLocalUserOpHash,
  predictSmartAccount,
  prepareDeploymentUserOperation,
  submitLocalUserOperation,
  submitUserOperation,
  type SerializedUserOperation,
  type SmartAccountPrediction
} from "./aa";
import {
  base64UrlEncode,
  buildWalletAuthMessage,
  hashSessionToken,
  newAuthChallenge,
  newSessionToken,
  parsePasskeyAssertion,
  parsePasskeyAttestation,
  verifyPasskeySignature
} from "./auth";
import { config } from "./config";
import { ensureSeedData, resetDemoData } from "./seed";
import type { FastifyRequest } from "fastify";

const DEFAULT_GOVERNANCE = {
  proposalBondPc: 100,
  challengeBondPc: 50,
  appealBondPc: 50,
  protocolFeePc: 5,
  successfulChallengeRewardPc: 45,
  failedChallengeProposerRewardPc: 20,
  jurorRewardWeight: 2,
  successfulChallengeReputation: 5,
  acceptedAmendmentReputation: 2,
  privacyThreshold: 1,
  challengeWindowHours: 1,
  resultChallengeWindowHours: 25,
  pollDurationHours: 24,
  reputationDecayRule: "none-in-mvp"
};

type GovernanceParameters = typeof DEFAULT_GOVERNANCE;

const AUTHORITY_RANK = {
  Advisory: 0,
  Recognized: 1,
  Binding: 2
} as const;

const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 100;
const CURATOR_ROLES = ["Owner", "Moderator"];
const COMMUNITY_ROLE_RANK = { Member: 0, Moderator: 1, Owner: 2 } as const;
const DEFAULT_REGISTRY_POLICY = {
  approvalThresholdPercent: 66,
  quorumPercent: 10,
  reviewWindowHours: 168
};
const STEWARD_POWERS: StewardPower[] = [
  {
    role: "Owner",
    actions: ["AdoptionPolicy", "GovernanceParameters", "FrontendConfig", "ForkExport", "JurorSelection", "EmergencySuspension", "TechnicalUpgrade"],
    limits: [
      "All steward actions are artifact-backed and recorded as registry events.",
      "Technical upgrades must satisfy the published upgrade safety model before activation.",
      "Emergency suspension can pause protocol writes but must be resolved with a public reason artifact.",
      "Committed-decision rules still require an explicit legal or community handoff."
    ]
  },
  {
    role: "Moderator",
    actions: ["AdoptionPolicy", "FrontendConfig", "ForkExport", "JurorSelection", "EmergencySuspension"],
    limits: [
      "Governance parameter changes remain separately logged as proposal and activation artifacts.",
      "Emergency suspension can pause protocol writes but must be resolved with a public reason artifact.",
      "Moderator powers remain visible in community exports and public steward-power views."
    ]
  }
];
const UPGRADE_SAFETY_MIN_REVIEW_HOURS = 72;
const UPGRADE_SAFETY_UPGRADE_CLASSES = ["GovernanceParameters", "AdoptionPolicy", "ProtocolImplementation", "EmergencyAction"];
const UPGRADE_SAFETY_KNOWN_MVP_LIMITS = [
  "Local devnet records model timelocked activation through effectiveAt fields; production deployments should enforce the minimum review window at the contract/appchain layer.",
  "The public testnet independent-operator gate remains pending until external operators run and replay the protocol feed."
];
const PUBLIC_ARTIFACT_KINDS = new Set<string>([
  "credential-schema",
  "credential-issuer",
  "credential-issuer-suspension",
  "credential-revocation-root",
  "community-credential-trust-policy",
  "tally-committee-proposal",
  "tally-committee-activation",
  "tally-committee-failure",
  "tally-key-setup",
  "tally-decryption-share",
  "tally-publication-proof",
  "production-slice-eligibility-proof",
  "user-profile",
  "social-follow",
  "reputation-export",
  "result-artifact",
  "result-artifact-correction",
  "question-archive",
  "community-fork",
  "community-frontend-config",
  "governance-parameter-proposal",
  "governance-parameter-activation",
  "community-emergency-suspension",
  "community-emergency-resolution",
  "adoption-policy-proposal",
  "adoption-policy-activation",
  "adoption-policy-suspension",
  "data-union-policy",
  "data-union-policy-activation",
  "data-union-product",
  "data-union-buyer-approval",
  "data-union-settlement",
  "data-union-access-grant"
]);
const COMMUNITY_GATED_ARTIFACT_KINDS = new Set<string>([
  "question-body",
  "sponsor-disclosure",
  "question-challenge-evidence",
  "question-challenge-resolution",
  "challenge-appeal",
  "challenge-appeal-resolution",
  "juror-selection",
  "juror-conflict-disclosure",
  "discussion-post",
  "discussion-moderation",
  "discussion-moderation-appeal",
  "discussion-moderation-resolution",
  "result-challenge-evidence",
  "result-challenge-resolution",
  "data-union-consent",
  "data-union-consent-revocation",
  "data-union-claim-redemption",
  "community-export",
  "credential-revocation"
]);
const PUBLIC_TESTNET_OPERATOR_REQUIREMENTS = [
  {
    role: "deployer",
    minimumCount: 1,
    responsibility: "Deploy appchain/contracts and publish addresses, chain id, commit hash, and deployment transaction ids."
  },
  {
    role: "api-indexer",
    minimumCount: 2,
    responsibility: "Run API/indexer nodes against the public testnet feed and publish replay hashes."
  },
  {
    role: "replay-verifier",
    minimumCount: 3,
    responsibility: "Fetch public protocol transaction feeds and verify replay output without trusting domain tables."
  },
  {
    role: "community-steward",
    minimumCount: 2,
    responsibility: "Exercise governance parameter, adoption, emergency pause, fork/export, and upgrade-safety reads."
  }
] as const;
const PUBLIC_TESTNET_REQUIRED_COMMANDS = [
  "pnpm install --frozen-lockfile",
  "cp infra/public-testnet.env.example .env.public-testnet",
  "pnpm typecheck",
  "pnpm --filter @pc/shared test",
  "pnpm --filter @pc/contracts test",
  "pnpm test:api:db",
  "pnpm testnet:collect-attestation -- --operator-id <operator-id> --operator-contact <contact-or-public-key> --independence-statement <independence-claim> --role <role> --git-commit <commit> --chain-id <chain-id> --rpc-url <rpc-url> --api-base-url <api-base-url> --community-id <community-id> --out docs/public-testnet-attestations/<operator-id>.json",
  "pnpm testnet:write-launch-summary -- --decision GO --independence-reviewed --testnet-window <window>",
  "pnpm testnet:verify-attestations"
];
const PUBLIC_TESTNET_REQUIRED_ENDPOINTS = [
  "GET /public/protocol/appchain-boundary",
  "GET /public/protocol/testnet-readiness",
  "GET /registry/protocol-transactions",
  "GET /registry/protocol-transactions/replay",
  "GET /communities/:communityId/governance/upgrade-safety",
  "GET /communities/:communityId/export"
];
const PUBLIC_TESTNET_GOVERNANCE_DRILLS = [
  "Propose and activate governance parameters with an explicit effectiveAt.",
  "Propose and activate an adoption policy.",
  "Open and resolve an emergency suspension.",
  "Export a community bundle and replay it through /communities/imports/replay.",
  "Publish fork metadata against a community export hash.",
  "Verify upgrade-safety reflects active parameters and emergency state changes."
];
const PUBLIC_TESTNET_KNOWN_LIMITATIONS = [
  "The final roadmap gate requires real independent operators; a local self-run does not satisfy it.",
  "Deployment uses the current MVP deployment adapter until a dedicated public-testnet deploy script is split out.",
  "Operator attestations must be published as content-addressed launch evidence before completion."
];
const UNPUBLISHED_QUESTION_STATUSES = ["Submitted", "Challenged", "Amendment", "Accepted", "Open", "Closed"];
const REGISTRY_EVENT_ORDER: Prisma.RegistryEventOrderByWithRelationInput[] = [{ emittedAt: "asc" }, { id: "asc" }];
const COMMITMENT_RECORD_ORDER: Prisma.ProtocolCommitmentRecordOrderByWithRelationInput[] = [{ createdAt: "asc" }, { id: "asc" }];
const CREDENTIAL_WALLET_BOUNDARY = {
  protocol: "wallet-held-credential-boundary-v0",
  holderSecretLocation: "client-wallet",
  serverStores: ["credentialId", "holderAlias", "schemaId", "issuerId", "secretHash", "issuedAt"],
  serverDoesNotStore: ["credentialSecret"],
  importChecks: ["credential-id-derived-from-secret", "schema-active", "issuer-active", "not-expired", "not-revoked"]
} as const;
const PROTOCOL_EVENT_SOURCE_TYPE = "local-devnet";
const PROTOCOL_EVENT_MODULE_BY_TYPE = new Map<string, string>();
for (const protocolModule of CanonicalProtocolBoundary.modules) {
  for (const eventType of protocolModule.eventTypes) {
    if (!PROTOCOL_EVENT_MODULE_BY_TYPE.has(eventType)) PROTOCOL_EVENT_MODULE_BY_TYPE.set(eventType, protocolModule.id);
  }
}

export function buildServer() {
  assertProductionPrivacyConfig();
  const app = Fastify({ logger: config.devMode });
  const artifactStore = createFileArtifactStorage(config.artifactDir);
  void app.register(cors, { origin: config.corsOrigin, credentials: true });

  app.get("/health", async () => ({ ok: true, devMode: config.devMode, demoMode: config.demoMode }));

  app.get("/public/protocol/commitments", async () => ({
    protocol: buildMinimumCommitmentsProtocol(),
    commitments: MinimumProtocolCommitments
  }));

  app.get("/public/protocol/appchain-boundary", async () => CanonicalProtocolBoundary);

  app.get("/public/protocol/testnet-readiness", async () => {
    const readiness = buildPublicTestnetReadiness();
    return {
      protocol: buildPublicTestnetReadinessProtocol(readiness),
      ...readiness
    };
  });

  app.get("/answer-schemas", async () => ({ answerSchemas: BuiltInAnswerSchemas }));

  app.get("/credential-schemas", async () => {
    const credentialSchemas = await prisma.credentialSchema.findMany({ orderBy: { createdAt: "asc" } });
    return { credentialSchemas };
  });

  app.post("/credential-schemas", async (request, reply) => {
    const input = CreateCredentialSchemaRequestSchema.parse(request.body ?? {});
    if (!(await requireAuthenticatedActor(request, reply, input.steward))) return;
    const steward = await prisma.userAccount.findUnique({ where: { id: input.steward } });
    if (!steward) return reply.code(404).send({ error: "Community guide account not found" });

    const schemaArtifact = await artifactStore.write(
      withArtifactSchema("credential-schema", {
        credentialSchemaId: input.credentialSchemaId,
        name: input.name,
        issuerRegistryId: input.issuerRegistryId,
        eligibilityClaim: input.eligibilityClaim,
        nullifierDomainRule: input.nullifierDomainRule,
        expiresAfter: input.expiresAfter,
        revocationRoot: input.revocationRoot
      })
    );
    await storeArtifact(schemaArtifact, "credential-schema");

    try {
      const credentialSchemaRegisteredEvent = prepareProtocolEvent({
        eventType: "CredentialSchemaRegistered",
        subjectId: input.credentialSchemaId,
        actor: input.steward,
        previousHash: null,
        newHash: schemaArtifact.hash
      });
      const credentialSchema = await prisma.$transaction(async (tx) => {
        const protocolEvent = await ingestProtocolEvent(tx, credentialSchemaRegisteredEvent);
        const created = await tx.credentialSchema.create({
          data: {
            id: input.credentialSchemaId,
            name: input.name,
            issuerRegistryId: input.issuerRegistryId,
            eligibilityClaimHash: hashJson({ claim: input.eligibilityClaim }),
            nullifierDomainRule: input.nullifierDomainRule,
            expiresAfter: input.expiresAfter,
            revocationRoot: input.revocationRoot,
            status: "Active"
          }
        });
        await recordProtocolCommitments(protocolEvent, tx);
        return created;
      });
      return { credentialSchema, schemaArtifact };
    } catch {
      return reply.code(409).send({ error: "Voting pass type is already registered" });
    }
  });

  app.get("/credential-issuers", async () => {
    const credentialIssuers = await prisma.credentialIssuer.findMany({ orderBy: { createdAt: "asc" } });
    return { credentialIssuers };
  });

  app.post("/credential-issuers", async (request, reply) => {
    const input = CreateCredentialIssuerRequestSchema.parse(request.body ?? {});
    if (!(await requireAuthenticatedActor(request, reply, input.steward))) return;
    const steward = await prisma.userAccount.findUnique({ where: { id: input.steward } });
    if (!steward) return reply.code(404).send({ error: "Community guide account not found" });
    const activeSchemas = await prisma.credentialSchema.findMany({
      where: { id: { in: input.schemaIds }, status: "Active" }
    });
    if (activeSchemas.length !== input.schemaIds.length) {
      return reply.code(400).send({ error: "All issuer schemas must be active before registration" });
    }

    const issuerArtifact = await artifactStore.write(
      withArtifactSchema("credential-issuer", {
        issuerId: input.issuerId,
        publicKey: input.publicKey,
        schemaIds: input.schemaIds,
        metadata: input.metadata
      })
    );
    await storeArtifact(issuerArtifact, "credential-issuer");

    try {
      const credentialIssuerRegisteredEvent = prepareProtocolEvent({
        eventType: "CredentialIssuerRegistered",
        subjectId: input.issuerId,
        actor: input.steward,
        previousHash: null,
        newHash: issuerArtifact.hash
      });
      const credentialIssuer = await prisma.$transaction(async (tx) => {
        const protocolEvent = await ingestProtocolEvent(tx, credentialIssuerRegisteredEvent);
        const created = await tx.credentialIssuer.create({
          data: {
            id: input.issuerId,
            publicKey: input.publicKey,
            schemaIds: input.schemaIds,
            metadataHash: issuerArtifact.hash,
            status: "Active"
          }
        });
        await recordProtocolCommitments(protocolEvent, tx);
        return created;
      });
      return { credentialIssuer, issuerArtifact };
    } catch {
      return reply.code(409).send({ error: "Voting pass issuer is already registered" });
    }
  });

  app.post("/credential-issuers/:issuerId/suspend", async (request, reply) => {
    const { issuerId } = request.params as { issuerId: string };
    const input = SuspendCredentialIssuerRequestSchema.parse(request.body ?? {});
    if (!(await requireAuthenticatedActor(request, reply, input.steward))) return;
    const steward = await prisma.userAccount.findUnique({ where: { id: input.steward } });
    if (!steward) return reply.code(404).send({ error: "Community guide account not found" });
    const issuer = await prisma.credentialIssuer.findUnique({ where: { id: issuerId } });
    if (!issuer) return reply.code(404).send({ error: "Voting pass issuer not found" });

    const suspensionArtifact = await artifactStore.write(
      withArtifactSchema("credential-issuer-suspension", { issuerId, suspendedBy: input.steward, reason: input.reason })
    );
    await storeArtifact(suspensionArtifact, "credential-issuer-suspension");
    const credentialIssuerSuspendedEvent = prepareProtocolEvent({
      eventType: "CredentialIssuerSuspended",
      subjectId: issuerId,
      actor: input.steward,
      previousHash: issuer.metadataHash,
      newHash: suspensionArtifact.hash
    });
    const credentialIssuer = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, credentialIssuerSuspendedEvent);
      const updated = await tx.credentialIssuer.update({
        where: { id: issuerId },
        data: { status: "Suspended" }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return updated;
    });
    return { credentialIssuer, suspensionArtifact };
  });

  app.post("/credentials/:credentialId/revoke", async (request, reply) => {
    const { credentialId } = request.params as { credentialId: string };
    const input = RevokeCredentialRequestSchema.parse(request.body ?? {});
    if (!(await requireAuthenticatedActor(request, reply, input.steward))) return;
    const [steward, credential] = await Promise.all([
      prisma.userAccount.findUnique({ where: { id: input.steward } }),
      prisma.credential.findUnique({ where: { id: credentialId } })
    ]);
    if (!steward) return reply.code(404).send({ error: "Community guide account not found" });
    if (!credential) return reply.code(404).send({ error: "Voting pass not found" });

    const schema = await prisma.credentialSchema.findUnique({ where: { id: credential.schemaId } });
    if (!schema) return reply.code(404).send({ error: "Voting pass type not found" });
    const existingRevocation = await prisma.credentialRevocation.findUnique({ where: { credentialId } });
    if (existingRevocation) return reply.code(409).send({ error: "Voting pass was already revoked" });

    const revocationArtifact = await artifactStore.write(
      withArtifactSchema("credential-revocation", {
        credentialId,
        schemaId: credential.schemaId,
        issuerId: credential.issuerId,
        revokedBy: input.steward,
        reason: input.reason
      })
    );
    await storeArtifact(revocationArtifact, "credential-revocation");
    const leafHash = credentialRevocationLeafHash({
      credentialId,
      schemaId: credential.schemaId,
      issuerId: credential.issuerId,
      revocationHash: revocationArtifact.hash
    });
    const revocationRootArtifact = await writeCredentialRevocationRoot(credential.schemaId, schema.revocationRoot, [
      { leafHash, revocationHash: revocationArtifact.hash }
    ]);
    const credentialRevokedEvent = prepareProtocolEvent({
      eventType: "CredentialRevoked",
      subjectId: credentialId,
      actor: input.steward,
      previousHash: schema.revocationRoot,
      newHash: revocationArtifact.hash
    });
    const credentialRevocationRootUpdatedEvent = prepareProtocolEvent({
      eventType: "CredentialRevocationRootUpdated",
      subjectId: credential.schemaId,
      actor: input.steward,
      previousHash: schema.revocationRoot,
      newHash: revocationRootArtifact.hash
    });
    const revocation = await prisma.$transaction(async (tx) => {
      const protocolEvents = [
        await ingestProtocolEvent(tx, credentialRevokedEvent),
        await ingestProtocolEvent(tx, credentialRevocationRootUpdatedEvent)
      ];
      const created = await tx.credentialRevocation.create({
        data: {
          id: `credential-revocation-${nanoid(10)}`,
          credentialId,
          schemaId: credential.schemaId,
          issuerId: credential.issuerId,
          revokedBy: input.steward,
          revocationHash: revocationArtifact.hash,
          leafHash,
          rootHash: revocationRootArtifact.hash
        }
      });
      await tx.credentialSchema.update({ where: { id: credential.schemaId }, data: { revocationRoot: revocationRootArtifact.hash } });
      for (const protocolEvent of protocolEvents) await recordProtocolCommitments(protocolEvent, tx);
      return created;
    });
    return {
      credentialRevocation: revocation,
      revocationArtifact,
      revocationRoot: revocationRootArtifact
    };
  });

  app.post("/dev/reset", async (request, reply) => {
    if (!config.devMode) return reply.code(404).send({ error: "Not found" });
    await resetDemoData();
    return { ok: true };
  });

  app.get("/users", async () => {
    const users = await prisma.userAccount.findMany({ orderBy: { createdAt: "asc" } });
    return { users };
  });

  app.post("/users", async (request, reply) => {
    if (config.requireAuth) {
      return reply.code(410).send({ error: "Use account-abstraction signup for authenticated accounts" });
    }
    const input = CreateUserRequestSchema.parse(request.body ?? {});
    const username = input.username.toLowerCase();
    const userId = `user-${username}`;
    const profileId = portableProfileId(userId);
    const profileCommunityId = profileCommunityIdForUser(userId);
    const existing = await prisma.userAccount.findFirst({ where: { OR: [{ id: userId }, { username }, { profileId }] } });
    if (existing) return reply.code(409).send({ error: "Username is already taken" });

    const profileArtifact = await artifactStore.write(
      withArtifactSchema("user-profile", {
        profileId,
        userId,
        username,
        displayName: input.displayName,
        bio: input.bio
      })
    );
    await storeArtifact(profileArtifact, "user-profile");

    try {
      const userCreatedEvent = prepareProtocolEvent({
        eventType: "UserCreated",
        subjectId: userId,
        actor: userId,
        previousHash: null,
        newHash: profileArtifact.hash
      });
      const user = await prisma.$transaction(async (tx) => {
        const protocolEvent = await ingestProtocolEvent(tx, userCreatedEvent);
        const created = await tx.userAccount.create({
          data: {
            id: userId,
            username,
            profileId,
            profileHash: profileArtifact.hash,
            profileCommunityId,
            displayName: input.displayName,
            bio: input.bio
          }
        });
        await createProfileCommunityForUser(tx, {
          id: userId,
          username,
          displayName: input.displayName,
          bio: input.bio,
          profileCommunityId
        });
        await recordProtocolCommitments(protocolEvent, tx);
        return created;
      });
      return { user, profileArtifact };
    } catch {
      return reply.code(409).send({ error: "Username is already taken" });
    }
  });

  app.get("/auth/session", async (request, reply) => {
    const session = await readAuthSession(request);
    if (!session) return reply.code(401).send({ error: "Authentication required" });
    return {
      user: session.user,
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
        aaAccountAddress: session.aaAccountAddress,
        controllerId: session.controllerId
      }
    };
  });

  app.get("/auth/aa/config", async () => ({
    accountStandard: "erc-4337-local-v1",
    ready: Boolean(config.accountAbstraction.entryPoint && config.accountAbstraction.accountFactory),
    chainId: config.accountAbstraction.chainId,
    rpcUrl: config.accountAbstraction.rpcUrl,
    bundlerUrl: config.accountAbstraction.bundlerUrl,
    entryPoint: config.accountAbstraction.entryPoint,
    accountFactory: config.accountAbstraction.accountFactory,
    paymaster: config.accountAbstraction.paymaster,
    p256Verifier: config.accountAbstraction.p256Verifier
  }));

  app.post("/auth/aa/bundler", async (request, reply) => {
    const body = (request.body ?? {}) as {
      jsonrpc?: unknown;
      id?: unknown;
      method?: unknown;
      params?: unknown;
    };
    const id = body.id ?? null;
    const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

    if (body.jsonrpc !== "2.0") return reply.code(400).send(fail(-32600, "Invalid JSON-RPC version"));
    if (body.method !== "eth_sendUserOperation") return reply.code(404).send(fail(-32601, "Method not found"));
    if (!Array.isArray(body.params) || body.params.length < 2) return reply.code(400).send(fail(-32602, "Invalid params"));
    if (!config.accountAbstraction.entryPoint) return reply.code(503).send(fail(-32000, "EntryPoint deployment is not configured"));

    let entryPoint: ReturnType<typeof getAddress>;
    let userOperation: SerializedUserOperation;
    try {
      entryPoint = getAddress(String(body.params[1]));
      if (entryPoint.toLowerCase() !== config.accountAbstraction.entryPoint.toLowerCase()) {
        return reply.code(400).send(fail(-32602, "EntryPoint does not match this bundler"));
      }
      userOperation = fromBundlerUserOperation(body.params[0] as Parameters<typeof fromBundlerUserOperation>[0]);
    } catch (error) {
      return reply.code(400).send(fail(-32602, error instanceof Error ? error.message : "Invalid UserOperation"));
    }

    const userOperationHash = getLocalUserOpHash(userOperation, entryPoint, config.accountAbstraction.chainId);
    const aaExecution = await submitLocalUserOperation(userOperation, { ...config.accountAbstraction, bundlerUrl: null }).catch((error) => ({
      error: error instanceof Error ? error.message : "UserOperation submission failed"
    }));
    if ("error" in aaExecution) return reply.code(502).send(fail(-32000, aaExecution.error));
    return { jsonrpc: "2.0", id, result: userOperationHash };
  });

  app.post("/auth/logout", async (request, reply) => {
    const token = readBearerToken(request);
    if (token) await prisma.authSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
    clearAuthSessionCookie(reply);
    return { ok: true };
  });

  app.post("/auth/passkey/register/options", async (request, reply) => {
    const input = StartPasskeyRegistrationRequestSchema.parse(request.body ?? {});
    const username = input.username.toLowerCase();
    const existing = await prisma.userAccount.findFirst({
      where: { OR: [{ id: `user-${username}` }, { username }] }
    });
    if (existing) return reply.code(409).send({ error: "Username is already taken" });
    const challenge = newAuthChallenge();
    const challengeRecord = await prisma.authChallenge.create({
      data: {
        id: `auth-challenge-${nanoid(10)}`,
        kind: "PasskeyRegistration",
        challenge,
        username,
        displayName: input.displayName,
        bio: input.bio,
        expiresAt: minutesFromNow(5)
      }
    });
    return {
      challengeId: challengeRecord.id,
      publicKey: {
        challenge,
        rp: { name: "Popular Consensus" },
        user: {
          id: base64UrlEncode(`user-${username}`),
          name: username,
          displayName: input.displayName
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred"
        },
        timeout: 60_000,
        attestation: "none"
      }
    };
  });

  app.post("/auth/passkey/register/verify", async (request, reply) => {
    const input = VerifyPasskeyRegistrationRequestSchema.parse(request.body ?? {});
    const challenge = await prisma.authChallenge.findUnique({ where: { id: input.challengeId } });
    if (!challenge || challenge.kind !== "PasskeyRegistration" || challenge.consumedAt || challenge.expiresAt <= new Date()) {
      return reply.code(400).send({ error: "Passkey registration challenge expired" });
    }
    if (!challenge.username || !challenge.displayName) return reply.code(400).send({ error: "Passkey registration challenge is incomplete" });

    const parsed = parsePasskeyAttestation({
      expectedChallenge: challenge.challenge,
      clientDataJSON: input.credential.response.clientDataJSON,
      attestationObject: input.credential.response.attestationObject,
      allowedOrigins: config.authOrigins
    });
    if (parsed.credentialId !== input.credential.rawId) return reply.code(400).send({ error: "Passkey credential id mismatch" });
    const userId = `user-${challenge.username}`;
    const profileId = portableProfileId(userId);
    let smartAccount: SmartAccountPrediction;
    try {
      smartAccount = predictSmartAccount(
        { kind: "passkey", credentialId: parsed.credentialId, passkeyX: parsed.publicKeyX, passkeyY: parsed.publicKeyY },
        config.accountAbstraction,
        { requireFactory: config.requireAuth }
      );
    } catch (error) {
      return reply.code(503).send({ error: error instanceof Error ? error.message : "Account factory is unavailable" });
    }
    const smartAccountAddress = smartAccount.address;
    const profileCommunityId = profileCommunityIdForUser(userId);
    const profileArtifact = await artifactStore.write(
      withArtifactSchema("user-profile", {
        profileId,
        userId,
        username: challenge.username,
        displayName: challenge.displayName,
        bio: challenge.bio ?? "",
        smartAccountAddress,
        authControllerKind: "Passkey",
        accountStandard: smartAccount.accountStandard
      })
    );
    await storeArtifact(profileArtifact, "user-profile");
    try {
      const userCreatedEvent = prepareProtocolEvent({
        eventType: "UserCreated",
        subjectId: userId,
        actor: smartAccountAddress,
        previousHash: null,
        newHash: profileArtifact.hash
      });
      const { user, controller } = await prisma.$transaction(async (tx) => {
        const protocolEvent = await ingestProtocolEvent(tx, userCreatedEvent);
        const created = await tx.userAccount.create({
          data: {
            id: userId,
            username: challenge.username ?? "",
            profileId,
            profileHash: profileArtifact.hash,
            profileCommunityId,
            smartAccountAddress,
            smartAccountKind: smartAccount.accountStandard,
            displayName: challenge.displayName ?? "",
            bio: challenge.bio ?? "",
            authControllers: {
              create: {
                id: `auth-controller-${nanoid(10)}`,
                kind: "Passkey",
                label: "Passkey",
                credentialId: parsed.credentialId,
                publicKeyCose: parsed.publicKeyCose,
                aaAccountAddress: smartAccountAddress,
                aaAccountKind: smartAccount.accountStandard,
                aaEntryPointAddress: smartAccount.entryPoint,
                aaFactoryAddress: smartAccount.accountFactory,
                aaPaymasterAddress: smartAccount.paymaster,
                aaSalt: smartAccount.salt,
                aaInitCode: smartAccount.initCode,
                passkeyPublicKeyX: parsed.publicKeyX,
                passkeyPublicKeyY: parsed.publicKeyY,
                signatureScheme: "webauthn-p256-es256",
                counter: parsed.counter
              }
            }
          },
          include: { authControllers: true }
        });
        await createProfileCommunityForUser(tx, {
          id: userId,
          username: challenge.username ?? "",
          displayName: challenge.displayName ?? "",
          bio: challenge.bio ?? "",
          profileCommunityId
        });
        await tx.authChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date(), userId } });
        await recordProtocolCommitments(protocolEvent, tx);
        return { user: created, controller: created.authControllers[0] };
      });
      const session = await createAuthSession(user.id, smartAccountAddress, controller.id);
      setAuthSessionCookie(reply, session.token);
      const passkeyDeployment = await maybeCreatePasskeyDeploymentChallenge(controller).catch(() => null);
      return { user, controller, session: authSessionResponse(session), profileArtifact, passkeyDeployment };
    } catch {
      return reply.code(409).send({ error: "Username or passkey is already registered" });
    }
  });

  app.post("/auth/passkey/login/options", async (request, reply) => {
    const input = StartPasskeyLoginRequestSchema.parse(request.body ?? {});
    const username = input.username?.toLowerCase();
    const controllers = await prisma.authController.findMany({
      where: {
        kind: "Passkey",
        ...(username ? { user: { username } } : {})
      },
      include: { user: true },
      orderBy: { createdAt: "asc" }
    });
    if (!controllers.length) return reply.code(404).send({ error: "No passkeys registered for this account" });
    const challenge = newAuthChallenge();
    const challengeRecord = await prisma.authChallenge.create({
      data: {
        id: `auth-challenge-${nanoid(10)}`,
        kind: "PasskeyLogin",
        challenge,
        userId: username ? controllers[0].userId : null,
        expiresAt: minutesFromNow(5)
      }
    });
    return {
      challengeId: challengeRecord.id,
      publicKey: {
        challenge,
        timeout: 60_000,
        userVerification: "preferred",
        allowCredentials: controllers.map((controller) => ({
          type: "public-key",
          id: controller.credentialId
        }))
      }
    };
  });

  app.post("/auth/passkey/login/verify", async (request, reply) => {
    const input = VerifyPasskeyLoginRequestSchema.parse(request.body ?? {});
    const challenge = await prisma.authChallenge.findUnique({ where: { id: input.challengeId } });
    if (!challenge || challenge.kind !== "PasskeyLogin" || challenge.consumedAt || challenge.expiresAt <= new Date()) {
      return reply.code(400).send({ error: "Passkey login challenge expired" });
    }
    const controller = await prisma.authController.findUnique({ where: { credentialId: input.credential.rawId }, include: { user: true } });
    if (!controller?.publicKeyCose) return reply.code(404).send({ error: "Passkey is not registered" });
    if (challenge.userId && challenge.userId !== controller.userId) return reply.code(403).send({ error: "Passkey belongs to a different account" });
    const parsed = parsePasskeyAssertion({
      expectedChallenge: challenge.challenge,
      clientDataJSON: input.credential.response.clientDataJSON,
      authenticatorData: input.credential.response.authenticatorData,
      allowedOrigins: config.authOrigins
    });
    const verified = verifyPasskeySignature({
      publicKeyCose: controller.publicKeyCose,
      signedPayload: parsed.signedPayload,
      signature: input.credential.response.signature
    });
    if (!verified) return reply.code(403).send({ error: "Passkey signature rejected" });
    await prisma.authController.update({
      where: { id: controller.id },
      data: { counter: Math.max(controller.counter, parsed.counter), lastUsedAt: new Date() }
    });
    await prisma.authChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date(), userId: controller.userId } });
    const session = await createAuthSession(controller.userId, controller.aaAccountAddress, controller.id);
    setAuthSessionCookie(reply, session.token);
    return { user: controller.user, controller, session: authSessionResponse(session) };
  });

  app.post("/auth/passkey/deploy/options", async (request, reply) => {
    const input = StartPasskeyDeploymentRequestSchema.parse(request.body ?? {});
    const session = await readAuthSession(request);
    if (!session) return reply.code(401).send({ error: "Authentication required" });
    const controller = await prisma.authController.findFirst({
      where: {
        userId: session.userId,
        kind: "Passkey",
        ...(input.controllerId ? { id: input.controllerId } : session.controllerId ? { id: session.controllerId } : {})
      }
    });
    if (!controller?.credentialId || !controller.publicKeyCose) return reply.code(404).send({ error: "Passkey controller is not registered" });
    const passkeyDeployment = await maybeCreatePasskeyDeploymentChallenge(controller);
    if (!passkeyDeployment) return reply.code(409).send({ error: "Passkey smart account deployment is not available for this controller" });
    return passkeyDeployment;
  });

  app.post("/auth/passkey/deploy/verify", async (request, reply) => {
    const input = VerifyPasskeyDeploymentRequestSchema.parse(request.body ?? {});
    const challenge = await prisma.authChallenge.findUnique({ where: { id: input.challengeId } });
    if (!challenge || challenge.kind !== "PasskeyDeployment" || challenge.consumedAt || challenge.expiresAt <= new Date()) {
      return reply.code(400).send({ error: "Passkey deployment challenge expired" });
    }
    const controller = await prisma.authController.findUnique({ where: { credentialId: input.credential.rawId }, include: { user: true } });
    if (!controller?.publicKeyCose) return reply.code(404).send({ error: "Passkey is not registered" });
    if (challenge.userId && challenge.userId !== controller.userId) return reply.code(403).send({ error: "Passkey belongs to a different account" });
    if (challenge.aaAccountAddress && challenge.aaAccountAddress.toLowerCase() !== input.aaUserOperation.sender.toLowerCase()) {
      return reply.code(400).send({ error: "Passkey deployment operation targets the wrong account" });
    }

    const parsed = parsePasskeyAssertion({
      expectedChallenge: challenge.challenge,
      clientDataJSON: input.credential.response.clientDataJSON,
      authenticatorData: input.credential.response.authenticatorData,
      allowedOrigins: config.authOrigins
    });
    const verified = verifyPasskeySignature({
      publicKeyCose: controller.publicKeyCose,
      signedPayload: parsed.signedPayload,
      signature: input.credential.response.signature
    });
    if (!verified) return reply.code(403).send({ error: "Passkey signature rejected" });

    const smartAccount = predictPasskeySmartAccount(controller);
    const prepared = smartAccount ? prepareDeploymentUserOperation(smartAccount, config.accountAbstraction.chainId) : null;
    if (!prepared || prepared.signatureKind !== "passkey-webauthn-p256") {
      return reply.code(409).send({ error: "Passkey smart account deployment is not available for this controller" });
    }
    if (!sameUserOperation(input.aaUserOperation as SerializedUserOperation, prepared.userOperation)) {
      return reply.code(400).send({ error: "Submitted UserOperation does not match the passkey challenge" });
    }

    const signedOperation = attachPasskeySignature(prepared.userOperation, input.credential.response, challenge.challenge);
    const aaExecution = await submitUserOperation(signedOperation, config.accountAbstraction).catch((error) => ({
      error: error instanceof Error ? error.message : "UserOperation submission failed"
    }));
    if ("error" in aaExecution) return reply.code(502).send({ error: aaExecution.error });

    await prisma.authController.update({
      where: { id: controller.id },
      data: { counter: Math.max(controller.counter, parsed.counter), lastUsedAt: new Date() }
    });
    await prisma.authChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date(), userId: controller.userId } });
    return { ok: true, user: controller.user, controller, aaExecution };
  });

  app.post("/auth/wallet/challenge", async (request, reply) => {
    const input = StartWalletAuthRequestSchema.parse(request.body ?? {});
    const walletAddress = getAddress(input.address);
    const existing = await prisma.authController.findFirst({ where: { kind: "Wallet", walletAddress } });
    if (!existing && (!input.username || !input.displayName)) {
      return reply.code(400).send({ error: "New wallet accounts require a username and display name" });
    }
    if (input.username) {
      const username = input.username.toLowerCase();
      const user = await prisma.userAccount.findFirst({ where: { OR: [{ id: `user-${username}` }, { username }] } });
      if (user) return reply.code(409).send({ error: "Username is already taken" });
    }
    const challengeValue = newAuthChallenge();
    let smartAccount: SmartAccountPrediction | null = null;
    try {
      smartAccount = existing
        ? null
        : predictSmartAccount({ kind: "wallet", walletAddress }, config.accountAbstraction, { requireFactory: config.requireAuth });
    } catch (error) {
      return reply.code(503).send({ error: error instanceof Error ? error.message : "Account factory is unavailable" });
    }
    const smartAccountAddress = existing?.aaAccountAddress ?? smartAccount?.address;
    if (!smartAccountAddress) return reply.code(503).send({ error: "Smart account address could not be resolved" });
    const accountStandard = existing?.aaAccountKind ?? smartAccount?.accountStandard ?? "erc-4337-counterfactual-v0";
    const aaUserOperation = smartAccount ? prepareDeploymentUserOperation(smartAccount, config.accountAbstraction.chainId) : null;
    const challenge = await prisma.authChallenge.create({
      data: {
        id: `auth-challenge-${nanoid(10)}`,
        kind: existing ? "WalletLogin" : "WalletRegistration",
        challenge: challengeValue,
        username: input.username?.toLowerCase() ?? null,
        displayName: input.displayName ?? null,
        bio: input.bio ?? "",
        walletAddress,
        aaAccountAddress: smartAccountAddress,
        aaAccountKind: accountStandard,
        expiresAt: minutesFromNow(5)
      }
    });
    return {
      challengeId: challenge.id,
      address: walletAddress,
      smartAccountAddress,
      accountStandard,
      aaUserOperation,
      message: buildWalletAuthMessage({
        address: walletAddress,
        smartAccountAddress,
        accountStandard,
        chainId: config.accountAbstraction.chainId,
        challenge: challenge.challenge,
        issuedAt: challenge.createdAt
      })
    };
  });

  app.post("/auth/wallet/verify", async (request, reply) => {
    const input = VerifyWalletAuthRequestSchema.parse(request.body ?? {});
    const walletAddress = getAddress(input.address);
    const challenge = await prisma.authChallenge.findUnique({ where: { id: input.challengeId } });
    if (
      !challenge ||
      !["WalletLogin", "WalletRegistration"].includes(challenge.kind) ||
      challenge.consumedAt ||
      challenge.expiresAt <= new Date() ||
      challenge.walletAddress !== walletAddress
    ) {
      return reply.code(400).send({ error: "Wallet auth challenge expired" });
    }
    const existing = await prisma.authController.findFirst({ where: { kind: "Wallet", walletAddress }, include: { user: true } });
    let smartAccount: SmartAccountPrediction | null = null;
    try {
      smartAccount = existing
        ? null
        : predictSmartAccount({ kind: "wallet", walletAddress }, config.accountAbstraction, { requireFactory: config.requireAuth });
    } catch (error) {
      return reply.code(503).send({ error: error instanceof Error ? error.message : "Account factory is unavailable" });
    }
    const smartAccountAddress = existing?.aaAccountAddress ?? challenge.aaAccountAddress ?? smartAccount?.address;
    if (!smartAccountAddress) return reply.code(503).send({ error: "Smart account address could not be resolved" });
    const accountStandard = existing?.aaAccountKind ?? challenge.aaAccountKind ?? smartAccount?.accountStandard ?? "erc-4337-counterfactual-v0";
    const message = buildWalletAuthMessage({
      address: walletAddress,
      smartAccountAddress,
      accountStandard,
      chainId: config.accountAbstraction.chainId,
      challenge: challenge.challenge,
      issuedAt: challenge.createdAt
    });
    const verified = await verifyMessage({ address: walletAddress, message, signature: input.signature as `0x${string}` });
    if (!verified) return reply.code(403).send({ error: "Wallet signature rejected" });
    if (existing) {
      await prisma.authController.update({ where: { id: existing.id }, data: { lastUsedAt: new Date() } });
      await prisma.authChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date(), userId: existing.userId } });
      const session = await createAuthSession(existing.userId, existing.aaAccountAddress, existing.id);
      setAuthSessionCookie(reply, session.token);
      return { user: existing.user, controller: existing, session: authSessionResponse(session) };
    }
    if (!challenge.username || !challenge.displayName) return reply.code(400).send({ error: "Wallet registration challenge is incomplete" });
    const aaExecution = await maybeSubmitWalletDeploymentUserOperation({
      smartAccount,
      inputUserOperation: input.aaUserOperation as SerializedUserOperation | undefined,
      inputSignature: input.aaUserOperationSignature as `0x${string}` | undefined
    }).catch((error) => ({ error: error instanceof Error ? error.message : "UserOperation submission failed" }));
    if (aaExecution && "error" in aaExecution && config.requireAuth) {
      return reply.code(502).send({ error: aaExecution.error });
    }
    const userId = `user-${challenge.username}`;
    const profileId = portableProfileId(userId);
    const profileCommunityId = profileCommunityIdForUser(userId);
    const profileArtifact = await artifactStore.write(
      withArtifactSchema("user-profile", {
        profileId,
        userId,
        username: challenge.username,
        displayName: challenge.displayName,
        bio: challenge.bio ?? "",
        smartAccountAddress,
        authControllerKind: "Wallet",
        walletAddress,
        accountStandard
      })
    );
    await storeArtifact(profileArtifact, "user-profile");
    try {
      const userCreatedEvent = prepareProtocolEvent({
        eventType: "UserCreated",
        subjectId: userId,
        actor: smartAccountAddress,
        previousHash: null,
        newHash: profileArtifact.hash
      });
      const { user, controller } = await prisma.$transaction(async (tx) => {
        const protocolEvent = await ingestProtocolEvent(tx, userCreatedEvent);
        const created = await tx.userAccount.create({
          data: {
            id: userId,
            username: challenge.username ?? "",
            profileId,
            profileHash: profileArtifact.hash,
            profileCommunityId,
            smartAccountAddress,
            smartAccountKind: accountStandard,
            displayName: challenge.displayName ?? "",
            bio: challenge.bio ?? "",
            authControllers: {
              create: {
                id: `auth-controller-${nanoid(10)}`,
                kind: "Wallet",
                label: "Wallet",
                walletAddress,
                aaAccountAddress: smartAccountAddress,
                aaAccountKind: accountStandard,
                aaEntryPointAddress: smartAccount?.entryPoint ?? null,
                aaFactoryAddress: smartAccount?.accountFactory ?? null,
                aaPaymasterAddress: smartAccount?.paymaster ?? null,
                aaSalt: smartAccount?.salt ?? null,
                aaInitCode: smartAccount?.initCode ?? null,
                signatureScheme: "eip-191-personal-sign"
              }
            }
          },
          include: { authControllers: true }
        });
        await createProfileCommunityForUser(tx, {
          id: userId,
          username: challenge.username ?? "",
          displayName: challenge.displayName ?? "",
          bio: challenge.bio ?? "",
          profileCommunityId
        });
        await tx.authChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date(), userId } });
        await recordProtocolCommitments(protocolEvent, tx);
        return { user: created, controller: created.authControllers[0] };
      });
      const session = await createAuthSession(user.id, smartAccountAddress, controller.id);
      setAuthSessionCookie(reply, session.token);
      return { user, controller, session: authSessionResponse(session), profileArtifact, aaExecution: aaExecution && "error" in aaExecution ? null : aaExecution };
    } catch {
      return reply.code(409).send({ error: "Username or wallet is already registered" });
    }
  });

  app.get("/profiles/resolve", async (request, reply) => {
    const { profileId, userId, username } = request.query as { profileId?: string; userId?: string; username?: string };
    if (!profileId && !userId && !username) return reply.code(400).send({ error: "Provide profileId, userId, or username" });
    let profile = await prisma.userAccount.findFirst({
      where: profileId ? { profileId } : userId ? { id: userId } : { username: username?.toLowerCase() }
    });
    if (!profile && username) {
      const profileCommunity = await prisma.community.findFirst({
        where: { kind: "Profile", slug: profileCommunitySlug(username) },
        select: { profileUserId: true }
      });
      if (profileCommunity?.profileUserId) {
        profile = await prisma.userAccount.findUnique({ where: { id: profileCommunity.profileUserId } });
      }
    }
    if (!profile) return reply.code(404).send({ error: "Profile not found" });
    const profileArtifact = profile.profileHash
      ? { hash: profile.profileHash, artifact: await artifactStore.read(profile.profileHash).catch(() => null) }
      : null;
    return { protocol: buildProfileRecordProtocol(profile, profileArtifact?.hash ?? null), profile, profileArtifact };
  });

  app.get("/communities", async (request) => {
    const { userId, visibility, credentialSchemaId, authorityLevel, slug, query, kind, includeProfiles, parentId, includePending } = request.query as {
      userId?: string;
      visibility?: string;
      credentialSchemaId?: string;
      authorityLevel?: string;
      slug?: string;
      query?: string;
      kind?: string;
      includeProfiles?: string;
      parentId?: string;
      includePending?: string;
    };
    const page = parsePageQuery(request.query);
    const where: Prisma.CommunityWhereInput = {
      ...(kind ? { kind } : includeProfiles === "true" ? {} : { kind: "Group" }),
      ...(visibility ? { visibility } : {}),
      ...(includePending === "true" ? {} : { registryStatus: "Active" }),
      ...(parentId ? { parentId: parentId === "root" ? null : parentId } : {}),
      ...(credentialSchemaId ? { credentialSchemaId } : {}),
      ...(authorityLevel ? { defaultAuthorityLevel: normalizeAuthority(authorityLevel) } : {}),
      ...(slug ? { slug } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { slug: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } }
            ]
          }
        : {})
    };
    const [communities, total] = await Promise.all([
      prisma.community.findMany({
        where,
        orderBy: [{ depth: "asc" }, { visibility: "asc" }, { createdAt: "asc" }],
        skip: page.offset,
        take: page.limit,
        include: { memberships: true, _count: { select: { questions: true, memberships: true } } }
      }),
      prisma.community.count({ where })
    ]);
    const pageInfo = buildPageInfo(page, total);
    const communitySummaries = communities.map((community) => ({
      ...community,
      memberCount: community._count.memberships,
      questionCount: community._count.questions,
      isMember: userId ? community.memberships.some((member) => member.userId === userId && member.status === "Active") : false,
      activeUserRole: userId
        ? community.memberships.find((member) => member.userId === userId && member.status === "Active")?.role ?? null
        : null,
      memberships: undefined,
      _count: undefined
    }));
    return {
      protocol: buildCommunitiesProtocol(communitySummaries, pageInfo),
      page: pageInfo,
      communities: communitySummaries
    };
  });

  app.post("/communities", async (request, reply) => {
    const input = CreateCommunityRequestSchema.parse(request.body ?? {});
    if (!(await requireAuthenticatedActor(request, reply, input.creatorId))) return;
    const creator = await prisma.userAccount.findUnique({ where: { id: input.creatorId } });
    if (!creator) return reply.code(404).send({ error: "Creator account not found" });
    const parent = input.parentId
      ? await prisma.community.findUnique({
          where: { id: input.parentId },
          include: { memberships: true, registryPolicy: true }
        })
      : null;
    if (input.parentId && !parent) return reply.code(404).send({ error: "Parent community not found" });
    if (parent && parent.registryStatus !== "Active") return reply.code(409).send({ error: "Parent community is not active" });
    const parentMembership = parent?.memberships.find((member) => member.userId === input.creatorId && member.status === "Active") ?? null;
    if (parent && !parentMembership) return reply.code(403).send({ error: "Join the parent community before proposing a child community" });
    const parentCurator = Boolean(parentMembership && CURATOR_ROLES.includes(parentMembership.role));
    const registryPolicy = parent?.registryPolicy ?? null;
    const thresholdPercent = registryPolicy?.approvalThresholdPercent ?? DEFAULT_REGISTRY_POLICY.approvalThresholdPercent;
    const quorumPercent = registryPolicy?.quorumPercent ?? DEFAULT_REGISTRY_POLICY.quorumPercent;
    const slug = input.slug ?? slugify(input.name);
    const communityId = `community-${slug}`;
    const path = buildCommunityPath(parent, slug);
    const depth = parent ? parent.depth + 1 : 0;
    const registryStatus = parent ? (parentCurator ? "Active" : "Pending") : "Active";
    try {
      const communityCreatedEvent = prepareProtocolEvent({
        eventType: "CommunityCreated",
        subjectId: communityId,
        actor: creator.id,
        previousHash: null,
        newHash: hashJson({ slug, visibility: input.visibility, parentId: parent?.id ?? null, registryStatus })
      });
      const proposalId = parent ? `child-proposal-${nanoid(10)}` : null;
      const childProposalEvent = parent
        ? prepareProtocolEvent({
            eventType: parentCurator ? "CommunityChildApproved" : "CommunityChildProposed",
            subjectId: parent.id,
            actor: creator.id,
            previousHash: null,
            newHash: hashJson({ proposalId, proposedCommunityId: communityId, parentId: parent.id, status: parentCurator ? "Approved" : "Pending" })
          })
        : null;
      const community = await prisma.$transaction(async (tx) => {
        const protocolEvents = [await ingestProtocolEvent(tx, communityCreatedEvent)];
        if (childProposalEvent) protocolEvents.push(await ingestProtocolEvent(tx, childProposalEvent));
        const created = await tx.community.create({
          data: {
            id: communityId,
            slug,
            name: input.name,
            description: input.description,
            kind: "Group",
            parentId: parent?.id ?? null,
            path,
            depth,
            registryStatus,
            visibility: input.visibility,
            credentialSchemaId: input.credentialSchemaId,
            defaultAuthorityLevel: "Advisory",
            createdBy: creator.id
          },
          include: { memberships: true }
        });
        await upsertMembershipWithSource(tx, {
          communityId: created.id,
          userId: creator.id,
          role: "Owner",
          sourceType: parent ? "ProposalCreator" : "DirectJoin",
          sourceKey: parent ? `proposal:${proposalId}` : `direct:${created.id}`,
          sourceCommunityId: created.id
        });
        if (parent && proposalId) {
          await tx.communityChildProposal.create({
            data: {
              id: proposalId,
              parentId: parent.id,
              proposedCommunityId: created.id,
              proposerId: creator.id,
              title: input.name,
              description: input.description,
              status: parentCurator ? "Approved" : "Pending",
              proposalHash: hashJson({
                protocol: "pc-child-community-proposal-v0",
                parentId: parent.id,
                proposedCommunityId: created.id,
                proposerId: creator.id,
                slug,
                visibility: input.visibility,
                thresholdPercent,
                quorumPercent
              }),
              thresholdPercent,
              quorumPercent,
              approvedBy: parentCurator ? creator.id : null,
              resolvedAt: parentCurator ? new Date() : null
            }
          });
          if (parentCurator) await propagateChildMembershipsToAncestors(tx, created.id);
        }
        for (const protocolEvent of protocolEvents) await recordProtocolCommitments(protocolEvent, tx);
        return created;
      });
      const childProposal = proposalId ? await prisma.communityChildProposal.findUnique({ where: { id: proposalId } }) : null;
      return { community, childProposal };
    } catch {
      return reply.code(409).send({ error: "Community slug is already taken" });
    }
  });

  app.post("/communities/:communityId/join", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const input = JoinCommunityRequestSchema.parse(request.body ?? {});
    if (!(await requireAuthenticatedActor(request, reply, input.userId))) return;
    const community = await prisma.community.findUnique({ where: { id: communityId } });
    const user = await prisma.userAccount.findUnique({ where: { id: input.userId } });
    if (!community || !user) return reply.code(404).send({ error: "Community or account not found" });
    if (community.registryStatus !== "Active") return reply.code(409).send({ error: "Community is not active yet" });
    const communityJoinedEvent = prepareProtocolEvent({
      eventType: "CommunityJoined",
      subjectId: community.id,
      actor: input.userId,
      previousHash: null,
      newHash: hashJson({ communityId, userId: input.userId })
    });
    const membership = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, communityJoinedEvent);
      const upserted = await upsertMembershipWithSource(tx, {
        communityId,
        userId: input.userId,
        role: "Member",
        sourceType: "DirectJoin",
        sourceKey: `direct:${communityId}`,
        sourceCommunityId: communityId
      });
      await propagateMembershipToAncestors(tx, communityId, input.userId);
      await recordProtocolCommitments(protocolEvent, tx);
      return upserted;
    });
    return { membership };
  });

  app.post("/communities/:communityId/follow", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const input = FollowCommunityRequestSchema.parse(request.body ?? {});
    if (!(await requireAuthenticatedActor(request, reply, input.userId))) return;
    const [community, user] = await Promise.all([
      prisma.community.findUnique({ where: { id: communityId } }),
      prisma.userAccount.findUnique({ where: { id: input.userId } })
    ]);
    if (!community || !user) return reply.code(404).send({ error: "Community or account not found" });
    if (!(await canReadCommunity(communityId, input.userId))) {
      return reply.code(403).send({ error: "Join this private community before following it" });
    }
    const existing = await prisma.communityFollow.findUnique({ where: { communityId_userId: { communityId, userId: input.userId } } });
    if (existing) return { follow: existing };

    const followArtifact = await artifactStore.write(
      withArtifactSchema("social-follow", {
        targetType: "Community",
        targetId: communityId,
        communityId,
        userId: input.userId,
        profileId: user.profileId
      })
    );
    await storeArtifact(followArtifact, "social-follow");
    const communityFollowedEvent = prepareProtocolEvent({
      eventType: "CommunityFollowed",
      subjectId: communityId,
      actor: input.userId,
      previousHash: null,
      newHash: followArtifact.hash
    });
    const follow = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, communityFollowedEvent);
      const created = await tx.communityFollow.create({
        data: {
          id: `community-follow-${nanoid(10)}`,
          communityId,
          userId: input.userId,
          followHash: followArtifact.hash
        }
      });
      await recordActivity(tx, {
        actorId: input.userId,
        activityType: community.kind === "Profile" ? "ProfileFollowed" : "CommunityFollowed",
        communityId,
        targetCommunityId: communityId,
        audience: "Public",
        shellText:
          community.kind === "Profile"
            ? `${user.displayName} followed @${community.slug.replace(/^user-/, "")}.`
            : `${user.displayName} followed p/${community.slug}.`
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return created;
    });
    return { follow, followArtifact };
  });

  app.post("/users/:targetUserId/follow", async (request, reply) => {
    const { targetUserId } = request.params as { targetUserId: string };
    const input = FollowCommunityRequestSchema.parse(request.body ?? {});
    if (!(await requireAuthenticatedActor(request, reply, input.userId))) return;
    if (input.userId === targetUserId) return reply.code(409).send({ error: "You already have your own profile feed" });
    const [targetUser, follower] = await Promise.all([
      prisma.userAccount.findUnique({ where: { id: targetUserId } }),
      prisma.userAccount.findUnique({ where: { id: input.userId } })
    ]);
    if (!targetUser || !follower) return reply.code(404).send({ error: "Account not found" });
    const profileCommunityId = targetUser.profileCommunityId ?? profileCommunityIdForUser(targetUser.id);
    const profileCommunity = await prisma.community.findUnique({ where: { id: profileCommunityId } });
    if (!profileCommunity) return reply.code(404).send({ error: "Profile feed not found" });
    const existing = await prisma.communityFollow.findUnique({
      where: { communityId_userId: { communityId: profileCommunityId, userId: input.userId } }
    });
    if (existing) return { follow: existing };

    const followArtifact = await artifactStore.write(
      withArtifactSchema("social-follow", {
        targetType: "Profile",
        targetId: targetUser.id,
        communityId: profileCommunityId,
        userId: input.userId,
        profileId: follower.profileId
      })
    );
    await storeArtifact(followArtifact, "social-follow");
    const profileFollowedEvent = prepareProtocolEvent({
      eventType: "ProfileFollowed",
      subjectId: targetUser.id,
      actor: input.userId,
      previousHash: null,
      newHash: followArtifact.hash
    });
    const follow = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, profileFollowedEvent);
      const created = await tx.communityFollow.create({
        data: {
          id: `community-follow-${nanoid(10)}`,
          communityId: profileCommunityId,
          userId: input.userId,
          followHash: followArtifact.hash
        }
      });
      await recordActivity(tx, {
        actorId: input.userId,
        activityType: "ProfileFollowed",
        communityId: profileCommunityId,
        targetCommunityId: profileCommunityId,
        audience: "Public",
        shellText: `${follower.displayName} followed @${targetUser.username}.`
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return created;
    });
    return { follow, followArtifact, profileCommunity };
  });

  app.post("/topics/:topicId/follow", async (request, reply) => {
    const { topicId } = request.params as { topicId: string };
    const input = FollowTopicRequestSchema.parse(request.body ?? {});
    if (!(await requireAuthenticatedActor(request, reply, input.userId))) return;
    const user = await prisma.userAccount.findUnique({ where: { id: input.userId } });
    if (!user) return reply.code(404).send({ error: "Account not found" });
    const existing = await prisma.topicFollow.findUnique({ where: { topicId_userId: { topicId, userId: input.userId } } });
    if (existing) return { follow: existing };

    const followArtifact = await artifactStore.write(
      withArtifactSchema("social-follow", {
        targetType: "Topic",
        targetId: topicId,
        topicId,
        userId: input.userId,
        profileId: user.profileId
      })
    );
    await storeArtifact(followArtifact, "social-follow");
    const topicFollowedEvent = prepareProtocolEvent({
      eventType: "TopicFollowed",
      subjectId: `topic:${topicId}`,
      actor: input.userId,
      previousHash: null,
      newHash: followArtifact.hash
    });
    const follow = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, topicFollowedEvent);
      const created = await tx.topicFollow.create({
        data: {
          id: `topic-follow-${nanoid(10)}`,
          topicId,
          userId: input.userId,
          followHash: followArtifact.hash
        }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return created;
    });
    return { follow, followArtifact };
  });

  app.get("/communities/:communityId/children", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const { userId, includePending } = request.query as { userId?: string; includePending?: string };
    const parent = await prisma.community.findUnique({ where: { id: communityId } });
    if (!parent) return reply.code(404).send({ error: "Community not found" });
    if (!(await canReadCommunity(communityId, userId))) return reply.code(403).send({ error: "Join this private community to view child communities" });
    const children = await prisma.community.findMany({
      where: {
        parentId: communityId,
        ...(includePending === "true" ? {} : { registryStatus: "Active" })
      },
      orderBy: [{ registryStatus: "asc" }, { name: "asc" }],
      include: { memberships: true, follows: true, _count: { select: { questions: true, memberships: true } } }
    });
    return {
      parent,
      children: children.map((community) => ({
        ...community,
        memberCount: community._count.memberships,
        questionCount: community._count.questions,
        followerCount: community.follows.length,
        isMember: userId ? community.memberships.some((member) => member.userId === userId && member.status === "Active") : false,
        activeUserRole: userId
          ? community.memberships.find((member) => member.userId === userId && member.status === "Active")?.role ?? null
          : null,
        memberships: undefined,
        follows: undefined,
        _count: undefined
      }))
    };
  });

  app.get("/communities/:communityId/registry-policy", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const { userId } = request.query as { userId?: string };
    if (!(await canReadCommunity(communityId, userId))) return reply.code(403).send({ error: "Join this private community to view registry policy" });
    const community = await prisma.community.findUnique({ where: { id: communityId }, include: { registryPolicy: true } });
    if (!community) return reply.code(404).send({ error: "Community not found" });
    const policy = community.registryPolicy ?? defaultRegistryPolicyView(community);
    return { communityId, policy };
  });

  app.post("/communities/:communityId/registry-policy", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const input = SetCommunityRegistryPolicyRequestSchema.parse(request.body ?? {});
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply, request);
    if (!stewardCheck) return;
    const policyHash = hashJson({
      protocol: "pc-community-registry-policy-v0",
      communityId,
      approvalThresholdPercent: input.approvalThresholdPercent,
      quorumPercent: input.quorumPercent,
      reviewWindowHours: input.reviewWindowHours
    });
    const policyEvent = prepareProtocolEvent({
      eventType: "CommunityRegistryPolicyUpdated",
      subjectId: communityId,
      actor: input.steward,
      previousHash: null,
      newHash: policyHash
    });
    const policy = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, policyEvent);
      const updated = await tx.communityRegistryPolicy.upsert({
        where: { communityId },
        update: {
          approvalThresholdPercent: input.approvalThresholdPercent,
          quorumPercent: input.quorumPercent,
          reviewWindowHours: input.reviewWindowHours,
          status: "Active"
        },
        create: {
          id: `registry-policy-${nanoid(10)}`,
          communityId,
          approvalThresholdPercent: input.approvalThresholdPercent,
          quorumPercent: input.quorumPercent,
          reviewWindowHours: input.reviewWindowHours,
          createdBy: input.steward
        }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return updated;
    });
    return { policy };
  });

  app.get("/communities/:communityId/child-proposals", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const { userId, status } = request.query as { userId?: string; status?: string };
    if (!(await canReadCommunity(communityId, userId))) return reply.code(403).send({ error: "Join this private community to view child proposals" });
    const proposals = await prisma.communityChildProposal.findMany({
      where: { parentId: communityId, ...(status ? { status } : {}) },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        votes: true
      }
    });
    const proposedCommunities = proposals.length
      ? await prisma.community.findMany({ where: { id: { in: proposals.map((proposal) => proposal.proposedCommunityId) } } })
      : [];
    const communitiesById = new Map(proposedCommunities.map((community) => [community.id, community]));
    return {
      proposals: await Promise.all(
        proposals.map(async (proposal) => ({
          ...proposal,
          proposedCommunity: communitiesById.get(proposal.proposedCommunityId) ?? null,
          tally: await childProposalTally(proposal)
        }))
      )
    };
  });

  app.post("/communities/:communityId/child-proposals/:proposalId/approve", async (request, reply) => {
    const { communityId, proposalId } = request.params as { communityId: string; proposalId: string };
    const input = ResolveCommunityChildProposalRequestSchema.parse(request.body ?? {});
    const curatorCheck = await requireCommunityCurator(communityId, input.curator, reply, request);
    if (!curatorCheck) return;
    const proposal = await prisma.communityChildProposal.findUnique({ where: { id: proposalId } });
    if (!proposal || proposal.parentId !== communityId) return reply.code(404).send({ error: "Child proposal not found" });
    const approved = await approveChildProposal(proposal.id, input.curator, "Approved", input.reason);
    return approved;
  });

  app.post("/communities/:communityId/child-proposals/:proposalId/reject", async (request, reply) => {
    const { communityId, proposalId } = request.params as { communityId: string; proposalId: string };
    const input = ResolveCommunityChildProposalRequestSchema.parse(request.body ?? {});
    const curatorCheck = await requireCommunityCurator(communityId, input.curator, reply, request);
    if (!curatorCheck) return;
    const proposal = await prisma.communityChildProposal.findUnique({ where: { id: proposalId } });
    if (!proposal || proposal.parentId !== communityId) return reply.code(404).send({ error: "Child proposal not found" });
    if (proposal.status !== "Pending") return reply.code(409).send({ error: "Child proposal is already resolved" });
    const resolutionHash = hashJson({ proposalId, ruling: "Rejected", reason: input.reason });
    const rejected = await prisma.$transaction(async (tx) => {
      await tx.community.update({ where: { id: proposal.proposedCommunityId }, data: { registryStatus: "Rejected" } });
      return tx.communityChildProposal.update({
        where: { id: proposal.id },
        data: { status: "Rejected", rejectedBy: input.curator, resolutionHash, resolvedAt: new Date() },
        include: { votes: true }
      });
    });
    return { proposal: rejected, tally: await childProposalTally(rejected) };
  });

  app.post("/communities/:communityId/child-proposals/:proposalId/votes", async (request, reply) => {
    const { communityId, proposalId } = request.params as { communityId: string; proposalId: string };
    const input = VoteCommunityChildProposalRequestSchema.parse(request.body ?? {});
    if (!(await requireAuthenticatedActor(request, reply, input.voterId))) return;
    const proposal = await prisma.communityChildProposal.findUnique({ where: { id: proposalId }, include: { votes: true } });
    if (!proposal || proposal.parentId !== communityId) return reply.code(404).send({ error: "Child proposal not found" });
    if (proposal.status !== "Pending") return reply.code(409).send({ error: "Child proposal is already resolved" });
    const membership = await prisma.communityMember.findUnique({ where: { communityId_userId: { communityId, userId: input.voterId } } });
    if (membership?.status !== "Active") return reply.code(403).send({ error: "Join the parent community before voting on child proposals" });
    const voteHash = hashJson({ protocol: "pc-child-proposal-vote-v0", proposalId, voterId: input.voterId, vote: input.vote });
    const vote = await prisma.communityChildProposalVote.upsert({
      where: { proposalId_voterId: { proposalId, voterId: input.voterId } },
      update: { vote: input.vote, voteHash },
      create: { id: `child-proposal-vote-${nanoid(10)}`, proposalId, voterId: input.voterId, vote: input.vote, voteHash }
    });
    const refreshed = await prisma.communityChildProposal.findUnique({ where: { id: proposalId }, include: { votes: true } });
    if (!refreshed) return reply.code(404).send({ error: "Child proposal not found" });
    const tally = await childProposalTally(refreshed);
    if (tally.quorumMet && tally.thresholdMet) {
      const approved = await approveChildProposal(refreshed.id, input.voterId, "ApprovedByMembers", "Approved by parent community member vote.");
      return { vote, ...approved };
    }
    return { vote, proposal: refreshed, tally };
  });

  app.get("/discovery", async (request) => {
    const { userId } = request.query as { userId?: string };
    const communities = await prisma.community.findMany({
      where: { registryStatus: "Active" },
      orderBy: [{ depth: "asc" }, { visibility: "asc" }, { createdAt: "asc" }],
      include: {
        memberships: true,
        follows: true,
        _count: { select: { questions: true, memberships: true } }
      }
    });
    const visibleCommunities = communities.filter(
      (community) =>
        community.visibility === "Public" ||
        Boolean(userId && community.memberships.some((member) => member.userId === userId && member.status === "Active"))
    );
    const visibleCommunityIds = visibleCommunities.map((community) => community.id);
    const [questions, communityFollows, topicFollows, allTopicFollows] = await Promise.all([
      prisma.question.findMany({ where: { communityId: { in: visibleCommunityIds } }, select: { topicIds: true, communityId: true } }),
      userId
        ? prisma.communityFollow.findMany({ where: { userId, communityId: { in: visibleCommunityIds } }, orderBy: { createdAt: "asc" } })
        : Promise.resolve([]),
      userId ? prisma.topicFollow.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }) : Promise.resolve([]),
      prisma.topicFollow.findMany()
    ]);
    const toDiscoveryCommunity = (community: (typeof visibleCommunities)[number]) => ({
      id: community.id,
      slug: community.slug,
      name: community.name,
      kind: community.kind,
      parentId: community.parentId,
      path: community.path,
      depth: community.depth,
      registryStatus: community.registryStatus,
      profileUserId: community.profileUserId,
      visibility: community.visibility,
      memberCount: community._count.memberships,
      questionCount: community._count.questions,
      followerCount: community.follows.length,
      followedByActiveUser: Boolean(userId && community.follows.some((follow) => follow.userId === userId))
    });
    const communitySummaries = visibleCommunities.filter((community) => community.kind !== "Profile").map(toDiscoveryCommunity);
    const profiles = visibleCommunities.filter((community) => community.kind === "Profile").map(toDiscoveryCommunity);
    const topics = buildDiscoveryTopics(questions, topicFollows, allTopicFollows);
    return {
      protocol: buildDiscoveryProtocol([...communitySummaries, ...profiles], topics, communityFollows, topicFollows, userId ?? null),
      communities: communitySummaries,
      profiles,
      topics,
      communityFollows,
      topicFollows
    };
  });

  app.get("/questions", async (request, reply) => {
    const { communityId, userId } = request.query as { communityId?: string; userId?: string };
    const where = await questionFeedWhere(communityId, userId, reply);
    if (!where) return;
    const questions = await prisma.question.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { challenges: true, poll: { include: { result: true, resultChallenges: true } }, community: true }
    });
    return { questions: questions.map(enrichQuestion) };
  });

  app.get("/feed", async (request, reply) => {
    const query = FeedQuerySchema.parse(request.query ?? {});
    const viewerId = query.userId;
    const followedCommunities = viewerId
      ? await prisma.communityFollow.findMany({ where: { userId: viewerId }, include: { community: true } })
      : [];
    const followedCommunityIds = followedCommunities.map((follow) => follow.communityId);
    const followedProfileUserIds = compactHashArray(followedCommunities.map((follow) => follow.community.profileUserId));
    const followedTopics = viewerId ? await prisma.topicFollow.findMany({ where: { userId: viewerId } }) : [];
    const followedTopicIds = followedTopics.map((follow) => follow.topicId);
    const baseReadableWhere = readableQuestionWhere(viewerId);

    let questionWhere: Prisma.QuestionWhereInput = baseReadableWhere;
    let activityWhere: Prisma.ActivityFeedItemWhereInput = { audience: "Public" };

    if (query.mode === "global") {
      questionWhere = { audience: "Public" };
      activityWhere = { audience: "Public" };
    }

    if (query.mode === "following") {
      if (!viewerId) {
        questionWhere = { id: "__none__" };
        activityWhere = { id: "__none__" };
      } else {
        const followingQuestionScopes: Prisma.QuestionWhereInput[] = [];
        if (followedCommunityIds.length) followingQuestionScopes.push({ communityId: { in: followedCommunityIds } });
        if (followedTopicIds.length) followingQuestionScopes.push({ topicIds: { hasSome: followedTopicIds } });
        if (followedProfileUserIds.length) followingQuestionScopes.push({ proposer: { in: followedProfileUserIds } });
        questionWhere = followingQuestionScopes.length ? { AND: [baseReadableWhere, { OR: followingQuestionScopes }] } : { id: "__none__" };
        activityWhere =
          followedCommunityIds.length || followedProfileUserIds.length
            ? {
                OR: [
                  ...(followedCommunityIds.length
                    ? [{ communityId: { in: followedCommunityIds } }, { targetCommunityId: { in: followedCommunityIds } }]
                    : []),
                  ...(followedProfileUserIds.length ? [{ actorId: { in: followedProfileUserIds } }] : [])
                ]
              }
            : { id: "__none__" };
      }
    }

    if (query.mode === "for-you") {
      if (!viewerId) {
        questionWhere = { audience: "Public" };
        activityWhere = { audience: "Public" };
      } else {
        const recommendedScopes: Prisma.QuestionWhereInput[] = [{ audience: "Public" }];
        if (followedCommunityIds.length) recommendedScopes.push({ communityId: { in: followedCommunityIds } });
        if (followedTopicIds.length) recommendedScopes.push({ topicIds: { hasSome: followedTopicIds } });
        if (followedProfileUserIds.length) recommendedScopes.push({ proposer: { in: followedProfileUserIds } });
        questionWhere = { AND: [baseReadableWhere, { OR: recommendedScopes }] };
        activityWhere = {
          OR: [
            { audience: "Public" },
            ...(followedCommunityIds.length
              ? [{ communityId: { in: followedCommunityIds } }, { targetCommunityId: { in: followedCommunityIds } }]
              : []),
            ...(followedProfileUserIds.length ? [{ actorId: { in: followedProfileUserIds } }] : [])
          ]
        };
      }
    }

    if (query.mode === "profile") {
      if (!query.profileUserId) return reply.code(400).send({ error: "profileUserId is required for profile feeds" });
      const profileUser = await prisma.userAccount.findUnique({ where: { id: query.profileUserId } });
      if (!profileUser) return reply.code(404).send({ error: "Profile not found" });
      const profileCommunityId = profileUser.profileCommunityId ?? profileCommunityIdForUser(profileUser.id);
      questionWhere = { OR: [{ proposer: profileUser.id }, { communityId: profileCommunityId }] };
      activityWhere = { actorId: profileUser.id };
    }

    if (query.mode === "community") {
      if (!query.communityId) return reply.code(400).send({ error: "communityId is required for community feeds" });
      const community = await prisma.community.findUnique({ where: { id: query.communityId }, include: { memberships: true } });
      if (!community) return reply.code(404).send({ error: "Community not found" });
      const memberCanSeeCommunity = community.visibility === "Public" || community.memberships.some((member) => member.userId === viewerId && member.status === "Active");
      questionWhere = memberCanSeeCommunity ? { communityId: community.id } : { communityId: community.id, audience: "Public" };
      activityWhere = memberCanSeeCommunity
        ? { OR: [{ communityId: community.id }, { targetCommunityId: community.id }] }
        : { OR: [{ communityId: community.id, audience: "Public" }, { targetCommunityId: community.id, audience: "Public" }] };
    }

    const [questions, activities] = await Promise.all([
      prisma.question.findMany({
        where: questionWhere,
        orderBy: { createdAt: "desc" },
        take: query.limit,
        include: { challenges: true, poll: { include: { result: true, resultChallenges: true } }, community: true }
      }),
      prisma.activityFeedItem.findMany({
        where: { AND: [activityWhere, { activityType: { not: "PollPosted" } }] },
        orderBy: { createdAt: "desc" },
        take: query.limit
      })
    ]);

    const activityQuestionIds = compactHashArray(activities.map((activity) => activity.questionId));
    const activityQuestions = activityQuestionIds.length
      ? await prisma.question.findMany({
          where: { id: { in: activityQuestionIds } },
          include: { challenges: true, poll: { include: { result: true, resultChallenges: true } }, community: true }
        })
      : [];
    const questionsById = new Map(activityQuestions.map((question) => [question.id, question]));
    const questionItems = await Promise.all(questions.map((question) => toQuestionFeedItem(question, viewerId)));
    const activityItems = (
      await Promise.all(activities.map((activity) => toActivityFeedItem(activity, questionsById.get(activity.questionId ?? ""), viewerId)))
    ).filter((item): item is NonNullable<typeof item> => Boolean(item));
    const items = [...questionItems, ...activityItems]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, query.limit);

    return {
      protocol: {
        protocol: "popular-consensus",
        schemaVersion: "scoped-feed-v0",
        mode: query.mode,
        viewerId: viewerId ?? null,
        profileUserId: query.profileUserId ?? null,
        communityId: query.communityId ?? null,
        itemCount: items.length
      },
      items
    };
  });

  app.get("/questions/:questionId", async (request, reply) => {
    const { questionId } = request.params as { questionId: string };
    const { userId } = request.query as { userId?: string };
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { challenges: true, poll: { include: { result: true, resultChallenges: true, ballots: false } }, community: true }
    });
    if (!question) return reply.code(404).send({ error: "Question not found" });
    if (!(await canReadQuestion(question, userId))) {
      return reply.code(403).send({ error: "Follow or join this community to view this question" });
    }
    return { question: enrichQuestion(question) };
  });

  app.post("/questions", async (request, reply) => {
    const input = CreateQuestionRequestSchema.parse(request.body ?? {});
    if (!(await requireAuthenticatedActor(request, reply, input.proposer))) return;
    const proposer = await prisma.userAccount.findUnique({ where: { id: input.proposer } });
    if (!proposer) return reply.code(404).send({ error: "Proposer account not found" });
    const community = await prisma.community.findUnique({
      where: { id: input.communityId },
      include: { memberships: true }
    });
    if (!community) return reply.code(404).send({ error: "Community not found" });
    const answerSchema = safeAnswerSchema(input.answerSchemaId);
    if (!answerSchema) return reply.code(400).send({ error: "Unknown answer schema" });
    const audience = normalizeQuestionAudience(input.audience);
    const resultMode = normalizePollResultMode(input.resultMode);
    const proposerMembership = community.memberships.find((member) => member.userId === input.proposer && member.status === "Active");
    if (community.kind === "Profile" && community.profileUserId !== input.proposer) {
      return reply.code(403).send({ error: "Only the profile owner can ask from this profile feed" });
    }
    if (community.visibility === "Private" && !proposerMembership) {
      return reply.code(403).send({ error: "Join this private community before proposing a question" });
    }
    if (audience === "Members" && !proposerMembership) {
      return reply.code(403).send({ error: "Join this community before asking members-only questions" });
    }
    if (!(await ensureCommunityProtocolWritable(community.id, reply))) return;
    const bodyArtifact = await artifactStore.write(
      withArtifactSchema("question-body", { title: input.title, body: input.body, answerSchemaId: answerSchema.answerSchemaId, audience, resultMode })
    );
    const sponsorArtifact = await artifactStore.write(withArtifactSchema("sponsor-disclosure", { disclosure: input.sponsorDisclosure }));
    const activeKeySetup = await activeTallyKeySetupForCommunity(community.id);
    if (!activeKeySetup && !config.demoMode) {
      return reply.code(409).send({ error: "Non-demo mode requires an active threshold tally key setup before creating polls" });
    }
    const coordinator = activeKeySetup
      ? {
          publicKeyId: activeKeySetup.publicKeyId,
          publicKeyPem: activeKeySetup.publicKeyPem,
          privateKeyPem: config.demoMode && activeKeySetup.demoPrivateKeyPem ? activeKeySetup.demoPrivateKeyPem : "threshold-share-decryption-required"
        }
      : createCoordinatorKeypair();
    const questionId = `question-${nanoid(10)}`;
    const pollId = `poll-${nanoid(10)}`;
    const proposalBondId = `bond-${nanoid(10)}`;
    const adoptionAuthority = await resolveAdoptionAuthority(community.id, input.topicIds, input.credentialSchemaId);
    const governance = await resolveGovernanceParameters(community.id);
    const questionSubmittedEvent = prepareProtocolEvent({
      eventType: "QuestionSubmitted",
      subjectId: questionId,
      actor: input.proposer,
      previousHash: null,
      newHash: bodyArtifact.hash
    });
    const proposalBondEscrowedEvent = prepareProtocolEvent({
      eventType: "BondEscrowed",
      subjectId: proposalBondId,
      actor: input.proposer,
      previousHash: null,
      newHash: hashJson({ questionId, amountPc: governance.proposalBondPc })
    });

    const question = await prisma.$transaction(async (tx) => {
      const protocolEvents = [
        await ingestProtocolEvent(tx, questionSubmittedEvent),
        await ingestProtocolEvent(tx, proposalBondEscrowedEvent)
      ];
      const created = await tx.question.create({
        data: {
          id: questionId,
          title: input.title,
          bodyHash: bodyArtifact.hash,
          answerSchemaId: answerSchema.answerSchemaId,
          credentialSchemaId: input.credentialSchemaId,
          communityId: community.id,
          audience,
          topicIds: input.topicIds,
          geoScope: input.geoScope,
          sponsorDisclosureHash: sponsorArtifact.hash,
          methodologyLabel: input.methodologyLabel,
          authorityLevel: adoptionAuthority.authorityLevel,
          resultMode,
          adoptionPolicyId: adoptionAuthority.policyId,
          opensAt: new Date(),
          closesAt: hoursFromNow(governance.pollDurationHours),
          challengeWindowEndsAt: hoursFromNow(governance.challengeWindowHours),
          proposer: input.proposer,
          proposalBondId,
          status: "Submitted",
          poll: {
            create: {
              id: pollId,
              status: "Configured",
              tallyPublicKeyId: coordinator.publicKeyId,
              tallyPublicKeyPem: coordinator.publicKeyPem,
              tallyPrivateKeyPem: coordinator.privateKeyPem,
              tallyKeySetupId: activeKeySetup?.id ?? null,
              credentialSchemaId: input.credentialSchemaId,
              privacyThreshold: governance.privacyThreshold,
              resultChallengeEndsAt: hoursFromNow(governance.resultChallengeWindowHours)
            }
          }
        },
        include: { poll: true }
      });
      await recordActivity(tx, {
        actorId: input.proposer,
        activityType: "PollPosted",
        questionId,
        communityId: community.id,
        targetCommunityId: community.id,
        audience,
        shellText: `${proposer.displayName} asked a ${audienceLabel(audience)} question in ${community.kind === "Profile" ? `@${proposer.username}` : `p/${community.slug}`}.`
      });
      await tx.bond.create({
        data: {
          id: proposalBondId,
          owner: input.proposer,
          questionId,
          amountPc: governance.proposalBondPc,
          bondType: "Proposal"
        }
      });
      for (const protocolEvent of protocolEvents) await recordProtocolCommitments(protocolEvent, tx);
      return created;
    });
    return { question: enrichQuestion(question), bodyArtifact, sponsorArtifact, proposalBondId, stakedPc: String(governance.proposalBondPc) };
  });

  app.post("/questions/:questionId/challenges", async (request, reply) => {
    const { questionId } = request.params as { questionId: string };
    const input = CreateChallengeRequestSchema.parse(request.body ?? {});
    if (!(await requireAuthenticatedActor(request, reply, input.challenger))) return;
    const challenger = await prisma.userAccount.findUnique({ where: { id: input.challenger } });
    if (!challenger) return reply.code(404).send({ error: "Challenger account not found" });
    const question = await prisma.question.findUnique({ where: { id: questionId }, include: { community: true } });
    if (!question) return reply.code(404).send({ error: "Question not found" });
    if (!(await canReadQuestion(question, input.challenger))) {
      return reply.code(403).send({ error: "Follow or join this community before challenging a question" });
    }
    if (question.proposer === input.challenger) {
      return reply.code(403).send({ error: "Proposer cannot challenge their own question" });
    }
    if (!["Submitted", "Challenged", "Accepted"].includes(question.status)) {
      return reply.code(409).send({ error: "Question is not in a challengeable registry state" });
    }
    if (!(await ensureCommunityProtocolWritable(question.communityId, reply))) return;
    const governance = await resolveGovernanceParameters(question.communityId);
    const evidenceArtifact = await artifactStore.write(
      withArtifactSchema("question-challenge-evidence", { evidence: input.evidence, reasonCode: input.reasonCode })
    );
    const challengeId = `challenge-${nanoid(10)}`;
    const challengeBondId = `bond-${nanoid(10)}`;
    const challengeOpenedEvent = prepareProtocolEvent({
      eventType: "ChallengeOpened",
      subjectId: questionId,
      actor: input.challenger,
      previousHash: question.bodyHash,
      newHash: evidenceArtifact.hash
    });
    const challengeBondEscrowedEvent = prepareProtocolEvent({
      eventType: "BondEscrowed",
      subjectId: challengeBondId,
      actor: input.challenger,
      previousHash: null,
      newHash: hashJson({ questionId, challengeId, amountPc: governance.challengeBondPc })
    });
    const challenge = await prisma.$transaction(async (tx) => {
      const protocolEvents = [
        await ingestProtocolEvent(tx, challengeOpenedEvent),
        await ingestProtocolEvent(tx, challengeBondEscrowedEvent)
      ];
      const created = await tx.challenge.create({
        data: {
          id: challengeId,
          questionId,
          reasonCode: input.reasonCode,
          evidenceHash: evidenceArtifact.hash,
          challenger: input.challenger,
          challengeBondId,
          jurorPoolId: "juror-pool-demo",
          ruling: "Pending"
        }
      });
      await tx.bond.create({
        data: {
          id: challengeBondId,
          owner: input.challenger,
          questionId,
          challengeId,
          amountPc: governance.challengeBondPc,
          bondType: "Challenge"
        }
      });
      await tx.question.update({ where: { id: questionId }, data: { status: "Challenged" } });
      for (const protocolEvent of protocolEvents) await recordProtocolCommitments(protocolEvent, tx);
      return created;
    });
    return { challenge, evidenceArtifact, stakedPc: String(governance.challengeBondPc) };
  });

  app.post("/questions/:questionId/accept", async (request, reply) => {
    const { questionId } = request.params as { questionId: string };
    const input = AcceptQuestionRequestSchema.parse(request.body ?? {});
    if (!(await requireAuthenticatedActor(request, reply, input.curator))) return;
    const curator = await prisma.userAccount.findUnique({ where: { id: input.curator } });
    if (!curator) return reply.code(404).send({ error: "Curator account not found" });
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { challenges: true, challengeAppeals: true, poll: true, community: true }
    });
    if (!question?.poll) return reply.code(404).send({ error: "Question or poll not found" });
    if (question.proposer === input.curator) return reply.code(403).send({ error: "Proposer cannot accept their own question" });
    const curatorCheck = await requireCommunityCurator(question.communityId, input.curator, reply, request);
    if (!curatorCheck) return;
    if (!(await ensureCommunityProtocolWritable(question.communityId, reply))) return;
    if (!["Submitted", "Accepted"].includes(question.status)) {
      return reply.code(409).send({ error: "Question is not ready for acceptance" });
    }
    if (question.challenges.some((challenge) => challenge.ruling === "Pending")) {
      return reply.code(409).send({ error: "Resolve pending challenges before opening the poll" });
    }
    if (question.challengeAppeals.some((appeal) => appeal.status === "Pending")) {
      return reply.code(409).send({ error: "Resolve pending challenge appeals before opening the poll" });
    }
    const governance = await resolveGovernanceParameters(question.communityId);
    const questionAcceptedEvent = prepareProtocolEvent({
      eventType: "QuestionAccepted",
      subjectId: questionId,
      actor: input.curator,
      previousHash: question.bodyHash,
      newHash: hashJson({ questionId, status: "Open" })
    });
    const pollOpenedEvent = prepareProtocolEvent({
      eventType: "PollOpened",
      subjectId: questionId,
      actor: input.curator,
      previousHash: null,
      newHash: hashJson({ questionId, pollId: question.poll.id })
    });
    const proposalBondSettledEvent = prepareProtocolEvent({
      eventType: "BondSettled",
      subjectId: question.proposalBondId,
      actor: input.curator,
      previousHash: null,
      newHash: hashJson({ questionId, status: "Refunded" })
    });

    const updated = await prisma.$transaction(async (tx) => {
      const protocolEvents = [
        await ingestProtocolEvent(tx, questionAcceptedEvent),
        await ingestProtocolEvent(tx, pollOpenedEvent),
        await ingestProtocolEvent(tx, proposalBondSettledEvent)
      ];
      await tx.poll.update({ where: { id: question.poll!.id }, data: { status: "Open" } });
      await tx.bond.updateMany({
        where: { id: question.proposalBondId, status: "Escrowed" },
        data: {
          status: "Refunded",
          refundedPc: governance.proposalBondPc,
          settledAt: new Date()
        }
      });
      const accepted = await tx.question.update({
        where: { id: questionId },
        data: { status: "Open", opensAt: new Date() },
        include: { challenges: true, poll: { include: { result: true, resultChallenges: true } }, community: true }
      });
      for (const protocolEvent of protocolEvents) await recordProtocolCommitments(protocolEvent, tx);
      return accepted;
    });
    await addReputation(input.curator, "JurorService", governance.jurorRewardWeight, questionId);
    return { question: enrichQuestion(updated), poll: updated.poll };
  });

  app.post("/questions/:questionId/challenges/:challengeId/ruling", async (request, reply) => {
    const { questionId, challengeId } = request.params as { questionId: string; challengeId: string };
    const input = ChallengeRulingRequestSchema.parse(request.body ?? {});
    const juror = await prisma.userAccount.findUnique({ where: { id: input.juror } });
    if (!juror) return reply.code(404).send({ error: "Juror account not found" });
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: { question: { include: { poll: true, community: true } } }
    });
    if (!challenge || challenge.questionId !== questionId) return reply.code(404).send({ error: "Challenge not found" });
    if (challenge.question.proposer === input.juror) return reply.code(403).send({ error: "Proposer cannot rule on their own question challenge" });
    if (challenge.challenger === input.juror) return reply.code(403).send({ error: "Challenger cannot rule on their own challenge" });
    const jurorCheck = await requireCommunityCurator(challenge.question.communityId, input.juror, reply, request);
    if (!jurorCheck) return;
    if (!(await ensureCommunityProtocolWritable(challenge.question.communityId, reply))) return;
    const jurorAssignment = await ensureClearJurorAssignment(questionChallengeJurorTarget(challenge), input.juror, input.juror, input.conflictDisclosure, artifactStore, reply);
    if (!jurorAssignment) return;
    if (challenge.ruling !== "Pending") return reply.code(409).send({ error: "Challenge already ruled" });
    const governance = await resolveGovernanceParameters(challenge.question.communityId);

    const resolutionArtifact = await artifactStore.write(
      withArtifactSchema("question-challenge-resolution", {
        challengeId,
        questionId,
        ruling: input.ruling,
        juror: input.juror,
        jurorAssignmentId: jurorAssignment.id,
        conflictDisclosureHash: jurorAssignment.conflictDisclosureHash,
        resolution: input.resolution
      })
    );

    const challengeRuledEvent = prepareProtocolEvent({
      eventType: "ChallengeRuled",
      subjectId: questionId,
      actor: input.juror,
      previousHash: challenge.evidenceHash,
      newHash: resolutionArtifact.hash
    });
    const challengeBondSettledEvent = prepareProtocolEvent({
      eventType: "BondSettled",
      subjectId: challenge.challengeBondId,
      actor: input.juror,
      previousHash: null,
      newHash: hashJson({ challengeId, ruling: input.ruling })
    });
    const updatedChallenge = await prisma.$transaction(async (tx) => {
      const protocolEvents = [
        await ingestProtocolEvent(tx, challengeRuledEvent),
        await ingestProtocolEvent(tx, challengeBondSettledEvent)
      ];
      const ruled = await tx.challenge.update({
        where: { id: challengeId },
        data: { ruling: input.ruling, resolutionHash: resolutionArtifact.hash }
      });

      if (input.ruling === "Sustained") {
        await tx.question.update({ where: { id: questionId }, data: { status: "Rejected" } });
        if (challenge.question.poll) await tx.poll.update({ where: { id: challenge.question.poll.id }, data: { status: "Configured" } });
        await tx.bond.updateMany({
          where: { id: challenge.question.proposalBondId },
          data: {
            status: "Slashed",
            slashedPc: governance.proposalBondPc,
            treasuryPc: governance.protocolFeePc,
            settledAt: new Date()
          }
        });
        await tx.bond.updateMany({
          where: { id: challenge.challengeBondId },
          data: {
            status: "Refunded",
            refundedPc: governance.challengeBondPc,
            rewardPc: governance.successfulChallengeRewardPc,
            settledAt: new Date()
          }
        });
      }

      if (input.ruling === "Rejected") {
        await tx.question.update({ where: { id: questionId }, data: { status: "Accepted" } });
        await tx.bond.updateMany({
          where: { id: challenge.challengeBondId },
          data: {
            status: "Slashed",
            slashedPc: governance.challengeBondPc,
            treasuryPc: governance.protocolFeePc,
            settledAt: new Date()
          }
        });
        await tx.bond.updateMany({
          where: { id: challenge.question.proposalBondId },
          data: { rewardPc: governance.failedChallengeProposerRewardPc }
        });
      }

      if (input.ruling === "Remanded") {
        await tx.question.update({ where: { id: questionId }, data: { status: "Amendment" } });
        await tx.bond.updateMany({
          where: { id: challenge.challengeBondId, status: "Escrowed" },
          data: { status: "Refunded", refundedPc: governance.challengeBondPc, settledAt: new Date() }
        });
      }

      for (const protocolEvent of protocolEvents) await recordProtocolCommitments(protocolEvent, tx);
      return ruled;
    });

    if (input.ruling === "Sustained") await addReputation(challenge.challenger, "SuccessfulChallenge", governance.successfulChallengeReputation, challengeId);
    if (input.ruling === "Remanded") await addReputation(challenge.question.proposer, "AcceptedAmendment", governance.acceptedAmendmentReputation, challengeId);
    await addReputation(input.juror, "JurorService", governance.jurorRewardWeight, challengeId);
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { challenges: true, poll: { include: { result: true, resultChallenges: true } }, community: true }
    });
    const bonds = await prisma.bond.findMany({ where: { OR: [{ questionId }, { challengeId }] }, orderBy: { createdAt: "asc" } });
    return { challenge: updatedChallenge, question: question ? enrichQuestion(question) : null, resolutionArtifact, bonds };
  });

  app.get("/questions/:questionId/challenge-appeals", async (request, reply) => {
    const { questionId } = request.params as { questionId: string };
    const { userId } = request.query as { userId?: string };
    const question = await prisma.question.findUnique({ where: { id: questionId }, select: { id: true, communityId: true, proposer: true, audience: true } });
    if (!question) return reply.code(404).send({ error: "Question not found" });
    if (!(await canReadQuestion(question, userId))) {
      return reply.code(403).send({ error: "Follow or join this community to view challenge appeals" });
    }
    const appeals = await loadChallengeAppealsForQuestion(questionId, artifactStore);
    return { protocol: buildChallengeAppealsProtocol(questionId, appeals), questionId, appeals };
  });

  app.get("/questions/:questionId/juror-assignments", async (request, reply) => {
    const { questionId } = request.params as { questionId: string };
    const { userId } = request.query as { userId?: string };
    const question = await prisma.question.findUnique({ where: { id: questionId }, select: { id: true, communityId: true, proposer: true, audience: true } });
    if (!question) return reply.code(404).send({ error: "Question not found" });
    if (!(await canReadQuestion(question, userId))) {
      return reply.code(403).send({ error: "Follow or join this community to view juror assignments" });
    }
    const assignments = await loadJurorAssignmentsForQuestion(questionId, artifactStore);
    return { protocol: buildJurorAssignmentsProtocol(questionId, assignments), questionId, assignments };
  });

  app.post("/questions/:questionId/challenges/:challengeId/juror-selection", async (request, reply) => {
    const { questionId, challengeId } = request.params as { questionId: string; challengeId: string };
    const input = SelectJurorRequestSchema.parse(request.body ?? {});
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: { question: { include: { community: true } } }
    });
    if (!challenge || challenge.questionId !== questionId) return reply.code(404).send({ error: "Challenge not found" });
    const selectedByCheck = await requireCommunityCurator(challenge.question.communityId, input.selectedBy, reply, request);
    if (!selectedByCheck) return;
    const jurorCheck = await requireCommunityCurator(challenge.question.communityId, input.jurorId, reply);
    if (!jurorCheck) return;
    if (!(await ensureCommunityProtocolWritable(challenge.question.communityId, reply))) return;
    const target = questionChallengeJurorTarget(challenge);
    if (target.ineligibleActors.includes(input.jurorId)) return reply.code(403).send({ error: "Juror has a direct conflict with this target" });
    const { assignment, selectionArtifact } = await createJurorAssignment(target, input.jurorId, input.selectedBy, input.selectionReason, artifactStore);
    return { assignment: await hydrateJurorAssignment(assignment, artifactStore), selectionArtifact };
  });

  app.post("/questions/:questionId/challenges/:challengeId/appeals", async (request, reply) => {
    const { questionId, challengeId } = request.params as { questionId: string; challengeId: string };
    const input = CreateChallengeAppealRequestSchema.parse(request.body ?? {});
    if (!(await requireAuthenticatedActor(request, reply, input.appellantId))) return;
    const [appellant, challenge] = await Promise.all([
      prisma.userAccount.findUnique({ where: { id: input.appellantId } }),
      prisma.challenge.findUnique({ where: { id: challengeId }, include: { question: { include: { community: true } } } })
    ]);
    if (!appellant) return reply.code(404).send({ error: "Appellant account not found" });
    if (!challenge || challenge.questionId !== questionId) return reply.code(404).send({ error: "Challenge not found" });
    if (!(await canReadQuestion(challenge.question, input.appellantId))) {
      return reply.code(403).send({ error: "Follow or join this community before appealing a question challenge" });
    }
    if (!(await ensureCommunityProtocolWritable(challenge.question.communityId, reply))) return;
    if (challenge.ruling === "Pending") return reply.code(409).send({ error: "Only ruled challenges can be appealed" });
    const allowedAppellants = eligibleQuestionChallengeAppellants(challenge);
    if (!allowedAppellants.includes(input.appellantId)) {
      return reply.code(403).send({ error: "Only a party affected by the ruling can appeal this question challenge" });
    }
    const existing = await prisma.challengeAppeal.findUnique({
      where: { challengeId_appellantId: { challengeId, appellantId: input.appellantId } }
    });
    if (existing) return reply.code(409).send({ error: "This appellant already appealed this question challenge" });
    const governance = await resolveGovernanceParameters(challenge.question.communityId);

    const appealArtifact = await artifactStore.write(
      withArtifactSchema("challenge-appeal", {
        targetType: "QuestionChallenge",
        questionId,
        challengeId,
        appealedRuling: challenge.ruling,
        appellantId: input.appellantId,
        appeal: input.appeal
      })
    );
    await storeArtifact(appealArtifact, "challenge-appeal");
    const appealId = `challenge-appeal-${nanoid(10)}`;
    const appealBondId = `bond-${nanoid(10)}`;
    const challengeAppealedEvent = prepareProtocolEvent({
      eventType: "ChallengeAppealed",
      subjectId: questionId,
      actor: input.appellantId,
      previousHash: challenge.resolutionHash ?? challenge.evidenceHash,
      newHash: appealArtifact.hash
    });
    const appealBondEscrowedEvent = prepareProtocolEvent({
      eventType: "BondEscrowed",
      subjectId: appealBondId,
      actor: input.appellantId,
      previousHash: null,
      newHash: hashJson({ questionId, challengeId, appealId, amountPc: governance.appealBondPc })
    });
    const appeal = await prisma.$transaction(async (tx) => {
      const protocolEvents = [
        await ingestProtocolEvent(tx, challengeAppealedEvent),
        await ingestProtocolEvent(tx, appealBondEscrowedEvent)
      ];
      const created = await tx.challengeAppeal.create({
        data: {
          id: appealId,
          questionId,
          targetType: "QuestionChallenge",
          challengeId,
          appellantId: input.appellantId,
          appealBondId,
          appealedRuling: normalizeChallengeRuling(challenge.ruling),
          appealHash: appealArtifact.hash
        }
      });
      await tx.bond.create({
        data: {
          id: appealBondId,
          owner: input.appellantId,
          questionId,
          challengeId,
          challengeAppealId: appealId,
          amountPc: governance.appealBondPc,
          bondType: "Appeal"
        }
      });
      for (const protocolEvent of protocolEvents) await recordProtocolCommitments(protocolEvent, tx);
      return created;
    });
    return { appeal: toChallengeAppealView(appeal, input.appeal, null), appealArtifact, stakedPc: String(governance.appealBondPc) };
  });

  app.post("/questions/:questionId/amendments", async (request, reply) => {
    const { questionId } = request.params as { questionId: string };
    const input = AmendmentRequestSchema.parse(request.body ?? {});
    if (!(await requireAuthenticatedActor(request, reply, input.proposer))) return;
    const proposer = await prisma.userAccount.findUnique({ where: { id: input.proposer } });
    if (!proposer) return reply.code(404).send({ error: "Proposer account not found" });
    const question = await prisma.question.findUnique({ where: { id: questionId }, include: { challenges: true, community: true } });
    if (!question) return reply.code(404).send({ error: "Question not found" });
    if (question.proposer !== input.proposer) {
      return reply.code(403).send({ error: "Only the original proposer can amend this question" });
    }
    if (!(await canReadQuestion(question, input.proposer))) {
      return reply.code(403).send({ error: "Follow or join this community before amending a question" });
    }
    if (!["Submitted", "Challenged", "Amendment"].includes(question.status)) {
      return reply.code(409).send({ error: "Question cannot be amended in its current state" });
    }
    if (!(await ensureCommunityProtocolWritable(question.communityId, reply))) return;
    const previousHash = question.bodyHash;
    const bodyArtifact = await artifactStore.write(withArtifactSchema("question-body", { title: question.title, body: input.body }));
    const pendingChallenges = question.challenges.filter((challenge) => challenge.ruling === "Pending");
    const governance = await resolveGovernanceParameters(question.communityId);
    const questionAmendedEvent = prepareProtocolEvent({
      eventType: "QuestionAmended",
      subjectId: questionId,
      actor: input.proposer,
      previousHash,
      newHash: bodyArtifact.hash
    });
    const settledChallengeBondEvents = pendingChallenges.map((challenge) =>
      prepareProtocolEvent({
        eventType: "BondSettled",
        subjectId: challenge.challengeBondId,
        actor: input.proposer,
        previousHash: null,
        newHash: hashJson({ questionId, challengeId: challenge.id, status: "Refunded" })
      })
    );
    const updated = await prisma.$transaction(async (tx) => {
      const protocolEvents = [await ingestProtocolEvent(tx, questionAmendedEvent)];
      for (const settledChallengeBondEvent of settledChallengeBondEvents) {
        protocolEvents.push(await ingestProtocolEvent(tx, settledChallengeBondEvent));
      }
      const amended = await tx.question.update({
        where: { id: questionId },
        data: {
          bodyHash: bodyArtifact.hash,
          version: { increment: 1 },
          status: "Submitted"
        },
        include: { challenges: true, poll: true }
      });
      await tx.challenge.updateMany({
        where: { questionId, ruling: "Pending" },
        data: { ruling: "Remanded", resolutionHash: bodyArtifact.hash }
      });
      await tx.bond.updateMany({
        where: { challengeId: { in: pendingChallenges.map((challenge) => challenge.id) }, status: "Escrowed" },
        data: { status: "Refunded", refundedPc: governance.challengeBondPc, settledAt: new Date() }
      });
      for (const protocolEvent of protocolEvents) await recordProtocolCommitments(protocolEvent, tx);
      return amended;
    });
    await addReputation(input.proposer, "AcceptedAmendment", governance.acceptedAmendmentReputation, questionId);
    return { question: updated, bodyArtifact };
  });

  app.get("/questions/:questionId/history", async (request, reply) => {
    const { questionId } = request.params as { questionId: string };
    const { userId } = request.query as { userId?: string };
    const question = await prisma.question.findUnique({ where: { id: questionId }, select: { id: true, communityId: true, proposer: true, audience: true } });
    if (!question) return reply.code(404).send({ error: "Question not found" });
    if (!(await canReadQuestion(question, userId))) {
      return reply.code(403).send({ error: "Follow or join this community to view this question history" });
    }
    const events = await prisma.registryEvent.findMany({ where: { subjectId: questionId }, orderBy: REGISTRY_EVENT_ORDER });
    const challenges = await prisma.challenge.findMany({ where: { questionId }, orderBy: { createdAt: "asc" } });
    return { events, challenges };
  });

  app.get("/questions/:questionId/discussion", async (request, reply) => {
    const { questionId } = request.params as { questionId: string };
    const { userId } = request.query as { userId?: string };
    const question = await prisma.question.findUnique({ where: { id: questionId }, select: { id: true, communityId: true, proposer: true, audience: true } });
    if (!question) return reply.code(404).send({ error: "Question not found" });
    if (!(await canReadQuestion(question, userId))) {
      return reply.code(403).send({ error: "Follow or join this community to view this discussion" });
    }
    const posts = await prisma.discussionPost.findMany({ where: { questionId, status: "Published" }, orderBy: { createdAt: "asc" } });
    const discussion = await hydrateDiscussionPosts(posts, artifactStore);
    const views = buildDiscussionViews(discussion);
    return { protocol: buildQuestionDiscussionProtocol(question, discussion, views), questionId, discussion, views };
  });

  app.post("/questions/:questionId/discussion", async (request, reply) => {
    const { questionId } = request.params as { questionId: string };
    const input = CreateDiscussionPostRequestSchema.parse(request.body ?? {});
    if (!(await requireAuthenticatedActor(request, reply, input.authorId))) return;
    const [question, author] = await Promise.all([
      prisma.question.findUnique({ where: { id: questionId }, select: { id: true, communityId: true, proposer: true, audience: true } }),
      prisma.userAccount.findUnique({ where: { id: input.authorId } })
    ]);
    if (!question) return reply.code(404).send({ error: "Question not found" });
    if (!author) return reply.code(404).send({ error: "Author account not found" });
    if (!(await canReadQuestion(question, input.authorId))) {
      return reply.code(403).send({ error: "Follow or join this community before joining its discussion" });
    }

    const bodyArtifact = await artifactStore.write(
      withArtifactSchema("discussion-post", {
        questionId,
        authorId: input.authorId,
        kind: input.kind,
        body: input.body,
        parentId: input.parentId
      })
    );
    await storeArtifact(bodyArtifact, "discussion-post");
    const discussionPostedEvent = prepareProtocolEvent({
      eventType: "DiscussionPosted",
      subjectId: questionId,
      actor: input.authorId,
      previousHash: null,
      newHash: bodyArtifact.hash
    });
    const post = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, discussionPostedEvent);
      const created = await tx.discussionPost.create({
        data: {
          id: `discussion-${nanoid(10)}`,
          questionId,
          authorId: input.authorId,
          kind: input.kind,
          bodyHash: bodyArtifact.hash,
          parentId: input.parentId
        }
      });
      await recordActivity(tx, {
        actorId: input.authorId,
        activityType: "DiscussionPosted",
        questionId,
        communityId: question.communityId,
        targetCommunityId: question.communityId,
        audience: question.audience,
        shellText: `${author.displayName} added a note to a ${audienceLabel(question.audience)} question.`
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return created;
    });
    return { post: { ...post, body: input.body }, bodyArtifact };
  });

  app.get("/questions/:questionId/moderation", async (request, reply) => {
    const { questionId } = request.params as { questionId: string };
    const { userId } = request.query as { userId?: string };
    const question = await prisma.question.findUnique({ where: { id: questionId }, select: { id: true, communityId: true, proposer: true, audience: true } });
    if (!question) return reply.code(404).send({ error: "Question not found" });
    if (!(await canReadQuestion(question, userId))) {
      return reply.code(403).send({ error: "Follow or join this community to view this moderation log" });
    }
    const { moderationRecords, appeals } = await loadModerationLog(questionId, artifactStore);
    return { protocol: buildQuestionModerationProtocol(question, moderationRecords, appeals), questionId, moderationRecords, appeals };
  });

  app.post("/questions/:questionId/discussion/:postId/moderation", async (request, reply) => {
    const { questionId, postId } = request.params as { questionId: string; postId: string };
    const input = ModerateDiscussionPostRequestSchema.parse(request.body ?? {});
    const post = await prisma.discussionPost.findUnique({ where: { id: postId }, include: { question: true } });
    if (!post || post.questionId !== questionId) return reply.code(404).send({ error: "Discussion post not found" });
    const moderatorCheck = await requireCommunityCurator(post.question.communityId, input.moderatorId, reply, request);
    if (!moderatorCheck) return;

    const previousStatus = normalizeDiscussionStatus(post.status);
    const newStatus = input.action === "HidePost" ? "Hidden" : "Published";
    if (previousStatus === newStatus) return reply.code(409).send({ error: `Discussion post is already ${newStatus.toLowerCase()}` });

    const moderationArtifact = await artifactStore.write(
      withArtifactSchema("discussion-moderation", {
        questionId,
        postId,
        postBodyHash: post.bodyHash,
        moderatorId: input.moderatorId,
        action: input.action,
        reasonCode: input.reasonCode,
        reason: input.reason,
        previousStatus,
        newStatus
      })
    );
    await storeArtifact(moderationArtifact, "discussion-moderation");
    const discussionModeratedEvent = prepareProtocolEvent({
      eventType: "DiscussionModerated",
      subjectId: questionId,
      actor: input.moderatorId,
      previousHash: post.bodyHash,
      newHash: moderationArtifact.hash
    });
    const moderationRecord = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, discussionModeratedEvent);
      await tx.discussionPost.update({ where: { id: postId }, data: { status: newStatus } });
      const created = await tx.discussionModerationRecord.create({
        data: {
          id: `moderation-${nanoid(10)}`,
          questionId,
          postId,
          moderatorId: input.moderatorId,
          action: input.action,
          reasonCode: input.reasonCode,
          reasonHash: moderationArtifact.hash,
          previousStatus,
          newStatus
        }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return created;
    });
    return { moderationRecord: toModerationRecordView(moderationRecord, post.bodyHash, input.reason), moderationArtifact };
  });

  app.post("/moderation/:recordId/appeals", async (request, reply) => {
    const { recordId } = request.params as { recordId: string };
    const input = CreateModerationAppealRequestSchema.parse(request.body ?? {});
    if (!(await requireAuthenticatedActor(request, reply, input.appellantId))) return;
    const moderationRecord = await prisma.discussionModerationRecord.findUnique({
      where: { id: recordId },
      include: { post: true, question: true }
    });
    if (!moderationRecord) return reply.code(404).send({ error: "Moderation record not found" });
    if (!(await canReadQuestion(moderationRecord.question, input.appellantId))) {
      return reply.code(403).send({ error: "Follow or join this community before appealing moderation" });
    }
    if (moderationRecord.post.authorId !== input.appellantId) {
      return reply.code(403).send({ error: "Only the moderated post author can appeal this record" });
    }
    const existing = await prisma.discussionModerationAppeal.findUnique({
      where: { moderationRecordId_appellantId: { moderationRecordId: recordId, appellantId: input.appellantId } }
    });
    if (existing) return reply.code(409).send({ error: "This moderation record already has an appeal from this author" });

    const appealArtifact = await artifactStore.write(
      withArtifactSchema("discussion-moderation-appeal", {
        moderationRecordId: recordId,
        questionId: moderationRecord.questionId,
        postId: moderationRecord.postId,
        appellantId: input.appellantId,
        appeal: input.appeal
      })
    );
    await storeArtifact(appealArtifact, "discussion-moderation-appeal");
    const discussionModerationAppealedEvent = prepareProtocolEvent({
      eventType: "DiscussionModerationAppealed",
      subjectId: moderationRecord.questionId,
      actor: input.appellantId,
      previousHash: moderationRecord.reasonHash,
      newHash: appealArtifact.hash
    });
    const appeal = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, discussionModerationAppealedEvent);
      const created = await tx.discussionModerationAppeal.create({
        data: {
          id: `moderation-appeal-${nanoid(10)}`,
          moderationRecordId: recordId,
          appellantId: input.appellantId,
          appealHash: appealArtifact.hash
        }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return created;
    });
    return { appeal: toModerationAppealView(appeal, input.appeal, null), appealArtifact };
  });

  app.post("/moderation/appeals/:appealId/ruling", async (request, reply) => {
    const { appealId } = request.params as { appealId: string };
    const input = ResolveModerationAppealRequestSchema.parse(request.body ?? {});
    const appeal = await prisma.discussionModerationAppeal.findUnique({
      where: { id: appealId },
      include: { moderationRecord: { include: { post: true, question: true } } }
    });
    if (!appeal) return reply.code(404).send({ error: "Moderation appeal not found" });
    if (appeal.status !== "Pending") return reply.code(409).send({ error: "Moderation appeal is already resolved" });
    const moderatorCheck = await requireCommunityCurator(appeal.moderationRecord.question.communityId, input.moderatorId, reply, request);
    if (!moderatorCheck) return;

    const resolutionArtifact = await artifactStore.write(
      withArtifactSchema("discussion-moderation-resolution", {
        appealId,
        moderationRecordId: appeal.moderationRecordId,
        questionId: appeal.moderationRecord.questionId,
        postId: appeal.moderationRecord.postId,
        moderatorId: input.moderatorId,
        ruling: input.ruling,
        resolution: input.resolution
      })
    );
    await storeArtifact(resolutionArtifact, "discussion-moderation-resolution");
    const nextPostStatus =
      input.ruling === "Overturned"
        ? normalizeDiscussionStatus(appeal.moderationRecord.previousStatus)
        : normalizeDiscussionStatus(appeal.moderationRecord.newStatus);
    const discussionModerationAppealResolvedEvent = prepareProtocolEvent({
      eventType: "DiscussionModerationAppealResolved",
      subjectId: appeal.moderationRecord.questionId,
      actor: input.moderatorId,
      previousHash: appeal.appealHash,
      newHash: resolutionArtifact.hash
    });
    const resolvedAppeal = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, discussionModerationAppealResolvedEvent);
      const updated = await tx.discussionModerationAppeal.update({
        where: { id: appealId },
        data: {
          status: input.ruling,
          resolutionHash: resolutionArtifact.hash,
          resolvedBy: input.moderatorId,
          resolvedAt: new Date()
        }
      });
      await tx.discussionPost.update({ where: { id: appeal.moderationRecord.postId }, data: { status: nextPostStatus } });
      await recordProtocolCommitments(protocolEvent, tx);
      return updated;
    });
    const appealArtifact = await artifactStore.read<{ appeal?: string }>(appeal.appealHash).catch((): { appeal?: string } => ({}));
    return {
      appeal: toModerationAppealView(resolvedAppeal, appealArtifact.appeal ?? "", input.resolution),
      resolutionArtifact,
      postStatus: nextPostStatus
    };
  });

  app.post("/credentials/demo-resident", async (request, reply) => {
    if (!config.demoMode) return reply.code(404).send({ error: "Demo voting-pass issuance is disabled outside demo mode" });
    const input = DemoResidentCredentialRequestSchema.parse(request.body ?? {});
    if (!(await requireAuthenticatedActor(request, reply, input.holderAlias))) return;
    const registryError = await credentialRegistryError({ schemaId: input.schemaId, issuerId: input.issuerId });
    if (registryError) return reply.code(409).send({ error: registryError });
    const existingCredential = await prisma.credential.findFirst({
      where: {
        holderAlias: input.holderAlias,
        schemaId: input.schemaId,
        issuerId: input.issuerId
      }
    });
    if (existingCredential) {
      return reply.code(409).send({ error: "Demo resident voting pass was already issued for this person" });
    }
    const credential = issueDemoCredential(input.holderAlias, input.schemaId, input.issuerId);
    try {
      const credentialIssuedEvent = prepareProtocolEvent({
        eventType: "CredentialIssued",
        subjectId: credential.credentialId,
        actor: credential.issuerId,
        previousHash: null,
        newHash: credential.secretHash
      });
      const storedCredential = await prisma.$transaction(async (tx) => {
        const protocolEvent = await ingestProtocolEvent(tx, credentialIssuedEvent);
        const created = await tx.credential.create({
          data: {
            id: credential.credentialId,
            holderAlias: credential.holderAlias,
            schemaId: credential.schemaId,
            issuerId: credential.issuerId,
            secretHash: credential.secretHash
          }
        });
        await recordProtocolCommitments(protocolEvent, tx);
        return created;
      });
      return { credential, walletCredential: toWalletCredential(storedCredential, credential.secret), walletBoundary: CREDENTIAL_WALLET_BOUNDARY };
    } catch {
      return reply.code(409).send({ error: "Demo resident voting pass was already issued for this person" });
    }
  });

  app.post("/credentials/:credentialId/export", async (request, reply) => {
    if (!config.demoMode) return reply.code(404).send({ error: "Demo voting-pass export is disabled outside demo mode" });
    const { credentialId } = request.params as { credentialId: string };
    const input = ExportWalletCredentialRequestSchema.parse(request.body ?? {});
    const credential = await prisma.credential.findUnique({ where: { id: credentialId } });
    if (!credential) return reply.code(404).send({ error: "Voting pass not found" });
    if (!verifyDemoCredential(input.credentialSecret, credential.secretHash)) {
      return reply.code(403).send({ error: "Voting pass could not be verified" });
    }
    return { walletCredential: toWalletCredential(credential, input.credentialSecret), walletBoundary: CREDENTIAL_WALLET_BOUNDARY };
  });

  app.post("/credentials/import", async (request, reply) => {
    if (!config.demoMode) return reply.code(404).send({ error: "Demo voting-pass import is disabled outside demo mode" });
    const input = ImportWalletCredentialRequestSchema.parse(request.body ?? {});
    const walletCredential = input.credential;
    const expectedCredentialId = credentialIdForDemoCredential(
      walletCredential.holderAlias,
      walletCredential.schemaId,
      walletCredential.issuerId,
      walletCredential.secret
    );
    if (walletCredential.credentialId !== expectedCredentialId) {
      return reply.code(400).send({ error: "Wallet voting pass does not match its secret" });
    }
    const issuedAt = walletCredentialIssuedAtDate(walletCredential);
    if (!issuedAt) return reply.code(400).send({ error: "Wallet voting pass date is invalid" });

    const registryError = await credentialRegistryError({
      id: walletCredential.credentialId,
      schemaId: walletCredential.schemaId,
      issuerId: walletCredential.issuerId,
      createdAt: issuedAt
    });
    if (registryError) return reply.code(403).send({ error: registryError });

    const existingCredential = await prisma.credential.findUnique({ where: { id: walletCredential.credentialId } });
    if (existingCredential) {
      if (!verifyDemoCredential(walletCredential.secret, existingCredential.secretHash)) {
        return reply.code(403).send({ error: "Wallet voting pass secret does not match the saved pass" });
      }
      return {
        imported: false,
        credential: existingCredential,
        walletCredential: toWalletCredential(existingCredential, walletCredential.secret),
        walletBoundary: CREDENTIAL_WALLET_BOUNDARY
      };
    }

    try {
      const importedCredential = await prisma.credential.create({
        data: {
          id: walletCredential.credentialId,
          holderAlias: walletCredential.holderAlias,
          schemaId: walletCredential.schemaId,
          issuerId: walletCredential.issuerId,
          secretHash: hashDemoCredentialSecret(walletCredential.secret),
          createdAt: issuedAt
        }
      });
      return {
        imported: true,
        credential: importedCredential,
        walletCredential: toWalletCredential(importedCredential, walletCredential.secret),
        walletBoundary: CREDENTIAL_WALLET_BOUNDARY
      };
    } catch {
      return reply.code(409).send({ error: "Wallet voting pass conflicts with an existing pass" });
    }
  });

  app.post("/anonymous-eligibility-groups", async (request, reply) => {
    const input = RegisterAnonymousEligibilityGroupRequestSchema.parse(request.body ?? {});
    if (!(await requireAuthenticatedActor(request, reply, input.stewardId))) return;
    const [schema, issuer, community] = await Promise.all([
      prisma.credentialSchema.findUnique({ where: { id: input.credentialSchemaId } }),
      prisma.credentialIssuer.findUnique({ where: { id: input.issuerId } }),
      input.communityId ? prisma.community.findUnique({ where: { id: input.communityId } }) : Promise.resolve(null)
    ]);
    if (!schema || schema.status !== "Active") return reply.code(404).send({ error: "Active credential schema not found" });
    if (!issuer || issuer.status !== "Active" || !issuer.schemaIds.includes(input.credentialSchemaId)) {
      return reply.code(403).send({ error: "Issuer is not active for this credential schema" });
    }
    if (input.communityId && !community) return reply.code(404).send({ error: "Community not found" });
    if (input.communityId && !(await requireCommunityCurator(input.communityId, input.stewardId, reply, request))) return;

    const groupHash = hashJson({
      protocol: "pc-anonymous-eligibility-group-v1",
      groupId: input.groupId,
      groupRoot: input.groupRoot,
      credentialSchemaId: input.credentialSchemaId,
      issuerId: input.issuerId,
      communityId: input.communityId ?? null,
      commitmentCount: input.commitmentCount
    });
    const groupRegisteredEvent = prepareProtocolEvent({
      eventType: "AnonymousEligibilityGroupRegistered",
      subjectId: input.groupId,
      actor: input.stewardId,
      previousHash: null,
      newHash: groupHash
    });
    const group = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, groupRegisteredEvent);
      const created = await tx.anonymousEligibilityGroup.upsert({
        where: { id: input.groupId },
        update: {
          groupRoot: input.groupRoot,
          credentialSchemaId: input.credentialSchemaId,
          issuerId: input.issuerId,
          communityId: input.communityId ?? null,
          commitmentCount: input.commitmentCount,
          status: "Active"
        },
        create: {
          id: input.groupId,
          groupRoot: input.groupRoot,
          credentialSchemaId: input.credentialSchemaId,
          issuerId: input.issuerId,
          communityId: input.communityId ?? null,
          commitmentCount: input.commitmentCount
        }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return created;
    });
    return { group };
  });

  app.post("/polls/:pollId/credential-proof", async (request, reply) => {
    if (!config.demoMode) return reply.code(404).send({ error: "Demo voting-pass proofs are disabled outside demo mode" });
    const { pollId } = request.params as { pollId: string };
    const input = CredentialProofRequestSchema.parse(request.body ?? {});
    const poll = await prisma.poll.findUnique({ where: { id: pollId }, include: { question: true } });
    const credential = await prisma.credential.findUnique({ where: { id: input.credentialId } });
    if (!poll || !credential) return reply.code(404).send({ error: "Vote or voting pass not found" });
    if (credential.schemaId !== poll.credentialSchemaId) {
      return reply.code(403).send({ error: "This voting pass is not for this vote" });
    }
    const registryError = await credentialRegistryError(credential);
    if (registryError) return reply.code(403).send({ error: registryError });
    const trustError = await communityCredentialTrustError(poll.question.communityId, credential);
    if (trustError) return reply.code(403).send({ error: trustError });
    if (!(await canReadQuestion(poll.question, credential.holderAlias))) {
      return reply.code(403).send({ error: "Follow or join this community before proving you can vote here" });
    }
    if (!verifyDemoCredential(input.credentialSecret, credential.secretHash)) {
      return reply.code(403).send({ error: "Voting pass could not be verified" });
    }
    const membershipProof = resolveCredentialMembershipProof(input.membershipProof, credential, input.credentialSecret, pollId);
    if (!membershipProof) return reply.code(403).send({ error: "Voting pass proof could not be verified" });
    return { membershipProof, nullifier: membershipProof.nullifier, credentialSchemaId: credential.schemaId };
  });

  app.post("/polls/:pollId/signup", async (request, reply) => {
    if (!config.demoMode) return reply.code(404).send({ error: "Demo poll signup is disabled outside demo mode" });
    const { pollId } = request.params as { pollId: string };
    const input = CredentialProofRequestSchema.parse(request.body ?? {});
    const poll = await prisma.poll.findUnique({ where: { id: pollId }, include: { question: true } });
    const credential = await prisma.credential.findUnique({ where: { id: input.credentialId } });
    if (!poll || !credential) return reply.code(404).send({ error: "Vote or voting pass not found" });
    if (poll.status !== "Open" || poll.question.status !== "Open") return reply.code(409).send({ error: "Voting is not open" });
    if (credential.schemaId !== poll.credentialSchemaId) {
      return reply.code(403).send({ error: "This voting pass is not for this vote" });
    }
    const registryError = await credentialRegistryError(credential);
    if (registryError) return reply.code(403).send({ error: registryError });
    const trustError = await communityCredentialTrustError(poll.question.communityId, credential);
    if (trustError) return reply.code(403).send({ error: trustError });
    if (!(await canReadQuestion(poll.question, credential.holderAlias))) {
      return reply.code(403).send({ error: "Follow or join this community before signing up to vote" });
    }
    if (!(await ensureCommunityProtocolWritable(poll.question.communityId, reply))) return;
    if (!verifyDemoCredential(input.credentialSecret, credential.secretHash)) {
      return reply.code(403).send({ error: "Voting pass could not be verified" });
    }
    const membershipProof = resolveCredentialMembershipProof(input.membershipProof, credential, input.credentialSecret, pollId);
    if (!membershipProof) return reply.code(403).send({ error: "Voting pass proof could not be verified" });
    const nullifier = membershipProof.nullifier;
    const existing = await prisma.ballot.findUnique({ where: { pollId_nullifier: { pollId, nullifier } } });
    return { accepted: !existing, nullifier, credentialSchemaId: credential.schemaId, membershipProof };
  });

  app.post("/polls/:pollId/vote", async (request, reply) => {
    const { pollId } = request.params as { pollId: string };
    const input = VoteRequestSchema.parse(request.body ?? {});
    if ("proofMode" in input && input.proofMode === "AnonymousZk") {
      const poll = await prisma.poll.findUnique({ where: { id: pollId }, include: { question: true } });
      if (!poll) return reply.code(404).send({ error: "Poll not found" });
      if (poll.status !== "Open" || poll.question.status !== "Open") return reply.code(409).send({ error: "Poll is not open" });
      if (!(await ensureCommunityProtocolWritable(poll.question.communityId, reply))) return;

      const group = await prisma.anonymousEligibilityGroup.findUnique({ where: { id: input.anonymousProof.groupId } });
      if (!group || group.status !== "Active") return reply.code(403).send({ error: "Anonymous eligibility group is not active" });
      if (group.credentialSchemaId !== poll.credentialSchemaId) return reply.code(403).send({ error: "Anonymous proof schema mismatch" });
      if (group.groupRoot !== input.anonymousProof.groupRoot) return reply.code(403).send({ error: "Anonymous eligibility root mismatch" });

      const representedCommunity = input.representedCommunityId
        ? await prisma.community.findUnique({ where: { id: input.representedCommunityId } })
        : null;
      if (input.representedCommunityId && !representedCommunity) return reply.code(404).send({ error: "Represented community not found" });
      const expectedCommunityId = representedCommunity?.id ?? poll.question.communityId ?? null;
      if (group.communityId !== expectedCommunityId) {
        return reply.code(403).send({ error: "Anonymous eligibility group is not scoped to this poll community" });
      }
      if (representedCommunity) {
        if (representedCommunity.registryStatus !== "Active") return reply.code(409).send({ error: "Represented community is not active" });
        if (!poll.question.communityId || representedCommunity.parentId !== poll.question.communityId) {
          return reply.code(403).send({ error: "Represented community must be a direct child of this poll community" });
        }
      }

      const nullifier = input.anonymousProof.nullifier;
      const scope = anonymousPollScope(pollId, poll.credentialSchemaId);
      const commitment = ballotCommitment(input.encryptedPayload as EncryptedBallotPayload, nullifier);
      if (commitment !== input.ballotCommitment) return reply.code(400).send({ error: "Ballot commitment does not match encrypted payload and nullifier" });
      if (input.anonymousProof.signal !== commitment) return reply.code(400).send({ error: "Anonymous proof signal must be the ballot commitment" });
      if (input.anonymousProof.scope !== scope) return reply.code(400).send({ error: "Anonymous proof scope does not match this poll" });
      const proofVerified = await verifyAnonymousBallotProof(input.anonymousProof as AnonymousBallotProof, {
        groupRoot: group.groupRoot,
        signal: commitment,
        scope
      });
      if (!proofVerified) return reply.code(403).send({ error: "Anonymous ballot proof rejected" });

      const encryptedPayloadHash = hashJson(input.encryptedPayload);
      const productionEligibilityProof = buildProductionSliceEligibilityProof(input.anonymousProof as AnonymousBallotProof, commitment);
      const eligibilityProofArtifact = productionEligibilityProof
        ? await artifactStore.write(withArtifactSchema("production-slice-eligibility-proof", productionEligibilityProof))
        : null;
      if (eligibilityProofArtifact) await storeArtifact(eligibilityProofArtifact, "production-slice-eligibility-proof");
      const proofHash = productionEligibilityProof?.proofHash ?? anonymousBallotProofHash(input.anonymousProof as AnonymousBallotProof);
      const ballotAcceptedEvent = prepareProtocolEvent({
        eventType: "BallotAccepted",
        subjectId: poll.questionId,
        actor: "anonymous-voter",
        previousHash: null,
        newHash: commitment
      });

      try {
        const ballot = await prisma.$transaction(async (tx) => {
          const protocolEvent = await ingestProtocolEvent(tx, ballotAcceptedEvent);
          const accepted = await tx.ballot.create({
            data: {
              id: `ballot-${nanoid(10)}`,
              pollId,
              questionId: poll.questionId,
              nullifier,
              ballotCommitment: commitment,
              encryptedPayloadHash,
              encryptedPayloadJson: JSON.stringify(input.encryptedPayload),
              tallyPublicKeyId: poll.tallyPublicKeyId,
              proofHash,
              proofSystem: "SemaphoreV4",
              eligibilityProofArtifactHash: eligibilityProofArtifact?.hash ?? null,
              eligibilityGroupId: group.id,
              eligibilityGroupRoot: group.groupRoot,
              representedCommunityId: representedCommunity?.id ?? null,
              representedCommunityPath: representedCommunity?.path ?? null
            }
          });
          await tx.participationReceipt.create({
            data: {
              id: `participation-receipt-${nanoid(10)}`,
              pollId,
              receiptHash: input.rewardReceiptHash
            }
          });
          await recordProtocolCommitments(protocolEvent, tx);
          return accepted;
        });
        return {
          ballot: {
            pollId: ballot.pollId,
            questionId: ballot.questionId,
            nullifier: ballot.nullifier,
            ballotCommitment: ballot.ballotCommitment,
            encryptedPayloadHash: ballot.encryptedPayloadHash,
            tallyPublicKeyId: ballot.tallyPublicKeyId,
            proofHash: ballot.proofHash,
            proofSystem: ballot.proofSystem,
            eligibilityProofArtifactHash: ballot.eligibilityProofArtifactHash,
            eligibilityGroupId: ballot.eligibilityGroupId,
            eligibilityGroupRoot: ballot.eligibilityGroupRoot,
            representedCommunityId: ballot.representedCommunityId,
            representedCommunityPath: ballot.representedCommunityPath,
            submittedAt: ballot.submittedAt
          },
          participationReceipt: {
            receiptHash: input.rewardReceiptHash,
            status: "Issued"
          }
        };
      } catch {
        return reply.code(409).send({ error: "This vote or reward receipt was already used" });
      }
    }

    if (!config.demoMode) return reply.code(403).send({ error: "Production voting requires an anonymous ZK proof" });
    const demoInput = input as DemoVoteRequest;
    const poll = await prisma.poll.findUnique({ where: { id: pollId }, include: { question: true } });
    const credential = await prisma.credential.findUnique({ where: { id: demoInput.credentialId } });
    if (!poll || !credential) return reply.code(404).send({ error: "Vote or voting pass not found" });
    if (poll.status !== "Open" || poll.question.status !== "Open") return reply.code(409).send({ error: "Voting is not open" });
    const registryError = await credentialRegistryError(credential);
    if (registryError) return reply.code(403).send({ error: registryError });
    const trustError = await communityCredentialTrustError(poll.question.communityId, credential);
    if (trustError) return reply.code(403).send({ error: trustError });
    if (!(await canReadQuestion(poll.question, credential.holderAlias))) {
      return reply.code(403).send({ error: "Follow or join this community before voting here" });
    }
    if (!(await ensureCommunityProtocolWritable(poll.question.communityId, reply))) return;
    if (!verifyDemoCredential(demoInput.credentialSecret, credential.secretHash)) {
      return reply.code(403).send({ error: "Voting pass could not be verified" });
    }
    if (credential.schemaId !== poll.credentialSchemaId) {
      return reply.code(403).send({ error: "This voting pass is not for this vote" });
    }
    const membershipProof = resolveCredentialMembershipProof(demoInput.membershipProof, credential, demoInput.credentialSecret, pollId);
    if (!membershipProof) return reply.code(403).send({ error: "Voting pass proof could not be verified" });
    const representedCommunity = demoInput.representedCommunityId
      ? await prisma.community.findUnique({ where: { id: demoInput.representedCommunityId } })
      : null;
    if (demoInput.representedCommunityId && !representedCommunity) return reply.code(404).send({ error: "Represented community not found" });
    if (representedCommunity) {
      if (representedCommunity.registryStatus !== "Active") return reply.code(409).send({ error: "Represented community is not active" });
      if (!poll.question.communityId || representedCommunity.parentId !== poll.question.communityId) {
        return reply.code(403).send({ error: "Represented community must be a direct child of this poll community" });
      }
      const representedMembership = await prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId: representedCommunity.id, userId: credential.holderAlias } },
        select: { status: true }
      });
      if (representedMembership?.status !== "Active") {
        return reply.code(403).send({ error: "Join the represented child community before casting its block signal" });
      }
    }
    const resultMode = normalizePollResultMode(poll.question.resultMode);
    if (resultMode === "CommunitiesSignal" && !representedCommunity) {
      return reply.code(400).send({ error: "Choose one represented child community for this community-signal poll" });
    }

    const answerSchema = getAnswerSchema(poll.question.answerSchemaId);
    const response = validateBallotResponse(answerSchema, demoInput.response ?? choiceToBallotResponse(demoInput.choice ?? "abstain"));
    const nullifier = membershipProof.nullifier;
    const payload = encryptBallot(response, poll.tallyPublicKeyPem);
    const commitment = ballotCommitment(payload, nullifier);
    const encryptedPayloadHash = hashJson(payload);
    const proofHash = hashJson({
      membershipProofHash: membershipProof.proofHash,
      nullifier,
      commitment,
      answerSchemaId: answerSchema.answerSchemaId,
      responseShape: answerSchema.responseShape
    });
    const ballotAcceptedEvent = prepareProtocolEvent({
      eventType: "BallotAccepted",
      subjectId: poll.questionId,
      actor: credential.holderAlias,
      previousHash: null,
      newHash: commitment
    });

    try {
      const ballot = await prisma.$transaction(async (tx) => {
        const protocolEvent = await ingestProtocolEvent(tx, ballotAcceptedEvent);
        const accepted = await tx.ballot.create({
          data: {
            id: `ballot-${nanoid(10)}`,
            pollId,
            questionId: poll.questionId,
            nullifier,
            ballotCommitment: commitment,
            encryptedPayloadHash,
            encryptedPayloadJson: JSON.stringify(payload),
            tallyPublicKeyId: poll.tallyPublicKeyId,
            proofHash,
            representedCommunityId: representedCommunity?.id ?? null,
            representedCommunityPath: representedCommunity?.path ?? null
          }
        });
        await recordProtocolCommitments(protocolEvent, tx);
        await recordActivity(tx, {
          actorId: credential.holderAlias,
          activityType: "PollParticipated",
          questionId: poll.questionId,
          communityId: poll.question.communityId,
          targetCommunityId: profileCommunityIdForUser(credential.holderAlias),
          audience: "Public",
          shellText: `${credential.holderAlias} cast a private vote.`
        });
        return accepted;
      });
      return {
        ballot: {
          pollId: ballot.pollId,
          questionId: ballot.questionId,
          nullifier: ballot.nullifier,
          ballotCommitment: ballot.ballotCommitment,
          encryptedPayloadHash: ballot.encryptedPayloadHash,
          tallyPublicKeyId: ballot.tallyPublicKeyId,
          proofHash: ballot.proofHash,
          representedCommunityId: ballot.representedCommunityId,
          representedCommunityPath: ballot.representedCommunityPath,
          submittedAt: ballot.submittedAt
        },
        membershipProof
      };
    } catch {
      return reply.code(409).send({ error: "You have already voted on this question" });
    }
  });

  app.post("/rewards/participation/redeem", async (request, reply) => {
    const input = RedeemParticipationReceiptRequestSchema.parse(request.body ?? {});
    const [poll, destinationAccount] = await Promise.all([
      prisma.poll.findUnique({ where: { id: input.pollId }, select: { id: true } }),
      prisma.userAccount.findUnique({ where: { id: input.destinationAccount }, select: { id: true } })
    ]);
    if (!poll) return reply.code(404).send({ error: "Poll not found" });
    if (!destinationAccount) return reply.code(404).send({ error: "Destination account not found" });

    const receiptHash = participationReceiptHash(input.receiptSecret);
    const receipt = await prisma.participationReceipt.findFirst({ where: { pollId: input.pollId, receiptHash } });
    if (!receipt) return reply.code(404).send({ error: "Participation receipt not found" });
    if (receipt.status !== "Issued") return reply.code(409).send({ error: "Participation receipt has already been redeemed" });

    const redemptionNullifier = hashJson({ protocol: "pc-participation-receipt-redemption-v1", receiptSecret: input.receiptSecret });
    const redeemed = await prisma.participationReceipt.updateMany({
      where: { id: receipt.id, status: "Issued" },
      data: {
        status: "Redeemed",
        redeemedBy: input.destinationAccount,
        redemptionNullifier,
        redeemedAt: new Date()
      }
    });
    if (redeemed.count !== 1) return reply.code(409).send({ error: "Participation receipt has already been redeemed" });
    await addReputation(input.destinationAccount, "PrivateParticipationReceipt", 1, redemptionNullifier);
    return {
      redeemed: true,
      pollId: input.pollId,
      receiptHash,
      redemptionNullifier,
      destinationAccount: input.destinationAccount
    };
  });

  app.post("/polls/:pollId/close", async (request, reply) => {
    const { pollId } = request.params as { pollId: string };
    if (config.requireAuth) {
      return reply.code(501).send({ error: "Demo coordinator poll close is disabled when authentication is required" });
    }
    const poll = await prisma.poll.findUnique({ where: { id: pollId }, include: { question: true } });
    if (!poll) return reply.code(404).send({ error: "Poll not found" });
    if (poll.status !== "Open") return reply.code(409).send({ error: "Poll is not open" });
    if (!(await ensureCommunityProtocolWritable(poll.question.communityId, reply))) return;
    const pollClosedEvent = prepareProtocolEvent({
      eventType: "PollClosed",
      subjectId: poll.questionId,
      actor: "demo-coordinator",
      previousHash: null,
      newHash: hashJson({ pollId, status: "Closed" })
    });
    const updated = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, pollClosedEvent);
      const closed = await tx.poll.update({ where: { id: pollId }, data: { status: "Closed" } });
      await tx.question.update({ where: { id: poll.questionId }, data: { status: "Closed" } });
      await recordProtocolCommitments(protocolEvent, tx);
      return closed;
    });
    return { poll: updated };
  });

  app.get("/polls/:pollId/decryption-shares", async (request, reply) => {
    const { pollId } = request.params as { pollId: string };
    const { userId } = request.query as { userId?: string };
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        question: true,
        tallyKeySetup: { select: TALLY_KEY_SETUP_PUBLIC_SELECT },
        decryptionShares: { select: TALLY_DECRYPTION_SHARE_PUBLIC_SELECT, orderBy: { submittedAt: "asc" } }
      }
    });
    if (!poll) return reply.code(404).send({ error: "Poll not found" });
    if (!(await canReadQuestion(poll.question, userId))) {
      return reply.code(403).send({ error: "Follow or join this community to view decryption shares" });
    }
    return {
      protocol: buildTallyDecryptionSharesProtocol(pollId, poll.tallyKeySetup, poll.decryptionShares),
      pollId,
      keySetupId: poll.tallyKeySetup?.id ?? null,
      threshold: poll.tallyKeySetup?.threshold ?? 0,
      thresholdMet: tallyDecryptionShareThresholdMet(poll.tallyKeySetup, poll.decryptionShares),
      shares: poll.decryptionShares
    };
  });

  app.post("/polls/:pollId/decryption-shares", async (request, reply) => {
    const { pollId } = request.params as { pollId: string };
    const input = SubmitTallyDecryptionShareRequestSchema.parse(request.body ?? {});
    if (!(await requireAuthenticatedActor(request, reply, input.memberId))) return;
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        question: true,
        tallyKeySetup: { select: TALLY_KEY_SETUP_PUBLIC_SELECT },
        decryptionShares: { select: TALLY_DECRYPTION_SHARE_PUBLIC_SELECT },
        ballots: true
      }
    });
    if (!poll) return reply.code(404).send({ error: "Poll not found" });
    if (poll.status !== "Closed") return reply.code(409).send({ error: "Poll must be closed before decryption shares are submitted" });
    if (!poll.tallyKeySetup) return reply.code(409).send({ error: "Poll does not use a threshold tally key setup" });
    if (!(await ensureCommunityProtocolWritable(poll.question.communityId, reply))) return;
    const tallyKeySetup = poll.tallyKeySetup;
    if (!tallyKeySetup.memberIds.includes(input.memberId)) {
      return reply.code(403).send({ error: "Decryption share member is not part of the poll tally key setup" });
    }
    const ballotCommitmentsHash = hashJson(poll.ballots.map((ballot) => ballot.ballotCommitment).sort());
    if (input.productionAttestation && input.productionAttestation.ballotCommitmentsHash !== ballotCommitmentsHash) {
      return reply.code(400).send({ error: "Production decryption share ballot commitment set does not match this poll" });
    }
    const productionProofHash = input.productionAttestation
      ? hashJson({
          protocol: "pc-threshold-decryption-share-proof-v1",
          pollId,
          keySetupId: tallyKeySetup.id,
          memberId: input.memberId,
          ballotCommitmentsHash: input.productionAttestation.ballotCommitmentsHash,
          aggregateCountsHash: input.productionAttestation.aggregateCountsHash,
          proof: input.proof
        })
      : null;
    const productionShareHash = input.productionAttestation
      ? productionSliceDecryptionShareHash({
          pollId,
          tallyKeySetupId: tallyKeySetup.id,
          memberId: input.memberId,
          ballotCommitmentsHash: input.productionAttestation.ballotCommitmentsHash,
          aggregateCountsHash: input.productionAttestation.aggregateCountsHash,
          proofHash: productionProofHash!,
          status: "Accepted"
        })
      : null;
    if (input.productionAttestation) {
      const memberPublicKey = await productionSliceMemberPublicKey(artifactStore, tallyKeySetup, input.memberId);
      if (!memberPublicKey) return reply.code(409).send({ error: "Tally key setup does not include production member public keys" });
      const signatureValid = verifyEd25519(
        memberPublicKey,
        decryptionShareSignaturePayload({
          pollId,
          tallyKeySetupId: tallyKeySetup.id,
          memberId: input.memberId,
          ballotCommitmentsHash: input.productionAttestation.ballotCommitmentsHash,
          aggregateCountsHash: input.productionAttestation.aggregateCountsHash,
          shareHash: productionShareHash!,
          proofHash: productionProofHash!,
          status: "Accepted"
        }),
        input.productionAttestation.signature
      );
      if (!signatureValid) return reply.code(400).send({ error: "Production decryption share signature is invalid" });
    }
    const shareHash =
      productionShareHash ??
      hashJson({
        protocol: "pc-threshold-decryption-share-v0",
        pollId,
        keySetupId: tallyKeySetup.id,
        memberId: input.memberId,
        share: input.share
      });
    const proofHash =
      productionProofHash ??
      hashJson({
        protocol: "pc-threshold-decryption-share-proof-v0",
        pollId,
        keySetupId: tallyKeySetup.id,
        memberId: input.memberId,
        shareHash,
        proof: input.proof
      });
    const shareArtifact = await artifactStore.write(
      withArtifactSchema("tally-decryption-share", {
        pollId,
        questionId: poll.questionId,
        communityId: poll.question.communityId,
        committeeId: tallyKeySetup.committeeId,
        keySetupId: tallyKeySetup.id,
        memberId: input.memberId,
        share: input.share,
        shareHash,
        proof: input.proof,
        proofHash,
        productionSlice: input.productionAttestation
          ? {
              schemaVersion: "production-slice-decryption-share-v1",
              ballotCommitmentsHash: input.productionAttestation.ballotCommitmentsHash,
              aggregateCountsHash: input.productionAttestation.aggregateCountsHash,
              signature: input.productionAttestation.signature
            }
          : null,
        submittedAt: Date.now()
      })
    );
    await storeArtifact(shareArtifact, "tally-decryption-share");
    const shareSubmittedEvent = prepareProtocolEvent({
      eventType: "TallyDecryptionShareSubmitted",
      subjectId: poll.questionId,
      actor: input.memberId,
      previousHash: tallyKeySetup.setupHash,
      newHash: shareArtifact.hash
    });
    try {
      const share = await prisma.$transaction(async (tx) => {
        const protocolEvent = await ingestProtocolEvent(tx, shareSubmittedEvent);
        const accepted = await tx.tallyDecryptionShare.create({
          data: {
            id: `tally-share-${nanoid(10)}`,
            pollId,
            questionId: poll.questionId,
            communityId: poll.question.communityId ?? "global",
            committeeId: tallyKeySetup.committeeId,
            keySetupId: tallyKeySetup.id,
            memberId: input.memberId,
            shareHash,
            proofHash,
            artifactHash: shareArtifact.hash,
            status: "Accepted"
          },
          select: TALLY_DECRYPTION_SHARE_PUBLIC_SELECT
        });
        await recordProtocolCommitments(protocolEvent, tx);
        return accepted;
      });
      const shares = [...poll.decryptionShares, share];
      return {
        share,
        shareArtifact,
        thresholdMet: tallyDecryptionShareThresholdMet(tallyKeySetup, shares)
      };
    } catch {
      return reply.code(409).send({ error: "Decryption share for this member already submitted" });
    }
  });

  app.post("/polls/:pollId/tally", async (request, reply) => {
    const { pollId } = request.params as { pollId: string };
    if (config.requireAuth) {
      return reply.code(501).send({ error: "Demo coordinator tally publication is disabled when authentication is required" });
    }
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        ballots: true,
        question: true,
        tallyKeySetup: { select: TALLY_KEY_SETUP_PUBLIC_SELECT },
        decryptionShares: { select: TALLY_DECRYPTION_SHARE_PUBLIC_SELECT, orderBy: { submittedAt: "asc" } }
      }
    });
    if (!poll) return reply.code(404).send({ error: "Poll not found" });
    if (poll.status !== "Closed") return reply.code(409).send({ error: "Poll must be closed before tallying" });
    if (!(await ensureCommunityProtocolWritable(poll.question.communityId, reply))) return;
    const payloads = poll.ballots.map((ballot) => JSON.parse(ballot.encryptedPayloadJson) as EncryptedBallotPayload);
    const answerSchema = getAnswerSchema(poll.question.answerSchemaId);
    const activeCommittee = poll.question.communityId ? await activeTallyCommitteeForCommunity(poll.question.communityId) : null;
    const tallyKeySetup = poll.tallyKeySetup;
    if (tallyKeySetup && !tallyDecryptionShareThresholdMet(tallyKeySetup, poll.decryptionShares)) {
      return reply.code(409).send({ error: "Threshold decryption share threshold has not been met" });
    }
    if (!config.demoMode) {
      return reply.code(501).send({
        error: tallyKeySetup
          ? "Non-demo mode requires threshold share decryption; coordinator fallback is disabled"
          : "Non-demo mode does not allow single-coordinator tallying"
      });
    }
    const tally = tallyEncryptedBallots(payloads, poll.tallyPrivateKeyPem, answerSchema);
    const aggregateCountsHash = hashJson(tally.counts);
    const individualResult = {
      resultMode: normalizePollResultMode(poll.question.resultMode),
      aggregate: tally.aggregate,
      counts: tally.counts,
      turnout: tally.turnout,
      invalidBallots: tally.invalidBallots
    };
    const individualResultHash = hashJson(individualResult);
    const communityBlockResult = await buildCommunityBlockResult({
      communityId: poll.question.communityId,
      resultMode: normalizePollResultMode(poll.question.resultMode),
      ballots: poll.ballots,
      answerSchema,
      tallyPrivateKeyPem: poll.tallyPrivateKeyPem,
      privacyThreshold: poll.privacyThreshold
    });
    const communityBlockResultHash = hashJson(communityBlockResult);
    const ballotCommitmentRoot = hashJson(poll.ballots.map((ballot) => ballot.ballotCommitment).sort());
    const shareArtifactChecks = await Promise.all(
      poll.decryptionShares.map(async (share) => {
        const artifact = await artifactStore.read<Record<string, unknown>>(share.artifactHash).catch(() => null);
        return {
          shareId: share.id,
          memberId: share.memberId,
          artifactHash: share.artifactHash,
          artifactPresent: Boolean(artifact),
          artifactKindMatches: artifact?.artifactKind === "tally-decryption-share",
          keySetupMatches: !tallyKeySetup || artifact?.keySetupId === tallyKeySetup.id,
          memberInKeySetup: !tallyKeySetup || tallyKeySetup.memberIds.includes(share.memberId),
          shareHashMatches: artifact?.shareHash === share.shareHash,
          proofHashMatches: artifact?.proofHash === share.proofHash
        };
      })
    );
    const publicationChecks = [
      { id: "aggregate-counts-hash", ok: aggregateCountsHash === hashJson(tally.counts) },
      { id: "ballot-commitment-root", ok: ballotCommitmentRoot === hashJson(poll.ballots.map((ballot) => ballot.ballotCommitment).sort()) },
      { id: "local-tally-proof", ok: tally.proofReference.startsWith("sha256:") },
      { id: "threshold-key-public-key-id", ok: !tallyKeySetup || tallyKeySetup.publicKeyId === poll.tallyPublicKeyId },
      { id: "threshold-key-public-key-hash", ok: !tallyKeySetup || tallyKeySetup.publicKeyHash === hashJson(poll.tallyPublicKeyPem) },
      { id: "decryption-share-threshold", ok: !tallyKeySetup || tallyDecryptionShareThresholdMet(tallyKeySetup, poll.decryptionShares) },
      ...shareArtifactChecks.flatMap((check) => [
        { id: `share-artifact-present:${check.shareId}`, ok: check.artifactPresent },
        { id: `share-artifact-kind:${check.shareId}`, ok: check.artifactKindMatches },
        { id: `share-key-setup:${check.shareId}`, ok: check.keySetupMatches },
        { id: `share-member:${check.shareId}`, ok: check.memberInKeySetup },
        { id: `share-hash:${check.shareId}`, ok: check.shareHashMatches },
        { id: `share-proof:${check.shareId}`, ok: check.proofHashMatches }
      ])
    ];
    if (!publicationChecks.every((check) => check.ok)) {
      return reply.code(409).send({ error: "Tally publication proof references are invalid", checks: publicationChecks });
    }
    const tallyPublicationProofArtifact = await artifactStore.write(
      withArtifactSchema("tally-publication-proof", {
        pollId,
        questionId: poll.questionId,
        keySetupId: tallyKeySetup?.id ?? null,
        committeeId: tallyKeySetup?.committeeId ?? null,
        localTallyProofHash: tally.proofReference,
        aggregateCountsHash,
        ballotCommitmentRoot,
        decryptionShareArtifactHashes: poll.decryptionShares.map((share) => share.artifactHash),
        decryptionShareProofHashes: poll.decryptionShares.map((share) => share.proofHash),
        validationChecks: publicationChecks,
        validationStatus: "Verified",
        generatedAt: Date.now()
      })
    );
    await storeArtifact(tallyPublicationProofArtifact, "tally-publication-proof");
    const privacyReport = {
      privacyThreshold: poll.privacyThreshold,
      passes: tally.turnout >= poll.privacyThreshold,
      communityBlockSignalsPublished: communityBlockResult.publishedSignalCount,
      communityBlockSignalsHidden: communityBlockResult.hiddenSignalCount,
      note: tallyKeySetup
        ? "Ballots were encrypted to a published threshold tally public key and enough decryption share records were submitted; local MVP tally still uses a coordinator fallback until share proof validation is implemented."
        : activeCommittee
          ? "Coordinator-based encrypted tally for local MVP with active tally committee metadata; threshold key shares are a later upgrade."
          : "Coordinator-based encrypted tally for local MVP; threshold committee is a later upgrade."
    };
    const privacyReportHash = hashJson(privacyReport);
    const productionSlicePublication = await buildProductionSliceResultPublication({
      artifactStore,
      poll,
      aggregate: tally.aggregate as Record<string, unknown>,
      counts: tally.counts,
      aggregateCountsHash,
      acceptedBallotCommitmentsHash: ballotCommitmentRoot,
      privacyReportHash,
      turnout: tally.turnout,
      invalidBallots: tally.invalidBallots,
      publishedAt: Date.now()
    });
    const resultArtifact = await artifactStore.write(
      withArtifactSchema("result-artifact", {
        pollId,
        questionId: poll.questionId,
        ...productionSlicePublication?.artifactFields,
        authorityLevel: poll.question.authorityLevel,
        adoptionPolicyId: poll.question.adoptionPolicyId,
        answerSchema,
        resultMode: normalizePollResultMode(poll.question.resultMode),
        individualResult,
        individualResultHash,
        communityBlockResult,
        communityBlockResultHash,
        aggregate: tally.aggregate,
        counts: tally.counts,
        turnout: tally.turnout,
        invalidBallots: tally.invalidBallots,
        proofReference: tallyPublicationProofArtifact.hash,
        localTallyProofHash: tally.proofReference,
        tallyPublicationProof: {
          hash: tallyPublicationProofArtifact.hash,
          validationStatus: "Verified",
          checkIds: publicationChecks.map((check) => check.id)
        },
        tallyMode: tallyKeySetup
          ? "threshold-public-key-with-share-records-and-coordinator-fallback"
          : activeCommittee
            ? "single-coordinator-with-active-committee-metadata"
            : "single-coordinator-local-demo",
        tallyCommittee: activeCommittee
          ? {
              id: activeCommittee.id,
              communityId: activeCommittee.communityId,
              threshold: activeCommittee.threshold,
              memberIds: activeCommittee.memberIds,
              metadataHash: activeCommittee.metadataHash,
              activationHash: activeCommittee.activationHash,
              status: activeCommittee.status
            }
          : null,
        tallyKeySetup: tallyKeySetup
          ? {
              id: tallyKeySetup.id,
              committeeId: tallyKeySetup.committeeId,
              publicKeyId: tallyKeySetup.publicKeyId,
              publicKeyHash: tallyKeySetup.publicKeyHash,
              setupHash: tallyKeySetup.setupHash,
              threshold: tallyKeySetup.threshold,
              memberIds: tallyKeySetup.memberIds,
              memberKeyCommitmentHashes: tallyKeySetup.memberKeyCommitmentHashes,
              status: tallyKeySetup.status
            }
          : null,
        decryptionShares: tallyKeySetup
          ? {
              threshold: tallyKeySetup.threshold,
              thresholdMet: true,
              shareIds: poll.decryptionShares.map((share) => share.id),
              memberIds: poll.decryptionShares.map((share) => share.memberId),
              shareHashes: poll.decryptionShares.map((share) => share.shareHash),
              proofHashes: poll.decryptionShares.map((share) => share.proofHash),
              artifactHashes: poll.decryptionShares.map((share) => share.artifactHash)
            }
          : null,
        privacyReport
      })
    );

    const resultPublishedEvent = prepareProtocolEvent({
      eventType: "ResultPublished",
      subjectId: poll.questionId,
      actor: "demo-coordinator",
      previousHash: null,
      newHash: resultArtifact.hash
    });
    const result = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, resultPublishedEvent);
      const published = await tx.result.upsert({
        where: { pollId },
        update: {
          resultArtifactHash: resultArtifact.hash,
          aggregateCountsHash,
          individualResultHash,
          communityBlockResultHash,
          tallyProofHash: productionSlicePublication?.tallyProofHash ?? tallyPublicationProofArtifact.hash,
          tallyPublicationProofHash: tallyPublicationProofArtifact.hash,
          turnout: tally.turnout,
          invalidBallots: tally.invalidBallots,
          privacyReportHash,
          finalStatus: "Published"
        },
        create: {
          id: `result-${nanoid(10)}`,
          pollId,
          resultArtifactHash: resultArtifact.hash,
          aggregateCountsHash,
          individualResultHash,
          communityBlockResultHash,
          tallyProofHash: productionSlicePublication?.tallyProofHash ?? tallyPublicationProofArtifact.hash,
          tallyPublicationProofHash: tallyPublicationProofArtifact.hash,
          turnout: tally.turnout,
          invalidBallots: tally.invalidBallots,
          privacyReportHash,
          finalStatus: "Published"
        }
      });
      await tx.poll.update({ where: { id: pollId }, data: { status: "ResultPublished" } });
      await tx.question.update({ where: { id: poll.questionId }, data: { status: "ResultPublished" } });
      await tx.artifact.upsert({
        where: { hash: resultArtifact.hash },
        update: {},
        create: { hash: resultArtifact.hash, path: resultArtifact.path, kind: "result-artifact" }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return published;
    });
    return { result, artifact: resultArtifact.value, tallyPublicationProofArtifact };
  });

  app.get("/polls/:pollId/results", async (request, reply) => {
    const { pollId } = request.params as { pollId: string };
    const { userId } = request.query as { userId?: string };
    const poll = await prisma.poll.findUnique({ where: { id: pollId }, include: { result: true, question: true } });
    if (!poll?.result) return reply.code(404).send({ error: "Result not found" });
    if (!(await canReadQuestion(poll.question, userId))) {
      return reply.code(403).send({ error: "Follow or join this community to view this poll result" });
    }
    const artifact = await artifactStore.read(poll.result.resultArtifactHash);
    return { result: poll.result, artifact, authorityLevel: poll.question.authorityLevel };
  });

  app.post("/polls/:pollId/results/challenges", async (request, reply) => {
    const { pollId } = request.params as { pollId: string };
    const input = CreateResultChallengeRequestSchema.parse(request.body ?? {});
    if (!(await requireAuthenticatedActor(request, reply, input.challenger))) return;
    const [poll, challenger] = await Promise.all([
      prisma.poll.findUnique({ where: { id: pollId }, include: { result: true, question: true } }),
      prisma.userAccount.findUnique({ where: { id: input.challenger } })
    ]);
    if (!poll?.result) return reply.code(404).send({ error: "Published result not found" });
    if (!challenger) return reply.code(404).send({ error: "Challenger account not found" });
    if (!(await canReadQuestion(poll.question, input.challenger))) {
      return reply.code(403).send({ error: "Follow or join this community before challenging its result" });
    }
    if (poll.result.finalStatus === "Finalized") {
      return reply.code(409).send({ error: "Finalized results cannot be challenged in the MVP" });
    }
    if (!(await ensureCommunityProtocolWritable(poll.question.communityId, reply))) return;
    const governance = await resolveGovernanceParameters(poll.question.communityId);

    const evidenceArtifact = await artifactStore.write(
      withArtifactSchema("result-challenge-evidence", {
        pollId,
        reasonCode: input.reasonCode,
        evidence: input.evidence,
        challengedBy: input.challenger
      })
    );
    await storeArtifact(evidenceArtifact, "result-challenge-evidence");
    const challengeId = `result-challenge-${nanoid(10)}`;
    const challengeBondId = `bond-${nanoid(10)}`;
    const resultChallengedEvent = prepareProtocolEvent({
      eventType: "ResultChallenged",
      subjectId: poll.questionId,
      actor: input.challenger,
      previousHash: poll.result.resultArtifactHash,
      newHash: evidenceArtifact.hash
    });
    const challengeBondEscrowedEvent = prepareProtocolEvent({
      eventType: "BondEscrowed",
      subjectId: challengeBondId,
      actor: input.challenger,
      previousHash: null,
      newHash: hashJson({ pollId, challengeId, amountPc: governance.challengeBondPc })
    });
    const resultChallenge = await prisma.$transaction(async (tx) => {
      const protocolEvents = [
        await ingestProtocolEvent(tx, resultChallengedEvent),
        await ingestProtocolEvent(tx, challengeBondEscrowedEvent)
      ];
      const created = await tx.resultChallenge.create({
        data: {
          id: challengeId,
          pollId,
          resultId: poll.result!.id,
          reasonCode: input.reasonCode,
          evidenceHash: evidenceArtifact.hash,
          challenger: input.challenger,
          challengeBondId,
          jurorPoolId: "juror-pool-demo"
        }
      });
      await tx.bond.create({
        data: {
          id: challengeBondId,
          owner: input.challenger,
          questionId: poll.questionId,
          resultChallengeId: challengeId,
          amountPc: governance.challengeBondPc,
          bondType: "Challenge"
        }
      });
      await tx.result.update({ where: { id: poll.result!.id }, data: { finalStatus: "Challenged" } });
      await tx.question.update({ where: { id: poll.questionId }, data: { status: "ResultChallenged" } });
      for (const protocolEvent of protocolEvents) await recordProtocolCommitments(protocolEvent, tx);
      return created;
    });
    return { resultChallenge, evidenceArtifact, stakedPc: String(governance.challengeBondPc) };
  });

  app.post("/polls/:pollId/results/challenges/:challengeId/ruling", async (request, reply) => {
    const { pollId, challengeId } = request.params as { pollId: string; challengeId: string };
    const input = ResultChallengeRulingRequestSchema.parse(request.body ?? {});
    const [juror, resultChallenge] = await Promise.all([
      prisma.userAccount.findUnique({ where: { id: input.juror } }),
      prisma.resultChallenge.findUnique({
        where: { id: challengeId },
        include: { result: true, poll: { include: { question: true } } }
      })
    ]);
    if (!juror) return reply.code(404).send({ error: "Juror account not found" });
    if (!resultChallenge || resultChallenge.pollId !== pollId) return reply.code(404).send({ error: "Result challenge not found" });
    if (resultChallenge.challenger === input.juror) return reply.code(403).send({ error: "Challenger cannot rule on their own result challenge" });
    if (resultChallenge.poll.question.proposer === input.juror) return reply.code(403).send({ error: "Proposer cannot rule on their own result challenge" });
    const jurorCheck = await requireCommunityCurator(resultChallenge.poll.question.communityId, input.juror, reply, request);
    if (!jurorCheck) return;
    if (!(await ensureCommunityProtocolWritable(resultChallenge.poll.question.communityId, reply))) return;
    const jurorAssignment = await ensureClearJurorAssignment(resultChallengeJurorTarget(resultChallenge), input.juror, input.juror, input.conflictDisclosure, artifactStore, reply);
    if (!jurorAssignment) return;
    if (resultChallenge.ruling !== "Pending") return reply.code(409).send({ error: "Result challenge already ruled" });
    const governance = await resolveGovernanceParameters(resultChallenge.poll.question.communityId);

    const resolutionArtifact = await artifactStore.write(
      withArtifactSchema("result-challenge-resolution", {
        challengeId,
        pollId,
        ruling: input.ruling,
        juror: input.juror,
        jurorAssignmentId: jurorAssignment.id,
        conflictDisclosureHash: jurorAssignment.conflictDisclosureHash,
        resolution: input.resolution
      })
    );
    await storeArtifact(resolutionArtifact, "result-challenge-resolution");

    let correctedArtifact: { hash: string; path: string; value: unknown } | null = null;
    if (input.ruling !== "Rejected") {
      const previousArtifact = await artifactStore.read(resultChallenge.result.resultArtifactHash);
      correctedArtifact = await artifactStore.write(
        withArtifactSchema("result-artifact-correction", {
          previousArtifactHash: resultChallenge.result.resultArtifactHash,
          correctionReason: input.resolution,
          correctionChallengeId: challengeId,
          correctedAt: Date.now(),
          artifact: previousArtifact
        })
      );
      await storeArtifact(correctedArtifact, "result-artifact-correction");
    }

    const resultCorrectedEvent =
      input.ruling !== "Rejected"
        ? prepareProtocolEvent({
            eventType: "ResultCorrected",
            subjectId: resultChallenge.poll.questionId,
            actor: input.juror,
            previousHash: resultChallenge.result.resultArtifactHash,
            newHash: correctedArtifact!.hash
          })
        : null;
    const resultChallengeRuledEvent = prepareProtocolEvent({
      eventType: "ResultChallengeRuled",
      subjectId: resultChallenge.poll.questionId,
      actor: input.juror,
      previousHash: resultChallenge.evidenceHash,
      newHash: resolutionArtifact.hash
    });
    const challengeBondSettledEvent = prepareProtocolEvent({
      eventType: "BondSettled",
      subjectId: resultChallenge.challengeBondId,
      actor: input.juror,
      previousHash: null,
      newHash: hashJson({ challengeId, ruling: input.ruling })
    });
    const updatedChallenge = await prisma.$transaction(async (tx) => {
      const protocolEvents = [
        ...(resultCorrectedEvent ? [await ingestProtocolEvent(tx, resultCorrectedEvent)] : []),
        await ingestProtocolEvent(tx, resultChallengeRuledEvent),
        await ingestProtocolEvent(tx, challengeBondSettledEvent)
      ];
      const ruled = await tx.resultChallenge.update({
        where: { id: challengeId },
        data: { ruling: input.ruling, resolutionHash: resolutionArtifact.hash }
      });

      if (input.ruling === "Rejected") {
        await tx.result.update({ where: { id: resultChallenge.resultId }, data: { finalStatus: "Published" } });
        await tx.question.update({ where: { id: resultChallenge.poll.questionId }, data: { status: "ResultPublished" } });
        await tx.bond.updateMany({
          where: { id: resultChallenge.challengeBondId },
          data: {
            status: "Slashed",
            slashedPc: governance.challengeBondPc,
            treasuryPc: governance.protocolFeePc,
            settledAt: new Date()
          }
        });
      } else {
        await tx.result.update({
          where: { id: resultChallenge.resultId },
          data: {
            resultArtifactHash: correctedArtifact!.hash,
            finalStatus: "Corrected"
          }
        });
        await tx.question.update({ where: { id: resultChallenge.poll.questionId }, data: { status: "Corrected" } });
        await tx.bond.updateMany({
          where: { id: resultChallenge.challengeBondId },
          data: {
            status: "Refunded",
            refundedPc: governance.challengeBondPc,
            rewardPc: governance.successfulChallengeRewardPc,
            settledAt: new Date()
          }
        });
      }
      for (const protocolEvent of protocolEvents) await recordProtocolCommitments(protocolEvent, tx);
      return ruled;
    });

    if (input.ruling !== "Rejected") {
      await addReputation(resultChallenge.challenger, "SuccessfulChallenge", governance.successfulChallengeReputation, challengeId);
    }
    await addReputation(input.juror, "JurorService", governance.jurorRewardWeight, challengeId);
    return { resultChallenge: updatedChallenge, resolutionArtifact, correctedArtifact };
  });

  app.post("/polls/:pollId/results/challenges/:challengeId/juror-selection", async (request, reply) => {
    const { pollId, challengeId } = request.params as { pollId: string; challengeId: string };
    const input = SelectJurorRequestSchema.parse(request.body ?? {});
    const resultChallenge = await prisma.resultChallenge.findUnique({
      where: { id: challengeId },
      include: { poll: { include: { question: true } }, result: true }
    });
    if (!resultChallenge || resultChallenge.pollId !== pollId) return reply.code(404).send({ error: "Result challenge not found" });
    const selectedByCheck = await requireCommunityCurator(resultChallenge.poll.question.communityId, input.selectedBy, reply, request);
    if (!selectedByCheck) return;
    const jurorCheck = await requireCommunityCurator(resultChallenge.poll.question.communityId, input.jurorId, reply);
    if (!jurorCheck) return;
    if (!(await ensureCommunityProtocolWritable(resultChallenge.poll.question.communityId, reply))) return;
    const target = resultChallengeJurorTarget(resultChallenge);
    if (target.ineligibleActors.includes(input.jurorId)) return reply.code(403).send({ error: "Juror has a direct conflict with this target" });
    const { assignment, selectionArtifact } = await createJurorAssignment(target, input.jurorId, input.selectedBy, input.selectionReason, artifactStore);
    return { assignment: await hydrateJurorAssignment(assignment, artifactStore), selectionArtifact };
  });

  app.post("/polls/:pollId/results/challenges/:challengeId/appeals", async (request, reply) => {
    const { pollId, challengeId } = request.params as { pollId: string; challengeId: string };
    const input = CreateChallengeAppealRequestSchema.parse(request.body ?? {});
    if (!(await requireAuthenticatedActor(request, reply, input.appellantId))) return;
    const [appellant, resultChallenge] = await Promise.all([
      prisma.userAccount.findUnique({ where: { id: input.appellantId } }),
      prisma.resultChallenge.findUnique({
        where: { id: challengeId },
        include: { poll: { include: { question: true } }, result: true }
      })
    ]);
    if (!appellant) return reply.code(404).send({ error: "Appellant account not found" });
    if (!resultChallenge || resultChallenge.pollId !== pollId) return reply.code(404).send({ error: "Result challenge not found" });
    if (!(await canReadQuestion(resultChallenge.poll.question, input.appellantId))) {
      return reply.code(403).send({ error: "Follow or join this community before appealing a result challenge" });
    }
    if (!(await ensureCommunityProtocolWritable(resultChallenge.poll.question.communityId, reply))) return;
    if (resultChallenge.ruling === "Pending") return reply.code(409).send({ error: "Only ruled result challenges can be appealed" });
    const allowedAppellants = eligibleResultChallengeAppellants(resultChallenge);
    if (!allowedAppellants.includes(input.appellantId)) {
      return reply.code(403).send({ error: "Only a party affected by the ruling can appeal this result challenge" });
    }
    const existing = await prisma.challengeAppeal.findUnique({
      where: { resultChallengeId_appellantId: { resultChallengeId: challengeId, appellantId: input.appellantId } }
    });
    if (existing) return reply.code(409).send({ error: "This appellant already appealed this result challenge" });

    const questionId = resultChallenge.poll.questionId;
    const governance = await resolveGovernanceParameters(resultChallenge.poll.question.communityId);
    const appealArtifact = await artifactStore.write(
      withArtifactSchema("challenge-appeal", {
        targetType: "ResultChallenge",
        questionId,
        pollId,
        resultId: resultChallenge.resultId,
        resultChallengeId: challengeId,
        appealedRuling: resultChallenge.ruling,
        appellantId: input.appellantId,
        appeal: input.appeal
      })
    );
    await storeArtifact(appealArtifact, "challenge-appeal");
    const appealId = `challenge-appeal-${nanoid(10)}`;
    const appealBondId = `bond-${nanoid(10)}`;
    const resultChallengeAppealedEvent = prepareProtocolEvent({
      eventType: "ResultChallengeAppealed",
      subjectId: questionId,
      actor: input.appellantId,
      previousHash: resultChallenge.resolutionHash ?? resultChallenge.evidenceHash,
      newHash: appealArtifact.hash
    });
    const appealBondEscrowedEvent = prepareProtocolEvent({
      eventType: "BondEscrowed",
      subjectId: appealBondId,
      actor: input.appellantId,
      previousHash: null,
      newHash: hashJson({ pollId, challengeId, appealId, amountPc: governance.appealBondPc })
    });
    const appeal = await prisma.$transaction(async (tx) => {
      const protocolEvents = [
        await ingestProtocolEvent(tx, resultChallengeAppealedEvent),
        await ingestProtocolEvent(tx, appealBondEscrowedEvent)
      ];
      const created = await tx.challengeAppeal.create({
        data: {
          id: appealId,
          questionId,
          targetType: "ResultChallenge",
          resultChallengeId: challengeId,
          appellantId: input.appellantId,
          appealBondId,
          appealedRuling: normalizeChallengeRuling(resultChallenge.ruling),
          appealHash: appealArtifact.hash
        }
      });
      await tx.bond.create({
        data: {
          id: appealBondId,
          owner: input.appellantId,
          questionId,
          resultChallengeId: challengeId,
          challengeAppealId: appealId,
          amountPc: governance.appealBondPc,
          bondType: "Appeal"
        }
      });
      for (const protocolEvent of protocolEvents) await recordProtocolCommitments(protocolEvent, tx);
      return created;
    });
    return { appeal: toChallengeAppealView(appeal, input.appeal, null), appealArtifact, stakedPc: String(governance.appealBondPc) };
  });

  app.post("/challenge-appeals/:appealId/juror-selection", async (request, reply) => {
    const { appealId } = request.params as { appealId: string };
    const input = SelectJurorRequestSchema.parse(request.body ?? {});
    const appeal = await prisma.challengeAppeal.findUnique({
      where: { id: appealId },
      include: {
        question: true,
        challenge: { include: { question: true } },
        resultChallenge: { include: { poll: { include: { question: true } }, result: true } }
      }
    });
    if (!appeal) return reply.code(404).send({ error: "Challenge appeal not found" });
    const selectedByCheck = await requireCommunityCurator(appeal.question.communityId, input.selectedBy, reply, request);
    if (!selectedByCheck) return;
    const jurorCheck = await requireCommunityCurator(appeal.question.communityId, input.jurorId, reply);
    if (!jurorCheck) return;
    if (!(await ensureCommunityProtocolWritable(appeal.question.communityId, reply))) return;
    const target = challengeAppealJurorTarget(appeal);
    if (target.ineligibleActors.includes(input.jurorId)) return reply.code(403).send({ error: "Juror has a direct conflict with this target" });
    const { assignment, selectionArtifact } = await createJurorAssignment(target, input.jurorId, input.selectedBy, input.selectionReason, artifactStore);
    return { assignment: await hydrateJurorAssignment(assignment, artifactStore), selectionArtifact };
  });

  app.post("/juror-assignments/:assignmentId/conflict-disclosure", async (request, reply) => {
    const { assignmentId } = request.params as { assignmentId: string };
    const input = DiscloseJurorConflictRequestSchema.parse(request.body ?? {});
    if (!(await requireAuthenticatedActor(request, reply, input.jurorId))) return;
    const assignment = await prisma.jurorAssignment.findUnique({ where: { id: assignmentId }, include: { question: true } });
    if (!assignment) return reply.code(404).send({ error: "Juror assignment not found" });
    if (assignment.jurorId !== input.jurorId) return reply.code(403).send({ error: "Only the selected juror can disclose conflicts for this assignment" });
    if (!(await canReadQuestion(assignment.question, input.jurorId))) {
      return reply.code(403).send({ error: "Follow or join this community before disclosing a juror conflict" });
    }
    if (!(await ensureCommunityProtocolWritable(assignment.question.communityId, reply))) return;
    const { updated, disclosureArtifact } = await discloseJurorConflict(assignment, input.hasConflict, input.disclosure, artifactStore);
    return { assignment: await hydrateJurorAssignment(updated, artifactStore), disclosureArtifact };
  });

  app.post("/challenge-appeals/:appealId/ruling", async (request, reply) => {
    const { appealId } = request.params as { appealId: string };
    const input = ResolveChallengeAppealRequestSchema.parse(request.body ?? {});
    const [juror, appeal] = await Promise.all([
      prisma.userAccount.findUnique({ where: { id: input.juror } }),
      prisma.challengeAppeal.findUnique({
        where: { id: appealId },
        include: {
          question: { include: { poll: { include: { result: true } } } },
          challenge: { include: { question: true } },
          resultChallenge: { include: { poll: { include: { question: true } }, result: true } }
        }
      })
    ]);
    if (!juror) return reply.code(404).send({ error: "Juror account not found" });
    if (!appeal) return reply.code(404).send({ error: "Challenge appeal not found" });
    if (appeal.status !== "Pending") return reply.code(409).send({ error: "Challenge appeal is already resolved" });
    const jurorCheck = await requireCommunityCurator(appeal.question.communityId, input.juror, reply, request);
    if (!jurorCheck) return;
    if (!(await ensureCommunityProtocolWritable(appeal.question.communityId, reply))) return;
    if (challengeAppealConflictActors(appeal).includes(input.juror)) {
      return reply.code(403).send({ error: "Appeal juror cannot be a party to this challenge appeal" });
    }
    const jurorAssignment = await ensureClearJurorAssignment(challengeAppealJurorTarget(appeal), input.juror, input.juror, input.conflictDisclosure, artifactStore, reply);
    if (!jurorAssignment) return;
    const governance = await resolveGovernanceParameters(appeal.question.communityId);

    const resolutionArtifact = await artifactStore.write(
      withArtifactSchema("challenge-appeal-resolution", {
        appealId,
        targetType: appeal.targetType,
        questionId: appeal.questionId,
        challengeId: appeal.challengeId,
        resultChallengeId: appeal.resultChallengeId,
        appealedRuling: appeal.appealedRuling,
        ruling: input.ruling,
        juror: input.juror,
        jurorAssignmentId: jurorAssignment.id,
        conflictDisclosureHash: jurorAssignment.conflictDisclosureHash,
        resolution: input.resolution
      })
    );
    await storeArtifact(resolutionArtifact, "challenge-appeal-resolution");

    let correctedArtifact: { hash: string; path: string; value: unknown } | null = null;
    let restoredResultArtifactHash: string | null = null;
    if (input.ruling === "Overturned" && appeal.targetType === "ResultChallenge" && appeal.resultChallenge) {
      if (appeal.appealedRuling === "Rejected") {
        const previousArtifact = await artifactStore.read(appeal.resultChallenge.result.resultArtifactHash);
        correctedArtifact = await artifactStore.write(
          withArtifactSchema("result-artifact-correction", {
            previousArtifactHash: appeal.resultChallenge.result.resultArtifactHash,
            correctionReason: input.resolution,
            correctionAppealId: appealId,
            correctedAt: Date.now(),
            artifact: previousArtifact
          })
        );
        await storeArtifact(correctedArtifact, "result-artifact-correction");
      } else {
        const currentArtifact = await artifactStore
          .read<{ previousArtifactHash?: string }>(appeal.resultChallenge.result.resultArtifactHash)
          .catch((): { previousArtifactHash?: string } | null => null);
        restoredResultArtifactHash = typeof currentArtifact?.previousArtifactHash === "string" ? currentArtifact.previousArtifactHash : null;
      }
    }

    const appealResultCorrectedEvent = correctedArtifact
      ? prepareProtocolEvent({
          eventType: "ResultCorrected",
          subjectId: appeal.questionId,
          actor: input.juror,
          previousHash: appeal.resultChallenge!.result.resultArtifactHash,
          newHash: correctedArtifact.hash
        })
      : null;
    const challengeAppealRuledEvent = prepareProtocolEvent({
      eventType: "ChallengeAppealRuled",
      subjectId: appeal.questionId,
      actor: input.juror,
      previousHash: appeal.appealHash,
      newHash: resolutionArtifact.hash
    });
    const appealBondSettledEvent = prepareProtocolEvent({
      eventType: "BondSettled",
      subjectId: appeal.appealBondId,
      actor: input.juror,
      previousHash: null,
      newHash: hashJson({ appealId, ruling: input.ruling })
    });
    const resolvedAppeal = await prisma.$transaction(async (tx) => {
      const protocolEvents = [
        ...(appealResultCorrectedEvent ? [await ingestProtocolEvent(tx, appealResultCorrectedEvent)] : []),
        await ingestProtocolEvent(tx, challengeAppealRuledEvent),
        await ingestProtocolEvent(tx, appealBondSettledEvent)
      ];
      const updated = await tx.challengeAppeal.update({
        where: { id: appealId },
        data: {
          status: input.ruling,
          resolutionHash: resolutionArtifact.hash,
          resolvedBy: input.juror,
          resolvedAt: new Date()
        }
      });

      if (input.ruling === "Overturned") {
        if (appeal.targetType === "QuestionChallenge" && appeal.challenge) {
          await tx.question.update({
            where: { id: appeal.questionId },
            data: { status: overturnedQuestionChallengeStatus(appeal.appealedRuling) }
          });
        }
        if (appeal.targetType === "ResultChallenge" && appeal.resultChallenge) {
          const overturnsRejectedResultChallenge = appeal.appealedRuling === "Rejected";
          await tx.result.update({
            where: { id: appeal.resultChallenge.resultId },
            data: {
              resultArtifactHash: overturnsRejectedResultChallenge ? correctedArtifact!.hash : restoredResultArtifactHash ?? appeal.resultChallenge.result.resultArtifactHash,
              finalStatus: overturnsRejectedResultChallenge ? "Corrected" : "Published"
            }
          });
          await tx.question.update({
            where: { id: appeal.questionId },
            data: { status: overturnsRejectedResultChallenge ? "Corrected" : "ResultPublished" }
          });
        }
      }

      await tx.bond.updateMany({
        where: { id: appeal.appealBondId, status: "Escrowed" },
        data:
          input.ruling === "Overturned"
            ? { status: "Refunded", refundedPc: governance.appealBondPc, settledAt: new Date() }
            : { status: "Slashed", slashedPc: governance.appealBondPc, treasuryPc: governance.protocolFeePc, settledAt: new Date() }
      });
      for (const protocolEvent of protocolEvents) await recordProtocolCommitments(protocolEvent, tx);
      return updated;
    });

    if (input.ruling === "Overturned") await addReputation(appeal.appellantId, "SuccessfulAppeal", governance.acceptedAmendmentReputation, appealId);
    await addReputation(input.juror, "JurorService", governance.jurorRewardWeight, appealId);
    return { appeal: toChallengeAppealView(resolvedAppeal, await readChallengeAppealText(appeal.appealHash, artifactStore), input.resolution), resolutionArtifact, correctedArtifact };
  });

  app.post("/polls/:pollId/finalize", async (request, reply) => {
    const { pollId } = request.params as { pollId: string };
    const input = FinalizeResultRequestSchema.parse(request.body ?? {});
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: { result: true, question: true, resultChallenges: { include: { appeals: true } } }
    });
    if (!poll?.result) return reply.code(404).send({ error: "Published result not found" });
    const curatorCheck = await requireCommunityCurator(poll.question.communityId, input.curator, reply, request);
    if (!curatorCheck) return;
    if (!(await ensureCommunityProtocolWritable(poll.question.communityId, reply))) return;
    if (poll.resultChallenges.some((challenge) => challenge.ruling === "Pending")) {
      return reply.code(409).send({ error: "Resolve pending result challenges before finalization" });
    }
    if (poll.resultChallenges.some((challenge) => challenge.appeals.some((appeal) => appeal.status === "Pending"))) {
      return reply.code(409).send({ error: "Resolve pending result challenge appeals before finalization" });
    }
    if (!["Published", "Corrected"].includes(poll.result.finalStatus)) {
      return reply.code(409).send({ error: "Result is not ready for finalization" });
    }
    const resultFinalizedEvent = prepareProtocolEvent({
      eventType: "ResultFinalized",
      subjectId: poll.questionId,
      actor: input.curator,
      previousHash: poll.result.resultArtifactHash,
      newHash: hashJson({ pollId, finalStatus: "Finalized" })
    });
    const finalized = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, resultFinalizedEvent);
      const result = await tx.result.update({ where: { id: poll.result!.id }, data: { finalStatus: "Finalized" } });
      const question = await tx.question.update({ where: { id: poll.questionId }, data: { status: "Finalized" } });
      await recordProtocolCommitments(protocolEvent, tx);
      return { result, question };
    });
    return finalized;
  });

  app.post("/questions/:questionId/archive", async (request, reply) => {
    const { questionId } = request.params as { questionId: string };
    const input = ArchiveQuestionRequestSchema.parse(request.body ?? {});
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        poll: { include: { result: true, ballots: true, decryptionShares: true, tallyKeySetup: true, resultChallenges: true } },
        challenges: true,
        challengeAppeals: { orderBy: { createdAt: "asc" } },
        jurorAssignments: { orderBy: { createdAt: "asc" } },
        discussionPosts: true,
        archiveRecord: true,
        community: true
      }
    });
    if (!question) return reply.code(404).send({ error: "Question not found" });
    const curatorCheck = await requireCommunityCurator(question.communityId, input.curator, reply, request);
    if (!curatorCheck) return;
    if (!(await ensureCommunityProtocolWritable(question.communityId, reply))) return;
    if (question.archiveRecord) {
      const artifact = await artifactStore.read(question.archiveRecord.archiveHash);
      return { archiveRecord: question.archiveRecord, artifact };
    }
    if (question.poll?.result?.finalStatus !== "Finalized" || question.status !== "Finalized") {
      return reply.code(409).send({ error: "Finalize the result before archiving this question" });
    }

    const [events, bonds, bodyArtifact, sponsorArtifact, resultArtifact, discussion, challengeAppeals, jurorAssignments] = await Promise.all([
      prisma.registryEvent.findMany({ where: { subjectId: questionId }, orderBy: REGISTRY_EVENT_ORDER }),
      prisma.bond.findMany({ where: { questionId }, orderBy: { createdAt: "asc" } }),
      artifactStore.read(question.bodyHash).catch(() => null),
      question.sponsorDisclosureHash ? artifactStore.read(question.sponsorDisclosureHash).catch(() => null) : Promise.resolve(null),
      artifactStore.read(question.poll.result.resultArtifactHash).catch(() => null),
      hydrateDiscussionPosts(question.discussionPosts, artifactStore),
      hydrateChallengeAppeals(question.challengeAppeals, artifactStore),
      Promise.all(question.jurorAssignments.map((assignment) => hydrateJurorAssignment(assignment, artifactStore)))
    ]);
    const artifactManifestReferences = [
      { kind: "question-body", hash: question.bodyHash, role: "body" },
      ...(question.sponsorDisclosureHash ? [{ kind: "sponsor-disclosure", hash: question.sponsorDisclosureHash, role: "sponsor" }] : []),
      ...(question.poll.tallyKeySetup?.setupHash ? [{ kind: "tally-key-setup", hash: question.poll.tallyKeySetup.setupHash, role: "tally-key-setup" }] : []),
      ...question.poll.ballots.flatMap((ballot) =>
        ballot.eligibilityProofArtifactHash
          ? [{ kind: "production-slice-eligibility-proof", hash: ballot.eligibilityProofArtifactHash, role: "eligibility-proof" }]
          : []
      ),
      ...question.poll.decryptionShares.map((share) => ({ kind: "tally-decryption-share", hash: share.artifactHash, role: "tally-decryption-share" })),
      { kind: "result-artifact", hash: question.poll.result.resultArtifactHash, role: "result" },
      ...question.challenges.map((challenge) => ({ kind: "challenge-evidence-or-resolution", hash: challenge.evidenceHash, role: "question-challenge" })),
      ...question.challenges.flatMap((challenge) =>
        challenge.resolutionHash ? [{ kind: "challenge-evidence-or-resolution", hash: challenge.resolutionHash, role: "question-challenge-resolution" }] : []
      ),
      ...question.poll.resultChallenges.map((challenge) => ({ kind: "result-challenge-evidence-or-resolution", hash: challenge.evidenceHash, role: "result-challenge" })),
      ...question.poll.resultChallenges.flatMap((challenge) =>
        challenge.resolutionHash ? [{ kind: "result-challenge-evidence-or-resolution", hash: challenge.resolutionHash, role: "result-challenge-resolution" }] : []
      ),
      ...question.challengeAppeals.map((appeal) => ({ kind: "challenge-appeal", hash: appeal.appealHash, role: "challenge-appeal" })),
      ...question.challengeAppeals.flatMap((appeal) =>
        appeal.resolutionHash ? [{ kind: "challenge-appeal-resolution", hash: appeal.resolutionHash, role: "challenge-appeal-resolution" }] : []
      ),
      ...question.jurorAssignments.map((assignment) => ({ kind: "juror-selection", hash: assignment.selectionHash, role: "juror-selection" })),
      ...question.jurorAssignments.flatMap((assignment) =>
        assignment.conflictDisclosureHash
          ? [{ kind: "juror-conflict-disclosure", hash: assignment.conflictDisclosureHash, role: "juror-conflict-disclosure" }]
          : []
      ),
      ...question.discussionPosts.map((post) => ({ kind: "discussion-post", hash: post.bodyHash, role: "discussion" }))
    ];
    const artifactManifest = buildArtifactManifest(artifactManifestReferences);
    const archive = withArtifactSchema("question-archive", {
      question: {
        id: question.id,
        version: question.version,
        title: question.title,
        status: "Archived",
        bodyHash: question.bodyHash,
        answerSchemaId: question.answerSchemaId,
        credentialSchemaId: question.credentialSchemaId,
        communityId: question.communityId,
        topicIds: question.topicIds,
        geoScope: question.geoScope,
        sponsorDisclosureHash: question.sponsorDisclosureHash,
        methodologyLabel: question.methodologyLabel,
        authorityLevel: question.authorityLevel,
        adoptionPolicyId: question.adoptionPolicyId
      },
      bodyArtifact,
      sponsorArtifact,
      events,
      challenges: question.challenges,
      resultChallenges: question.poll.resultChallenges,
      challengeAppeals,
      jurorAssignments,
      discussion,
      bonds,
      poll: question.poll
        ? {
            id: question.poll.id,
            status: question.poll.status,
            credentialSchemaId: question.poll.credentialSchemaId,
            privacyThreshold: question.poll.privacyThreshold,
            ballotCommitmentRoot: hashJson(question.poll.ballots.map((ballot) => ballot.ballotCommitment).sort()),
            nullifierRoot: hashJson(question.poll.ballots.map((ballot) => ballot.nullifier).sort())
          }
        : null,
      result: question.poll.result,
      resultArtifact,
      artifactManifest,
      artifactManifestHash: hashArtifactManifest(artifactManifest.references),
      archivedAt: Date.now()
    });
    const archiveArtifact = await artifactStore.write(archive);
    await storeArtifact(archiveArtifact, "question-archive");
    const questionArchivedEvent = prepareProtocolEvent({
      eventType: "QuestionArchived",
      subjectId: questionId,
      actor: input.curator,
      previousHash: question.poll.result.resultArtifactHash,
      newHash: archiveArtifact.hash
    });
    const archiveRecord = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, questionArchivedEvent);
      await tx.question.update({ where: { id: questionId }, data: { status: "Archived" } });
      const created = await tx.archiveRecord.create({
        data: {
          id: `archive-${nanoid(10)}`,
          questionId,
          archiveHash: archiveArtifact.hash,
          archivedBy: input.curator
        }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return created;
    });
    return { archiveRecord, artifact: archiveArtifact.value };
  });

  app.get("/questions/:questionId/archive", async (request, reply) => {
    const { questionId } = request.params as { questionId: string };
    const { userId } = request.query as { userId?: string };
    const question = await prisma.question.findUnique({ where: { id: questionId }, select: { id: true, communityId: true, proposer: true, audience: true } });
    if (!question) return reply.code(404).send({ error: "Question not found" });
    if (!(await canReadQuestion(question, userId))) {
      return reply.code(403).send({ error: "Follow or join this community to view this archive" });
    }
    const archiveRecord = await prisma.archiveRecord.findUnique({ where: { questionId } });
    if (!archiveRecord) return reply.code(404).send({ error: "Archive not found" });
    const artifact = await artifactStore.read(archiveRecord.archiveHash);
    return { archiveRecord, artifact };
  });

  app.get("/questions/:questionId/archive/export", async (request, reply) => {
    const { questionId } = request.params as { questionId: string };
    const { userId } = request.query as { userId?: string };
    const question = await prisma.question.findUnique({ where: { id: questionId }, select: { id: true, communityId: true, proposer: true, audience: true } });
    if (!question) return reply.code(404).send({ error: "Question not found" });
    if (!(await canReadQuestion(question, userId))) {
      return reply.code(403).send({ error: "Follow or join this community to export this archive" });
    }
    const archiveRecord = await prisma.archiveRecord.findUnique({ where: { questionId } });
    if (!archiveRecord) return reply.code(404).send({ error: "Archive not found" });

    const artifact = await artifactStore.read<{ artifactManifest?: ArtifactManifest }>(archiveRecord.archiveHash);
    if (!artifact.artifactManifest) return reply.code(409).send({ error: "Archive does not include an artifact manifest" });

    const bundle = await artifactStore.buildExportBundle(artifact.artifactManifest, {
      kind: "question-archive",
      hash: archiveRecord.archiveHash,
      role: "archive"
    });
    return { protocol: buildArchiveExportProtocol(questionId, question.communityId, archiveRecord, bundle), archiveRecord, bundle };
  });

  app.get("/questions/:questionId/production-slice/export", async (request, reply) => {
    const { questionId } = request.params as { questionId: string };
    const { userId } = request.query as { userId?: string };
    const question = await prisma.question.findUnique({ where: { id: questionId }, select: { id: true, communityId: true, proposer: true, audience: true } });
    if (!question) return reply.code(404).send({ error: "Question not found" });
    if (!(await canReadQuestion(question, userId))) {
      return reply.code(403).send({ error: "Follow or join this community to export this production slice" });
    }
    const built = await buildProductionSliceVerificationInput(questionId, artifactStore);
    if (!built.ok) {
      return reply.code(409).send({
        protocol: "popular-consensus",
        schemaVersion: "production-slice-export-v1",
        status: "Unsupported",
        questionId,
        reasons: built.reasons
      });
    }
    const exported = createProductionSliceExport(built.input);
    if (exported.status !== "Verified") {
      return reply.code(409).send({
        protocol: exported.protocol,
        schemaVersion: exported.schemaVersion,
        status: exported.status,
        questionId,
        reasons: exported.report.checks.filter((check) => !check.ok).map((check) => check.id),
        report: exported.report
      });
    }
    return exported;
  });

  app.get("/communities/:communityId/export", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const { userId } = request.query as { userId?: string };
    const community = await prisma.community.findUnique({
      where: { id: communityId },
      include: { memberships: { orderBy: { createdAt: "asc" } }, frontendConfig: true }
    });
    if (!community) return reply.code(404).send({ error: "Community not found" });
    if (!(await canReadCommunity(communityId, userId))) {
      return reply.code(403).send({ error: "Join this private community to export its records" });
    }

    const [
      questions,
      policies,
      governanceParameterSets,
      emergencySuspensions,
      credentialTrustPolicies,
      tallyCommittees,
      tallyKeySetups,
      forks,
      dataUnionPolicies,
      dataUnionConsents,
      dataUnionProducts,
      dataUnionAccessGrants,
      dataUnionBuyers,
      dataUnionSettlements,
      dataUnionClaims
    ] = await Promise.all([
      prisma.question.findMany({
        where: { AND: [{ communityId }, readableQuestionWhere(userId)] },
        orderBy: { createdAt: "asc" },
        include: {
          challenges: { orderBy: { createdAt: "asc" } },
          challengeAppeals: { orderBy: { createdAt: "asc" } },
          jurorAssignments: { orderBy: { createdAt: "asc" } },
          discussionPosts: { orderBy: { createdAt: "asc" } },
          archiveRecord: true,
          poll: {
            include: {
              ballots: { select: { ballotCommitment: true, nullifier: true } },
              decryptionShares: { select: TALLY_DECRYPTION_SHARE_PUBLIC_SELECT, orderBy: { submittedAt: "asc" } },
              result: true,
              resultChallenges: { orderBy: { createdAt: "asc" } }
            }
          }
        }
      }),
      prisma.adoptionPolicy.findMany({ where: { communityId }, orderBy: [{ status: "asc" }, { effectiveAt: "desc" }] }),
      prisma.governanceParameterSet.findMany({ where: { communityId }, orderBy: [{ status: "asc" }, { effectiveAt: "desc" }] }),
      prisma.communityEmergencySuspension.findMany({ where: { communityId }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] }),
      prisma.communityCredentialTrustPolicy.findMany({ where: { communityId }, orderBy: [{ status: "asc" }, { credentialSchemaId: "asc" }, { createdAt: "asc" }] }),
      prisma.tallyCommittee.findMany({ where: { communityId }, orderBy: [{ status: "asc" }, { createdAt: "asc" }] }),
      prisma.tallyKeySetup.findMany({ where: { communityId }, select: TALLY_KEY_SETUP_PUBLIC_SELECT, orderBy: [{ status: "asc" }, { createdAt: "asc" }] }),
      prisma.communityFork.findMany({ where: { sourceCommunityId: communityId }, orderBy: { createdAt: "asc" } }),
      prisma.dataUnionPolicy.findMany({ where: { communityId }, orderBy: [{ status: "asc" }, { createdAt: "asc" }] }),
      prisma.dataUnionConsent.findMany({ where: { communityId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      prisma.dataUnionProduct.findMany({ where: { communityId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      prisma.dataUnionAccessGrant.findMany({
        where: { communityId, status: "Active" },
        include: {
          product: { include: { result: { include: { poll: { include: { question: { select: { proposer: true } } } } } } } },
          settlements: true
        },
        orderBy: { createdAt: "asc" }
      }),
      prisma.dataUnionBuyer.findMany({ where: { communityId }, orderBy: [{ status: "asc" }, { createdAt: "asc" }] }),
      prisma.dataUnionSettlement.findMany({ where: { communityId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      prisma.dataUnionClaim.findMany({ where: { communityId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] })
    ]);

    const questionIds = questions.map((question) => question.id);
    const policyIds = policies.map((policy) => policy.id);
    const dataUnionPolicyIds = dataUnionPolicies.map((policy) => policy.id);
    const dataUnionConsentIds = dataUnionConsents.map((consent) => consent.id);
    const dataUnionProductIds = dataUnionProducts.map((product) => product.id);
    const dataUnionAccessGrantIds = dataUnionAccessGrants.map((grant) => grant.id);
    const dataUnionBuyerIds = dataUnionBuyers.map((buyer) => buyer.id);
    const dataUnionSettlementIds = dataUnionSettlements.map((settlement) => settlement.id);
    const dataUnionClaimIds = dataUnionClaims.map((claim) => claim.id);
    const governanceParameterSetIds = governanceParameterSets.map((set) => set.id);
    const emergencySuspensionIds = emergencySuspensions.map((suspension) => suspension.id);
    const challengeIds = questions.flatMap((question) => question.challenges.map((challenge) => challenge.id));
    const resultChallengeIds = questions.flatMap((question) => question.poll?.resultChallenges.map((challenge) => challenge.id) ?? []);
    const challengeAppeals = questions.flatMap((question) => question.challengeAppeals);
    const challengeAppealIds = challengeAppeals.map((appeal) => appeal.id);
    const jurorAssignments = questions.flatMap((question) => question.jurorAssignments);
    const bonds = await prisma.bond.findMany({
      where: {
        OR: [
          { questionId: { in: questionIds } },
          { challengeId: { in: challengeIds } },
          { resultChallengeId: { in: resultChallengeIds } },
          { challengeAppealId: { in: challengeAppealIds } }
        ]
      },
      orderBy: { createdAt: "asc" }
    });
    const credentialIssuerAnnotations = await credentialIssuerAnnotationsForQuestions(questions);
    const dataUnionPolicyViews = dataUnionPolicies.map(toDataUnionPolicyResponse);
    const dataUnionConsentViews = dataUnionConsents.map(toDataUnionConsentResponse);
    const dataUnionProductViews = dataUnionProducts.map(toDataUnionProductResponse);
    const dataUnionAccessGrantViews = dataUnionAccessGrants.map(toDataUnionAccessGrantResponse);
    const dataUnionBuyerViews = dataUnionBuyers.map(toDataUnionBuyerResponse);
    const dataUnionSettlementViews = dataUnionSettlements.map(toDataUnionSettlementResponse);
    const dataUnionClaimViews = dataUnionClaims.map(toDataUnionClaimResponse);
    const treasuryLedgerEntries = sortTreasuryLedgerEntries([
      ...buildTreasuryLedgerEntries(communityId, bonds),
      ...buildDataUnionTreasuryLedgerEntries(communityId, dataUnionAccessGrants)
    ]);
    const treasuryLedgerTotals = buildTreasuryLedgerTotals(treasuryLedgerEntries, bonds);
    const moderationRecords = await prisma.discussionModerationRecord.findMany({
      where: { questionId: { in: questionIds } },
      orderBy: { createdAt: "asc" }
    });
    const moderationAppeals = await prisma.discussionModerationAppeal.findMany({
      where: { moderationRecordId: { in: moderationRecords.map((record) => record.id) } },
      orderBy: { createdAt: "asc" }
    });
    const topicIds = uniqueStrings(questions.flatMap((question) => question.topicIds));
    const [communityFollows, topicFollows] = await Promise.all([
      prisma.communityFollow.findMany({ where: { communityId }, orderBy: { createdAt: "asc" } }),
      prisma.topicFollow.findMany({ where: { topicId: { in: topicIds } }, orderBy: { createdAt: "asc" } })
    ]);
    const reputationEvents = await prisma.reputationEvent.findMany({
      where: { sourceId: { in: uniqueStrings([...questionIds, ...challengeIds, ...resultChallengeIds, ...challengeAppealIds]) } },
      orderBy: { createdAt: "asc" }
    });
    const profileUserIds = uniqueStrings(
      [
        community.createdBy,
        ...community.memberships.map((member) => member.userId),
        ...communityFollows.map((follow) => follow.userId),
        ...topicFollows.map((follow) => follow.userId),
        ...policies.flatMap((policy) => [policy.proposedBy, policy.adoptedBy, policy.suspendedBy]),
        ...governanceParameterSets.flatMap((set) => [set.proposedBy, set.activatedBy]),
        ...emergencySuspensions.flatMap((suspension) => [suspension.suspendedBy, suspension.resolvedBy]),
        ...tallyCommittees.flatMap((committee) => [committee.createdBy, committee.activatedBy, committee.failedBy, ...committee.memberIds]),
        ...tallyKeySetups.flatMap((setup) => [setup.createdBy, ...setup.memberIds]),
        ...dataUnionPolicyViews.flatMap((policy) => [policy.proposedBy, policy.activatedBy]),
        ...dataUnionConsentViews.map((consent) => consent.userId),
        ...dataUnionProductViews.map((product) => product.createdBy),
        ...dataUnionAccessGrantViews.map((grant) => grant.grantedBy),
        ...dataUnionBuyerViews.map((buyer) => buyer.approvedBy),
        ...dataUnionSettlementViews.map((settlement) => settlement.recordedBy),
        ...questions.map((question) => question.proposer),
        ...questions.flatMap((question) => question.discussionPosts.map((post) => post.authorId)),
        ...questions.flatMap((question) => question.challenges.map((challenge) => challenge.challenger)),
        ...questions.flatMap((question) => question.poll?.resultChallenges.map((challenge) => challenge.challenger) ?? []),
        ...challengeAppeals.flatMap((appeal) => [appeal.appellantId, appeal.resolvedBy]),
        ...jurorAssignments.flatMap((assignment) => [assignment.jurorId, assignment.selectedBy]),
        ...moderationRecords.map((record) => record.moderatorId),
        ...moderationAppeals.flatMap((appeal) => [appeal.appellantId, appeal.resolvedBy]),
        ...reputationEvents.map((event) => event.account),
        ...treasuryLedgerEntries.filter((entry) => entry.accountRole === "Participant").map((entry) => entry.accountId)
      ].filter((userId): userId is string => Boolean(userId))
    );
    const profiles = await prisma.userAccount.findMany({ where: { id: { in: profileUserIds } }, orderBy: { createdAt: "asc" } });
    const eventSubjectIds = uniqueStrings([
      communityId,
      ...questionIds,
      ...policyIds,
      ...dataUnionPolicyIds,
      ...dataUnionConsentIds,
      ...dataUnionProductIds,
      ...dataUnionAccessGrantIds,
      ...dataUnionBuyerIds,
      ...dataUnionSettlementIds,
      ...dataUnionClaimIds,
      ...governanceParameterSetIds,
      ...emergencySuspensionIds,
      ...bonds.map((bond) => bond.id)
    ]);
    const [events, commitmentRecords] = await Promise.all([
      prisma.registryEvent.findMany({ where: { subjectId: { in: eventSubjectIds } }, orderBy: REGISTRY_EVENT_ORDER }),
      prisma.protocolCommitmentRecord.findMany({ where: { subjectId: { in: eventSubjectIds } }, orderBy: COMMITMENT_RECORD_ORDER })
    ]);
    const commitments = commitmentRecords.map(toCommitmentView);
    const archives = questions.flatMap((question) => (question.archiveRecord ? [question.archiveRecord] : []));
    const artifactManifest = buildArtifactManifest(
      collectCommunityExportArtifactReferences(
        questions,
        policies,
        forks,
        community.frontendConfig,
        governanceParameterSets,
        emergencySuspensions,
        credentialTrustPolicies,
        tallyCommittees,
        tallyKeySetups,
        dataUnionPolicyViews,
        dataUnionConsentViews,
        dataUnionProductViews,
        dataUnionAccessGrantViews,
        dataUnionBuyerViews,
        dataUnionSettlementViews,
        dataUnionClaimViews,
        moderationRecords,
        moderationAppeals,
        challengeAppeals,
        jurorAssignments,
        profiles,
        communityFollows,
        topicFollows
      )
    );
    const communityExport = withArtifactSchema("community-export", {
      community: toCommunityExportCommunity(community),
      members: community.memberships,
      profiles,
      communityFollows,
      topicFollows,
      reputationEvents,
      credentialIssuerAnnotations,
      treasuryLedgerEntries,
      treasuryLedgerTotals,
      frontendConfig: community.frontendConfig,
      forks,
      policies,
      governanceParameterSets,
      emergencySuspensions,
      credentialTrustPolicies,
      tallyCommittees,
      tallyKeySetups,
      dataUnionPolicies: dataUnionPolicyViews,
      dataUnionConsents: dataUnionConsentViews,
      dataUnionProducts: dataUnionProductViews,
      dataUnionAccessGrants: dataUnionAccessGrantViews,
      dataUnionBuyers: dataUnionBuyerViews,
      dataUnionSettlements: dataUnionSettlementViews,
      dataUnionClaims: dataUnionClaimViews,
      questions: questions.map(toCommunityExportQuestion),
      moderationRecords,
      moderationAppeals,
      challengeAppeals,
      jurorAssignments,
      events,
      commitments,
      bonds,
      archives,
      artifactManifest,
      artifactManifestHash: hashArtifactManifest(artifactManifest.references),
      exportedAt: Date.now()
    });
    const exportArtifact = await artifactStore.write(communityExport);
    await storeArtifact(exportArtifact, "community-export");

    try {
      const bundle = await artifactStore.buildExportBundle(artifactManifest, {
        kind: "community-export",
        hash: exportArtifact.hash,
        role: "community-export"
      });
      return {
        protocol: buildCommunityExportProtocol(
          community,
          policies,
          forks,
          questions,
          governanceParameterSets,
          emergencySuspensions,
          credentialTrustPolicies,
          tallyCommittees,
          tallyKeySetups,
          dataUnionPolicyViews,
          dataUnionConsentViews,
          dataUnionProductViews,
          dataUnionAccessGrantViews,
          dataUnionBuyerViews,
          dataUnionSettlementViews,
          dataUnionClaimViews,
          moderationRecords,
          moderationAppeals,
          challengeAppeals,
          jurorAssignments,
          profiles,
          communityFollows,
          topicFollows,
          reputationEvents,
          credentialIssuerAnnotations,
          treasuryLedgerEntries,
          treasuryLedgerTotals,
          events,
          commitments,
          archives,
          bundle,
          exportArtifact.hash
        ),
        community: toCommunityExportCommunity(community),
        exportArtifact: { hash: exportArtifact.hash, artifact: exportArtifact.value },
        bundle
      };
    } catch (error) {
      return reply.code(409).send({ error: error instanceof Error ? error.message : "Community export contains invalid artifact references" });
    }
  });

  app.post("/communities/imports/replay", async (request) => {
    const input = CommunityImportReplayRequestSchema.parse(request.body ?? {});
    const replay = buildCommunityImportReplay(input.bundle);
    return {
      protocol: buildCommunityImportReplayProtocol(replay),
      status: replay.allPassed ? "Verified" : "Mismatch",
      readOnly: true,
      rebuilt: replay.rebuilt,
      checks: replay.checks
    };
  });

  app.get("/communities/:communityId/forks", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const { userId } = request.query as { userId?: string };
    const community = await prisma.community.findUnique({ where: { id: communityId } });
    if (!community) return reply.code(404).send({ error: "Community not found" });
    if (!(await canReadCommunity(communityId, userId))) {
      return reply.code(403).send({ error: "Join this private community to view its fork records" });
    }
    const forks = await prisma.communityFork.findMany({ where: { sourceCommunityId: communityId }, orderBy: { createdAt: "asc" } });
    return { communityId, forks };
  });

  app.post("/communities/:communityId/forks", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const input = CreateCommunityForkRequestSchema.parse(request.body ?? {});
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply, request);
    if (!stewardCheck) return;

    const sourceExport = await artifactStore.read<Record<string, unknown>>(input.sourceExportHash).catch(() => null);
    if (!isRecord(sourceExport) || sourceExport.artifactKind !== "community-export") {
      return reply.code(409).send({ error: "Source export artifact must be a community-export artifact" });
    }
    const sourceCommunity = isRecord(sourceExport.community) ? sourceExport.community : null;
    if (sourceCommunity?.id !== communityId) {
      return reply.code(409).send({ error: "Source export artifact does not belong to this community" });
    }
    const sourceManifestHash = optionalString(sourceExport.artifactManifestHash);
    if (!sourceManifestHash) return reply.code(409).send({ error: "Source export artifact is missing its manifest hash" });

    const reasonHash = hashJson({ reason: input.reason });
    const metadataArtifact = await artifactStore.write(
      withArtifactSchema("community-fork", {
        sourceCommunityId: communityId,
        forkName: input.forkName,
        forkSlug: input.forkSlug,
        reason: input.reason,
        reasonHash,
        sourceExportHash: input.sourceExportHash,
        sourceManifestHash,
        sourceQuestionIds: extractIdsFromExportList(sourceExport.questions),
        sourcePolicyIds: extractIdsFromExportList(sourceExport.policies),
        sourceArchiveHashes: extractArchiveHashesFromExportList(sourceExport.archives),
        createdBy: input.steward,
        createdAt: Date.now()
      })
    );
    await storeArtifact(metadataArtifact, "community-fork");

    try {
      const communityForkedEvent = prepareProtocolEvent({
        eventType: "CommunityForked",
        subjectId: communityId,
        actor: input.steward,
        previousHash: input.sourceExportHash,
        newHash: metadataArtifact.hash
      });
      const fork = await prisma.$transaction(async (tx) => {
        const protocolEvent = await ingestProtocolEvent(tx, communityForkedEvent);
        const created = await tx.communityFork.create({
          data: {
            id: `fork-${nanoid(10)}`,
            sourceCommunityId: communityId,
            forkName: input.forkName,
            forkSlug: input.forkSlug,
            reasonHash,
            metadataHash: metadataArtifact.hash,
            sourceExportHash: input.sourceExportHash,
            sourceManifestHash,
            createdBy: input.steward
          }
        });
        await recordProtocolCommitments(protocolEvent, tx);
        return created;
      });
      return { fork, metadataArtifact: { hash: metadataArtifact.hash, value: metadataArtifact.value } };
    } catch {
      return reply.code(409).send({ error: "Community fork slug is already recorded" });
    }
  });

  app.get("/communities/:communityId/frontend-config", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const { userId } = request.query as { userId?: string };
    const community = await prisma.community.findUnique({ where: { id: communityId }, include: { frontendConfig: true } });
    if (!community) return reply.code(404).send({ error: "Community not found" });
    if (!(await canReadCommunity(communityId, userId))) {
      return reply.code(403).send({ error: "Join this private community to view its frontend config" });
    }
    if (!community.frontendConfig) return { communityId, frontendConfig: null, artifact: null };
    const artifact = await artifactStore.read(community.frontendConfig.configHash);
    return { communityId, frontendConfig: community.frontendConfig, artifact: { hash: community.frontendConfig.configHash, value: artifact } };
  });

  app.post("/communities/:communityId/frontend-config", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const input = SetCommunityFrontendConfigRequestSchema.parse(request.body ?? {});
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply, request);
    if (!stewardCheck) return;
    const existing = await prisma.communityFrontendConfig.findUnique({ where: { communityId } });
    const configArtifact = await artifactStore.write(
      withArtifactSchema("community-frontend-config", {
        communityId,
        displayName: input.displayName,
        tagline: input.tagline,
        theme: input.theme,
        enabledViews: input.enabledViews,
        navigation: input.navigation,
        externalLinks: input.externalLinks,
        updatedBy: input.steward,
        updatedAt: Date.now()
      })
    );
    await storeArtifact(configArtifact, "community-frontend-config");
    const communityFrontendConfigUpdatedEvent = prepareProtocolEvent({
      eventType: "CommunityFrontendConfigUpdated",
      subjectId: communityId,
      actor: input.steward,
      previousHash: existing?.configHash ?? null,
      newHash: configArtifact.hash
    });
    const frontendConfig = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, communityFrontendConfigUpdatedEvent);
      const upserted = await tx.communityFrontendConfig.upsert({
        where: { communityId },
        update: {
          configHash: configArtifact.hash,
          createdBy: input.steward
        },
        create: {
          id: `frontend-config-${nanoid(10)}`,
          communityId,
          configHash: configArtifact.hash,
          createdBy: input.steward
        }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return upserted;
    });
    return { frontendConfig, configArtifact: { hash: configArtifact.hash, value: configArtifact.value } };
  });

  app.get("/communities/:communityId/credential-trust-policies", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const { userId } = request.query as { userId?: string };
    const community = await prisma.community.findUnique({ where: { id: communityId } });
    if (!community) return reply.code(404).send({ error: "Community not found" });
    if (!(await canReadCommunity(communityId, userId))) {
      return reply.code(403).send({ error: "Join this private community to view credential trust policies" });
    }
    const policies = await prisma.communityCredentialTrustPolicy.findMany({
      where: { communityId },
      orderBy: [{ status: "asc" }, { credentialSchemaId: "asc" }, { createdAt: "asc" }]
    });
    return {
      protocol: buildCredentialTrustPoliciesProtocol(communityId, policies),
      communityId,
      policies
    };
  });

  app.post("/communities/:communityId/credential-trust-policies", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const input = SetCommunityCredentialTrustPolicyRequestSchema.parse(request.body ?? {});
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply, request);
    if (!stewardCheck) return;
    if (input.trustedIssuerIds.includes("*") && input.trustedIssuerIds.length > 1) {
      return reply.code(400).send({ error: "Wildcard issuer trust policy cannot include additional issuer ids" });
    }
    if (input.credentialSchemaId !== "*") {
      const schema = await prisma.credentialSchema.findUnique({ where: { id: input.credentialSchemaId } });
      if (!schema || schema.status !== "Active") return reply.code(400).send({ error: "Credential trust policy schema must be active" });
    }
    const issuerIds = input.trustedIssuerIds.filter((issuerId) => issuerId !== "*");
    if (issuerIds.length > 0) {
      const issuers = await prisma.credentialIssuer.findMany({ where: { id: { in: issuerIds }, status: "Active" } });
      if (issuers.length !== issuerIds.length) return reply.code(400).send({ error: "Trusted credential issuers must be active" });
      if (input.credentialSchemaId !== "*" && issuers.some((issuer) => !issuer.schemaIds.includes(input.credentialSchemaId))) {
        return reply.code(400).send({ error: "Trusted credential issuers must support the policy credential schema" });
      }
    }

    const policyArtifact = await artifactStore.write(
      withArtifactSchema("community-credential-trust-policy", {
        communityId,
        credentialSchemaId: input.credentialSchemaId,
        trustedIssuerIds: input.trustedIssuerIds,
        mode: input.mode,
        status: input.status,
        setBy: input.steward,
        setAt: Date.now()
      })
    );
    await storeArtifact(policyArtifact, "community-credential-trust-policy");
    const communityCredentialTrustPolicySetEvent = prepareProtocolEvent({
      eventType: "CommunityCredentialTrustPolicySet",
      subjectId: communityId,
      actor: input.steward,
      previousHash: null,
      newHash: policyArtifact.hash
    });
    const policy = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, communityCredentialTrustPolicySetEvent);
      const created = await tx.communityCredentialTrustPolicy.create({
        data: {
          id: `credential-trust-${nanoid(10)}`,
          communityId,
          credentialSchemaId: input.credentialSchemaId,
          trustedIssuerIds: input.trustedIssuerIds,
          mode: input.mode,
          status: input.status,
          policyHash: policyArtifact.hash,
          createdBy: input.steward
        }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return created;
    });
    return { policy, policyArtifact };
  });

  app.get("/communities/:communityId/tally-committees", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const { userId } = request.query as { userId?: string };
    const community = await prisma.community.findUnique({ where: { id: communityId } });
    if (!community) return reply.code(404).send({ error: "Community not found" });
    if (!(await canReadCommunity(communityId, userId))) {
      return reply.code(403).send({ error: "Join this private community to view tally committees" });
    }
    const committees = await prisma.tallyCommittee.findMany({
      where: { communityId },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }]
    });
    return {
      protocol: buildTallyCommitteesProtocol(communityId, committees),
      communityId,
      activeCommittee: activeTallyCommittee(committees),
      committees
    };
  });

  app.post("/communities/:communityId/tally-committees", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const input = CreateTallyCommitteeRequestSchema.parse(request.body ?? {});
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply, request);
    if (!stewardCheck) return;
    const memberIds = uniqueStrings(input.memberIds);
    if (memberIds.length !== input.memberIds.length) return reply.code(400).send({ error: "Tally committee member ids must be unique" });
    const members = await prisma.userAccount.findMany({ where: { id: { in: memberIds } } });
    if (members.length !== memberIds.length) return reply.code(400).send({ error: "Tally committee members must be local accounts" });
    if (input.replacementForId) {
      const replaced = await prisma.tallyCommittee.findUnique({ where: { id: input.replacementForId } });
      if (!replaced || replaced.communityId !== communityId) return reply.code(404).send({ error: "Replacement target tally committee not found" });
      if (!["Failed", "Retired"].includes(replaced.status)) {
        return reply.code(409).send({ error: "Replacement target tally committee must be failed or retired" });
      }
    }
    const proposalArtifact = await artifactStore.write(
      withArtifactSchema("tally-committee-proposal", {
        communityId,
        name: input.name,
        memberIds,
        threshold: input.threshold,
        metadata: input.metadata,
        replacementForId: input.replacementForId,
        proposedBy: input.steward,
        proposedAt: Date.now()
      })
    );
    await storeArtifact(proposalArtifact, "tally-committee-proposal");
    const committeeProposedEvent = prepareProtocolEvent({
      eventType: "TallyCommitteeProposed",
      subjectId: communityId,
      actor: input.steward,
      previousHash: null,
      newHash: proposalArtifact.hash
    });
    const committee = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, committeeProposedEvent);
      const proposed = await tx.tallyCommittee.create({
        data: {
          id: `tally-committee-${nanoid(10)}`,
          communityId,
          name: input.name,
          memberIds,
          threshold: input.threshold,
          metadataHash: proposalArtifact.hash,
          createdBy: input.steward,
          replacementForId: input.replacementForId
        }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return proposed;
    });
    return { committee, proposalArtifact };
  });

  app.post("/communities/:communityId/tally-committees/:committeeId/activate", async (request, reply) => {
    const { communityId, committeeId } = request.params as { communityId: string; committeeId: string };
    const input = ActivateTallyCommitteeRequestSchema.parse(request.body ?? {});
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply, request);
    if (!stewardCheck) return;
    const committee = await prisma.tallyCommittee.findUnique({ where: { id: committeeId } });
    if (!committee || committee.communityId !== communityId) return reply.code(404).send({ error: "Tally committee not found" });
    if (committee.status !== "Proposed") return reply.code(409).send({ error: "Only proposed tally committees can be activated" });
    const effectiveAt = input.effectiveAt ? new Date(input.effectiveAt) : new Date();
    const activationArtifact = await artifactStore.write(
      withArtifactSchema("tally-committee-activation", {
        communityId,
        committeeId,
        activatedBy: input.steward,
        activationRecord: input.activationRecord,
        effectiveAt: effectiveAt.getTime()
      })
    );
    await storeArtifact(activationArtifact, "tally-committee-activation");
    const committeeActivatedEvent = prepareProtocolEvent({
      eventType: "TallyCommitteeActivated",
      subjectId: communityId,
      actor: input.steward,
      previousHash: committee.metadataHash,
      newHash: activationArtifact.hash
    });
    const activated = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, committeeActivatedEvent);
      await tx.tallyCommittee.updateMany({ where: { communityId, status: "Active" }, data: { status: "Retired" } });
      const active = await tx.tallyCommittee.update({
        where: { id: committeeId },
        data: {
          status: "Active",
          activationHash: activationArtifact.hash,
          activatedBy: input.steward
        }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return active;
    });
    return { committee: activated, activationArtifact };
  });

  app.post("/communities/:communityId/tally-committees/:committeeId/fail", async (request, reply) => {
    const { communityId, committeeId } = request.params as { communityId: string; committeeId: string };
    const input = FailTallyCommitteeRequestSchema.parse(request.body ?? {});
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply, request);
    if (!stewardCheck) return;
    const committee = await prisma.tallyCommittee.findUnique({ where: { id: committeeId } });
    if (!committee || committee.communityId !== communityId) return reply.code(404).send({ error: "Tally committee not found" });
    if (committee.status === "Failed") return reply.code(409).send({ error: "Tally committee is already failed" });
    const failedAt = new Date();
    const failureArtifact = await artifactStore.write(
      withArtifactSchema("tally-committee-failure", {
        communityId,
        committeeId,
        failedBy: input.steward,
        reason: input.reason,
        replacementExpected: input.replacementExpected,
        failedAt: failedAt.getTime()
      })
    );
    await storeArtifact(failureArtifact, "tally-committee-failure");
    const committeeFailedEvent = prepareProtocolEvent({
      eventType: "TallyCommitteeFailed",
      subjectId: communityId,
      actor: input.steward,
      previousHash: committee.activationHash ?? committee.metadataHash,
      newHash: failureArtifact.hash
    });
    const failed = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, committeeFailedEvent);
      await tx.tallyKeySetup.updateMany({ where: { committeeId, status: "Active" }, data: { status: "Failed" } });
      const failedCommittee = await tx.tallyCommittee.update({
        where: { id: committeeId },
        data: {
          status: "Failed",
          failureHash: failureArtifact.hash,
          failedBy: input.steward,
          failedAt
        }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return failedCommittee;
    });
    return { committee: failed, failureArtifact };
  });

  app.get("/communities/:communityId/tally-key-setups", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const { userId } = request.query as { userId?: string };
    const community = await prisma.community.findUnique({ where: { id: communityId } });
    if (!community) return reply.code(404).send({ error: "Community not found" });
    if (!(await canReadCommunity(communityId, userId))) {
      return reply.code(403).send({ error: "Join this private community to view tally key setups" });
    }
    const keySetups = await prisma.tallyKeySetup.findMany({
      where: { communityId },
      select: TALLY_KEY_SETUP_PUBLIC_SELECT,
      orderBy: [{ status: "asc" }, { createdAt: "asc" }]
    });
    return {
      protocol: buildTallyKeySetupsProtocol(communityId, keySetups),
      communityId,
      activeKeySetup: activeTallyKeySetup(keySetups),
      keySetups
    };
  });

  app.post("/communities/:communityId/tally-committees/:committeeId/key-setup", async (request, reply) => {
    const { communityId, committeeId } = request.params as { communityId: string; committeeId: string };
    const input = SetupTallyPublicKeyRequestSchema.parse(request.body ?? {});
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply, request);
    if (!stewardCheck) return;
    const committee = await prisma.tallyCommittee.findUnique({ where: { id: committeeId } });
    if (!committee || committee.communityId !== communityId) return reply.code(404).send({ error: "Tally committee not found" });
    if (committee.status !== "Active") return reply.code(409).send({ error: "Only active tally committees can publish threshold public keys" });
    if (!config.demoMode && !input.publicKeyPem) {
      return reply.code(400).send({ error: "Non-demo mode requires an externally generated threshold public key" });
    }

    const generatedKeypair = input.publicKeyPem ? null : createCoordinatorKeypair();
    let publicKeyPem: string;
    try {
      publicKeyPem = normalizeTallyPublicKeyPem(input.publicKeyPem ?? generatedKeypair!.publicKeyPem);
    } catch {
      return reply.code(400).send({ error: "Invalid tally public key PEM" });
    }
    const publicKeyId = tallyPublicKeyId(publicKeyPem);
    const publicKeyHash = hashJson(publicKeyPem);
    const memberKeyCommitmentHashes =
      input.memberKeyCommitmentHashes ??
      committee.memberIds.map((memberId) =>
        hashJson({
          protocol: "pc-threshold-member-key-commitment-v0",
          communityId,
          committeeId,
          memberId,
          publicKeyId
        })
      );
    if (memberKeyCommitmentHashes.length !== committee.memberIds.length) {
      return reply.code(400).send({ error: "Tally key setup must include one member key commitment per committee member" });
    }
    if (uniqueStrings(memberKeyCommitmentHashes).length !== memberKeyCommitmentHashes.length) {
      return reply.code(400).send({ error: "Tally key setup member key commitments must be unique" });
    }
    if (memberKeyCommitmentHashes.length < committee.threshold) {
      return reply.code(400).send({ error: "Tally key setup commitments must meet the committee threshold" });
    }
    const memberPublicKeys = input.memberPublicKeys ?? [];
    if (memberPublicKeys.length > 0) {
      const keyedMemberIds = new Set(memberPublicKeys.map((member) => member.memberId));
      if (keyedMemberIds.size !== memberPublicKeys.length || memberPublicKeys.length !== committee.memberIds.length) {
        return reply.code(400).send({ error: "Tally key setup production member public keys must be unique and cover every committee member" });
      }
      if (committee.memberIds.some((memberId) => !keyedMemberIds.has(memberId))) {
        return reply.code(400).send({ error: "Tally key setup production member public keys must match committee members" });
      }
    }
    const transcriptHash = hashJson({ ceremonyTranscript: input.ceremonyTranscript });
    const setupArtifact = await artifactStore.write(
      withArtifactSchema("tally-key-setup", {
        communityId,
        committeeId,
        publicKeyId,
        publicKeyPem,
        publicKeyHash,
        memberIds: committee.memberIds,
        memberKeyCommitmentHashes,
        memberPublicKeys,
        threshold: committee.threshold,
        transcriptHash,
        ceremonyTranscript: input.ceremonyTranscript,
        setupBy: input.steward,
        setupAt: Date.now()
      })
    );
    await storeArtifact(setupArtifact, "tally-key-setup");
    const keySetupPublishedEvent = prepareProtocolEvent({
      eventType: "TallyKeySetupPublished",
      subjectId: communityId,
      actor: input.steward,
      previousHash: committee.activationHash ?? committee.metadataHash,
      newHash: setupArtifact.hash
    });
    const keySetup = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, keySetupPublishedEvent);
      await tx.tallyKeySetup.updateMany({ where: { communityId, status: "Active" }, data: { status: "Retired" } });
      const published = await tx.tallyKeySetup.create({
        data: {
          id: `tally-key-${nanoid(10)}`,
          communityId,
          committeeId,
          publicKeyId,
          publicKeyPem,
          publicKeyHash,
          memberIds: committee.memberIds,
          memberKeyCommitmentHashes,
          threshold: committee.threshold,
          transcriptHash,
          setupHash: setupArtifact.hash,
          createdBy: input.steward,
          demoPrivateKeyPem: config.demoMode ? generatedKeypair?.privateKeyPem ?? null : null
        },
        select: TALLY_KEY_SETUP_PUBLIC_SELECT
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return published;
    });
    return { keySetup, setupArtifact };
  });

  app.get("/communities/:communityId/governance/parameters", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const { userId } = request.query as { userId?: string };
    const community = await prisma.community.findUnique({ where: { id: communityId } });
    if (!community) return reply.code(404).send({ error: "Community not found" });
    if (!(await canReadCommunity(communityId, userId))) {
      return reply.code(403).send({ error: "Join this private community to view governance parameters" });
    }
    const parameterSets = await prisma.governanceParameterSet.findMany({
      where: { communityId },
      orderBy: [{ status: "asc" }, { effectiveAt: "desc" }, { createdAt: "desc" }]
    });
    const activeParameterSet = activeGovernanceParameterSet(parameterSets);
    return {
      protocol: buildGovernanceParametersProtocol(communityId, activeParameterSet, parameterSets),
      communityId,
      activeParameterSet,
      parameterSets
    };
  });

  app.get("/communities/:communityId/governance/upgrade-safety", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const { userId } = request.query as { userId?: string };
    const community = await prisma.community.findUnique({
      where: { id: communityId },
      include: {
        memberships: {
          where: { status: "Active", role: { in: [...CURATOR_ROLES] } },
          orderBy: [{ role: "asc" }, { createdAt: "asc" }],
          include: { user: { select: { profileId: true, profileHash: true } } }
        },
        emergencySuspensions: { orderBy: { createdAt: "desc" } }
      }
    });
    if (!community) return reply.code(404).send({ error: "Community not found" });
    if (!(await canReadCommunity(communityId, userId))) {
      return reply.code(403).send({ error: "Join this private community to view the upgrade safety model" });
    }
    const parameterSets = await prisma.governanceParameterSet.findMany({
      where: { communityId },
      orderBy: [{ status: "asc" }, { effectiveAt: "desc" }, { createdAt: "desc" }]
    });
    const activeParameterSet = activeGovernanceParameterSet(parameterSets);
    const activeEmergencySuspension = community.emergencySuspensions.find((suspension) => suspension.status === "Active") ?? null;
    const activeStewards = community.memberships.map((member) => ({
      userId: member.userId,
      role: normalizeStewardRole(member.role),
      status: member.status,
      profileId: member.user.profileId,
      profileHash: member.user.profileHash
    }));
    const model = buildUpgradeSafetyModel(communityId, {
      activeStewards,
      parameterSets,
      activeParameterSet,
      emergencySuspensions: community.emergencySuspensions,
      activeEmergencySuspension
    });
    return {
      protocol: buildUpgradeSafetyProtocol(communityId, model, activeStewards, activeParameterSet, activeEmergencySuspension),
      communityId,
      model,
      gates: model.gates,
      powers: STEWARD_POWERS,
      activeStewards,
      activeParameterSet,
      activeEmergencySuspension
    };
  });

  app.post("/communities/:communityId/governance/parameters/proposals", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const input = ProposeGovernanceParametersRequestSchema.parse(request.body ?? {});
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply, request);
    if (!stewardCheck) return;
    const parameters = governanceParametersFromInput(input);
    const proposalArtifact = await artifactStore.write(
      withArtifactSchema("governance-parameter-proposal", {
        communityId,
        proposedBy: input.steward,
        rationale: input.rationale,
        parameters,
        proposedAt: Date.now()
      })
    );
    await storeArtifact(proposalArtifact, "governance-parameter-proposal");
    const parametersProposedEvent = prepareProtocolEvent({
      eventType: "GovernanceParametersProposed",
      subjectId: communityId,
      actor: input.steward,
      previousHash: null,
      newHash: proposalArtifact.hash
    });
    const parameterSet = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, parametersProposedEvent);
      const proposed = await tx.governanceParameterSet.create({
        data: {
          id: `governance-params-${nanoid(10)}`,
          communityId,
          ...parameters,
          proposalHash: proposalArtifact.hash,
          proposedBy: input.steward,
          effectiveAt: new Date(),
          status: "Proposed"
        }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return proposed;
    });
    return { parameterSet, proposalArtifact };
  });

  app.post("/communities/:communityId/governance/parameters/:parameterSetId/activate", async (request, reply) => {
    const { communityId, parameterSetId } = request.params as { communityId: string; parameterSetId: string };
    const input = ActivateGovernanceParametersRequestSchema.parse(request.body ?? {});
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply, request);
    if (!stewardCheck) return;
    const parameterSet = await prisma.governanceParameterSet.findUnique({ where: { id: parameterSetId } });
    if (!parameterSet || parameterSet.communityId !== communityId) return reply.code(404).send({ error: "Governance parameter set not found" });
    if (parameterSet.status !== "Proposed") return reply.code(409).send({ error: "Only proposed governance parameter sets can be activated" });
    const effectiveAt = input.effectiveAt ? new Date(input.effectiveAt) : new Date();
    const activationArtifact = await artifactStore.write(
      withArtifactSchema("governance-parameter-activation", {
        communityId,
        parameterSetId,
        activatedBy: input.steward,
        activationRecord: input.activationRecord,
        effectiveAt: effectiveAt.getTime()
      })
    );
    await storeArtifact(activationArtifact, "governance-parameter-activation");
    const parametersActivatedEvent = prepareProtocolEvent({
      eventType: "GovernanceParametersActivated",
      subjectId: communityId,
      actor: input.steward,
      previousHash: parameterSet.proposalHash,
      newHash: activationArtifact.hash
    });
    const activated = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, parametersActivatedEvent);
      await tx.governanceParameterSet.updateMany({
        where: { communityId, status: "Active" },
        data: { status: "Retired" }
      });
      const active = await tx.governanceParameterSet.update({
        where: { id: parameterSetId },
        data: {
          status: "Active",
          activationHash: activationArtifact.hash,
          activatedBy: input.steward,
          effectiveAt
        }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return active;
    });
    return { parameterSet: activated, activationArtifact };
  });

  app.get("/communities/:communityId/data-union", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const { userId } = request.query as { userId?: string };
    const community = await prisma.community.findUnique({ where: { id: communityId } });
    if (!community) return reply.code(404).send({ error: "Community not found" });
    if (!(await canReadCommunity(communityId, userId))) {
      return reply.code(403).send({ error: "Join this private community to view data-union records" });
    }

    const [policies, consents, products, accessGrants, buyers, settlements, claims] = await Promise.all([
      prisma.dataUnionPolicy.findMany({ where: { communityId }, orderBy: [{ status: "asc" }, { createdAt: "asc" }] }),
      prisma.dataUnionConsent.findMany({ where: { communityId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      prisma.dataUnionProduct.findMany({ where: { communityId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      prisma.dataUnionAccessGrant.findMany({ where: { communityId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      prisma.dataUnionBuyer.findMany({ where: { communityId }, orderBy: [{ status: "asc" }, { createdAt: "asc" }] }),
      prisma.dataUnionSettlement.findMany({ where: { communityId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      prisma.dataUnionClaim.findMany({ where: { communityId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] })
    ]);
    const policyViews = policies.map(toDataUnionPolicyResponse);
    const consentViews = consents.map(toDataUnionConsentResponse);
    const productViews = products.map(toDataUnionProductResponse);
    const accessGrantViews = accessGrants.map(toDataUnionAccessGrantResponse);
    const buyerViews = buyers.map(toDataUnionBuyerResponse);
    const settlementViews = settlements.map(toDataUnionSettlementResponse);
    const claimViews = claims.map(toDataUnionClaimResponse);
    const activePolicy = activeDataUnionPolicy(policyViews);
    return {
      protocol: buildDataUnionProtocol(communityId, activePolicy, policyViews, consentViews, productViews, accessGrantViews, buyerViews, settlementViews, claimViews),
      communityId,
      activePolicy,
      policies: policyViews,
      consents: consentViews,
      products: productViews,
      accessGrants: accessGrantViews,
      buyers: buyerViews,
      settlements: settlementViews,
      claims: claimViews
    };
  });

  app.post("/communities/:communityId/data-union/policies", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const input = ProposeDataUnionPolicyRequestSchema.parse(request.body ?? {});
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply, request);
    if (!stewardCheck) return;
    if (!(await ensureCommunityProtocolWritable(communityId, reply))) return;

    const policyId = `data-union-policy-${nanoid(10)}`;
    const purposeHash = hashJson({ purpose: input.purpose });
    const consentRevocationRuleHash = hashJson({ consentRevocationRule: input.consentRevocationRule });
    const revenueSplitHash = hashJson(input.revenueSplit);
    const policyArtifact = await artifactStore.write(
      withArtifactSchema("data-union-policy", {
        policyId,
        communityId,
        title: input.title,
        purpose: input.purpose,
        purposeHash,
        allowedProductTypes: input.allowedProductTypes,
        minimumCohortSize: input.minimumCohortSize,
        consentRevocationRule: input.consentRevocationRule,
        consentRevocationRuleHash,
        dataRetentionDays: input.dataRetentionDays,
        revenueSplit: input.revenueSplit,
        revenueSplitHash,
        proposedBy: input.steward,
        privacyBoundary: "aggregate-products-only-no-raw-ballots"
      })
    );
    await storeArtifact(policyArtifact, "data-union-policy");
    const policyProposedEvent = prepareProtocolEvent({
      eventType: "DataUnionPolicyProposed",
      subjectId: policyId,
      actor: input.steward,
      previousHash: null,
      newHash: policyArtifact.hash
    });
    const policy = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, policyProposedEvent);
      const created = await tx.dataUnionPolicy.create({
        data: {
          id: policyId,
          communityId,
          title: input.title,
          purposeHash,
          allowedProductTypes: input.allowedProductTypes,
          minimumCohortSize: input.minimumCohortSize,
          consentRevocationRuleHash,
          dataRetentionDays: input.dataRetentionDays,
          revenueSplitJson: JSON.stringify(input.revenueSplit),
          status: "Proposed",
          policyHash: policyArtifact.hash,
          proposedBy: input.steward
        }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return created;
    });
    return { policy: toDataUnionPolicyResponse(policy), policyArtifact };
  });

  app.post("/communities/:communityId/data-union/policies/:policyId/activate", async (request, reply) => {
    const { communityId, policyId } = request.params as { communityId: string; policyId: string };
    const input = ActivateDataUnionPolicyRequestSchema.parse(request.body ?? {});
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply, request);
    if (!stewardCheck) return;
    if (!(await ensureCommunityProtocolWritable(communityId, reply))) return;

    const policy = await prisma.dataUnionPolicy.findUnique({ where: { id: policyId } });
    if (!policy || policy.communityId !== communityId) return reply.code(404).send({ error: "Data-union policy not found" });
    if (policy.status !== "Proposed") return reply.code(409).send({ error: "Only proposed data-union policies can be activated" });
    const effectiveAt = input.effectiveAt !== undefined ? new Date(input.effectiveAt) : new Date();
    const activationArtifact = await artifactStore.write(
      withArtifactSchema("data-union-policy-activation", {
        communityId,
        policyId,
        activatedBy: input.steward,
        activationRecord: input.activationRecord,
        policyHash: policy.policyHash,
        effectiveAt: effectiveAt.getTime()
      })
    );
    await storeArtifact(activationArtifact, "data-union-policy-activation");
    const policyActivatedEvent = prepareProtocolEvent({
      eventType: "DataUnionPolicyActivated",
      subjectId: policyId,
      actor: input.steward,
      previousHash: policy.policyHash,
      newHash: activationArtifact.hash
    });
    const activated = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, policyActivatedEvent);
      await tx.dataUnionPolicy.updateMany({ where: { communityId, status: "Active" }, data: { status: "Suspended" } });
      const active = await tx.dataUnionPolicy.update({
        where: { id: policyId },
        data: {
          status: "Active",
          activationHash: activationArtifact.hash,
          activatedBy: input.steward,
          effectiveAt
        }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return active;
    });
    return { policy: toDataUnionPolicyResponse(activated), activationArtifact };
  });

  app.post("/communities/:communityId/data-union/consents", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const input = RecordDataUnionConsentRequestSchema.parse(request.body ?? {});
    if (!(await requireAuthenticatedActor(request, reply, input.userId))) return;
    if (!(await ensureCommunityProtocolWritable(communityId, reply))) return;

    const [community, user, membership] = await Promise.all([
      prisma.community.findUnique({ where: { id: communityId } }),
      prisma.userAccount.findUnique({ where: { id: input.userId } }),
      prisma.communityMember.findUnique({ where: { communityId_userId: { communityId, userId: input.userId } } })
    ]);
    if (!community || !user) return reply.code(404).send({ error: "Community or account not found" });
    if (!membership || membership.status !== "Active") return reply.code(403).send({ error: "Join this community before opting in to its data union" });

    const policy = input.policyId
      ? await prisma.dataUnionPolicy.findUnique({ where: { id: input.policyId } })
      : await prisma.dataUnionPolicy.findFirst({
          where: { communityId, status: "Active" },
          orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }]
        });
    if (!policy || policy.communityId !== communityId) return reply.code(404).send({ error: "Active data-union policy not found" });
    if (policy.status !== "Active") return reply.code(409).send({ error: "Data-union consent requires an active policy" });

    const existing = await prisma.dataUnionConsent.findUnique({
      where: { policyId_userId_scope: { policyId: policy.id, userId: input.userId, scope: input.scope } }
    });
    const consentId = existing?.id ?? `data-union-consent-${nanoid(10)}`;
    const consentArtifact = await artifactStore.write(
      withArtifactSchema("data-union-consent", {
        consentId,
        communityId,
        policyId: policy.id,
        userId: input.userId,
        scope: input.scope,
        consentStatement: input.consentStatement,
        policyHash: policy.policyHash,
        activationHash: policy.activationHash,
        recordedAt: Date.now()
      })
    );
    await storeArtifact(consentArtifact, "data-union-consent");
    const consentRecordedEvent = prepareProtocolEvent({
      eventType: "DataUnionConsentRecorded",
      subjectId: consentId,
      actor: input.userId,
      previousHash: existing?.consentHash ?? null,
      newHash: consentArtifact.hash
    });
    const consent = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, consentRecordedEvent);
      const upserted = await tx.dataUnionConsent.upsert({
        where: { policyId_userId_scope: { policyId: policy.id, userId: input.userId, scope: input.scope } },
        update: {
          status: "Active",
          consentHash: consentArtifact.hash,
          revokedHash: null,
          revokedAt: null
        },
        create: {
          id: consentId,
          communityId,
          policyId: policy.id,
          userId: input.userId,
          scope: input.scope,
          status: "Active",
          consentHash: consentArtifact.hash
        }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return upserted;
    });
    return { consent: toDataUnionConsentResponse(consent), consentArtifact };
  });

  app.post("/communities/:communityId/data-union/consents/:consentId/revoke", async (request, reply) => {
    const { communityId, consentId } = request.params as { communityId: string; consentId: string };
    const input = RevokeDataUnionConsentRequestSchema.parse(request.body ?? {});
    if (!(await requireAuthenticatedActor(request, reply, input.userId))) return;
    if (!(await ensureCommunityProtocolWritable(communityId, reply))) return;
    const consent = await prisma.dataUnionConsent.findUnique({ where: { id: consentId }, include: { policy: true } });
    if (!consent || consent.communityId !== communityId) return reply.code(404).send({ error: "Data-union consent not found" });
    if (consent.userId !== input.userId) return reply.code(403).send({ error: "Only the consenting member can revoke this data-union consent" });
    if (consent.status === "Revoked") return reply.code(409).send({ error: "Data-union consent is already revoked" });
    const revocationArtifact = await artifactStore.write(
      withArtifactSchema("data-union-consent-revocation", {
        consentId,
        communityId,
        policyId: consent.policyId,
        userId: input.userId,
        scope: consent.scope,
        consentHash: consent.consentHash,
        policyHash: consent.policy.policyHash,
        revocationReason: input.revocationReason,
        revokedAt: Date.now()
      })
    );
    await storeArtifact(revocationArtifact, "data-union-consent-revocation");
    const consentRevokedEvent = prepareProtocolEvent({
      eventType: "DataUnionConsentRevoked",
      subjectId: consentId,
      actor: input.userId,
      previousHash: consent.consentHash,
      newHash: revocationArtifact.hash
    });
    const revoked = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, consentRevokedEvent);
      const updated = await tx.dataUnionConsent.update({
        where: { id: consentId },
        data: {
          status: "Revoked",
          revokedHash: revocationArtifact.hash,
          revokedAt: new Date()
        }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return updated;
    });
    return { consent: toDataUnionConsentResponse(revoked), revocationArtifact };
  });

  app.post("/communities/:communityId/data-union/products", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const input = PublishDataUnionProductRequestSchema.parse(request.body ?? {});
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply, request);
    if (!stewardCheck) return;
    if (!(await ensureCommunityProtocolWritable(communityId, reply))) return;

    const policy = input.policyId
      ? await prisma.dataUnionPolicy.findUnique({ where: { id: input.policyId } })
      : await prisma.dataUnionPolicy.findFirst({
          where: { communityId, status: "Active" },
          orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }]
        });
    if (!policy || policy.communityId !== communityId) return reply.code(404).send({ error: "Active data-union policy not found" });
    if (policy.status !== "Active") return reply.code(409).send({ error: "Data-union product publication requires an active policy" });
    if (!policy.allowedProductTypes.includes(input.productType)) return reply.code(409).send({ error: "Product type is not allowed by the active data-union policy" });

    const result = await prisma.result.findUnique({
      where: { id: input.resultId },
      include: { poll: { include: { question: true } } }
    });
    if (!result || result.poll.question.communityId !== communityId) return reply.code(404).send({ error: "Result not found in this community" });
    if (!["Published", "Finalized", "Corrected"].includes(result.finalStatus)) {
      return reply.code(409).send({ error: "Only published or finalized aggregate results can become data-union products" });
    }
    const activeConsentCount = await prisma.dataUnionConsent.count({
      where: { communityId, policyId: policy.id, status: "Active", scope: "AggregateAnalytics" }
    });
    const cohortSize = Math.min(result.turnout, activeConsentCount);
    if (cohortSize < policy.minimumCohortSize) {
      return reply.code(409).send({
        error: "Data-union product does not meet the policy cohort threshold",
        cohortSize,
        minimumCohortSize: policy.minimumCohortSize,
        resultTurnout: result.turnout,
        activeConsentCount
      });
    }

    const productId = `data-union-product-${nanoid(10)}`;
    const descriptionHash = hashJson({ description: input.description });
    const methodologyHash = hashJson({ methodology: input.methodology });
    const privacyReport = {
      productId,
      communityId,
      policyId: policy.id,
      resultId: result.id,
      productType: input.productType,
      minimumCohortSize: policy.minimumCohortSize,
      cohortSize,
      resultTurnout: result.turnout,
      activeConsentCount,
      sourceResultPrivacyReportHash: result.privacyReportHash,
      rawBallotsIncluded: false,
      identifiableResponsesIncluded: false,
      notes: input.privacyNotes
    };
    const privacyReportHash = hashJson(privacyReport);
    const dataProductArtifact = await artifactStore.write(
      withArtifactSchema("data-union-product", {
        productId,
        communityId,
        policyId: policy.id,
        resultId: result.id,
        pollId: result.pollId,
        questionId: result.poll.questionId,
        productType: input.productType,
        title: input.title,
        description: input.description,
        descriptionHash,
        methodology: input.methodology,
        methodologyHash,
        aggregateResultReferences: {
          resultArtifactHash: result.resultArtifactHash,
          aggregateCountsHash: result.aggregateCountsHash,
          tallyProofHash: result.tallyProofHash,
          tallyPublicationProofHash: result.tallyPublicationProofHash,
          privacyReportHash: result.privacyReportHash
        },
        privacyReport,
        privacyReportHash,
        cohortSize,
        minimumCohortSize: policy.minimumCohortSize,
        revenueSplit: parseDataUnionRevenueSplit(policy.revenueSplitJson),
        pricePc: input.pricePc,
        publishedBy: input.steward
      })
    );
    await storeArtifact(dataProductArtifact, "data-union-product");
    const productPublishedEvent = prepareProtocolEvent({
      eventType: "DataUnionProductPublished",
      subjectId: productId,
      actor: input.steward,
      previousHash: result.resultArtifactHash,
      newHash: dataProductArtifact.hash
    });
    const product = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, productPublishedEvent);
      const created = await tx.dataUnionProduct.create({
        data: {
          id: productId,
          communityId,
          policyId: policy.id,
          resultId: result.id,
          productType: input.productType,
          title: input.title,
          descriptionHash,
          dataProductHash: dataProductArtifact.hash,
          privacyReportHash,
          methodologyHash,
          minimumCohortSize: policy.minimumCohortSize,
          cohortSize,
          pricePc: input.pricePc,
          status: "Published",
          createdBy: input.steward
        }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return created;
    });
    return { product: toDataUnionProductResponse(product), productArtifact: dataProductArtifact };
  });

  app.post("/communities/:communityId/data-union/buyers", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const input = ApproveDataUnionBuyerRequestSchema.parse(request.body ?? {});
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply, request);
    if (!stewardCheck) return;
    if (!(await ensureCommunityProtocolWritable(communityId, reply))) return;

    const existing = await prisma.dataUnionBuyer.findUnique({ where: { communityId_buyerId: { communityId, buyerId: input.buyerId } } });
    const buyerRecordId = existing?.id ?? `data-union-buyer-${nanoid(10)}`;
    const purposeHash = hashJson({ approvedPurpose: input.approvedPurpose });
    const eligibilityHash = hashJson({ eligibilityEvidence: input.eligibilityEvidence });
    const licenseTemplateHash = hashJson({ licenseTemplate: input.licenseTemplate, licenseTerms: input.licenseTerms });
    const approvalArtifact = await artifactStore.write(
      withArtifactSchema("data-union-buyer-approval", {
        buyerRecordId,
        communityId,
        buyerId: input.buyerId,
        buyerType: input.buyerType,
        allowedProductTypes: input.allowedProductTypes,
        approvedPurpose: input.approvedPurpose,
        purposeHash,
        eligibilityHash,
        licenseTemplate: input.licenseTemplate,
        licenseTemplateHash,
        approvedBy: input.steward
      })
    );
    await storeArtifact(approvalArtifact, "data-union-buyer-approval");
    const buyerApprovedEvent = prepareProtocolEvent({
      eventType: "DataUnionBuyerApproved",
      subjectId: buyerRecordId,
      actor: input.steward,
      previousHash: existing?.approvalHash ?? null,
      newHash: approvalArtifact.hash
    });
    const buyer = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, buyerApprovedEvent);
      const upserted = await tx.dataUnionBuyer.upsert({
        where: { communityId_buyerId: { communityId, buyerId: input.buyerId } },
        update: {
          buyerType: input.buyerType,
          status: "Approved",
          allowedProductTypes: input.allowedProductTypes,
          purposeHash,
          eligibilityHash,
          licenseTemplate: input.licenseTemplate,
          licenseTemplateHash,
          approvalHash: approvalArtifact.hash,
          approvedBy: input.steward,
          approvedAt: new Date(),
          suspendedAt: null
        },
        create: {
          id: buyerRecordId,
          communityId,
          buyerId: input.buyerId,
          buyerType: input.buyerType,
          status: "Approved",
          allowedProductTypes: input.allowedProductTypes,
          purposeHash,
          eligibilityHash,
          licenseTemplate: input.licenseTemplate,
          licenseTemplateHash,
          approvalHash: approvalArtifact.hash,
          approvedBy: input.steward
        }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return upserted;
    });
    return { buyer: toDataUnionBuyerResponse(buyer), approvalArtifact };
  });

  app.post("/communities/:communityId/data-union/products/:productId/access-grants", async (request, reply) => {
    const { communityId, productId } = request.params as { communityId: string; productId: string };
    const input = GrantDataUnionAccessRequestSchema.parse(request.body ?? {});
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply, request);
    if (!stewardCheck) return;
    if (!(await ensureCommunityProtocolWritable(communityId, reply))) return;

    const product = await prisma.dataUnionProduct.findUnique({ where: { id: productId }, include: { policy: true } });
    if (!product || product.communityId !== communityId) return reply.code(404).send({ error: "Data-union product not found" });
    if (product.status !== "Published") return reply.code(409).send({ error: "Only published data-union products can receive access grants" });
    const buyer = await prisma.dataUnionBuyer.findUnique({ where: { communityId_buyerId: { communityId, buyerId: input.buyerId } } });
    if (!buyer || buyer.status !== "Approved") return reply.code(403).send({ error: "Data-union buyer must be steward-approved before access is granted" });
    if (buyer.buyerType !== input.buyerType) return reply.code(409).send({ error: "Data-union buyer type does not match the approved buyer record" });
    if (!buyer.allowedProductTypes.includes(product.productType)) return reply.code(409).send({ error: "Approved buyer is not eligible for this product type" });
    if (buyer.licenseTemplate !== input.licenseTemplate) return reply.code(409).send({ error: "Access grant license template does not match the approved buyer license" });
    const paymentPc = input.paymentPc ?? product.pricePc;
    const split = splitDataUnionPayment(paymentPc, parseDataUnionRevenueSplit(product.policy.revenueSplitJson));
    const grantId = `data-union-access-${nanoid(10)}`;
    const purposeHash = hashJson({ accessPurpose: input.accessPurpose });
    const licenseHash = hashJson({ license: input.license });
    const accessArtifact = await artifactStore.write(
      withArtifactSchema("data-union-access-grant", {
        grantId,
        communityId,
        productId,
        buyerId: input.buyerId,
        buyerType: input.buyerType,
        accessPurpose: input.accessPurpose,
        purposeHash,
        licenseTemplate: input.licenseTemplate,
        license: input.license,
        licenseHash,
        paymentPc,
        revenueSplit: parseDataUnionRevenueSplit(product.policy.revenueSplitJson),
        treasuryPc: split.treasuryPc,
        participantPoolPc: split.participantPoolPc,
        pollAuthorRoyaltyPc: split.pollAuthorRoyaltyPc,
        operatorPoolPc: split.operatorPoolPc,
        productHash: product.dataProductHash,
        grantedBy: input.steward
      })
    );
    await storeArtifact(accessArtifact, "data-union-access-grant");
    const accessGrantedEvent = prepareProtocolEvent({
      eventType: "DataUnionAccessGranted",
      subjectId: grantId,
      actor: input.steward,
      previousHash: product.dataProductHash,
      newHash: accessArtifact.hash
    });
    const grant = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, accessGrantedEvent);
      const created = await tx.dataUnionAccessGrant.create({
        data: {
          id: grantId,
          communityId,
          productId,
          buyerId: input.buyerId,
          buyerType: input.buyerType,
          purposeHash,
          licenseTemplate: input.licenseTemplate,
          licenseHash,
          paymentPc,
          treasuryPc: split.treasuryPc,
          participantPoolPc: split.participantPoolPc,
          pollAuthorRoyaltyPc: split.pollAuthorRoyaltyPc,
          operatorPoolPc: split.operatorPoolPc,
          accessHash: accessArtifact.hash,
          status: "Active",
          grantedBy: input.steward
        }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return created;
    });
    return { accessGrant: toDataUnionAccessGrantResponse(grant), accessArtifact };
  });

  app.post("/communities/:communityId/data-union/access-grants/:grantId/settlements", async (request, reply) => {
    const { communityId, grantId } = request.params as { communityId: string; grantId: string };
    const input = RecordDataUnionSettlementRequestSchema.parse(request.body ?? {});
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply, request);
    if (!stewardCheck) return;
    if (!(await ensureCommunityProtocolWritable(communityId, reply))) return;
    if (input.feesPc > input.amountPc) return reply.code(400).send({ error: "Settlement fees cannot exceed the settlement amount" });

    const grant = await prisma.dataUnionAccessGrant.findUnique({
      where: { id: grantId },
      include: {
        product: {
          include: {
            policy: true,
            result: {
              include: {
                poll: { include: { question: { select: { id: true, proposer: true } } } }
              }
            }
          }
        }
      }
    });
    if (!grant || grant.communityId !== communityId) return reply.code(404).send({ error: "Data-union access grant not found" });
    if (grant.status !== "Active") return reply.code(409).send({ error: "Only active data-union access grants can be settled" });
    const existingSettled = await prisma.dataUnionSettlement.findFirst({ where: { accessGrantId: grantId, status: "Settled" } });
    if (existingSettled) return reply.code(409).send({ error: "Data-union access grant already has a settled payment" });

    const settledPc = input.status === "Settled" ? input.amountPc - input.feesPc : 0;
    const split = splitDataUnionPayment(settledPc, parseDataUnionRevenueSplit(grant.product.policy.revenueSplitJson));
    const settlementId = `data-union-settlement-${nanoid(10)}`;
    const externalReferenceHash = hashJson({ rail: input.rail, externalReference: input.externalReference });
    const settlementProofHash = hashJson({ settlementProof: input.settlementProof });
    const settlementHash = hashJson({
      settlementId,
      communityId,
      accessGrantId: grantId,
      rail: input.rail,
      unit: input.unit,
      amountPc: input.amountPc,
      feesPc: input.feesPc,
      settledPc,
      externalReferenceHash,
      settlementProofHash,
      status: input.status
    });
    const settledAt = input.settledAt !== undefined ? new Date(input.settledAt) : input.status === "Settled" ? new Date() : null;
    const settlementArtifact = await artifactStore.write(
      withArtifactSchema("data-union-settlement", {
        settlementId,
        communityId,
        accessGrantId: grantId,
        productId: grant.productId,
        buyerId: grant.buyerId,
        rail: input.rail,
        unit: input.unit,
        amountPc: input.amountPc,
        feesPc: input.feesPc,
        settledPc,
        externalReferenceHash,
        settlementProofHash,
        settlementHash,
        status: input.status,
        revenueSplit: parseDataUnionRevenueSplit(grant.product.policy.revenueSplitJson),
        treasuryPc: split.treasuryPc,
        participantPoolPc: split.participantPoolPc,
        pollAuthorRoyaltyPc: split.pollAuthorRoyaltyPc,
        operatorPoolPc: split.operatorPoolPc,
        recordedBy: input.steward,
        settledAt: settledAt?.getTime() ?? null
      })
    );
    await storeArtifact(settlementArtifact, "data-union-settlement");
    const settlementRecordedEvent = prepareProtocolEvent({
      eventType: "DataUnionSettlementRecorded",
      subjectId: settlementId,
      actor: input.steward,
      previousHash: grant.accessHash,
      newHash: settlementArtifact.hash
    });
    const { settlement, claims } = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, settlementRecordedEvent);
      const created = await tx.dataUnionSettlement.create({
        data: {
          id: settlementId,
          communityId,
          accessGrantId: grantId,
          rail: input.rail,
          unit: input.unit,
          amountPc: input.amountPc,
          feesPc: input.feesPc,
          settledPc,
          externalReferenceHash,
          settlementProofHash,
          settlementHash: settlementArtifact.hash,
          status: input.status,
          recordedBy: input.steward,
          settledAt
        }
      });
      const generatedClaims =
        input.status === "Settled"
          ? await createDataUnionSettlementClaims(tx, {
              communityId,
              grant,
              settlementId,
              split
            })
          : [];
      if (input.status === "Settled") {
        await tx.dataUnionAccessGrant.update({
          where: { id: grantId },
          data: {
            paymentPc: input.amountPc,
            treasuryPc: split.treasuryPc,
            participantPoolPc: split.participantPoolPc,
            pollAuthorRoyaltyPc: split.pollAuthorRoyaltyPc,
            operatorPoolPc: split.operatorPoolPc
          }
        });
      }
      await recordProtocolCommitments(protocolEvent, tx);
      return { settlement: created, claims: generatedClaims };
    });
    return {
      settlement: toDataUnionSettlementResponse(settlement),
      claims: claims.map(toDataUnionClaimResponse),
      settlementArtifact
    };
  });

  app.post("/communities/:communityId/data-union/access-grants/:grantId/claims", async (request, reply) => {
    const { communityId, grantId } = request.params as { communityId: string; grantId: string };
    const input = RedeemDataUnionClaimRequestSchema.parse(request.body ?? {});
    if (input.demoClaimantId && !input.receiptSecret && !config.demoMode) {
      return reply.code(403).send({ error: "Explicit demo data-union claims are disabled outside demo mode" });
    }
    if (!(await ensureCommunityProtocolWritable(communityId, reply))) return;

    const [grant, destinationAccount] = await Promise.all([
      prisma.dataUnionAccessGrant.findUnique({ where: { id: grantId } }),
      prisma.userAccount.findUnique({ where: { id: input.destinationAccount }, select: { id: true } })
    ]);
    if (!grant || grant.communityId !== communityId) return reply.code(404).send({ error: "Data-union access grant not found" });
    if (!destinationAccount) return reply.code(404).send({ error: "Destination account not found" });

    const receiptHash = input.receiptSecret ? participationReceiptHash(input.receiptSecret) : null;
    const claim = receiptHash
      ? await prisma.dataUnionClaim.findFirst({ where: { communityId, accessGrantId: grantId, role: "Participant", receiptHash } })
      : await prisma.dataUnionClaim.findFirst({
          where: { communityId, accessGrantId: grantId, role: "Participant", claimantId: input.demoClaimantId ?? "" }
        });
    if (!claim) return reply.code(404).send({ error: "Data-union participant claim not found" });
    if (claim.status !== "Claimable") return reply.code(409).send({ error: "Data-union participant claim has already been redeemed" });

    const redemptionNullifier = hashJson({
      protocol: "pc-data-union-claim-redemption-v1",
      accessGrantId: grantId,
      receiptSecret: input.receiptSecret ?? null,
      demoClaimantId: input.demoClaimantId ?? null
    });
    const redemptionArtifact = await artifactStore.write(
      withArtifactSchema("data-union-claim-redemption", {
        claimId: claim.id,
        claimHash: claim.claimHash,
        communityId,
        accessGrantId: grantId,
        settlementId: claim.settlementId,
        productId: claim.productId,
        amountPc: claim.amountPc,
        destinationAccountHash: hashJson({ destinationAccount: input.destinationAccount }),
        redemptionNullifier,
        redeemedAt: Date.now()
      })
    );
    await storeArtifact(redemptionArtifact, "data-union-claim-redemption");
    const claimRedeemedEvent = prepareProtocolEvent({
      eventType: "DataUnionClaimRedeemed",
      subjectId: claim.id,
      actor: "private-data-union-claimant",
      previousHash: claim.claimHash,
      newHash: redemptionArtifact.hash
    });
    const redeemed = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, claimRedeemedEvent);
      const updated = await tx.dataUnionClaim.updateMany({
        where: { id: claim.id, status: "Claimable" },
        data: {
          status: "Claimed",
          claimantId: input.destinationAccount,
          redemptionHash: redemptionArtifact.hash,
          redemptionNullifier,
          claimedAt: new Date()
        }
      });
      if (updated.count !== 1) return null;
      await recordProtocolCommitments(protocolEvent, tx);
      return tx.dataUnionClaim.findUnique({ where: { id: claim.id } });
    });
    if (!redeemed) return reply.code(409).send({ error: "Data-union participant claim has already been redeemed" });
    return {
      redeemed: true,
      claim: toDataUnionClaimResponse(redeemed),
      redemptionArtifact
    };
  });

  app.get("/communities/:communityId/treasury/ledger", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const { userId, questionId, accountId } = request.query as { userId?: string; questionId?: string; accountId?: string };
    const community = await prisma.community.findUnique({ where: { id: communityId } });
    if (!community) return reply.code(404).send({ error: "Community not found" });
    if (!(await canReadCommunity(communityId, userId))) {
      return reply.code(403).send({ error: "Join this private community to view treasury accounting" });
    }

    const questions = await prisma.question.findMany({
      where: { communityId, ...(questionId ? { id: questionId } : {}) },
      select: { id: true }
    });
    if (questionId && questions.length === 0) return reply.code(404).send({ error: "Question not found in this community" });

    const bonds = questions.length
      ? await prisma.bond.findMany({
          where: { questionId: { in: questions.map((question) => question.id) } },
          orderBy: { createdAt: "asc" }
        })
      : [];
    const dataUnionAccessGrants = await prisma.dataUnionAccessGrant.findMany({
      where: {
        communityId,
        status: "Active",
        ...(questionId
          ? {
              product: {
                result: {
                  poll: {
                    questionId
                  }
                }
              }
            }
          : {})
      },
      include: {
        product: { include: { result: { include: { poll: { include: { question: { select: { proposer: true } } } } } } } },
        settlements: true
      },
      orderBy: { createdAt: "asc" }
    });
    const allEntries = sortTreasuryLedgerEntries([
      ...buildTreasuryLedgerEntries(communityId, bonds),
      ...buildDataUnionTreasuryLedgerEntries(communityId, dataUnionAccessGrants)
    ]);
    const entries = accountId ? allEntries.filter((entry) => entry.accountId === accountId) : allEntries;
    const scopedBonds = accountId ? bonds.filter((bond) => entries.some((entry) => entry.bondId === bond.id)) : bonds;
    const totals = buildTreasuryLedgerTotals(entries, scopedBonds);
    return {
      protocol: buildTreasuryLedgerProtocol(communityId, entries, totals, {
        questionId: questionId ?? null,
        accountId: accountId ?? null
      }),
      communityId,
      entries,
      totals
    };
  });

  app.get("/communities/:communityId/steward-powers", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const { userId } = request.query as { userId?: string };
    const community = await prisma.community.findUnique({
      where: { id: communityId },
      include: {
        memberships: {
          where: { status: "Active", role: { in: [...CURATOR_ROLES] } },
          orderBy: [{ role: "asc" }, { createdAt: "asc" }],
          include: { user: { select: { profileId: true, profileHash: true } } }
        },
        emergencySuspensions: { orderBy: { createdAt: "desc" } }
      }
    });
    if (!community) return reply.code(404).send({ error: "Community not found" });
    if (!(await canReadCommunity(communityId, userId))) {
      return reply.code(403).send({ error: "Join this private community to view steward powers" });
    }
    const emergencySuspensions = community.emergencySuspensions;
    const activeEmergencySuspension = emergencySuspensions.find((suspension) => suspension.status === "Active") ?? null;
    const activeStewards = community.memberships.map((member) => ({
      userId: member.userId,
      role: normalizeStewardRole(member.role),
      status: member.status,
      profileId: member.user.profileId,
      profileHash: member.user.profileHash
    }));
    return {
      protocol: buildStewardPowersProtocol(communityId, STEWARD_POWERS, activeStewards, emergencySuspensions, activeEmergencySuspension),
      communityId,
      powers: STEWARD_POWERS,
      activeStewards,
      emergencySuspensions,
      activeEmergencySuspension
    };
  });

  app.post("/communities/:communityId/emergency-suspensions", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const input = CreateCommunityEmergencySuspensionRequestSchema.parse(request.body ?? {});
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply, request);
    if (!stewardCheck) return;
    const existing = await activeCommunityEmergencySuspension(communityId);
    if (existing) return reply.code(409).send({ error: "Community already has an active emergency suspension", suspension: existing });

    const suspensionArtifact = await artifactStore.write(
      withArtifactSchema("community-emergency-suspension", {
        communityId,
        scope: input.scope,
        suspendedBy: input.steward,
        reason: input.reason,
        suspendedAt: Date.now()
      })
    );
    await storeArtifact(suspensionArtifact, "community-emergency-suspension");
    const emergencySuspendedEvent = prepareProtocolEvent({
      eventType: "CommunityEmergencySuspended",
      subjectId: communityId,
      actor: input.steward,
      previousHash: null,
      newHash: suspensionArtifact.hash
    });
    const suspension = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, emergencySuspendedEvent);
      const active = await tx.communityEmergencySuspension.create({
        data: {
          id: `emergency-suspension-${nanoid(10)}`,
          communityId,
          scope: input.scope,
          reasonHash: suspensionArtifact.hash,
          suspendedBy: input.steward,
          status: "Active"
        }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return active;
    });
    return { suspension, suspensionArtifact };
  });

  app.post("/communities/:communityId/emergency-suspensions/:suspensionId/resolve", async (request, reply) => {
    const { communityId, suspensionId } = request.params as { communityId: string; suspensionId: string };
    const input = ResolveCommunityEmergencySuspensionRequestSchema.parse(request.body ?? {});
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply, request);
    if (!stewardCheck) return;
    const suspension = await prisma.communityEmergencySuspension.findUnique({ where: { id: suspensionId } });
    if (!suspension || suspension.communityId !== communityId) return reply.code(404).send({ error: "Emergency suspension not found" });
    if (suspension.status !== "Active") return reply.code(409).send({ error: "Emergency suspension is already resolved" });

    const resolutionArtifact = await artifactStore.write(
      withArtifactSchema("community-emergency-resolution", {
        communityId,
        suspensionId,
        resolvedBy: input.steward,
        resolution: input.resolution,
        resolvedAt: Date.now()
      })
    );
    await storeArtifact(resolutionArtifact, "community-emergency-resolution");
    const emergencyResolvedEvent = prepareProtocolEvent({
      eventType: "CommunityEmergencyResolved",
      subjectId: communityId,
      actor: input.steward,
      previousHash: suspension.reasonHash,
      newHash: resolutionArtifact.hash
    });
    const resolved = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, emergencyResolvedEvent);
      const inactive = await tx.communityEmergencySuspension.update({
        where: { id: suspensionId },
        data: {
          status: "Resolved",
          resolutionHash: resolutionArtifact.hash,
          resolvedBy: input.steward,
          resolvedAt: new Date()
        }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return inactive;
    });
    return { suspension: resolved, resolutionArtifact };
  });

  app.get("/public/questions/:questionId/civic-record", async (request, reply) => {
    const { questionId } = request.params as { questionId: string };
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        community: true,
        challenges: true,
        challengeAppeals: { orderBy: { createdAt: "asc" } },
        jurorAssignments: { orderBy: { createdAt: "asc" } },
        poll: { include: { result: true, resultChallenges: true } },
        archiveRecord: true,
        _count: { select: { discussionPosts: true } }
      }
    });
    if (!question) return reply.code(404).send({ error: "Question not found" });
    if (!(await canReadQuestion(question, undefined))) {
      return reply.code(403).send({ error: "This question record is not public" });
    }
    const [events, commitmentRecords] = await Promise.all([
      prisma.registryEvent.findMany({ where: { subjectId: questionId }, orderBy: REGISTRY_EVENT_ORDER }),
      prisma.protocolCommitmentRecord.findMany({ where: { subjectId: questionId }, orderBy: COMMITMENT_RECORD_ORDER })
    ]);
    const commitments = commitmentRecords.map(toCommitmentView);
    const archiveArtifact = question.archiveRecord
      ? await artifactStore.read<{ artifactManifestHash?: string }>(question.archiveRecord.archiveHash).catch(() => null)
      : null;
    const [challengeAppeals, jurorAssignments, credentialIssuerAnnotations] = await Promise.all([
      hydrateChallengeAppeals(question.challengeAppeals, artifactStore),
      Promise.all(question.jurorAssignments.map((assignment) => hydrateJurorAssignment(assignment, artifactStore))),
      credentialIssuerAnnotationsForQuestions([question])
    ]);
    return {
      protocol: buildCivicRecordProtocol(question, events, archiveArtifact, commitments, credentialIssuerAnnotations),
      question: enrichQuestion(question),
      events,
      commitments,
      challenges: question.challenges,
      resultChallenges: question.poll?.resultChallenges ?? [],
      challengeAppeals,
      jurorAssignments,
      credentialIssuerAnnotations,
      result: question.poll?.result
        ? {
            pollId: question.poll.id,
            resultArtifactHash: question.poll.result.resultArtifactHash,
            aggregateCountsHash: question.poll.result.aggregateCountsHash,
            individualResultHash: question.poll.result.individualResultHash,
            communityBlockResultHash: question.poll.result.communityBlockResultHash,
            tallyProofHash: question.poll.result.tallyProofHash,
            tallyPublicationProofHash: question.poll.result.tallyPublicationProofHash,
            turnout: question.poll.result.turnout,
            invalidBallots: question.poll.result.invalidBallots,
            privacyReportHash: question.poll.result.privacyReportHash,
            finalStatus: question.poll.result.finalStatus,
            authorityLevel: question.authorityLevel
          }
        : null,
      archiveRecord: question.archiveRecord,
      discussionCount: question._count.discussionPosts
    };
  });

  app.get("/public/questions/:questionId/replay-check", async (request, reply) => {
    const { questionId } = request.params as { questionId: string };
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        community: true,
        poll: { include: { result: true } },
        archiveRecord: true
      }
    });
    if (!question) return reply.code(404).send({ error: "Question not found" });
    if (!(await canReadQuestion(question, undefined))) {
      return reply.code(403).send({ error: "This question record is not public" });
    }

    const events = await prisma.registryEvent.findMany({ where: { subjectId: questionId }, orderBy: REGISTRY_EVENT_ORDER });
    const replay = await buildReplayCheck(question, events, artifactStore);
    return {
      protocol: buildReplayCheckProtocol(question, events, replay),
      questionId,
      status: replay.allPassed ? "Verified" : "Mismatch",
      eventStreamHash: replay.eventStreamHash,
      rebuilt: replay.rebuilt,
      checks: replay.checks
    };
  });

  app.get("/registry/events", async (request) => {
    const { subjectId, eventType, actor } = request.query as { subjectId?: string; eventType?: string; actor?: string };
    const page = parsePageQuery(request.query);
    const where: Prisma.RegistryEventWhereInput = {
      ...(subjectId ? { subjectId } : {}),
      ...(eventType ? { eventType } : {}),
      ...(actor ? { actor } : {})
    };
    const [events, total] = await Promise.all([
      prisma.registryEvent.findMany({
        where,
        orderBy: REGISTRY_EVENT_ORDER,
        skip: page.offset,
        take: page.limit
      }),
      prisma.registryEvent.count({ where })
    ]);
    const viewerId = await effectiveViewerId(request);
    const visibleEvents = config.demoMode ? events : await redactRegistryEventsForViewer(events, viewerId);
    const eventIds = visibleEvents.map((event) => event.id);
    const commitments = eventIds.length
      ? (
          await prisma.protocolCommitmentRecord.findMany({
            where: { sourceEventId: { in: eventIds } },
            orderBy: COMMITMENT_RECORD_ORDER
          })
	        ).map(toCommitmentView)
	      : [];
    const pageInfo = buildPageInfo(page, config.demoMode ? total : visibleEvents.length);
    return { protocol: buildRegistryEventsProtocol(visibleEvents, pageInfo, commitments), page: pageInfo, events: visibleEvents, commitments };
  });

  app.get("/registry/protocol-transactions/replay", async (request) => {
    const records = await prisma.protocolTransactionResult.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });
    const viewerId = await effectiveViewerId(request);
    const transactions = config.demoMode ? records.map(toProtocolTransactionView) : await redactProtocolTransactionsForViewer(records.map(toProtocolTransactionView), viewerId);
    const replay = buildProtocolIndexerReplay(transactions);
    return {
      protocol: buildProtocolIndexerReplayProtocol(replay),
      status: replay.allPassed ? "Verified" : "Mismatch",
      readOnly: true,
      rebuilt: replay.rebuilt,
      transactions: replay.transactions,
      events: replay.events,
      checks: replay.checks
    };
  });

  app.get("/registry/protocol-transactions", async (request) => {
    const { sourceModule, eventType, subjectId, actor } = request.query as {
      sourceModule?: string;
      eventType?: string;
      subjectId?: string;
      actor?: string;
    };
    const page = parsePageQuery(request.query);
    const where: Prisma.ProtocolTransactionResultWhereInput = {
      ...(sourceModule ? { sourceModule } : {}),
      ...(eventType ? { eventType } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(actor ? { actor } : {})
    };
    const [records, total] = await Promise.all([
      prisma.protocolTransactionResult.findMany({
        where,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: page.offset,
        take: page.limit
      }),
      prisma.protocolTransactionResult.count({ where })
    ]);
    const viewerId = await effectiveViewerId(request);
    const transactions = config.demoMode ? records.map(toProtocolTransactionView) : await redactProtocolTransactionsForViewer(records.map(toProtocolTransactionView), viewerId);
    const pageInfo = buildPageInfo(page, config.demoMode ? total : transactions.length);
    return {
      protocol: buildProtocolTransactionsProtocol(transactions, pageInfo),
      page: pageInfo,
      transactions
    };
  });

  app.get("/registry/commitments", async (request) => {
    const { kind, subjectId, eventType, contractModule } = request.query as {
      kind?: string;
      subjectId?: string;
      eventType?: string;
      contractModule?: string;
    };
    const page = parsePageQuery(request.query);
    const where: Prisma.ProtocolCommitmentRecordWhereInput = {
      ...(kind ? { kind } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(eventType ? { eventType } : {}),
      ...(contractModule ? { contractModule } : {})
    };
    const [records, total] = await Promise.all([
      prisma.protocolCommitmentRecord.findMany({
        where,
        orderBy: COMMITMENT_RECORD_ORDER,
        skip: page.offset,
        take: page.limit
      }),
      prisma.protocolCommitmentRecord.count({ where })
    ]);
    const viewerId = await effectiveViewerId(request);
    const commitments = config.demoMode ? records.map(toCommitmentView) : await redactCommitmentsForViewer(records.map(toCommitmentView), viewerId);
    const pageInfo = buildPageInfo(page, config.demoMode ? total : commitments.length);
    return { protocol: buildCommitmentsProtocol(commitments, pageInfo), page: pageInfo, commitments };
  });

  app.get("/archives", async (request) => {
    const { userId, communityId, questionId, archivedBy } = request.query as {
      userId?: string;
      communityId?: string;
      questionId?: string;
      archivedBy?: string;
    };
    const page = parsePageQuery(request.query);
    const where: Prisma.ArchiveRecordWhereInput = {
      AND: [
        ...(questionId ? [{ questionId }] : []),
        ...(archivedBy ? [{ archivedBy }] : []),
        ...(communityId ? [{ question: { is: { communityId } } }] : []),
        { question: { is: readableQuestionWhere(userId) } }
      ]
    };
    const [archives, total] = await Promise.all([
      prisma.archiveRecord.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: page.offset,
        take: page.limit,
        include: {
          question: {
            select: {
              id: true,
              title: true,
              status: true,
              communityId: true,
              authorityLevel: true,
              adoptionPolicyId: true,
              poll: { select: { id: true, result: { select: { resultArtifactHash: true, finalStatus: true } } } }
            }
          }
        }
      }),
      prisma.archiveRecord.count({ where })
    ]);
    const pageInfo = buildPageInfo(page, total);
    return { protocol: buildArchivesProtocol(archives, pageInfo), page: pageInfo, archives };
  });

  app.get("/results/artifacts", async (request) => {
    const { userId, communityId, questionId, pollId, finalStatus, authorityLevel } = request.query as {
      userId?: string;
      communityId?: string;
      questionId?: string;
      pollId?: string;
      finalStatus?: string;
      authorityLevel?: string;
    };
    const page = parsePageQuery(request.query);
    const questionWhere: Prisma.QuestionWhereInput = {
      ...readableQuestionWhere(userId),
      ...(communityId ? { communityId } : {}),
      ...(authorityLevel ? { authorityLevel: normalizeAuthority(authorityLevel) } : {})
    };
    const where: Prisma.ResultWhereInput = {
      AND: [
        ...(pollId ? [{ pollId }] : []),
        ...(finalStatus ? [{ finalStatus }] : []),
        {
          poll: {
            is: {
              ...(questionId ? { questionId } : {}),
              question: { is: questionWhere }
            }
          }
        }
      ]
    };
    const [results, total] = await Promise.all([
      prisma.result.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip: page.offset,
        take: page.limit,
        include: {
          poll: {
            select: {
              id: true,
              questionId: true,
              question: { select: { communityId: true, authorityLevel: true, adoptionPolicyId: true, credentialSchemaId: true } }
            }
          }
        }
      }),
      prisma.result.count({ where })
    ]);
    const pageInfo = buildPageInfo(page, total);
    return { protocol: buildResultArtifactsProtocol(results, pageInfo), page: pageInfo, resultArtifacts: results.map(toResultArtifactSummary) };
  });

  app.get("/registry/bonds", async () => {
    const bonds = await prisma.bond.findMany({ orderBy: { createdAt: "asc" } });
    return { bonds };
  });

  app.get("/reputation/events", async (request) => {
    const { account } = request.query as { account?: string };
    const events = await prisma.reputationEvent.findMany({ where: account ? { account } : {}, orderBy: { createdAt: "asc" } });
    const totals = replayReputationTotals(events);
    return { protocol: buildReputationEventsProtocol(events, totals, account ?? null), events, totals };
  });

  app.get("/reputation/export", async (request) => {
    const { account } = request.query as { account?: string };
    const events = await prisma.reputationEvent.findMany({ where: account ? { account } : {}, orderBy: { createdAt: "asc" } });
    const totals = replayReputationTotals(events);
    const exportArtifact = await artifactStore.write(
      withArtifactSchema("reputation-export", {
        account: account ?? null,
        replayRule: "sum-weight-by-account",
        decayRule: DEFAULT_GOVERNANCE.reputationDecayRule,
        events,
        totals,
        exportedAt: Date.now()
      })
    );
    await storeArtifact(exportArtifact, "reputation-export");
    return { protocol: buildReputationExportProtocol(events, totals, exportArtifact.hash, account ?? null), events, totals, exportArtifact };
  });

  app.post("/reputation/replay", async (request) => {
    const input = ReputationReplayRequestSchema.parse(request.body ?? {});
    const totals = replayReputationTotals(input.events);
    const expectedTotals = input.expectedTotals ?? totals;
    const totalsMatch = sameRecordOfNumbers(totals, expectedTotals);
    const checks = [
      { id: "sum-weight-by-account", ok: true, expected: "sum reputation event weights by account", actual: totals },
      { id: "expected-totals", ok: totalsMatch, expected: expectedTotals, actual: totals },
      { id: "decay-rule", ok: true, expected: DEFAULT_GOVERNANCE.reputationDecayRule, actual: DEFAULT_GOVERNANCE.reputationDecayRule }
    ];
    return {
      protocol: buildReputationReplayProtocol(input.events, totals, checks),
      status: checks.every((check) => check.ok) ? "Verified" : "Mismatch",
      totals,
      checks
    };
  });

  app.get("/communities/:communityId/adoption", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const { userId } = request.query as { userId?: string };
    const community = await prisma.community.findUnique({ where: { id: communityId } });
    if (!community) return reply.code(404).send({ error: "Community not found" });
    if (!(await canReadCommunity(communityId, userId))) {
      return reply.code(403).send({ error: "Join this private community to view its adoption policies" });
    }
    const policies = await prisma.adoptionPolicy.findMany({ where: { communityId }, orderBy: [{ status: "asc" }, { effectiveAt: "desc" }] });
    const activePolicies = policies.filter((policy) => policy.status === "Active" && policy.effectiveAt <= new Date());
    return { communityId, policies, activePolicies, defaultAuthorityLevel: community.defaultAuthorityLevel };
  });

  app.post("/communities/:communityId/adoption/proposals", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const parsed = ProposeAdoptionPolicyRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid adoption policy proposal" });
    const input = parsed.data;
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply, request);
    if (!stewardCheck) return;

    const proposalArtifact = await artifactStore.write(
      withArtifactSchema("adoption-policy-proposal", {
        communityId,
        proposedBy: input.steward,
        authorityLevel: input.authorityLevel,
        eligibleQuestionTypes: input.eligibleQuestionTypes,
        credentialSchemaIds: input.credentialSchemaIds,
        quorumRule: input.quorumRule,
        approvalRule: input.approvalRule,
        legalHandoff: input.legalHandoff ?? null,
        forkRule: input.forkRule
      })
    );
    await storeArtifact(proposalArtifact, "adoption-policy-proposal");

    const policyId = `policy-${nanoid(10)}`;
    const policyProposedEvent = prepareProtocolEvent({
      eventType: "AdoptionPolicyProposed",
      subjectId: policyId,
      actor: input.steward,
      previousHash: null,
      newHash: proposalArtifact.hash
    });
    const policy = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, policyProposedEvent);
      const proposed = await tx.adoptionPolicy.create({
        data: {
          id: policyId,
          communityId,
          authorityLevel: input.authorityLevel,
          eligibleQuestionTypes: input.eligibleQuestionTypes,
          credentialSchemaIds: input.credentialSchemaIds,
          quorumRuleHash: hashJson({ rule: input.quorumRule }),
          approvalRuleHash: hashJson({ rule: input.approvalRule }),
          legalHandoffHash: input.legalHandoff ? hashJson({ rule: input.legalHandoff }) : null,
          forkRuleHash: hashJson({ rule: input.forkRule }),
          proposalHash: proposalArtifact.hash,
          proposedBy: input.steward,
          effectiveAt: new Date(),
          status: "Proposed"
        }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return proposed;
    });
    return { policy, proposalArtifact };
  });

  app.post("/communities/:communityId/adoption/policies/:policyId/activate", async (request, reply) => {
    const { communityId, policyId } = request.params as { communityId: string; policyId: string };
    const input = ActivateAdoptionPolicyRequestSchema.parse(request.body ?? {});
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply, request);
    if (!stewardCheck) return;
    const policy = await prisma.adoptionPolicy.findUnique({ where: { id: policyId } });
    if (!policy || policy.communityId !== communityId) return reply.code(404).send({ error: "Adoption policy not found" });
    if (policy.status !== "Proposed") return reply.code(409).send({ error: "Only proposed adoption policies can be activated" });
    if (policy.authorityLevel === "Binding" && !policy.legalHandoffHash) {
      return reply.code(409).send({ error: "Committed-decision rules require a legal or community handoff before activation" });
    }

    const activationArtifact = await artifactStore.write(
      withArtifactSchema("adoption-policy-activation", {
        communityId,
        policyId,
        activatedBy: input.steward,
        adoptionRecord: input.adoptionRecord,
        effectiveAt: input.effectiveAt ?? Date.now()
      })
    );
    await storeArtifact(activationArtifact, "adoption-policy-activation");

    const policyActivatedEvent = prepareProtocolEvent({
      eventType: "AdoptionPolicyActivated",
      subjectId: policy.id,
      actor: input.steward,
      previousHash: policy.proposalHash,
      newHash: activationArtifact.hash
    });
    const activated = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, policyActivatedEvent);
      const active = await tx.adoptionPolicy.update({
        where: { id: policyId },
        data: {
          status: "Active",
          effectiveAt: input.effectiveAt ? new Date(input.effectiveAt) : new Date(),
          activationHash: activationArtifact.hash,
          adoptedBy: input.steward,
          suspendedBy: null,
          suspensionReasonHash: null
        }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return active;
    });
    return { policy: activated, activationArtifact };
  });

  app.post("/communities/:communityId/adoption/policies/:policyId/suspend", async (request, reply) => {
    const { communityId, policyId } = request.params as { communityId: string; policyId: string };
    const input = SuspendAdoptionPolicyRequestSchema.parse(request.body ?? {});
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply, request);
    if (!stewardCheck) return;
    const policy = await prisma.adoptionPolicy.findUnique({ where: { id: policyId } });
    if (!policy || policy.communityId !== communityId) return reply.code(404).send({ error: "Adoption policy not found" });
    if (policy.status !== "Active") return reply.code(409).send({ error: "Only active adoption policies can be suspended" });

    const suspensionArtifact = await artifactStore.write(
      withArtifactSchema("adoption-policy-suspension", {
        communityId,
        policyId,
        suspendedBy: input.steward,
        reason: input.reason
      })
    );
    await storeArtifact(suspensionArtifact, "adoption-policy-suspension");

    const policySuspendedEvent = prepareProtocolEvent({
      eventType: "AdoptionPolicySuspended",
      subjectId: policy.id,
      actor: input.steward,
      previousHash: policy.activationHash ?? policy.proposalHash,
      newHash: suspensionArtifact.hash
    });
    const suspended = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, policySuspendedEvent);
      const updated = await tx.adoptionPolicy.update({
        where: { id: policyId },
        data: {
          status: "Suspended",
          suspendedBy: input.steward,
          suspensionReasonHash: suspensionArtifact.hash
        }
      });
      await tx.question.updateMany({
        where: { adoptionPolicyId: policyId, status: { in: UNPUBLISHED_QUESTION_STATUSES } },
        data: { authorityLevel: "Advisory" }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return updated;
    });
    return { policy: suspended, suspensionArtifact };
  });

  app.get("/artifacts/:hash", async (request, reply) => {
    const { hash } = request.params as { hash: string };
    const artifactRecord = await prisma.artifact.findUnique({ where: { hash } });
    if (!artifactRecord && !config.demoMode) return reply.code(404).send({ error: "Artifact not found" });
    if (artifactRecord) {
      const session = await readAuthSession(request);
      const { userId } = request.query as { userId?: string };
      const effectiveUserId = session?.userId ?? (!config.requireAuth ? userId : undefined);
      if (!(await canReadArtifact(artifactRecord.kind, hash, effectiveUserId))) {
        return reply.code(403).send({ error: "Artifact is not public for this viewer" });
      }
    }
    try {
      const artifact = await artifactStore.read(hash);
      return { protocol: buildArtifactReadProtocol(hash, artifact), hash, artifact };
    } catch {
      return reply.code(404).send({ error: "Artifact not found" });
    }
  });

  return app;
}

type RegistryEventView = {
  id: string;
  eventType: string;
  subjectId: string;
  actor: string;
  previousHash: string | null;
  newHash: string;
  sourceType?: string;
  sourceTransactionId?: string | null;
  sourceTransactionHash?: string | null;
  sourceModule?: string | null;
  transactionType?: string | null;
  emittedAt: Date;
};

type ProtocolTransactionView = {
  id: string;
  sourceType: string;
  sourceModule: string;
  transactionType: string;
  subjectId: string;
  actor: string;
  eventType: string;
  eventHash: string;
  resultHash: string;
  payloadHash: string;
  payloadJson: string;
  status: string;
  createdAt: Date;
};

type ProtocolEventInput = {
  eventType: string;
  subjectId: string;
  actor: string;
  previousHash: string | null;
  newHash: string;
  emittedAt?: Date;
  nonce?: string;
};

type PreparedProtocolEvent = {
  eventType: string;
  subjectId: string;
  actor: string;
  previousHash: string | null;
  newHash: string;
  emittedAt: Date;
  protocolTransaction: ReturnType<typeof buildLocalProtocolTransactionResult>;
};

type ProtocolPersistenceClient = Pick<typeof prisma, "protocolCommitmentRecord"> | Pick<Prisma.TransactionClient, "protocolCommitmentRecord">;

type DiscussionPostView = {
  id: string;
  questionId: string;
  authorId: string;
  kind: DiscussionPostKind;
  bodyHash: string;
  body: string;
  parentId: string | null;
  status: string;
  createdAt: Date;
};

type DiscussionView = {
  key: DiscussionViewKey;
  kind: DiscussionPostKind;
  label: string;
  count: number;
  posts: DiscussionPostView[];
};

type ModerationRecordView = {
  id: string;
  questionId: string;
  postId: string;
  postBodyHash: string;
  moderatorId: string;
  action: DiscussionModerationAction;
  reasonCode: string;
  reasonHash: string;
  reason: string;
  previousStatus: "Published" | "Hidden";
  newStatus: "Published" | "Hidden";
  createdAt: Date;
};

type ModerationAppealView = {
  id: string;
  moderationRecordId: string;
  appellantId: string;
  appealHash: string;
  appeal: string;
  status: string;
  resolutionHash: string | null;
  resolution: string | null;
  resolvedBy: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
};

type ChallengeAppealView = {
  id: string;
  questionId: string;
  targetType: ChallengeAppealTargetType;
  challengeId: string | null;
  resultChallengeId: string | null;
  appellantId: string;
  appealBondId: string;
  appealedRuling: "Sustained" | "Rejected" | "Remanded";
  appealHash: string;
  appeal: string;
  status: ChallengeAppealStatus;
  resolutionHash: string | null;
  resolution: string | null;
  resolvedBy: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
};

type JurorAssignmentView = {
  id: string;
  questionId: string;
  targetType: JurorTargetType;
  challengeId: string | null;
  resultChallengeId: string | null;
  challengeAppealId: string | null;
  jurorId: string;
  selectedBy: string;
  selectionHash: string;
  selectionReason: string;
  conflictDisclosureHash: string | null;
  conflictDisclosure: string | null;
  conflictStatus: JurorConflictStatus;
  status: "Selected" | "Withdrawn";
  createdAt: Date;
  updatedAt: Date;
};

type DiscoveryCommunityView = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  parentId?: string | null;
  path?: string;
  depth?: number;
  registryStatus?: string;
  profileUserId: string | null;
  visibility: string;
  memberCount: number;
  questionCount: number;
  followerCount: number;
  followedByActiveUser: boolean;
};

type QuestionAudience = "Public" | "Followers" | "Members";
type PollResultMode = "PeopleVote" | "CommunitiesSignal" | "ShowBoth";

type QuestionAccessRecord = {
  id: string;
  proposer: string;
  communityId: string | null;
  audience: string | null;
};

type ActivityRecordInput = {
  actorId: string;
  activityType: string;
  questionId?: string | null;
  communityId?: string | null;
  targetCommunityId?: string | null;
  audience?: string;
  shellText: string;
};

type DiscoveryTopicView = {
  topicId: string;
  questionCount: number;
  communityCount: number;
  followerCount: number;
  followedByActiveUser: boolean;
};

type ReputationEventView = {
  id?: string;
  eventId?: string;
  account: string;
  reason: string;
  weight: number;
  sourceId: string;
  createdAt?: Date | string;
  emittedAt?: Date | string | number;
};

type PageRequest = {
  limit: number;
  offset: number;
};

type PageInfo = {
  limit: number;
  cursor: string;
  nextCursor: string | null;
  total: number;
  hasMore: boolean;
};

type CommunityCredentialTrustPolicyView = {
  id: string;
  communityId: string;
  credentialSchemaId: string;
  trustedIssuerIds: string[];
  mode: string;
  status: string;
  policyHash: string;
  createdBy: string;
  createdAt: Date | string | number;
  updatedAt?: Date | string | number;
};

type TallyCommitteeView = {
  id: string;
  communityId: string;
  name: string;
  memberIds: string[];
  threshold: number;
  status: string;
  metadataHash: string;
  activationHash: string | null;
  failureHash: string | null;
  createdBy: string;
  activatedBy: string | null;
  failedBy: string | null;
  failedAt: Date | string | number | null;
  replacementForId: string | null;
  createdAt: Date | string | number;
  updatedAt?: Date | string | number;
};

const TALLY_KEY_SETUP_PUBLIC_SELECT = {
  id: true,
  communityId: true,
  committeeId: true,
  publicKeyId: true,
  publicKeyPem: true,
  publicKeyHash: true,
  memberIds: true,
  memberKeyCommitmentHashes: true,
  threshold: true,
  transcriptHash: true,
  setupHash: true,
  status: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.TallyKeySetupSelect;

type TallyKeySetupView = Prisma.TallyKeySetupGetPayload<{ select: typeof TALLY_KEY_SETUP_PUBLIC_SELECT }>;

const TALLY_DECRYPTION_SHARE_PUBLIC_SELECT = {
  id: true,
  pollId: true,
  questionId: true,
  communityId: true,
  committeeId: true,
  keySetupId: true,
  memberId: true,
  shareHash: true,
  proofHash: true,
  artifactHash: true,
  status: true,
  submittedAt: true
} satisfies Prisma.TallyDecryptionShareSelect;

type TallyDecryptionShareView = Prisma.TallyDecryptionShareGetPayload<{ select: typeof TALLY_DECRYPTION_SHARE_PUBLIC_SELECT }>;

type PublicQuestionProtocolInput = {
  id: string;
  version: number;
  bodyHash: string;
  answerSchemaId: string;
  credentialSchemaId: string;
  communityId: string | null;
  topicIds: string[];
  geoScope: string | null;
  sponsorDisclosureHash: string | null;
  methodologyLabel: string;
  authorityLevel: string;
  adoptionPolicyId: string | null;
  status: string;
  proposer: string;
  proposalBondId: string;
  community?: {
    id: string;
    slug: string;
    visibility: string;
    credentialSchemaId: string;
    defaultAuthorityLevel: string;
  } | null;
  poll?: {
    id: string;
    status: string;
    credentialSchemaId: string;
    privacyThreshold: number;
    resultChallengeEndsAt: Date;
    result?: {
      id: string;
      resultArtifactHash: string;
      aggregateCountsHash: string;
      tallyProofHash: string;
      turnout: number;
      invalidBallots: number;
      privacyReportHash: string;
      finalStatus: string;
    } | null;
    resultChallenges: Array<{
      id: string;
      evidenceHash: string;
      resolutionHash: string | null;
      ruling: string;
      reasonCode: string;
      challenger: string;
      challengeBondId: string;
    }>;
  } | null;
  challenges: Array<{
    id: string;
    evidenceHash: string;
    resolutionHash: string | null;
    ruling: string;
    reasonCode: string;
    challenger: string;
    challengeBondId: string;
  }>;
  challengeAppeals: Array<{
    id: string;
    questionId: string;
    targetType: string;
    challengeId: string | null;
    resultChallengeId: string | null;
    appellantId: string;
    appealBondId: string;
    appealedRuling: string;
    appealHash: string;
    status: string;
    resolutionHash: string | null;
    resolvedBy: string | null;
    createdAt: Date;
    resolvedAt: Date | null;
  }>;
  jurorAssignments: Array<{
    id: string;
    questionId: string;
    targetType: string;
    challengeId: string | null;
    resultChallengeId: string | null;
    challengeAppealId: string | null;
    jurorId: string;
    selectedBy: string;
    selectionHash: string;
    conflictDisclosureHash: string | null;
    conflictStatus: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  archiveRecord?: {
    id: string;
    archiveHash: string;
    archivedBy: string;
  } | null;
};

type ReplayQuestionInput = {
  id: string;
  bodyHash: string;
  sponsorDisclosureHash: string | null;
  status: string;
  authorityLevel: string;
  credentialSchemaId: string;
  communityId: string | null;
  adoptionPolicyId: string | null;
  community?: {
    visibility: string;
    credentialSchemaId: string;
    defaultAuthorityLevel: string;
  } | null;
  poll?: {
    id: string;
    status: string;
    result?: {
      resultArtifactHash: string;
      finalStatus: string;
    } | null;
  } | null;
  archiveRecord?: {
    id: string;
    archiveHash: string;
    archivedBy: string;
  } | null;
};

type ReplayRebuiltState = {
  questionStatus: string | null;
  pollStatus: string | null;
  resultFinalStatus: string | null;
  bodyHash: string | null;
  resultArtifactHash: string | null;
  archiveHash: string | null;
};

type ReplayCheck = {
  id: string;
  ok: boolean;
  expected?: unknown;
  actual?: unknown;
  detail?: string;
};

type ReplayCheckResult = {
  allPassed: boolean;
  eventStreamHash: string;
  rebuilt: ReplayRebuiltState;
  checks: ReplayCheck[];
};

type CommunityImportReplayRebuilt = {
  communityId: string | null;
  slug: string | null;
  source: "export-bundle";
  readOnly: true;
  questionCount: number;
  policyCount: number;
  forkCount: number;
  archiveCount: number;
  eventCount: number;
  commitmentCount: number;
  artifactCount: number;
  frontendConfigHash: string | null;
  artifactManifestHash: string | null;
};

type CommunityImportReplayResult = {
  allPassed: boolean;
  rebuilt: CommunityImportReplayRebuilt;
  checks: ReplayCheck[];
};

type ProtocolTransactionReplayInput = ReturnType<typeof toProtocolTransactionView>;

type ProtocolIndexerReplayModule = {
  sourceModule: string;
  transactionCount: number;
  eventCount: number;
  subjectCount: number;
  eventTypes: string[];
  latestResultHash: string | null;
};

type ProtocolIndexerReplaySubject = {
  subjectId: string;
  sourceModules: string[];
  eventTypes: string[];
  transactionCount: number;
  eventCount: number;
  latestEventType: string | null;
  latestEventHash: string | null;
  latestNewHash: string | null;
  latestResultHash: string | null;
};

type ProtocolIndexerReplayRebuilt = {
  source: "protocol-transactions";
  readOnly: true;
  transactionCount: number;
  eventCount: number;
  subjectCount: number;
  moduleCount: number;
  transactionStreamHash: string;
  eventStreamHash: string;
  latestResultHash: string | null;
  latestEventHash: string | null;
  modules: ProtocolIndexerReplayModule[];
  subjects: ProtocolIndexerReplaySubject[];
};

type ProtocolIndexerReplayResult = {
  allPassed: boolean;
  readOnly: true;
  rebuilt: ProtocolIndexerReplayRebuilt;
  transactions: ProtocolTransactionReplayInput[];
  events: RegistryEventView[];
  checks: ReplayCheck[];
};

type CommitmentView = {
  id: string;
  kind: string;
  contractModule: string;
  subjectId: string;
  eventType: string;
  sourceEventId: string;
  commitmentHash: string;
  payloadHash: string;
  status: string;
  createdAt: Date;
  payload: unknown;
};

type CommunityExportCommunityInput = Prisma.CommunityGetPayload<{ include: { memberships: true; frontendConfig: true } }>;
type CommunityExportQuestionInput = Prisma.QuestionGetPayload<{
  include: {
    challenges: true;
    challengeAppeals: true;
    jurorAssignments: true;
    discussionPosts: true;
    archiveRecord: true;
    poll: {
      include: {
        ballots: { select: { ballotCommitment: true; nullifier: true } };
        decryptionShares: { select: typeof TALLY_DECRYPTION_SHARE_PUBLIC_SELECT };
        result: true;
        resultChallenges: true;
      };
    };
  };
}>;
type CommunityExportPolicyInput = Prisma.AdoptionPolicyGetPayload<Record<string, never>>;
type CommunityExportForkInput = Prisma.CommunityForkGetPayload<Record<string, never>>;
type CommunityExportModerationRecordInput = Prisma.DiscussionModerationRecordGetPayload<Record<string, never>>;
type CommunityExportModerationAppealInput = Prisma.DiscussionModerationAppealGetPayload<Record<string, never>>;
type CommunityExportChallengeAppealInput = Prisma.ChallengeAppealGetPayload<Record<string, never>>;
type CommunityExportJurorAssignmentInput = Prisma.JurorAssignmentGetPayload<Record<string, never>>;
type CommunityExportGovernanceParameterInput = Prisma.GovernanceParameterSetGetPayload<Record<string, never>>;
type CommunityExportEmergencySuspensionInput = Prisma.CommunityEmergencySuspensionGetPayload<Record<string, never>>;
type CommunityExportProfileInput = Prisma.UserAccountGetPayload<Record<string, never>>;
type CommunityExportCommunityFollowInput = Prisma.CommunityFollowGetPayload<Record<string, never>>;
type CommunityExportTopicFollowInput = Prisma.TopicFollowGetPayload<Record<string, never>>;
type CommunityExportReputationEventInput = Prisma.ReputationEventGetPayload<Record<string, never>>;
type TreasuryLedgerBondInput = Prisma.BondGetPayload<Record<string, never>>;
type DataUnionPolicyInput = Prisma.DataUnionPolicyGetPayload<Record<string, never>>;
type DataUnionConsentInput = Prisma.DataUnionConsentGetPayload<Record<string, never>>;
type DataUnionProductInput = Prisma.DataUnionProductGetPayload<Record<string, never>>;
type DataUnionAccessGrantInput = Prisma.DataUnionAccessGrantGetPayload<Record<string, never>>;
type DataUnionBuyerInput = Prisma.DataUnionBuyerGetPayload<Record<string, never>>;
type DataUnionSettlementInput = Prisma.DataUnionSettlementGetPayload<Record<string, never>>;
type DataUnionClaimInput = Prisma.DataUnionClaimGetPayload<Record<string, never>>;
type DataUnionAccessGrantLedgerInput = Prisma.DataUnionAccessGrantGetPayload<{
  include: { product: { include: { result: { include: { poll: { include: { question: { select: { proposer: true } } } } } } } }; settlements: true };
}>;
type DataUnionSettlementGrantInput = Prisma.DataUnionAccessGrantGetPayload<{
  include: {
    product: {
      include: {
        policy: true;
        result: { include: { poll: { include: { question: { select: { id: true; proposer: true } } } } } };
      };
    };
  };
}>;
type CredentialIssuerAnnotationQuestionInput = { id: string; credentialSchemaId: string };

function parsePageQuery(query: unknown): PageRequest {
  const params = query && typeof query === "object" ? (query as Record<string, unknown>) : {};
  const limit = clampIntegerParam(params.limit, DEFAULT_PAGE_LIMIT, 1, MAX_PAGE_LIMIT);
  const offset = clampIntegerParam(params.cursor, 0, 0, Number.MAX_SAFE_INTEGER);
  return { limit, offset };
}

function buildPageInfo(page: PageRequest, total: number): PageInfo {
  const nextOffset = page.offset + page.limit;
  return {
    limit: page.limit,
    cursor: String(page.offset),
    nextCursor: nextOffset < total ? String(nextOffset) : null,
    total,
    hasMore: nextOffset < total
  };
}

function clampIntegerParam(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : typeof value === "number" ? value : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function readableQuestionWhere(userId: string | undefined): Prisma.QuestionWhereInput {
  const publicWhere: Prisma.QuestionWhereInput = { audience: "Public" };
  if (!userId) return publicWhere;
  const activeMemberWhere: Prisma.QuestionWhereInput = {
    community: { is: { memberships: { some: { userId, status: "Active" } } } }
  };
  return {
    OR: [
      publicWhere,
      { proposer: userId },
      { AND: [{ audience: "Members" }, activeMemberWhere] },
      {
        AND: [
          { audience: "Followers" },
          {
            OR: [
              activeMemberWhere,
              { community: { is: { follows: { some: { userId } } } } }
            ]
          }
        ]
      }
    ]
  };
}

async function buildReplayCheck(
  question: ReplayQuestionInput,
  events: RegistryEventView[],
  artifactStore: ArtifactStorageAdapter
): Promise<ReplayCheckResult> {
  const rebuilt = replayRegistryEvents(events);
  const eventStreamHash = hashRegistryEvents(events);
  const checks: ReplayCheck[] = [];
  const addCheck = (id: string, ok: boolean, expected?: unknown, actual?: unknown, detail?: string) => {
    checks.push({ id, ok, expected, actual, detail });
  };

  addCheck("events-present", events.length > 0, "at least one event", events.length);
  addCheck("event-previous-hash-continuity", previousHashesAreLinked(events), true, previousHashesAreLinked(events));
  addCheck("question-body-hash-from-events", rebuilt.bodyHash === question.bodyHash, question.bodyHash, rebuilt.bodyHash);
  addCheck("question-status-from-events", rebuilt.questionStatus === question.status, question.status, rebuilt.questionStatus);

  if (question.poll) {
    addCheck("poll-status-from-events", rebuilt.pollStatus === question.poll.status, question.poll.status, rebuilt.pollStatus);
  }

  if (question.poll?.result) {
    addCheck(
      "result-artifact-hash-from-events",
      rebuilt.resultArtifactHash === question.poll.result.resultArtifactHash,
      question.poll.result.resultArtifactHash,
      rebuilt.resultArtifactHash
    );
    addCheck(
      "result-final-status-from-events",
      rebuilt.resultFinalStatus === question.poll.result.finalStatus,
      question.poll.result.finalStatus,
      rebuilt.resultFinalStatus
    );
  }

  if (question.archiveRecord) {
    addCheck("archive-hash-from-events", rebuilt.archiveHash === question.archiveRecord.archiveHash, question.archiveRecord.archiveHash, rebuilt.archiveHash);
    const archiveVerification = await artifactStore.verify<Record<string, unknown>>(question.archiveRecord.archiveHash);
    const archiveArtifact = archiveVerification.value && isRecord(archiveVerification.value) ? archiveVerification.value : null;
    addCheck(
      "archive-artifact-hash",
      archiveVerification.valid,
      question.archiveRecord.archiveHash,
      archiveVerification.computedHash,
      archiveVerification.error
    );
    addCheck(
      "archive-artifact-schema",
      archiveArtifact?.artifactKind === "question-archive" && archiveArtifact.schemaVersion === "pc-question-archive-v1",
      { artifactKind: "question-archive", schemaVersion: "pc-question-archive-v1" },
      archiveArtifact ? { artifactKind: archiveArtifact.artifactKind, schemaVersion: archiveArtifact.schemaVersion } : null
    );

    const archiveQuestion = isRecord(archiveArtifact?.question) ? archiveArtifact.question : null;
    addCheck("archive-question-body-hash", archiveQuestion?.bodyHash === question.bodyHash, question.bodyHash, archiveQuestion?.bodyHash);
    addCheck("archive-question-status", archiveQuestion?.status === "Archived", "Archived", archiveQuestion?.status);

    const archiveEventIndex = events.findIndex(
      (event) => event.eventType === "QuestionArchived" && event.newHash === question.archiveRecord?.archiveHash
    );
    const expectedEventIds = (archiveEventIndex >= 0 ? events.slice(0, archiveEventIndex) : events).map((event) => event.id);
    const actualEventIds = extractEventIds(archiveArtifact?.events);
    addCheck("archive-event-snapshot", sameStringArray(expectedEventIds, actualEventIds), expectedEventIds, actualEventIds);

    const manifest = isArtifactManifest(archiveArtifact?.artifactManifest) ? archiveArtifact.artifactManifest : null;
    const archiveManifestHash = optionalString(archiveArtifact?.artifactManifestHash);
    const computedManifestHash = manifest ? hashArtifactManifest(manifest.references) : null;
    addCheck("archive-manifest-hash", Boolean(manifest && archiveManifestHash === computedManifestHash), archiveManifestHash, computedManifestHash);

    if (manifest) {
      const referenceVerifications = await Promise.all(manifest.references.map((reference) => artifactStore.verify(reference.hash)));
      const invalidReferences = manifest.references
        .map((reference, index) => ({ reference, verification: referenceVerifications[index] }))
        .filter(({ verification }) => !verification.valid)
        .map(({ reference, verification }) => ({ kind: reference.kind, hash: reference.hash, error: verification.error ?? "hash mismatch" }));
      addCheck("archive-manifest-references", invalidReferences.length === 0, [], invalidReferences);
    }

    const bodyArtifactHash = archiveArtifact?.bodyArtifact ? hashJson(archiveArtifact.bodyArtifact) : null;
    addCheck("archive-body-artifact-hash", bodyArtifactHash === question.bodyHash, question.bodyHash, bodyArtifactHash);

    if (question.sponsorDisclosureHash) {
      const sponsorArtifactHash = archiveArtifact?.sponsorArtifact ? hashJson(archiveArtifact.sponsorArtifact) : null;
      addCheck("archive-sponsor-artifact-hash", sponsorArtifactHash === question.sponsorDisclosureHash, question.sponsorDisclosureHash, sponsorArtifactHash);
    }

    if (question.poll?.result) {
      const archiveResult = isRecord(archiveArtifact?.result) ? archiveArtifact.result : null;
      const resultArtifactHash = archiveArtifact?.resultArtifact ? hashJson(archiveArtifact.resultArtifact) : null;
      addCheck(
        "archive-result-record-hash",
        archiveResult?.resultArtifactHash === question.poll.result.resultArtifactHash,
        question.poll.result.resultArtifactHash,
        archiveResult?.resultArtifactHash
      );
      addCheck(
        "archive-result-artifact-hash",
        resultArtifactHash === question.poll.result.resultArtifactHash,
        question.poll.result.resultArtifactHash,
        resultArtifactHash
      );
    }
  }

  return {
    allPassed: checks.every((check) => check.ok),
    eventStreamHash,
    rebuilt,
    checks
  };
}

function buildCommunityImportReplay(bundle: ArtifactExportBundle): CommunityImportReplayResult {
  const checks: ReplayCheck[] = [];
  const addCheck = (id: string, ok: boolean, expected?: unknown, actual?: unknown, detail?: string) => {
    checks.push({ id, ok, expected, actual, detail });
  };
  const root = bundle.root;
  const rootValue = root && isRecord(root.value) ? root.value : null;
  const community = isRecord(rootValue?.community) ? rootValue.community : null;
  const questions = asRecordArray(rootValue?.questions);
  const policies = asRecordArray(rootValue?.policies);
  const forks = asRecordArray(rootValue?.forks);
  const archives = asRecordArray(rootValue?.archives);
  const events = asRecordArray(rootValue?.events).flatMap(toRegistryEventView);
  const commitments = asRecordArray(rootValue?.commitments);
  const frontendConfig = isRecord(rootValue?.frontendConfig) ? rootValue.frontendConfig : null;
  const rootManifest = isArtifactManifest(rootValue?.artifactManifest) ? rootValue.artifactManifest : null;
  const computedManifestHash = hashArtifactManifest(bundle.manifest.references);
  const artifactEntriesValid = bundle.artifacts.every((entry) => entry.hash === entry.computedHash && hashJson(entry.value) === entry.hash);
  const manifestReferencesPresent = bundle.manifest.references.every((reference) => bundleHasArtifactReference(bundle, reference));
  const commitmentHashesValid = commitments.every(isCommitmentRecordHashValid);
  const commitmentSourceEventsPresent = commitments.every((commitment) => {
    const sourceEventId = typeof commitment.sourceEventId === "string" ? commitment.sourceEventId : null;
    return !sourceEventId || events.some((event) => event.id === sourceEventId);
  });
  const communityId = optionalString(community?.id);
  const frontendConfigHash = optionalString(frontendConfig?.configHash);
  const archiveHashes = compactHashArray(archives.map((archive) => optionalString(archive.archiveHash)));

  addCheck("bundle-schema", bundle.protocol === "popular-consensus" && bundle.schemaVersion === "artifact-export-bundle-v1", "artifact-export-bundle-v1", bundle.schemaVersion);
  addCheck("root-present", Boolean(root), true, Boolean(root));
  addCheck("root-kind", root?.kind === "community-export", "community-export", root?.kind);
  addCheck("root-hash", Boolean(root && root.hash === root.computedHash && hashJson(root.value) === root.hash), root?.hash, root ? hashJson(root.value) : null);
  addCheck(
    "root-artifact-schema",
    rootValue?.artifactKind === "community-export" && rootValue.schemaVersion === "pc-community-export-v1",
    { artifactKind: "community-export", schemaVersion: "pc-community-export-v1" },
    rootValue ? { artifactKind: rootValue.artifactKind, schemaVersion: rootValue.schemaVersion } : null
  );
  addCheck("community-present", Boolean(communityId), "community id", communityId);
  addCheck("manifest-hash", computedManifestHash === bundle.manifestHash, bundle.manifestHash, computedManifestHash);
  addCheck("root-manifest-present", Boolean(rootManifest), true, Boolean(rootManifest));
  addCheck("root-manifest-hash", optionalString(rootValue?.artifactManifestHash) === bundle.manifestHash, bundle.manifestHash, rootValue?.artifactManifestHash);
  addCheck(
    "root-manifest-matches-bundle",
    Boolean(rootManifest && hashArtifactManifest(rootManifest.references) === bundle.manifestHash),
    bundle.manifestHash,
    rootManifest ? hashArtifactManifest(rootManifest.references) : null
  );
  addCheck("bundle-artifact-hashes", artifactEntriesValid, true, artifactEntriesValid);
  addCheck("manifest-references-present", manifestReferencesPresent, true, manifestReferencesPresent);
  addCheck("event-previous-hash-references", previousHashesAreResolvable(events, bundle), true, previousHashesAreResolvable(events, bundle));
  addCheck("questions-belong-to-community", questions.every((question) => question.communityId === communityId), communityId, uniqueStrings(questions.map((question) => optionalString(question.communityId))));
  addCheck("archives-referenced", archiveHashes.every((hash) => bundle.artifacts.some((entry) => entry.kind === "question-archive" && entry.hash === hash)), archiveHashes, bundle.artifacts.map((entry) => entry.hash));
  addCheck("frontend-config-reference", !frontendConfigHash || bundle.artifacts.some((entry) => entry.kind === "community-frontend-config" && entry.hash === frontendConfigHash), frontendConfigHash, Boolean(frontendConfigHash));
  addCheck("commitment-hashes", commitmentHashesValid, true, commitmentHashesValid);
  addCheck("commitment-source-events-present", commitmentSourceEventsPresent, true, commitmentSourceEventsPresent);
  addCheck("read-only-import", true, true, true, "Replay accepts a bundle and does not write imported community state.");

  const rebuilt: CommunityImportReplayRebuilt = {
    communityId,
    slug: optionalString(community?.slug),
    source: "export-bundle",
    readOnly: true,
    questionCount: questions.length,
    policyCount: policies.length,
    forkCount: forks.length,
    archiveCount: archives.length,
    eventCount: events.length,
    commitmentCount: commitments.length,
    artifactCount: bundle.artifacts.length,
    frontendConfigHash,
    artifactManifestHash: optionalString(rootValue?.artifactManifestHash)
  };

  return {
    allPassed: checks.every((check) => check.ok),
    rebuilt,
    checks
  };
}

function buildProtocolIndexerReplay(transactions: ProtocolTransactionReplayInput[]): ProtocolIndexerReplayResult {
  const checks: ReplayCheck[] = [];
  const addCheck = (id: string, ok: boolean, expected?: unknown, actual?: unknown, detail?: string) => {
    checks.push({ id, ok, expected, actual, detail });
  };
  const canonicalEventsByModule = new Map(
    CanonicalProtocolBoundary.modules.map((module) => [module.id, new Set(module.eventTypes)])
  );
  const payloadRecords = transactions.map((transaction) => ({
    transaction,
    payload: isRecord(transaction.payload) ? transaction.payload : null
  }));
  const invalidPayloads = payloadRecords
    .filter(({ payload }) => !payload)
    .map(({ transaction }) => transaction.id);
  const payloadHashMismatches = payloadRecords
    .filter(({ transaction, payload }) => payload && transaction.payloadHash !== hashJson(payload))
    .map(({ transaction }) => transaction.id);
  const eventHashMismatches = payloadRecords
    .filter(({ transaction, payload }) => {
      const expected = payload ? expectedEventHashFromProtocolPayload(payload) : null;
      return !expected || transaction.eventHash !== expected;
    })
    .map(({ transaction }) => transaction.id);
  const resultHashMismatches = transactions
    .filter((transaction) => transaction.resultHash !== expectedProtocolTransactionResultHash(transaction))
    .map((transaction) => transaction.id);
  const transactionIdMismatches = transactions
    .filter((transaction) => transaction.id !== expectedProtocolTransactionId(transaction))
    .map((transaction) => transaction.id);
  const fieldMismatches = payloadRecords.flatMap(({ transaction, payload }) =>
    payload ? protocolPayloadFieldMismatches(transaction, payload) : [{ transactionId: transaction.id, field: "payload", expected: "object", actual: null }]
  );
  const invalidModules = uniqueStrings(
    transactions
      .map((transaction) => transaction.sourceModule)
      .filter((sourceModule) => !canonicalEventsByModule.has(sourceModule))
  );
  const invalidModuleEvents = transactions
    .filter((transaction) => !canonicalEventsByModule.get(transaction.sourceModule)?.has(transaction.eventType))
    .map((transaction) => ({ transactionId: transaction.id, sourceModule: transaction.sourceModule, eventType: transaction.eventType }));
  const invalidStatuses = uniqueStrings(
    transactions
      .map((transaction) => transaction.status)
      .filter((status) => !["Applied", "Indexed"].includes(status))
  );
  const events = transactions.flatMap((transaction) => {
    const event = registryEventFromProtocolTransaction(transaction);
    return event ? [event] : [];
  });
  const transactionStreamHash = hashJson(transactions.map((transaction) => transaction.resultHash));
  const eventStreamHash = hashRegistryEvents(events);
  const modules = buildProtocolIndexerReplayModules(transactions, events);
  const subjects = buildProtocolIndexerReplaySubjects(transactions, events);

  addCheck("feed-readable", true, true, true, "Read-only replay consumed protocol transaction results without domain tables.");
  addCheck("payload-json-records", invalidPayloads.length === 0, [], invalidPayloads);
  addCheck("payload-hashes", payloadHashMismatches.length === 0, [], payloadHashMismatches);
  addCheck("event-hashes", eventHashMismatches.length === 0, [], eventHashMismatches);
  addCheck("transaction-result-hashes", resultHashMismatches.length === 0, [], resultHashMismatches);
  addCheck("transaction-id-hashes", transactionIdMismatches.length === 0, [], transactionIdMismatches);
  addCheck("record-payload-fields", fieldMismatches.length === 0, [], fieldMismatches);
  addCheck("canonical-source-modules", invalidModules.length === 0, [], invalidModules);
  addCheck("canonical-module-event-types", invalidModuleEvents.length === 0, [], invalidModuleEvents);
  addCheck("applied-or-indexed-statuses", invalidStatuses.length === 0, [], invalidStatuses);
  addCheck("registry-event-reconstruction", events.length === transactions.length, transactions.length, events.length);
  addCheck("event-previous-hash-continuity", previousHashesAreLinked(events), true, previousHashesAreLinked(events));
  addCheck("read-only-indexer-replay", true, true, true, "Replay rebuilt index state and did not write imported state.");

  const rebuilt: ProtocolIndexerReplayRebuilt = {
    source: "protocol-transactions",
    readOnly: true,
    transactionCount: transactions.length,
    eventCount: events.length,
    subjectCount: subjects.length,
    moduleCount: modules.length,
    transactionStreamHash,
    eventStreamHash,
    latestResultHash: transactions.at(-1)?.resultHash ?? null,
    latestEventHash: events.at(-1)?.id ?? null,
    modules,
    subjects
  };

  return {
    allPassed: checks.every((check) => check.ok),
    readOnly: true,
    rebuilt,
    transactions,
    events,
    checks
  };
}

function expectedProtocolTransactionId(transaction: ProtocolTransactionReplayInput): string {
  return hashJson({
    sourceType: transaction.sourceType,
    sourceModule: transaction.sourceModule,
    transactionType: transaction.transactionType,
    subjectId: transaction.subjectId,
    eventHash: transaction.eventHash
  });
}

function expectedProtocolTransactionResultHash(transaction: ProtocolTransactionReplayInput): string {
  return hashJson({
    sourceType: transaction.sourceType,
    sourceModule: transaction.sourceModule,
    transactionType: transaction.transactionType,
    eventHash: transaction.eventHash,
    payloadHash: transaction.payloadHash
  });
}

function expectedEventHashFromProtocolPayload(payload: Record<string, unknown>): string | null {
  const eventType = stringFromRecord(payload, "eventType");
  const subjectId = stringFromRecord(payload, "subjectId");
  const actor = stringFromRecord(payload, "actor");
  const newHash = stringFromRecord(payload, "newHash");
  const emittedAt = stringFromRecord(payload, "emittedAt");
  const nonce = stringFromRecord(payload, "nonce");
  const previousHash = nullableStringFromRecord(payload, "previousHash");
  const seed = payload.seed === true;
  if (!eventType || !subjectId || !actor || !newHash || !emittedAt || previousHash === undefined) return null;
  if (!nonce && !seed) return null;
  if (seed && !nonce) return hashJson({ eventType, subjectId, actor, previousHash, newHash, emittedAt, seed: true });
  return hashJson({ eventType, subjectId, actor, previousHash, newHash, emittedAt, nonce });
}

function protocolPayloadFieldMismatches(transaction: ProtocolTransactionReplayInput, payload: Record<string, unknown>) {
  return ["sourceType", "sourceModule", "transactionType", "subjectId", "actor", "eventType", "eventHash"]
    .map((field) => ({
      transactionId: transaction.id,
      field,
      expected: transaction[field as keyof Pick<ProtocolTransactionReplayInput, "sourceType" | "sourceModule" | "transactionType" | "subjectId" | "actor" | "eventType" | "eventHash">],
      actual: payload[field]
    }))
    .filter((mismatch) => mismatch.expected !== mismatch.actual);
}

function registryEventFromProtocolTransaction(transaction: ProtocolTransactionReplayInput): RegistryEventView | null {
  const payload = isRecord(transaction.payload) ? transaction.payload : null;
  if (!payload) return null;
  const newHash = stringFromRecord(payload, "newHash");
  const previousHash = nullableStringFromRecord(payload, "previousHash");
  const emittedAt = stringFromRecord(payload, "emittedAt");
  if (!newHash || previousHash === undefined || !emittedAt) return null;
  return {
    id: transaction.eventHash,
    eventType: transaction.eventType,
    subjectId: transaction.subjectId,
    actor: transaction.actor,
    previousHash,
    newHash,
    sourceType: transaction.sourceType,
    sourceTransactionId: transaction.id,
    sourceTransactionHash: transaction.resultHash,
    sourceModule: transaction.sourceModule,
    transactionType: transaction.transactionType,
    emittedAt: validDateOrFallback(emittedAt, transaction.createdAt)
  };
}

function buildProtocolIndexerReplayModules(transactions: ProtocolTransactionReplayInput[], events: RegistryEventView[]): ProtocolIndexerReplayModule[] {
  const moduleMap = new Map<
    string,
    { transactionCount: number; eventCount: number; subjectIds: Set<string>; eventTypes: Set<string>; latestResultHash: string | null }
  >();
  for (const transaction of transactions) {
    const entry =
      moduleMap.get(transaction.sourceModule) ??
      { transactionCount: 0, eventCount: 0, subjectIds: new Set<string>(), eventTypes: new Set<string>(), latestResultHash: null };
    entry.transactionCount += 1;
    entry.subjectIds.add(transaction.subjectId);
    entry.eventTypes.add(transaction.eventType);
    entry.latestResultHash = transaction.resultHash;
    moduleMap.set(transaction.sourceModule, entry);
  }
  for (const event of events) {
    const sourceModule = event.sourceModule ?? "unknown";
    const entry =
      moduleMap.get(sourceModule) ??
      { transactionCount: 0, eventCount: 0, subjectIds: new Set<string>(), eventTypes: new Set<string>(), latestResultHash: null };
    entry.eventCount += 1;
    entry.subjectIds.add(event.subjectId);
    entry.eventTypes.add(event.eventType);
    moduleMap.set(sourceModule, entry);
  }
  return [...moduleMap.entries()]
    .map(([sourceModule, entry]) => ({
      sourceModule,
      transactionCount: entry.transactionCount,
      eventCount: entry.eventCount,
      subjectCount: entry.subjectIds.size,
      eventTypes: [...entry.eventTypes].sort(),
      latestResultHash: entry.latestResultHash
    }))
    .sort((left, right) => left.sourceModule.localeCompare(right.sourceModule));
}

function buildProtocolIndexerReplaySubjects(transactions: ProtocolTransactionReplayInput[], events: RegistryEventView[]): ProtocolIndexerReplaySubject[] {
  const subjectMap = new Map<
    string,
    {
      sourceModules: Set<string>;
      eventTypes: Set<string>;
      transactionCount: number;
      eventCount: number;
      latestEventType: string | null;
      latestEventHash: string | null;
      latestNewHash: string | null;
      latestResultHash: string | null;
    }
  >();
  for (const transaction of transactions) {
    const entry =
      subjectMap.get(transaction.subjectId) ??
      {
        sourceModules: new Set<string>(),
        eventTypes: new Set<string>(),
        transactionCount: 0,
        eventCount: 0,
        latestEventType: null,
        latestEventHash: null,
        latestNewHash: null,
        latestResultHash: null
      };
    entry.sourceModules.add(transaction.sourceModule);
    entry.eventTypes.add(transaction.eventType);
    entry.transactionCount += 1;
    entry.latestResultHash = transaction.resultHash;
    subjectMap.set(transaction.subjectId, entry);
  }
  for (const event of events) {
    const entry =
      subjectMap.get(event.subjectId) ??
      {
        sourceModules: new Set<string>(),
        eventTypes: new Set<string>(),
        transactionCount: 0,
        eventCount: 0,
        latestEventType: null,
        latestEventHash: null,
        latestNewHash: null,
        latestResultHash: null
      };
    if (event.sourceModule) entry.sourceModules.add(event.sourceModule);
    entry.eventTypes.add(event.eventType);
    entry.eventCount += 1;
    entry.latestEventType = event.eventType;
    entry.latestEventHash = event.id;
    entry.latestNewHash = event.newHash;
    subjectMap.set(event.subjectId, entry);
  }
  return [...subjectMap.entries()]
    .map(([subjectId, entry]) => ({
      subjectId,
      sourceModules: [...entry.sourceModules].sort(),
      eventTypes: [...entry.eventTypes].sort(),
      transactionCount: entry.transactionCount,
      eventCount: entry.eventCount,
      latestEventType: entry.latestEventType,
      latestEventHash: entry.latestEventHash,
      latestNewHash: entry.latestNewHash,
      latestResultHash: entry.latestResultHash
    }))
    .sort((left, right) => left.subjectId.localeCompare(right.subjectId));
}

function stringFromRecord(record: Record<string, unknown>, field: string): string | null {
  return typeof record[field] === "string" ? record[field] : null;
}

function nullableStringFromRecord(record: Record<string, unknown>, field: string): string | null | undefined {
  if (record[field] === null) return null;
  return typeof record[field] === "string" ? record[field] : undefined;
}

function validDateOrFallback(value: string, fallback: Date): Date {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function replayRegistryEvents(events: RegistryEventView[]): ReplayRebuiltState {
  const rebuilt: ReplayRebuiltState = {
    questionStatus: null,
    pollStatus: null,
    resultFinalStatus: null,
    bodyHash: null,
    resultArtifactHash: null,
    archiveHash: null
  };

  for (const event of events) {
    switch (event.eventType) {
      case "QuestionSubmitted":
        rebuilt.questionStatus = "Submitted";
        rebuilt.bodyHash = event.newHash;
        break;
      case "QuestionAmended":
        rebuilt.questionStatus = "Amendment";
        rebuilt.bodyHash = event.newHash;
        break;
      case "QuestionAccepted":
      case "PollOpened":
        rebuilt.questionStatus = "Open";
        rebuilt.pollStatus = "Open";
        break;
      case "PollClosed":
        rebuilt.questionStatus = "Closed";
        rebuilt.pollStatus = "Closed";
        break;
      case "ResultPublished":
        rebuilt.questionStatus = "ResultPublished";
        rebuilt.pollStatus = "ResultPublished";
        rebuilt.resultFinalStatus = "Published";
        rebuilt.resultArtifactHash = event.newHash;
        break;
      case "ResultChallenged":
        rebuilt.questionStatus = "ResultChallenged";
        rebuilt.resultFinalStatus = "Challenged";
        break;
      case "ResultCorrected":
        rebuilt.questionStatus = "Corrected";
        rebuilt.resultFinalStatus = "Corrected";
        rebuilt.resultArtifactHash = event.newHash;
        break;
      case "ResultFinalized":
        rebuilt.questionStatus = "Finalized";
        rebuilt.resultFinalStatus = "Finalized";
        break;
      case "QuestionArchived":
        rebuilt.questionStatus = "Archived";
        rebuilt.archiveHash = event.newHash;
        break;
    }
  }

  return rebuilt;
}

function hashRegistryEvents(events: RegistryEventView[]): string {
  return hashJson(events.map((event) => ({ eventType: event.eventType, subjectId: event.subjectId, previousHash: event.previousHash, newHash: event.newHash })));
}

function hashReputationEvents(events: ReputationEventView[]): string {
  return hashJson(events.map((event) => ({ account: event.account, reason: event.reason, weight: event.weight, sourceId: event.sourceId })));
}

function replayReputationTotals(events: ReputationEventView[]): Record<string, number> {
  return events.reduce<Record<string, number>>((totals, event) => {
    totals[event.account] = (totals[event.account] ?? 0) + event.weight;
    return totals;
  }, {});
}

function sameRecordOfNumbers(left: Record<string, number>, right: Record<string, number>): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return sameStringArray(leftKeys, rightKeys) && leftKeys.every((key) => left[key] === right[key]);
}

function previousHashesAreLinked(events: RegistryEventView[]): boolean {
  const seenHashes = new Set<string>();
  for (const event of events) {
    if (event.previousHash && !seenHashes.has(event.previousHash)) return false;
    seenHashes.add(event.newHash);
  }
  return true;
}

function previousHashesAreResolvable(events: RegistryEventView[], bundle: ArtifactExportBundle): boolean {
  const eventHashes = new Set(events.map((event) => event.newHash));
  const artifactHashes = new Set([bundle.root?.hash, ...bundle.artifacts.map((artifact) => artifact.hash)].filter((hash): hash is string => Boolean(hash)));
  return events.every((event) => !event.previousHash || eventHashes.has(event.previousHash) || artifactHashes.has(event.previousHash));
}

async function hydrateDiscussionPosts(
  posts: Array<{
    id: string;
    questionId: string;
    authorId: string;
    kind: string;
    bodyHash: string;
    parentId: string | null;
    status: string;
    createdAt: Date;
  }>,
  artifactStore: ArtifactStorageAdapter
): Promise<DiscussionPostView[]> {
  return Promise.all(
    posts.map(async (post) => {
      const artifact = await artifactStore.read<{ body?: string }>(post.bodyHash).catch((): { body?: string } => ({}));
      return { ...post, kind: normalizeDiscussionKind(post.kind), body: artifact.body ?? "" };
    })
  );
}

function normalizeDiscussionKind(kind: string): DiscussionPostKind {
  const parsed = DiscussionPostKindSchema.safeParse(kind);
  return parsed.success ? parsed.data : "Comment";
}

function buildDiscussionViews(discussion: DiscussionPostView[]): DiscussionView[] {
  return DiscussionViewDefinitions.map((view) => {
    const posts = discussion.filter((post) => post.kind === view.kind);
    return { ...view, count: posts.length, posts };
  });
}

async function loadModerationLog(questionId: string, artifactStore: ArtifactStorageAdapter) {
  const [records, appeals] = await Promise.all([
    prisma.discussionModerationRecord.findMany({ where: { questionId }, include: { post: true }, orderBy: { createdAt: "asc" } }),
    prisma.discussionModerationAppeal.findMany({
      where: { moderationRecord: { questionId } },
      orderBy: { createdAt: "asc" }
    })
  ]);
  const moderationRecords = await Promise.all(
    records.map(async (record) => {
      const artifact = await artifactStore.read<{ reason?: string }>(record.reasonHash).catch((): { reason?: string } => ({}));
      return toModerationRecordView(record, record.post.bodyHash, artifact.reason ?? "");
    })
  );
  const appealViews = await Promise.all(
    appeals.map(async (appeal) => {
      const [appealArtifact, resolutionArtifact] = await Promise.all([
        artifactStore.read<{ appeal?: string }>(appeal.appealHash).catch((): { appeal?: string } => ({})),
        appeal.resolutionHash
          ? artifactStore.read<{ resolution?: string }>(appeal.resolutionHash).catch((): { resolution?: string } => ({}))
          : Promise.resolve({ resolution: null })
      ]);
      return toModerationAppealView(appeal, appealArtifact.appeal ?? "", resolutionArtifact.resolution ?? null);
    })
  );
  return { moderationRecords, appeals: appealViews };
}

function toModerationRecordView(
  record: {
    id: string;
    questionId: string;
    postId: string;
    moderatorId: string;
    action: string;
    reasonCode: string;
    reasonHash: string;
    previousStatus: string;
    newStatus: string;
    createdAt: Date;
  },
  postBodyHash: string,
  reason: string
): ModerationRecordView {
  return {
    id: record.id,
    questionId: record.questionId,
    postId: record.postId,
    postBodyHash,
    moderatorId: record.moderatorId,
    action: normalizeModerationAction(record.action),
    reasonCode: normalizeModerationReasonCode(record.reasonCode),
    reasonHash: record.reasonHash,
    reason,
    previousStatus: normalizeDiscussionStatus(record.previousStatus),
    newStatus: normalizeDiscussionStatus(record.newStatus),
    createdAt: record.createdAt
  };
}

function toModerationAppealView(
  appeal: {
    id: string;
    moderationRecordId: string;
    appellantId: string;
    appealHash: string;
    status: string;
    resolutionHash: string | null;
    resolvedBy: string | null;
    createdAt: Date;
    resolvedAt: Date | null;
  },
  appealText: string,
  resolutionText: string | null
): ModerationAppealView {
  return {
    id: appeal.id,
    moderationRecordId: appeal.moderationRecordId,
    appellantId: appeal.appellantId,
    appealHash: appeal.appealHash,
    appeal: appealText,
    status: normalizeModerationAppealStatus(appeal.status),
    resolutionHash: appeal.resolutionHash,
    resolution: resolutionText,
    resolvedBy: appeal.resolvedBy,
    createdAt: appeal.createdAt,
    resolvedAt: appeal.resolvedAt
  };
}

function normalizeDiscussionStatus(status: string): "Published" | "Hidden" {
  return status === "Hidden" ? "Hidden" : "Published";
}

function normalizeModerationAction(action: string): DiscussionModerationAction {
  return action === "RestorePost" ? "RestorePost" : "HidePost";
}

function normalizeModerationReasonCode(reasonCode: string) {
  const parsed = DiscussionModerationReasonCodeSchema.safeParse(reasonCode);
  return parsed.success ? parsed.data : "Other";
}

function normalizeModerationAppealStatus(status: string) {
  if (status === "Upheld" || status === "Overturned") return status;
  return "Pending";
}

type JurorTargetContext = {
  targetType: JurorTargetType;
  questionId: string;
  challengeId: string | null;
  resultChallengeId: string | null;
  challengeAppealId: string | null;
  targetHash: string | null;
  ineligibleActors: string[];
};

async function loadJurorAssignmentsForQuestion(questionId: string, artifactStore: ArtifactStorageAdapter): Promise<JurorAssignmentView[]> {
  const assignments = await prisma.jurorAssignment.findMany({ where: { questionId }, orderBy: { createdAt: "asc" } });
  return Promise.all(assignments.map((assignment) => hydrateJurorAssignment(assignment, artifactStore)));
}

async function hydrateJurorAssignment(
  assignment: {
    id: string;
    questionId: string;
    targetType: string;
    challengeId: string | null;
    resultChallengeId: string | null;
    challengeAppealId: string | null;
    jurorId: string;
    selectedBy: string;
    selectionHash: string;
    conflictDisclosureHash: string | null;
    conflictStatus: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  },
  artifactStore: ArtifactStorageAdapter
): Promise<JurorAssignmentView> {
  const [selectionArtifact, conflictArtifact] = await Promise.all([
    artifactStore.read<{ selectionReason?: string }>(assignment.selectionHash).catch((): { selectionReason?: string } => ({})),
    assignment.conflictDisclosureHash
      ? artifactStore.read<{ disclosure?: string }>(assignment.conflictDisclosureHash).catch((): { disclosure?: string } => ({}))
      : Promise.resolve({ disclosure: null })
  ]);
  return toJurorAssignmentView(assignment, selectionArtifact.selectionReason ?? "", conflictArtifact.disclosure ?? null);
}

function toJurorAssignmentView(
  assignment: {
    id: string;
    questionId: string;
    targetType: string;
    challengeId: string | null;
    resultChallengeId: string | null;
    challengeAppealId: string | null;
    jurorId: string;
    selectedBy: string;
    selectionHash: string;
    conflictDisclosureHash: string | null;
    conflictStatus: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  },
  selectionReason: string,
  conflictDisclosure: string | null
): JurorAssignmentView {
  return {
    id: assignment.id,
    questionId: assignment.questionId,
    targetType: normalizeJurorTargetType(assignment.targetType),
    challengeId: assignment.challengeId,
    resultChallengeId: assignment.resultChallengeId,
    challengeAppealId: assignment.challengeAppealId,
    jurorId: assignment.jurorId,
    selectedBy: assignment.selectedBy,
    selectionHash: assignment.selectionHash,
    selectionReason,
    conflictDisclosureHash: assignment.conflictDisclosureHash,
    conflictDisclosure,
    conflictStatus: normalizeJurorConflictStatus(assignment.conflictStatus),
    status: assignment.status === "Withdrawn" ? "Withdrawn" : "Selected",
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt
  };
}

async function createJurorAssignment(
  target: JurorTargetContext,
  jurorId: string,
  selectedBy: string,
  selectionReason: string,
  artifactStore: ArtifactStorageAdapter
) {
  const selectionArtifact = await artifactStore.write(
    withArtifactSchema("juror-selection", {
      targetType: target.targetType,
      questionId: target.questionId,
      challengeId: target.challengeId,
      resultChallengeId: target.resultChallengeId,
      challengeAppealId: target.challengeAppealId,
      jurorId,
      selectedBy,
      selectionReason,
      ineligibleActors: target.ineligibleActors,
      selectionRule: "community-curator-with-no-party-conflict",
      selectedAt: Date.now()
    })
  );
  await storeArtifact(selectionArtifact, "juror-selection");
  const jurorSelectedEvent = prepareProtocolEvent({
    eventType: "JurorSelected",
    subjectId: target.questionId,
    actor: selectedBy,
    previousHash: target.targetHash,
    newHash: selectionArtifact.hash
  });
  const assignment = await prisma.$transaction(async (tx) => {
    const protocolEvent = await ingestProtocolEvent(tx, jurorSelectedEvent);
    const created = await tx.jurorAssignment.create({
      data: {
        id: `juror-assignment-${nanoid(10)}`,
        questionId: target.questionId,
        targetType: target.targetType,
        challengeId: target.challengeId,
        resultChallengeId: target.resultChallengeId,
        challengeAppealId: target.challengeAppealId,
        jurorId,
        selectedBy,
        selectionHash: selectionArtifact.hash
      }
    });
    await recordProtocolCommitments(protocolEvent, tx);
    return created;
  });
  return { assignment, selectionArtifact };
}

async function discloseJurorConflict(
  assignment: {
    id: string;
    questionId: string;
    targetType: string;
    challengeId: string | null;
    resultChallengeId: string | null;
    challengeAppealId: string | null;
    jurorId: string;
    selectionHash: string;
  },
  hasConflict: boolean,
  disclosure: string,
  artifactStore: ArtifactStorageAdapter
) {
  const disclosureArtifact = await artifactStore.write(
    withArtifactSchema("juror-conflict-disclosure", {
      assignmentId: assignment.id,
      targetType: assignment.targetType,
      questionId: assignment.questionId,
      challengeId: assignment.challengeId,
      resultChallengeId: assignment.resultChallengeId,
      challengeAppealId: assignment.challengeAppealId,
      jurorId: assignment.jurorId,
      hasConflict,
      disclosure,
      disclosedAt: Date.now()
    })
  );
  await storeArtifact(disclosureArtifact, "juror-conflict-disclosure");
  const jurorConflictDisclosedEvent = prepareProtocolEvent({
    eventType: "JurorConflictDisclosed",
    subjectId: assignment.questionId,
    actor: assignment.jurorId,
    previousHash: assignment.selectionHash,
    newHash: disclosureArtifact.hash
  });
  const updated = await prisma.$transaction(async (tx) => {
    const protocolEvent = await ingestProtocolEvent(tx, jurorConflictDisclosedEvent);
    const updatedAssignment = await tx.jurorAssignment.update({
      where: { id: assignment.id },
      data: {
        conflictDisclosureHash: disclosureArtifact.hash,
        conflictStatus: hasConflict ? "ConflictDeclared" : "Clear"
      }
    });
    await recordProtocolCommitments(protocolEvent, tx);
    return updatedAssignment;
  });
  return { updated, disclosureArtifact };
}

async function ensureClearJurorAssignment(
  target: JurorTargetContext,
  jurorId: string,
  selectedBy: string,
  conflictDisclosure: string,
  artifactStore: ArtifactStorageAdapter,
  reply: FastifyReply
) {
  if (target.ineligibleActors.includes(jurorId)) {
    reply.code(403).send({ error: "Juror has a direct conflict with this target" });
    return null;
  }
  let assignment = await prisma.jurorAssignment.findFirst({
    where: jurorAssignmentWhere(target, jurorId),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
  if (!assignment) {
    const created = await createJurorAssignment(target, jurorId, selectedBy, "Auto-selected for ruling under local MVP rules.", artifactStore);
    assignment = created.assignment;
  }
  if (assignment.conflictStatus === "ConflictDeclared") {
    reply.code(409).send({ error: "Selected juror has disclosed a conflict for this target" });
    return null;
  }
  if (assignment.conflictStatus !== "Clear") {
    const disclosed = await discloseJurorConflict(assignment, false, conflictDisclosure, artifactStore);
    assignment = disclosed.updated;
  }
  return assignment;
}

function jurorAssignmentWhere(target: JurorTargetContext, jurorId?: string): Prisma.JurorAssignmentWhereInput {
  return {
    questionId: target.questionId,
    targetType: target.targetType,
    challengeId: target.challengeId,
    resultChallengeId: target.resultChallengeId,
    challengeAppealId: target.challengeAppealId,
    jurorId,
    status: "Selected"
  };
}

function questionChallengeJurorTarget(challenge: {
  id: string;
  questionId: string;
  evidenceHash: string;
  challenger: string;
  question: { proposer: string };
}): JurorTargetContext {
  return {
    targetType: "QuestionChallenge",
    questionId: challenge.questionId,
    challengeId: challenge.id,
    resultChallengeId: null,
    challengeAppealId: null,
    targetHash: challenge.evidenceHash,
    ineligibleActors: uniqueStrings([challenge.challenger, challenge.question.proposer])
  };
}

function resultChallengeJurorTarget(resultChallenge: {
  id: string;
  poll: { questionId: string; question: { proposer: string } };
  evidenceHash: string;
  challenger: string;
}): JurorTargetContext {
  return {
    targetType: "ResultChallenge",
    questionId: resultChallenge.poll.questionId,
    challengeId: null,
    resultChallengeId: resultChallenge.id,
    challengeAppealId: null,
    targetHash: resultChallenge.evidenceHash,
    ineligibleActors: uniqueStrings([resultChallenge.challenger, resultChallenge.poll.question.proposer])
  };
}

function challengeAppealJurorTarget(appeal: {
  id: string;
  questionId: string;
  appealHash: string;
  appellantId: string;
  challenge?: { challenger: string; question: { proposer: string } } | null;
  resultChallenge?: { challenger: string; poll: { question: { proposer: string } } } | null;
}): JurorTargetContext {
  return {
    targetType: "ChallengeAppeal",
    questionId: appeal.questionId,
    challengeId: null,
    resultChallengeId: null,
    challengeAppealId: appeal.id,
    targetHash: appeal.appealHash,
    ineligibleActors: challengeAppealConflictActors(appeal)
  };
}

function normalizeJurorTargetType(targetType: string): JurorTargetType {
  if (targetType === "ResultChallenge" || targetType === "ChallengeAppeal") return targetType;
  return "QuestionChallenge";
}

function normalizeJurorConflictStatus(status: string): JurorConflictStatus {
  if (status === "Clear" || status === "ConflictDeclared") return status;
  return "PendingDisclosure";
}

async function loadChallengeAppealsForQuestion(questionId: string, artifactStore: ArtifactStorageAdapter): Promise<ChallengeAppealView[]> {
  const appeals = await prisma.challengeAppeal.findMany({ where: { questionId }, orderBy: { createdAt: "asc" } });
  return hydrateChallengeAppeals(appeals, artifactStore);
}

async function hydrateChallengeAppeals(
  appeals: Array<{
    id: string;
    questionId: string;
    targetType: string;
    challengeId: string | null;
    resultChallengeId: string | null;
    appellantId: string;
    appealBondId: string;
    appealedRuling: string;
    appealHash: string;
    status: string;
    resolutionHash: string | null;
    resolvedBy: string | null;
    createdAt: Date;
    resolvedAt: Date | null;
  }>,
  artifactStore: ArtifactStorageAdapter
): Promise<ChallengeAppealView[]> {
  return Promise.all(
    appeals.map(async (appeal) => {
      const [appealArtifact, resolutionArtifact] = await Promise.all([
        artifactStore.read<{ appeal?: string }>(appeal.appealHash).catch((): { appeal?: string } => ({})),
        appeal.resolutionHash
          ? artifactStore.read<{ resolution?: string }>(appeal.resolutionHash).catch((): { resolution?: string } => ({}))
          : Promise.resolve({ resolution: null })
      ]);
      return toChallengeAppealView(appeal, appealArtifact.appeal ?? "", resolutionArtifact.resolution ?? null);
    })
  );
}

async function readChallengeAppealText(appealHash: string, artifactStore: ArtifactStorageAdapter): Promise<string> {
  const artifact = await artifactStore.read<{ appeal?: string }>(appealHash).catch((): { appeal?: string } => ({}));
  return artifact.appeal ?? "";
}

function toChallengeAppealView(
  appeal: {
    id: string;
    questionId: string;
    targetType: string;
    challengeId: string | null;
    resultChallengeId: string | null;
    appellantId: string;
    appealBondId: string;
    appealedRuling: string;
    appealHash: string;
    status: string;
    resolutionHash: string | null;
    resolvedBy: string | null;
    createdAt: Date;
    resolvedAt: Date | null;
  },
  appealText: string,
  resolutionText: string | null
): ChallengeAppealView {
  return {
    id: appeal.id,
    questionId: appeal.questionId,
    targetType: normalizeChallengeAppealTargetType(appeal.targetType),
    challengeId: appeal.challengeId,
    resultChallengeId: appeal.resultChallengeId,
    appellantId: appeal.appellantId,
    appealBondId: appeal.appealBondId,
    appealedRuling: normalizeChallengeRuling(appeal.appealedRuling),
    appealHash: appeal.appealHash,
    appeal: appealText,
    status: normalizeChallengeAppealStatus(appeal.status),
    resolutionHash: appeal.resolutionHash,
    resolution: resolutionText,
    resolvedBy: appeal.resolvedBy,
    createdAt: appeal.createdAt,
    resolvedAt: appeal.resolvedAt
  };
}

function eligibleQuestionChallengeAppellants(challenge: { ruling: string; challenger: string; question: { proposer: string } }): string[] {
  if (challenge.ruling === "Rejected") return [challenge.challenger];
  if (challenge.ruling === "Sustained") return [challenge.question.proposer];
  if (challenge.ruling === "Remanded") return uniqueStrings([challenge.challenger, challenge.question.proposer]);
  return [];
}

function eligibleResultChallengeAppellants(resultChallenge: { ruling: string; challenger: string; poll: { question: { proposer: string } } }): string[] {
  if (resultChallenge.ruling === "Rejected") return [resultChallenge.challenger];
  if (resultChallenge.ruling === "Sustained") return [resultChallenge.poll.question.proposer];
  if (resultChallenge.ruling === "Remanded") return uniqueStrings([resultChallenge.challenger, resultChallenge.poll.question.proposer]);
  return [];
}

function challengeAppealConflictActors(appeal: {
  appellantId: string;
  challenge?: { challenger: string; question: { proposer: string } } | null;
  resultChallenge?: { challenger: string; poll: { question: { proposer: string } } } | null;
}) {
  return uniqueStrings([
    appeal.appellantId,
    appeal.challenge?.challenger,
    appeal.challenge?.question.proposer,
    appeal.resultChallenge?.challenger,
    appeal.resultChallenge?.poll.question.proposer
  ]);
}

function overturnedQuestionChallengeStatus(appealedRuling: string) {
  return appealedRuling === "Rejected" ? "Rejected" : "Accepted";
}

function normalizeChallengeRuling(ruling: string): "Sustained" | "Rejected" | "Remanded" {
  if (ruling === "Sustained" || ruling === "Remanded") return ruling;
  return "Rejected";
}

function normalizeChallengeAppealTargetType(targetType: string): ChallengeAppealTargetType {
  return targetType === "ResultChallenge" ? "ResultChallenge" : "QuestionChallenge";
}

function normalizeChallengeAppealStatus(status: string): ChallengeAppealStatus {
  if (status === "Upheld" || status === "Overturned") return status;
  return "Pending";
}

function buildDiscoveryTopics(
  questions: Array<{ topicIds: string[]; communityId: string | null }>,
  activeUserTopicFollows: Array<{ topicId: string }>,
  allTopicFollows: Array<{ topicId: string }>
): DiscoveryTopicView[] {
  const topicMap = new Map<string, { questionCount: number; communityIds: Set<string> }>();
  for (const question of questions) {
    for (const topicId of question.topicIds) {
      const current = topicMap.get(topicId) ?? { questionCount: 0, communityIds: new Set<string>() };
      current.questionCount += 1;
      if (question.communityId) current.communityIds.add(question.communityId);
      topicMap.set(topicId, current);
    }
  }
  const activeFollowTopics = new Set(activeUserTopicFollows.map((follow) => follow.topicId));
  return [...topicMap.entries()]
    .map(([topicId, value]) => ({
      topicId,
      questionCount: value.questionCount,
      communityCount: value.communityIds.size,
      followerCount: allTopicFollows.filter((follow) => follow.topicId === topicId).length,
      followedByActiveUser: activeFollowTopics.has(topicId)
    }))
    .sort((left, right) => right.questionCount - left.questionCount || left.topicId.localeCompare(right.topicId));
}

function sameStringArray(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function extractEventIds(value: unknown): string[] {
  return Array.isArray(value) ? value.flatMap((event) => (isRecord(event) && typeof event.id === "string" ? [event.id] : [])) : [];
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function toRegistryEventView(value: Record<string, unknown>): RegistryEventView[] {
  if (
    typeof value.id !== "string" ||
    typeof value.eventType !== "string" ||
    typeof value.subjectId !== "string" ||
    typeof value.actor !== "string" ||
    typeof value.newHash !== "string" ||
    (value.previousHash !== null && value.previousHash !== undefined && typeof value.previousHash !== "string")
  ) {
    return [];
  }

  return [
    {
      id: value.id,
      eventType: value.eventType,
      subjectId: value.subjectId,
      actor: value.actor,
      previousHash: typeof value.previousHash === "string" ? value.previousHash : null,
      newHash: value.newHash,
      sourceType: typeof value.sourceType === "string" ? value.sourceType : undefined,
      sourceTransactionId: typeof value.sourceTransactionId === "string" ? value.sourceTransactionId : null,
      sourceTransactionHash: typeof value.sourceTransactionHash === "string" ? value.sourceTransactionHash : null,
      sourceModule: typeof value.sourceModule === "string" ? value.sourceModule : null,
      transactionType: typeof value.transactionType === "string" ? value.transactionType : null,
      emittedAt: value.emittedAt instanceof Date ? value.emittedAt : new Date(typeof value.emittedAt === "string" ? value.emittedAt : 0)
  }
  ];
}

function assertProductionPrivacyConfig() {
  if (config.runtimeEnv !== "production") return;
  if (config.devMode) throw new Error("Refusing to start production API with PC_DEV_MODE enabled");
  if (config.demoMode) throw new Error("Refusing to start production API with PC_DEMO_MODE enabled");
  if (!config.requireAuth) throw new Error("Refusing to start production API without authenticated writes");
  if (config.corsOrigin === true) throw new Error("Refusing to start production API with reflected CORS origins");
}

function bundleHasArtifactReference(bundle: ArtifactExportBundle, reference: ArtifactReference): boolean {
  return bundle.artifacts.some(
    (entry) => entry.kind === reference.kind && entry.hash === reference.hash && (entry.role ?? undefined) === (reference.role ?? undefined)
  );
}

function isCommitmentRecordHashValid(commitment: Record<string, unknown>): boolean {
  const kind = optionalString(commitment.kind);
  const contractModule = optionalString(commitment.contractModule);
  const payloadHash = optionalString(commitment.payloadHash);
  const commitmentHash = optionalString(commitment.commitmentHash);
  const payload = commitment.payload;
  if (!kind || !contractModule || !payloadHash || !commitmentHash || !isRecord(payload)) return false;
  return payloadHash === hashJson(payload) && commitmentHash === hashJson({ kind, contractModule, payloadHash });
}

function isArtifactManifest(value: unknown): value is ArtifactManifest {
  return (
    isRecord(value) &&
    value.protocol === "popular-consensus" &&
    value.schemaVersion === "artifact-manifest-v1" &&
    Array.isArray(value.references) &&
    value.references.every(
      (reference) =>
        isRecord(reference) &&
        typeof reference.kind === "string" &&
        typeof reference.hash === "string" &&
        (reference.role === undefined || typeof reference.role === "string")
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function buildCommunitiesProtocol(
  communities: Array<{
    id: string;
    visibility: string;
    credentialSchemaId: string;
    defaultAuthorityLevel: string;
    memberCount: number;
    questionCount: number;
    createdBy: string;
  }>,
  page: PageInfo
) {
  return {
    protocol: "popular-consensus",
    schemaVersion: "communities-index-v0",
    page,
    ids: {
      communityIds: communities.map((community) => community.id),
      credentialSchemaIds: uniqueStrings(communities.map((community) => community.credentialSchemaId)),
      createdBy: uniqueStrings(communities.map((community) => community.createdBy))
    },
    hashes: {},
    statuses: {
      communityCount: communities.length,
      visibility: communities.map((community) => ({ communityId: community.id, visibility: community.visibility })),
      counts: communities.map((community) => ({
        communityId: community.id,
        memberCount: community.memberCount,
        questionCount: community.questionCount
      }))
    },
    authority: {
      defaultAuthorityLevels: uniqueStrings(communities.map((community) => normalizeAuthority(community.defaultAuthorityLevel)))
    }
  };
}

function buildMinimumCommitmentsProtocol() {
  return {
    protocol: "popular-consensus",
    schemaVersion: "minimum-commitments-v0",
    ids: {
      commitmentKinds: MinimumProtocolCommitments.map((commitment) => commitment.kind),
      contractModules: uniqueStrings(MinimumProtocolCommitments.map((commitment) => commitment.contractModule))
    },
    hashes: {
      commitmentSetHash: hashJson(MinimumProtocolCommitments)
    },
    statuses: {
      commitmentCount: MinimumProtocolCommitments.length,
      milestone: "public-audit-commitments"
    },
    authority: {
      source: "@pc/shared",
      roadmapItem: "3.minimum-commitment-set"
    }
  };
}

function buildCivicRecordProtocol(
  question: PublicQuestionProtocolInput,
  events: RegistryEventView[],
  archiveArtifact: { artifactManifestHash?: string } | null,
  commitments: CommitmentView[] = [],
  credentialIssuerAnnotations: CredentialIssuerAnnotation[] = []
) {
  const result = question.poll?.result ?? null;
  const archiveRecord = question.archiveRecord ?? null;

  return {
    protocol: "popular-consensus",
    schemaVersion: "public-civic-record-v0",
    ids: {
      questionId: question.id,
      communityId: question.communityId,
      pollId: question.poll?.id ?? null,
      resultId: result?.id ?? null,
      archiveRecordId: archiveRecord?.id ?? null,
      answerSchemaId: question.answerSchemaId,
      credentialSchemaId: question.credentialSchemaId,
      adoptionPolicyId: question.adoptionPolicyId,
      proposer: question.proposer,
      proposalBondId: question.proposalBondId,
      challengeIds: question.challenges.map((challenge) => challenge.id),
      resultChallengeIds: question.poll?.resultChallenges.map((challenge) => challenge.id) ?? [],
      challengeAppealIds: question.challengeAppeals.map((appeal) => appeal.id),
      challengeAppealBondIds: question.challengeAppeals.map((appeal) => appeal.appealBondId),
      jurorAssignmentIds: question.jurorAssignments.map((assignment) => assignment.id),
      jurorIds: uniqueStrings(question.jurorAssignments.map((assignment) => assignment.jurorId)),
      credentialIssuerIds: credentialIssuerAnnotations.map((annotation) => annotation.issuerId),
      commitmentIds: commitments.map((commitment) => commitment.id),
      commitmentSourceEventIds: uniqueStrings(commitments.map((commitment) => commitment.sourceEventId))
    },
    hashes: {
      questionBodyHash: question.bodyHash,
      sponsorDisclosureHash: question.sponsorDisclosureHash,
      resultArtifactHash: result?.resultArtifactHash ?? null,
      aggregateCountsHash: result?.aggregateCountsHash ?? null,
      tallyProofHash: result?.tallyProofHash ?? null,
      privacyReportHash: result?.privacyReportHash ?? null,
      archiveHash: archiveRecord?.archiveHash ?? null,
      archiveManifestHash: archiveArtifact?.artifactManifestHash ?? null,
      questionChallengeEvidenceHashes: question.challenges.map((challenge) => challenge.evidenceHash),
      questionChallengeResolutionHashes: compactHashArray(question.challenges.map((challenge) => challenge.resolutionHash)),
      resultChallengeEvidenceHashes: question.poll?.resultChallenges.map((challenge) => challenge.evidenceHash) ?? [],
      resultChallengeResolutionHashes: compactHashArray(question.poll?.resultChallenges.map((challenge) => challenge.resolutionHash) ?? []),
      challengeAppealHashes: question.challengeAppeals.map((appeal) => appeal.appealHash),
      challengeAppealResolutionHashes: compactHashArray(question.challengeAppeals.map((appeal) => appeal.resolutionHash)),
      jurorSelectionHashes: question.jurorAssignments.map((assignment) => assignment.selectionHash),
      jurorConflictDisclosureHashes: compactHashArray(question.jurorAssignments.map((assignment) => assignment.conflictDisclosureHash)),
      credentialIssuerMetadataHashes: credentialIssuerAnnotations.map((annotation) => annotation.metadataHash),
      credentialIssuerSuspensionHashes: compactHashArray(credentialIssuerAnnotations.map((annotation) => annotation.suspensionHash)),
      eventStreamHash: hashJson(events.map((event) => ({ eventType: event.eventType, subjectId: event.subjectId, previousHash: event.previousHash, newHash: event.newHash }))),
      latestEventHash: events.at(-1)?.newHash ?? null,
      commitmentHashes: commitments.map((commitment) => commitment.commitmentHash),
      commitmentPayloadHashes: commitments.map((commitment) => commitment.payloadHash)
    },
    statuses: {
      questionStatus: question.status,
      pollStatus: question.poll?.status ?? null,
      resultFinalStatus: result?.finalStatus ?? null,
      archiveStatus: archiveRecord ? "Archived" : "Unarchived",
      commitmentCount: commitments.length,
      commitmentKinds: uniqueStrings(commitments.map((commitment) => commitment.kind)),
      questionChallengeStatuses: question.challenges.map((challenge) => ({
        challengeId: challenge.id,
        reasonCode: challenge.reasonCode,
        ruling: challenge.ruling
      })),
      resultChallengeStatuses: question.poll?.resultChallenges.map((challenge) => ({
        challengeId: challenge.id,
        reasonCode: challenge.reasonCode,
        ruling: challenge.ruling
      })) ?? [],
      challengeAppealStatuses: {
        Pending: question.challengeAppeals.filter((appeal) => appeal.status === "Pending").length,
        Upheld: question.challengeAppeals.filter((appeal) => appeal.status === "Upheld").length,
        Overturned: question.challengeAppeals.filter((appeal) => appeal.status === "Overturned").length
      },
      jurorConflictStatuses: {
        PendingDisclosure: question.jurorAssignments.filter((assignment) => assignment.conflictStatus === "PendingDisclosure").length,
        Clear: question.jurorAssignments.filter((assignment) => assignment.conflictStatus === "Clear").length,
        ConflictDeclared: question.jurorAssignments.filter((assignment) => assignment.conflictStatus === "ConflictDeclared").length
      },
      credentialIssuerAnnotations: credentialIssuerAnnotations.map((annotation) => ({
        issuerId: annotation.issuerId,
        status: annotation.status,
        affectedQuestionIds: annotation.affectedQuestionIds
      }))
    },
    authority: {
      authorityLevel: normalizeAuthority(question.authorityLevel),
      adoptionPolicyId: question.adoptionPolicyId,
      communityDefaultAuthorityLevel: normalizeAuthority(question.community?.defaultAuthorityLevel ?? "Advisory"),
      communityVisibility: question.community?.visibility ?? null,
      communityCredentialSchemaId: question.community?.credentialSchemaId ?? null,
      credentialSchemaId: question.credentialSchemaId,
      methodologyLabel: question.methodologyLabel,
      topicIds: question.topicIds,
      geoScope: question.geoScope,
      privacyThreshold: question.poll?.privacyThreshold ?? null,
      resultChallengeEndsAt: question.poll?.resultChallengeEndsAt ?? null,
      jurorSelectionRule: "community-curator-with-no-party-conflict",
      commitmentContractModules: uniqueStrings(commitments.map((commitment) => commitment.contractModule)),
      commitmentMode: commitments.length ? "local-devnet-record" : null
    }
  };
}

function buildChallengeAppealsProtocol(questionId: string, appeals: ChallengeAppealView[]) {
  return {
    protocol: "popular-consensus",
    schemaVersion: "challenge-appeals-v0",
    ids: {
      questionId,
      appealIds: appeals.map((appeal) => appeal.id),
      questionChallengeIds: compactHashArray(appeals.map((appeal) => appeal.challengeId)),
      resultChallengeIds: compactHashArray(appeals.map((appeal) => appeal.resultChallengeId)),
      appealBondIds: appeals.map((appeal) => appeal.appealBondId),
      appellants: uniqueStrings(appeals.map((appeal) => appeal.appellantId)),
      resolvedBy: uniqueStrings(appeals.map((appeal) => appeal.resolvedBy))
    },
    hashes: {
      appealHashes: appeals.map((appeal) => appeal.appealHash),
      resolutionHashes: compactHashArray(appeals.map((appeal) => appeal.resolutionHash))
    },
    statuses: {
      appealCount: appeals.length,
      Pending: appeals.filter((appeal) => appeal.status === "Pending").length,
      Upheld: appeals.filter((appeal) => appeal.status === "Upheld").length,
      Overturned: appeals.filter((appeal) => appeal.status === "Overturned").length
    },
    authority: {
      appealModel: "losing-side-appeal-bond",
      appealBondPc: DEFAULT_GOVERNANCE.appealBondPc,
      targetTypes: uniqueStrings(appeals.map((appeal) => appeal.targetType))
    }
  };
}

function buildJurorAssignmentsProtocol(questionId: string, assignments: JurorAssignmentView[]) {
  return {
    protocol: "popular-consensus",
    schemaVersion: "juror-assignments-v0",
    ids: {
      questionId,
      assignmentIds: assignments.map((assignment) => assignment.id),
      jurorIds: uniqueStrings(assignments.map((assignment) => assignment.jurorId)),
      selectedBy: uniqueStrings(assignments.map((assignment) => assignment.selectedBy)),
      questionChallengeIds: compactHashArray(assignments.map((assignment) => assignment.challengeId)),
      resultChallengeIds: compactHashArray(assignments.map((assignment) => assignment.resultChallengeId)),
      challengeAppealIds: compactHashArray(assignments.map((assignment) => assignment.challengeAppealId))
    },
    hashes: {
      selectionHashes: assignments.map((assignment) => assignment.selectionHash),
      conflictDisclosureHashes: compactHashArray(assignments.map((assignment) => assignment.conflictDisclosureHash))
    },
    statuses: {
      assignmentCount: assignments.length,
      targetTypes: uniqueStrings(assignments.map((assignment) => assignment.targetType)),
      conflictStatuses: {
        PendingDisclosure: assignments.filter((assignment) => assignment.conflictStatus === "PendingDisclosure").length,
        Clear: assignments.filter((assignment) => assignment.conflictStatus === "Clear").length,
        ConflictDeclared: assignments.filter((assignment) => assignment.conflictStatus === "ConflictDeclared").length
      },
      activeAssignmentCount: assignments.filter((assignment) => assignment.status === "Selected").length
    },
    authority: {
      selectionRule: "community-curator-with-no-party-conflict",
      disclosureRequiredBeforeRuling: true
    }
  };
}

function buildQuestionDiscussionProtocol(
  question: { id: string; communityId: string | null },
  discussion: DiscussionPostView[],
  views: DiscussionView[]
) {
  return {
    protocol: "popular-consensus",
    schemaVersion: "question-discussion-v0",
    ids: {
      questionId: question.id,
      communityId: question.communityId,
      postIds: discussion.map((post) => post.id),
      authorIds: uniqueStrings(discussion.map((post) => post.authorId)),
      postIdsByView: Object.fromEntries(views.map((view) => [view.key, view.posts.map((post) => post.id)]))
    },
    hashes: {
      bodyHashes: discussion.map((post) => post.bodyHash),
      bodyHashesByView: Object.fromEntries(views.map((view) => [view.key, view.posts.map((post) => post.bodyHash)]))
    },
    statuses: {
      totalPosts: discussion.length,
      countsByKind: Object.fromEntries(views.map((view) => [view.kind, view.count])),
      countsByView: Object.fromEntries(views.map((view) => [view.key, view.count])),
      publishedOnly: discussion.every((post) => post.status === "Published")
    },
    authority: {
      source: "discussion-post-artifacts",
      visibility: question.communityId ? "community-gated" : "public-question",
      moderationStatus: "published-posts-only",
      portableViews: views.map((view) => ({ key: view.key, kind: view.kind, label: view.label }))
    }
  };
}

function buildQuestionModerationProtocol(
  question: { id: string; communityId: string | null },
  moderationRecords: ModerationRecordView[],
  appeals: ModerationAppealView[]
) {
  return {
    protocol: "popular-consensus",
    schemaVersion: "question-moderation-v0",
    ids: {
      questionId: question.id,
      communityId: question.communityId,
      moderationRecordIds: moderationRecords.map((record) => record.id),
      appealIds: appeals.map((appeal) => appeal.id),
      moderatedPostIds: uniqueStrings(moderationRecords.map((record) => record.postId)),
      moderators: uniqueStrings(moderationRecords.map((record) => record.moderatorId)),
      appellants: uniqueStrings(appeals.map((appeal) => appeal.appellantId))
    },
    hashes: {
      reasonHashes: moderationRecords.map((record) => record.reasonHash),
      appealHashes: appeals.map((appeal) => appeal.appealHash),
      resolutionHashes: compactHashArray(appeals.map((appeal) => appeal.resolutionHash)),
      moderatedPostBodyHashes: uniqueStrings(moderationRecords.map((record) => record.postBodyHash))
    },
    statuses: {
      moderationRecordCount: moderationRecords.length,
      appealCount: appeals.length,
      actionCounts: {
        HidePost: moderationRecords.filter((record) => record.action === "HidePost").length,
        RestorePost: moderationRecords.filter((record) => record.action === "RestorePost").length
      },
      appealStatuses: {
        Pending: appeals.filter((appeal) => appeal.status === "Pending").length,
        Upheld: appeals.filter((appeal) => appeal.status === "Upheld").length,
        Overturned: appeals.filter((appeal) => appeal.status === "Overturned").length
      }
    },
    authority: {
      source: "discussion-moderation-artifacts",
      visibility: question.communityId ? "community-gated" : "public-question",
      resultImpact: "none",
      appealModel: "author-appeal"
    }
  };
}

function buildProfileRecordProtocol(
  profile: { id: string; username: string; profileId: string | null; profileHash: string | null; reputation: number },
  profileHash: string | null
) {
  return {
    protocol: "popular-consensus",
    schemaVersion: "profile-record-v0",
    ids: {
      userId: profile.id,
      username: profile.username,
      profileId: profile.profileId
    },
    hashes: {
      profileHash
    },
    statuses: {
      reputation: profile.reputation,
      profileStatus: profile.profileId && profileHash ? "Portable" : "LocalOnly"
    },
    authority: {
      source: "user-profile-artifact",
      portability: "profile-id"
    }
  };
}

function buildDiscoveryProtocol(
  communities: DiscoveryCommunityView[],
  topics: DiscoveryTopicView[],
  communityFollows: Array<{ id: string; communityId: string; userId: string; followHash: string }>,
  topicFollows: Array<{ id: string; topicId: string; userId: string; followHash: string }>,
  activeUserId: string | null
) {
  return {
    protocol: "popular-consensus",
    schemaVersion: "discovery-index-v0",
    ids: {
      activeUserId,
      communityIds: communities.map((community) => community.id),
      topicIds: topics.map((topic) => topic.topicId),
      communityFollowIds: communityFollows.map((follow) => follow.id),
      topicFollowIds: topicFollows.map((follow) => follow.id)
    },
    hashes: {
      communityFollowHashes: communityFollows.map((follow) => follow.followHash),
      topicFollowHashes: topicFollows.map((follow) => follow.followHash)
    },
    statuses: {
      communityCount: communities.length,
      topicCount: topics.length,
      followedCommunityCount: communityFollows.length,
      followedTopicCount: topicFollows.length
    },
    authority: {
      source: "visible-community-question-index",
      privateCommunityRule: "members-only",
      discoveryMode: "derived-topic-index"
    }
  };
}

function buildGovernanceParametersProtocol(
  communityId: string,
  activeParameterSet: CommunityExportGovernanceParameterInput | null,
  parameterSets: CommunityExportGovernanceParameterInput[]
) {
  return {
    protocol: "popular-consensus",
    schemaVersion: "governance-parameters-v0",
    ids: {
      communityId,
      activeParameterSetId: activeParameterSet?.id ?? null,
      parameterSetIds: parameterSets.map((set) => set.id),
      proposedBy: uniqueStrings(parameterSets.map((set) => set.proposedBy)),
      activatedBy: uniqueStrings(parameterSets.map((set) => set.activatedBy))
    },
    hashes: {
      proposalHashes: parameterSets.map((set) => set.proposalHash),
      activationHashes: compactHashArray(parameterSets.map((set) => set.activationHash)),
      activeProposalHash: activeParameterSet?.proposalHash ?? null,
      activeActivationHash: activeParameterSet?.activationHash ?? null
    },
    statuses: {
      parameterSetCount: parameterSets.length,
      active: activeParameterSet ? "Configured" : "Default",
      Proposed: parameterSets.filter((set) => set.status === "Proposed").length,
      Active: parameterSets.filter((set) => set.status === "Active").length,
      Retired: parameterSets.filter((set) => set.status === "Retired").length
    },
    authority: {
      parameterScope: "community",
      defaultFallback: DEFAULT_GOVERNANCE,
      activeParameters: activeParameterSet ? toGovernanceParameters(activeParameterSet) : DEFAULT_GOVERNANCE
    }
  };
}

function buildTreasuryLedgerEntries(communityId: string, bonds: TreasuryLedgerBondInput[]): TreasuryLedgerEntry[] {
  const treasuryAccountId = treasuryAccountForCommunity(communityId);
  const entries = bonds.flatMap((bond) => {
    const sourceType: TreasuryLedgerEntry["sourceType"] = bond.challengeAppealId
      ? "AppealBond"
      : bond.resultChallengeId
        ? "ResultChallengeBond"
        : bond.challengeId
          ? "QuestionChallengeBond"
          : "ProposalBond";
    const sourceId = bond.challengeAppealId ?? bond.resultChallengeId ?? bond.challengeId ?? bond.questionId ?? bond.id;
    const base = {
      communityId,
      bondId: bond.id,
      bondType: normalizeBondType(bond.bondType),
      sourceType,
      sourceId,
      questionId: bond.questionId,
      challengeId: bond.challengeId,
      resultChallengeId: bond.resultChallengeId,
      challengeAppealId: bond.challengeAppealId
    };
    const bondEntries: TreasuryLedgerEntry[] = [
      treasuryLedgerEntry({
        ...base,
        accountId: bond.owner,
        accountRole: "Participant",
        entryType: "Escrow",
        direction: "Debit",
        amountPc: bond.amountPc,
        balanceImpactPc: -bond.amountPc,
        createdAt: bond.createdAt
      })
    ];

    if (bond.refundedPc > 0) {
      bondEntries.push(
        treasuryLedgerEntry({
          ...base,
          accountId: bond.owner,
          accountRole: "Participant",
          entryType: "Refund",
          direction: "Credit",
          amountPc: bond.refundedPc,
          balanceImpactPc: bond.refundedPc,
          createdAt: bond.settledAt ?? bond.createdAt
        })
      );
    }

    if (bond.rewardPc > 0) {
      bondEntries.push(
        treasuryLedgerEntry({
          ...base,
          accountId: bond.owner,
          accountRole: "Participant",
          entryType: "Reward",
          direction: "Credit",
          amountPc: bond.rewardPc,
          balanceImpactPc: bond.rewardPc,
          createdAt: bond.settledAt ?? bond.createdAt
        })
      );
    }

    if (bond.treasuryPc > 0) {
      bondEntries.push(
        treasuryLedgerEntry({
          ...base,
          accountId: treasuryAccountId,
          accountRole: "CommunityTreasury",
          entryType: "TreasuryFee",
          direction: "Credit",
          amountPc: bond.treasuryPc,
          balanceImpactPc: bond.treasuryPc,
          createdAt: bond.settledAt ?? bond.createdAt
        })
      );
    }

    return bondEntries;
  });

  return sortTreasuryLedgerEntries(entries);
}

function buildDataUnionTreasuryLedgerEntries(communityId: string, grants: DataUnionAccessGrantLedgerInput[]): TreasuryLedgerEntry[] {
  const treasuryAccountId = treasuryAccountForCommunity(communityId);
  const participantPoolAccountId = participantPoolAccountForCommunity(communityId);
  const operatorPoolAccountId = operatorPoolAccountForCommunity(communityId);
  const entries = grants.flatMap((grant) =>
    grant.settlements
      .filter((settlement) => settlement.status === "Settled" && settlement.settledPc > 0)
      .flatMap((settlement) => {
        const base = {
          communityId,
          bondId: null,
          bondType: null,
          sourceType: "DataUnionSettlement" as const,
          sourceId: settlement.id,
          questionId: grant.product.result.poll.questionId,
          challengeId: null,
          resultChallengeId: null,
          challengeAppealId: null,
          dataUnionProductId: grant.productId,
          dataUnionAccessGrantId: grant.id,
          dataUnionSettlementId: settlement.id,
          createdAt: settlement.settledAt ?? settlement.createdAt
        };

        return [
          treasuryLedgerEntry({
            ...base,
            accountId: dataBuyerAccount(grant.buyerId),
            accountRole: "DataBuyer",
            entryType: "DataUnionPayment",
            direction: "Debit",
            amountPc: settlement.settledPc,
            balanceImpactPc: -settlement.settledPc
          }),
          treasuryLedgerEntry({
            ...base,
            accountId: treasuryAccountId,
            accountRole: "CommunityTreasury",
            entryType: "DataUnionRevenue",
            direction: "Credit",
            amountPc: grant.treasuryPc,
            balanceImpactPc: grant.treasuryPc
          }),
          treasuryLedgerEntry({
            ...base,
            accountId: participantPoolAccountId,
            accountRole: "ParticipantPool",
            entryType: "ParticipantPoolCredit",
            direction: "Credit",
            amountPc: grant.participantPoolPc,
            balanceImpactPc: grant.participantPoolPc
          }),
          treasuryLedgerEntry({
            ...base,
            accountId: grant.product.result.poll.question.proposer,
            accountRole: "PollAuthor",
            entryType: "PollAuthorRoyaltyCredit",
            direction: "Credit",
            amountPc: grant.pollAuthorRoyaltyPc,
            balanceImpactPc: grant.pollAuthorRoyaltyPc
          }),
          treasuryLedgerEntry({
            ...base,
            accountId: operatorPoolAccountId,
            accountRole: "OperatorPool",
            entryType: "OperatorPoolCredit",
            direction: "Credit",
            amountPc: grant.operatorPoolPc,
            balanceImpactPc: grant.operatorPoolPc
          })
        ].filter((entry) => entry.amountPc > 0);
      })
  );

  return sortTreasuryLedgerEntries(entries);
}

function sortTreasuryLedgerEntries(entries: TreasuryLedgerEntry[]): TreasuryLedgerEntry[] {
  return entries.sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime() || left.id.localeCompare(right.id));
}

function buildTreasuryLedgerTotals(entries: TreasuryLedgerEntry[], bonds: TreasuryLedgerBondInput[]): TreasuryLedgerTotals {
  const participantNetPc: Record<string, number> = {};
  for (const entry of entries) {
    if (entry.accountRole === "Participant") {
      participantNetPc[entry.accountId] = (participantNetPc[entry.accountId] ?? 0) + entry.balanceImpactPc;
    }
  }

  return {
    entryCount: entries.length,
    escrowedPc: sumEntries(entries, "Escrow"),
    refundedPc: sumEntries(entries, "Refund"),
    rewardedPc: sumEntries(entries, "Reward"),
    treasuryPc: sumEntries(entries, "TreasuryFee") + sumEntries(entries, "DataUnionRevenue"),
    dataUnionRevenuePc: sumEntries(entries, "DataUnionPayment"),
    participantPoolPc: sumEntries(entries, "ParticipantPoolCredit"),
    pollAuthorRoyaltyPc: sumEntries(entries, "PollAuthorRoyaltyCredit"),
    operatorPoolPc: sumEntries(entries, "OperatorPoolCredit"),
    openEscrowPc: bonds.filter((bond) => bond.status === "Escrowed").reduce((sum, bond) => sum + bond.amountPc, 0),
    treasuryBalancePc: entries
      .filter((entry) => entry.accountRole === "CommunityTreasury")
      .reduce((sum, entry) => sum + entry.balanceImpactPc, 0),
    participantNetPc
  };
}

function buildTreasuryLedgerProtocol(
  communityId: string,
  entries: TreasuryLedgerEntry[],
  totals: TreasuryLedgerTotals,
  filters: { questionId: string | null; accountId: string | null }
) {
  return {
    protocol: "popular-consensus",
    schemaVersion: "treasury-ledger-v0",
    ids: {
      communityId,
      questionId: filters.questionId,
      accountId: filters.accountId,
      entryIds: entries.map((entry) => entry.id),
      bondIds: uniqueStrings(entries.map((entry) => entry.bondId)),
      dataUnionProductIds: uniqueStrings(entries.map((entry) => entry.dataUnionProductId)),
      dataUnionAccessGrantIds: uniqueStrings(entries.map((entry) => entry.dataUnionAccessGrantId)),
      dataUnionSettlementIds: uniqueStrings(entries.map((entry) => entry.dataUnionSettlementId)),
      accountIds: uniqueStrings(entries.map((entry) => entry.accountId)),
      questionIds: uniqueStrings(entries.map((entry) => entry.questionId))
    },
    hashes: {
      ledgerHash: hashJson(entries)
    },
    statuses: {
      accountingStatus: "Available",
      entryCount: totals.entryCount,
      escrowedPc: totals.escrowedPc,
      refundedPc: totals.refundedPc,
      rewardedPc: totals.rewardedPc,
      treasuryPc: totals.treasuryPc,
      dataUnionRevenuePc: totals.dataUnionRevenuePc,
      participantPoolPc: totals.participantPoolPc,
      pollAuthorRoyaltyPc: totals.pollAuthorRoyaltyPc,
      operatorPoolPc: totals.operatorPoolPc,
      openEscrowPc: totals.openEscrowPc,
      treasuryBalancePc: totals.treasuryBalancePc,
      participantNetPc: totals.participantNetPc
    },
    authority: {
      accountingModel: "bond-and-data-union-ledger",
      unit: "PC",
      source: "local-devnet-bond-and-data-union-events",
      treasuryAccountId: treasuryAccountForCommunity(communityId),
      participantPoolAccountId: participantPoolAccountForCommunity(communityId),
      operatorPoolAccountId: operatorPoolAccountForCommunity(communityId)
    }
  };
}

function buildDataUnionProtocol(
  communityId: string,
  activePolicy: DataUnionPolicy | null,
  policies: DataUnionPolicy[],
  consents: DataUnionConsent[],
  products: DataUnionProduct[],
  accessGrants: DataUnionAccessGrant[],
  buyers: DataUnionBuyer[],
  settlements: DataUnionSettlement[],
  claims: DataUnionClaim[]
) {
  const settledSettlements = settlements.filter((settlement) => settlement.status === "Settled");
  return {
    protocol: "popular-consensus",
    schemaVersion: "data-union-v0",
    ids: {
      communityId,
      activePolicyId: activePolicy?.id ?? null,
      policyIds: policies.map((policy) => policy.id),
      consentIds: consents.map((consent) => consent.id),
      memberIdsWithActiveConsent: uniqueStrings(consents.filter((consent) => consent.status === "Active").map((consent) => consent.userId)),
      productIds: products.map((product) => product.id),
      resultIds: uniqueStrings(products.map((product) => product.resultId)),
      accessGrantIds: accessGrants.map((grant) => grant.id),
      buyerRecordIds: buyers.map((buyer) => buyer.id),
      buyerIds: uniqueStrings([...buyers.map((buyer) => buyer.buyerId), ...accessGrants.map((grant) => grant.buyerId)]),
      settlementIds: settlements.map((settlement) => settlement.id),
      claimIds: claims.map((claim) => claim.id)
    },
    hashes: {
      dataUnionStateHash: hashJson({ policies, consents, products, accessGrants, buyers, settlements, claims }),
      activePolicyHash: activePolicy?.policyHash ?? null,
      policyHashes: policies.map((policy) => policy.policyHash),
      activationHashes: compactHashArray(policies.map((policy) => policy.activationHash)),
      consentHashes: consents.map((consent) => consent.consentHash),
      revokedHashes: compactHashArray(consents.map((consent) => consent.revokedHash)),
      dataProductHashes: products.map((product) => product.dataProductHash),
      productPrivacyReportHashes: products.map((product) => product.privacyReportHash),
      buyerApprovalHashes: buyers.map((buyer) => buyer.approvalHash),
      accessHashes: accessGrants.map((grant) => grant.accessHash),
      settlementHashes: settlements.map((settlement) => settlement.settlementHash),
      claimHashes: claims.map((claim) => claim.claimHash)
    },
    statuses: {
      activePolicyStatus: activePolicy ? "Active" : "Missing",
      policyCount: policies.length,
      activeConsentCount: consents.filter((consent) => consent.status === "Active").length,
      revokedConsentCount: consents.filter((consent) => consent.status === "Revoked").length,
      productCount: products.length,
      publishedProductCount: products.filter((product) => product.status === "Published").length,
      approvedBuyerCount: buyers.filter((buyer) => buyer.status === "Approved").length,
      accessGrantCount: accessGrants.length,
      activeAccessGrantCount: accessGrants.filter((grant) => grant.status === "Active").length,
      settlementCount: settlements.length,
      settledSettlementCount: settledSettlements.length,
      claimCount: claims.length,
      claimableClaimCount: claims.filter((claim) => claim.status === "Claimable").length,
      claimedClaimCount: claims.filter((claim) => claim.status === "Claimed").length,
      totalAccessPaymentPc: accessGrants.reduce((sum, grant) => sum + grant.paymentPc, 0),
      settledAccessPaymentPc: settledSettlements.reduce((sum, settlement) => sum + settlement.settledPc, 0),
      communityTreasuryPc: claims.filter((claim) => claim.role === "CommunityTreasury").reduce((sum, claim) => sum + claim.amountPc, 0),
      participantPoolPc: claims.filter((claim) => claim.role === "Participant").reduce((sum, claim) => sum + claim.amountPc, 0),
      pollAuthorRoyaltyPc: claims.filter((claim) => claim.role === "PollAuthor").reduce((sum, claim) => sum + claim.amountPc, 0),
      operatorPoolPc: claims.filter((claim) => claim.role === "OperatorPool").reduce((sum, claim) => sum + claim.amountPc, 0)
    },
    authority: {
      module: "DataUnionRegistry",
      consentModel: "member-opt-in-and-member-revocable-for-future-use",
      buyerGate: "steward-approved-buyer-allowlist-with-template-and-purpose-hashes",
      settlementModel: "rail-neutral-external-reference-records-before-claim-generation",
      claimPrivacy: "public summaries redact claimant ids, receipt hashes, and redemption nullifiers",
      productBoundary: "published-aggregate-results-and-methodology-only",
      privacyBoundary: "no-raw-ballots-no-identifiable-responses",
      minimumCohortSize: activePolicy?.minimumCohortSize ?? null,
      revenueSplit: activePolicy?.revenueSplit ?? null,
      treasuryAccountId: treasuryAccountForCommunity(communityId),
      participantPoolAccountId: participantPoolAccountForCommunity(communityId),
      operatorPoolAccountId: operatorPoolAccountForCommunity(communityId)
    }
  };
}

function toDataUnionPolicyResponse(policy: DataUnionPolicyInput): DataUnionPolicy {
  return {
    id: policy.id,
    communityId: policy.communityId,
    title: policy.title,
    purposeHash: policy.purposeHash,
    allowedProductTypes: policy.allowedProductTypes as DataUnionPolicy["allowedProductTypes"],
    minimumCohortSize: policy.minimumCohortSize,
    consentRevocationRuleHash: policy.consentRevocationRuleHash,
    dataRetentionDays: policy.dataRetentionDays,
    revenueSplit: parseDataUnionRevenueSplit(policy.revenueSplitJson),
    status: policy.status as DataUnionPolicy["status"],
    policyHash: policy.policyHash,
    activationHash: policy.activationHash,
    proposedBy: policy.proposedBy,
    activatedBy: policy.activatedBy,
    effectiveAt: policy.effectiveAt,
    createdAt: policy.createdAt,
    updatedAt: policy.updatedAt
  };
}

function toDataUnionConsentResponse(consent: DataUnionConsentInput): DataUnionConsent {
  return {
    id: consent.id,
    communityId: consent.communityId,
    policyId: consent.policyId,
    userId: consent.userId,
    scope: consent.scope as DataUnionConsent["scope"],
    status: consent.status as DataUnionConsent["status"],
    consentHash: consent.consentHash,
    revokedHash: consent.revokedHash,
    createdAt: consent.createdAt,
    revokedAt: consent.revokedAt,
    updatedAt: consent.updatedAt
  };
}

function toDataUnionProductResponse(product: DataUnionProductInput): DataUnionProduct {
  return {
    id: product.id,
    communityId: product.communityId,
    policyId: product.policyId,
    resultId: product.resultId,
    productType: product.productType as DataUnionProduct["productType"],
    title: product.title,
    descriptionHash: product.descriptionHash,
    dataProductHash: product.dataProductHash,
    privacyReportHash: product.privacyReportHash,
    methodologyHash: product.methodologyHash,
    minimumCohortSize: product.minimumCohortSize,
    cohortSize: product.cohortSize,
    pricePc: product.pricePc,
    status: product.status as DataUnionProduct["status"],
    createdBy: product.createdBy,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
}

function toDataUnionAccessGrantResponse(grant: DataUnionAccessGrantInput): DataUnionAccessGrant {
  return {
    id: grant.id,
    communityId: grant.communityId,
    productId: grant.productId,
    buyerId: grant.buyerId,
    buyerType: grant.buyerType as DataUnionAccessGrant["buyerType"],
    purposeHash: grant.purposeHash,
    licenseTemplate: grant.licenseTemplate as DataUnionAccessGrant["licenseTemplate"],
    licenseHash: grant.licenseHash,
    paymentPc: grant.paymentPc,
    treasuryPc: grant.treasuryPc,
    participantPoolPc: grant.participantPoolPc,
    pollAuthorRoyaltyPc: grant.pollAuthorRoyaltyPc,
    operatorPoolPc: grant.operatorPoolPc,
    accessHash: grant.accessHash,
    status: grant.status as DataUnionAccessGrant["status"],
    grantedBy: grant.grantedBy,
    createdAt: grant.createdAt,
    revokedAt: grant.revokedAt
  };
}

function toDataUnionBuyerResponse(buyer: DataUnionBuyerInput): DataUnionBuyer {
  return {
    id: buyer.id,
    communityId: buyer.communityId,
    buyerId: buyer.buyerId,
    buyerType: buyer.buyerType as DataUnionBuyer["buyerType"],
    status: buyer.status as DataUnionBuyer["status"],
    allowedProductTypes: buyer.allowedProductTypes as DataUnionBuyer["allowedProductTypes"],
    purposeHash: buyer.purposeHash,
    eligibilityHash: buyer.eligibilityHash,
    licenseTemplate: buyer.licenseTemplate as DataUnionBuyer["licenseTemplate"],
    licenseTemplateHash: buyer.licenseTemplateHash,
    approvalHash: buyer.approvalHash,
    approvedBy: buyer.approvedBy,
    approvedAt: buyer.approvedAt,
    suspendedAt: buyer.suspendedAt,
    createdAt: buyer.createdAt,
    updatedAt: buyer.updatedAt
  };
}

function toDataUnionSettlementResponse(settlement: DataUnionSettlementInput): DataUnionSettlement {
  return {
    id: settlement.id,
    communityId: settlement.communityId,
    accessGrantId: settlement.accessGrantId,
    rail: settlement.rail as DataUnionSettlement["rail"],
    unit: settlement.unit,
    amountPc: settlement.amountPc,
    feesPc: settlement.feesPc,
    settledPc: settlement.settledPc,
    externalReferenceHash: settlement.externalReferenceHash,
    settlementProofHash: settlement.settlementProofHash,
    settlementHash: settlement.settlementHash,
    status: settlement.status as DataUnionSettlement["status"],
    recordedBy: settlement.recordedBy,
    settledAt: settlement.settledAt,
    createdAt: settlement.createdAt
  };
}

function toDataUnionClaimResponse(claim: DataUnionClaimInput): DataUnionClaim {
  return {
    id: claim.id,
    communityId: claim.communityId,
    accessGrantId: claim.accessGrantId,
    settlementId: claim.settlementId,
    productId: claim.productId,
    policyId: claim.policyId,
    role: claim.role as DataUnionClaim["role"],
    amountPc: claim.amountPc,
    claimHash: claim.claimHash,
    redemptionHash: claim.redemptionHash,
    status: claim.status as DataUnionClaim["status"],
    createdAt: claim.createdAt,
    claimedAt: claim.claimedAt
  };
}

function activeDataUnionPolicy<T extends { status: string; effectiveAt?: Date | string | number | null; createdAt: Date | string | number }>(policies: T[]): T | null {
  return (
    policies
      .filter((policy) => policy.status === "Active")
      .sort(
        (left, right) =>
          new Date(right.effectiveAt ?? right.createdAt).getTime() - new Date(left.effectiveAt ?? left.createdAt).getTime() ||
          String(right.createdAt).localeCompare(String(left.createdAt))
      )[0] ?? null
  );
}

function parseDataUnionRevenueSplit(value: string): DataUnionRevenueSplit {
  try {
    const parsed = JSON.parse(value);
    const communityTreasuryPercent = Number(parsed?.communityTreasuryPercent);
    const participantPoolPercent = Number(parsed?.participantPoolPercent);
    const pollAuthorRoyaltyPercent = Number(parsed?.pollAuthorRoyaltyPercent ?? 0);
    const operatorPoolPercent = Number(parsed?.operatorPoolPercent);
    if (
      Number.isInteger(communityTreasuryPercent) &&
      Number.isInteger(participantPoolPercent) &&
      Number.isInteger(pollAuthorRoyaltyPercent) &&
      Number.isInteger(operatorPoolPercent) &&
      communityTreasuryPercent >= 0 &&
      participantPoolPercent >= 0 &&
      pollAuthorRoyaltyPercent >= 0 &&
      operatorPoolPercent >= 0 &&
      communityTreasuryPercent + participantPoolPercent + pollAuthorRoyaltyPercent + operatorPoolPercent === 100
    ) {
      return { communityTreasuryPercent, participantPoolPercent, pollAuthorRoyaltyPercent, operatorPoolPercent };
    }
  } catch {
    // Fall through to the MVP default split for old or malformed local records.
  }
  return { communityTreasuryPercent: 55, participantPoolPercent: 25, pollAuthorRoyaltyPercent: 10, operatorPoolPercent: 10 };
}

function splitDataUnionPayment(paymentPc: number, revenueSplit: DataUnionRevenueSplit) {
  const allocations = [
    { key: "treasuryPc" as const, percent: revenueSplit.communityTreasuryPercent },
    { key: "participantPoolPc" as const, percent: revenueSplit.participantPoolPercent },
    { key: "pollAuthorRoyaltyPc" as const, percent: revenueSplit.pollAuthorRoyaltyPercent },
    { key: "operatorPoolPc" as const, percent: revenueSplit.operatorPoolPercent }
  ].map((allocation) => {
    const exact = (paymentPc * allocation.percent) / 100;
    return {
      ...allocation,
      value: Math.floor(exact),
      remainder: exact - Math.floor(exact)
    };
  });
  let allocated = allocations.reduce((sum, allocation) => sum + allocation.value, 0);
  for (const allocation of [...allocations].sort((left, right) => right.remainder - left.remainder)) {
    if (allocated >= paymentPc) break;
    allocation.value += 1;
    allocated += 1;
  }
  const byKey = Object.fromEntries(allocations.map((allocation) => [allocation.key, allocation.value])) as {
    treasuryPc: number;
    participantPoolPc: number;
    pollAuthorRoyaltyPc: number;
    operatorPoolPc: number;
  };
  return byKey;
}

function distributeDataUnionAmount(amountPc: number, bucketCount: number): number[] {
  if (bucketCount <= 0) return [];
  const base = Math.floor(amountPc / bucketCount);
  let remainder = amountPc - base * bucketCount;
  return Array.from({ length: bucketCount }, () => {
    const value = base + (remainder > 0 ? 1 : 0);
    remainder -= remainder > 0 ? 1 : 0;
    return value;
  });
}

async function createDataUnionSettlementClaims(
  tx: Prisma.TransactionClient,
  input: {
    communityId: string;
    grant: DataUnionSettlementGrantInput;
    settlementId: string;
    split: ReturnType<typeof splitDataUnionPayment>;
  }
): Promise<DataUnionClaimInput[]> {
  const { communityId, grant, settlementId, split } = input;
  const product = grant.product;
  const pollId = product.result.pollId;
  const policyId = product.policyId;
  const base = {
    communityId,
    accessGrantId: grant.id,
    settlementId,
    productId: product.id,
    policyId
  };
  const directClaims: Prisma.DataUnionClaimCreateManyInput[] = [
    {
      id: `data-union-claim-${nanoid(10)}`,
      ...base,
      role: "CommunityTreasury",
      claimantId: treasuryAccountForCommunity(communityId),
      amountPc: split.treasuryPc,
      claimHash: hashJson({ ...base, role: "CommunityTreasury", claimantId: treasuryAccountForCommunity(communityId), amountPc: split.treasuryPc })
    },
    {
      id: `data-union-claim-${nanoid(10)}`,
      ...base,
      role: "PollAuthor",
      claimantId: product.result.poll.question.proposer,
      amountPc: split.pollAuthorRoyaltyPc,
      claimHash: hashJson({ ...base, role: "PollAuthor", claimantId: product.result.poll.question.proposer, amountPc: split.pollAuthorRoyaltyPc })
    },
    {
      id: `data-union-claim-${nanoid(10)}`,
      ...base,
      role: "OperatorPool",
      claimantId: operatorPoolAccountForCommunity(communityId),
      amountPc: split.operatorPoolPc,
      claimHash: hashJson({ ...base, role: "OperatorPool", claimantId: operatorPoolAccountForCommunity(communityId), amountPc: split.operatorPoolPc })
    }
  ].filter((claim) => claim.amountPc > 0);

  const receiptClaims = await tx.participationReceipt.findMany({
    where: { pollId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });
  const receiptHashes = uniqueStrings(receiptClaims.map((receipt) => receipt.receiptHash)).slice(0, product.cohortSize);
  let participantClaims: Prisma.DataUnionClaimCreateManyInput[] = [];
  if (receiptHashes.length > 0) {
    const amounts = distributeDataUnionAmount(split.participantPoolPc, receiptHashes.length);
    participantClaims = receiptHashes.map((receiptHash, index) => ({
      id: `data-union-claim-${nanoid(10)}`,
      ...base,
      role: "Participant",
      receiptHash,
      amountPc: amounts[index] ?? 0,
      claimHash: hashJson({ ...base, role: "Participant", receiptHash, amountPc: amounts[index] ?? 0 })
    }));
  } else if (config.demoMode) {
    const demoClaimants = await tx.dataUnionConsent.findMany({
      where: { communityId, policyId, status: "Active", scope: "AggregateAnalytics" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: product.cohortSize
    });
    const amounts = distributeDataUnionAmount(split.participantPoolPc, demoClaimants.length);
    participantClaims = demoClaimants.map((consent, index) => ({
      id: `data-union-claim-${nanoid(10)}`,
      ...base,
      role: "Participant",
      claimantId: consent.userId,
      amountPc: amounts[index] ?? 0,
      claimHash: hashJson({ ...base, role: "Participant", demoClaimantId: consent.userId, amountPc: amounts[index] ?? 0 })
    }));
  }

  const claims = [...directClaims, ...participantClaims].filter((claim) => (claim.amountPc ?? 0) > 0);
  if (claims.length === 0) return [];
  await tx.dataUnionClaim.createMany({ data: claims });
  return tx.dataUnionClaim.findMany({
    where: { settlementId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }, { id: "asc" }]
  });
}

function buildCredentialTrustPoliciesProtocol(communityId: string, policies: CommunityCredentialTrustPolicyView[]) {
  return {
    protocol: "popular-consensus",
    schemaVersion: "credential-trust-policies-v0",
    ids: {
      communityId,
      policyIds: policies.map((policy) => policy.id),
      credentialSchemaIds: uniqueStrings(policies.map((policy) => policy.credentialSchemaId)),
      trustedIssuerIds: uniqueStrings(policies.flatMap((policy) => policy.trustedIssuerIds))
    },
    hashes: {
      policyHashes: policies.map((policy) => policy.policyHash),
      activePolicyHashes: policies.filter((policy) => policy.status === "Active").map((policy) => policy.policyHash),
      trustPolicySetHash: hashJson(policies.map((policy) => ({ id: policy.id, policyHash: policy.policyHash, status: policy.status })))
    },
    statuses: {
      policyCount: policies.length,
      activePolicyCount: policies.filter((policy) => policy.status === "Active").length,
      modes: {
        AllowList: policies.filter((policy) => policy.mode === "AllowList").length,
        Open: policies.filter((policy) => policy.mode === "Open").length
      }
    },
    authority: {
      source: "community-credential-trust-policy-artifacts",
      evaluation: "active policies are OR-matched by community and credential schema",
      defaultWhenUnconfigured: "any active issuer registered for the credential schema"
    }
  };
}

function activeTallyCommittee(committees: TallyCommitteeView[]) {
  return committees.find((committee) => committee.status === "Active") ?? null;
}

async function activeTallyCommitteeForCommunity(communityId: string) {
  return prisma.tallyCommittee.findFirst({
    where: { communityId, status: "Active" },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  });
}

function activeTallyKeySetup(keySetups: TallyKeySetupView[]) {
  return keySetups.find((setup) => setup.status === "Active") ?? null;
}

async function activeTallyKeySetupForCommunity(communityId: string) {
  return prisma.tallyKeySetup.findFirst({
    where: { communityId, status: "Active" },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  });
}

function toPublicTallyKeySetup(setup: TallyKeySetupView): TallyKeySetupView {
  return {
    id: setup.id,
    communityId: setup.communityId,
    committeeId: setup.committeeId,
    publicKeyId: setup.publicKeyId,
    publicKeyPem: setup.publicKeyPem,
    publicKeyHash: setup.publicKeyHash,
    memberIds: setup.memberIds,
    memberKeyCommitmentHashes: setup.memberKeyCommitmentHashes,
    threshold: setup.threshold,
    transcriptHash: setup.transcriptHash,
    setupHash: setup.setupHash,
    status: setup.status,
    createdBy: setup.createdBy,
    createdAt: setup.createdAt,
    updatedAt: setup.updatedAt
  };
}

function buildTallyCommitteesProtocol(communityId: string, committees: TallyCommitteeView[]) {
  const activeCommittee = activeTallyCommittee(committees);
  return {
    protocol: "popular-consensus",
    schemaVersion: "tally-committees-v0",
    ids: {
      communityId,
      activeCommitteeId: activeCommittee?.id ?? null,
      committeeIds: committees.map((committee) => committee.id),
      memberIds: uniqueStrings(committees.flatMap((committee) => committee.memberIds)),
      createdBy: uniqueStrings(committees.map((committee) => committee.createdBy)),
      activatedBy: uniqueStrings(committees.map((committee) => committee.activatedBy))
    },
    hashes: {
      metadataHashes: committees.map((committee) => committee.metadataHash),
      activationHashes: compactHashArray(committees.map((committee) => committee.activationHash)),
      failureHashes: compactHashArray(committees.map((committee) => committee.failureHash)),
      activeMetadataHash: activeCommittee?.metadataHash ?? null,
      activeActivationHash: activeCommittee?.activationHash ?? null,
      committeeSetHash: hashJson(committees.map((committee) => ({ id: committee.id, metadataHash: committee.metadataHash, status: committee.status })))
    },
    statuses: {
      committeeCount: committees.length,
      activeCommittee: Boolean(activeCommittee),
      Proposed: committees.filter((committee) => committee.status === "Proposed").length,
      Active: committees.filter((committee) => committee.status === "Active").length,
      Retired: committees.filter((committee) => committee.status === "Retired").length,
      Failed: committees.filter((committee) => committee.status === "Failed").length
    },
    authority: {
      source: "tally-committee-artifacts",
      lifecycle: "proposal-activation-failure-replacement-retirement",
      tallyMode: "metadata-only-until-threshold-key-setup"
    }
  };
}

function buildTallyKeySetupsProtocol(communityId: string, keySetups: TallyKeySetupView[]) {
  const activeSetup = activeTallyKeySetup(keySetups);
  return {
    protocol: "popular-consensus",
    schemaVersion: "tally-key-setups-v0",
    ids: {
      communityId,
      activeKeySetupId: activeSetup?.id ?? null,
      activeCommitteeId: activeSetup?.committeeId ?? null,
      keySetupIds: keySetups.map((setup) => setup.id),
      committeeIds: uniqueStrings(keySetups.map((setup) => setup.committeeId)),
      publicKeyIds: keySetups.map((setup) => setup.publicKeyId),
      memberIds: uniqueStrings(keySetups.flatMap((setup) => setup.memberIds)),
      createdBy: uniqueStrings(keySetups.map((setup) => setup.createdBy))
    },
    hashes: {
      setupHashes: keySetups.map((setup) => setup.setupHash),
      publicKeyHashes: keySetups.map((setup) => setup.publicKeyHash),
      transcriptHashes: keySetups.map((setup) => setup.transcriptHash),
      memberKeyCommitmentRoots: keySetups.map((setup) => hashJson(setup.memberKeyCommitmentHashes)),
      activeSetupHash: activeSetup?.setupHash ?? null,
      activePublicKeyHash: activeSetup?.publicKeyHash ?? null,
      keySetupSetHash: hashJson(keySetups.map((setup) => ({ id: setup.id, setupHash: setup.setupHash, status: setup.status })))
    },
    statuses: {
      keySetupCount: keySetups.length,
      activeKeySetup: Boolean(activeSetup),
      Active: keySetups.filter((setup) => setup.status === "Active").length,
      Retired: keySetups.filter((setup) => setup.status === "Retired").length,
      Failed: keySetups.filter((setup) => setup.status === "Failed").length
    },
    authority: {
      source: "tally-key-setup-artifacts",
      lifecycle: "active-key-setup-retires-previous-active-key",
      tallyMode: "threshold-public-key-with-demo-only-coordinator-fallback"
    }
  };
}

function acceptedTallyDecryptionShares(shares: TallyDecryptionShareView[]) {
  return shares.filter((share) => share.status === "Accepted");
}

function tallyDecryptionShareThresholdMet(keySetup: TallyKeySetupView | null, shares: TallyDecryptionShareView[]) {
  if (!keySetup) return false;
  return uniqueStrings(acceptedTallyDecryptionShares(shares).map((share) => share.memberId)).length >= keySetup.threshold;
}

function buildTallyDecryptionSharesProtocol(
  pollId: string,
  keySetup: TallyKeySetupView | null,
  shares: TallyDecryptionShareView[]
) {
  const acceptedShares = acceptedTallyDecryptionShares(shares);
  return {
    protocol: "popular-consensus",
    schemaVersion: "tally-decryption-shares-v0",
    ids: {
      pollId,
      keySetupId: keySetup?.id ?? null,
      committeeId: keySetup?.committeeId ?? null,
      shareIds: shares.map((share) => share.id),
      memberIds: uniqueStrings(shares.map((share) => share.memberId))
    },
    hashes: {
      shareHashes: shares.map((share) => share.shareHash),
      proofHashes: shares.map((share) => share.proofHash),
      artifactHashes: shares.map((share) => share.artifactHash),
      acceptedShareSetHash: hashJson(acceptedShares.map((share) => ({ memberId: share.memberId, shareHash: share.shareHash, proofHash: share.proofHash })))
    },
    statuses: {
      threshold: keySetup?.threshold ?? 0,
      shareCount: shares.length,
      acceptedShareCount: acceptedShares.length,
      thresholdMet: tallyDecryptionShareThresholdMet(keySetup, shares),
      Accepted: acceptedShares.length,
      Rejected: shares.filter((share) => share.status === "Rejected").length
    },
    authority: {
      source: "tally-decryption-share-artifacts",
      validation: "local MVP records share and proof hashes; proof/reference validation is the next threshold tally slice",
      tallyMode: "threshold-share-records-with-demo-only-coordinator-fallback"
    }
  };
}

function buildStewardPowersProtocol(
  communityId: string,
  powers: StewardPower[],
  activeStewards: Array<{ userId: string; role: string; status: string; profileId?: string | null; profileHash?: string | null }>,
  emergencySuspensions: CommunityExportEmergencySuspensionInput[],
  activeEmergencySuspension: CommunityExportEmergencySuspensionInput | null
) {
  return {
    protocol: "popular-consensus",
    schemaVersion: "steward-powers-v0",
    ids: {
      communityId,
      stewardIds: activeStewards.map((steward) => steward.userId),
      emergencySuspensionIds: emergencySuspensions.map((suspension) => suspension.id),
      activeEmergencySuspensionId: activeEmergencySuspension?.id ?? null,
      profileIds: uniqueStrings(activeStewards.map((steward) => steward.profileId))
    },
    hashes: {
      powersHash: hashJson(powers),
      emergencySuspensionReasonHashes: emergencySuspensions.map((suspension) => suspension.reasonHash),
      emergencySuspensionResolutionHashes: compactHashArray(emergencySuspensions.map((suspension) => suspension.resolutionHash)),
      activeEmergencySuspensionReasonHash: activeEmergencySuspension?.reasonHash ?? null,
      profileHashes: uniqueStrings(activeStewards.map((steward) => steward.profileHash))
    },
    statuses: {
      stewardCount: activeStewards.length,
      emergencySuspensionCount: emergencySuspensions.length,
      activeEmergencySuspension: Boolean(activeEmergencySuspension),
      emergencySuspensionStatuses: {
        Active: emergencySuspensions.filter((suspension) => suspension.status === "Active").length,
        Resolved: emergencySuspensions.filter((suspension) => suspension.status === "Resolved").length
      }
    },
    authority: {
      powerModel: "role-bound-artifact-backed-stewards",
      emergencyRule: "active suspension blocks protocol writes until a steward records a resolution artifact",
      stewardRoles: powers.map((power) => ({ role: power.role, actions: power.actions }))
    }
  };
}

function buildUpgradeSafetyModel(
  communityId: string,
  input: {
    activeStewards: Array<{ userId: string; role: string; status: string; profileId?: string | null; profileHash?: string | null }>;
    parameterSets: CommunityExportGovernanceParameterInput[];
    activeParameterSet: CommunityExportGovernanceParameterInput | null;
    emergencySuspensions: CommunityExportEmergencySuspensionInput[];
    activeEmergencySuspension: CommunityExportEmergencySuspensionInput | null;
  }
) {
  const gates = [
    {
      id: "public-proposal-artifact",
      label: "Public proposal artifact",
      status: "Required",
      requirement: "Upgrade or governance changes must publish content-addressed proposal artifacts before activation.",
      evidence: ["GovernanceParametersProposed", "AdoptionPolicyProposed", "GET /registry/protocol-transactions"]
    },
    {
      id: "effective-at-timelock",
      label: "Effective-at activation delay",
      status: "Available",
      requirement: "Activation records carry an effectiveAt timestamp so clients/indexers can reject premature activation.",
      evidence: compactHashArray([
        input.activeParameterSet?.activationHash,
        ...input.parameterSets.map((set) => set.activationHash),
        "governance-parameter-activation"
      ])
    },
    {
      id: "independent-indexer-replay",
      label: "Independent indexer replay",
      status: "Satisfied",
      requirement: "Clients must be able to verify transaction payload hashes and rebuild index heads without domain tables.",
      evidence: ["GET /registry/protocol-transactions/replay", "protocol-indexer-replay-v0"]
    },
    {
      id: "emergency-pause-limits",
      label: "Emergency pause limits",
      status: input.activeEmergencySuspension ? "Engaged" : "Available",
      requirement: "Emergency suspension can pause protocol writes, but every pause and resolution must be artifact-backed.",
      evidence: compactHashArray([
        ...input.emergencySuspensions.map((suspension) => suspension.reasonHash),
        ...input.emergencySuspensions.map((suspension) => suspension.resolutionHash),
        "CommunityEmergencySuspended",
        "CommunityEmergencyResolved"
      ])
    },
    {
      id: "fork-exit",
      label: "Fork and exit path",
      status: "Available",
      requirement: "Communities can export records and publish fork metadata if upgrade governance fails them.",
      evidence: ["GET /communities/:communityId/export", "POST /communities/:communityId/forks", "CommunityForked"]
    },
    {
      id: "independent-testnet-operators",
      label: "Independent testnet operators",
      status: "Pending",
      requirement: "Before public launch, independent operators should run the feed, replay it, and publish attestation records.",
      evidence: []
    }
  ] as const;
  return {
    schemaVersion: "upgrade-governance-safety-model-v0",
    communityId,
    status: input.activeEmergencySuspension ? "EmergencySuspensionActive" : "Published",
    activationRule: "proposal-artifact-plus-effective-at-activation-plus-independent-replay",
    emergencyRule: "active suspension blocks protocol writes until a steward records a resolution artifact",
    forkExitRule: "community exports and fork metadata preserve exit if shared governance fails",
    minimumReviewHours: UPGRADE_SAFETY_MIN_REVIEW_HOURS,
    gates,
    upgradeClasses: UPGRADE_SAFETY_UPGRADE_CLASSES,
    knownMvpLimits: UPGRADE_SAFETY_KNOWN_MVP_LIMITS
  };
}

function buildUpgradeSafetyProtocol(
  communityId: string,
  model: ReturnType<typeof buildUpgradeSafetyModel>,
  activeStewards: Array<{ userId: string; role: string; status: string; profileId?: string | null; profileHash?: string | null }>,
  activeParameterSet: CommunityExportGovernanceParameterInput | null,
  activeEmergencySuspension: CommunityExportEmergencySuspensionInput | null
) {
  return {
    protocol: "popular-consensus",
    schemaVersion: "upgrade-safety-v0",
    ids: {
      communityId,
      stewardIds: activeStewards.map((steward) => steward.userId),
      activeParameterSetId: activeParameterSet?.id ?? null,
      activeEmergencySuspensionId: activeEmergencySuspension?.id ?? null,
      gateIds: model.gates.map((gate) => gate.id),
      upgradeClasses: model.upgradeClasses
    },
    hashes: {
      modelHash: hashJson(model),
      gatesHash: hashJson(model.gates),
      powersHash: hashJson(STEWARD_POWERS),
      activeParameterProposalHash: activeParameterSet?.proposalHash ?? null,
      activeParameterActivationHash: activeParameterSet?.activationHash ?? null,
      activeEmergencySuspensionReasonHash: activeEmergencySuspension?.reasonHash ?? null
    },
    statuses: {
      safetyModelStatus: model.status,
      gateCount: model.gates.length,
      pendingGates: model.gates.filter((gate) => gate.status === "Pending").map((gate) => gate.id),
      activeEmergencySuspension: Boolean(activeEmergencySuspension),
      activeGovernanceParameterSet: activeParameterSet ? "Configured" : "Default"
    },
    authority: {
      activationRule: model.activationRule,
      emergencyRule: model.emergencyRule,
      forkExitRule: model.forkExitRule,
      minimumReviewHours: model.minimumReviewHours,
      stewardRoles: STEWARD_POWERS.map((power) => ({ role: power.role, actions: power.actions }))
    }
  };
}

function buildPublicTestnetReadiness() {
  const completionGates = [
    {
      id: "matching-replay-hashes",
      label: "Matching replay hashes",
      status: "PendingExternalOperators",
      requirement: "At least three independent replay verifiers publish matching transaction and event stream hashes for the same testnet window.",
      evidence: []
    },
    {
      id: "independent-api-indexers",
      label: "Independent API/indexers",
      status: "PendingExternalOperators",
      requirement: "At least two independently operated API/indexer endpoints remain available for the agreed testnet window.",
      evidence: []
    },
    {
      id: "governance-safety-drills",
      label: "Governance and safety drills",
      status: "PendingExternalOperators",
      requirement: "A public-testnet community completes governance parameter, adoption, emergency pause, export/replay, fork, and upgrade-safety drills.",
      evidence: []
    },
    {
      id: "operator-attestations",
      label: "Operator attestations",
      status: "PendingExternalOperators",
      requirement: "Independent operators publish content-addressed attestations with command results and replay hashes.",
      evidence: ["public-testnet-operator-attestation-v0", "pnpm testnet:collect-attestation"]
    },
    {
      id: "launch-summary",
      label: "Launch summary",
      status: "PendingExternalOperators",
      requirement: "A maintainer records launch notes with operator list, attestation hashes, unresolved issues, and go/no-go decision.",
      evidence: ["docs/public-testnet-launch-summary.md", "pnpm testnet:write-launch-summary", "pnpm testnet:verify-attestations"]
    }
  ] as const;
  return {
    status: "PendingExternalOperators",
    operatorRequirements: PUBLIC_TESTNET_OPERATOR_REQUIREMENTS,
    requiredCommands: PUBLIC_TESTNET_REQUIRED_COMMANDS,
    requiredEndpoints: PUBLIC_TESTNET_REQUIRED_ENDPOINTS,
    governanceDrills: PUBLIC_TESTNET_GOVERNANCE_DRILLS,
    attestationTemplate: {
      protocol: "popular-consensus",
      schemaVersion: "public-testnet-operator-attestation-v0",
      operatorId: "<operator-name-or-public-key>",
      operatorContact: "<operator-contact-or-public-key>",
      operatorOrganization: "<operator-organization-or-null>",
      independenceStatement: "<why-this-operator-is-independent-from-maintainers-and-other-operators>",
      operatorRole: "replay-verifier",
      gitCommit: "<git-commit>",
      chainId: "<chain-id>",
      rpcUrl: "<public-testnet-rpc-url>",
      apiBaseUrl: "<api-base-url-or-null>",
      deploymentHash: "<hash-of-deployment-json-or-null>",
      transactionStreamHash: "<from /registry/protocol-transactions/replay>",
      eventStreamHash: "<from /registry/protocol-transactions/replay>",
      upgradeSafetyModelHash: "<protocol.hashes.modelHash from /communities/:communityId/governance/upgrade-safety>",
      checks: {
        typecheck: "passed",
        sharedTests: "passed",
        contractTests: "passed",
        apiDbTests: "passed",
        protocolIndexerReplay: "Verified",
        communityImportReplay: "Verified",
        governanceParameterDrill: "passed",
        adoptionPolicyDrill: "passed",
        emergencySuspensionDrill: "passed",
        communityExportReplay: "Verified",
        forkMetadata: "passed",
        upgradeSafetyDrill: "passed"
      },
      observations: [],
      attestedAt: new Date(0).toISOString()
    },
    completionGates,
    knownLimitations: PUBLIC_TESTNET_KNOWN_LIMITATIONS
  };
}

function buildPublicTestnetReadinessProtocol(readiness: ReturnType<typeof buildPublicTestnetReadiness>) {
  return {
    protocol: "popular-consensus",
    schemaVersion: "public-testnet-readiness-v0",
    ids: {
      operatorRoles: readiness.operatorRequirements.map((requirement) => requirement.role),
      completionGateIds: readiness.completionGates.map((gate) => gate.id),
      requiredEndpoints: readiness.requiredEndpoints
    },
    hashes: {
      readinessHash: hashJson({
        operatorRequirements: readiness.operatorRequirements,
        requiredCommands: readiness.requiredCommands,
        requiredEndpoints: readiness.requiredEndpoints,
        governanceDrills: readiness.governanceDrills,
        completionGates: readiness.completionGates,
        knownLimitations: readiness.knownLimitations
      }),
      attestationTemplateHash: hashJson(readiness.attestationTemplate)
    },
    statuses: {
      readinessStatus: readiness.status,
      operatorRequirementCount: readiness.operatorRequirements.length,
      requiredCommandCount: readiness.requiredCommands.length,
      requiredEndpointCount: readiness.requiredEndpoints.length,
      governanceDrillCount: readiness.governanceDrills.length,
      pendingGates: readiness.completionGates.filter((gate) => gate.status === "PendingExternalOperators").map((gate) => gate.id)
    },
    authority: {
      runbook: "docs/public-testnet-operator-runbook.md",
      environmentTemplate: "infra/public-testnet.env.example",
      attestationDirectory: "docs/public-testnet-attestations",
      launchSummary: "docs/public-testnet-launch-summary.md",
      attestationSchemaVersion: readiness.attestationTemplate.schemaVersion,
      attestationCollector: "pnpm testnet:collect-attestation",
      launchSummaryWriter: "pnpm testnet:write-launch-summary",
      attestationVerifier: "pnpm testnet:verify-attestations",
      completionRule: "external-operator-attestations-required",
      roadmapItem: "Run public testnet with independent operators"
    }
  };
}

function treasuryLedgerEntry(input: Omit<TreasuryLedgerEntry, "id">): TreasuryLedgerEntry {
  return {
    id: hashJson({
      communityId: input.communityId,
      bondId: input.bondId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      dataUnionAccessGrantId: input.dataUnionAccessGrantId,
      dataUnionSettlementId: input.dataUnionSettlementId,
      accountId: input.accountId,
      entryType: input.entryType,
      amountPc: input.amountPc,
      createdAt: input.createdAt
    }),
    ...input
  };
}

function sumEntries(entries: TreasuryLedgerEntry[], entryType: TreasuryLedgerEntry["entryType"]) {
  return entries.filter((entry) => entry.entryType === entryType).reduce((sum, entry) => sum + entry.amountPc, 0);
}

function normalizeBondType(value: string): TreasuryLedgerEntry["bondType"] {
  if (value === "Challenge" || value === "Appeal") return value;
  return "Proposal";
}

function treasuryAccountForCommunity(communityId: string) {
  return `community:${communityId}:treasury`;
}

function participantPoolAccountForCommunity(communityId: string) {
  return `community:${communityId}:data-union:participant-pool`;
}

function operatorPoolAccountForCommunity(communityId: string) {
  return `community:${communityId}:data-union:operator-pool`;
}

function dataBuyerAccount(buyerId: string) {
  return `data-buyer:${buyerId}`;
}

async function credentialIssuerAnnotationsForQuestions(questions: CredentialIssuerAnnotationQuestionInput[]): Promise<CredentialIssuerAnnotation[]> {
  const schemaIds = uniqueStrings(questions.map((question) => question.credentialSchemaId));
  if (schemaIds.length === 0) return [];
  const issuers = await prisma.credentialIssuer.findMany({
    where: { schemaIds: { hasSome: schemaIds }, status: { not: "Active" } },
    orderBy: { createdAt: "asc" }
  });
  if (issuers.length === 0) return [];
  const suspensionEvents = await prisma.registryEvent.findMany({
    where: { eventType: "CredentialIssuerSuspended", subjectId: { in: issuers.map((issuer) => issuer.id) } },
    orderBy: REGISTRY_EVENT_ORDER
  });
  const latestSuspensionHashByIssuer = new Map<string, string>();
  for (const event of suspensionEvents) {
    latestSuspensionHashByIssuer.set(event.subjectId, event.newHash);
  }

  return issuers.map((issuer) => {
    const affectedQuestionIds = questions
      .filter((question) => issuer.schemaIds.includes(question.credentialSchemaId))
      .map((question) => question.id);
    return {
      issuerId: issuer.id,
      status: issuer.status,
      schemaIds: issuer.schemaIds,
      metadataHash: issuer.metadataHash,
      suspensionHash: latestSuspensionHashByIssuer.get(issuer.id) ?? null,
      affectedQuestionIds,
      note: "Credentials from this issuer are not accepted while the issuer is suspended."
    };
  });
}

function buildReputationEventsProtocol(events: ReputationEventView[], totals: Record<string, number>, account: string | null) {
  return {
    protocol: "popular-consensus",
    schemaVersion: "reputation-events-v0",
    ids: {
      account,
      eventIds: compactHashArray(events.map((event) => event.id ?? event.eventId)),
      accounts: uniqueStrings(events.map((event) => event.account)),
      sourceIds: uniqueStrings(events.map((event) => event.sourceId))
    },
    hashes: {
      eventStreamHash: hashReputationEvents(events)
    },
    statuses: {
      eventCount: events.length,
      totals
    },
    authority: {
      replayRule: "sum-weight-by-account",
      decayRule: DEFAULT_GOVERNANCE.reputationDecayRule
    }
  };
}

function buildReputationExportProtocol(events: ReputationEventView[], totals: Record<string, number>, exportHash: string, account: string | null) {
  return {
    ...buildReputationEventsProtocol(events, totals, account),
    schemaVersion: "reputation-export-v0",
    hashes: {
      eventStreamHash: hashReputationEvents(events),
      reputationExportHash: exportHash
    },
    statuses: {
      eventCount: events.length,
      totals,
      exportStatus: "Exported"
    }
  };
}

function buildReputationReplayProtocol(events: ReputationEventView[], totals: Record<string, number>, checks: ReplayCheck[]) {
  return {
    protocol: "popular-consensus",
    schemaVersion: "reputation-replay-v0",
    ids: {
      eventIds: compactHashArray(events.map((event) => event.id ?? event.eventId)),
      accounts: uniqueStrings(events.map((event) => event.account)),
      checkIds: checks.map((check) => check.id)
    },
    hashes: {
      eventStreamHash: hashReputationEvents(events)
    },
    statuses: {
      eventCount: events.length,
      totals,
      replayStatus: checks.every((check) => check.ok) ? "Verified" : "Mismatch",
      failedChecks: checks.filter((check) => !check.ok).map((check) => check.id)
    },
    authority: {
      replayRule: "sum-weight-by-account",
      decayRule: DEFAULT_GOVERNANCE.reputationDecayRule,
      readOnly: true
    }
  };
}

function buildArchiveExportProtocol(
  questionId: string,
  communityId: string | null,
  archiveRecord: { id: string; archiveHash: string; archivedBy: string },
  bundle: ArtifactExportBundle
) {
  return {
    protocol: "popular-consensus",
    schemaVersion: "archive-export-v0",
    ids: {
      questionId,
      communityId,
      archiveRecordId: archiveRecord.id
    },
    hashes: {
      archiveHash: archiveRecord.archiveHash,
      archiveManifestHash: bundle.manifestHash,
      rootHash: bundle.root?.hash ?? null,
      artifactHashes: bundle.artifacts.map((artifact) => artifact.hash)
    },
    statuses: {
      archiveStatus: "Exported",
      artifactCount: bundle.artifacts.length
    },
    authority: {
      archivedBy: archiveRecord.archivedBy,
      exportRole: bundle.root?.role ?? "archive"
    }
  };
}

function buildCommunityExportProtocol(
  community: CommunityExportCommunityInput,
  policies: CommunityExportPolicyInput[],
  forks: CommunityExportForkInput[],
  questions: CommunityExportQuestionInput[],
  governanceParameterSets: CommunityExportGovernanceParameterInput[],
  emergencySuspensions: CommunityExportEmergencySuspensionInput[],
  credentialTrustPolicies: CommunityCredentialTrustPolicyView[],
  tallyCommittees: TallyCommitteeView[],
  tallyKeySetups: TallyKeySetupView[],
  dataUnionPolicies: DataUnionPolicy[],
  dataUnionConsents: DataUnionConsent[],
  dataUnionProducts: DataUnionProduct[],
  dataUnionAccessGrants: DataUnionAccessGrant[],
  dataUnionBuyers: DataUnionBuyer[],
  dataUnionSettlements: DataUnionSettlement[],
  dataUnionClaims: DataUnionClaim[],
  moderationRecords: CommunityExportModerationRecordInput[],
  moderationAppeals: CommunityExportModerationAppealInput[],
  challengeAppeals: CommunityExportChallengeAppealInput[],
  jurorAssignments: CommunityExportJurorAssignmentInput[],
  profiles: CommunityExportProfileInput[],
  communityFollows: CommunityExportCommunityFollowInput[],
  topicFollows: CommunityExportTopicFollowInput[],
  reputationEvents: CommunityExportReputationEventInput[],
  credentialIssuerAnnotations: CredentialIssuerAnnotation[],
  treasuryLedgerEntries: TreasuryLedgerEntry[],
  treasuryLedgerTotals: TreasuryLedgerTotals,
  events: RegistryEventView[],
  commitments: CommitmentView[],
  archives: Array<{ id: string; questionId: string; archiveHash: string; archivedBy: string }>,
  bundle: ArtifactExportBundle,
  exportHash: string
) {
  const tallyDecryptionShares = questions.flatMap((question) => question.poll?.decryptionShares ?? []);
  return {
    protocol: "popular-consensus",
    schemaVersion: "community-export-v0",
    ids: {
      communityId: community.id,
      credentialSchemaId: community.credentialSchemaId,
      createdBy: community.createdBy,
      frontendConfigId: community.frontendConfig?.id ?? null,
      memberIds: community.memberships.map((member) => member.userId),
      profileIds: uniqueStrings(profiles.map((profile) => profile.profileId)),
      communityFollowIds: communityFollows.map((follow) => follow.id),
      topicFollowIds: topicFollows.map((follow) => follow.id),
      reputationEventIds: reputationEvents.map((event) => event.id),
      credentialIssuerIds: credentialIssuerAnnotations.map((annotation) => annotation.issuerId),
      treasuryLedgerEntryIds: treasuryLedgerEntries.map((entry) => entry.id),
      treasuryAccountIds: uniqueStrings(treasuryLedgerEntries.map((entry) => entry.accountId)),
      forkIds: forks.map((fork) => fork.id),
      questionIds: questions.map((question) => question.id),
      moderationRecordIds: moderationRecords.map((record) => record.id),
      moderationAppealIds: moderationAppeals.map((appeal) => appeal.id),
      challengeAppealIds: challengeAppeals.map((appeal) => appeal.id),
      challengeAppealBondIds: challengeAppeals.map((appeal) => appeal.appealBondId),
      jurorAssignmentIds: jurorAssignments.map((assignment) => assignment.id),
      jurorIds: uniqueStrings(jurorAssignments.map((assignment) => assignment.jurorId)),
      governanceParameterSetIds: governanceParameterSets.map((set) => set.id),
      activeGovernanceParameterSetId: activeGovernanceParameterSet(governanceParameterSets)?.id ?? null,
      emergencySuspensionIds: emergencySuspensions.map((suspension) => suspension.id),
      activeEmergencySuspensionId: emergencySuspensions.find((suspension) => suspension.status === "Active")?.id ?? null,
      credentialTrustPolicyIds: credentialTrustPolicies.map((policy) => policy.id),
      trustedCredentialIssuerIds: uniqueStrings(credentialTrustPolicies.flatMap((policy) => policy.trustedIssuerIds)),
      tallyCommitteeIds: tallyCommittees.map((committee) => committee.id),
      activeTallyCommitteeId: activeTallyCommittee(tallyCommittees)?.id ?? null,
      tallyCommitteeMemberIds: uniqueStrings(tallyCommittees.flatMap((committee) => committee.memberIds)),
      replacementTallyCommitteeIds: compactHashArray(tallyCommittees.map((committee) => committee.replacementForId)),
      tallyKeySetupIds: tallyKeySetups.map((setup) => setup.id),
      activeTallyKeySetupId: activeTallyKeySetup(tallyKeySetups)?.id ?? null,
      tallyPublicKeyIds: tallyKeySetups.map((setup) => setup.publicKeyId),
      tallyDecryptionShareIds: tallyDecryptionShares.map((share) => share.id),
      tallyDecryptionShareMemberIds: uniqueStrings(tallyDecryptionShares.map((share) => share.memberId)),
      dataUnionPolicyIds: dataUnionPolicies.map((policy) => policy.id),
      activeDataUnionPolicyId: activeDataUnionPolicy(dataUnionPolicies)?.id ?? null,
      dataUnionConsentIds: dataUnionConsents.map((consent) => consent.id),
      dataUnionProductIds: dataUnionProducts.map((product) => product.id),
      dataUnionAccessGrantIds: dataUnionAccessGrants.map((grant) => grant.id),
      dataUnionBuyerRecordIds: dataUnionBuyers.map((buyer) => buyer.id),
      dataUnionBuyerIds: uniqueStrings([...dataUnionBuyers.map((buyer) => buyer.buyerId), ...dataUnionAccessGrants.map((grant) => grant.buyerId)]),
      dataUnionSettlementIds: dataUnionSettlements.map((settlement) => settlement.id),
      dataUnionClaimIds: dataUnionClaims.map((claim) => claim.id),
      policyIds: policies.map((policy) => policy.id),
      archiveRecordIds: archives.map((archive) => archive.id),
      eventIds: events.map((event) => event.id),
      commitmentIds: commitments.map((commitment) => commitment.id)
    },
    hashes: {
      communityExportHash: exportHash,
      artifactManifestHash: bundle.manifestHash,
      rootHash: bundle.root?.hash ?? null,
      archiveHashes: archives.map((archive) => archive.archiveHash),
      questionBodyHashes: questions.map((question) => question.bodyHash),
      sponsorDisclosureHashes: compactHashArray(questions.map((question) => question.sponsorDisclosureHash)),
      resultArtifactHashes: compactHashArray(questions.map((question) => question.poll?.result?.resultArtifactHash)),
      tallyPublicationProofHashes: compactHashArray(questions.map((question) => question.poll?.result?.tallyPublicationProofHash)),
      policyArtifactHashes: compactHashArray(
        policies.flatMap((policy) => [policy.proposalHash, policy.activationHash, policy.suspensionReasonHash])
      ),
      frontendConfigHash: community.frontendConfig?.configHash ?? null,
      forkMetadataHashes: forks.map((fork) => fork.metadataHash),
      forkSourceExportHashes: forks.map((fork) => fork.sourceExportHash),
      moderationReasonHashes: moderationRecords.map((record) => record.reasonHash),
      moderationAppealHashes: moderationAppeals.map((appeal) => appeal.appealHash),
      moderationResolutionHashes: compactHashArray(moderationAppeals.map((appeal) => appeal.resolutionHash)),
      challengeAppealHashes: challengeAppeals.map((appeal) => appeal.appealHash),
      challengeAppealResolutionHashes: compactHashArray(challengeAppeals.map((appeal) => appeal.resolutionHash)),
      jurorSelectionHashes: jurorAssignments.map((assignment) => assignment.selectionHash),
      jurorConflictDisclosureHashes: compactHashArray(jurorAssignments.map((assignment) => assignment.conflictDisclosureHash)),
      governanceParameterProposalHashes: governanceParameterSets.map((set) => set.proposalHash),
      governanceParameterActivationHashes: compactHashArray(governanceParameterSets.map((set) => set.activationHash)),
      emergencySuspensionReasonHashes: emergencySuspensions.map((suspension) => suspension.reasonHash),
      emergencySuspensionResolutionHashes: compactHashArray(emergencySuspensions.map((suspension) => suspension.resolutionHash)),
      credentialTrustPolicyHashes: credentialTrustPolicies.map((policy) => policy.policyHash),
      tallyCommitteeMetadataHashes: tallyCommittees.map((committee) => committee.metadataHash),
      tallyCommitteeActivationHashes: compactHashArray(tallyCommittees.map((committee) => committee.activationHash)),
      tallyCommitteeFailureHashes: compactHashArray(tallyCommittees.map((committee) => committee.failureHash)),
      tallyKeySetupHashes: tallyKeySetups.map((setup) => setup.setupHash),
      activeTallyPublicKeyHash: activeTallyKeySetup(tallyKeySetups)?.publicKeyHash ?? null,
      tallyDecryptionShareHashes: tallyDecryptionShares.map((share) => share.shareHash),
      tallyDecryptionShareProofHashes: tallyDecryptionShares.map((share) => share.proofHash),
      tallyDecryptionShareArtifactHashes: tallyDecryptionShares.map((share) => share.artifactHash),
      dataUnionPolicyHashes: dataUnionPolicies.map((policy) => policy.policyHash),
      dataUnionPolicyActivationHashes: compactHashArray(dataUnionPolicies.map((policy) => policy.activationHash)),
      dataUnionConsentHashes: dataUnionConsents.map((consent) => consent.consentHash),
      dataUnionRevocationHashes: compactHashArray(dataUnionConsents.map((consent) => consent.revokedHash)),
      dataUnionProductHashes: dataUnionProducts.map((product) => product.dataProductHash),
      dataUnionProductPrivacyReportHashes: dataUnionProducts.map((product) => product.privacyReportHash),
      dataUnionAccessHashes: dataUnionAccessGrants.map((grant) => grant.accessHash),
      dataUnionBuyerApprovalHashes: dataUnionBuyers.map((buyer) => buyer.approvalHash),
      dataUnionSettlementHashes: dataUnionSettlements.map((settlement) => settlement.settlementHash),
      dataUnionClaimHashes: dataUnionClaims.map((claim) => claim.claimHash),
      profileHashes: compactHashArray(profiles.map((profile) => profile.profileHash)),
      communityFollowHashes: communityFollows.map((follow) => follow.followHash),
      topicFollowHashes: topicFollows.map((follow) => follow.followHash),
      reputationEventStreamHash: hashReputationEvents(reputationEvents),
      credentialIssuerMetadataHashes: credentialIssuerAnnotations.map((annotation) => annotation.metadataHash),
      credentialIssuerSuspensionHashes: compactHashArray(credentialIssuerAnnotations.map((annotation) => annotation.suspensionHash)),
      treasuryLedgerHash: hashJson(treasuryLedgerEntries),
      commitmentHashes: commitments.map((commitment) => commitment.commitmentHash)
    },
    statuses: {
      exportStatus: "Exported",
      communityVisibility: community.visibility,
      frontendConfigStatus: community.frontendConfig ? "Configured" : "Missing",
      profileCount: profiles.length,
      communityFollowCount: communityFollows.length,
      topicFollowCount: topicFollows.length,
      reputationEventCount: reputationEvents.length,
      reputationTotals: replayReputationTotals(reputationEvents),
      credentialIssuerAnnotationCount: credentialIssuerAnnotations.length,
      treasuryLedgerEntryCount: treasuryLedgerEntries.length,
      treasuryTotals: treasuryLedgerTotals,
      forkCount: forks.length,
      moderationRecordCount: moderationRecords.length,
      moderationAppealCount: moderationAppeals.length,
      challengeAppealCount: challengeAppeals.length,
      challengeAppealStatuses: {
        Pending: challengeAppeals.filter((appeal) => appeal.status === "Pending").length,
        Upheld: challengeAppeals.filter((appeal) => appeal.status === "Upheld").length,
        Overturned: challengeAppeals.filter((appeal) => appeal.status === "Overturned").length
      },
      jurorAssignmentCount: jurorAssignments.length,
      jurorConflictStatuses: {
        PendingDisclosure: jurorAssignments.filter((assignment) => assignment.conflictStatus === "PendingDisclosure").length,
        Clear: jurorAssignments.filter((assignment) => assignment.conflictStatus === "Clear").length,
        ConflictDeclared: jurorAssignments.filter((assignment) => assignment.conflictStatus === "ConflictDeclared").length
      },
      governanceParameterSetCount: governanceParameterSets.length,
      governanceParameterStatus: activeGovernanceParameterSet(governanceParameterSets) ? "Configured" : "Default",
      emergencySuspensionCount: emergencySuspensions.length,
      activeEmergencySuspension: emergencySuspensions.some((suspension) => suspension.status === "Active"),
      credentialTrustPolicyCount: credentialTrustPolicies.length,
      activeCredentialTrustPolicyCount: credentialTrustPolicies.filter((policy) => policy.status === "Active").length,
      tallyCommitteeCount: tallyCommittees.length,
      activeTallyCommittee: Boolean(activeTallyCommittee(tallyCommittees)),
      tallyKeySetupCount: tallyKeySetups.length,
      activeTallyKeySetup: Boolean(activeTallyKeySetup(tallyKeySetups)),
      tallyDecryptionShareCount: tallyDecryptionShares.length,
      acceptedTallyDecryptionShareCount: tallyDecryptionShares.filter((share) => share.status === "Accepted").length,
      dataUnionPolicyCount: dataUnionPolicies.length,
      activeDataUnionPolicy: Boolean(activeDataUnionPolicy(dataUnionPolicies)),
      dataUnionConsentCount: dataUnionConsents.length,
      activeDataUnionConsentCount: dataUnionConsents.filter((consent) => consent.status === "Active").length,
      dataUnionProductCount: dataUnionProducts.length,
      dataUnionAccessGrantCount: dataUnionAccessGrants.length,
      dataUnionBuyerCount: dataUnionBuyers.length,
      dataUnionSettlementCount: dataUnionSettlements.length,
      dataUnionSettledRevenuePc: dataUnionSettlements.filter((settlement) => settlement.status === "Settled").reduce((sum, settlement) => sum + settlement.settledPc, 0),
      dataUnionClaimCount: dataUnionClaims.length,
      questionCount: questions.length,
      policyCount: policies.length,
      archiveCount: archives.length,
      eventCount: events.length,
      commitmentCount: commitments.length,
      artifactCount: bundle.artifacts.length
    },
    authority: {
      defaultAuthorityLevel: normalizeAuthority(community.defaultAuthorityLevel),
      credentialSchemaId: community.credentialSchemaId,
      policyAuthorityLevels: uniqueStrings(policies.map((policy) => normalizeAuthority(policy.authorityLevel))),
      memberRoles: community.memberships.map((member) => ({ userId: member.userId, role: member.role, status: member.status })),
      challengeAppealModel: "losing-side-appeal-bond",
      jurorSelectionRule: "community-curator-with-no-party-conflict",
      treasuryAccountingModel: "bond-and-data-union-ledger",
      treasuryAccountId: treasuryAccountForCommunity(community.id),
      dataUnionRule: "community-governed opt-in aggregate products with steward-granted buyer access",
      dataUnionPrivacyBoundary: "raw ballots and identifiable responses are excluded from products and exports",
      dataUnionParticipantPoolAccountId: participantPoolAccountForCommunity(community.id),
      dataUnionOperatorPoolAccountId: operatorPoolAccountForCommunity(community.id),
      credentialIssuerAnnotationRule: "non-active credential issuers are annotated on affected questions by credential schema",
      credentialTrustPolicyRule: "active community credential trust policies restrict accepted issuers by credential schema",
      tallyCommitteeRule: "active committee metadata is public before threshold key setup replaces the local coordinator",
      tallyCommitteeFailureRule: "failed committees are artifact-backed, deactivate their active key setups, and replacements point to the failed committee",
      tallyKeySetupRule: "active threshold public keys are artifact-backed; coordinator fallback is demo-only and disabled in non-demo mode",
      tallyDecryptionShareRule: "accepted decryption share records are required before threshold-key tally publication in local MVP",
      tallyPublicationProofRule: "result publication stores a proof artifact after validating key setup and decryption share references",
      stewardPowers: STEWARD_POWERS,
      activeGovernanceParameters: activeGovernanceParameterSet(governanceParameterSets)
        ? toGovernanceParameters(activeGovernanceParameterSet(governanceParameterSets)!)
        : DEFAULT_GOVERNANCE,
      commitmentContractModules: uniqueStrings(commitments.map((commitment) => commitment.contractModule)),
      commitmentMode: commitments.length ? "local-devnet-record" : null
    }
  };
}

function buildCommunityImportReplayProtocol(replay: CommunityImportReplayResult) {
  return {
    protocol: "popular-consensus",
    schemaVersion: "community-import-replay-v0",
    ids: {
      communityId: replay.rebuilt.communityId,
      slug: replay.rebuilt.slug,
      checkIds: replay.checks.map((check) => check.id)
    },
    hashes: {
      artifactManifestHash: replay.rebuilt.artifactManifestHash,
      frontendConfigHash: replay.rebuilt.frontendConfigHash
    },
    statuses: {
      replayStatus: replay.allPassed ? "Verified" : "Mismatch",
      failedChecks: replay.checks.filter((check) => !check.ok).map((check) => check.id),
      questionCount: replay.rebuilt.questionCount,
      policyCount: replay.rebuilt.policyCount,
      forkCount: replay.rebuilt.forkCount,
      archiveCount: replay.rebuilt.archiveCount,
      eventCount: replay.rebuilt.eventCount,
      commitmentCount: replay.rebuilt.commitmentCount,
      artifactCount: replay.rebuilt.artifactCount
    },
    authority: {
      source: replay.rebuilt.source,
      importMode: "read-only",
      mutatesDatabase: false
    }
  };
}

function toCommunityExportCommunity(community: CommunityExportCommunityInput) {
  return {
    id: community.id,
    slug: community.slug,
    name: community.name,
    description: community.description,
    visibility: community.visibility,
    credentialSchemaId: community.credentialSchemaId,
    defaultAuthorityLevel: normalizeAuthority(community.defaultAuthorityLevel),
    createdBy: community.createdBy,
    createdAt: community.createdAt
  };
}

function toCommunityExportQuestion(question: CommunityExportQuestionInput) {
  const ballotCommitments = question.poll?.ballots.map((ballot) => ballot.ballotCommitment).sort() ?? [];
  const nullifiers = question.poll?.ballots.map((ballot) => ballot.nullifier).sort() ?? [];
  return {
    id: question.id,
    version: question.version,
    title: question.title,
    status: question.status,
    bodyHash: question.bodyHash,
    answerSchemaId: question.answerSchemaId,
    credentialSchemaId: question.credentialSchemaId,
    communityId: question.communityId,
    topicIds: question.topicIds,
    geoScope: question.geoScope,
    sponsorDisclosureHash: question.sponsorDisclosureHash,
    methodologyLabel: question.methodologyLabel,
    authorityLevel: normalizeAuthority(question.authorityLevel),
    adoptionPolicyId: question.adoptionPolicyId,
    opensAt: question.opensAt,
    closesAt: question.closesAt,
    challengeWindowEndsAt: question.challengeWindowEndsAt,
    proposer: question.proposer,
    proposalBondId: question.proposalBondId,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
    challenges: question.challenges,
    challengeAppeals: question.challengeAppeals,
    jurorAssignments: question.jurorAssignments,
    discussionPosts: question.discussionPosts,
    archiveRecord: question.archiveRecord,
    poll: question.poll
      ? {
          id: question.poll.id,
          questionId: question.poll.questionId,
          status: question.poll.status,
          tallyPublicKeyId: question.poll.tallyPublicKeyId,
          tallyPublicKeyHash: hashJson(question.poll.tallyPublicKeyPem),
          tallyKeySetupId: question.poll.tallyKeySetupId,
          credentialSchemaId: question.poll.credentialSchemaId,
          privacyThreshold: question.poll.privacyThreshold,
          resultChallengeEndsAt: question.poll.resultChallengeEndsAt,
          createdAt: question.poll.createdAt,
          ballotCommitmentRoot: hashJson(ballotCommitments),
          nullifierRoot: hashJson(nullifiers),
          decryptionShares: question.poll.decryptionShares,
          decryptionShareRoot: hashJson(question.poll.decryptionShares.map((share) => ({ memberId: share.memberId, shareHash: share.shareHash }))),
          result: question.poll.result,
          resultChallenges: question.poll.resultChallenges
        }
      : null
  };
}

function collectCommunityExportArtifactReferences(
  questions: CommunityExportQuestionInput[],
  policies: CommunityExportPolicyInput[],
  forks: CommunityExportForkInput[],
  frontendConfig: { configHash: string } | null,
  governanceParameterSets: CommunityExportGovernanceParameterInput[] = [],
  emergencySuspensions: CommunityExportEmergencySuspensionInput[] = [],
  credentialTrustPolicies: CommunityCredentialTrustPolicyView[] = [],
  tallyCommittees: TallyCommitteeView[] = [],
  tallyKeySetups: TallyKeySetupView[] = [],
  dataUnionPolicies: DataUnionPolicy[] = [],
  dataUnionConsents: DataUnionConsent[] = [],
  dataUnionProducts: DataUnionProduct[] = [],
  dataUnionAccessGrants: DataUnionAccessGrant[] = [],
  dataUnionBuyers: DataUnionBuyer[] = [],
  dataUnionSettlements: DataUnionSettlement[] = [],
  dataUnionClaims: DataUnionClaim[] = [],
  moderationRecords: CommunityExportModerationRecordInput[] = [],
  moderationAppeals: CommunityExportModerationAppealInput[] = [],
  challengeAppeals: CommunityExportChallengeAppealInput[] = [],
  jurorAssignments: CommunityExportJurorAssignmentInput[] = [],
  profiles: CommunityExportProfileInput[] = [],
  communityFollows: CommunityExportCommunityFollowInput[] = [],
  topicFollows: CommunityExportTopicFollowInput[] = []
): ArtifactReference[] {
  const references: ArtifactReference[] = [];
  const add = (kind: string, hash: string | null | undefined, role: string) => {
    if (hash) references.push({ kind, hash, role });
  };

  for (const policy of policies) {
    add("adoption-policy-proposal", policy.proposalHash, "adoption-policy-proposal");
    add("adoption-policy-activation", policy.activationHash, "adoption-policy-activation");
    add("adoption-policy-suspension", policy.suspensionReasonHash, "adoption-policy-suspension");
  }

  for (const fork of forks) {
    add("community-fork", fork.metadataHash, "community-fork");
    add("community-export", fork.sourceExportHash, "source-community-export");
  }

  add("community-frontend-config", frontendConfig?.configHash, "community-frontend-config");

  for (const parameterSet of governanceParameterSets) {
    add("governance-parameter-proposal", parameterSet.proposalHash, "governance-parameter-proposal");
    add("governance-parameter-activation", parameterSet.activationHash, "governance-parameter-activation");
  }

  for (const suspension of emergencySuspensions) {
    add("community-emergency-suspension", suspension.reasonHash, "community-emergency-suspension");
    add("community-emergency-resolution", suspension.resolutionHash, "community-emergency-resolution");
  }

  for (const policy of credentialTrustPolicies) {
    add("community-credential-trust-policy", policy.policyHash, "community-credential-trust-policy");
  }

  for (const committee of tallyCommittees) {
    add("tally-committee-proposal", committee.metadataHash, "tally-committee-proposal");
    add("tally-committee-activation", committee.activationHash, "tally-committee-activation");
    add("tally-committee-failure", committee.failureHash, "tally-committee-failure");
  }

  for (const setup of tallyKeySetups) {
    add("tally-key-setup", setup.setupHash, "tally-key-setup");
  }

  for (const policy of dataUnionPolicies) {
    add("data-union-policy", policy.policyHash, "data-union-policy");
    add("data-union-policy-activation", policy.activationHash, "data-union-policy-activation");
  }

  for (const consent of dataUnionConsents) {
    add("data-union-consent", consent.consentHash, "data-union-consent");
    add("data-union-consent-revocation", consent.revokedHash, "data-union-consent-revocation");
  }

  for (const product of dataUnionProducts) {
    add("data-union-product", product.dataProductHash, "data-union-product");
  }

  for (const grant of dataUnionAccessGrants) {
    add("data-union-access-grant", grant.accessHash, "data-union-access-grant");
  }

  for (const buyer of dataUnionBuyers) {
    add("data-union-buyer-approval", buyer.approvalHash, "data-union-buyer-approval");
  }

  for (const settlement of dataUnionSettlements) {
    add("data-union-settlement", settlement.settlementHash, "data-union-settlement");
  }

  for (const claim of dataUnionClaims) {
    add("data-union-claim-redemption", claim.redemptionHash, "data-union-claim-redemption");
  }

  for (const question of questions) {
    for (const share of question.poll?.decryptionShares ?? []) {
      add("tally-decryption-share", share.artifactHash, "tally-decryption-share");
    }
  }

  for (const profile of profiles) {
    add("user-profile", profile.profileHash, "user-profile");
  }

  for (const follow of communityFollows) {
    add("social-follow", follow.followHash, "community-follow");
  }

  for (const follow of topicFollows) {
    add("social-follow", follow.followHash, "topic-follow");
  }

  for (const record of moderationRecords) {
    add("discussion-moderation", record.reasonHash, "discussion-moderation");
  }

  for (const appeal of moderationAppeals) {
    add("discussion-moderation-appeal", appeal.appealHash, "discussion-moderation-appeal");
    add("discussion-moderation-resolution", appeal.resolutionHash, "discussion-moderation-resolution");
  }

  for (const appeal of challengeAppeals) {
    add("challenge-appeal", appeal.appealHash, "challenge-appeal");
    add("challenge-appeal-resolution", appeal.resolutionHash, "challenge-appeal-resolution");
  }

  for (const assignment of jurorAssignments) {
    add("juror-selection", assignment.selectionHash, "juror-selection");
    add("juror-conflict-disclosure", assignment.conflictDisclosureHash, "juror-conflict-disclosure");
  }

  for (const question of questions) {
    add("question-body", question.bodyHash, "body");
    add("sponsor-disclosure", question.sponsorDisclosureHash, "sponsor");
    add("question-archive", question.archiveRecord?.archiveHash, "archive");
    add("result-artifact", question.poll?.result?.resultArtifactHash, "result");
    add("tally-publication-proof", question.poll?.result?.tallyPublicationProofHash, "tally-publication-proof");
    for (const challenge of question.challenges) {
      add("question-challenge-evidence", challenge.evidenceHash, "question-challenge");
      add("question-challenge-resolution", challenge.resolutionHash, "question-challenge-resolution");
    }
    for (const challenge of question.poll?.resultChallenges ?? []) {
      add("result-challenge-evidence", challenge.evidenceHash, "result-challenge");
      add("result-challenge-resolution", challenge.resolutionHash, "result-challenge-resolution");
    }
    for (const assignment of question.jurorAssignments) {
      add("juror-selection", assignment.selectionHash, "juror-selection");
      add("juror-conflict-disclosure", assignment.conflictDisclosureHash, "juror-conflict-disclosure");
    }
    for (const post of question.discussionPosts) {
      add("discussion-post", post.bodyHash, "discussion");
    }
  }

  return uniqueArtifactReferences(references);
}

function extractIdsFromExportList(value: unknown): string[] {
  return Array.isArray(value) ? value.flatMap((entry) => (isRecord(entry) && typeof entry.id === "string" ? [entry.id] : [])) : [];
}

function extractArchiveHashesFromExportList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.flatMap((entry) => (isRecord(entry) && typeof entry.archiveHash === "string" ? [entry.archiveHash] : []))
    : [];
}

function uniqueArtifactReferences(references: ArtifactReference[]): ArtifactReference[] {
  return [
    ...new Map(references.map((reference) => [`${reference.kind}:${reference.role ?? ""}:${reference.hash}`, reference])).values()
  ];
}

function buildRegistryEventsProtocol(events: RegistryEventView[], page?: PageInfo, commitments: CommitmentView[] = []) {
  return {
    protocol: "popular-consensus",
    schemaVersion: "registry-events-v0",
    page,
    ids: {
      eventIds: events.map((event) => event.id),
      subjectIds: [...new Set(events.map((event) => event.subjectId))],
      commitmentIds: commitments.map((commitment) => commitment.id)
    },
    hashes: {
      eventStreamHash: hashJson(events.map((event) => ({ eventType: event.eventType, subjectId: event.subjectId, previousHash: event.previousHash, newHash: event.newHash }))),
      latestEventHash: events.at(-1)?.newHash ?? null,
      eventHashes: events.map((event) => event.newHash),
      commitmentHashes: commitments.map((commitment) => commitment.commitmentHash),
      commitmentPayloadHashes: commitments.map((commitment) => commitment.payloadHash)
    },
    statuses: {
      eventCount: events.length,
      latestEventType: events.at(-1)?.eventType ?? null,
      commitmentCount: commitments.length,
      commitmentKinds: uniqueStrings(commitments.map((commitment) => commitment.kind))
    },
    authority: {
      actors: [...new Set(events.map((event) => event.actor))],
      sourceTypes: uniqueStrings(events.map((event) => event.sourceType)),
      sourceModules: uniqueStrings(events.map((event) => event.sourceModule)),
      sourceTransactionIds: uniqueStrings(events.map((event) => event.sourceTransactionId)),
      commitmentContractModules: uniqueStrings(commitments.map((commitment) => commitment.contractModule)),
      commitmentMode: commitments.length ? "local-devnet-record" : null
    }
  };
}

function buildProtocolTransactionsProtocol(transactions: Array<ReturnType<typeof toProtocolTransactionView>>, page: PageInfo) {
  return {
    protocol: "popular-consensus",
    schemaVersion: "protocol-transactions-v0",
    page,
    ids: {
      transactionIds: transactions.map((transaction) => transaction.id),
      subjectIds: uniqueStrings(transactions.map((transaction) => transaction.subjectId)),
      eventHashes: transactions.map((transaction) => transaction.eventHash)
    },
    hashes: {
      transactionResultHashes: transactions.map((transaction) => transaction.resultHash),
      transactionPayloadHashes: transactions.map((transaction) => transaction.payloadHash),
      transactionStreamHash: hashJson(transactions.map((transaction) => transaction.resultHash))
    },
    statuses: {
      transactionCount: transactions.length,
      statuses: uniqueStrings(transactions.map((transaction) => transaction.status)),
      eventTypes: uniqueStrings(transactions.map((transaction) => transaction.eventType))
    },
    authority: {
      sourceTypes: uniqueStrings(transactions.map((transaction) => transaction.sourceType)),
      sourceModules: uniqueStrings(transactions.map((transaction) => transaction.sourceModule)),
      transactionTypes: uniqueStrings(transactions.map((transaction) => transaction.transactionType)),
      actors: uniqueStrings(transactions.map((transaction) => transaction.actor))
    }
  };
}

function buildProtocolIndexerReplayProtocol(replay: ProtocolIndexerReplayResult) {
  return {
    protocol: "popular-consensus",
    schemaVersion: "protocol-indexer-replay-v0",
    ids: {
      transactionIds: replay.transactions.map((transaction) => transaction.id),
      eventIds: replay.events.map((event) => event.id),
      subjectIds: replay.rebuilt.subjects.map((subject) => subject.subjectId),
      sourceModules: replay.rebuilt.modules.map((module) => module.sourceModule),
      checkIds: replay.checks.map((check) => check.id)
    },
    hashes: {
      transactionStreamHash: replay.rebuilt.transactionStreamHash,
      eventStreamHash: replay.rebuilt.eventStreamHash,
      latestResultHash: replay.rebuilt.latestResultHash,
      latestEventHash: replay.rebuilt.latestEventHash
    },
    statuses: {
      replayStatus: replay.allPassed ? "Verified" : "Mismatch",
      checkCount: replay.checks.length,
      failedChecks: replay.checks.filter((check) => !check.ok).map((check) => check.id),
      transactionCount: replay.rebuilt.transactionCount,
      eventCount: replay.rebuilt.eventCount,
      subjectCount: replay.rebuilt.subjectCount,
      moduleCount: replay.rebuilt.moduleCount
    },
    authority: {
      source: replay.rebuilt.source,
      readOnly: replay.readOnly,
      replayRule: "verify-transaction-results-and-rebuild-registry-events",
      boundaryVersion: CanonicalProtocolBoundary.schemaVersion
    }
  };
}

function buildReplayCheckProtocol(question: ReplayQuestionInput, events: RegistryEventView[], replay: ReplayCheckResult) {
  return {
    protocol: "popular-consensus",
    schemaVersion: "replay-check-v0",
    ids: {
      questionId: question.id,
      communityId: question.communityId,
      pollId: question.poll?.id ?? null,
      archiveRecordId: question.archiveRecord?.id ?? null,
      eventIds: events.map((event) => event.id)
    },
    hashes: {
      eventStreamHash: replay.eventStreamHash,
      bodyHash: replay.rebuilt.bodyHash,
      resultArtifactHash: replay.rebuilt.resultArtifactHash,
      archiveHash: replay.rebuilt.archiveHash
    },
    statuses: {
      replayStatus: replay.allPassed ? "Verified" : "Mismatch",
      checkCount: replay.checks.length,
      failedChecks: replay.checks.filter((check) => !check.ok).map((check) => check.id),
      rebuiltQuestionStatus: replay.rebuilt.questionStatus,
      rebuiltPollStatus: replay.rebuilt.pollStatus,
      rebuiltResultFinalStatus: replay.rebuilt.resultFinalStatus
    },
    authority: {
      authorityLevel: normalizeAuthority(question.authorityLevel),
      adoptionPolicyId: question.adoptionPolicyId,
      credentialSchemaId: question.credentialSchemaId,
      communityVisibility: question.community?.visibility ?? null,
      communityDefaultAuthorityLevel: normalizeAuthority(question.community?.defaultAuthorityLevel ?? "Advisory")
    }
  };
}

function buildCommitmentsProtocol(commitments: CommitmentView[], page: PageInfo) {
  return {
    protocol: "popular-consensus",
    schemaVersion: "commitments-index-v0",
    page,
    ids: {
      commitmentIds: commitments.map((commitment) => commitment.id),
      sourceEventIds: commitments.map((commitment) => commitment.sourceEventId),
      subjectIds: uniqueStrings(commitments.map((commitment) => commitment.subjectId))
    },
    hashes: {
      commitmentHashes: commitments.map((commitment) => commitment.commitmentHash),
      payloadHashes: commitments.map((commitment) => commitment.payloadHash),
      commitmentSetHash: hashJson(MinimumProtocolCommitments)
    },
    statuses: {
      commitmentCount: commitments.length,
      kinds: uniqueStrings(commitments.map((commitment) => commitment.kind)),
      eventTypes: uniqueStrings(commitments.map((commitment) => commitment.eventType))
    },
    authority: {
      contractModules: uniqueStrings(commitments.map((commitment) => commitment.contractModule)),
      mode: "local-devnet-record"
    }
  };
}

function buildArchivesProtocol(
  archives: Array<{
    id: string;
    questionId: string;
    archiveHash: string;
    archivedBy: string;
    question: {
      id: string;
      status: string;
      communityId: string | null;
      authorityLevel: string;
      adoptionPolicyId: string | null;
      poll: { id: string; result: { resultArtifactHash: string; finalStatus: string } | null } | null;
    };
  }>,
  page: PageInfo
) {
  return {
    protocol: "popular-consensus",
    schemaVersion: "archives-index-v0",
    page,
    ids: {
      archiveRecordIds: archives.map((archive) => archive.id),
      questionIds: archives.map((archive) => archive.questionId),
      communityIds: uniqueStrings(archives.map((archive) => archive.question.communityId)),
      pollIds: compactHashArray(archives.map((archive) => archive.question.poll?.id))
    },
    hashes: {
      archiveHashes: archives.map((archive) => archive.archiveHash),
      resultArtifactHashes: compactHashArray(archives.map((archive) => archive.question.poll?.result?.resultArtifactHash))
    },
    statuses: {
      archiveCount: archives.length,
      questionStatuses: archives.map((archive) => ({ questionId: archive.questionId, status: archive.question.status })),
      resultStatuses: archives.map((archive) => ({
        questionId: archive.questionId,
        finalStatus: archive.question.poll?.result?.finalStatus ?? null
      }))
    },
    authority: {
      archivedBy: uniqueStrings(archives.map((archive) => archive.archivedBy)),
      authorityLevels: uniqueStrings(archives.map((archive) => normalizeAuthority(archive.question.authorityLevel))),
      adoptionPolicyIds: uniqueStrings(archives.map((archive) => archive.question.adoptionPolicyId))
    }
  };
}

function buildResultArtifactsProtocol(results: ResultArtifactSummaryInput[], page: PageInfo) {
  const summaries = results.map(toResultArtifactSummary);
  return {
    protocol: "popular-consensus",
    schemaVersion: "result-artifacts-index-v0",
    page,
    ids: {
      resultIds: summaries.map((result) => result.resultId),
      pollIds: summaries.map((result) => result.pollId),
      questionIds: summaries.map((result) => result.questionId),
      communityIds: uniqueStrings(summaries.map((result) => result.communityId))
    },
    hashes: {
      resultArtifactHashes: summaries.map((result) => result.resultArtifactHash),
      aggregateCountsHashes: summaries.map((result) => result.aggregateCountsHash),
      tallyProofHashes: summaries.map((result) => result.tallyProofHash),
      tallyPublicationProofHashes: compactHashArray(summaries.map((result) => result.tallyPublicationProofHash)),
      privacyReportHashes: summaries.map((result) => result.privacyReportHash)
    },
    statuses: {
      resultCount: summaries.length,
      finalStatuses: summaries.map((result) => ({ resultId: result.resultId, finalStatus: result.finalStatus }))
    },
    authority: {
      authorityLevels: uniqueStrings(summaries.map((result) => result.authorityLevel)),
      adoptionPolicyIds: uniqueStrings(summaries.map((result) => result.adoptionPolicyId)),
      credentialSchemaIds: uniqueStrings(summaries.map((result) => result.credentialSchemaId))
    }
  };
}

type ResultArtifactSummaryInput = {
  id: string;
  pollId: string;
  resultArtifactHash: string;
  aggregateCountsHash: string;
  tallyProofHash: string;
  tallyPublicationProofHash?: string | null;
  turnout: number;
  invalidBallots: number;
  privacyReportHash: string;
  finalStatus: string;
  publishedAt: Date;
  poll: {
    id: string;
    questionId: string;
    question: {
      communityId: string | null;
      authorityLevel: string;
      adoptionPolicyId: string | null;
      credentialSchemaId: string;
    };
  };
};

function toResultArtifactSummary(result: ResultArtifactSummaryInput) {
  return {
    resultId: result.id,
    pollId: result.pollId,
    questionId: result.poll.questionId,
    communityId: result.poll.question.communityId,
    authorityLevel: normalizeAuthority(result.poll.question.authorityLevel),
    adoptionPolicyId: result.poll.question.adoptionPolicyId,
    credentialSchemaId: result.poll.question.credentialSchemaId,
    resultArtifactHash: result.resultArtifactHash,
    aggregateCountsHash: result.aggregateCountsHash,
    tallyProofHash: result.tallyProofHash,
    tallyPublicationProofHash: result.tallyPublicationProofHash ?? null,
    privacyReportHash: result.privacyReportHash,
    turnout: result.turnout,
    invalidBallots: result.invalidBallots,
    finalStatus: result.finalStatus,
    publishedAt: result.publishedAt
  };
}

function toCommitmentView(record: {
  id: string;
  kind: string;
  contractModule: string;
  subjectId: string;
  eventType: string;
  sourceEventId: string;
  commitmentHash: string;
  payloadHash: string;
  payloadJson: string;
  status: string;
  createdAt: Date;
}): CommitmentView {
  return {
    id: record.id,
    kind: record.kind,
    contractModule: record.contractModule,
    subjectId: record.subjectId,
    eventType: record.eventType,
    sourceEventId: record.sourceEventId,
    commitmentHash: record.commitmentHash,
    payloadHash: record.payloadHash,
    status: record.status,
    createdAt: record.createdAt,
    payload: parseJsonOrNull(record.payloadJson)
  };
}

function toProtocolTransactionView(record: ProtocolTransactionView) {
  return {
    id: record.id,
    sourceType: record.sourceType,
    sourceModule: record.sourceModule,
    transactionType: record.transactionType,
    subjectId: record.subjectId,
    actor: record.actor,
    eventType: record.eventType,
    eventHash: record.eventHash,
    resultHash: record.resultHash,
    payloadHash: record.payloadHash,
    status: record.status,
    createdAt: record.createdAt,
    payload: parseJsonOrNull(record.payloadJson)
  };
}

function parseJsonOrNull(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function buildArtifactReadProtocol(hash: string, artifact: unknown) {
  const artifactRecord = artifact && typeof artifact === "object" ? (artifact as Record<string, unknown>) : {};
  return {
    protocol: "popular-consensus",
    schemaVersion: "artifact-read-v0",
    ids: {
      artifactKind: typeof artifactRecord.artifactKind === "string" ? artifactRecord.artifactKind : null
    },
    hashes: {
      artifactHash: hash,
      computedHash: hashJson(artifact)
    },
    statuses: {
      verificationStatus: hashJson(artifact) === hash ? "Verified" : "HashMismatch"
    },
    authority: {
      schemaVersion: typeof artifactRecord.schemaVersion === "string" ? artifactRecord.schemaVersion : null
    }
  };
}

function compactHashArray(values: Array<string | null | undefined>): string[] {
  return values.filter((value): value is string => Boolean(value));
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(compactHashArray(values))];
}

function prepareProtocolEvent(input: ProtocolEventInput): PreparedProtocolEvent {
  const emittedAt = input.emittedAt ?? new Date();
  return {
    eventType: input.eventType,
    subjectId: input.subjectId,
    actor: input.actor,
    previousHash: input.previousHash,
    newHash: input.newHash,
    emittedAt,
    protocolTransaction: buildLocalProtocolTransactionResult(
      input.eventType,
      input.subjectId,
      input.actor,
      input.previousHash,
      input.newHash,
      emittedAt,
      input.nonce ?? nanoid()
    )
  };
}

async function ingestProtocolEvent(tx: Prisma.TransactionClient, prepared: PreparedProtocolEvent): Promise<RegistryEventView> {
  const protocolTransaction = prepared.protocolTransaction;
  await tx.protocolTransactionResult.create({
    data: {
      id: protocolTransaction.id,
      sourceType: protocolTransaction.sourceType,
      sourceModule: protocolTransaction.sourceModule,
      transactionType: protocolTransaction.transactionType,
      subjectId: prepared.subjectId,
      actor: prepared.actor,
      eventType: prepared.eventType,
      eventHash: protocolTransaction.eventHash,
      resultHash: protocolTransaction.resultHash,
      payloadHash: protocolTransaction.payloadHash,
      payloadJson: JSON.stringify(protocolTransaction.payload),
      status: "Applied",
      createdAt: prepared.emittedAt
    }
  });
  return tx.registryEvent.create({
    data: {
      id: protocolTransaction.eventHash,
      eventType: prepared.eventType,
      subjectId: prepared.subjectId,
      actor: prepared.actor,
      previousHash: prepared.previousHash,
      newHash: prepared.newHash,
      sourceType: protocolTransaction.sourceType,
      sourceTransactionId: protocolTransaction.id,
      sourceTransactionHash: protocolTransaction.resultHash,
      sourceModule: protocolTransaction.sourceModule,
      transactionType: protocolTransaction.transactionType,
      emittedAt: prepared.emittedAt
    }
  });
}

function buildLocalProtocolTransactionResult(
  eventType: string,
  subjectId: string,
  actor: string,
  previousHash: string | null,
  newHash: string,
  emittedAt: Date,
  nonce: string
) {
  const sourceModule = resolveProtocolEventModule(eventType);
  const transactionType = resolveProtocolTransactionType(eventType);
  const eventHash = hashJson({ eventType, subjectId, actor, previousHash, newHash, emittedAt: emittedAt.toISOString(), nonce });
  const payload = {
    protocol: "popular-consensus",
    schemaVersion: "local-protocol-transaction-result-v0",
    sourceType: PROTOCOL_EVENT_SOURCE_TYPE,
    sourceModule,
    transactionType,
    subjectId,
    actor,
    eventType,
    previousHash,
    newHash,
    eventHash,
    nonce,
    emittedAt: emittedAt.toISOString()
  };
  const payloadHash = hashJson(payload);
  const resultHash = hashJson({ sourceType: PROTOCOL_EVENT_SOURCE_TYPE, sourceModule, transactionType, eventHash, payloadHash });
  return {
    id: hashJson({ sourceType: PROTOCOL_EVENT_SOURCE_TYPE, sourceModule, transactionType, subjectId, eventHash }),
    sourceType: PROTOCOL_EVENT_SOURCE_TYPE,
    sourceModule,
    transactionType,
    eventHash,
    resultHash,
    payloadHash,
    payload
  };
}

function resolveProtocolEventModule(eventType: string): string {
  if (["ResultPublished", "ResultCorrected", "ResultFinalized", "QuestionArchived"].includes(eventType)) return "ResultArchive";
  const commitmentModule = MinimumProtocolCommitments.find((commitment) => commitment.eventTypes.includes(eventType))?.contractModule;
  if (commitmentModule) return commitmentModule;
  return PROTOCOL_EVENT_MODULE_BY_TYPE.get(eventType) ?? inferProtocolEventModule(eventType);
}

function resolveProtocolTransactionType(eventType: string): string {
  return eventType.replace(/^[A-Z]/, (letter) => letter.toLowerCase());
}

function inferProtocolEventModule(eventType: string): string {
  if (eventType.startsWith("Credential") || eventType.startsWith("CommunityCredentialTrustPolicy") || eventType.startsWith("AnonymousEligibility")) return "CredentialRegistry";
  if (eventType.startsWith("Tally")) return "TallyManager";
  if (eventType.startsWith("Poll") || eventType.startsWith("Ballot")) return "PollManager";
  if (eventType.startsWith("ResultChallenge") || eventType === "ResultChallenged") return "ChallengeCourt";
  if (eventType.startsWith("Result")) return "ResultArchive";
  if (eventType.startsWith("Adoption") || eventType.startsWith("Governance") || eventType.startsWith("CommunityEmergency")) return "AdoptionRegistry";
  if (
    eventType.startsWith("User") ||
    eventType.startsWith("Discussion") ||
    eventType.startsWith("Profile") ||
    eventType.endsWith("Followed") ||
    eventType.startsWith("Reputation")
  ) {
    return "SocialGraph";
  }
  return "QuestionRegistry";
}

async function recordProtocolCommitments(event: RegistryEventView, client: ProtocolPersistenceClient = prisma) {
  const commitmentDefinitions = MinimumProtocolCommitments.filter((commitment) => commitment.eventTypes.includes(event.eventType));
  for (const definition of commitmentDefinitions) {
    const payload = {
      protocol: "popular-consensus",
      schemaVersion: "devnet-commitment-v0",
      kind: definition.kind,
      contractModule: definition.contractModule,
      sourceEvent: {
        id: event.id,
        eventType: event.eventType,
        subjectId: event.subjectId,
        actor: event.actor,
        previousHash: event.previousHash,
        newHash: event.newHash,
        sourceType: event.sourceType ?? null,
        sourceTransactionId: event.sourceTransactionId ?? null,
        sourceTransactionHash: event.sourceTransactionHash ?? null,
        sourceModule: event.sourceModule ?? null,
        transactionType: event.transactionType ?? null,
        emittedAt: event.emittedAt.toISOString()
      }
    };
    const payloadHash = hashJson(payload);
    const commitmentHash = hashJson({ kind: definition.kind, contractModule: definition.contractModule, payloadHash });
    const id = hashJson({ kind: definition.kind, sourceEventId: event.id, payloadHash });
    await client.protocolCommitmentRecord.upsert({
      where: { id },
      update: {},
      create: {
        id,
        kind: definition.kind,
        contractModule: definition.contractModule,
        subjectId: event.subjectId,
        eventType: event.eventType,
        sourceEventId: event.id,
        commitmentHash,
        payloadHash,
        payloadJson: JSON.stringify(payload)
      }
    });
  }
}

async function addReputation(account: string, reason: string, weight: number, sourceId: string) {
  const emittedAt = new Date();
  const reputationEvent = {
    id: hashJson({ account, reason, weight, sourceId, emittedAt: emittedAt.toISOString(), nonce: nanoid() }),
    account,
    reason,
    weight,
    sourceId,
    createdAt: emittedAt
  };
  await prisma.$transaction(async (tx) => {
    const previousEvents = await tx.reputationEvent.findMany({
      where: { account },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });
    const reputationEventRecordedEvent = prepareProtocolEvent({
      eventType: "ReputationEventRecorded",
      subjectId: reputationEvent.id,
      actor: account,
      previousHash: previousEvents.length > 0 ? hashReputationEvents(previousEvents) : null,
      newHash: hashReputationEvents([...previousEvents, reputationEvent]),
      emittedAt,
      nonce: reputationEvent.id
    });
    const protocolEvent = await ingestProtocolEvent(tx, reputationEventRecordedEvent);
    await tx.reputationEvent.create({ data: reputationEvent });
    await tx.userAccount.updateMany({
      where: { id: account },
      data: { reputation: { increment: weight } }
    });
    await recordProtocolCommitments(protocolEvent, tx);
  });
}

async function storeArtifact(artifact: { hash: string; path: string }, kind: ArtifactKind) {
  await prisma.artifact.upsert({
    where: { hash: artifact.hash },
    update: {},
    create: { hash: artifact.hash, path: artifact.path, kind, privacyLevel: artifactPrivacyLevel(kind) }
  });
}

function artifactPrivacyLevel(kind: string) {
  if (PUBLIC_ARTIFACT_KINDS.has(kind)) return "Public";
  if (COMMUNITY_GATED_ARTIFACT_KINDS.has(kind)) return "CommunityGated";
  return "Protected";
}

type CredentialRegistryCheckInput = {
  id?: string;
  schemaId: string;
  issuerId: string;
  createdAt?: Date | string | number | null;
};

type CredentialWalletSource = {
  id: string;
  holderAlias: string;
  schemaId: string;
  issuerId: string;
  createdAt: Date | string | number;
};

function toWalletCredential(credential: CredentialWalletSource, secret: string): WalletCredential {
  return {
    protocol: "popular-consensus",
    schemaVersion: "wallet-credential-v0",
    credentialId: credential.id,
    holderAlias: credential.holderAlias,
    schemaId: credential.schemaId,
    issuerId: credential.issuerId,
    secret,
    issuedAt: new Date(credential.createdAt).toISOString()
  };
}

function walletCredentialIssuedAtDate(credential: WalletCredential) {
  const issuedAt = new Date(credential.issuedAt);
  return Number.isNaN(issuedAt.getTime()) ? null : issuedAt;
}

function toCredentialProofSource(credential: { id: string; schemaId: string; issuerId: string; secretHash: string }) {
  return {
    credentialId: credential.id,
    schemaId: credential.schemaId,
    issuerId: credential.issuerId,
    secretHash: credential.secretHash
  };
}

function resolveCredentialMembershipProof(
  providedProof: CredentialMembershipProof | undefined,
  credential: { id: string; schemaId: string; issuerId: string; secretHash: string },
  credentialSecret: string,
  pollId: string
): CredentialMembershipProof | null {
  const proofSource = toCredentialProofSource(credential);
  if (!providedProof) return createCredentialMembershipProof(proofSource, credentialSecret, pollId);
  return verifyCredentialMembershipProof(providedProof, proofSource, credentialSecret, pollId) ? providedProof : null;
}

function credentialRevocationLeafHash(revocation: { credentialId: string; schemaId: string; issuerId: string; revocationHash: string }) {
  return hashJson({
    protocol: "pc-credential-revocation-leaf-v1",
    credentialId: revocation.credentialId,
    schemaId: revocation.schemaId,
    issuerId: revocation.issuerId,
    revocationHash: revocation.revocationHash
  });
}

async function writeCredentialRevocationRoot(
  schemaId: string,
  previousRoot: string | null,
  pendingRevocations: Array<{ leafHash: string; revocationHash: string }> = []
) {
  const revocations = await prisma.credentialRevocation.findMany({
    where: { schemaId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });
  const leafHashes = [...revocations.map((revocation) => revocation.leafHash), ...pendingRevocations.map((revocation) => revocation.leafHash)].sort();
  const revocationHashes = [
    ...revocations.map((revocation) => revocation.revocationHash),
    ...pendingRevocations.map((revocation) => revocation.revocationHash)
  ].sort();
  const revocationRootArtifact = await createFileArtifactStorage(config.artifactDir).write(
    withArtifactSchema("credential-revocation-root", {
      schemaId,
      revokedCredentialCount: revocations.length + pendingRevocations.length,
      leafHashes,
      revocationHashes,
      previousRoot,
      root: hashJson({
        protocol: "pc-credential-revocation-root-v1",
        schemaId,
        leafHashes
      })
    })
  );
  await storeArtifact(revocationRootArtifact, "credential-revocation-root");
  return revocationRootArtifact;
}

function isCredentialExpired(credential: CredentialRegistryCheckInput, expiresAfterSeconds: number | null) {
  if (!expiresAfterSeconds || !credential.createdAt) return false;
  const issuedAt = new Date(credential.createdAt).getTime();
  if (Number.isNaN(issuedAt)) return false;
  return Date.now() >= issuedAt + expiresAfterSeconds * 1000;
}

async function credentialRegistryError(credential: CredentialRegistryCheckInput) {
  const [schema, issuer, revocation] = await Promise.all([
    prisma.credentialSchema.findUnique({ where: { id: credential.schemaId } }),
    prisma.credentialIssuer.findUnique({ where: { id: credential.issuerId } }),
    credential.id ? prisma.credentialRevocation.findUnique({ where: { credentialId: credential.id } }) : Promise.resolve(null)
  ]);
  if (!schema || schema.status !== "Active") return "Voting pass type is not active";
  if (!issuer || issuer.status !== "Active") return "Voting pass issuer is not active";
  if (!issuer.schemaIds.includes(credential.schemaId)) return "Voting pass issuer is not approved for this pass type";
  if (isCredentialExpired(credential, schema.expiresAfter)) return "Voting pass is expired";
  if (revocation) return "Voting pass was revoked";
  return null;
}

async function communityCredentialTrustError(communityId: string | null | undefined, credential: { schemaId: string; issuerId: string }) {
  if (!communityId) return null;
  const policies = await prisma.communityCredentialTrustPolicy.findMany({
    where: {
      communityId,
      status: "Active",
      OR: [{ credentialSchemaId: credential.schemaId }, { credentialSchemaId: "*" }]
    },
    orderBy: [{ credentialSchemaId: "asc" }, { createdAt: "asc" }]
  });
  if (policies.length === 0) return null;
  return policies.some((policy) => credentialTrustPolicyAllows(policy, credential)) ? null : "Voting pass issuer is not trusted by this community";
}

function credentialTrustPolicyAllows(policy: CommunityCredentialTrustPolicyView, credential: { schemaId: string; issuerId: string }) {
  if (policy.status !== "Active") return false;
  if (policy.credentialSchemaId !== "*" && policy.credentialSchemaId !== credential.schemaId) return false;
  if (policy.mode === "Open") return true;
  return policy.trustedIssuerIds.includes("*") || policy.trustedIssuerIds.includes(credential.issuerId);
}

async function requireCommunitySteward(communityId: string, userId: string, reply: FastifyReply, request?: FastifyRequest) {
  if (request && !(await requireAuthenticatedActor(request, reply, userId))) return null;
  const [community, user, membership] = await Promise.all([
    prisma.community.findUnique({ where: { id: communityId } }),
    prisma.userAccount.findUnique({ where: { id: userId } }),
    prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } }
    })
  ]);
  if (!community) {
    reply.code(404).send({ error: "Community not found" });
    return null;
  }
  if (!user) {
    reply.code(404).send({ error: "Community guide account not found" });
    return null;
  }
  if (!membership || membership.status !== "Active") {
    reply.code(403).send({ error: "Only active community guides can change next-step rules" });
    return null;
  }
  if (!["Owner", "Moderator"].includes(membership.role)) {
    reply.code(403).send({ error: "Only community leads or guides can change next-step rules" });
    return null;
  }
  return { community, user, membership };
}

async function requireCommunityCurator(communityId: string | null, userId: string, reply: FastifyReply, request?: FastifyRequest) {
  if (request && !(await requireAuthenticatedActor(request, reply, userId))) return null;
  if (!communityId) return { community: null, membership: null };
  const [community, membership] = await Promise.all([
    prisma.community.findUnique({ where: { id: communityId } }),
    prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } }
    })
  ]);
  if (!community) {
    reply.code(404).send({ error: "Community not found" });
    return null;
  }
  if (!membership || membership.status !== "Active") {
    reply.code(403).send({ error: "Only active community guides can review questions" });
    return null;
  }
  if (!CURATOR_ROLES.includes(membership.role)) {
    reply.code(403).send({ error: "Only community leads or guides can review questions" });
    return null;
  }
  return { community, membership };
}

async function activeCommunityEmergencySuspension(communityId: string | null) {
  if (!communityId) return null;
  return prisma.communityEmergencySuspension.findFirst({
    where: { communityId, status: "Active" },
    orderBy: { createdAt: "desc" }
  });
}

async function ensureCommunityProtocolWritable(communityId: string | null, reply: FastifyReply) {
  const suspension = await activeCommunityEmergencySuspension(communityId);
  if (!suspension) return true;
  reply.code(423).send({
    error: "Community protocol actions are paused by an active emergency suspension",
    suspension
  });
  return false;
}

function normalizeStewardRole(role: string): "Owner" | "Moderator" {
  return role === "Owner" ? "Owner" : "Moderator";
}

async function resolveAdoptionAuthority(communityId: string, topicIds: string[], credentialSchemaId: string) {
  const now = new Date();
  const policies = await prisma.adoptionPolicy.findMany({
    where: { communityId, status: "Active", effectiveAt: { lte: now } },
    orderBy: { effectiveAt: "desc" }
  });
  const matchingPolicies = policies.filter(
    (policy) => matchesQuestionTypes(policy.eligibleQuestionTypes, topicIds) && matchesCredentialSchemas(policy.credentialSchemaIds, credentialSchemaId)
  );
  matchingPolicies.sort((left, right) => {
    const authorityDelta = authorityRank(right.authorityLevel) - authorityRank(left.authorityLevel);
    if (authorityDelta !== 0) return authorityDelta;
    return right.effectiveAt.getTime() - left.effectiveAt.getTime();
  });
  const policy = matchingPolicies[0];
  if (!policy) return { authorityLevel: "Advisory", policyId: null };
  return { authorityLevel: normalizeAuthority(policy.authorityLevel), policyId: policy.id };
}

async function resolveGovernanceParameters(communityId: string | null): Promise<GovernanceParameters> {
  if (!communityId) return DEFAULT_GOVERNANCE;
  const active = await prisma.governanceParameterSet.findFirst({
    where: { communityId, status: "Active", effectiveAt: { lte: new Date() } },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }]
  });
  return active ? toGovernanceParameters(active) : DEFAULT_GOVERNANCE;
}

function activeGovernanceParameterSet<T extends { status: string; effectiveAt: Date; createdAt: Date }>(parameterSets: T[]): T | null {
  const now = Date.now();
  return (
    parameterSets
      .filter((set) => set.status === "Active" && set.effectiveAt.getTime() <= now)
      .sort((left, right) => right.effectiveAt.getTime() - left.effectiveAt.getTime() || right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null
  );
}

function toGovernanceParameters(set: {
  proposalBondPc: number;
  challengeBondPc: number;
  appealBondPc: number;
  protocolFeePc: number;
  successfulChallengeRewardPc: number;
  failedChallengeProposerRewardPc: number;
  jurorRewardWeight: number;
  successfulChallengeReputation: number;
  acceptedAmendmentReputation: number;
  privacyThreshold: number;
  challengeWindowHours: number;
  resultChallengeWindowHours: number;
  pollDurationHours: number;
  reputationDecayRule: string;
}): GovernanceParameters {
  return {
    proposalBondPc: set.proposalBondPc,
    challengeBondPc: set.challengeBondPc,
    appealBondPc: set.appealBondPc,
    protocolFeePc: set.protocolFeePc,
    successfulChallengeRewardPc: set.successfulChallengeRewardPc,
    failedChallengeProposerRewardPc: set.failedChallengeProposerRewardPc,
    jurorRewardWeight: set.jurorRewardWeight,
    successfulChallengeReputation: set.successfulChallengeReputation,
    acceptedAmendmentReputation: set.acceptedAmendmentReputation,
    privacyThreshold: set.privacyThreshold,
    challengeWindowHours: set.challengeWindowHours,
    resultChallengeWindowHours: set.resultChallengeWindowHours,
    pollDurationHours: set.pollDurationHours,
    reputationDecayRule: set.reputationDecayRule
  };
}

function governanceParametersFromInput(input: GovernanceParameters): GovernanceParameters {
  return toGovernanceParameters(input);
}

function hoursFromNow(hours: number) {
  return new Date(Date.now() + 1000 * 60 * 60 * hours);
}

function minutesFromNow(minutes: number) {
  return new Date(Date.now() + 1000 * 60 * minutes);
}

type PasskeyControllerForDeployment = {
  id: string;
  userId: string;
  credentialId: string | null;
  publicKeyCose: string | null;
  aaAccountAddress: string;
  aaAccountKind: string;
  passkeyPublicKeyX: string | null;
  passkeyPublicKeyY: string | null;
};

async function maybeCreatePasskeyDeploymentChallenge(controller: PasskeyControllerForDeployment) {
  const smartAccount = predictPasskeySmartAccount(controller);
  if (!smartAccount || smartAccount.source !== "factory-create2") return null;
  const prepared = prepareDeploymentUserOperation(smartAccount, config.accountAbstraction.chainId);
  if (!prepared || prepared.signatureKind !== "passkey-webauthn-p256" || !prepared.signingChallenge || !controller.credentialId) return null;

  await prisma.authChallenge.deleteMany({
    where: {
      kind: "PasskeyDeployment",
      userId: controller.userId,
      challenge: prepared.signingChallenge
    }
  });
  const challenge = await prisma.authChallenge.create({
    data: {
      id: `auth-challenge-${nanoid(10)}`,
      kind: "PasskeyDeployment",
      challenge: prepared.signingChallenge,
      userId: controller.userId,
      aaAccountAddress: smartAccount.address,
      aaAccountKind: smartAccount.accountStandard,
      expiresAt: minutesFromNow(5)
    }
  });
  return {
    challengeId: challenge.id,
    aaUserOperation: prepared,
    publicKey: {
      challenge: prepared.signingChallenge,
      timeout: 60_000,
      userVerification: "preferred",
      allowCredentials: [{ type: "public-key", id: controller.credentialId }]
    }
  };
}

function predictPasskeySmartAccount(controller: PasskeyControllerForDeployment): SmartAccountPrediction | null {
  if (!controller.credentialId || !controller.passkeyPublicKeyX || !controller.passkeyPublicKeyY) return null;
  const smartAccount = predictSmartAccount(
    {
      kind: "passkey",
      credentialId: controller.credentialId,
      passkeyX: controller.passkeyPublicKeyX as Hex,
      passkeyY: controller.passkeyPublicKeyY as Hex
    },
    config.accountAbstraction,
    { requireFactory: config.requireAuth }
  );
  if (controller.aaAccountAddress && smartAccount.address.toLowerCase() !== controller.aaAccountAddress.toLowerCase()) return null;
  return smartAccount;
}

async function maybeSubmitWalletDeploymentUserOperation(input: {
  smartAccount: SmartAccountPrediction | null;
  inputUserOperation?: SerializedUserOperation;
  inputSignature?: `0x${string}`;
}) {
  if (!input.smartAccount || input.smartAccount.source !== "factory-create2") return null;
  const prepared = prepareDeploymentUserOperation(input.smartAccount, config.accountAbstraction.chainId);
  if (!prepared || !input.inputUserOperation || !input.inputSignature) return null;
  if (!sameUserOperation(input.inputUserOperation, prepared.userOperation)) {
    throw new Error("Submitted UserOperation does not match the auth challenge");
  }
  const signedOperation = attachWalletSignature(prepared.userOperation, input.inputSignature);
  return submitUserOperation(signedOperation, config.accountAbstraction);
}

async function createAuthSession(userId: string, aaAccountAddress: string, controllerId: string | null) {
  const token = newSessionToken();
  const session = await prisma.authSession.create({
    data: {
      id: `auth-session-${nanoid(10)}`,
      userId,
      tokenHash: hashSessionToken(token),
      aaAccountAddress,
      controllerId,
      expiresAt: hoursFromNow(config.authSessionTtlHours)
    }
  });
  return {
    id: session.id,
    token,
    expiresAt: session.expiresAt,
    aaAccountAddress: session.aaAccountAddress,
    controllerId: session.controllerId
  };
}

type CreatedAuthSession = Awaited<ReturnType<typeof createAuthSession>>;

function authSessionResponse(session: CreatedAuthSession) {
  const response = {
    id: session.id,
    expiresAt: session.expiresAt,
    aaAccountAddress: session.aaAccountAddress,
    controllerId: session.controllerId
  };
  return config.devMode ? { ...response, token: session.token } : response;
}

function setAuthSessionCookie(reply: FastifyReply, token: string) {
  reply.header("set-cookie", serializeSessionCookie("pc_auth", token, {
    maxAgeSeconds: Math.max(60, Math.floor(config.authSessionTtlHours * 60 * 60))
  }));
}

function clearAuthSessionCookie(reply: FastifyReply) {
  reply.header("set-cookie", serializeSessionCookie("pc_auth", "", { maxAgeSeconds: 0 }));
}

function readBearerToken(request: FastifyRequest) {
  const authorization = request.headers.authorization;
  const rawAuthorization = Array.isArray(authorization) ? authorization[0] : authorization;
  if (rawAuthorization?.startsWith("Bearer ")) return rawAuthorization.slice("Bearer ".length).trim();
  const headerToken = request.headers["x-pc-session-token"];
  const tokenFromHeader = Array.isArray(headerToken) ? headerToken[0] : headerToken;
  return tokenFromHeader ?? readCookie(request, "pc_auth");
}

function serializeSessionCookie(name: string, value: string, options: { maxAgeSeconds: number }) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${options.maxAgeSeconds}`
  ];
  if (config.secureAuthCookies) parts.push("Secure");
  return parts.join("; ");
}

function readCookie(request: FastifyRequest, name: string) {
  const rawCookie = request.headers.cookie;
  const cookie = Array.isArray(rawCookie) ? rawCookie.join("; ") : rawCookie;
  if (!cookie) return undefined;
  for (const part of cookie.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) return decodeURIComponent(rawValue.join("="));
  }
  return undefined;
}

async function readAuthSession(request: FastifyRequest) {
  const token = readBearerToken(request);
  if (!token) return null;
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true }
  });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await prisma.authSession.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  await prisma.authSession.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  return session;
}

function sameUserOperation(left: SerializedUserOperation, right: SerializedUserOperation) {
  return (
    left.sender.toLowerCase() === right.sender.toLowerCase() &&
    left.nonce === right.nonce &&
    left.initCode.toLowerCase() === right.initCode.toLowerCase() &&
    left.callData.toLowerCase() === right.callData.toLowerCase() &&
    left.accountGasLimits.toLowerCase() === right.accountGasLimits.toLowerCase() &&
    left.preVerificationGas === right.preVerificationGas &&
    left.gasFees.toLowerCase() === right.gasFees.toLowerCase() &&
    left.paymasterAndData.toLowerCase() === right.paymasterAndData.toLowerCase()
  );
}

async function requireAuthenticatedActor(request: FastifyRequest, reply: FastifyReply, actorId: string) {
  const session = await readAuthSession(request);
  if (session) {
    if (session.userId !== actorId) {
      reply.code(403).send({ error: "Authenticated session does not match the requested actor" });
      return null;
    }
    return session.userId;
  }
  if (!config.requireAuth) return actorId;
  reply.code(401).send({ error: "Authentication required" });
  return null;
}

function matchesQuestionTypes(policyTypes: string[], topicIds: string[]) {
  const normalizedTopics = topicIds.map((topic) => topic.toLowerCase());
  return policyTypes.some((type) => {
    const normalized = type.toLowerCase();
    return normalized === "*" || normalized === "all" || normalizedTopics.includes(normalized);
  });
}

function matchesCredentialSchemas(policySchemas: string[], credentialSchemaId: string) {
  return policySchemas.some((schemaId) => schemaId === "*" || schemaId === credentialSchemaId);
}

function authorityRank(authorityLevel: string) {
  return AUTHORITY_RANK[normalizeAuthority(authorityLevel)];
}

function normalizeAuthority(authorityLevel: string): keyof typeof AUTHORITY_RANK {
  if (authorityLevel === "Recognized" || authorityLevel === "Binding") return authorityLevel;
  return "Advisory";
}

function normalizePollResultMode(resultMode: string | null | undefined): PollResultMode {
  if (resultMode === "PeopleVote" || resultMode === "CommunitiesSignal") return resultMode;
  return "ShowBoth";
}

function buildCommunityPath(parent: { path: string; slug: string } | null | undefined, slug: string) {
  const parentPath = parent?.path || parent?.slug || "";
  return parentPath ? `${parentPath}/${slug}` : slug;
}

function defaultRegistryPolicyView(community: { id: string; createdBy: string }) {
  return {
    id: `registry-policy-default-${community.id}`,
    communityId: community.id,
    ...DEFAULT_REGISTRY_POLICY,
    status: "Active",
    createdBy: community.createdBy,
    createdAt: new Date(0),
    updatedAt: new Date(0)
  };
}

function strongerCommunityRole(left: string | null | undefined, right: string) {
  const current = COMMUNITY_ROLE_RANK[(left ?? "Member") as keyof typeof COMMUNITY_ROLE_RANK] ?? COMMUNITY_ROLE_RANK.Member;
  const next = COMMUNITY_ROLE_RANK[right as keyof typeof COMMUNITY_ROLE_RANK] ?? COMMUNITY_ROLE_RANK.Member;
  return next > current ? right : left ?? "Member";
}

async function upsertMembershipWithSource(
  client: Pick<Prisma.TransactionClient, "communityMember" | "communityMembershipSource">,
  input: {
    communityId: string;
    userId: string;
    role: "Owner" | "Moderator" | "Member";
    sourceType: string;
    sourceKey: string;
    sourceCommunityId?: string | null;
  }
) {
  const existing = await client.communityMember.findUnique({
    where: { communityId_userId: { communityId: input.communityId, userId: input.userId } }
  });
  const membership = await client.communityMember.upsert({
    where: { communityId_userId: { communityId: input.communityId, userId: input.userId } },
    update: {
      status: "Active",
      role: strongerCommunityRole(existing?.role, input.role) as "Owner" | "Moderator" | "Member"
    },
    create: {
      id: `member-${nanoid(10)}`,
      communityId: input.communityId,
      userId: input.userId,
      role: input.role,
      status: "Active"
    }
  });
  await client.communityMembershipSource.upsert({
    where: {
      communityId_userId_sourceKey: {
        communityId: input.communityId,
        userId: input.userId,
        sourceKey: input.sourceKey
      }
    },
    update: { status: "Active", sourceType: input.sourceType, sourceCommunityId: input.sourceCommunityId ?? null },
    create: {
      id: `membership-source-${nanoid(10)}`,
      communityId: input.communityId,
      userId: input.userId,
      sourceType: input.sourceType,
      sourceKey: input.sourceKey,
      sourceCommunityId: input.sourceCommunityId ?? null,
      status: "Active"
    }
  });
  return membership;
}

async function ancestorCommunities(
  client: Pick<Prisma.TransactionClient, "community"> | typeof prisma,
  communityId: string
) {
  const ancestors: Array<{ id: string; parentId: string | null; path: string; slug: string; depth: number }> = [];
  const seen = new Set<string>();
  let current = await client.community.findUnique({
    where: { id: communityId },
    select: { parentId: true }
  });
  while (current?.parentId && !seen.has(current.parentId)) {
    seen.add(current.parentId);
    const parent = await client.community.findUnique({
      where: { id: current.parentId },
      select: { id: true, parentId: true, path: true, slug: true, depth: true }
    });
    if (!parent) break;
    ancestors.push(parent);
    current = parent;
  }
  return ancestors;
}

async function propagateMembershipToAncestors(client: Prisma.TransactionClient, joinedCommunityId: string, userId: string) {
  const ancestors = await ancestorCommunities(client, joinedCommunityId);
  for (const ancestor of ancestors) {
    await upsertMembershipWithSource(client, {
      communityId: ancestor.id,
      userId,
      role: "Member",
      sourceType: "ChildCommunity",
      sourceKey: `child:${joinedCommunityId}`,
      sourceCommunityId: joinedCommunityId
    });
  }
}

async function propagateChildMembershipsToAncestors(client: Prisma.TransactionClient, childCommunityId: string) {
  const childMembers = await client.communityMember.findMany({
    where: { communityId: childCommunityId, status: "Active" },
    select: { userId: true }
  });
  for (const member of childMembers) {
    await propagateMembershipToAncestors(client, childCommunityId, member.userId);
  }
}

async function childProposalTally(proposal: { id?: string; parentId: string; thresholdPercent: number; quorumPercent: number; votes?: Array<{ vote: string }> }) {
  const [memberCount, votes] = await Promise.all([
    prisma.communityMember.count({ where: { communityId: proposal.parentId, status: "Active" } }),
    "votes" in proposal && proposal.votes
      ? Promise.resolve(proposal.votes)
      : prisma.communityChildProposalVote.findMany({ where: { proposalId: proposal.id ?? "__none__" } })
  ]);
  const support = votes.filter((vote) => vote.vote === "Support").length;
  const oppose = votes.filter((vote) => vote.vote === "Oppose").length;
  const total = support + oppose;
  const supportPercent = total ? Math.round((support / total) * 100) : 0;
  const quorumPercent = memberCount ? Math.round((total / memberCount) * 100) : 0;
  return {
    support,
    oppose,
    total,
    eligibleMembers: memberCount,
    supportPercent,
    quorumPercent,
    requiredThresholdPercent: proposal.thresholdPercent,
    requiredQuorumPercent: proposal.quorumPercent,
    thresholdMet: total > 0 && supportPercent >= proposal.thresholdPercent,
    quorumMet: proposal.quorumPercent === 0 || quorumPercent >= proposal.quorumPercent
  };
}

async function approveChildProposal(proposalId: string, actorId: string, status: "Approved" | "ApprovedByMembers", reason: string) {
  const proposal = await prisma.communityChildProposal.findUnique({ where: { id: proposalId } });
  if (!proposal) throw new Error("Child proposal not found");
  if (proposal.status !== "Pending" && proposal.status !== "Approved") throw new Error("Child proposal is already resolved");
  const resolutionHash = hashJson({ proposalId, ruling: status, reason });
  const approved = await prisma.$transaction(async (tx) => {
    await tx.community.update({ where: { id: proposal.proposedCommunityId }, data: { registryStatus: "Active" } });
    const updated = await tx.communityChildProposal.update({
      where: { id: proposal.id },
      data: { status, approvedBy: actorId, resolutionHash, resolvedAt: new Date() },
      include: { votes: true }
    });
    await propagateChildMembershipsToAncestors(tx, proposal.proposedCommunityId);
    return updated;
  });
  return { proposal: approved, tally: await childProposalTally(approved) };
}

async function buildCommunityBlockResult(input: {
  communityId: string | null;
  resultMode: PollResultMode;
  ballots: Array<{
    representedCommunityId: string | null;
    encryptedPayloadJson: string;
  }>;
  answerSchema: ReturnType<typeof getAnswerSchema>;
  tallyPrivateKeyPem: string;
  privacyThreshold: number;
}) {
  const directChildren = input.communityId
    ? await prisma.community.findMany({
        where: { parentId: input.communityId, registryStatus: "Active" },
        orderBy: { name: "asc" },
        select: { id: true, slug: true, name: true, path: true }
      })
    : [];
  const childrenById = new Map(directChildren.map((child) => [child.id, child]));
  const grouped = new Map<string, EncryptedBallotPayload[]>();
  for (const ballot of input.ballots) {
    if (!ballot.representedCommunityId || !childrenById.has(ballot.representedCommunityId)) continue;
    const payload = JSON.parse(ballot.encryptedPayloadJson) as EncryptedBallotPayload;
    grouped.set(ballot.representedCommunityId, [...(grouped.get(ballot.representedCommunityId) ?? []), payload]);
  }

  const signals: Array<{
    communityId: string;
    slug: string;
    name: string;
    path: string;
    turnout: number;
    primaryChoice: string | null;
    aggregate: unknown;
    counts: Record<string, number>;
  }> = [];
  const hiddenCommunities: Array<{ communityId: string; slug: string; turnout: number; reason: string }> = [];
  const blockCounts: Record<string, number> = {};

  for (const [communityId, payloads] of grouped) {
    const child = childrenById.get(communityId);
    if (!child) continue;
    const tally = tallyEncryptedBallots(payloads, input.tallyPrivateKeyPem, input.answerSchema);
    if (tally.turnout < input.privacyThreshold) {
      hiddenCommunities.push({
        communityId,
        slug: child.slug,
        turnout: tally.turnout,
        reason: "Below privacy threshold"
      });
      continue;
    }
    const primaryChoice = primaryChoiceFromCounts(tally.counts);
    if (primaryChoice) blockCounts[primaryChoice] = (blockCounts[primaryChoice] ?? 0) + 1;
    signals.push({
      communityId,
      slug: child.slug,
      name: child.name,
      path: child.path,
      turnout: tally.turnout,
      primaryChoice,
      aggregate: tally.aggregate,
      counts: tally.counts
    });
  }

  return {
    schemaVersion: "community-block-result-v0",
    resultMode: input.resultMode,
    parentCommunityId: input.communityId,
    eligibleDirectChildCommunityIds: directChildren.map((child) => child.id),
    representedCommunityCount: grouped.size,
    publishedSignalCount: signals.length,
    hiddenSignalCount: hiddenCommunities.length,
    privacyThreshold: input.privacyThreshold,
    blockCounts,
    signals,
    hiddenCommunities,
    rule: "One person casts one ballot per poll and may attribute it to one direct child community they belong to."
  };
}

function primaryChoiceFromCounts(counts: Record<string, number>) {
  let winner: string | null = null;
  let winnerCount = Number.NEGATIVE_INFINITY;
  for (const [choice, count] of Object.entries(counts)) {
    if (count > winnerCount) {
      winner = choice;
      winnerCount = count;
    }
  }
  return winnerCount > 0 ? winner : null;
}

async function questionFeedWhere(communityId: string | undefined, userId: string | undefined, reply: FastifyReply) {
  const readableWhere = readableQuestionWhere(userId);
  if (communityId) {
    const community = await prisma.community.findUnique({
      where: { id: communityId },
      include: { memberships: true }
    });
    if (!community) {
      reply.code(404).send({ error: "Community not found" });
      return undefined;
    }
    if (community.visibility === "Private" && !community.memberships.some((member) => member.userId === userId && member.status === "Active")) {
      const publicQuestionCount = await prisma.question.count({ where: { communityId, audience: "Public" } });
      if (!publicQuestionCount) {
        reply.code(403).send({ error: "Join this private community to view its questions" });
        return undefined;
      }
    }
    return { AND: [{ communityId }, readableWhere] };
  }

  return readableWhere;
}

async function canReadCommunity(communityId: string | null, userId: string | undefined) {
  if (!communityId) return true;
  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: { visibility: true }
  });
  if (!community) return false;
  if (community.visibility === "Public") return true;
  if (!userId) return false;
  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
    select: { status: true }
  });
  return membership?.status === "Active";
}

async function canReadArtifact(kind: string, hash: string, userId: string | undefined) {
  if (PUBLIC_ARTIFACT_KINDS.has(kind)) return true;
  if (!COMMUNITY_GATED_ARTIFACT_KINDS.has(kind)) return false;

  const question = await prisma.question.findFirst({
    where: {
      OR: [
        { bodyHash: hash },
        { sponsorDisclosureHash: hash },
        { archiveRecord: { is: { archiveHash: hash } } },
        { challenges: { some: { OR: [{ evidenceHash: hash }, { resolutionHash: hash }] } } },
        { challengeAppeals: { some: { OR: [{ appealHash: hash }, { resolutionHash: hash }] } } },
        { discussionPosts: { some: { bodyHash: hash } } },
        { moderationRecords: { some: { reasonHash: hash } } }
      ]
    },
    select: { id: true, proposer: true, communityId: true, audience: true }
  });
  if (question) return canReadQuestion(question, userId);

  const resultChallenge = await prisma.resultChallenge.findFirst({
    where: { OR: [{ evidenceHash: hash }, { resolutionHash: hash }] },
    select: { poll: { select: { question: { select: { id: true, proposer: true, communityId: true, audience: true } } } } }
  });
  if (resultChallenge) return canReadQuestion(resultChallenge.poll.question, userId);

  const moderationAppeal = await prisma.discussionModerationAppeal.findFirst({
    where: { OR: [{ appealHash: hash }, { resolutionHash: hash }] },
    select: { moderationRecord: { select: { question: { select: { id: true, proposer: true, communityId: true, audience: true } } } } }
  });
  if (moderationAppeal) return canReadQuestion(moderationAppeal.moderationRecord.question, userId);

  const consent = await prisma.dataUnionConsent.findFirst({
    where: { OR: [{ consentHash: hash }, { revokedHash: hash }] },
    select: { communityId: true, userId: true }
  });
  if (consent) return Boolean(userId && (userId === consent.userId || (await isActiveCommunityCurator(consent.communityId, userId))));

  return false;
}

async function effectiveViewerId(request: FastifyRequest) {
  const session = await readAuthSession(request);
  const { userId } = request.query as { userId?: string };
  return session?.userId ?? (!config.requireAuth ? userId : undefined);
}

async function redactRegistryEventsForViewer(events: RegistryEventView[], userId: string | undefined) {
  const visible: RegistryEventView[] = [];
  for (const event of events) {
    if (await canReadRegistryEvent(event, userId)) visible.push(event);
  }
  return visible;
}

async function canReadRegistryEvent(event: Pick<RegistryEventView, "subjectId" | "newHash">, userId: string | undefined) {
  const question = await prisma.question.findUnique({
    where: { id: event.subjectId },
    select: { id: true, proposer: true, communityId: true, audience: true }
  });
  if (question && !(await canReadQuestion(question, userId))) return false;

  const artifact = await prisma.artifact.findUnique({ where: { hash: event.newHash }, select: { kind: true } });
  if (artifact && !(await canReadArtifact(artifact.kind, event.newHash, userId))) return false;

  return true;
}

async function redactProtocolTransactionsForViewer(transactions: ProtocolTransactionReplayInput[], userId: string | undefined) {
  const visible: ProtocolTransactionReplayInput[] = [];
  for (const transaction of transactions) {
    const payload = isRecord(transaction.payload) ? transaction.payload : {};
    const newHash = typeof payload.newHash === "string" ? payload.newHash : null;
    if (!newHash || (await canReadRegistryEvent({ subjectId: transaction.subjectId, newHash }, userId))) visible.push(transaction);
  }
  return visible;
}

async function redactCommitmentsForViewer(commitments: CommitmentView[], userId: string | undefined) {
  const visible: CommitmentView[] = [];
  for (const commitment of commitments) {
    const payload = isRecord(commitment.payload) ? commitment.payload : {};
    const sourceEvent = isRecord(payload.sourceEvent) ? payload.sourceEvent : {};
    const subjectId = typeof sourceEvent.subjectId === "string" ? sourceEvent.subjectId : commitment.subjectId;
    const newHash = typeof sourceEvent.newHash === "string" ? sourceEvent.newHash : null;
    if (!newHash || (await canReadRegistryEvent({ subjectId, newHash }, userId))) visible.push(commitment);
  }
  return visible;
}

async function isActiveCommunityCurator(communityId: string, userId: string) {
  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
    select: { status: true, role: true }
  });
  return membership?.status === "Active" && CURATOR_ROLES.includes(membership.role);
}

async function canReadQuestion(question: QuestionAccessRecord, userId: string | undefined) {
  const audience = normalizeQuestionAudience(question.audience);
  if (audience === "Public") return true;
  if (!userId) return false;
  if (question.proposer === userId) return true;
  if (!question.communityId) return false;
  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: question.communityId, userId } },
    select: { status: true }
  });
  if (membership?.status === "Active") return true;
  if (audience !== "Followers") return false;
  const follow = await prisma.communityFollow.findUnique({
    where: { communityId_userId: { communityId: question.communityId, userId } },
    select: { id: true }
  });
  return Boolean(follow);
}

function normalizeQuestionAudience(audience: string | null | undefined): QuestionAudience {
  if (audience === "Followers" || audience === "Members") return audience;
  return "Public";
}

function audienceLabel(audience: string | null | undefined) {
  const normalized = normalizeQuestionAudience(audience);
  if (normalized === "Followers") return "followers";
  if (normalized === "Members") return "members";
  return "everyone";
}

async function recordActivity(client: Pick<Prisma.TransactionClient, "activityFeedItem">, input: ActivityRecordInput) {
  const audience = normalizeQuestionAudience(input.audience);
  const activityHash = hashJson({
    protocol: "pc-activity-v0",
    actorId: input.actorId,
    activityType: input.activityType,
    questionId: input.questionId ?? null,
    communityId: input.communityId ?? null,
    targetCommunityId: input.targetCommunityId ?? null,
    audience,
    shellText: input.shellText
  });
  return client.activityFeedItem.create({
    data: {
      id: `activity-${nanoid(10)}`,
      actorId: input.actorId,
      activityType: input.activityType,
      questionId: input.questionId ?? null,
      communityId: input.communityId ?? null,
      targetCommunityId: input.targetCommunityId ?? input.communityId ?? null,
      audience,
      shellText: input.shellText,
      activityHash
    }
  });
}

async function toQuestionFeedItem<T extends QuestionAccessRecord & { title: string; answerSchemaId: string; createdAt: Date; community?: { slug: string; kind: string } | null }>(
  question: T,
  userId: string | undefined
) {
  const canRead = await canReadQuestion(question, userId);
  return {
    id: `question:${question.id}`,
    itemType: "question",
    visibility: canRead ? "full" : "redacted",
    createdAt: question.createdAt,
    question: canRead ? enrichQuestion(question) : null,
    shellText: canRead ? `${targetNameForQuestion(question)} asked: ${question.title}` : `A ${audienceLabel(question.audience)} question is active in ${targetNameForQuestion(question)}.`,
    lockedReason: canRead ? null : "Follow or join this community to see the full question."
  };
}

async function toActivityFeedItem<
  TActivity extends {
    id: string;
    actorId: string;
    activityType: string;
    questionId: string | null;
    communityId: string | null;
    targetCommunityId: string | null;
    audience: string;
    shellText: string;
    activityHash: string;
    createdAt: Date;
  },
  TQuestion extends QuestionAccessRecord & { answerSchemaId: string; createdAt: Date } & Record<string, unknown>
>(activity: TActivity, question: TQuestion | undefined, userId: string | undefined) {
  if (!(await canReadActivityShell(activity, userId))) return null;
  const canReadLinkedQuestion = question ? await canReadQuestion(question, userId) : false;
  return {
    id: `activity:${activity.id}`,
    itemType: "activity",
    activityType: activity.activityType,
    visibility: canReadLinkedQuestion ? "full" : "shell",
    createdAt: activity.createdAt,
    actorId: activity.actorId,
    shellText: activity.shellText,
    activityHash: activity.activityHash,
    question: question && canReadLinkedQuestion ? enrichQuestion(question) : null,
    lockedReason: question && !canReadLinkedQuestion ? "The action is visible, but the question details are private." : null
  };
}

async function canReadActivityShell(activity: ActivityRecordInput & { audience?: string | null }, userId: string | undefined) {
  const audience = normalizeQuestionAudience(activity.audience);
  if (audience === "Public") return true;
  if (!userId) return false;
  if (activity.actorId === userId) return true;
  const targetCommunityId = activity.targetCommunityId ?? activity.communityId ?? null;
  if (!targetCommunityId) return false;
  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: targetCommunityId, userId } },
    select: { status: true }
  });
  if (membership?.status === "Active") return true;
  if (audience !== "Followers") return false;
  const follow = await prisma.communityFollow.findUnique({
    where: { communityId_userId: { communityId: targetCommunityId, userId } },
    select: { id: true }
  });
  return Boolean(follow);
}

function targetNameForQuestion(question: { community?: { slug: string; kind: string } | null }) {
  if (!question.community) return "the public feed";
  return question.community.kind === "Profile" ? `@${question.community.slug.replace(/^user-/, "")}` : `p/${question.community.slug}`;
}

type ProductionSliceBuildResult =
  | { ok: true; input: ProductionSliceVerificationInput }
  | { ok: false; reasons: string[] };

type ProductionSliceResultPublication = {
  tallyProofHash: string;
  artifactFields: Pick<
    ProductionSliceResultArtifact,
    | "questionVersionHash"
    | "aggregate"
    | "counts"
    | "aggregateCountsHash"
    | "acceptedBallotCommitments"
    | "acceptedBallotCommitmentsHash"
    | "tallyKeySetupHash"
    | "decryptionShareHashes"
    | "decryptionShareSetHash"
    | "acceptedDecryptionShareCount"
    | "tallyProofHash"
    | "privacyReportHash"
    | "turnout"
    | "invalidBallots"
    | "publishedAt"
    | "cryptoMode"
  >;
};

function buildProductionSliceEligibilityProof(proof: AnonymousBallotProof, signal: string): ProductionSliceEligibilityProof | null {
  const privateKeyPem = normalizeConfiguredPem(config.productionSliceProofVerifierPrivateKeyPem);
  const publicKeyPem = normalizeConfiguredPem(config.productionSliceProofVerifierPublicKeyPem);
  if (!privateKeyPem || !publicKeyPem) return null;
  const proofWithoutSignature: Omit<ProductionSliceEligibilityProof, "proofHash" | "verifierSignature"> = {
    protocol: "popular-consensus",
    schemaVersion: "production-slice-eligibility-proof-v1",
    proofSystem: PRODUCTION_SLICE_PROOF_SYSTEM,
    groupId: proof.groupId,
    groupRoot: proof.groupRoot,
    signal,
    scope: proof.scope,
    nullifier: proof.nullifier,
    publicInputsHash: eligibilityProofPublicInputsHash({
      groupRoot: proof.groupRoot,
      signal,
      scope: proof.scope,
      nullifier: proof.nullifier
    }),
    verifier: "@semaphore-protocol/core.verifyProof",
    verifierPublicKeyPem: publicKeyPem,
    verificationStatus: "Verified"
  };
  const proofHash = eligibilityProofHash(proofWithoutSignature);
  return {
    ...proofWithoutSignature,
    proofHash,
    verifierSignature: signEd25519(privateKeyPem, eligibilityProofVerificationPayload({ ...proofWithoutSignature, proofHash }))
  };
}

async function buildProductionSliceResultPublication(input: {
  artifactStore: ArtifactStorageAdapter;
  poll: {
    id: string;
    tallyPublicKeyId: string;
    ballots: Array<{ ballotCommitment: string; eligibilityProofArtifactHash?: string | null }>;
    question: {
      id: string;
      version: number;
      title: string;
      bodyHash: string;
      sponsorDisclosureHash: string | null;
      answerSchemaId: string;
      credentialSchemaId: string;
      communityId: string | null;
      methodologyLabel: string;
      authorityLevel: string;
    };
    tallyKeySetup: TallyKeySetupView | null;
    decryptionShares: TallyDecryptionShareView[];
  };
  aggregate: Record<string, unknown>;
  counts: Record<string, number>;
  aggregateCountsHash: string;
  acceptedBallotCommitmentsHash: string;
  privacyReportHash: string;
  turnout: number;
  invalidBallots: number;
  publishedAt: number;
}): Promise<ProductionSliceResultPublication | null> {
  if (!input.poll.tallyKeySetup) return null;
  if (input.poll.ballots.length === 0 || input.poll.ballots.some((ballot) => !ballot.eligibilityProofArtifactHash)) return null;
  const question = productionSliceQuestionFromRecord(input.poll.question);
  if (!question) return null;
  const tallyKeySetup = await productionSliceTallyKeySetupFromRecord(input.artifactStore, input.poll.id, input.poll.tallyKeySetup);
  if (!tallyKeySetup) return null;
  const acceptedShares: ProductionSliceTallyDecryptionShare[] = [];
  for (const share of input.poll.decryptionShares.filter((candidate) => candidate.status === "Accepted")) {
    const productionShare = await productionSliceDecryptionShareFromRecord(input.artifactStore, share);
    if (!productionShare) return null;
    if (productionShare.ballotCommitmentsHash !== input.acceptedBallotCommitmentsHash) return null;
    if (productionShare.aggregateCountsHash !== input.aggregateCountsHash) return null;
    acceptedShares.push(productionShare);
  }
  if (acceptedShares.length < tallyKeySetup.threshold) return null;
  const decryptionShareHashes = sortedStrings(acceptedShares.map((share) => share.shareHash));
  const decryptionShareSetHash = hashJson(decryptionShareHashes);
  const tallyProofHash = productionSliceTallyPublicationProofHash({
    pollId: input.poll.id,
    aggregateCountsHash: input.aggregateCountsHash,
    acceptedBallotCommitmentsHash: input.acceptedBallotCommitmentsHash,
    tallyKeySetupHash: tallyKeySetup.ceremonyHash,
    decryptionShareHashes
  });
  return {
    tallyProofHash,
    artifactFields: {
      questionVersionHash: question.versionHash,
      aggregate: input.aggregate,
      counts: input.counts,
      aggregateCountsHash: input.aggregateCountsHash,
      acceptedBallotCommitments: sortedStrings(input.poll.ballots.map((ballot) => ballot.ballotCommitment)),
      acceptedBallotCommitmentsHash: input.acceptedBallotCommitmentsHash,
      tallyKeySetupHash: tallyKeySetup.ceremonyHash,
      decryptionShareHashes,
      decryptionShareSetHash,
      acceptedDecryptionShareCount: acceptedShares.length,
      tallyProofHash,
      privacyReportHash: input.privacyReportHash,
      turnout: input.turnout,
      invalidBallots: input.invalidBallots,
      publishedAt: input.publishedAt,
      cryptoMode: PRODUCTION_SLICE_CRYPTO_MODE
    }
  };
}

async function buildProductionSliceVerificationInput(questionId: string, artifactStore: ArtifactStorageAdapter): Promise<ProductionSliceBuildResult> {
  const reasons: string[] = [];
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      poll: {
        include: {
          result: true,
          ballots: { orderBy: { submittedAt: "asc" } },
          decryptionShares: { select: TALLY_DECRYPTION_SHARE_PUBLIC_SELECT, orderBy: { submittedAt: "asc" } },
          tallyKeySetup: { select: TALLY_KEY_SETUP_PUBLIC_SELECT },
          resultChallenges: { orderBy: { createdAt: "asc" } }
        }
      },
      archiveRecord: true
    }
  });
  if (!question) return { ok: false, reasons: ["question-not-found"] };
  if (!question.poll) return { ok: false, reasons: ["poll-missing"] };
  if (!question.poll.result) reasons.push("result-missing");
  if (!question.archiveRecord) reasons.push("archive-missing");
  if (!question.poll.anonymousEligibilityGroupId) reasons.push("anonymous-eligibility-group-missing");
  if (!question.poll.tallyKeySetup) reasons.push("tally-key-setup-missing");
  if (reasons.length > 0) return { ok: false, reasons };

  const [credentialSchema, group, archiveArtifact, initialEvents] = await Promise.all([
    prisma.credentialSchema.findUnique({ where: { id: question.poll.credentialSchemaId } }),
    prisma.anonymousEligibilityGroup.findUnique({ where: { id: question.poll.anonymousEligibilityGroupId! } }),
    artifactStore.read<{ artifactManifest?: ArtifactManifest }>(question.archiveRecord!.archiveHash).catch(() => null),
    prisma.registryEvent.findMany({
      where: {
        subjectId: {
          in: uniqueStrings([question.id, question.poll.id, question.communityId, question.poll.anonymousEligibilityGroupId].filter((value): value is string => Boolean(value)))
        }
      },
      orderBy: REGISTRY_EVENT_ORDER
    })
  ]);
  if (!credentialSchema || credentialSchema.status !== "Active") reasons.push("credential-schema-not-active");
  if (!group || group.status !== "Active") reasons.push("anonymous-eligibility-group-not-active");
  if (!archiveArtifact?.artifactManifest) reasons.push("archive-manifest-missing");
  if (reasons.length > 0) return { ok: false, reasons };
  const issuerEvents = await prisma.registryEvent.findMany({ where: { subjectId: group!.issuerId }, orderBy: REGISTRY_EVENT_ORDER });
  const events = [...initialEvents, ...issuerEvents].sort((left, right) => {
    const emitted = left.emittedAt.getTime() - right.emittedAt.getTime();
    return emitted !== 0 ? emitted : left.id.localeCompare(right.id);
  });

  const issuer = await prisma.credentialIssuer.findUnique({ where: { id: group!.issuerId } });
  if (!issuer || issuer.status !== "Active" || !issuer.schemaIds.includes(credentialSchema!.id)) reasons.push("credential-issuer-not-active-for-schema");
  const trustPolicies = await prisma.communityCredentialTrustPolicy.findMany({
    where: {
      communityId: question.communityId ?? "",
      status: "Active",
      credentialSchemaId: { in: [credentialSchema!.id, "*"] }
    },
    orderBy: { createdAt: "desc" }
  });
  const trustPolicyRecord = trustPolicies.find((policy) => policy.credentialSchemaId === credentialSchema!.id) ?? trustPolicies[0] ?? null;
  if (!trustPolicyRecord) reasons.push("credential-trust-policy-missing");
  if (trustPolicyRecord && !productionSliceTrustPolicyAllows(trustPolicyRecord, { schemaId: credentialSchema!.id, issuerId: issuer?.id ?? "" })) {
    reasons.push("credential-trust-policy-does-not-allow-issuer");
  }
  if (reasons.length > 0) return { ok: false, reasons };

  const bundle = await artifactStore.buildExportBundle(archiveArtifact!.artifactManifest!, {
    kind: "question-archive",
    hash: question.archiveRecord!.archiveHash,
    role: "archive"
  });
  const resultArtifactEntry = bundle.artifacts.find((artifact) => artifact.kind === "result-artifact" && artifact.hash === question.poll!.result!.resultArtifactHash);
  const resultArtifact = isRecord(resultArtifactEntry?.value) ? (resultArtifactEntry.value as Partial<ProductionSliceResultArtifact>) : null;
  if (!resultArtifact || resultArtifact.cryptoMode !== PRODUCTION_SLICE_CRYPTO_MODE) reasons.push("production-result-artifact-missing");

  const productionQuestion = productionSliceQuestionFromRecord(question);
  if (!productionQuestion) reasons.push("question-shape-unsupported");
  const productionTallyKeySetup = await productionSliceTallyKeySetupFromRecord(artifactStore, question.poll.id, question.poll.tallyKeySetup!);
  if (!productionTallyKeySetup) reasons.push("production-tally-key-setup-missing-member-public-keys");

  const ballots: ProductionSliceBallot[] = [];
  for (const ballot of question.poll.ballots) {
    const productionBallot = await productionSliceBallotFromRecord(artifactStore, ballot, credentialSchema!.id, issuer!.id);
    if (!productionBallot) reasons.push(`ballot-production-evidence-missing:${ballot.id}`);
    else ballots.push(productionBallot);
  }
  const decryptionShares: ProductionSliceTallyDecryptionShare[] = [];
  for (const share of question.poll.decryptionShares) {
    const productionShare = await productionSliceDecryptionShareFromRecord(artifactStore, share);
    if (!productionShare) reasons.push(`decryption-share-production-evidence-missing:${share.id}`);
    else decryptionShares.push(productionShare);
  }
  if (reasons.length > 0 || !productionQuestion || !productionTallyKeySetup || !resultArtifact) return { ok: false, reasons };

  const pollOpened = events.find((event) => event.eventType === "PollOpened");
  const pollClosed = events.find((event) => event.eventType === "PollClosed");
  const resultFinalized = events.find((event) => event.eventType === "ResultFinalized");
  const trustPolicyWithoutHash: Omit<ProductionSliceTrustPolicy, "policyHash"> = {
    id: trustPolicyRecord!.id,
    communityId: trustPolicyRecord!.communityId,
    credentialSchemaId: trustPolicyRecord!.credentialSchemaId,
    trustedIssuerIds: trustPolicyRecord!.trustedIssuerIds,
    mode: trustPolicyRecord!.mode === "Open" ? "Open" : "AllowList",
    status: "Active"
  };
  const result: ProductionSliceResult = {
    id: question.poll.result!.id,
    pollId: question.poll.id,
    questionId: question.id,
    resultArtifactHash: question.poll.result!.resultArtifactHash,
    aggregateCountsHash: stringOrUnsupported(resultArtifact.aggregateCountsHash, reasons, "result-aggregate-counts-hash-missing"),
    tallyProofHash: stringOrUnsupported(resultArtifact.tallyProofHash, reasons, "result-tally-proof-hash-missing"),
    privacyReportHash: stringOrUnsupported(resultArtifact.privacyReportHash, reasons, "result-privacy-report-hash-missing"),
    turnout: numberOrUnsupported(resultArtifact.turnout, reasons, "result-turnout-missing"),
    invalidBallots: numberOrUnsupported(resultArtifact.invalidBallots, reasons, "result-invalid-ballots-missing"),
    finalStatus: normalizeProductionResultStatus(question.poll.result!.finalStatus),
    publishedAt: timeMs(question.poll.result!.publishedAt),
    challengeWindowEndsAt: timeMs(question.poll.resultChallengeEndsAt),
    finalizedAt: resultFinalized ? timeMs(resultFinalized.emittedAt) : timeMs(question.archiveRecord!.createdAt)
  };
  const input: ProductionSliceVerificationInput = {
    protocol: "popular-consensus",
    schemaVersion: "production-slice-input-v1",
    generatedAt: Date.now(),
    credentialSchema: {
      id: credentialSchema!.id,
      status: credentialSchema!.status as ProductionSliceCredentialSchema["status"],
      revocationRoot: credentialSchema!.revocationRoot
    },
    credentialIssuer: {
      id: issuer!.id,
      status: issuer!.status as ProductionSliceCredentialIssuer["status"],
      schemaIds: issuer!.schemaIds,
      metadataHash: issuer!.metadataHash
    },
    trustPolicy: {
      ...trustPolicyWithoutHash,
      policyHash: productionSliceCredentialTrustPolicyHash(trustPolicyWithoutHash)
    },
    question: productionQuestion,
    poll: {
      id: question.poll.id,
      questionId: question.id,
      credentialSchemaId: question.poll.credentialSchemaId,
      tallyPublicKeyId: question.poll.tallyPublicKeyId,
      status: question.poll.status === "Closed" ? "Closed" : "ResultPublished",
      openedAt: pollOpened ? timeMs(pollOpened.emittedAt) : timeMs(question.poll.createdAt),
      closedAt: pollClosed ? timeMs(pollClosed.emittedAt) : timeMs(question.poll.createdAt)
    } satisfies ProductionSlicePoll,
    tallyKeySetup: productionTallyKeySetup,
    ballots,
    decryptionShares,
    result,
    challenges: question.poll.resultChallenges.map((challenge) => productionSliceChallengeFromRecord(challenge)),
    archive: {
      id: question.archiveRecord!.id,
      questionId: question.id,
      archiveHash: question.archiveRecord!.archiveHash,
      artifactManifestHash: bundle.manifestHash,
      archivedAt: timeMs(question.archiveRecord!.createdAt)
    },
    events: events.map((event) => ({
      eventType: event.eventType,
      subjectId: event.subjectId,
      actor: event.actor,
      previousHash: event.previousHash,
      newHash: event.newHash,
      emittedAt: timeMs(event.emittedAt)
    })),
    bundle
  };
  return reasons.length > 0 ? { ok: false, reasons } : { ok: true, input };
}

async function productionSliceBallotFromRecord(
  artifactStore: ArtifactStorageAdapter,
  ballot: {
    id: string;
    pollId: string;
    questionId: string;
    nullifier: string;
    ballotCommitment: string;
    encryptedPayloadHash: string;
    encryptedPayloadJson: string;
    proofHash: string;
    proofSystem: string;
    eligibilityProofArtifactHash?: string | null;
    submittedAt: Date | string | number;
  },
  credentialSchemaId: string,
  issuerId: string
): Promise<ProductionSliceBallot | null> {
  if (ballot.proofSystem !== PRODUCTION_SLICE_PROOF_SYSTEM || !ballot.eligibilityProofArtifactHash) return null;
  const artifact = await artifactStore.read<Record<string, unknown>>(ballot.eligibilityProofArtifactHash).catch(() => null);
  if (!artifact || artifact.artifactKind !== "production-slice-eligibility-proof") return null;
  const eligibilityProof = artifact as unknown as ProductionSliceEligibilityProof;
  if (eligibilityProof.proofHash !== ballot.proofHash) return null;
  const encryptedPayload = JSON.parse(ballot.encryptedPayloadJson) as EncryptedBallotPayload;
  return {
    id: ballot.id,
    pollId: ballot.pollId,
    questionId: ballot.questionId,
    credentialSchemaId,
    issuerId,
    nullifier: ballot.nullifier,
    encryptedPayload,
    encryptedPayloadHash: ballot.encryptedPayloadHash,
    ballotCommitment: ballot.ballotCommitment,
    proofHash: ballot.proofHash,
    proofSystem: PRODUCTION_SLICE_PROOF_SYSTEM,
    eligibilityProofArtifactHash: ballot.eligibilityProofArtifactHash,
    eligibilityProof,
    submittedAt: timeMs(ballot.submittedAt)
  };
}

async function productionSliceDecryptionShareFromRecord(
  artifactStore: ArtifactStorageAdapter,
  share: TallyDecryptionShareView
): Promise<ProductionSliceTallyDecryptionShare | null> {
  const artifact = await artifactStore.read<Record<string, unknown>>(share.artifactHash).catch(() => null);
  const productionSlice = isRecord(artifact?.productionSlice) ? artifact.productionSlice : null;
  if (!productionSlice) return null;
  const ballotCommitmentsHash = optionalString(productionSlice.ballotCommitmentsHash);
  const aggregateCountsHash = optionalString(productionSlice.aggregateCountsHash);
  const signature = optionalString(productionSlice.signature);
  if (!ballotCommitmentsHash || !aggregateCountsHash || !signature) return null;
  return {
    id: share.id,
    pollId: share.pollId,
    tallyKeySetupId: share.keySetupId,
    memberId: share.memberId,
    ballotCommitmentsHash,
    aggregateCountsHash,
    shareHash: share.shareHash,
    proofHash: share.proofHash,
    signature,
    status: share.status === "Rejected" ? "Rejected" : "Accepted",
    submittedAt: timeMs(share.submittedAt)
  };
}

async function productionSliceTallyKeySetupFromRecord(
  artifactStore: ArtifactStorageAdapter,
  pollId: string,
  setup: TallyKeySetupView
): Promise<ProductionSliceTallyKeySetup | null> {
  const artifact = await artifactStore.read<Record<string, unknown>>(setup.setupHash).catch(() => null);
  const memberPublicKeys = productionSliceMemberPublicKeysFromArtifact(artifact);
  if (!memberPublicKeys || setup.memberIds.some((memberId) => !memberPublicKeys.has(memberId))) return null;
  const withoutHash: Omit<ProductionSliceTallyKeySetup, "ceremonyHash"> = {
    id: setup.id,
    committeeId: setup.committeeId,
    pollId,
    publicKeyId: setup.publicKeyId,
    custodyModel: "threshold-ed25519-attested-decryption-v1",
    privateKeyMaterial: "not-exported",
    threshold: setup.threshold,
    members: setup.memberIds.map((memberId) => ({ memberId, publicKeyPem: memberPublicKeys.get(memberId)! }))
  };
  return { ...withoutHash, ceremonyHash: productionSliceTallyKeySetupHash(withoutHash) };
}

async function productionSliceMemberPublicKey(
  artifactStore: ArtifactStorageAdapter,
  setup: TallyKeySetupView,
  memberId: string
): Promise<string | null> {
  const artifact = await artifactStore.read<Record<string, unknown>>(setup.setupHash).catch(() => null);
  return productionSliceMemberPublicKeysFromArtifact(artifact)?.get(memberId) ?? null;
}

function productionSliceMemberPublicKeysFromArtifact(artifact: Record<string, unknown> | null): Map<string, string> | null {
  if (!artifact || !Array.isArray(artifact.memberPublicKeys)) return null;
  const entries = artifact.memberPublicKeys
    .filter(isRecord)
    .map((member) => [optionalString(member.memberId), optionalString(member.publicKeyPem)] as const)
    .filter((entry): entry is [string, string] => Boolean(entry[0] && entry[1]));
  return entries.length > 0 ? new Map(entries) : null;
}

function productionSliceQuestionFromRecord(question: {
  id: string;
  version: number;
  title: string;
  bodyHash: string;
  sponsorDisclosureHash: string | null;
  answerSchemaId: string;
  credentialSchemaId: string;
  communityId: string | null;
  methodologyLabel: string;
  authorityLevel: string;
  status?: string;
}): ProductionSliceQuestion | null {
  if (!question.communityId || !["Advisory", "Recognized", "Binding"].includes(question.authorityLevel)) return null;
  const withoutHash: Omit<ProductionSliceQuestion, "versionHash"> = {
    id: question.id,
    communityId: question.communityId,
    version: question.version,
    title: question.title,
    bodyHash: question.bodyHash,
    sponsorDisclosureHash: question.sponsorDisclosureHash ?? "",
    answerSchemaId: question.answerSchemaId,
    credentialSchemaId: question.credentialSchemaId,
    methodologyLabel: question.methodologyLabel,
    authorityLevel: question.authorityLevel as ProductionSliceQuestion["authorityLevel"],
    status: normalizeProductionQuestionStatus(question.status ?? "Archived")
  };
  return { ...withoutHash, versionHash: productionSliceQuestionVersionHash(withoutHash) };
}

function productionSliceChallengeFromRecord(challenge: {
  id: string;
  pollId: string;
  resultId: string;
  reasonCode: string;
  evidenceHash: string;
  ruling: string;
  resolutionHash: string | null;
}): ProductionSliceChallenge {
  return {
    id: challenge.id,
    pollId: challenge.pollId,
    resultId: challenge.resultId,
    reasonCode: challenge.reasonCode,
    evidenceHash: challenge.evidenceHash,
    ruling: ["Pending", "Sustained", "Rejected", "Remanded"].includes(challenge.ruling)
      ? (challenge.ruling as ProductionSliceChallenge["ruling"])
      : "Pending",
    resolutionHash: challenge.resolutionHash
  };
}

function productionSliceTrustPolicyAllows(policy: { credentialSchemaId: string; trustedIssuerIds: string[] }, credential: { schemaId: string; issuerId: string }) {
  if (policy.credentialSchemaId !== "*" && policy.credentialSchemaId !== credential.schemaId) return false;
  return policy.trustedIssuerIds.includes("*") || policy.trustedIssuerIds.includes(credential.issuerId);
}

function normalizeProductionQuestionStatus(status: string): ProductionSliceQuestion["status"] {
  if (status === "Finalized") return "Finalized";
  if (status === "ResultPublished") return "ResultPublished";
  return "Archived";
}

function normalizeProductionResultStatus(status: string): ProductionSliceResult["finalStatus"] {
  if (["Published", "Challenged", "Corrected", "Finalized"].includes(status)) return status as ProductionSliceResult["finalStatus"];
  return "Published";
}

function normalizeConfiguredPem(value: string | null): string | null {
  return value ? value.replace(/\\n/g, "\n") : null;
}

function stringOrUnsupported(value: unknown, reasons: string[], reason: string): string {
  if (typeof value === "string") return value;
  reasons.push(reason);
  return "";
}

function numberOrUnsupported(value: unknown, reasons: string[], reason: string): number {
  if (typeof value === "number") return value;
  reasons.push(reason);
  return 0;
}

function sortedStrings(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function timeMs(value: Date | string | number): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function enrichQuestion<T extends { answerSchemaId: string }>(question: T): T & { answerSchema: ReturnType<typeof getAnswerSchema> } {
  return { ...question, answerSchema: getAnswerSchema(question.answerSchemaId) };
}

function safeAnswerSchema(answerSchemaId: string) {
  try {
    return getAnswerSchema(answerSchemaId);
  } catch {
    return null;
  }
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `community-${nanoid(6)}`
  );
}

async function createProfileCommunityForUser(
  client: Prisma.TransactionClient,
  user: { id: string; username: string; displayName: string; bio?: string | null; profileCommunityId: string }
) {
  await client.community.create({
    data: {
      id: user.profileCommunityId,
      slug: profileCommunitySlug(user.username || user.id),
      name: user.displayName || user.username || user.id,
      description: user.bio || `${user.displayName || user.username || "This member"}'s personal question feed.`,
      kind: "Profile",
      path: profileCommunitySlug(user.username || user.id),
      depth: 0,
      registryStatus: "Active",
      profileUserId: user.id,
      visibility: "Public",
      credentialSchemaId: "credential-vancouver-resident",
      defaultAuthorityLevel: "Advisory",
      createdBy: user.id
    }
  });
  await client.communityMember.create({
    data: {
      id: `member-${user.profileCommunityId}-${user.id}`,
      communityId: user.profileCommunityId,
      userId: user.id,
      role: "Owner",
      status: "Active"
    }
  });
  await client.communityMembershipSource.create({
    data: {
      id: `membership-source-${nanoid(10)}`,
      communityId: user.profileCommunityId,
      userId: user.id,
      sourceType: "DirectJoin",
      sourceKey: `direct:${user.profileCommunityId}`,
      sourceCommunityId: user.profileCommunityId,
      status: "Active"
    }
  });
}

function profileCommunityIdForUser(userId: string) {
  return `community-profile-${userId.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase()}`;
}

function profileCommunitySlug(username: string) {
  return `user-${slugify(username).replace(/^community-/, "")}`;
}

function portableProfileId(userId: string) {
  return `did:pc:${userId}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void startServer();
}

async function startServer() {
  await ensureSeedData();
  const app = buildServer();
  await app.listen({ host: config.host, port: config.port });
}
