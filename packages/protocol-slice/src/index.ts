import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import {
  buildArtifactManifest,
  hashArtifactManifest,
  hashJson,
  withArtifactSchema,
  type ArtifactExportBundle,
  type ArtifactExportBundleEntry,
  type ArtifactKind,
  type ArtifactManifest,
  type ArtifactReference
} from "@pc/artifacts";
import type { EncryptedBallotPayload } from "@pc/privacy";
import { getAnswerSchema, tallyBallotResponses, type BallotResponse } from "@pc/shared";

export const PRODUCTION_SLICE_SCHEMA_VERSION = "production-slice-verification-v1";
export const PRODUCTION_SLICE_CRYPTO_MODE = "production-boundary-v1";
export const PRODUCTION_SLICE_PROOF_SYSTEM = "SemaphoreV4";

export type ProductionSliceStatus = "Verified" | "Mismatch";

export type ProductionSliceCheck = {
  id: string;
  ok: boolean;
  expected?: unknown;
  actual?: unknown;
  detail?: string;
};

export type ProductionSliceCredentialSchema = {
  id: string;
  status: "Active" | "Deprecated" | "Retired" | "Proposed";
  revocationRoot: string | null;
};

export type ProductionSliceCredentialIssuer = {
  id: string;
  status: "Active" | "Suspended" | "Removed" | "Pending";
  schemaIds: string[];
  metadataHash: string;
};

export type ProductionSliceTrustPolicy = {
  id: string;
  communityId: string;
  credentialSchemaId: string;
  trustedIssuerIds: string[];
  mode: "AllowList" | "Open";
  status: "Active" | "Superseded" | "Suspended";
  policyHash: string;
};

export type ProductionSliceQuestion = {
  id: string;
  communityId: string;
  version: number;
  title: string;
  bodyHash: string;
  sponsorDisclosureHash: string;
  answerSchemaId: string;
  credentialSchemaId: string;
  methodologyLabel: string;
  authorityLevel: "Advisory" | "Recognized" | "Binding";
  status: "Archived" | "Finalized" | "ResultPublished";
  versionHash: string;
};

export type ProductionSliceTallyMember = {
  memberId: string;
  publicKeyPem: string;
};

export type ProductionSliceTallyKeySetup = {
  id: string;
  committeeId: string;
  pollId: string;
  publicKeyId: string;
  custodyModel: "threshold-ed25519-attested-decryption-v1";
  privateKeyMaterial: "not-exported";
  threshold: number;
  members: ProductionSliceTallyMember[];
  ceremonyHash: string;
};

export type ProductionSlicePoll = {
  id: string;
  questionId: string;
  credentialSchemaId: string;
  tallyPublicKeyId: string;
  status: "ResultPublished" | "Closed";
  openedAt: number;
  closedAt: number;
};

export type ProductionSliceEligibilityProof = {
  protocol: "popular-consensus";
  schemaVersion: "production-slice-eligibility-proof-v1";
  proofSystem: typeof PRODUCTION_SLICE_PROOF_SYSTEM;
  groupId: string;
  groupRoot: string;
  signal: string;
  scope: string;
  nullifier: string;
  publicInputsHash: string;
  proofHash: string;
  verifier: "@semaphore-protocol/core.verifyProof";
  verifierPublicKeyPem: string;
  verifierSignature: string;
  verificationStatus: "Verified";
};

export type ProductionSliceBallot = {
  id: string;
  pollId: string;
  questionId: string;
  credentialSchemaId: string;
  issuerId: string;
  nullifier: string;
  encryptedPayload: EncryptedBallotPayload;
  encryptedPayloadHash: string;
  ballotCommitment: string;
  proofHash: string;
  proofSystem: typeof PRODUCTION_SLICE_PROOF_SYSTEM;
  eligibilityProofArtifactHash: string;
  eligibilityProof: ProductionSliceEligibilityProof;
  submittedAt: number;
};

export type ProductionSliceTallyDecryptionShare = {
  id: string;
  pollId: string;
  tallyKeySetupId: string;
  memberId: string;
  ballotCommitmentsHash: string;
  aggregateCountsHash: string;
  shareHash: string;
  proofHash: string;
  signature: string;
  status: "Accepted" | "Rejected";
  submittedAt: number;
};

export type ProductionSliceResultArtifact = {
  artifactKind: "result-artifact";
  schemaVersion: "pc-result-artifact-v1";
  pollId: string;
  questionId: string;
  questionVersionHash: string;
  aggregate: Record<string, unknown>;
  counts: Record<string, number>;
  aggregateCountsHash: string;
  acceptedBallotCommitments: string[];
  acceptedBallotCommitmentsHash: string;
  tallyKeySetupHash: string;
  decryptionShareHashes: string[];
  decryptionShareSetHash: string;
  acceptedDecryptionShareCount: number;
  tallyProofHash: string;
  privacyReportHash: string;
  turnout: number;
  invalidBallots: number;
  publishedAt: number;
  cryptoMode: typeof PRODUCTION_SLICE_CRYPTO_MODE;
};

export type ProductionSliceResult = {
  id: string;
  pollId: string;
  questionId: string;
  resultArtifactHash: string;
  aggregateCountsHash: string;
  tallyProofHash: string;
  privacyReportHash: string;
  turnout: number;
  invalidBallots: number;
  finalStatus: "Published" | "Challenged" | "Corrected" | "Finalized";
  publishedAt: number;
  challengeWindowEndsAt: number;
  finalizedAt: number | null;
};

export type ProductionSliceChallenge = {
  id: string;
  pollId: string;
  resultId: string;
  reasonCode: string;
  evidenceHash: string;
  ruling: "Pending" | "Sustained" | "Rejected" | "Remanded";
  resolutionHash: string | null;
};

export type ProductionSliceArchive = {
  id: string;
  questionId: string;
  archiveHash: string;
  artifactManifestHash: string;
  archivedAt: number;
};

export type ProductionSliceEvent = {
  eventType: string;
  subjectId: string;
  actor: string;
  previousHash: string | null;
  newHash: string;
  emittedAt: number;
};

export type ProductionSliceVerificationInput = {
  protocol: "popular-consensus";
  schemaVersion: "production-slice-input-v1";
  generatedAt: number;
  credentialSchema: ProductionSliceCredentialSchema;
  credentialIssuer: ProductionSliceCredentialIssuer;
  trustPolicy: ProductionSliceTrustPolicy;
  question: ProductionSliceQuestion;
  poll: ProductionSlicePoll;
  tallyKeySetup: ProductionSliceTallyKeySetup;
  ballots: ProductionSliceBallot[];
  decryptionShares: ProductionSliceTallyDecryptionShare[];
  result: ProductionSliceResult;
  challenges: ProductionSliceChallenge[];
  archive: ProductionSliceArchive;
  events: ProductionSliceEvent[];
  bundle: ArtifactExportBundle;
};

export type ProductionSliceVerificationReport = {
  protocol: "popular-consensus";
  schemaVersion: typeof PRODUCTION_SLICE_SCHEMA_VERSION;
  status: ProductionSliceStatus;
  cryptoMode: typeof PRODUCTION_SLICE_CRYPTO_MODE;
  generatedAt: number;
  hashes: {
    eventStreamHash: string;
    transactionStreamHash: string;
    resultArtifactHash: string | null;
    archiveHash: string | null;
    archiveManifestHash: string | null;
    tallyKeySetupHash: string;
    decryptionShareSetHash: string;
  };
  counts: {
    ballots: number;
    uniqueNullifiers: number;
    challenges: number;
    threshold: number;
    acceptedDecryptionShares: number;
    checks: number;
    failedChecks: number;
  };
  checks: ProductionSliceCheck[];
};

export type ProductionSliceFixture = {
  input: ProductionSliceVerificationInput;
  privateResponses: BallotResponse[];
};

