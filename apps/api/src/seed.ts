import { prisma } from "@pc/db";
import { createFileArtifactStorage, hashJson, withArtifactSchema } from "@pc/artifacts";
import { createCoordinatorKeypair } from "@pc/privacy";
import { config } from "./config";

const artifactStore = createFileArtifactStorage(config.artifactDir);

export async function ensureSeedData() {
  const body = {
    title: "Should Vancouver pilot car-free Sundays on Commercial Drive?",
    body: "A city resident advisory poll on whether to pilot car-free Sundays on Commercial Drive for one summer season."
  };
  const sponsor = {
    sponsor: "Popular Consensus local transit demo fund",
    disclosure: "Demo-only sponsor disclosure. No real-world authority is implied."
  };
  const bodyArtifact = await artifactStore.write(withArtifactSchema("question-body", body));
  const sponsorArtifact = await artifactStore.write(withArtifactSchema("sponsor-disclosure", sponsor));

  await prisma.artifact.upsert({
    where: { hash: bodyArtifact.hash },
    update: {},
    create: { hash: bodyArtifact.hash, path: bodyArtifact.path, kind: "question-body" }
  });
  await prisma.artifact.upsert({
    where: { hash: sponsorArtifact.hash },
    update: {},
    create: { hash: sponsorArtifact.hash, path: sponsorArtifact.path, kind: "sponsor-disclosure" }
  });

  const demoUsers = [
    { id: "demo-proposer", username: "demo_proposer", displayName: "Demo Proposer", bio: "Local account for creating civic questions." },
    { id: "demo-challenger", username: "demo_challenger", displayName: "Demo Challenger", bio: "Local account for challenging misleading wording." },
    { id: "demo-curator", username: "demo_curator", displayName: "Demo Curator", bio: "Local account for registry curation and challenge rulings." },
    { id: "demo-resident", username: "demo_resident", displayName: "Demo Resident", bio: "Local account for private resident responses." }
  ];
  for (const user of demoUsers) {
    const profileId = portableProfileId(user.id);
    const profileArtifact = await artifactStore.write(
      withArtifactSchema("user-profile", {
        profileId,
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio
      })
    );
    await prisma.artifact.upsert({
      where: { hash: profileArtifact.hash },
      update: {},
      create: { hash: profileArtifact.hash, path: profileArtifact.path, kind: "user-profile" }
    });
    await prisma.userAccount.upsert({
      where: { id: user.id },
      update: { ...user, profileId, profileHash: profileArtifact.hash },
      create: { ...user, profileId, profileHash: profileArtifact.hash }
    });
    await ensureProfileCommunityForUser(user.id, user.username, user.displayName, user.bio);
  }

  await prisma.community.upsert({
    where: { id: "community-vancouver" },
    update: {},
    create: {
      id: "community-vancouver",
      slug: "vancouver-transit",
      name: "Vancouver Transit",
      description: "Public civic questions about transit, streets, and public space.",
      visibility: "Public",
      credentialSchemaId: "credential-vancouver-resident",
      defaultAuthorityLevel: "Advisory",
      createdBy: "demo-proposer"
    }
  });

  await prisma.community.upsert({
    where: { id: "community-housing-coop" },
    update: {},
    create: {
      id: "community-housing-coop",
      slug: "east-van-coop",
      name: "East Van Housing Co-op",
      description: "Private member space for housing co-op governance practice.",
      visibility: "Private",
      credentialSchemaId: "credential-vancouver-resident",
      defaultAuthorityLevel: "Advisory",
      createdBy: "demo-resident"
    }
  });

  const demoMemberships = [
    { communityId: "community-vancouver", userId: "demo-proposer", role: "Owner" },
    { communityId: "community-vancouver", userId: "demo-challenger", role: "Member" },
    { communityId: "community-vancouver", userId: "demo-curator", role: "Moderator" },
    { communityId: "community-vancouver", userId: "demo-resident", role: "Member" },
    { communityId: "community-housing-coop", userId: "demo-resident", role: "Owner" }
  ];
  for (const membership of demoMemberships) {
    await prisma.communityMember.upsert({
      where: { communityId_userId: { communityId: membership.communityId, userId: membership.userId } },
      update: { role: membership.role, status: "Active" },
      create: {
        id: `member-${membership.communityId}-${membership.userId}`,
        communityId: membership.communityId,
        userId: membership.userId,
        role: membership.role,
        status: "Active"
      }
    });
  }

  await prisma.credentialIssuer.upsert({
    where: { id: "issuer-demo-resident" },
    update: {},
    create: {
      id: "issuer-demo-resident",
      publicKey: "dev-issuer-public-key",
      schemaIds: ["credential-vancouver-resident"],
      metadataHash: hashJson({ name: "Demo Vancouver Resident Issuer" }),
      status: "Active"
    }
  });

  await prisma.credentialSchema.upsert({
    where: { id: "credential-vancouver-resident" },
    update: {
      name: "Demo Vancouver Resident",
      issuerRegistryId: "issuer-registry-demo",
      eligibilityClaimHash: hashJson({ claim: "Local demo resident or community member" }),
      nullifierDomainRule: "H(secret, pollId, credentialSchemaId)",
      status: "Active"
    },
    create: {
      id: "credential-vancouver-resident",
      name: "Demo Vancouver Resident",
      issuerRegistryId: "issuer-registry-demo",
      eligibilityClaimHash: hashJson({ claim: "Local demo resident or community member" }),
      nullifierDomainRule: "H(secret, pollId, credentialSchemaId)",
      status: "Active"
    }
  });

  const advisoryPolicyProposalArtifact = await artifactStore.write(
    withArtifactSchema("adoption-policy-proposal", {
      communityId: "community-vancouver",
      authorityLevel: "Advisory",
      eligibleQuestionTypes: ["transit"],
      credentialSchemaIds: ["credential-vancouver-resident"],
      rule: "Seeded demo advisory policy"
    })
  );
  const advisoryPolicyActivationArtifact = await artifactStore.write(
    withArtifactSchema("adoption-policy-activation", {
      communityId: "community-vancouver",
      policyId: "policy-vancouver-advisory",
      activatedBy: "system-seed",
      adoptionRecord: "Seeded demo advisory policy is active by default.",
      effectiveAt: 0
    })
  );
  await prisma.artifact.upsert({
    where: { hash: advisoryPolicyProposalArtifact.hash },
    update: {},
    create: { hash: advisoryPolicyProposalArtifact.hash, path: advisoryPolicyProposalArtifact.path, kind: "adoption-policy-proposal" }
  });
  await prisma.artifact.upsert({
    where: { hash: advisoryPolicyActivationArtifact.hash },
    update: {},
    create: { hash: advisoryPolicyActivationArtifact.hash, path: advisoryPolicyActivationArtifact.path, kind: "adoption-policy-activation" }
  });
  const advisoryPolicyRuleHashes = {
    quorumRuleHash: hashJson({ rule: "No quorum for demo advisory poll" }),
    approvalRuleHash: hashJson({ rule: "Simple aggregate display only" }),
    forkRuleHash: hashJson({ rule: "Community may fork metadata and archive references" })
  };
  await prisma.adoptionPolicy.upsert({
    where: { id: "policy-vancouver-advisory" },
    update: {
      authorityLevel: "Advisory",
      eligibleQuestionTypes: ["transit"],
      credentialSchemaIds: ["credential-vancouver-resident"],
      ...advisoryPolicyRuleHashes,
      proposalHash: advisoryPolicyProposalArtifact.hash,
      activationHash: advisoryPolicyActivationArtifact.hash,
      proposedBy: "system-seed",
      adoptedBy: "system-seed",
      status: "Active"
    },
    create: {
      id: "policy-vancouver-advisory",
      communityId: "community-vancouver",
      authorityLevel: "Advisory",
      eligibleQuestionTypes: ["transit"],
      credentialSchemaIds: ["credential-vancouver-resident"],
      ...advisoryPolicyRuleHashes,
      proposalHash: advisoryPolicyProposalArtifact.hash,
      activationHash: advisoryPolicyActivationArtifact.hash,
      proposedBy: "system-seed",
      adoptedBy: "system-seed",
      effectiveAt: new Date()
    }
  });

  const existing = await prisma.question.findUnique({ where: { id: "question-transit-demo" } });
  if (!existing) {
    const coordinator = createCoordinatorKeypair();
    await prisma.question.create({
      data: {
        id: "question-transit-demo",
        title: body.title,
        bodyHash: bodyArtifact.hash,
        answerSchemaId: "answer-binary-support-oppose",
        credentialSchemaId: "credential-vancouver-resident",
        communityId: "community-vancouver",
        audience: "Public",
        topicIds: ["transit", "public-space"],
        geoScope: "Vancouver",
        sponsorDisclosureHash: sponsorArtifact.hash,
        methodologyLabel: "Answered by city residents who chose to take part",
        authorityLevel: "Advisory",
        opensAt: new Date(),
        closesAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        challengeWindowEndsAt: new Date(Date.now() + 1000 * 60 * 60),
        proposer: "demo-proposer",
        proposalBondId: "bond-demo-proposal",
        status: "Submitted",
        poll: {
          create: {
            id: "poll-transit-demo",
            status: "Configured",
            tallyPublicKeyId: coordinator.publicKeyId,
            tallyPublicKeyPem: coordinator.publicKeyPem,
            tallyPrivateKeyPem: coordinator.privateKeyPem,
            credentialSchemaId: "credential-vancouver-resident",
            privacyThreshold: 1,
            resultChallengeEndsAt: new Date(Date.now() + 1000 * 60 * 60 * 25)
          }
        }
      }
    });
    const seedTransaction = buildSeedProtocolTransactionResult("QuestionSubmitted", "question-transit-demo", "demo-proposer", null, bodyArtifact.hash);
    await prisma.protocolTransactionResult.create({
      data: {
        id: seedTransaction.id,
        sourceType: seedTransaction.sourceType,
        sourceModule: seedTransaction.sourceModule,
        transactionType: seedTransaction.transactionType,
        subjectId: "question-transit-demo",
        actor: "demo-proposer",
        eventType: "QuestionSubmitted",
        eventHash: seedTransaction.eventHash,
        resultHash: seedTransaction.resultHash,
        payloadHash: seedTransaction.payloadHash,
        payloadJson: JSON.stringify(seedTransaction.payload),
        status: "Applied",
        createdAt: seedTransaction.emittedAt
      }
    });
    await prisma.registryEvent.create({
      data: {
        id: seedTransaction.eventHash,
        eventType: "QuestionSubmitted",
        subjectId: "question-transit-demo",
        actor: "demo-proposer",
        newHash: bodyArtifact.hash,
        sourceType: seedTransaction.sourceType,
        sourceTransactionId: seedTransaction.id,
        sourceTransactionHash: seedTransaction.resultHash,
        sourceModule: seedTransaction.sourceModule,
        transactionType: seedTransaction.transactionType,
        emittedAt: seedTransaction.emittedAt
      }
    });
  }

  await prisma.question.update({
    where: { id: "question-transit-demo" },
    data: { proposalBondId: "bond-demo-proposal", status: "Submitted" }
  });
  await prisma.poll.updateMany({
    where: { questionId: "question-transit-demo" },
    data: { status: "Configured" }
  });
  await prisma.bond.upsert({
    where: { id: "bond-demo-proposal" },
    update: {
      owner: "demo-proposer",
      questionId: "question-transit-demo",
      amountPc: 100,
      bondType: "Proposal",
      status: "Escrowed",
      slashedPc: 0,
      refundedPc: 0,
      rewardPc: 0,
      treasuryPc: 0,
      settledAt: null
    },
    create: {
      id: "bond-demo-proposal",
      owner: "demo-proposer",
      questionId: "question-transit-demo",
      amountPc: 100,
      bondType: "Proposal"
    }
  });
}

