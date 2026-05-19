import { hashJson } from "@pc/artifacts";
import type { ProductionSliceEvent } from "@pc/protocol-slice";
import type { ReplayCheck, ReplayStatus } from "./index";

export type OnchainEventLog = {
  eventName: string;
  args?: Record<string, unknown>;
  address?: string;
  blockNumber?: bigint | number | string;
  blockTimestamp?: bigint | number | string | Date;
  transactionHash?: string;
  logIndex?: number;
};

export type OnchainEventMapping = {
  solidityEvent: string;
  canonicalEvent: string;
  module: string;
  subjectArg: string;
  newHashArg?: string;
  actorArg?: string;
  requiredHashes: string[];
};

export type OnchainEventAdapterResult =
  | {
      ok: true;
      sourceEventName: string;
      mapping: OnchainEventMapping;
      event: ProductionSliceEvent;
    }
  | {
      ok: false;
      sourceEventName: string;
      check: ReplayCheck;
    };

export type OnchainEventStreamReport = {
  protocol: "popular-consensus";
  schemaVersion: "pc-onchain-event-adapter-report-v1";
  status: ReplayStatus;
  checks: ReplayCheck[];
  events: ProductionSliceEvent[];
};

export const ONCHAIN_EVENT_MAPPINGS: OnchainEventMapping[] = [
  mapping("StewardTransferred", "ProtocolStewardTransferred", "ProtocolAccess", "newSteward", "newSteward", "previousSteward", ["previousSteward", "newSteward"]),
  mapping("CredentialSchemaRegistered", "CredentialSchemaRegistered", "CredentialRegistry", "schemaId", "schemaId", undefined, ["schemaId"]),
  mapping("CredentialIssuerRegistered", "CredentialIssuerRegistered", "CredentialRegistry", "issuerId", "schemaId", undefined, ["issuerId", "schemaId"]),
  mapping("CredentialIssuerSuspended", "CredentialIssuerSuspended", "CredentialRegistry", "issuerId", "suspensionHash", undefined, ["issuerId", "suspensionHash"]),
  mapping("CredentialRevocationRootUpdated", "CredentialRevocationRootUpdated", "CredentialRegistry", "schemaId", "revocationRoot", undefined, ["schemaId", "revocationRoot"]),
  mapping("CommunityCredentialTrustPolicySet", "CommunityCredentialTrustPolicySet", "CredentialRegistry", "communityId", "trustPolicyHash", undefined, ["communityId", "trustPolicyHash"]),
  mapping("TallyCommitteeActivated", "TallyCommitteeActivated", "TallyManager", "committeeId", "activationHash", undefined, ["committeeId", "activationHash"]),
  mapping("TallyCommitteeProposed", "TallyCommitteeProposed", "TallyManager", "committeeId", "metadataHash", undefined, [
    "committeeId",
    "communityId",
    "metadataHash",
    "threshold",
    "memberCount"
  ]),
  mapping("TallyKeySetupPublished", "TallyKeySetupPublished", "TallyManager", "setupId", "setupHash", undefined, ["setupId", "committeeId", "publicKeyId", "setupHash"]),
  mapping("QuestionSubmitted", "QuestionSubmitted", "QuestionRegistry", "questionId", "versionHash", "proposer", ["questionId", "versionHash", "bondId"]),
  mapping("QuestionAmended", "QuestionAmended", "QuestionRegistry", "questionId", "versionHash", undefined, ["questionId", "versionHash"]),
  mapping("QuestionAccepted", "QuestionAccepted", "QuestionRegistry", "questionId", undefined, "curator", ["questionId"]),
  mapping("QuestionStatusChanged", "QuestionStatusChanged", "QuestionRegistry", "questionId", undefined, undefined, ["questionId", "status"]),
  mapping("QuestionRejected", "QuestionRejected", "QuestionRegistry", "questionId", "reasonHash", undefined, ["questionId", "reasonHash"]),
  mapping("PollConfigured", "PollConfigured", "PollManager", "pollId", "tallyPublicKeyId", undefined, ["pollId", "questionId", "credentialSchemaId", "tallyPublicKeyId"]),
  mapping("PollOpened", "PollOpened", "PollManager", "pollId", undefined, undefined, ["pollId", "questionId"]),
  mapping("BallotAccepted", "BallotAccepted", "PollManager", "pollId", "ballotCommitment", undefined, ["pollId", "nullifier", "ballotCommitment", "encryptedPayloadHash", "proofHash"]),
  mapping("PollClosed", "PollClosed", "PollManager", "pollId", undefined, undefined, ["pollId"]),
  mapping("PollStatusChanged", "PollStatusChanged", "PollManager", "pollId", undefined, undefined, ["pollId", "status"]),
  mapping("TallyDecryptionShareSubmitted", "TallyDecryptionShareSubmitted", "TallyManager", "pollId", "shareHash", undefined, ["shareId", "pollId", "setupId", "memberId", "shareHash", "proofHash"]),
  mapping("ResultChallenged", "ResultChallenged", "ChallengeCourt", "targetId", "resultChallengeId", undefined, ["resultChallengeId", "targetId", "reasonCode"]),
  mapping("ResultChallengeRuled", "ResultChallengeResolved", "ChallengeCourt", "resultChallengeId", "resolutionHash", undefined, ["resultChallengeId", "ruling", "resolutionHash"]),
  mapping("ResultCorrected", "ResultCorrected", "ResultArchive", "pollId", "correctedArtifactHash", undefined, ["pollId", "correctedArtifactHash", "correctionHash"]),
  mapping("ResultFinalized", "ResultFinalized", "ResultArchive", "pollId", undefined, undefined, ["pollId"]),
  mapping("QuestionArchived", "QuestionArchived", "ResultArchive", "questionId", "archiveHash", "archivedBy", ["questionId", "archiveHash"])
];