export type ProductionSliceExport = {
  protocol: "popular-consensus";
  schemaVersion: "production-slice-export-v1";
  generatedAt: number;
  status: ProductionSliceStatus;
  input: ProductionSliceVerificationInput;
  report: ProductionSliceVerificationReport;
};

type TestKeypair = {
  privateKeyPem: string;
  publicKeyPem: string;
};

const PROOF_VERIFIER_KEY: TestKeypair = {
  privateKeyPem: pem("PRIVATE KEY", "MC4CAQAwBQYDK2VwBCIEICaMDFlDrELDfaFGclNTItmIKfF0oLnC+4y6u4iOPYsh"),
  publicKeyPem: pem("PUBLIC KEY", "MCowBQYDK2VwAyEALoJOTIwKZdhWq+XKV5/QuJmXingEH8sRUaXh0AOyydo=")
};

const TALLY_MEMBER_KEYS: Array<TestKeypair & { memberId: string }> = [
  {
    memberId: "tally-member-1",
    privateKeyPem: pem("PRIVATE KEY", "MC4CAQAwBQYDK2VwBCIEIGz3w3oDyMJM10r5x+MXcY2bfckyxtPSf/PVqdERi2rv"),
    publicKeyPem: pem("PUBLIC KEY", "MCowBQYDK2VwAyEAC4RdLSglPwKFDE84h6BGGJ874IdkvQ+7PRXKN1do6Z4=")
  },
  {
    memberId: "tally-member-2",
    privateKeyPem: pem("PRIVATE KEY", "MC4CAQAwBQYDK2VwBCIEIMjaF0F9JqkmyPgF3yn89slYce3+UVmaYEM+BomF1ACA"),
    publicKeyPem: pem("PUBLIC KEY", "MCowBQYDK2VwAyEAe9gAm9Mrf8OP4ZPiYyDNi57NN4SX/fnGKGumuVjMuUc=")
  },
  {
    memberId: "tally-member-3",
    privateKeyPem: pem("PRIVATE KEY", "MC4CAQAwBQYDK2VwBCIEIGfYgXCcN5g41tO9hKxAYVWGK7QuQgbiQmbO+81xg4Ns"),
    publicKeyPem: pem("PUBLIC KEY", "MCowBQYDK2VwAyEAHdQpo93Uu+xqfZAfSjJPVlgaLCXejReg43/8iMl/Mpw=")
  }
];