export async function resetDemoData() {
  await prisma.archiveRecord.deleteMany();
  await prisma.jurorAssignment.deleteMany();
  await prisma.challengeAppeal.deleteMany();
  await prisma.resultChallenge.deleteMany();
  await prisma.discussionModerationAppeal.deleteMany();
  await prisma.discussionModerationRecord.deleteMany();
  await prisma.discussionPost.deleteMany();
  await prisma.activityFeedItem.deleteMany();
  await prisma.dataUnionAccessGrant.deleteMany();
  await prisma.dataUnionProduct.deleteMany();
  await prisma.dataUnionConsent.deleteMany();
  await prisma.dataUnionPolicy.deleteMany();
  await prisma.result.deleteMany();
  await prisma.ballot.deleteMany();
  await prisma.tallyDecryptionShare.deleteMany();
  await prisma.poll.deleteMany();
  await prisma.bond.deleteMany();
  await prisma.reputationEvent.deleteMany();
  await prisma.challenge.deleteMany();
  await prisma.question.deleteMany();
  await prisma.topicFollow.deleteMany();
  await prisma.communityFollow.deleteMany();
  await prisma.communityMember.deleteMany();
  await prisma.communityFork.deleteMany();
  await prisma.communityFrontendConfig.deleteMany();
  await prisma.communityEmergencySuspension.deleteMany();
  await prisma.communityCredentialTrustPolicy.deleteMany();
  await prisma.tallyKeySetup.deleteMany();
  await prisma.tallyCommittee.deleteMany();
  await prisma.governanceParameterSet.deleteMany();
  await prisma.community.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.authChallenge.deleteMany();
  await prisma.authController.deleteMany();
  await prisma.userAccount.deleteMany();
  await prisma.credentialRevocation.deleteMany();
  await prisma.credential.deleteMany();
  await prisma.credentialIssuer.deleteMany();
  await prisma.credentialSchema.deleteMany();
  await prisma.adoptionPolicy.deleteMany();
  await prisma.protocolCommitmentRecord.deleteMany();
  await prisma.protocolTransactionResult.deleteMany();
  await prisma.registryEvent.deleteMany();
  await prisma.artifact.deleteMany();
  await ensureSeedData();
}

