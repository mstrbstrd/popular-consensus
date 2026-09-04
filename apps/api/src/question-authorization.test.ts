import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  questionAcceptanceSigningText,
  SignedAcceptQuestionCommandSchema,
  type AcceptQuestionCommand,
  type QuestionAcceptanceSnapshot
} from "../../../packages/shared/src/question-authorization";
import { evaluateQuestionAcceptance, type AcceptanceRejection } from "./question-authorization";

function fixture() {
  const keys = generateKeyPairSync("ed25519");
  const command: AcceptQuestionCommand = {
    schemaVersion: "accept-question-command-v0.2-draft", networkId: "local-test",
    commandId: "cmd-1", commandType: "AcceptQuestion", principalId: "curator-1",
    keyId: "key-1", nonce: "0", issuedAt: "2026-09-04T11:59:00.000Z",
    expiresAt: "2026-09-04T12:04:00.000Z",
    payload: { communityId: "community-1", questionId: "question-1", expectedRevision: 3, expectedQuestionVersion: 1 }
  };
  const snapshot: QuestionAcceptanceSnapshot = {
    networkId: "local-test", evaluatedAt: "2026-09-04T12:00:00.000Z",
    principalId: "curator-1", principalStatus: "Active", nextNonce: "0",
    verificationMethod: {
      id: "key-1", principalId: "curator-1", status: "Active",
      publicKeyPem: keys.publicKey.export({ format: "pem", type: "spki" }).toString(),
      validFrom: "2026-09-04T11:00:00.000Z", validUntil: "2026-09-04T13:00:00.000Z"
    },
    capabilities: [{
      id: "grant-1", principalId: "curator-1", communityId: "community-1", questionId: null,
      action: "QuestionAccept", status: "Active", validFrom: "2026-09-04T11:00:00.000Z", validUntil: "2026-09-04T13:00:00.000Z"
    }],
    question: {
      id: "question-1", communityId: "community-1", communityStatus: "Active", proposerPrincipalId: "proposer-1",
      revision: 3, version: 1, status: "Submitted", challengeWindowEndsAt: "2026-09-04T12:00:00.000Z",
      unresolvedChallenges: 0, unresolvedAppeals: 0, emergencySuspended: false
    }
  };
  return { command, snapshot, keys };
}
function signed(command: AcceptQuestionCommand, key: KeyObject) {
  return { command, authorization: {
    kind: "PrincipalSignature", algorithm: "Ed25519",
    signatureHex: sign(null, Buffer.from(questionAcceptanceSigningText(command)), key).toString("hex")
  } };
}