export function createProductionSliceFixture(): ProductionSliceFixture {
  const generatedAt = Date.UTC(2026, 4, 19, 12, 0, 0);
  const communityId = "community-vancouver-transit";
  const questionId = "question-transit-priority";
  const pollId = "poll-transit-priority";
  const credentialSchemaId = "credential-vancouver-resident";
  const issuerId = "issuer-civic-residency";
  const groupId = "semaphore-group-vancouver-residents";

  const credentialSchema: ProductionSliceCredentialSchema = {
    id: credentialSchemaId,
    status: "Active",
    revocationRoot: hashJson({ protocol: "pc-revocation-root-fixture-v1", credentialSchemaId, revoked: [] })
  };
  const credentialIssuer: ProductionSliceCredentialIssuer = {
    id: issuerId,
    status: "Active",
    schemaIds: [credentialSchemaId],
    metadataHash: hashJson({ protocol: "pc-issuer-metadata-v1", issuerId, name: "Civic residency issuer" })
  };
  const trustPolicyWithoutHash = {
    id: "trust-policy-vancouver-resident",
    communityId,
    credentialSchemaId,
    trustedIssuerIds: [issuerId],
    mode: "AllowList" as const,
    status: "Active" as const
  };
  const trustPolicy: ProductionSliceTrustPolicy = {
    ...trustPolicyWithoutHash,
    policyHash: credentialTrustPolicyHash(trustPolicyWithoutHash)
  };

  const bodyArtifact = withArtifactSchema("question-body", {
    title: "Should the city prioritize bus frequency this year?",
    body: "A narrow production-slice question for one replayable binary poll."
  });
  const sponsorArtifact = withArtifactSchema("sponsor-disclosure", {
    sponsor: "Popular Consensus production slice fixture",
    disclosure: "No paid sponsor. Fixture data is for protocol verification."
  });
  const bodyHash = hashJson(bodyArtifact);
  const sponsorDisclosureHash = hashJson(sponsorArtifact);
  const questionWithoutHash = {
    id: questionId,
    communityId,
    version: 1,
    title: bodyArtifact.title,
    bodyHash,
    sponsorDisclosureHash,
    answerSchemaId: "answer-binary-support-oppose",
    credentialSchemaId,
    methodologyLabel: "Verified resident response, deterministic production-slice fixture.",
    authorityLevel: "Advisory" as const,
    status: "Archived" as const
  };
  const question: ProductionSliceQuestion = {
    ...questionWithoutHash,
    versionHash: questionVersionHash(questionWithoutHash)
  };
  const tallyKeySetupWithoutHash: Omit<ProductionSliceTallyKeySetup, "ceremonyHash"> = {
    id: "tally-key-setup-threshold-v1",
    committeeId: "tally-committee-vancouver-v1",
    pollId,
    publicKeyId: "tally-key-threshold-v1",
    custodyModel: "threshold-ed25519-attested-decryption-v1",
    privateKeyMaterial: "not-exported",
    threshold: 2,
    members: TALLY_MEMBER_KEYS.map(({ memberId, publicKeyPem }) => ({ memberId, publicKeyPem }))
  };
  const tallyKeySetup: ProductionSliceTallyKeySetup = {
    ...tallyKeySetupWithoutHash,
    ceremonyHash: tallyKeySetupHash(tallyKeySetupWithoutHash)
  };
  const poll: ProductionSlicePoll = {
    id: pollId,
    questionId,
    credentialSchemaId,
    tallyPublicKeyId: tallyKeySetup.publicKeyId,
    status: "ResultPublished",
    openedAt: generatedAt + 1_000,
    closedAt: generatedAt + 3_600_000
  };

  const privateResponses: BallotResponse[] = [
    { type: "single_choice", choice: "support" },
    { type: "single_choice", choice: "oppose" },
    { type: "single_choice", choice: "support" }
  ];
  const groupRoot = hashJson({
    protocol: "pc-semaphore-group-root-fixture-v1",
    credentialSchemaId,
    issuerId,
    commitments: privateResponses.map((_, index) => `identity-commitment-${index + 1}`)
  });
  const proofScope = productionSliceAnonymousProofScope(pollId, credentialSchemaId);
  const ballots = privateResponses.map((response, index) =>
    createFixtureBallot({
      index,
      pollId,
      questionId,
      credentialSchemaId,
      issuerId,
      groupId,
      groupRoot,
      scope: proofScope,
      response,
      submittedAt: poll.openedAt + index + 1
    })
  );
  const answerSchema = getAnswerSchema(question.answerSchemaId);
  const aggregate = tallyBallotResponses(answerSchema, privateResponses) as Record<string, unknown>;
  const counts = isRecord(aggregate.counts) ? (aggregate.counts as Record<string, number>) : {};
  const aggregateCountsHash = hashJson(counts);
  const acceptedBallotCommitments = sortedStrings(ballots.map((ballot) => ballot.ballotCommitment));
  const acceptedBallotCommitmentsHash = hashJson(acceptedBallotCommitments);
  const decryptionShares = TALLY_MEMBER_KEYS.slice(0, 2).map((member, index) =>
    createFixtureDecryptionShare({
      member,
      pollId,
      tallyKeySetupId: tallyKeySetup.id,
      aggregateCountsHash,
      ballotCommitmentsHash: acceptedBallotCommitmentsHash,
      submittedAt: poll.closedAt + index + 1
    })
  );
  const decryptionShareHashes = sortedStrings(decryptionShares.map((share) => share.shareHash));
  const decryptionShareSetHash = hashJson(decryptionShareHashes);
  const tallyProofHash = tallyPublicationProofHash({
    pollId,
    aggregateCountsHash,
    acceptedBallotCommitmentsHash,
    tallyKeySetupHash: tallyKeySetup.ceremonyHash,
    decryptionShareHashes
  });
  const resultArtifact: ProductionSliceResultArtifact = withArtifactSchema("result-artifact", {
    pollId,
    questionId,
    questionVersionHash: question.versionHash,
    aggregate,
    counts,
    aggregateCountsHash,
    acceptedBallotCommitments,
    acceptedBallotCommitmentsHash,
    tallyKeySetupHash: tallyKeySetup.ceremonyHash,
    decryptionShareHashes,
    decryptionShareSetHash,
    acceptedDecryptionShareCount: decryptionShares.length,
    tallyProofHash,
    privacyReportHash: hashJson({ protocol: "pc-privacy-report-v1", pollId, turnout: ballots.length, threshold: 1 }),
    turnout: ballots.length,
    invalidBallots: 0,
    publishedAt: generatedAt + 3_900_000,
    cryptoMode: PRODUCTION_SLICE_CRYPTO_MODE
  });
  const resultArtifactHash = hashJson(resultArtifact);
  const result: ProductionSliceResult = {
    id: "result-transit-priority",
    pollId,
    questionId,
    resultArtifactHash,
    aggregateCountsHash: resultArtifact.aggregateCountsHash,
    tallyProofHash: resultArtifact.tallyProofHash,
    privacyReportHash: resultArtifact.privacyReportHash,
    turnout: resultArtifact.turnout,
    invalidBallots: resultArtifact.invalidBallots,
    finalStatus: "Finalized",
    publishedAt: resultArtifact.publishedAt,
    challengeWindowEndsAt: resultArtifact.publishedAt + 86_400_000,
    finalizedAt: resultArtifact.publishedAt + 86_400_001
  };

  const challengeEvidence = withArtifactSchema("result-challenge-evidence", {
    pollId,
    resultId: result.id,
    reasonCode: "TallyProofFailure",
    evidence: "Fixture challenge verifies the finalized path rejects pending result disputes."
  });
  const challengeResolution = withArtifactSchema("result-challenge-resolution", {
    challengeId: "result-challenge-1",
    ruling: "Rejected",
    resolution: "Fixture tally proof reference, threshold shares, and ballot commitment set are internally consistent."
  });
  const challengeResolutionHash = hashJson(challengeResolution);
  const challenge: ProductionSliceChallenge = {
    id: "result-challenge-1",
    pollId,
    resultId: result.id,
    reasonCode: "TallyProofFailure",
    evidenceHash: hashJson(challengeEvidence),
    ruling: "Rejected",
    resolutionHash: challengeResolutionHash
  };

  const events = buildFixtureEvents({
    generatedAt,
    question,
    poll,
    ballots,
    result,
    challenge,
    trustPolicy,
    tallyKeySetup,
    decryptionShares
  });
  const tallyKeySetupArtifact = withArtifactSchema("tally-key-setup", {
    ...publicTallyKeySetup(tallyKeySetup),
    ceremonyHash: tallyKeySetup.ceremonyHash,
    memberPublicKeys: tallyKeySetup.members
  });
  const tallyKeySetupArtifactHash = hashJson(tallyKeySetupArtifact);
  const eligibilityProofArtifacts = ballots.map((ballot) => withArtifactSchema("production-slice-eligibility-proof", ballot.eligibilityProof));
  const decryptionShareArtifacts = decryptionShares.map((share) =>
    withArtifactSchema("tally-decryption-share", {
      ...share,
      productionSlice: {
        schemaVersion: "production-slice-decryption-share-v1",
        ballotCommitmentsHash: share.ballotCommitmentsHash,
        aggregateCountsHash: share.aggregateCountsHash,
        signature: share.signature
      }
    })
  );
  const manifest = buildArtifactManifest([
    referenceFor("question-body", bodyHash, "question-body"),
    referenceFor("sponsor-disclosure", sponsorDisclosureHash, "sponsor-disclosure"),
    referenceFor("tally-key-setup", tallyKeySetupArtifactHash, "tally-key-setup"),
    ...ballots.map((ballot) => referenceFor("production-slice-eligibility-proof", ballot.eligibilityProofArtifactHash, "eligibility-proof")),
    ...decryptionShareArtifacts.map((artifact) => referenceFor("tally-decryption-share", hashJson(artifact), "tally-decryption-share")),
    referenceFor("result-artifact", resultArtifactHash, "result"),
    referenceFor("result-challenge-evidence", challenge.evidenceHash, "challenge-evidence"),
    referenceFor("result-challenge-resolution", challengeResolutionHash, "challenge-resolution")
  ]);
  const archiveArtifact = withArtifactSchema("question-archive", {
    question,
    poll,
    tallyKeySetup: publicTallyKeySetup(tallyKeySetup),
    result,
    challenges: [challenge],
    events,
    resultArtifact,
    decryptionShares,
    bodyArtifact,
    sponsorArtifact,
    tallyKeySetupArtifact,
    eligibilityProofArtifacts,
    decryptionShareArtifacts,
    artifactManifest: manifest,
    artifactManifestHash: hashArtifactManifest(manifest.references),
    archivedAt: result.finalizedAt
  });
  const archiveHash = hashJson(archiveArtifact);
  const archive: ProductionSliceArchive = {
    id: "archive-transit-priority",
    questionId,
    archiveHash,
    artifactManifestHash: archiveArtifact.artifactManifestHash,
    archivedAt: result.finalizedAt ?? generatedAt
  };
  const archivedEvents = [
    ...events,
    event("QuestionArchived", question.id, "demo-curator", events.at(-1)?.newHash ?? null, archiveHash, archive.archivedAt)
  ];

  const bundleManifest = archiveArtifact.artifactManifest;
  const bundle: ArtifactExportBundle = {
    protocol: "popular-consensus",
    schemaVersion: "artifact-export-bundle-v1",
    root: bundleEntry("question-archive", archive.archiveHash, archiveArtifact, "archive"),
    manifest: bundleManifest,
    manifestHash: archive.artifactManifestHash,
    artifacts: [
      bundleEntry("question-body", bodyHash, bodyArtifact, "question-body"),
      bundleEntry("sponsor-disclosure", sponsorDisclosureHash, sponsorArtifact, "sponsor-disclosure"),
      bundleEntry("tally-key-setup", tallyKeySetupArtifactHash, tallyKeySetupArtifact, "tally-key-setup"),
      ...eligibilityProofArtifacts.map((artifact) =>
        bundleEntry("production-slice-eligibility-proof", hashJson(artifact), artifact, "eligibility-proof")
      ),
      ...decryptionShareArtifacts.map((artifact) =>
        bundleEntry("tally-decryption-share", hashJson(artifact), artifact, "tally-decryption-share")
      ),
      bundleEntry("result-artifact", resultArtifactHash, resultArtifact, "result"),
      bundleEntry("result-challenge-evidence", challenge.evidenceHash, challengeEvidence, "challenge-evidence"),
      bundleEntry("result-challenge-resolution", challengeResolutionHash, challengeResolution, "challenge-resolution")
    ]
  };

  return {
    input: {
      protocol: "popular-consensus",
      schemaVersion: "production-slice-input-v1",
      generatedAt,
      credentialSchema,
      credentialIssuer,
      trustPolicy,
      question,
      poll,
      tallyKeySetup: publicTallyKeySetup(tallyKeySetup),
      ballots,
      decryptionShares,
      result,
      challenges: [challenge],
      archive,
      events: archivedEvents,
      bundle
    },
    privateResponses
  };
}

