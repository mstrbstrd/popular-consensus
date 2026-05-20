import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  credentialTrustPolicyHash,
  createProductionSliceFixture,
  createProductionSliceExport,
  productionSliceInputFromJson,
  resultArtifactBindingHash,
  verifyProductionSlice,
  type ProductionSliceVerificationInput
} from "./index";

const execFileAsync = promisify(execFile);

describe("production protocol slice verifier", () => {
  it("verifies the golden credential-to-archive slice", () => {
    const { input } = createProductionSliceFixture();
    const report = verifyProductionSlice(input);

    expect(report.status).toBe("Verified");
    expect(report.schemaVersion).toBe("production-slice-verification-v1");
    expect(report.cryptoMode).toBe("production-boundary-v1");
    expect(report.counts.failedChecks).toBe(0);
    expect(report.counts.acceptedDecryptionShares).toBeGreaterThanOrEqual(report.counts.threshold);
    expect(report.hashes.archiveHash).toBe(input.archive.archiveHash);
  });

  it("rejects duplicate poll-scoped nullifiers", () => {
    const input = fixtureInput();
    input.ballots[1].nullifier = input.ballots[0].nullifier;

    expect(failedCheckIds(input)).toContain("duplicate-nullifiers");
  });

  it("rejects a ballot from an issuer outside the community trust policy", () => {
    const input = fixtureInput();
    input.trustPolicy.trustedIssuerIds = ["issuer-other"];
    input.trustPolicy.policyHash = credentialTrustPolicyHash(input.trustPolicy);

    expect(failedCheckIds(input)).toContain("trust-policy-allows-issuer");
  });

  it("rejects modified encrypted payload contents", () => {
    const input = fixtureInput();
    input.ballots[0].encryptedPayload.ciphertext = "tampered-ciphertext";

    expect(failedCheckIds(input)).toContain("ballot-ballot-1-encrypted-payload-hash");
  });

  it("rejects encrypted payloads replayed under the wrong poll context", () => {
    const input = fixtureInput();
    if (input.ballots[0].encryptedPayload.version !== "pc-encrypted-ballot-v2") throw new Error("Expected v2 encrypted ballot fixture");
    input.ballots[0].encryptedPayload.contextHash = "sha256:wrong-context";

    expect(failedCheckIds(input)).toEqual(expect.arrayContaining(["ballot-ballot-1-encrypted-payload-context", "ballot-ballot-1-encrypted-payload-aad", "ballot-ballot-1-commitment"]));
  });

  it("rejects encrypted payloads bound to the wrong tally recipient", () => {
    const input = fixtureInput();
    if (input.ballots[0].encryptedPayload.version !== "pc-encrypted-ballot-v2") throw new Error("Expected v2 encrypted ballot fixture");
    input.ballots[0].encryptedPayload.recipientPublicKeyId = "tally-key-wrong";

    expect(failedCheckIds(input)).toEqual(expect.arrayContaining(["ballot-ballot-1-encrypted-payload-recipient", "ballot-ballot-1-encrypted-payload-aad", "ballot-ballot-1-commitment"]));
  });

  it("rejects invalid Semaphore proof verifier signatures", () => {
    const input = fixtureInput();
    input.ballots[0].eligibilityProof.verifierSignature = "not-a-valid-signature";

    expect(failedCheckIds(input)).toContain("ballot-ballot-1-proof-verifier-signature");
  });

  it("rejects proofs with the wrong poll scope", () => {
    const input = fixtureInput();
    input.ballots[0].eligibilityProof.scope = "sha256:wrong-scope";

    expect(failedCheckIds(input)).toEqual(expect.arrayContaining(["ballot-ballot-1-proof-scope", "ballot-ballot-1-proof-hash"]));
  });

  it("rejects changed result aggregates", () => {
    const input = fixtureInput();
    const entry = input.bundle.artifacts.find((artifact) => artifact.kind === "result-artifact");
    if (!entry || !isRecord(entry.value) || !isRecord(entry.value.aggregate) || !isRecord(entry.value.aggregate.counts)) {
      throw new Error("Fixture result artifact shape changed");
    }
    entry.value.aggregate.counts.support = 99;
    if (isRecord(entry.value.counts)) entry.value.counts.support = 99;

    expect(failedCheckIds(input)).toEqual(expect.arrayContaining(["result-artifact-hash", "result-aggregate-counts-hash"]));
  });

  it("loads production-slice export wrappers as verification input", () => {
    const input = fixtureInput();
    const exported = createProductionSliceExport(input);

    expect(verifyProductionSlice(productionSliceInputFromJson(exported)).status).toBe("Verified");
  });

  it("verifies a saved production-slice JSON file from the CLI", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "pc-production-slice-"));
    const inputPath = path.join(dir, "slice.json");
    try {
      await writeFile(inputPath, JSON.stringify(createProductionSliceExport(fixtureInput()), null, 2), "utf8");
      const { stdout } = await execFileAsync(process.execPath, ["--import", "tsx", "src/cli.ts", "--input", inputPath, "--json"], {
        cwd: process.cwd()
      });
      const report = JSON.parse(stdout) as { status: string; counts: { failedChecks: number } };

      expect(report.status).toBe("Verified");
      expect(report.counts.failedChecks).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects archive manifests that omit the result artifact", () => {
    const input = fixtureInput();
    input.bundle.artifacts = input.bundle.artifacts.filter((artifact) => artifact.kind !== "result-artifact");

    expect(failedCheckIds(input)).toEqual(expect.arrayContaining(["result-artifact-present", "manifest-references-present"]));
  });

  it("rejects finalization while a result challenge is pending", () => {
    const input = fixtureInput();
    input.challenges[0].ruling = "Pending";
    input.challenges[0].resolutionHash = null;

    expect(failedCheckIds(input)).toContain("no-pending-challenges-before-finalization");
  });

  it("rejects polls that point at the wrong tally key setup", () => {
    const input = fixtureInput();
    input.poll.tallyPublicKeyId = "tally-key-wrong";

    expect(failedCheckIds(input)).toContain("poll-tally-key");
  });

  it("rejects tally key setups with duplicate member ids", () => {
    const input = fixtureInput();
    input.tallyKeySetup.members[1].memberId = input.tallyKeySetup.members[0].memberId;

    expect(failedCheckIds(input)).toContain("tally-member-ids-unique");
  });

  it("rejects tally key setups with duplicate public keys", () => {
    const input = fixtureInput();
    input.tallyKeySetup.members[1].publicKeyPem = input.tallyKeySetup.members[0].publicKeyPem;

    expect(failedCheckIds(input)).toContain("tally-member-public-keys-unique");
  });

  it("rejects tally key setups with invalid public keys", () => {
    const input = fixtureInput();
    input.tallyKeySetup.members[0].publicKeyPem = "not-a-public-key";

    expect(failedCheckIds(input)).toContain("tally-member-public-keys-valid");
  });

  it("rejects insufficient accepted threshold shares", () => {
    const input = fixtureInput();
    input.decryptionShares = input.decryptionShares.slice(0, 1);

    expect(failedCheckIds(input)).toEqual(expect.arrayContaining(["threshold-share-count", "result-decryption-share-set", "result-threshold-share-count"]));
  });

  it("rejects accepted threshold shares from unauthorized members", () => {
    const input = fixtureInput();
    input.decryptionShares[0].memberId = "tally-member-unauthorized";

    expect(failedCheckIds(input)).toContain("share-decryption-share-tally-member-1-authorized-member");
  });

  it("rejects duplicate accepted threshold share hashes", () => {
    const input = fixtureInput();
    input.decryptionShares[1].shareHash = input.decryptionShares[0].shareHash;

    expect(failedCheckIds(input)).toContain("threshold-share-unique-hashes");
  });

  it("rejects tampered decryption share signatures", () => {
    const input = fixtureInput();
    input.decryptionShares[0].signature = "tampered-signature";

    expect(failedCheckIds(input)).toContain("share-decryption-share-tally-member-1-signature");
  });

  it("rejects threshold shares bound to the wrong tally setup", () => {
    const input = fixtureInput();
    input.decryptionShares[0].tallyKeySetupHash = "sha256:wrong-setup";

    expect(failedCheckIds(input)).toEqual(expect.arrayContaining(["share-decryption-share-tally-member-1-hash", "share-decryption-share-tally-member-1-tally-key-setup", "share-decryption-share-tally-member-1-signature"]));
  });

  it("rejects threshold shares bound to the wrong result artifact preimage", () => {
    const input = fixtureInput();
    input.decryptionShares[0].resultArtifactBindingHash = resultArtifactBindingHash({
      pollId: input.poll.id,
      questionId: input.question.id,
      aggregateCountsHash: "sha256:wrong-aggregate",
      acceptedBallotCommitmentsHash: "sha256:wrong-commitments",
      tallyKeySetupHash: input.tallyKeySetup.ceremonyHash,
      privacyReportHash: input.result.privacyReportHash
    });

    expect(failedCheckIds(input)).toEqual(expect.arrayContaining(["share-decryption-share-tally-member-1-hash", "share-decryption-share-tally-member-1-result-binding", "share-decryption-share-tally-member-1-signature"]));
  });

  it("rejects tampered replay event continuity", () => {
    const input = fixtureInput();
    input.events[3].previousHash = "sha256:missing";

    expect(failedCheckIds(input)).toContain("event-previous-hash-continuity");
  });
});

function fixtureInput(): ProductionSliceVerificationInput {
  return clone(createProductionSliceFixture().input);
}

function failedCheckIds(input: ProductionSliceVerificationInput): string[] {
  return verifyProductionSlice(input)
    .checks.filter((check) => !check.ok)
    .map((check) => check.id);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