describe("signed question acceptance", () => {
  it("verifies a real signature and derives the actor and conditional effects", () => {
    const { command, snapshot, keys } = fixture();
    const before = JSON.stringify(snapshot);
    const result = evaluateQuestionAcceptance(signed(command, keys.privateKey), snapshot);
    expect(result).toMatchObject({ outcome: "AuthorizedTransition", fromStatus: "Submitted", toStatus: "Accepted",
      actor: { principalId: "curator-1", keyId: "key-1", capabilityId: "grant-1" }, expectedRevision: 3, nextRevision: 4, expectedNonce: "0", nextNonce: "1" });
    expect(JSON.stringify(snapshot)).toBe(before);
    expect(JSON.stringify(result)).not.toContain("PUBLIC KEY");
    expect(JSON.stringify(result)).not.toContain("signatureHex");
  });
  const denied: Array<[string, (s: QuestionAcceptanceSnapshot) => void, AcceptanceRejection]> = [
    ["wrong network", s => { s.networkId = "elsewhere"; }, "WRONG_NETWORK"],
    ["wrong principal", s => { s.principalId = "other"; }, "ACTOR_MISMATCH"],
    ["suspended principal", s => { s.principalStatus = "Suspended"; }, "ACTOR_MISMATCH"],
    ["revoked principal", s => { s.principalStatus = "Revoked"; }, "ACTOR_MISMATCH"],
    ["missing key", s => { s.verificationMethod = null; }, "KEY_NOT_VALID"],
    ["wrong key owner", s => { s.verificationMethod!.principalId = "other"; }, "KEY_NOT_VALID"],
    ["wrong key ID", s => { s.verificationMethod!.id = "other-key"; }, "KEY_NOT_VALID"],
    ["revoked key", s => { s.verificationMethod!.status = "Revoked"; }, "KEY_NOT_VALID"],
    ["suspended key", s => { s.verificationMethod!.status = "Suspended"; }, "KEY_NOT_VALID"],
    ["expired key", s => { s.verificationMethod!.validUntil = s.evaluatedAt; }, "KEY_NOT_VALID"],
    ["future key", s => { s.verificationMethod!.validFrom = "2026-09-04T12:01:00.000Z"; }, "KEY_NOT_VALID"],
    ["invalid key material", s => { s.verificationMethod!.publicKeyPem = "not-a-key"; }, "KEY_NOT_VALID"],
    ["no grant", s => { s.capabilities = []; }, "CAPABILITY_DENIED"],
    ["wrong grant owner", s => { s.capabilities[0].principalId = "other"; }, "CAPABILITY_DENIED"],
    ["wrong community grant", s => { s.capabilities[0].communityId = "other"; }, "CAPABILITY_DENIED"],
    ["wrong resource grant", s => { s.capabilities[0].questionId = "other"; }, "CAPABILITY_DENIED"],
    ["wrong action", s => { s.capabilities[0].action = "QuestionPropose"; }, "CAPABILITY_DENIED"],
    ["revoked grant", s => { s.capabilities[0].status = "Revoked"; }, "CAPABILITY_DENIED"],
    ["suspended grant", s => { s.capabilities[0].status = "Suspended"; }, "CAPABILITY_DENIED"],
    ["expired grant", s => { s.capabilities[0].validUntil = s.evaluatedAt; }, "CAPABILITY_DENIED"],
    ["future grant", s => { s.capabilities[0].validFrom = "2026-09-04T12:00:00.001Z"; }, "CAPABILITY_DENIED"],
    ["stale nonce", s => { s.nextNonce = "1"; }, "NONCE_MISMATCH"],
    ["wrong target", s => { s.question.id = "other"; }, "TARGET_MISMATCH"],
    ["wrong target community", s => { s.question.communityId = "other"; }, "TARGET_MISMATCH"],
    ["stale revision", s => { s.question.revision += 1; }, "STALE_STATE"],
    ["stale wording version", s => { s.question.version += 1; }, "STALE_STATE"],
    ["suspended community", s => { s.question.communityStatus = "Suspended"; }, "COMMUNITY_UNAVAILABLE"],
    ["archived community", s => { s.question.communityStatus = "Archived"; }, "COMMUNITY_UNAVAILABLE"],
    ["emergency", s => { s.question.emergencySuspended = true; }, "EMERGENCY_SUSPENDED"],
    ["self approval", s => { s.question.proposerPrincipalId = s.principalId; }, "SELF_APPROVAL"],
    ["pending challenge", s => { s.question.unresolvedChallenges = 1; }, "DISPUTE_PENDING"],
    ["pending appeal", s => { s.question.unresolvedAppeals = 1; }, "DISPUTE_PENDING"]
  ];
  it.each(denied)("rejects %s", (_name, change, code) => {
    const { command, snapshot, keys } = fixture();
    change(snapshot);
    expect(evaluateQuestionAcceptance(signed(command, keys.privateKey), snapshot)).toEqual({ outcome: "Rejected", code });
  });
  it.each(["Drafted", "Challenged", "Amendment", "Rejected", "Accepted", "Open", "Closed", "ResultPublished", "ResultChallenged", "Corrected", "Finalized", "Archived"] as const)("rejects undeclared transition from %s", (status) => {
    const { command, snapshot, keys } = fixture(); snapshot.question.status = status;
    expect(evaluateQuestionAcceptance(signed(command, keys.privateKey), snapshot)).toEqual({ outcome: "Rejected", code: "QUESTION_STATE_INVALID" });
  });
  it.each([
    ["2026-09-04T11:59:59.999Z", "Rejected"],
    ["2026-09-04T12:00:00.000Z", "AuthorizedTransition"],
    ["2026-09-04T12:00:00.001Z", "AuthorizedTransition"]
  ])("enforces challenge boundary at %s", (now, outcome) => {
    const { command, snapshot, keys } = fixture(); snapshot.evaluatedAt = now;
    expect(evaluateQuestionAcceptance(signed(command, keys.privateKey), snapshot).outcome).toBe(outcome);
  });
  it.each([
    ["2026-09-04T11:58:59.999Z", "COMMAND_NOT_YET_VALID"],
    ["2026-09-04T12:04:00.000Z", "COMMAND_EXPIRED"],
    ["2026-09-04T12:04:00.001Z", "COMMAND_EXPIRED"]
  ])("enforces command boundary at %s", (now, code) => {
    const { command, snapshot, keys } = fixture(); snapshot.evaluatedAt = now;
    expect(evaluateQuestionAcceptance(signed(command, keys.privateKey), snapshot)).toEqual({ outcome: "Rejected", code });
  });
  it.each(["2026-09-04T11:59:00.000Z", "2026-09-04T11:58:59.999Z", "2026-09-04T12:04:00.001Z"])("rejects invalid/overlong command lifetime %s", (expiry) => {
    const { command, snapshot, keys } = fixture(); command.expiresAt = expiry;
    expect(evaluateQuestionAcceptance(signed(command, keys.privateKey), snapshot)).toEqual({ outcome: "Rejected", code: "COMMAND_LIFETIME_INVALID" });
  });
  it("accepts an explicitly resource-scoped grant", () => {
    const { command, snapshot, keys } = fixture(); snapshot.capabilities[0].questionId = command.payload.questionId;
    expect(evaluateQuestionAcceptance(signed(command, keys.privateKey), snapshot).outcome).toBe("AuthorizedTransition");
  });
  it("rejects a forged signature", () => {
    const { command, snapshot } = fixture();
    const other = generateKeyPairSync("ed25519");
    expect(evaluateQuestionAcceptance(signed(command, other.privateKey), snapshot)).toEqual({ outcome: "Rejected", code: "SIGNATURE_INVALID" });
  });
  it("rejects algorithm confusion and private-key input", () => {
    const { command, snapshot, keys } = fixture();
    const request = signed(command, keys.privateKey);
    snapshot.verificationMethod!.publicKeyPem = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).publicKey.export({ format: "pem", type: "spki" }).toString();
    expect(evaluateQuestionAcceptance(request, snapshot)).toEqual({ outcome: "Rejected", code: "KEY_NOT_VALID" });
    snapshot.verificationMethod!.publicKeyPem = keys.privateKey.export({ format: "pem", type: "pkcs8" }).toString();
    expect(evaluateQuestionAcceptance(request, snapshot)).toEqual({ outcome: "Rejected", code: "KEY_NOT_VALID" });
  });
  it("rejects replay after the returned effects are committed", () => {
    const { command, snapshot, keys } = fixture();
    const request = signed(command, keys.privateKey);
    const first = evaluateQuestionAcceptance(request, snapshot);
    if (first.outcome !== "AuthorizedTransition") throw new Error("fixture rejected");
    snapshot.nextNonce = first.nextNonce;
    snapshot.question.revision = first.nextRevision;
    snapshot.question.status = first.toStatus;
    expect(evaluateQuestionAcceptance(request, snapshot)).toEqual({ outcome: "Rejected", code: "NONCE_MISMATCH" });
  });
  it("preserves large nonces without number rounding and rejects exhaustion", () => {
    const { command, snapshot, keys } = fixture();
    command.nonce = snapshot.nextNonce = "9007199254740993000";
    expect(evaluateQuestionAcceptance(signed(command, keys.privateKey), snapshot)).toMatchObject({ nextNonce: "9007199254740993001" });
    command.nonce = snapshot.nextNonce = "99999999999999999999";
    expect(evaluateQuestionAcceptance(signed(command, keys.privateKey), snapshot)).toEqual({ outcome: "Rejected", code: "NONCE_EXHAUSTED" });
  });
  it("rejects revision overflow", () => {
    const { command, snapshot, keys } = fixture(); command.payload.expectedRevision = snapshot.question.revision = Number.MAX_SAFE_INTEGER;
    expect(evaluateQuestionAcceptance(signed(command, keys.privateKey), snapshot)).toEqual({ outcome: "Rejected", code: "REVISION_EXHAUSTED" });
  });
  it.each(["curator", "userId", "principalId", "credentialSecret", "privateKeyPem", "verified"])("rejects untrusted payload field %s", (field) => {
    const { command, snapshot, keys } = fixture(); const request = signed(command, keys.privateKey);
    Object.assign(request.command.payload, { [field]: "attacker" });
    expect(evaluateQuestionAcceptance(request, snapshot)).toEqual({ outcome: "Rejected", code: "INVALID_COMMAND" });
  });
  it.each(["publicKeyPem", "verified", "capabilityId", "credentialSecret"])("rejects caller authorization field %s", (field) => {
    const { command, snapshot, keys } = fixture(); const request = signed(command, keys.privateKey);
    Object.assign(request.authorization, { [field]: "attacker" });
    expect(evaluateQuestionAcceptance(request, snapshot)).toEqual({ outcome: "Rejected", code: "INVALID_COMMAND" });
  });
  it.each([null, {}, { command: {} }, { authorization: { kind: "EligibilityProof" } }])("rejects malformed or unsupported command %j", (request) => {
    expect(evaluateQuestionAcceptance(request, fixture().snapshot)).toEqual({ outcome: "Rejected", code: "INVALID_COMMAND" });
  });
  it("rejects invalid trusted state without disclosing validation input", () => {
    const { command, keys } = fixture();
    expect(evaluateQuestionAcceptance(signed(command, keys.privateKey), { secret: "never-log-this" })).toEqual({ outcome: "Rejected", code: "INVALID_SNAPSHOT" });
  });
  it("signature is independent of JSON object insertion order", () => {
    const { command, snapshot, keys } = fixture(); const request = signed(command, keys.privateKey);
    request.command = Object.fromEntries(Object.entries(command).reverse()) as AcceptQuestionCommand;
    expect(evaluateQuestionAcceptance(request, snapshot).outcome).toBe("AuthorizedTransition");
  });
  it("covers every command field in the signing tuple", () => {
    const { command } = fixture(); const baseline = questionAcceptanceSigningText(command);
    const changes: Array<(c: AcceptQuestionCommand) => void> = [
      c => { c.networkId = "other"; }, c => { c.commandId = "other"; }, c => { c.principalId = "other"; },
      c => { c.keyId = "other"; }, c => { c.nonce = "1"; }, c => { c.issuedAt = "2026-09-04T11:59:00.001Z"; },
      c => { c.expiresAt = "2026-09-04T12:04:00.001Z"; }, c => { c.payload.communityId = "other"; },
      c => { c.payload.questionId = "other"; }, c => { c.payload.expectedRevision = 4; }, c => { c.payload.expectedQuestionVersion = 2; }
    ];
    for (const mutate of changes) { const copy = structuredClone(command); mutate(copy); expect(questionAcceptanceSigningText(copy)).not.toBe(baseline); }
    expect(Object.keys(command).sort()).toEqual(["schemaVersion", "networkId", "commandId", "commandType", "principalId", "keyId", "nonce", "issuedAt", "expiresAt", "payload"].sort());
    expect(Object.keys(command.payload).sort()).toEqual(["communityId", "questionId", "expectedRevision", "expectedQuestionVersion"].sort());
  });
  it("modifying a signed payload invalidates the signature", () => {
    const { command, snapshot, keys } = fixture(); const request = signed(command, keys.privateKey);
    request.command.payload.expectedRevision += 1;
    expect(evaluateQuestionAcceptance(request, snapshot)).toEqual({ outcome: "Rejected", code: "SIGNATURE_INVALID" });
  });
  it.each(["00", "-1", "1.0", "1\n", "100000000000000000000"])("rejects noncanonical nonce %j", (nonce) => {
    const { command, keys } = fixture(); const request = signed(command, keys.privateKey); request.command.nonce = nonce;
    expect(SignedAcceptQuestionCommandSchema.safeParse(request).success).toBe(false);
  });
});