export function verifyProductionSlice(input: ProductionSliceVerificationInput): ProductionSliceVerificationReport {
  const checks: ProductionSliceCheck[] = [];
  const addCheck = (id: string, ok: boolean, expected?: unknown, actual?: unknown, detail?: string) => {
    checks.push({ id, ok, expected, actual, detail });
  };
  const artifactEntries = artifactEntriesFromBundle(input.bundle);
  const artifactByHash = new Map(artifactEntries.map((entry) => [entry.hash, entry]));
  const resultEntry = artifactByHash.get(input.result.resultArtifactHash);
  const resultArtifact = isRecord(resultEntry?.value) ? (resultEntry.value as Partial<ProductionSliceResultArtifact>) : null;
  const archiveRoot = input.bundle.root;
  const archiveArtifact = isRecord(archiveRoot?.value) ? archiveRoot.value : null;
  const expectedQuestionVersionHash = questionVersionHash(input.question);
  const expectedTrustPolicyHash = credentialTrustPolicyHash(input.trustPolicy);
  const expectedTallyKeySetupHash = tallyKeySetupHash(input.tallyKeySetup);
  const ballotNullifiers = input.ballots.map((ballot) => ballot.nullifier);
  const uniqueNullifiers = new Set(ballotNullifiers);
  const expectedCommitments = sortedStrings(input.ballots.map((ballot) => ballot.ballotCommitment));
  const expectedCommitmentsHash = hashJson(expectedCommitments);
  const acceptedShares = input.decryptionShares.filter((share) => share.status === "Accepted");
  const acceptedShareHashes = sortedStrings(acceptedShares.map((share) => share.shareHash));
  const expectedShareSetHash = hashJson(acceptedShareHashes);
  const tallyMemberIds = input.tallyKeySetup.members.map((member) => member.memberId);
  const tallyMemberPublicKeys = input.tallyKeySetup.members.map((member) => normalizePem(member.publicKeyPem));
  const uniqueTallyMemberIds = new Set(tallyMemberIds);
  const uniqueTallyMemberPublicKeys = new Set(tallyMemberPublicKeys);
  const finalized = input.result.finalStatus === "Finalized";
  const pendingChallenges = input.challenges.filter((challenge) => challenge.ruling === "Pending");
  const manifest = input.bundle.manifest;
  const manifestHash = hashArtifactManifest(manifest.references);

  addCheck("input-protocol", input.protocol === "popular-consensus" && input.schemaVersion === "production-slice-input-v1", "production-slice-input-v1", input.schemaVersion);
  addCheck("crypto-mode-v1", resultArtifact?.cryptoMode === PRODUCTION_SLICE_CRYPTO_MODE, PRODUCTION_SLICE_CRYPTO_MODE, resultArtifact?.cryptoMode);
  addCheck("credential-schema-active", input.credentialSchema.status === "Active", "Active", input.credentialSchema.status);
  addCheck("credential-issuer-active", input.credentialIssuer.status === "Active", "Active", input.credentialIssuer.status);
  addCheck("issuer-approved-for-schema", input.credentialIssuer.schemaIds.includes(input.credentialSchema.id), input.credentialSchema.id, input.credentialIssuer.schemaIds);
  addCheck("trust-policy-active", input.trustPolicy.status === "Active", "Active", input.trustPolicy.status);
  addCheck("trust-policy-hash", input.trustPolicy.policyHash === expectedTrustPolicyHash, expectedTrustPolicyHash, input.trustPolicy.policyHash);
  addCheck("trust-policy-community", input.trustPolicy.communityId === input.question.communityId, input.question.communityId, input.trustPolicy.communityId);
  addCheck("trust-policy-schema", input.trustPolicy.credentialSchemaId === input.credentialSchema.id || input.trustPolicy.credentialSchemaId === "*", input.credentialSchema.id, input.trustPolicy.credentialSchemaId);
  addCheck("trust-policy-allows-issuer", trustPolicyAllows(input.trustPolicy, input.credentialIssuer), input.credentialIssuer.id, input.trustPolicy.trustedIssuerIds);
  addCheck("question-answer-schema", input.question.answerSchemaId === "answer-binary-support-oppose", "answer-binary-support-oppose", input.question.answerSchemaId);
  addCheck("question-credential-schema", input.question.credentialSchemaId === input.credentialSchema.id, input.credentialSchema.id, input.question.credentialSchemaId);
  addCheck("question-version-hash", input.question.versionHash === expectedQuestionVersionHash, expectedQuestionVersionHash, input.question.versionHash);
  addCheck("poll-question", input.poll.questionId === input.question.id, input.question.id, input.poll.questionId);
  addCheck("poll-credential-schema", input.poll.credentialSchemaId === input.question.credentialSchemaId, input.question.credentialSchemaId, input.poll.credentialSchemaId);
  addCheck("poll-tally-key", input.poll.tallyPublicKeyId === input.tallyKeySetup.publicKeyId && input.tallyKeySetup.pollId === input.poll.id, { pollId: input.poll.id, publicKeyId: input.poll.tallyPublicKeyId }, { pollId: input.tallyKeySetup.pollId, publicKeyId: input.tallyKeySetup.publicKeyId });
  addCheck("tally-key-custody-model", input.tallyKeySetup.custodyModel === "threshold-ed25519-attested-decryption-v1" && input.tallyKeySetup.privateKeyMaterial === "not-exported", "threshold custody without private key export", { custodyModel: input.tallyKeySetup.custodyModel, privateKeyMaterial: input.tallyKeySetup.privateKeyMaterial });
  addCheck("tally-key-ceremony-hash", input.tallyKeySetup.ceremonyHash === expectedTallyKeySetupHash, expectedTallyKeySetupHash, input.tallyKeySetup.ceremonyHash);
  addCheck("tally-members-present", input.tallyKeySetup.members.length > 0, "at least one member", input.tallyKeySetup.members.length);
  addCheck("tally-member-ids-unique", uniqueTallyMemberIds.size === tallyMemberIds.length, tallyMemberIds.length, uniqueTallyMemberIds.size);
  addCheck("tally-member-public-keys-unique", uniqueTallyMemberPublicKeys.size === tallyMemberPublicKeys.length, tallyMemberPublicKeys.length, uniqueTallyMemberPublicKeys.size);
  addCheck("tally-member-public-keys-valid", input.tallyKeySetup.members.every((member) => validEd25519PublicKey(member.publicKeyPem)), true, input.tallyKeySetup.members.map((member) => ({ memberId: member.memberId, valid: validEd25519PublicKey(member.publicKeyPem) })));
  addCheck("tally-threshold", input.tallyKeySetup.threshold > 1 && input.tallyKeySetup.threshold <= uniqueTallyMemberIds.size, "2..unique member count", input.tallyKeySetup.threshold);
  addCheck("no-private-key-material", !JSON.stringify(input).includes("PRIVATE KEY"), "no exported private keys", "input scanned");
  addCheck("ballots-present", input.ballots.length > 0, "at least one ballot", input.ballots.length);
  addCheck("duplicate-nullifiers", uniqueNullifiers.size === ballotNullifiers.length, ballotNullifiers.length, uniqueNullifiers.size);

  for (const ballot of input.ballots) {
    const eligibilityProofArtifact = artifactByHash.get(ballot.eligibilityProofArtifactHash);
    addCheck(`ballot-${ballot.id}-poll`, ballot.pollId === input.poll.id && ballot.questionId === input.question.id, { pollId: input.poll.id, questionId: input.question.id }, { pollId: ballot.pollId, questionId: ballot.questionId });
    addCheck(`ballot-${ballot.id}-trusted-issuer`, ballot.credentialSchemaId === input.credentialSchema.id && ballot.issuerId === input.credentialIssuer.id, { schemaId: input.credentialSchema.id, issuerId: input.credentialIssuer.id }, { schemaId: ballot.credentialSchemaId, issuerId: ballot.issuerId });
    addCheck(`ballot-${ballot.id}-proof-system`, ballot.proofSystem === PRODUCTION_SLICE_PROOF_SYSTEM && ballot.proofHash === ballot.eligibilityProof.proofHash, PRODUCTION_SLICE_PROOF_SYSTEM, { proofSystem: ballot.proofSystem, proofHash: ballot.proofHash, eligibilityProofHash: ballot.eligibilityProof.proofHash });
    addCheck(`ballot-${ballot.id}-proof-artifact`, Boolean(eligibilityProofArtifact && eligibilityProofArtifact.hash === hashJson(eligibilityProofArtifact.value)), ballot.eligibilityProofArtifactHash, eligibilityProofArtifact?.hash ?? null);
    addCheck(`ballot-${ballot.id}-proof-artifact-value`, isRecord(eligibilityProofArtifact?.value) && eligibilityProofArtifact.value.proofHash === ballot.eligibilityProof.proofHash, ballot.eligibilityProof.proofHash, isRecord(eligibilityProofArtifact?.value) ? eligibilityProofArtifact.value.proofHash : null);
    addCheck(`ballot-${ballot.id}-encrypted-payload-hash`, ballot.encryptedPayloadHash === hashJson(ballot.encryptedPayload), ballot.encryptedPayloadHash, hashJson(ballot.encryptedPayload));
    addCheck(`ballot-${ballot.id}-proof-signal`, ballot.eligibilityProof.signal === ballot.ballotCommitment, ballot.ballotCommitment, ballot.eligibilityProof.signal);
    addCheck(`ballot-${ballot.id}-proof-nullifier`, ballot.eligibilityProof.nullifier === ballot.nullifier, ballot.nullifier, ballot.eligibilityProof.nullifier);
    addCheck(`ballot-${ballot.id}-proof-scope`, ballot.eligibilityProof.scope === productionSliceAnonymousProofScope(input.poll.id, input.credentialSchema.id), productionSliceAnonymousProofScope(input.poll.id, input.credentialSchema.id), ballot.eligibilityProof.scope);
    addCheck(`ballot-${ballot.id}-proof-public-inputs`, ballot.eligibilityProof.publicInputsHash === eligibilityProofPublicInputsHash(ballot.eligibilityProof), eligibilityProofPublicInputsHash(ballot.eligibilityProof), ballot.eligibilityProof.publicInputsHash);
    addCheck(`ballot-${ballot.id}-proof-hash`, ballot.eligibilityProof.proofHash === eligibilityProofHash(ballot.eligibilityProof), eligibilityProofHash(ballot.eligibilityProof), ballot.eligibilityProof.proofHash);
    const proofSignatureValid = verifyEd25519(
      ballot.eligibilityProof.verifierPublicKeyPem,
      eligibilityProofVerificationPayload(ballot.eligibilityProof),
      ballot.eligibilityProof.verifierSignature
    );
    addCheck(`ballot-${ballot.id}-proof-verifier-signature`, proofSignatureValid, true, proofSignatureValid);
    addCheck(`ballot-${ballot.id}-commitment`, ballot.ballotCommitment === ballotCommitmentHash(ballot), ballotCommitmentHash(ballot), ballot.ballotCommitment);
  }

  const acceptedShareMemberIds = acceptedShares.map((share) => share.memberId);
  const authorizedMemberIds = new Set(input.tallyKeySetup.members.map((member) => member.memberId));
  addCheck("threshold-share-count", acceptedShares.length >= input.tallyKeySetup.threshold, `>= ${input.tallyKeySetup.threshold}`, acceptedShares.length);
  addCheck("threshold-share-unique-members", new Set(acceptedShareMemberIds).size === acceptedShareMemberIds.length, acceptedShareMemberIds.length, new Set(acceptedShareMemberIds).size);
  addCheck("threshold-share-unique-hashes", new Set(acceptedShareHashes).size === acceptedShareHashes.length, acceptedShareHashes.length, new Set(acceptedShareHashes).size);
  for (const share of input.decryptionShares) {
    const member = input.tallyKeySetup.members.find((candidate) => candidate.memberId === share.memberId);
    addCheck(`share-${share.id}-authorized-member`, Boolean(member && authorizedMemberIds.has(share.memberId)), Array.from(authorizedMemberIds), share.memberId);
    addCheck(`share-${share.id}-hash`, share.shareHash === decryptionShareHash(share), decryptionShareHash(share), share.shareHash);
    addCheck(`share-${share.id}-ballot-commitments`, share.ballotCommitmentsHash === expectedCommitmentsHash, expectedCommitmentsHash, share.ballotCommitmentsHash);
    addCheck(`share-${share.id}-aggregate`, share.aggregateCountsHash === input.result.aggregateCountsHash, input.result.aggregateCountsHash, share.aggregateCountsHash);
    const shareSignatureValid = Boolean(member && verifyEd25519(member.publicKeyPem, decryptionShareSignaturePayload(share), share.signature));
    addCheck(`share-${share.id}-signature`, shareSignatureValid, true, shareSignatureValid);
  }

  addCheck("result-artifact-present", Boolean(resultEntry), input.result.resultArtifactHash, resultEntry?.hash ?? null);
  addCheck("result-artifact-hash", Boolean(resultEntry && resultEntry.hash === hashJson(resultEntry.value)), input.result.resultArtifactHash, resultEntry ? hashJson(resultEntry.value) : null);
  addCheck("result-artifact-schema", resultArtifact?.artifactKind === "result-artifact" && resultArtifact.schemaVersion === "pc-result-artifact-v1", { artifactKind: "result-artifact", schemaVersion: "pc-result-artifact-v1" }, resultArtifact ? { artifactKind: resultArtifact.artifactKind, schemaVersion: resultArtifact.schemaVersion } : null);
  addCheck("result-record-artifact-hash", input.result.resultArtifactHash === resultEntry?.hash, input.result.resultArtifactHash, resultEntry?.hash ?? null);
  addCheck("result-turnout", input.result.turnout === input.ballots.length && resultArtifact?.turnout === input.ballots.length, input.ballots.length, { result: input.result.turnout, artifact: resultArtifact?.turnout });
  addCheck("result-invalid-ballots", input.result.invalidBallots === 0 && resultArtifact?.invalidBallots === 0, 0, { result: input.result.invalidBallots, artifact: resultArtifact?.invalidBallots });
  addCheck("result-aggregate-counts-hash", input.result.aggregateCountsHash === resultArtifact?.aggregateCountsHash && resultArtifact?.aggregateCountsHash === hashJson(resultArtifact.counts ?? {}), input.result.aggregateCountsHash, resultArtifact?.counts ? hashJson(resultArtifact.counts) : null);
  addCheck("result-ballot-commitment-set", sameJson(resultArtifact?.acceptedBallotCommitments ?? [], expectedCommitments), expectedCommitments, resultArtifact?.acceptedBallotCommitments ?? null);
  addCheck("result-ballot-commitment-set-hash", resultArtifact?.acceptedBallotCommitmentsHash === expectedCommitmentsHash, expectedCommitmentsHash, resultArtifact?.acceptedBallotCommitmentsHash ?? null);
  addCheck("result-tally-key-setup", resultArtifact?.tallyKeySetupHash === input.tallyKeySetup.ceremonyHash, input.tallyKeySetup.ceremonyHash, resultArtifact?.tallyKeySetupHash ?? null);
  addCheck("result-decryption-share-set", sameJson(resultArtifact?.decryptionShareHashes ?? [], acceptedShareHashes) && resultArtifact?.decryptionShareSetHash === expectedShareSetHash, { decryptionShareHashes: acceptedShareHashes, decryptionShareSetHash: expectedShareSetHash }, { decryptionShareHashes: resultArtifact?.decryptionShareHashes ?? null, decryptionShareSetHash: resultArtifact?.decryptionShareSetHash ?? null });
  addCheck("result-threshold-share-count", resultArtifact?.acceptedDecryptionShareCount === acceptedShares.length && acceptedShares.length >= input.tallyKeySetup.threshold, { accepted: acceptedShares.length, threshold: input.tallyKeySetup.threshold }, resultArtifact?.acceptedDecryptionShareCount ?? null);
  addCheck("result-tally-proof-hash", input.result.tallyProofHash === resultArtifact?.tallyProofHash && resultArtifact?.tallyProofHash === tallyPublicationProofHash({ pollId: input.poll.id, aggregateCountsHash: input.result.aggregateCountsHash, acceptedBallotCommitmentsHash: expectedCommitmentsHash, tallyKeySetupHash: input.tallyKeySetup.ceremonyHash, decryptionShareHashes: acceptedShareHashes }), input.result.tallyProofHash, resultArtifact?.tallyProofHash ?? null);
  addCheck("result-privacy-report-reference", input.result.privacyReportHash === resultArtifact?.privacyReportHash, input.result.privacyReportHash, resultArtifact?.privacyReportHash ?? null);
  addCheck("no-pending-challenges-before-finalization", !finalized || pendingChallenges.length === 0, [], pendingChallenges.map((challenge) => challenge.id));
  addCheck("finalization-after-publication", !finalized || Boolean(input.result.finalizedAt && input.result.finalizedAt >= input.result.publishedAt), `>= ${input.result.publishedAt}`, input.result.finalizedAt);
  addCheck("resolved-challenges-have-resolution", input.challenges.every((challenge) => challenge.ruling === "Pending" || Boolean(challenge.resolutionHash)), true, input.challenges.map((challenge) => ({ id: challenge.id, ruling: challenge.ruling, resolutionHash: challenge.resolutionHash })));
  addCheck("archive-root-present", Boolean(archiveRoot), input.archive.archiveHash, archiveRoot?.hash ?? null);
  addCheck("archive-root-hash", archiveRoot?.hash === input.archive.archiveHash && archiveRoot?.hash === hashJson(archiveRoot.value), input.archive.archiveHash, archiveRoot ? hashJson(archiveRoot.value) : null);
  addCheck("archive-record-manifest-hash", input.archive.artifactManifestHash === input.bundle.manifestHash && input.archive.artifactManifestHash === manifestHash, input.archive.artifactManifestHash, manifestHash);
  addCheck("archive-root-manifest-hash", optionalString(archiveArtifact?.artifactManifestHash) === input.archive.artifactManifestHash, input.archive.artifactManifestHash, archiveArtifact?.artifactManifestHash);
  addCheck("bundle-schema", input.bundle.protocol === "popular-consensus" && input.bundle.schemaVersion === "artifact-export-bundle-v1", "artifact-export-bundle-v1", input.bundle.schemaVersion);
  addCheck("bundle-artifact-hashes", input.bundle.artifacts.every((entry) => entry.hash === entry.computedHash && entry.hash === hashJson(entry.value)), true, input.bundle.artifacts.map((entry) => ({ hash: entry.hash, computedHash: entry.computedHash, actual: hashJson(entry.value) })));
  addCheck("manifest-references-present", manifest.references.every((reference) => artifactReferencePresent(reference, input.bundle.artifacts)), true, manifest.references.map((reference) => ({ kind: reference.kind, hash: reference.hash, present: artifactReferencePresent(reference, input.bundle.artifacts) })));
  addCheck("manifest-required-references", requiredArtifactReferencesPresent(manifest, input.challenges.length > 0), requiredArtifactReferenceKinds(input.challenges.length > 0), manifest.references.map((reference) => reference.kind));
  addCheck("event-previous-hash-continuity", previousHashesAreLinked(input.events), true, previousHashesAreLinked(input.events));
  addCheck("event-stream-required-types", requiredEventTypes(input.challenges.length > 0).every((eventType) => input.events.some((event) => event.eventType === eventType)), requiredEventTypes(input.challenges.length > 0), input.events.map((event) => event.eventType));

  const failedChecks = checks.filter((check) => !check.ok);
  return {
    protocol: "popular-consensus",
    schemaVersion: PRODUCTION_SLICE_SCHEMA_VERSION,
    status: failedChecks.length === 0 ? "Verified" : "Mismatch",
    cryptoMode: PRODUCTION_SLICE_CRYPTO_MODE,
    generatedAt: input.generatedAt,
    hashes: {
      eventStreamHash: hashEvents(input.events),
      transactionStreamHash: hashJson(input.events.map((event) => event.newHash)),
      resultArtifactHash: resultEntry?.hash ?? null,
      archiveHash: archiveRoot?.hash ?? null,
      archiveManifestHash: input.bundle.manifestHash,
      tallyKeySetupHash: input.tallyKeySetup.ceremonyHash,
      decryptionShareSetHash: expectedShareSetHash
    },
    counts: {
      ballots: input.ballots.length,
      uniqueNullifiers: uniqueNullifiers.size,
      challenges: input.challenges.length,
      threshold: input.tallyKeySetup.threshold,
      acceptedDecryptionShares: acceptedShares.length,
      checks: checks.length,
      failedChecks: failedChecks.length
    },
    checks
  };
}

