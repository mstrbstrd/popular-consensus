import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { admissionDatabaseUrl, createAdmissionClient, AdmissionPrisma, type AdmissionClient } from "../../../packages/db/src/admission";
import { AppliedQuestionAcceptanceReceiptSchema } from "../../../packages/shared/src/admission";
import { questionAcceptanceSigningText, type SignedAcceptQuestionCommand } from "../../../packages/shared/src/question-authorization";
import { bootstrapAdmission } from "./admission-bootstrap";
import { applyQuestionAcceptance } from "./question-admission";
import { buildAdmissionServer } from "./admission-server";

const networkId = "admission-test-network";
const hash = "sha256:" + "a".repeat(64);
const keys = generateKeyPairSync("ed25519");
const publicKeyPem = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
const at = (offset: number) => new Date(Date.now() + offset).toISOString();
function fixture() {
  return {
    schemaVersion: "admission-bootstrap-v0.2-draft",
    networkId,
    principals: [{ id: "author" }, { id: "curator" }, { id: "other-curator" }],
    verificationMethods: ["curator", "other-curator"].map((id) => ({
      id: `${id}-key`, principalId: id, publicKeyPem,
      validity: { validFrom: at(-60_000), validUntil: at(3_600_000) }
    })),
    communities: [{ id: "community" }, { id: "other-community" }],
    questions: ["question", "question-two"].map((id) => ({
      id, proposerPrincipalId: "author", challengeWindowEndsAt: at(-30_000),
      intent: {
        schemaVersion: "question-intent-v0.2-draft", communityId: "community", bodyHash: hash,
        answerSchemaHash: hash, eligibilityPolicyHash: hash, privacyProfileHash: hash,
        methodologyHash: hash, sponsorDisclosureHash: hash, authorityLevel: "Advisory",
        opensAt: at(60_000), closesAt: at(3_600_000)
      }
    })),
    capabilities: ["curator", "other-curator"].map((id) => ({
      id: `${id}-grant`, principalId: id, communityId: "community", questionId: null,
      action: "QuestionAccept", validity: { validFrom: at(-60_000), validUntil: at(3_600_000) }
    }))
  };
}
function signed(commandId = "command", principalId = "curator", questionId = "question", nonce = "0"): SignedAcceptQuestionCommand {
  const command: SignedAcceptQuestionCommand["command"] = {
    schemaVersion: "accept-question-command-v0.2-draft", networkId, commandId, commandType: "AcceptQuestion",
    principalId, keyId: `${principalId}-key`, nonce, issuedAt: at(-1_000), expiresAt: at(60_000),
    payload: { communityId: "community", questionId, expectedRevision: 0, expectedQuestionVersion: 1 }
  };
  return { command, authorization: {
    kind: "PrincipalSignature", algorithm: "Ed25519",
    signatureHex: sign(null, Buffer.from(questionAcceptanceSigningText(command)), keys.privateKey).toString("hex")
  } };
}
function resign(envelope: SignedAcceptQuestionCommand) {
  envelope.authorization.signatureHex = sign(null, Buffer.from(questionAcceptanceSigningText(envelope.command)), keys.privateKey).toString("hex");
  return envelope;
}

describe("admission database configuration", () => {
  it.each([undefined, "not-a-url", "postgresql://remote.example/db", "https://localhost/db", "postgresql://localhost/", "postgresql://localhost/db%0a", "postgresql://localhost/db?host=remote.example", "postgresql://localhost/db#fragment"])("rejects invalid or remote URL %s", (value) => {
    expect(() => admissionDatabaseUrl({ ADMISSION_DATABASE_URL: value })).toThrow();
  });
  it("does not inherit the legacy database", () => {
    expect(() => admissionDatabaseUrl({ DATABASE_URL: "postgresql://localhost/legacy" })).toThrow("REQUIRED");
    expect(() => admissionDatabaseUrl({ ADMISSION_DATABASE_URL: "postgresql://127.0.0.1/legacy", DATABASE_URL: "postgresql://localhost/legacy" })).toThrow("SEPARATE");
  });
});

