import { createHash, createSign, generateKeyPairSync, randomBytes } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { prisma } from "@pc/db";
import { buildServer } from "./server";
import { resetDemoData } from "./seed";
import { config } from "./config";

const runDatabaseTests = process.env.RUN_DB_TESTS === "true";
const origin = "http://127.0.0.1:3002";

describe.skipIf(!runDatabaseTests)("account abstraction auth", () => {
  const app = buildServer();

  beforeEach(async () => {
    await resetDemoData();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("registers and logs in with a passkey-backed counterfactual smart account", async () => {
    const options = await app.inject({
      method: "POST",
      url: "/auth/passkey/register/options",
      payload: { username: "passkey_builder", displayName: "Passkey Builder", bio: "Passkey AA test" }
    });
    expect(options.statusCode).toBe(200);

    const fixture = buildPasskeyRegistrationFixture(options.json().publicKey.challenge);
    const verified = await app.inject({
      method: "POST",
      url: "/auth/passkey/register/verify",
      payload: {
        challengeId: options.json().challengeId,
        credential: {
          id: fixture.credentialId,
          rawId: fixture.credentialId,
          type: "public-key",
          response: {
            clientDataJSON: fixture.registrationClientDataJSON,
            attestationObject: fixture.attestationObject
          }
        }
      }
    });
    expect(verified.statusCode).toBe(200);
    expect(verified.json().user).toMatchObject({
      username: "passkey_builder"
    });
    expect(["erc-4337-counterfactual-v0", "erc-4337-local-v1"]).toContain(verified.json().user.smartAccountKind);
    if (verified.json().user.smartAccountKind === "erc-4337-local-v1") {
      expect(verified.json().passkeyDeployment.aaUserOperation.signatureKind).toBe("passkey-webauthn-p256");
      expect(verified.json().passkeyDeployment.publicKey.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
    expect(verified.json().user.smartAccountAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(verified.json().session.token).toMatch(/^pc_session_/);

    const loginOptions = await app.inject({
      method: "POST",
      url: "/auth/passkey/login/options",
      payload: { username: "passkey_builder" }
    });
    expect(loginOptions.statusCode).toBe(200);
    const assertion = buildPasskeyAssertionFixture(loginOptions.json().publicKey.challenge, fixture);
    const login = await app.inject({
      method: "POST",
      url: "/auth/passkey/login/verify",
      payload: {
        challengeId: loginOptions.json().challengeId,
        credential: {
          id: fixture.credentialId,
          rawId: fixture.credentialId,
          type: "public-key",
          response: assertion
        }
      }
    });
    expect(login.statusCode).toBe(200);
    expect(login.json().user.username).toBe("passkey_builder");
    expect(login.json().session.token).toMatch(/^pc_session_/);
  });

  it("registers a wallet AA controller and enforces bearer sessions for actor writes", async () => {
    const previousRequireAuth = config.requireAuth;
    const previousAaConfig = { ...config.accountAbstraction };
    config.requireAuth = true;
    Object.assign(config.accountAbstraction, {
      chainId: 31337,
      entryPoint: "0x0000000000000000000000000000000000000001",
      accountFactory: "0x0000000000000000000000000000000000000002",
      paymaster: "0x0000000000000000000000000000000000000003",
      p256Verifier: "0x0000000000000000000000000000000000000100"
    });
    try {
      const account = privateKeyToAccount(`0x${randomBytes(32).toString("hex")}`);
      const challenge = await app.inject({
        method: "POST",
        url: "/auth/wallet/challenge",
        payload: {
          address: account.address,
          username: "wallet_builder",
          displayName: "Wallet Builder",
          bio: "Wallet AA test"
        }
      });
      expect(challenge.statusCode).toBe(200);
      expect(challenge.json().accountStandard).toBe("erc-4337-local-v1");
      expect(challenge.json().aaUserOperation.userOpHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      const signature = await account.signMessage({ message: challenge.json().message });
      const verified = await app.inject({
        method: "POST",
        url: "/auth/wallet/verify",
        payload: { challengeId: challenge.json().challengeId, address: account.address, signature }
      });
      expect(verified.statusCode).toBe(200);
      expect(verified.json().user.smartAccountKind).toBe("erc-4337-local-v1");
      const token = verified.json().session.token;
      const userId = verified.json().user.id;

      const unauthenticated = await app.inject({
        method: "POST",
        url: "/communities",
        payload: { name: "No Auth Club", description: "Blocked", creatorId: userId }
      });
      expect(unauthenticated.statusCode).toBe(401);

      const wrongActor = await app.inject({
        method: "POST",
        url: "/communities",
        headers: { authorization: `Bearer ${token}` },
        payload: { name: "Wrong Actor Club", description: "Blocked", creatorId: "demo-resident" }
      });
      expect(wrongActor.statusCode).toBe(403);

      const created = await app.inject({
        method: "POST",
        url: "/communities",
        headers: { authorization: `Bearer ${token}` },
        payload: { name: "Wallet Steward Club", description: "Allowed", creatorId: userId }
      });
      expect(created.statusCode).toBe(200);
      expect(created.json().community.createdBy).toBe(userId);
    } finally {
      config.requireAuth = previousRequireAuth;
      Object.assign(config.accountAbstraction, previousAaConfig);
    }
  });
});

type PasskeyFixture = ReturnType<typeof buildPasskeyRegistrationFixture>;

function buildPasskeyRegistrationFixture(challenge: string) {
  const keypair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const publicJwk = keypair.publicKey.export({ format: "jwk" });
  const x = Buffer.from(publicJwk.x ?? "", "base64url");
  const y = Buffer.from(publicJwk.y ?? "", "base64url");
  const credentialId = randomBytes(16);
  const credentialPublicKey = cborMap([
    [1, 2],
    [3, -7],
    [-1, 1],
    [-2, x],
    [-3, y]
  ]);
  const rpIdHash = createHash("sha256").update("127.0.0.1").digest();
  const flags = Buffer.from([0x45]);
  const counter = Buffer.alloc(4);
  counter.writeUInt32BE(1);
  const credentialLength = Buffer.alloc(2);
  credentialLength.writeUInt16BE(credentialId.length);
  const authData = Buffer.concat([rpIdHash, flags, counter, Buffer.alloc(16), credentialLength, credentialId, credentialPublicKey]);
  const clientData = Buffer.from(JSON.stringify({ type: "webauthn.create", challenge, origin }));
  const attestationObject = cborMap([
    ["fmt", "none"],
    ["attStmt", cborMap([])],
    ["authData", authData]
  ]);
  return {
    privateKey: keypair.privateKey,
    credentialId: b64(credentialId),
    registrationClientDataJSON: b64(clientData),
    attestationObject: b64(attestationObject)
  };
}

function buildPasskeyAssertionFixture(challenge: string, fixture: PasskeyFixture) {
  const rpIdHash = createHash("sha256").update("127.0.0.1").digest();
  const flags = Buffer.from([0x05]);
  const counter = Buffer.alloc(4);
  counter.writeUInt32BE(2);
  const authenticatorData = Buffer.concat([rpIdHash, flags, counter]);
  const clientData = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge, origin }));
  const clientDataHash = createHash("sha256").update(clientData).digest();
  const signedPayload = Buffer.concat([authenticatorData, clientDataHash]);
  const signer = createSign("SHA256");
  signer.update(signedPayload);
  signer.end();
  return {
    clientDataJSON: b64(clientData),
    authenticatorData: b64(authenticatorData),
    signature: b64(signer.sign(fixture.privateKey))
  };
}

function b64(value: Buffer) {
  return value.toString("base64url");
}

function cborMap(entries: Array<[string | number, string | number | Buffer]>) {
  return Buffer.concat([cborHead(5, entries.length), ...entries.flatMap(([key, value]) => [cborValue(key), cborValue(value)])]);
}

function cborValue(value: string | number | Buffer): Buffer {
  if (Buffer.isBuffer(value)) return Buffer.concat([cborHead(2, value.length), value]);
  if (typeof value === "string") return Buffer.concat([cborHead(3, Buffer.byteLength(value)), Buffer.from(value)]);
  if (value >= 0) return cborHead(0, value);
  return cborHead(1, -1 - value);
}

function cborHead(major: number, value: number): Buffer {
  if (value < 24) return Buffer.from([(major << 5) | value]);
  if (value < 256) return Buffer.from([(major << 5) | 24, value]);
  if (value < 65536) {
    const out = Buffer.alloc(3);
    out[0] = (major << 5) | 25;
    out.writeUInt16BE(value, 1);
    return out;
  }
  const out = Buffer.alloc(5);
  out[0] = (major << 5) | 26;
  out.writeUInt32BE(value, 1);
  return out;
}