export function productionSliceInputFromJson(value: unknown): ProductionSliceVerificationInput {
  if (isRecord(value) && isRecord(value.input)) return value.input as ProductionSliceVerificationInput;
  return value as ProductionSliceVerificationInput;
}

export function createProductionSliceExport(input: ProductionSliceVerificationInput): ProductionSliceExport {
  const report = verifyProductionSlice(input);
  return {
    protocol: "popular-consensus",
    schemaVersion: "production-slice-export-v1",
    generatedAt: Date.now(),
    status: report.status,
    input,
    report
  };
}

export function credentialTrustPolicyHash(policy: Omit<ProductionSliceTrustPolicy, "policyHash"> | ProductionSliceTrustPolicy): string {
  return hashJson({
    protocol: "pc-community-credential-trust-policy-v1",
    id: policy.id,
    communityId: policy.communityId,
    credentialSchemaId: policy.credentialSchemaId,
    trustedIssuerIds: sortedStrings(policy.trustedIssuerIds),
    mode: policy.mode,
    status: policy.status
  });
}

export function questionVersionHash(question: Omit<ProductionSliceQuestion, "versionHash"> | ProductionSliceQuestion): string {
  return hashJson({
    protocol: "pc-question-version-v1",
    id: question.id,
    communityId: question.communityId,
    version: question.version,
    title: question.title,
    bodyHash: question.bodyHash,
    sponsorDisclosureHash: question.sponsorDisclosureHash,
    answerSchemaId: question.answerSchemaId,
    credentialSchemaId: question.credentialSchemaId,
    methodologyLabel: question.methodologyLabel,
    authorityLevel: question.authorityLevel
  });
}