function buildSeedProtocolTransactionResult(eventType: string, subjectId: string, actor: string, previousHash: string | null, newHash: string) {
  const emittedAt = new Date();
  const sourceType = "local-devnet";
  const sourceModule = "QuestionRegistry";
  const transactionType = "questionSubmitted";
  const eventHash = hashJson({ eventType, subjectId, actor, previousHash, newHash, emittedAt: emittedAt.toISOString(), seed: true });
  const payload = {
    protocol: "popular-consensus",
    schemaVersion: "local-protocol-transaction-result-v0",
    sourceType,
    sourceModule,
    transactionType,
    subjectId,
    actor,
    eventType,
    previousHash,
    newHash,
    eventHash,
    emittedAt: emittedAt.toISOString(),
    seed: true
  };
  const payloadHash = hashJson(payload);
  const resultHash = hashJson({ sourceType, sourceModule, transactionType, eventHash, payloadHash });
  return {
    id: hashJson({ sourceType, sourceModule, transactionType, subjectId, eventHash }),
    sourceType,
    sourceModule,
    transactionType,
    eventHash,
    resultHash,
    payloadHash,
    payload,
    emittedAt
  };
}

function portableProfileId(userId: string) {
  return `did:pc:${userId}`;
}

async function ensureProfileCommunityForUser(userId: string, username: string, displayName: string, bio?: string | null) {
  const communityId = profileCommunityIdForUser(userId);
  await prisma.community.upsert({
    where: { id: communityId },
    update: {
      name: displayName,
      description: bio || `${displayName}'s personal question feed.`,
      profileUserId: userId,
      kind: "Profile",
      visibility: "Public"
    },
    create: {
      id: communityId,
      slug: profileCommunitySlug(username),
      name: displayName,
      description: bio || `${displayName}'s personal question feed.`,
      kind: "Profile",
      profileUserId: userId,
      visibility: "Public",
      credentialSchemaId: "credential-vancouver-resident",
      defaultAuthorityLevel: "Advisory",
      createdBy: userId
    }
  });
  await prisma.communityMember.upsert({
    where: { communityId_userId: { communityId, userId } },
    update: { role: "Owner", status: "Active" },
    create: {
      id: `member-${communityId}-${userId}`,
      communityId,
      userId,
      role: "Owner",
      status: "Active"
    }
  });
  await prisma.userAccount.update({
    where: { id: userId },
    data: { profileCommunityId: communityId }
  });
}

function profileCommunityIdForUser(userId: string) {
  return `community-profile-${userId.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase()}`;
}

function profileCommunitySlug(username: string) {
  return `user-${username.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")}`;
}