describe.skipIf(process.env.RUN_DB_TESTS !== "true").sequential("transactional signed admission", () => {
  let db: AdmissionClient;
  beforeAll(async () => { db = createAdmissionClient(); await db.$connect(); });
  afterAll(async () => { await db?.$disconnect(); });
  beforeEach(async () => {
    // Disposable, dedicated test database only. Production has no reset route.
    await db.$executeRaw`TRUNCATE TABLE "AdmissionNetwork" CASCADE`;
    await bootstrapAdmission(db, fixture());
  });
  async function state() {
    return {
      principal: await db.admissionPrincipal.findUniqueOrThrow({ where: { networkId_id: { networkId, id: "curator" } } }),
      question: await db.admissionQuestion.findUniqueOrThrow({ where: { networkId_id: { networkId, id: "question" } } }),
      receipts: await db.admissionCommandReceipt.count(), events: await db.admissionAcceptanceEvent.count()
    };
  }
  async function unchanged() {
    const s = await state();
    expect(s).toMatchObject({ principal: { nextNonce: "0" }, question: { revision: 0n, status: "Submitted" }, receipts: 0, events: 0 });
  }
  it("atomically applies a signed command and returns only a committed minimal receipt", async () => {
    const input = signed();
    const original = structuredClone(input);
    const result = await applyQuestionAcceptance(db, networkId, input);
    expect(result.outcome).toBe("Applied");
    if (result.outcome === "Rejected") throw new Error(result.code);
    AppliedQuestionAcceptanceReceiptSchema.parse(result.receipt);
    expect(await state()).toMatchObject({ principal: { nextNonce: "1" }, question: { revision: 1n, status: "Accepted" }, receipts: 1, events: 1 });
    expect(input).toEqual(original);
    const event = await db.admissionAcceptanceEvent.findUniqueOrThrow({ where: { networkId_commandId: { networkId, commandId: "command" } } });
    expect(result.receipt.eventHash).toBe("sha256:" + createHash("sha256").update("popular-consensus:acceptance-event:v0.2-draft\n" + event.payloadJson).digest("hex"));
    for (const term of ["signatureHex", "publicKeyPem", "capabilityId", "principalId", "PRIVATE KEY", "intentJson"]) expect(JSON.stringify(result)).not.toContain(term);
  });
  it("durably returns the original receipt through a fresh database client after revocation", async () => {
    const input = signed();
    const first = await applyQuestionAcceptance(db, networkId, input);
    await db.admissionVerificationMethod.update({ where: { networkId_id: { networkId, id: "curator-key" } }, data: { status: "Revoked" } });
    const restarted = createAdmissionClient();
    try {
      expect(await applyQuestionAcceptance(restarted, networkId, input)).toEqual({ ...first, outcome: "AlreadyApplied" });
    } finally { await restarted.$disconnect(); }
    expect(await state()).toMatchObject({ receipts: 1, events: 1, principal: { nextNonce: "1" } });
  });
  it("applies simultaneous exact deliveries only once across independent clients", async () => {
    const input = signed();
    const second = createAdmissionClient();
    try {
      const results = await Promise.all(Array.from({ length: 6 }, (_, i) => applyQuestionAcceptance(i % 2 ? second : db, networkId, input)));
      expect(results.filter((r) => r.outcome === "Applied")).toHaveLength(1);
      expect(results.filter((r) => r.outcome === "AlreadyApplied")).toHaveLength(5);
      expect(await state()).toMatchObject({ receipts: 1, events: 1, principal: { nextNonce: "1" }, question: { revision: 1n } });
    } finally { await second.$disconnect(); }
  });
  it("does not allow two different commands to spend the same nonce", async () => {
    const results = await Promise.all([
      applyQuestionAcceptance(db, networkId, signed("one")),
      applyQuestionAcceptance(db, networkId, signed("two", "curator", "question-two"))
    ]);
    expect(results.filter((r) => r.outcome === "Applied")).toHaveLength(1);
    expect(results).toContainEqual({ outcome: "Rejected", code: "NONCE_MISMATCH" });
    expect(await db.admissionCommandReceipt.count()).toBe(1);
    expect(await db.admissionQuestion.count({ where: { status: "Accepted" } })).toBe(1);
  });
  it("rejects competing curators' stale revisions without consuming the losing nonce", async () => {
    const results = await Promise.all([
      applyQuestionAcceptance(db, networkId, signed("one")),
      applyQuestionAcceptance(db, networkId, signed("two", "other-curator"))
    ]);
    expect(results.filter((r) => r.outcome === "Applied")).toHaveLength(1);
    expect(results).toContainEqual({ outcome: "Rejected", code: "STALE_STATE" });
    const principals = await db.admissionPrincipal.findMany({ where: { id: { in: ["curator", "other-curator"] } } });
    expect(principals.map((p) => p.nextNonce).sort()).toEqual(["0", "1"]);
  });
  it("rejects a reused command ID with a changed body or signature", async () => {
    const input = signed();
    await applyQuestionAcceptance(db, networkId, input);
    const changed = structuredClone(input);
    changed.command.nonce = "1";
    expect(await applyQuestionAcceptance(db, networkId, resign(changed))).toEqual({ outcome: "Rejected", code: "COMMAND_ID_CONFLICT" });
    changed.command = input.command;
    changed.authorization.signatureHex = "0".repeat(128);
    expect(await applyQuestionAcceptance(db, networkId, changed)).toEqual({ outcome: "Rejected", code: "COMMAND_ID_CONFLICT" });
    expect(await db.admissionCommandReceipt.count()).toBe(1);
  });
  it.each(["principalId", "creatorId", "curator", "userId", "trustedSnapshot", "privateKey", "nextNonce"])("rejects caller-injected %s before creating effects", async (field) => {
    expect(await applyQuestionAcceptance(db, networkId, { ...signed(), [field]: "forged" })).toEqual({ outcome: "Rejected", code: "INVALID_COMMAND" });
    await unchanged();
  });
  it("rejects signatures made by a different key", async () => {
    const input = signed();
    input.authorization.signatureHex = sign(null, Buffer.from(questionAcceptanceSigningText(input.command)), generateKeyPairSync("ed25519").privateKey).toString("hex");
    expect(await applyQuestionAcceptance(db, networkId, input)).toEqual({ outcome: "Rejected", code: "SIGNATURE_INVALID" });
    await unchanged();
  });
  it.each(["Revoked", "Suspended"])("denies a %s key", async (status) => {
    await db.admissionVerificationMethod.update({ where: { networkId_id: { networkId, id: "curator-key" } }, data: { status } });
    expect(await applyQuestionAcceptance(db, networkId, signed())).toEqual({ outcome: "Rejected", code: "KEY_NOT_VALID" });
    await unchanged();
  });
  it.each(["unresolvedChallenges", "unresolvedAppeals"] as const)("denies acceptance while %s remains", async (field) => {
    await db.admissionQuestion.update({ where: { networkId_id: { networkId, id: "question" } }, data: { [field]: 1 } });
    expect(await applyQuestionAcceptance(db, networkId, signed())).toEqual({ outcome: "Rejected", code: "DISPUTE_PENDING" });
    await unchanged();
  });
  it("enforces the stored challenge deadline, not request-supplied time", async () => {
    await db.admissionQuestion.update({ where: { networkId_id: { networkId, id: "question" } }, data: { challengeWindowEndsAt: new Date(Date.now() + 60_000) } });
    expect(await applyQuestionAcceptance(db, networkId, signed())).toEqual({ outcome: "Rejected", code: "CHALLENGE_WINDOW_OPEN" });
    await unchanged();
  });
  it("rolls nonce, question, receipt and event back if event insertion fails", async () => {
    await db.$executeRawUnsafe(`CREATE FUNCTION admission_test_fail_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END; $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER admission_test_fail_event BEFORE INSERT ON "AdmissionAcceptanceEvent" FOR EACH ROW EXECUTE FUNCTION admission_test_fail_event()`);
    try {
      await expect(applyQuestionAcceptance(db, networkId, signed())).rejects.toThrow();
      await unchanged();
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER admission_test_fail_event ON "AdmissionAcceptanceEvent"`);
      await db.$executeRawUnsafe(`DROP FUNCTION admission_test_fail_event()`);
    }
    expect((await applyQuestionAcceptance(db, networkId, signed())).outcome).toBe("Applied");
  });
  async function waitForDatabaseLock(table: string) {
    const end = Date.now() + 2_000;
    while (Date.now() < end) {
      const [row] = await db.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM pg_stat_activity
        WHERE datname = current_database() AND usename = current_user AND wait_event_type = 'Lock'
          AND query LIKE ${`%FROM "${table}"%`}`;
      if (row.count > 0n) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error("Expected a real database row-lock wait");
  }
  const revocationCases: Array<{
    name: string; table: string; code: string;
    change: (tx: AdmissionPrisma.TransactionClient) => Promise<unknown>;
  }> = [
    { name: "key revocation", table: "AdmissionVerificationMethod", code: "KEY_NOT_VALID",
      change: (tx) => tx.admissionVerificationMethod.update({ where: { networkId_id: { networkId, id: "curator-key" } }, data: { status: "Revoked" } }) },
    { name: "capability revocation", table: "AdmissionCapabilityGrant", code: "CAPABILITY_DENIED",
      change: (tx) => tx.admissionCapabilityGrant.update({ where: { networkId_id: { networkId, id: "curator-grant" } }, data: { status: "Revoked" } }) },
    { name: "emergency suspension", table: "AdmissionCommunity", code: "EMERGENCY_SUSPENDED",
      change: (tx) => tx.admissionCommunity.update({ where: { networkId_id: { networkId, id: "community" } }, data: { emergencySuspended: true } }) }
  ];
  it.each(revocationCases)("rechecks $name committed while acceptance waits for its lock", async ({ table, code, change }) => {
    let locked!: () => void;
    let release!: () => void;
    const hasLock = new Promise<void>((resolve) => { locked = resolve; });
    const mayCommit = new Promise<void>((resolve) => { release = resolve; });
    const blocker = db.$transaction(async (tx) => { await change(tx); locked(); await mayCommit; }, { timeout: 10_000 });
    await hasLock;
    const applying = applyQuestionAcceptance(db, networkId, signed());
    try { await waitForDatabaseLock(table); }
    finally { release(); await blocker; }
    expect(await applying).toEqual({ outcome: "Rejected", code });
    await unchanged();
  });
  it("does not use a stale transaction-start time after a lock wait crosses expiry", async () => {
    let locked!: () => void;
    let release!: () => void;
    const hasLock = new Promise<void>((resolve) => { locked = resolve; });
    const mayCommit = new Promise<void>((resolve) => { release = resolve; });
    const blocker = db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "AdmissionPrincipal" WHERE "networkId" = ${networkId} AND "id" = 'curator' FOR UPDATE`;
      locked(); await mayCommit;
    }, { timeout: 10_000 });
    await hasLock;
    const input = signed(); input.command.expiresAt = at(500); resign(input);
    const applying = applyQuestionAcceptance(db, networkId, input);
    try {
      await waitForDatabaseLock("AdmissionPrincipal");
      while (Date.now() <= Date.parse(input.command.expiresAt)) await new Promise((resolve) => setTimeout(resolve, 10));
    } finally { release(); await blocker; }
    expect(await applying).toEqual({ outcome: "Rejected", code: "COMMAND_EXPIRED" });
    await unchanged();
  });
  it("database history cannot be updated or deleted", async () => {
    await applyQuestionAcceptance(db, networkId, signed());
    await expect(db.admissionCommandReceipt.updateMany({ data: { eventHash: hash } })).rejects.toThrow();
    await expect(db.admissionAcceptanceEvent.deleteMany()).rejects.toThrow();
    expect(await state()).toMatchObject({ receipts: 1, events: 1 });
  });
  it("the deferred database constraint prevents receipts without events", async () => {
    const first = await applyQuestionAcceptance(db, networkId, signed());
    expect(first.outcome).toBe("Applied");
    const row = await db.admissionCommandReceipt.findUniqueOrThrow({ where: { networkId_commandId: { networkId, commandId: "command" } } });
    await expect(db.admissionCommandReceipt.create({ data: { ...row, commandId: "orphan", nonce: "1" } })).rejects.toThrow();
    expect(await db.admissionCommandReceipt.count()).toBe(1);
  });
  it("SQL constraints reject malformed nonces, negative counts and invalid windows", async () => {
    await expect(db.admissionPrincipal.updateMany({ data: { nextNonce: "01" } })).rejects.toThrow();
    await expect(db.admissionQuestion.updateMany({ data: { unresolvedChallenges: -1 } })).rejects.toThrow();
    await expect(db.admissionVerificationMethod.updateMany({ data: { validUntil: new Date(0) } })).rejects.toThrow();
    await unchanged();
  });
  it("bootstrap never overwrites keys or upgrades demo identities automatically", async () => {
    await expect(bootstrapAdmission(db, fixture())).rejects.toThrow();
    expect(await db.admissionNetwork.count()).toBe(1);
    const input = signed(); input.command.principalId = "demo-curator";
    expect(await applyQuestionAcceptance(db, networkId, resign(input))).toEqual({ outcome: "Rejected", code: "PRINCIPAL_NOT_FOUND" });
    await unchanged();
  });
  it("rejects private keys and cross-community bootstrap references before writing", async () => {
    const input = fixture(); input.networkId = "other-network";
    input.verificationMethods[0].publicKeyPem = keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    await expect(bootstrapAdmission(db, input)).rejects.toThrow("KEY_INVALID");
    input.verificationMethods[0].publicKeyPem = publicKeyPem;
    input.capabilities[0] = { ...input.capabilities[0], communityId: "missing-community" };
    await expect(bootstrapAdmission(db, input)).rejects.toThrow("REFERENCE_INVALID");
    expect(await db.admissionNetwork.count()).toBe(1);
  });
  it("serves the real signed route but never exposes legacy or enrollment routes", async () => {
    const app = buildAdmissionServer(db, networkId);
    try {
      for (const url of ["/questions/question/accept", "/credentials/demo-resident", "/users", "/bootstrap"]) {
        expect((await app.inject({ method: "POST", url, payload: { curator: "demo-curator" } })).statusCode).toBe(404);
      }
      const input = signed();
      const result = await app.inject({ method: "POST", url: "/v0.2/commands/accept-question", payload: input });
      expect(result.statusCode).toBe(200);
      expect(result.json().outcome).toBe("Applied");
      expect(result.headers["cache-control"]).toBe("no-store");
      const replay = await app.inject({ method: "POST", url: "/v0.2/commands/accept-question", payload: input });
      expect(replay.json()).toEqual({ ...result.json(), outcome: "AlreadyApplied" });
    } finally { await app.close(); }
  });
  it("denies browser requests, oversized bodies and malformed JSON without leaking errors", async () => {
    const app = buildAdmissionServer(db, networkId);
    try {
      const url = "/v0.2/commands/accept-question";
      for (const origin of ["https://evil.example", "null", "http://localhost:3000"]) {
        expect((await app.inject({ method: "POST", url, headers: { origin }, payload: signed() })).statusCode).toBe(403);
      }
      const large = await app.inject({ method: "POST", url, payload: { privateKey: "secret".repeat(2_000) } });
      expect(large.statusCode).toBe(413);
      expect(large.body).not.toContain("secret");
      const malformed = await app.inject({ method: "POST", url, headers: { "content-type": "application/json" }, payload: '{"privateKey":"secret"' });
      expect(malformed.statusCode).toBe(400);
      expect(malformed.body).not.toContain("secret");
      await unchanged();
    } finally { await app.close(); }
  });
});