export function tallyKeySetupHash(setup: Omit<ProductionSliceTallyKeySetup, "ceremonyHash"> | ProductionSliceTallyKeySetup): string {
  return hashJson({
    protocol: "pc-threshold-tally-key-setup-v1",
    id: setup.id,
    committeeId: setup.committeeId,
    pollId: setup.pollId,
    publicKeyId: setup.publicKeyId,
    custodyModel: setup.custodyModel,
    privateKeyMaterial: setup.privateKeyMaterial,
    threshold: setup.threshold,
    members: setup.members.map((member) => ({ memberId: member.memberId, publicKeyPem: normalizePem(member.publicKeyPem) }))
  });
}

export function ballotCommitmentHash(ballot: Pick<ProductionSliceBallot, "nullifier" | "encryptedPayload">): string {
  return hashJson({ payload: ballot.encryptedPayload, nullifier: ballot.nullifier });
}

export function decryptionShareHash(share: Pick<ProductionSliceTallyDecryptionShare, "pollId" | "tallyKeySetupId" | "memberId" | "ballotCommitmentsHash" | "aggregateCountsHash" | "proofHash" | "status">): string {
  return hashJson({
    protocol: "pc-threshold-decryption-share-v1",
    pollId: share.pollId,
    tallyKeySetupId: share.tallyKeySetupId,
    memberId: share.memberId,
    ballotCommitmentsHash: share.ballotCommitmentsHash,
    aggregateCountsHash: share.aggregateCountsHash,
    proofHash: share.proofHash,
    status: share.status
  });
}