const MAPPING_BY_EVENT = new Map(ONCHAIN_EVENT_MAPPINGS.map((entry) => [entry.solidityEvent, entry]));

export function adaptOnchainEvent(log: OnchainEventLog, previousHash: string | null = null): OnchainEventAdapterResult {
  const mapping = mappingForLog(log);
  if (!mapping) {
    return {
      ok: false,
      sourceEventName: log.eventName,
      check: {
        id: "onchain-event-supported",
        ok: false,
        expected: [...MAPPING_BY_EVENT.keys()],
        actual: log.eventName,
        detail: "Unknown or out-of-scope onchain event names fail replay adaptation"
      }
    };
  }

  const args = log.args ?? {};
  const missing = mapping.requiredHashes.filter((name) => args[name] === undefined || args[name] === null);
  if (missing.length > 0) {
    return {
      ok: false,
      sourceEventName: log.eventName,
      check: {
        id: "onchain-event-required-args",
        ok: false,
        expected: mapping.requiredHashes,
        actual: Object.keys(args),
        detail: `Missing required event argument(s): ${missing.join(", ")}`
      }
    };
  }

  const subjectId = valueString(args[mapping.subjectArg]);
  if (!subjectId) {
    return missingArg(log.eventName, mapping.subjectArg);
  }

  const newHash = mapping.newHashArg ? valueString(args[mapping.newHashArg]) : hashJson({ eventName: log.eventName, args });
  if (!newHash) {
    return missingArg(log.eventName, mapping.newHashArg ?? "newHash");
  }

  return {
    ok: true,
    sourceEventName: log.eventName,
    mapping,
    event: {
      eventType: mapping.canonicalEvent,
      subjectId,
      actor: actorForLog(log, mapping),
      previousHash,
      newHash,
      emittedAt: emittedAt(log)
    }
  };
}

export function adaptOnchainEventStream(logs: OnchainEventLog[]): OnchainEventStreamReport {
  const checks: ReplayCheck[] = [];
  const events: ProductionSliceEvent[] = [];

  for (const log of logs) {
    const result = adaptOnchainEvent(log, events.at(-1)?.newHash ?? null);
    if (result.ok) {
      events.push(result.event);
      checks.push({ id: `onchain-event-${log.eventName}`, ok: true });
    } else {
      checks.push(result.check);
    }
  }

  checks.push({
    id: "onchain-events-adapted",
    ok: checks.every((check) => check.ok),
    expected: logs.length,
    actual: events.length
  });

  return {
    protocol: "popular-consensus",
    schemaVersion: "pc-onchain-event-adapter-report-v1",
    status: checks.every((check) => check.ok) ? "Verified" : "Mismatch",
    checks,
    events
  };
}

function mapping(
  solidityEvent: string,
  canonicalEvent: string,
  module: string,
  subjectArg: string,
  newHashArg: string | undefined,
  actorArg: string | undefined,
  requiredHashes: string[]
): OnchainEventMapping {
  return { solidityEvent, canonicalEvent, module, subjectArg, newHashArg, actorArg, requiredHashes };
}

function mappingForLog(log: OnchainEventLog) {
  if (log.eventName === "ResultPublished" && log.args && "artifactHash" in log.args) {
    return mapping("ResultPublished", "ResultPublished", "ResultArchive", "pollId", "artifactHash", undefined, [
      "pollId",
      "artifactHash",
      "aggregateCountsHash",
      "tallyProofHash",
      "tallyPublicationProofHash"
    ]);
  }
  if (log.eventName === "ResultPublished" && log.args && "tallyPublicationProofHash" in log.args) {
    return mapping("ResultPublished", "TallyResultPublished", "TallyManager", "pollId", "tallyPublicationProofHash", undefined, [
      "pollId",
      "setupId",
      "tallyPublicationProofHash",
      "acceptedShareCount"
    ]);
  }
  if (log.eventName === "QuestionArchived" && log.args && "artifactManifestHash" in log.args) {
    return mapping("QuestionArchived", "QuestionArchived", "ResultArchive", "questionId", "archiveHash", "archivedBy", [
      "questionId",
      "archiveHash",
      "artifactManifestHash"
    ]);
  }
  return MAPPING_BY_EVENT.get(log.eventName);
}

function actorForLog(log: OnchainEventLog, mapping: OnchainEventMapping) {
  const argActor = mapping.actorArg ? valueString(log.args?.[mapping.actorArg]) : null;
  return argActor ?? log.address ?? "onchain";
}

function emittedAt(log: OnchainEventLog) {
  if (log.blockTimestamp instanceof Date) return log.blockTimestamp.getTime();
  if (typeof log.blockTimestamp === "bigint") return Number(log.blockTimestamp);
  if (typeof log.blockTimestamp === "number") return log.blockTimestamp;
  if (typeof log.blockTimestamp === "string") {
    const numeric = Number(log.blockTimestamp);
    return Number.isFinite(numeric) ? numeric : new Date(log.blockTimestamp).getTime();
  }
  if (typeof log.blockNumber === "bigint") return Number(log.blockNumber);
  if (typeof log.blockNumber === "number") return log.blockNumber;
  if (typeof log.blockNumber === "string") {
    const numeric = Number(log.blockNumber);
    return Number.isFinite(numeric) ? numeric : 0;
  }
  return 0;
}

function valueString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") return String(value);
  return null;
}

function missingArg(sourceEventName: string, argName: string): OnchainEventAdapterResult {
  return {
    ok: false,
    sourceEventName,
    check: {
      id: "onchain-event-required-args",
      ok: false,
      expected: argName,
      actual: null,
      detail: `Missing required event argument: ${argName}`
    }
  };
}
