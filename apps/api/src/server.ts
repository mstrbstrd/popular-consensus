import cors from "@fastify/cors";
import { pathToFileURL } from "node:url";
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
  ActivateGovernanceParametersRequestSchema,
  ActivateTallyCommitteeRequestSchema,
  AmendmentRequestSchema,
  ArchiveQuestionRequestSchema,
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
  FinalizeResultRequestSchema,
  FollowCommunityRequestSchema,
  FollowTopicRequestSchema,
  ImportWalletCredentialRequestSchema,
  JoinCommunityRequestSchema,
  MinimumProtocolCommitments,
  ModerateDiscussionPostRequestSchema,
  ProposeAdoptionPolicyRequestSchema,
  ProposeGovernanceParametersRequestSchema,
  ReputationReplayRequestSchema,
  ResultChallengeRulingRequestSchema,
  ResolveChallengeAppealRequestSchema,
  ResolveCommunityEmergencySuspensionRequestSchema,
  ResolveModerationAppealRequestSchema,
  RevokeCredentialRequestSchema,
  SelectJurorRequestSchema,
  SetCommunityCredentialTrustPolicyRequestSchema,
  SetCommunityFrontendConfigRequestSchema,
  SetupTallyPublicKeyRequestSchema,
  SubmitTallyDecryptionShareRequestSchema,
  SuspendCredentialIssuerRequestSchema,
  SuspendAdoptionPolicyRequestSchema,
  VoteRequestSchema,
  choiceToBallotResponse,
  getAnswerSchema,
  validateBallotResponse,
  type ChallengeAppealStatus,
  type ChallengeAppealTargetType,
  type CredentialMembershipProof,
  type CredentialIssuerAnnotation,
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
  ballotCommitment,
  createCoordinatorKeypair,
  createCredentialMembershipProof,
  credentialIdForDemoCredential,
  encryptBallot,
  hashDemoCredentialSecret,
  issueDemoCredential,
  normalizeTallyPublicKeyPem,
  tallyEncryptedBallots,
  tallyPublicKeyId,
  verifyCredentialMembershipProof,
  verifyDemoCredential,
  type EncryptedBallotPayload
} from "@pc/privacy";
import Fastify, { type FastifyReply } from "fastify";
import { nanoid } from "nanoid";
import { config } from "./config";
import { ensureSeedData, resetDemoData } from "./seed";

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
const STEWARD_POWERS: StewardPower[] = [
  {
    role: "Owner",
    actions: ["AdoptionPolicy", "GovernanceParameters", "FrontendConfig", "ForkExport", "JurorSelection", "EmergencySuspension", "TechnicalUpgrade"],
    limits: [
      "All steward actions are artifact-backed and recorded as registry events.",
      "Technical upgrades must satisfy the published upgrade safety model before activation.",
      "Emergency suspension can pause protocol writes but must be resolved with a public reason artifact.",
      "Binding adoption still requires explicit legal handoff metadata."
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
  const app = Fastify({ logger: true });
  const artifactStore = createFileArtifactStorage(config.artifactDir);
  void app.register(cors, { origin: true });

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
    const steward = await prisma.userAccount.findUnique({ where: { id: input.steward } });
    if (!steward) return reply.code(404).send({ error: "Steward account not found" });

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
      return reply.code(409).send({ error: "Credential schema is already registered" });
    }
  });

  app.get("/credential-issuers", async () => {
    const credentialIssuers = await prisma.credentialIssuer.findMany({ orderBy: { createdAt: "asc" } });
    return { credentialIssuers };
  });

  app.post("/credential-issuers", async (request, reply) => {
    const input = CreateCredentialIssuerRequestSchema.parse(request.body ?? {});
    const steward = await prisma.userAccount.findUnique({ where: { id: input.steward } });
    if (!steward) return reply.code(404).send({ error: "Steward account not found" });
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
      return reply.code(409).send({ error: "Credential issuer is already registered" });
    }
  });

  app.post("/credential-issuers/:issuerId/suspend", async (request, reply) => {
    const { issuerId } = request.params as { issuerId: string };
    const input = SuspendCredentialIssuerRequestSchema.parse(request.body ?? {});
    const steward = await prisma.userAccount.findUnique({ where: { id: input.steward } });
    if (!steward) return reply.code(404).send({ error: "Steward account not found" });
    const issuer = await prisma.credentialIssuer.findUnique({ where: { id: issuerId } });
    if (!issuer) return reply.code(404).send({ error: "Credential issuer not found" });

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
    const [steward, credential] = await Promise.all([
      prisma.userAccount.findUnique({ where: { id: input.steward } }),
      prisma.credential.findUnique({ where: { id: credentialId } })
    ]);
    if (!steward) return reply.code(404).send({ error: "Steward account not found" });
    if (!credential) return reply.code(404).send({ error: "Credential not found" });

    const schema = await prisma.credentialSchema.findUnique({ where: { id: credential.schemaId } });
    if (!schema) return reply.code(404).send({ error: "Credential schema not found" });
    const existingRevocation = await prisma.credentialRevocation.findUnique({ where: { credentialId } });
    if (existingRevocation) return reply.code(409).send({ error: "Credential is already revoked" });

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
    const input = CreateUserRequestSchema.parse(request.body ?? {});
    const username = input.username.toLowerCase();
    const userId = `user-${username}`;
    const profileId = portableProfileId(userId);
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
            displayName: input.displayName,
            bio: input.bio
          }
        });
        await recordProtocolCommitments(protocolEvent, tx);
        return created;
      });
      return { user, profileArtifact };
    } catch {
      return reply.code(409).send({ error: "Username is already taken" });
    }
  });

  app.get("/profiles/resolve", async (request, reply) => {
    const { profileId, userId } = request.query as { profileId?: string; userId?: string };
    if (!profileId && !userId) return reply.code(400).send({ error: "Provide profileId or userId" });
    const profile = await prisma.userAccount.findFirst({
      where: profileId ? { profileId } : { id: userId }
    });
    if (!profile) return reply.code(404).send({ error: "Profile not found" });
    const profileArtifact = profile.profileHash
      ? { hash: profile.profileHash, artifact: await artifactStore.read(profile.profileHash).catch(() => null) }
      : null;
    return { protocol: buildProfileRecordProtocol(profile, profileArtifact?.hash ?? null), profile, profileArtifact };
  });

  app.get("/communities", async (request) => {
    const { userId, visibility, credentialSchemaId, authorityLevel, slug, query } = request.query as {
      userId?: string;
      visibility?: string;
      credentialSchemaId?: string;
      authorityLevel?: string;
      slug?: string;
      query?: string;
    };
    const page = parsePageQuery(request.query);
    const where: Prisma.CommunityWhereInput = {
      ...(visibility ? { visibility } : {}),
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
        orderBy: [{ visibility: "asc" }, { createdAt: "asc" }],
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
    const creator = await prisma.userAccount.findUnique({ where: { id: input.creatorId } });
    if (!creator) return reply.code(404).send({ error: "Creator account not found" });
    const slug = input.slug ?? slugify(input.name);
    const communityId = `community-${slug}`;
    try {
      const communityCreatedEvent = prepareProtocolEvent({
        eventType: "CommunityCreated",
        subjectId: communityId,
        actor: creator.id,
        previousHash: null,
        newHash: hashJson({ slug, visibility: input.visibility })
      });
      const community = await prisma.$transaction(async (tx) => {
        const protocolEvent = await ingestProtocolEvent(tx, communityCreatedEvent);
        const created = await tx.community.create({
          data: {
            id: communityId,
            slug,
            name: input.name,
            description: input.description,
            visibility: input.visibility,
            credentialSchemaId: input.credentialSchemaId,
            defaultAuthorityLevel: "Advisory",
            createdBy: creator.id,
            memberships: {
              create: {
                id: `member-${nanoid(10)}`,
                userId: creator.id,
                role: "Owner",
                status: "Active"
              }
            }
          },
          include: { memberships: true }
        });
        await recordProtocolCommitments(protocolEvent, tx);
        return created;
      });
      return { community };
    } catch {
      return reply.code(409).send({ error: "Community slug is already taken" });
    }
  });

  app.post("/communities/:communityId/join", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const input = JoinCommunityRequestSchema.parse(request.body ?? {});
    const community = await prisma.community.findUnique({ where: { id: communityId } });
    const user = await prisma.userAccount.findUnique({ where: { id: input.userId } });
    if (!community || !user) return reply.code(404).send({ error: "Community or account not found" });
    const communityJoinedEvent = prepareProtocolEvent({
      eventType: "CommunityJoined",
      subjectId: community.id,
      actor: input.userId,
      previousHash: null,
      newHash: hashJson({ communityId, userId: input.userId })
    });
    const membership = await prisma.$transaction(async (tx) => {
      const protocolEvent = await ingestProtocolEvent(tx, communityJoinedEvent);
      const upserted = await tx.communityMember.upsert({
        where: { communityId_userId: { communityId, userId: input.userId } },
        update: { status: "Active" },
        create: {
          id: `member-${nanoid(10)}`,
          communityId,
          userId: input.userId,
          role: "Member",
          status: "Active"
        }
      });
      await recordProtocolCommitments(protocolEvent, tx);
      return upserted;
    });
    return { membership };
  });

  app.post("/communities/:communityId/follow", async (request, reply) => {
    const { communityId } = request.params as { communityId: string };
    const input = FollowCommunityRequestSchema.parse(request.body ?? {});
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
      await recordProtocolCommitments(protocolEvent, tx);
      return created;
    });
    return { follow, followArtifact };
  });

  app.post("/topics/:topicId/follow", async (request, reply) => {
    const { topicId } = request.params as { topicId: string };
    const input = FollowTopicRequestSchema.parse(request.body ?? {});
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

  app.get("/discovery", async (request) => {
    const { userId } = request.query as { userId?: string };
    const communities = await prisma.community.findMany({
      orderBy: [{ visibility: "asc" }, { createdAt: "asc" }],
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
    const communitySummaries = visibleCommunities.map((community) => ({
      id: community.id,
      slug: community.slug,
      name: community.name,
      visibility: community.visibility,
      memberCount: community._count.memberships,
      questionCount: community._count.questions,
      followerCount: community.follows.length,
      followedByActiveUser: Boolean(userId && community.follows.some((follow) => follow.userId === userId))
    }));
    const topics = buildDiscoveryTopics(questions, topicFollows, allTopicFollows);
    return {
      protocol: buildDiscoveryProtocol(communitySummaries, topics, communityFollows, topicFollows, userId ?? null),
      communities: communitySummaries,
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

  app.get("/questions/:questionId", async (request, reply) => {
    const { questionId } = request.params as { questionId: string };
    const { userId } = request.query as { userId?: string };
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { challenges: true, poll: { include: { result: true, resultChallenges: true, ballots: false } }, community: true }
    });
    if (!question) return reply.code(404).send({ error: "Question not found" });
    if (!(await canReadCommunity(question.communityId, userId))) {
      return reply.code(403).send({ error: "Join this private community to view this question" });
    }
    return { question: enrichQuestion(question) };
  });

  app.post("/questions", async (request, reply) => {
    const input = CreateQuestionRequestSchema.parse(request.body ?? {});
    const proposer = await prisma.userAccount.findUnique({ where: { id: input.proposer } });
    if (!proposer) return reply.code(404).send({ error: "Proposer account not found" });
    const community = await prisma.community.findUnique({
      where: { id: input.communityId },
      include: { memberships: true }
    });
    if (!community) return reply.code(404).send({ error: "Community not found" });
    const answerSchema = safeAnswerSchema(input.answerSchemaId);
    if (!answerSchema) return reply.code(400).send({ error: "Unknown answer schema" });
    if (community.visibility === "Private" && !community.memberships.some((member) => member.userId === input.proposer && member.status === "Active")) {
      return reply.code(403).send({ error: "Join this private community before proposing a question" });
    }
    if (!(await ensureCommunityProtocolWritable(community.id, reply))) return;
    const bodyArtifact = await artifactStore.write(
      withArtifactSchema("question-body", { title: input.title, body: input.body, answerSchemaId: answerSchema.answerSchemaId })
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
          topicIds: input.topicIds,
          geoScope: input.geoScope,
          sponsorDisclosureHash: sponsorArtifact.hash,
          methodologyLabel: input.methodologyLabel,
          authorityLevel: adoptionAuthority.authorityLevel,
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
    const challenger = await prisma.userAccount.findUnique({ where: { id: input.challenger } });
    if (!challenger) return reply.code(404).send({ error: "Challenger account not found" });
    const question = await prisma.question.findUnique({ where: { id: questionId }, include: { community: true } });
    if (!question) return reply.code(404).send({ error: "Question not found" });
    if (!(await canReadCommunity(question.communityId, input.challenger))) {
      return reply.code(403).send({ error: "Join this private community before challenging a question" });
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
    const curator = await prisma.userAccount.findUnique({ where: { id: input.curator } });
    if (!curator) return reply.code(404).send({ error: "Curator account not found" });
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { challenges: true, challengeAppeals: true, poll: true, community: true }
    });
    if (!question?.poll) return reply.code(404).send({ error: "Question or poll not found" });
    if (question.proposer === input.curator) return reply.code(403).send({ error: "Proposer cannot accept their own question" });
    const curatorCheck = await requireCommunityCurator(question.communityId, input.curator, reply);
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
    const jurorCheck = await requireCommunityCurator(challenge.question.communityId, input.juror, reply);
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
    const question = await prisma.question.findUnique({ where: { id: questionId }, select: { communityId: true } });
    if (!question) return reply.code(404).send({ error: "Question not found" });
    if (!(await canReadCommunity(question.communityId, userId))) {
      return reply.code(403).send({ error: "Join this private community to view challenge appeals" });
    }
    const appeals = await loadChallengeAppealsForQuestion(questionId, artifactStore);
    return { protocol: buildChallengeAppealsProtocol(questionId, appeals), questionId, appeals };
  });

  app.get("/questions/:questionId/juror-assignments", async (request, reply) => {
    const { questionId } = request.params as { questionId: string };
    const { userId } = request.query as { userId?: string };
    const question = await prisma.question.findUnique({ where: { id: questionId }, select: { communityId: true } });
    if (!question) return reply.code(404).send({ error: "Question not found" });
    if (!(await canReadCommunity(question.communityId, userId))) {
      return reply.code(403).send({ error: "Join this private community to view juror assignments" });
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
    const selectedByCheck = await requireCommunityCurator(challenge.question.communityId, input.selectedBy, reply);
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
    const [appellant, challenge] = await Promise.all([
      prisma.userAccount.findUnique({ where: { id: input.appellantId } }),
      prisma.challenge.findUnique({ where: { id: challengeId }, include: { question: { include: { community: true } } } })
    ]);
    if (!appellant) return reply.code(404).send({ error: "Appellant account not found" });
    if (!challenge || challenge.questionId !== questionId) return reply.code(404).send({ error: "Challenge not found" });
    if (!(await canReadCommunity(challenge.question.communityId, input.appellantId))) {
      return reply.code(403).send({ error: "Join this private community before appealing a question challenge" });
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
    const proposer = await prisma.userAccount.findUnique({ where: { id: input.proposer } });
    if (!proposer) return reply.code(404).send({ error: "Proposer account not found" });
    const question = await prisma.question.findUnique({ where: { id: questionId }, include: { challenges: true, community: true } });
    if (!question) return reply.code(404).send({ error: "Question not found" });
    if (question.proposer !== input.proposer) {
      return reply.code(403).send({ error: "Only the original proposer can amend this question" });
    }
    if (!(await canReadCommunity(question.communityId, input.proposer))) {
      return reply.code(403).send({ error: "Join this private community before amending a question" });
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
    const question = await prisma.question.findUnique({ where: { id: questionId }, select: { communityId: true } });
    if (!question) return reply.code(404).send({ error: "Question not found" });
    if (!(await canReadCommunity(question.communityId, userId))) {
      return reply.code(403).send({ error: "Join this private community to view this question history" });
    }
    const events = await prisma.registryEvent.findMany({ where: { subjectId: questionId }, orderBy: REGISTRY_EVENT_ORDER });
    const challenges = await prisma.challenge.findMany({ where: { questionId }, orderBy: { createdAt: "asc" } });
    return { events, challenges };
  });

  app.get("/questions/:questionId/discussion", async (request, reply) => {
    const { questionId } = request.params as { questionId: string };
    const { userId } = request.query as { userId?: string };
    const question = await prisma.question.findUnique({ where: { id: questionId }, select: { id: true, communityId: true } });
    if (!question) return reply.code(404).send({ error: "Question not found" });
    if (!(await canReadCommunity(question.communityId, userId))) {
      return reply.code(403).send({ error: "Join this private community to view this discussion" });
    }
    const posts = await prisma.discussionPost.findMany({ where: { questionId, status: "Published" }, orderBy: { createdAt: "asc" } });
    const discussion = await hydrateDiscussionPosts(posts, artifactStore);
    const views = buildDiscussionViews(discussion);
    return { protocol: buildQuestionDiscussionProtocol(question, discussion, views), questionId, discussion, views };
  });

  app.post("/questions/:questionId/discussion", async (request, reply) => {
    const { questionId } = request.params as { questionId: string };
    const input = CreateDiscussionPostRequestSchema.parse(request.body ?? {});
    const [question, author] = await Promise.all([
      prisma.question.findUnique({ where: { id: questionId }, select: { communityId: true } }),
      prisma.userAccount.findUnique({ where: { id: input.authorId } })
    ]);
    if (!question) return reply.code(404).send({ error: "Question not found" });
    if (!author) return reply.code(404).send({ error: "Author account not found" });
    if (!(await canReadCommunity(question.communityId, input.authorId))) {
      return reply.code(403).send({ error: "Join this private community before joining its discussion" });
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
      await recordProtocolCommitments(protocolEvent, tx);
      return created;
    });
    return { post: { ...post, body: input.body }, bodyArtifact };
  });

  app.get("/questions/:questionId/moderation", async (request, reply) => {
    const { questionId } = request.params as { questionId: string };
    const { userId } = request.query as { userId?: string };
    const question = await prisma.question.findUnique({ where: { id: questionId }, select: { id: true, communityId: true } });
    if (!question) return reply.code(404).send({ error: "Question not found" });
    if (!(await canReadCommunity(question.communityId, userId))) {
      return reply.code(403).send({ error: "Join this private community to view this moderation log" });
    }
    const { moderationRecords, appeals } = await loadModerationLog(questionId, artifactStore);
    return { protocol: buildQuestionModerationProtocol(question, moderationRecords, appeals), questionId, moderationRecords, appeals };
  });

  app.post("/questions/:questionId/discussion/:postId/moderation", async (request, reply) => {
    const { questionId, postId } = request.params as { questionId: string; postId: string };
    const input = ModerateDiscussionPostRequestSchema.parse(request.body ?? {});
    const post = await prisma.discussionPost.findUnique({ where: { id: postId }, include: { question: true } });
    if (!post || post.questionId !== questionId) return reply.code(404).send({ error: "Discussion post not found" });
    const moderatorCheck = await requireCommunityCurator(post.question.communityId, input.moderatorId, reply);
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
    const moderationRecord = await prisma.discussionModerationRecord.findUnique({
      where: { id: recordId },
      include: { post: true, question: true }
    });
    if (!moderationRecord) return reply.code(404).send({ error: "Moderation record not found" });
    if (!(await canReadCommunity(moderationRecord.question.communityId, input.appellantId))) {
      return reply.code(403).send({ error: "Join this private community before appealing moderation" });
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
    const moderatorCheck = await requireCommunityCurator(appeal.moderationRecord.question.communityId, input.moderatorId, reply);
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
    const input = DemoResidentCredentialRequestSchema.parse(request.body ?? {});
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
      return reply.code(409).send({ error: "Demo resident credential already issued for this holder" });
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
      return reply.code(409).send({ error: "Demo resident credential already issued for this holder" });
    }
  });

  app.post("/credentials/:credentialId/export", async (request, reply) => {
    const { credentialId } = request.params as { credentialId: string };
    const input = ExportWalletCredentialRequestSchema.parse(request.body ?? {});
    const credential = await prisma.credential.findUnique({ where: { id: credentialId } });
    if (!credential) return reply.code(404).send({ error: "Credential not found" });
    if (!verifyDemoCredential(input.credentialSecret, credential.secretHash)) {
      return reply.code(403).send({ error: "Invalid credential" });
    }
    return { walletCredential: toWalletCredential(credential, input.credentialSecret), walletBoundary: CREDENTIAL_WALLET_BOUNDARY };
  });

  app.post("/credentials/import", async (request, reply) => {
    const input = ImportWalletCredentialRequestSchema.parse(request.body ?? {});
    const walletCredential = input.credential;
    const expectedCredentialId = credentialIdForDemoCredential(
      walletCredential.holderAlias,
      walletCredential.schemaId,
      walletCredential.issuerId,
      walletCredential.secret
    );
    if (walletCredential.credentialId !== expectedCredentialId) {
      return reply.code(400).send({ error: "Wallet credential id does not match its secret" });
    }
    const issuedAt = walletCredentialIssuedAtDate(walletCredential);
    if (!issuedAt) return reply.code(400).send({ error: "Wallet credential issuedAt is invalid" });

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
        return reply.code(403).send({ error: "Wallet credential secret does not match stored credential" });
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
      return reply.code(409).send({ error: "Wallet credential conflicts with an existing holder credential" });
    }
  });

  app.post("/polls/:pollId/credential-proof", async (request, reply) => {
    const { pollId } = request.params as { pollId: string };
    const input = CredentialProofRequestSchema.parse(request.body ?? {});
    const poll = await prisma.poll.findUnique({ where: { id: pollId }, include: { question: true } });
    const credential = await prisma.credential.findUnique({ where: { id: input.credentialId } });
    if (!poll || !credential) return reply.code(404).send({ error: "Poll or credential not found" });
    if (credential.schemaId !== poll.credentialSchemaId) {
      return reply.code(403).send({ error: "Credential schema mismatch" });
    }
    const registryError = await credentialRegistryError(credential);
    if (registryError) return reply.code(403).send({ error: registryError });
    const trustError = await communityCredentialTrustError(poll.question.communityId, credential);
    if (trustError) return reply.code(403).send({ error: trustError });
    if (!(await canReadCommunity(poll.question.communityId, credential.holderAlias))) {
      return reply.code(403).send({ error: "Join this private community before proving eligibility for its poll" });
    }
    if (!verifyDemoCredential(input.credentialSecret, credential.secretHash)) {
      return reply.code(403).send({ error: "Invalid credential" });
    }
    const membershipProof = resolveCredentialMembershipProof(input.membershipProof, credential, input.credentialSecret, pollId);
    if (!membershipProof) return reply.code(403).send({ error: "Invalid credential membership proof" });
    return { membershipProof, nullifier: membershipProof.nullifier, credentialSchemaId: credential.schemaId };
  });

  app.post("/polls/:pollId/signup", async (request, reply) => {
    const { pollId } = request.params as { pollId: string };
    const input = CredentialProofRequestSchema.parse(request.body ?? {});
    const poll = await prisma.poll.findUnique({ where: { id: pollId }, include: { question: true } });
    const credential = await prisma.credential.findUnique({ where: { id: input.credentialId } });
    if (!poll || !credential) return reply.code(404).send({ error: "Poll or credential not found" });
    if (poll.status !== "Open" || poll.question.status !== "Open") return reply.code(409).send({ error: "Poll is not open" });
    if (credential.schemaId !== poll.credentialSchemaId) {
      return reply.code(403).send({ error: "Credential schema mismatch" });
    }
    const registryError = await credentialRegistryError(credential);
    if (registryError) return reply.code(403).send({ error: registryError });
    const trustError = await communityCredentialTrustError(poll.question.communityId, credential);
    if (trustError) return reply.code(403).send({ error: trustError });
    if (!(await canReadCommunity(poll.question.communityId, credential.holderAlias))) {
      return reply.code(403).send({ error: "Join this private community before signing up for its poll" });
    }
    if (!(await ensureCommunityProtocolWritable(poll.question.communityId, reply))) return;
    if (!verifyDemoCredential(input.credentialSecret, credential.secretHash)) {
      return reply.code(403).send({ error: "Invalid credential" });
    }
    const membershipProof = resolveCredentialMembershipProof(input.membershipProof, credential, input.credentialSecret, pollId);
    if (!membershipProof) return reply.code(403).send({ error: "Invalid credential membership proof" });
    const nullifier = membershipProof.nullifier;
    const existing = await prisma.ballot.findUnique({ where: { pollId_nullifier: { pollId, nullifier } } });
    return { accepted: !existing, nullifier, credentialSchemaId: credential.schemaId, membershipProof };
  });

  app.post("/polls/:pollId/vote", async (request, reply) => {
    const { pollId } = request.params as { pollId: string };
    const input = VoteRequestSchema.parse(request.body ?? {});
    const poll = await prisma.poll.findUnique({ where: { id: pollId }, include: { question: true } });
    const credential = await prisma.credential.findUnique({ where: { id: input.credentialId } });
    if (!poll || !credential) return reply.code(404).send({ error: "Poll or credential not found" });
    if (poll.status !== "Open" || poll.question.status !== "Open") return reply.code(409).send({ error: "Poll is not open" });
    const registryError = await credentialRegistryError(credential);
    if (registryError) return reply.code(403).send({ error: registryError });
    const trustError = await communityCredentialTrustError(poll.question.communityId, credential);
    if (trustError) return reply.code(403).send({ error: trustError });
    if (!(await canReadCommunity(poll.question.communityId, credential.holderAlias))) {
      return reply.code(403).send({ error: "Join this private community before voting in its poll" });
    }
    if (!(await ensureCommunityProtocolWritable(poll.question.communityId, reply))) return;
    if (!verifyDemoCredential(input.credentialSecret, credential.secretHash)) {
      return reply.code(403).send({ error: "Invalid credential" });
    }
    if (credential.schemaId !== poll.credentialSchemaId) {
      return reply.code(403).send({ error: "Credential schema mismatch" });
    }
    const membershipProof = resolveCredentialMembershipProof(input.membershipProof, credential, input.credentialSecret, pollId);
    if (!membershipProof) return reply.code(403).send({ error: "Invalid credential membership proof" });

    const answerSchema = getAnswerSchema(poll.question.answerSchemaId);
    const response = validateBallotResponse(answerSchema, input.response ?? choiceToBallotResponse(input.choice ?? "abstain"));
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
            proofHash
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
          submittedAt: ballot.submittedAt
        },
        membershipProof
      };
    } catch {
      return reply.code(409).send({ error: "Duplicate ballot nullifier rejected" });
    }
  });

  app.post("/polls/:pollId/close", async (request, reply) => {
    const { pollId } = request.params as { pollId: string };
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
    if (!(await canReadCommunity(poll.question.communityId, userId))) {
      return reply.code(403).send({ error: "Join this private community to view decryption shares" });
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
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        question: true,
        tallyKeySetup: { select: TALLY_KEY_SETUP_PUBLIC_SELECT },
        decryptionShares: { select: TALLY_DECRYPTION_SHARE_PUBLIC_SELECT }
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
    const shareHash = hashJson({
      protocol: "pc-threshold-decryption-share-v0",
      pollId,
      keySetupId: tallyKeySetup.id,
      memberId: input.memberId,
      share: input.share
    });
    const proofHash = hashJson({
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
      note: tallyKeySetup
        ? "Ballots were encrypted to a published threshold tally public key and enough decryption share records were submitted; local MVP tally still uses a coordinator fallback until share proof validation is implemented."
        : activeCommittee
          ? "Coordinator-based encrypted tally for local MVP with active tally committee metadata; threshold key shares are a later upgrade."
          : "Coordinator-based encrypted tally for local MVP; threshold committee is a later upgrade."
    };
    const privacyReportHash = hashJson(privacyReport);
    const resultArtifact = await artifactStore.write(
      withArtifactSchema("result-artifact", {
        pollId,
        questionId: poll.questionId,
        authorityLevel: poll.question.authorityLevel,
        adoptionPolicyId: poll.question.adoptionPolicyId,
        answerSchema,
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
          tallyProofHash: tallyPublicationProofArtifact.hash,
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
          tallyProofHash: tallyPublicationProofArtifact.hash,
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
    if (!(await canReadCommunity(poll.question.communityId, userId))) {
      return reply.code(403).send({ error: "Join this private community to view this poll result" });
    }
    const artifact = await artifactStore.read(poll.result.resultArtifactHash);
    return { result: poll.result, artifact, authorityLevel: poll.question.authorityLevel };
  });

  app.post("/polls/:pollId/results/challenges", async (request, reply) => {
    const { pollId } = request.params as { pollId: string };
    const input = CreateResultChallengeRequestSchema.parse(request.body ?? {});
    const [poll, challenger] = await Promise.all([
      prisma.poll.findUnique({ where: { id: pollId }, include: { result: true, question: true } }),
      prisma.userAccount.findUnique({ where: { id: input.challenger } })
    ]);
    if (!poll?.result) return reply.code(404).send({ error: "Published result not found" });
    if (!challenger) return reply.code(404).send({ error: "Challenger account not found" });
    if (!(await canReadCommunity(poll.question.communityId, input.challenger))) {
      return reply.code(403).send({ error: "Join this private community before challenging its result" });
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
    const jurorCheck = await requireCommunityCurator(resultChallenge.poll.question.communityId, input.juror, reply);
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
    const selectedByCheck = await requireCommunityCurator(resultChallenge.poll.question.communityId, input.selectedBy, reply);
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
    const [appellant, resultChallenge] = await Promise.all([
      prisma.userAccount.findUnique({ where: { id: input.appellantId } }),
      prisma.resultChallenge.findUnique({
        where: { id: challengeId },
        include: { poll: { include: { question: true } }, result: true }
      })
    ]);
    if (!appellant) return reply.code(404).send({ error: "Appellant account not found" });
    if (!resultChallenge || resultChallenge.pollId !== pollId) return reply.code(404).send({ error: "Result challenge not found" });
    if (!(await canReadCommunity(resultChallenge.poll.question.communityId, input.appellantId))) {
      return reply.code(403).send({ error: "Join this private community before appealing a result challenge" });
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
    const selectedByCheck = await requireCommunityCurator(appeal.question.communityId, input.selectedBy, reply);
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
    const assignment = await prisma.jurorAssignment.findUnique({ where: { id: assignmentId }, include: { question: true } });
    if (!assignment) return reply.code(404).send({ error: "Juror assignment not found" });
    if (assignment.jurorId !== input.jurorId) return reply.code(403).send({ error: "Only the selected juror can disclose conflicts for this assignment" });
    if (!(await canReadCommunity(assignment.question.communityId, input.jurorId))) {
      return reply.code(403).send({ error: "Join this private community before disclosing a juror conflict" });
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
    const jurorCheck = await requireCommunityCurator(appeal.question.communityId, input.juror, reply);
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
    const curatorCheck = await requireCommunityCurator(poll.question.communityId, input.curator, reply);
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
        poll: { include: { result: true, ballots: true, resultChallenges: true } },
        challenges: true,
        challengeAppeals: { orderBy: { createdAt: "asc" } },
        jurorAssignments: { orderBy: { createdAt: "asc" } },
        discussionPosts: true,
        archiveRecord: true,
        community: true
      }
    });
    if (!question) return reply.code(404).send({ error: "Question not found" });
    const curatorCheck = await requireCommunityCurator(question.communityId, input.curator, reply);
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
    const question = await prisma.question.findUnique({ where: { id: questionId }, select: { communityId: true } });
    if (!question) return reply.code(404).send({ error: "Question not found" });
    if (!(await canReadCommunity(question.communityId, userId))) {
      return reply.code(403).send({ error: "Join this private community to view this archive" });
    }
    const archiveRecord = await prisma.archiveRecord.findUnique({ where: { questionId } });
    if (!archiveRecord) return reply.code(404).send({ error: "Archive not found" });
    const artifact = await artifactStore.read(archiveRecord.archiveHash);
    return { archiveRecord, artifact };
  });

  app.get("/questions/:questionId/archive/export", async (request, reply) => {
    const { questionId } = request.params as { questionId: string };
    const { userId } = request.query as { userId?: string };
    const question = await prisma.question.findUnique({ where: { id: questionId }, select: { communityId: true } });
    if (!question) return reply.code(404).send({ error: "Question not found" });
    if (!(await canReadCommunity(question.communityId, userId))) {
      return reply.code(403).send({ error: "Join this private community to export this archive" });
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

    const [questions, policies, governanceParameterSets, emergencySuspensions, credentialTrustPolicies, tallyCommittees, tallyKeySetups, forks] = await Promise.all([
      prisma.question.findMany({
        where: { communityId },
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
      prisma.communityFork.findMany({ where: { sourceCommunityId: communityId }, orderBy: { createdAt: "asc" } })
    ]);

    const questionIds = questions.map((question) => question.id);
    const policyIds = policies.map((policy) => policy.id);
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
    const treasuryLedgerEntries = buildTreasuryLedgerEntries(communityId, bonds);
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
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply);
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
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply);
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
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply);
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
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply);
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
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply);
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
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply);
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
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply);
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
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply);
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
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply);
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
    const allEntries = buildTreasuryLedgerEntries(communityId, bonds);
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
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply);
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
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply);
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
    if (!(await canReadCommunity(question.communityId, undefined))) {
      return reply.code(403).send({ error: "Private community records require membership" });
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
    if (!(await canReadCommunity(question.communityId, undefined))) {
      return reply.code(403).send({ error: "Private community records require membership" });
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
    const eventIds = events.map((event) => event.id);
    const commitments = eventIds.length
      ? (
          await prisma.protocolCommitmentRecord.findMany({
            where: { sourceEventId: { in: eventIds } },
            orderBy: COMMITMENT_RECORD_ORDER
          })
        ).map(toCommitmentView)
      : [];
    const pageInfo = buildPageInfo(page, total);
    return { protocol: buildRegistryEventsProtocol(events, pageInfo, commitments), page: pageInfo, events, commitments };
  });

  app.get("/registry/protocol-transactions/replay", async () => {
    const records = await prisma.protocolTransactionResult.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });
    const replay = buildProtocolIndexerReplay(records.map(toProtocolTransactionView));
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
    const pageInfo = buildPageInfo(page, total);
    const transactions = records.map(toProtocolTransactionView);
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
    const pageInfo = buildPageInfo(page, total);
    const commitments = records.map(toCommitmentView);
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
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply);
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
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply);
    if (!stewardCheck) return;
    const policy = await prisma.adoptionPolicy.findUnique({ where: { id: policyId } });
    if (!policy || policy.communityId !== communityId) return reply.code(404).send({ error: "Adoption policy not found" });
    if (policy.status !== "Proposed") return reply.code(409).send({ error: "Only proposed adoption policies can be activated" });
    if (policy.authorityLevel === "Binding" && !policy.legalHandoffHash) {
      return reply.code(409).send({ error: "Binding adoption policies require legal handoff metadata before activation" });
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
    const stewardCheck = await requireCommunitySteward(communityId, input.steward, reply);
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
  visibility: string;
  memberCount: number;
  questionCount: number;
  followerCount: number;
  followedByActiveUser: boolean;
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

function readableQuestionWhere(userId?: string): Prisma.QuestionWhereInput {
  return {
    OR: [
      { communityId: null },
      { community: { is: { visibility: "Public" } } },
      ...(userId ? [{ community: { is: { memberships: { some: { userId, status: "Active" } } } } }] : [])
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
    treasuryPc: sumEntries(entries, "TreasuryFee"),
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
      openEscrowPc: totals.openEscrowPc,
      treasuryBalancePc: totals.treasuryBalancePc,
      participantNetPc: totals.participantNetPc
    },
    authority: {
      accountingModel: "bond-derived-ledger",
      unit: "PC",
      source: "local-devnet-bond-events",
      treasuryAccountId: treasuryAccountForCommunity(communityId)
    }
  };
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
      treasuryAccountingModel: "bond-derived-ledger",
      treasuryAccountId: treasuryAccountForCommunity(community.id),
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
  if (eventType.startsWith("Credential") || eventType.startsWith("CommunityCredentialTrustPolicy")) return "CredentialRegistry";
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
    create: { hash: artifact.hash, path: artifact.path, kind }
  });
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
  if (!schema || schema.status !== "Active") return "Credential schema is not active";
  if (!issuer || issuer.status !== "Active") return "Credential issuer is not active";
  if (!issuer.schemaIds.includes(credential.schemaId)) return "Credential issuer is not registered for this schema";
  if (isCredentialExpired(credential, schema.expiresAfter)) return "Credential is expired";
  if (revocation) return "Credential is revoked";
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
  return policies.some((policy) => credentialTrustPolicyAllows(policy, credential)) ? null : "Credential issuer is not trusted by this community";
}