export function hashEvents(events: ProductionSliceEvent[]): string {
  return hashJson(events.map((event) => ({ eventType: event.eventType, subjectId: event.subjectId, previousHash: event.previousHash, newHash: event.newHash })));
}

const REQUIRED_BASE_ARTIFACT_REFERENCE_KINDS = [
  "question-body",
  "sponsor-disclosure",
  "production-slice-eligibility-proof",
  "tally-key-setup",
  "tally-decryption-share",
  "result-artifact"
];

const REQUIRED_CHALLENGE_ARTIFACT_REFERENCE_KINDS = [
  "result-challenge-evidence",
  "result-challenge-resolution"
];

const REQUIRED_BASE_EVENT_TYPES = [
  "CredentialIssuerRegistered",
  "CommunityCredentialTrustPolicySet",
  "QuestionSubmitted",
  "PollOpened",
  "BallotAccepted",
  "PollClosed",
  "TallyDecryptionShareSubmitted",
  "ResultPublished",
  "ResultFinalized",
  "QuestionArchived"
];

const REQUIRED_CHALLENGE_EVENT_TYPES = ["ResultChallengeResolved"];

function createFixtureBallot(input: {
  index: number;
  pollId: string;
  questionId: string;
  credentialSchemaId: string;
  issuerId: string;
  groupId: string;
  groupRoot: string;
  scope: string;
  response: BallotResponse;
  submittedAt: number;
}): ProductionSliceBallot {
  const responseCommitment = hashJson({ protocol: "private-fixture-response-v1", response: input.response });
  const encryptedPayload: EncryptedBallotPayload = {
    version: "pc-encrypted-ballot-v1",
    ephemeralPublicKeyPem: `fixture-ephemeral-public-key-${input.index}`,
    iv: hashJson({ field: "iv", index: input.index }).slice(7, 31),
    authTag: hashJson({ field: "auth-tag", index: input.index }).slice(7, 39),
    ciphertext: hashJson({ field: "ciphertext", responseCommitment })
  };
  const encryptedPayloadHash = hashJson(encryptedPayload);
  const nullifier = hashJson({
    protocol: "pc-semaphore-nullifier-fixture-v1",
    pollId: input.pollId,
    credentialSchemaId: input.credentialSchemaId,
    identityIndex: input.index
  });
  const ballotCommitment = hashJson({ payload: encryptedPayload, nullifier });
  const proofWithoutSignature: Omit<ProductionSliceEligibilityProof, "proofHash" | "verifierSignature"> = {
    protocol: "popular-consensus",
    schemaVersion: "production-slice-eligibility-proof-v1",
    proofSystem: PRODUCTION_SLICE_PROOF_SYSTEM,
    groupId: input.groupId,
    groupRoot: input.groupRoot,
    signal: ballotCommitment,
    scope: input.scope,
    nullifier,
    publicInputsHash: hashJson({
      protocol: "pc-semaphore-public-inputs-v1",
      groupRoot: input.groupRoot,
      signal: ballotCommitment,
      scope: input.scope,
      nullifier
    }),
    verifier: "@semaphore-protocol/core.verifyProof",
    verifierPublicKeyPem: PROOF_VERIFIER_KEY.publicKeyPem,
    verificationStatus: "Verified"
  };
  const proofHash = eligibilityProofHash(proofWithoutSignature);
  const eligibilityProof: ProductionSliceEligibilityProof = {
    ...proofWithoutSignature,
    proofHash,
    verifierSignature: signEd25519(PROOF_VERIFIER_KEY.privateKeyPem, eligibilityProofVerificationPayload({ ...proofWithoutSignature, proofHash }))
  };
  const eligibilityProofArtifactHash = hashJson(withArtifactSchema("production-slice-eligibility-proof", eligibilityProof));
  const ballot = {
    id: `ballot-${input.index + 1}`,
    pollId: input.pollId,
    questionId: input.questionId,
    credentialSchemaId: input.credentialSchemaId,
    issuerId: input.issuerId,
    nullifier,
    encryptedPayload,
    encryptedPayloadHash,
    ballotCommitment,
    proofHash,
    proofSystem: PRODUCTION_SLICE_PROOF_SYSTEM,
    eligibilityProofArtifactHash,
    eligibilityProof,
    submittedAt: input.submittedAt
  } satisfies ProductionSliceBallot;
  return ballot;
}

function createFixtureDecryptionShare(input: {
  member: TestKeypair & { memberId: string };
  pollId: string;
  tallyKeySetupId: string;
  aggregateCountsHash: string;
  ballotCommitmentsHash: string;
  submittedAt: number;
}): ProductionSliceTallyDecryptionShare {
  const withoutHash = {
    id: `decryption-share-${input.member.memberId}`,
    pollId: input.pollId,
    tallyKeySetupId: input.tallyKeySetupId,
    memberId: input.member.memberId,
    ballotCommitmentsHash: input.ballotCommitmentsHash,
    aggregateCountsHash: input.aggregateCountsHash,
    proofHash: hashJson({
      protocol: "pc-threshold-decryption-share-proof-v1",
      pollId: input.pollId,
      tallyKeySetupId: input.tallyKeySetupId,
      memberId: input.member.memberId,
      ballotCommitmentsHash: input.ballotCommitmentsHash,
      aggregateCountsHash: input.aggregateCountsHash
    }),
    status: "Accepted" as const
  };
  const shareHash = decryptionShareHash(withoutHash);
  return {
    ...withoutHash,
    shareHash,
    signature: signEd25519(input.member.privateKeyPem, decryptionShareSignaturePayload({ ...withoutHash, shareHash })),
    submittedAt: input.submittedAt
  };
}

function buildFixtureEvents(input: {
  generatedAt: number;
  question: ProductionSliceQuestion;
  poll: ProductionSlicePoll;
  tallyKeySetup: ProductionSliceTallyKeySetup;
  ballots: ProductionSliceBallot[];
  decryptionShares: ProductionSliceTallyDecryptionShare[];
  result: ProductionSliceResult;
  challenge: ProductionSliceChallenge;
  trustPolicy: ProductionSliceTrustPolicy;
}): ProductionSliceEvent[] {
  const events: ProductionSliceEvent[] = [];
  const append = (eventType: string, subjectId: string, actor: string, newHash: string, emittedAt: number) => {
    events.push(event(eventType, subjectId, actor, events.at(-1)?.newHash ?? null, newHash, emittedAt));
  };
  append("CredentialIssuerRegistered", input.trustPolicy.credentialSchemaId, "issuer-admin", input.trustPolicy.credentialSchemaId, input.generatedAt);
  append("CommunityCredentialTrustPolicySet", input.trustPolicy.communityId, "demo-curator", input.trustPolicy.policyHash, input.generatedAt + 1);
  append("QuestionSubmitted", input.question.id, "demo-proposer", input.question.versionHash, input.generatedAt + 2);
  append("PollOpened", input.poll.id, "demo-curator", hashJson(input.poll), input.poll.openedAt);
  for (const ballot of input.ballots) append("BallotAccepted", input.poll.id, "anonymous-voter", ballot.ballotCommitment, ballot.submittedAt);
  append("PollClosed", input.poll.id, "demo-curator", hashJson({ pollId: input.poll.id, status: "Closed" }), input.poll.closedAt);
  for (const share of input.decryptionShares) {
    append("TallyDecryptionShareSubmitted", share.pollId, share.memberId, share.shareHash, share.submittedAt);
  }
  append("ResultPublished", input.poll.id, "demo-curator", input.result.resultArtifactHash, input.result.publishedAt);
  append("ResultChallengeResolved", input.challenge.id, "demo-juror", input.challenge.resolutionHash ?? input.challenge.evidenceHash, input.result.publishedAt + 1_000);
  append("ResultFinalized", input.poll.id, "demo-curator", hashJson({ pollId: input.poll.id, finalStatus: "Finalized", resultArtifactHash: input.result.resultArtifactHash }), input.result.finalizedAt ?? input.result.challengeWindowEndsAt);
  return events;
}

