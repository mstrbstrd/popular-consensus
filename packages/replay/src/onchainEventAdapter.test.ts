import { describe, expect, it } from "vitest";
import { adaptOnchainEvent, adaptOnchainEventStream } from "./onchainEventAdapter";

describe("onchain event adapter", () => {
  it("maps grant-critical Solidity events into canonical replay events", () => {
    const report = adaptOnchainEventStream([
      {
        eventName: "StewardTransferred",
        args: { previousSteward: "0x0000000000000000000000000000000000000000", newSteward: "0xsteward" },
        blockTimestamp: 0
      },
      {
        eventName: "CredentialIssuerRegistered",
        args: { issuerId: "0xissuer", schemaId: "0xschema" },
        blockTimestamp: 1
      },
      {
        eventName: "TallyCommitteeProposed",
        args: { committeeId: 1, communityId: "0xcommunity", metadataHash: "0xmetadata", threshold: 2, memberCount: 3 },
        blockTimestamp: 2
      },
      {
        eventName: "CommunityCredentialTrustPolicySet",
        args: { communityId: "0xcommunity", trustPolicyHash: "0xpolicy" },
        blockTimestamp: 3
      },
      {
        eventName: "QuestionSubmitted",
        args: { questionId: "0xquestion", versionHash: "0xversion", proposer: "0xproposer", bondId: 7 },
        blockTimestamp: 4
      },
      {
        eventName: "QuestionStatusChanged",
        args: { questionId: "0xquestion", status: 1 },
        blockTimestamp: 5
      },
      {
        eventName: "PollOpened",
        args: { pollId: 1, questionId: "0xquestion" },
        blockTimestamp: 6
      },
      {
        eventName: "BallotAccepted",
        args: { pollId: 1, nullifier: "0xnullifier", ballotCommitment: "0xcommitment", encryptedPayloadHash: "0xpayload", proofHash: "0xproof" },
        blockTimestamp: 7
      },
      {
        eventName: "PollClosed",
        args: { pollId: 1 },
        blockTimestamp: 8
      },
      {
        eventName: "PollStatusChanged",
        args: { pollId: 1, status: 2 },
        blockTimestamp: 9
      },
      {
        eventName: "TallyDecryptionShareSubmitted",
        args: { shareId: 1, pollId: 1, setupId: 1, memberId: "0xmember", shareHash: "0xshare", proofHash: "0xshareproof" },
        blockTimestamp: 10
      },
      {
        eventName: "ResultPublished",
        args: {
          pollId: 1,
          artifactHash: "0xresult",
          aggregateCountsHash: "0xaggregate",
          tallyProofHash: "0xtally",
          tallyPublicationProofHash: "0xpublication",
          turnout: 1,
          invalidBallots: 0
        },
        blockTimestamp: 11
      },
      {
        eventName: "ResultFinalized",
        args: { pollId: 1 },
        blockTimestamp: 12
      },
      {
        eventName: "QuestionArchived",
        args: { questionId: "0xquestion", archiveHash: "0xarchive", artifactManifestHash: "0xmanifest", archivedBy: "0xcurator" },
        blockTimestamp: 13
      }
    ]);

    expect(report.status).toBe("Verified");
    expect(report.events.map((event) => event.eventType)).toEqual([
      "ProtocolStewardTransferred",
      "CredentialIssuerRegistered",
      "TallyCommitteeProposed",
      "CommunityCredentialTrustPolicySet",
      "QuestionSubmitted",
      "QuestionStatusChanged",
      "PollOpened",
      "BallotAccepted",
      "PollClosed",
      "PollStatusChanged",
      "TallyDecryptionShareSubmitted",
      "ResultPublished",
      "ResultFinalized",
      "QuestionArchived"
    ]);
    expect(report.events[1].previousHash).toBe(report.events[0].newHash);
    expect(report.events.at(-1)).toMatchObject({
      eventType: "QuestionArchived",
      subjectId: "0xquestion",
      actor: "0xcurator",
      newHash: "0xarchive"
    });
  });

  it("maps result challenge rulings to the canonical resolved event", () => {
    const result = adaptOnchainEvent({
      eventName: "ResultChallengeRuled",
      args: { resultChallengeId: 42, ruling: 1, resolutionHash: "0xresolution" }
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.event).toMatchObject({
        eventType: "ResultChallengeResolved",
        subjectId: "42",
        newHash: "0xresolution"
      });
    }
  });

  it("fails unknown onchain event names instead of silently dropping them", () => {
    const report = adaptOnchainEventStream([{ eventName: "Transfer", args: { from: "0xa", to: "0xb", amount: 1 } }]);

    expect(report.status).toBe("Mismatch");
    expect(report.events).toHaveLength(0);
    expect(report.checks.some((check) => !check.ok && check.id === "onchain-event-supported")).toBe(true);
  });

  it("fails mapped events with missing required hashes", () => {
    const result = adaptOnchainEvent({ eventName: "BallotAccepted", args: { pollId: 1, nullifier: "0xnullifier" } });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.check).toMatchObject({
        id: "onchain-event-required-args",
        ok: false
      });
      expect(result.check.detail).toContain("ballotCommitment");
    }
  });
});