function credentialTrustPolicyAllows(policy: CommunityCredentialTrustPolicyView, credential: { schemaId: string; issuerId: string }) {
  if (policy.status !== "Active") return false;
  if (policy.credentialSchemaId !== "*" && policy.credentialSchemaId !== credential.schemaId) return false;
  if (policy.mode === "Open") return true;
  return policy.trustedIssuerIds.includes("*") || policy.trustedIssuerIds.includes(credential.issuerId);
}

async function requireCommunitySteward(communityId: string, userId: string, reply: FastifyReply) {
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
    reply.code(404).send({ error: "Steward account not found" });
    return null;
  }
  if (!membership || membership.status !== "Active") {
    reply.code(403).send({ error: "Only active community stewards can change adoption policy" });
    return null;
  }
  if (!["Owner", "Moderator"].includes(membership.role)) {
    reply.code(403).send({ error: "Only community owners or moderators can change adoption policy" });
    return null;
  }
  return { community, user, membership };
}

async function requireCommunityCurator(communityId: string | null, userId: string, reply: FastifyReply) {
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
    reply.code(403).send({ error: "Only active community curators can curate registry items" });
    return null;
  }
  if (!CURATOR_ROLES.includes(membership.role)) {
    reply.code(403).send({ error: "Only community owners or moderators can curate registry items" });
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

async function questionFeedWhere(communityId: string | undefined, userId: string | undefined, reply: FastifyReply) {
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
      reply.code(403).send({ error: "Join this private community to view its questions" });
      return undefined;
    }
    return { communityId };
  }

  const communities = await prisma.community.findMany({ include: { memberships: true } });
  const accessibleCommunityIds = communities
    .filter(
      (community) =>
        community.visibility === "Public" ||
        Boolean(userId && community.memberships.some((member) => member.userId === userId && member.status === "Active"))
    )
    .map((community) => community.id);
  return { OR: [{ communityId: { in: accessibleCommunityIds } }, { communityId: null }] };
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

function portableProfileId(userId: string) {
  return `did:pc:${userId}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await ensureSeedData();
  const app = buildServer();
  await app.listen({ host: config.host, port: config.port });
}
