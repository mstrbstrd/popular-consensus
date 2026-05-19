import { describe, expect, it } from "vitest";
import { verifyDecodedChain } from "./verifyChain";

describe("chain replay verification", () => {
  it("verifies a decoded grant-critical onchain lifecycle", () => {
    const report = verifyDecodedChain({
      logs: [
        { eventName: "CredentialIssuerRegistered", args: { issuerId: "0xissuer", schemaId: "0xschema" }, blockNumber: 1n },
        { eventName: "CommunityCredentialTrustPolicySet", args: { communityId: "0xcommunity", trustPolicyHash: "0xpolicy" }, blockNumber: 2n },
        { eventName: "QuestionSubmitted", args: { questionId: "0xquestion", versionHash: "0xversion", proposer: "0xproposer", bondId: 7n }, blockNumber: 3n },
        { eventName: "PollConfigured", args: { pollId: 1n, questionId: "0xquestion", credentialSchemaId: "0xschema", tallyPublicKeyId: "0xtallykey" }, blockNumber: 4n },
        { eventName: "PollOpened", args: { pollId: 1n, questionId: "0xquestion" }, blockNumber: 5n },
        {
          eventName: "BallotAccepted",
          args: { pollId: 1n, nullifier: "0xnullifier", ballotCommitment: "0xcommitment", encryptedPayloadHash: "0xpayload", proofHash: "0xproof" },
          blockNumber: 6n
        },
        { eventName: "PollClosed", args: { pollId: 1n }, blockNumber: 7n },
        {
          eventName: "ResultPublished",
          args: {
            pollId: 1n,
            artifactHash: "0xresult",
            aggregateCountsHash: "0xaggregate",
            tallyProofHash: "0xtallyproof",
            tallyPublicationProofHash: "0xpublication"
          },
          blockNumber: 8n
        },
        { eventName: "ResultFinalized", args: { pollId: 1n }, blockNumber: 9n },
        { eventName: "QuestionArchived", args: { questionId: "0xquestion", archiveHash: "0xarchive", artifactManifestHash: "0xmanifest" }, blockNumber: 10n }
      ]
    });

    expect(report.schemaVersion).toBe("pc-chain-replay-report-v1");
    expect(report.status).toBe("Verified");
    expect(report.logCount).toBe(10);
    expect(report.events.map((event) => event.eventType)).toContain("QuestionArchived");
  });

  it("fails empty chain evidence", () => {
    const report = verifyDecodedChain({ logs: [] });

    expect(report.status).toBe("Mismatch");
    expect(report.checks).toContainEqual(expect.objectContaining({ id: "chain-logs-present", ok: false }));
  });

  it("fails unknown decoded onchain events", () => {
    const report = verifyDecodedChain({ logs: [{ eventName: "Transfer", args: { from: "0xa", to: "0xb", amount: 1n } }] });

    expect(report.status).toBe("Mismatch");
    expect(report.checks).toContainEqual(expect.objectContaining({ id: "onchain-event-supported", ok: false }));
  });
});