export function eligibilityProofHash(proof: Omit<ProductionSliceEligibilityProof, "proofHash" | "verifierSignature"> | ProductionSliceEligibilityProof): string {
  return hashJson({
    protocol: "pc-semaphore-proof-boundary-v1",
    proofSystem: proof.proofSystem,
    groupId: proof.groupId,
    groupRoot: proof.groupRoot,
    signal: proof.signal,
    scope: proof.scope,
    nullifier: proof.nullifier,
    publicInputsHash: proof.publicInputsHash,
    verifier: proof.verifier,
    verifierPublicKeyPem: normalizePem(proof.verifierPublicKeyPem),
    verificationStatus: proof.verificationStatus
  });
}

export function eligibilityProofPublicInputsHash(proof: Pick<ProductionSliceEligibilityProof, "groupRoot" | "signal" | "scope" | "nullifier">): string {
  return hashJson({
    protocol: "pc-semaphore-public-inputs-v1",
    groupRoot: proof.groupRoot,
    signal: proof.signal,
    scope: proof.scope,
    nullifier: proof.nullifier
  });
}

export function eligibilityProofVerificationPayload(proof: Omit<ProductionSliceEligibilityProof, "verifierSignature">): string {
  return hashJson({
    protocol: "pc-semaphore-proof-verification-attestation-v1",
    proofHash: proof.proofHash,
    groupId: proof.groupId,
    groupRoot: proof.groupRoot,
    signal: proof.signal,
    scope: proof.scope,
    nullifier: proof.nullifier,
    publicInputsHash: proof.publicInputsHash,
    verifier: proof.verifier,
    verificationStatus: proof.verificationStatus
  });
}

export function decryptionShareSignaturePayload(share: Pick<ProductionSliceTallyDecryptionShare, "pollId" | "tallyKeySetupId" | "memberId" | "ballotCommitmentsHash" | "aggregateCountsHash" | "shareHash" | "proofHash" | "status">): string {
  return hashJson({
    protocol: "pc-threshold-decryption-share-signature-v1",
    pollId: share.pollId,
    tallyKeySetupId: share.tallyKeySetupId,
    memberId: share.memberId,
    ballotCommitmentsHash: share.ballotCommitmentsHash,
    aggregateCountsHash: share.aggregateCountsHash,
    shareHash: share.shareHash,
    proofHash: share.proofHash,
    status: share.status
  });
}

export function tallyPublicationProofHash(input: {
  pollId: string;
  aggregateCountsHash: string;
  acceptedBallotCommitmentsHash: string;
  tallyKeySetupHash: string;
  decryptionShareHashes: string[];
}): string {
  return hashJson({
    protocol: "pc-threshold-tally-publication-proof-v1",
    pollId: input.pollId,
    aggregateCountsHash: input.aggregateCountsHash,
    acceptedBallotCommitmentsHash: input.acceptedBallotCommitmentsHash,
    tallyKeySetupHash: input.tallyKeySetupHash,
    decryptionShareHashes: sortedStrings(input.decryptionShareHashes)
  });
}

export function productionSliceAnonymousProofScope(pollId: string, credentialSchemaId: string): string {
  return hashJson({ protocol: "pc-anonymous-poll-scope-v1", pollId, credentialSchemaId, pollVersion: "v1" });
}

function event(
  eventType: string,
  subjectId: string,
  actor: string,
  previousHash: string | null,
  newHash: string,
  emittedAt: number
): ProductionSliceEvent {
  return { eventType, subjectId, actor, previousHash, newHash, emittedAt };
}

function referenceFor(kind: ArtifactKind, hash: string | null, role: string): ArtifactReference {
  if (!hash) throw new Error(`Cannot reference missing ${kind} artifact`);
  return { kind, hash, role };
}

function bundleEntry(kind: ArtifactKind, hash: string, value: unknown, role: string): ArtifactExportBundleEntry {
  return { kind, hash, role, computedHash: hashJson(value), value };
}

function artifactEntriesFromBundle(bundle: ArtifactExportBundle): ArtifactExportBundleEntry[] {
  return [...(bundle.root ? [bundle.root] : []), ...bundle.artifacts];
}

function trustPolicyAllows(policy: ProductionSliceTrustPolicy, issuer: ProductionSliceCredentialIssuer): boolean {
  if (policy.status !== "Active") return false;
  if (policy.mode === "Open") return true;
  return policy.trustedIssuerIds.includes("*") || policy.trustedIssuerIds.includes(issuer.id);
}

function artifactReferencePresent(reference: ArtifactReference, artifacts: ArtifactExportBundleEntry[]): boolean {
  return artifacts.some((artifact) => artifact.kind === reference.kind && artifact.hash === reference.hash);
}

function requiredArtifactReferencesPresent(manifest: ArtifactManifest, includeChallengeArtifacts: boolean): boolean {
  const kinds = new Set(manifest.references.map((reference) => reference.kind));
  return requiredArtifactReferenceKinds(includeChallengeArtifacts).every((kind) => kinds.has(kind));
}

function requiredArtifactReferenceKinds(includeChallengeArtifacts: boolean): string[] {
  return includeChallengeArtifacts
    ? [...REQUIRED_BASE_ARTIFACT_REFERENCE_KINDS, ...REQUIRED_CHALLENGE_ARTIFACT_REFERENCE_KINDS]
    : REQUIRED_BASE_ARTIFACT_REFERENCE_KINDS;
}

function requiredEventTypes(includeChallengeEvents: boolean): string[] {
  return includeChallengeEvents ? [...REQUIRED_BASE_EVENT_TYPES, ...REQUIRED_CHALLENGE_EVENT_TYPES] : REQUIRED_BASE_EVENT_TYPES;
}

function previousHashesAreLinked(events: ProductionSliceEvent[]): boolean {
  const seenHashes = new Set<string>();
  for (const event of events) {
    if (event.previousHash && !seenHashes.has(event.previousHash)) return false;
    seenHashes.add(event.newHash);
  }
  return true;
}

function publicTallyKeySetup(setup: ProductionSliceTallyKeySetup): ProductionSliceTallyKeySetup {
  return {
    ...setup,
    members: setup.members.map((member) => ({ memberId: member.memberId, publicKeyPem: member.publicKeyPem }))
  };
}

export function signEd25519(privateKeyPem: string, payload: string): string {
  return sign(null, Buffer.from(payload, "utf8"), createPrivateKey(privateKeyPem)).toString("base64");
}

export function verifyEd25519(publicKeyPem: string, payload: string, signature: string): boolean {
  try {
    return verify(null, Buffer.from(payload, "utf8"), createPublicKey(publicKeyPem), Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

function validEd25519PublicKey(publicKeyPem: string): boolean {
  try {
    return createPublicKey(publicKeyPem).asymmetricKeyType === "ed25519";
  } catch {
    return false;
  }
}

function sortedStrings(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function sameJson(left: unknown, right: unknown): boolean {
  return hashJson(left) === hashJson(right);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePem(value: string): string {
  return value.trim();
}

function pem(label: "PRIVATE KEY" | "PUBLIC KEY", body: string): string {
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----\n`;
}
