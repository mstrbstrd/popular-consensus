import { existsSync, readFileSync } from "node:fs";
import { createHash, createSign, generateKeyPairSync, randomBytes } from "node:crypto";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createPublicClient, defineChain, encodeAbiParameters, http, parseAbiParameters, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "./config";
import { buildServer } from "./server";
import {
  attachPasskeySignature,
  attachWalletSignature,
  predictSmartAccount,
  prepareDeploymentUserOperation,
  submitUserOperation,
  toBundlerUserOperation,
  type AccountAbstractionConfig
} from "./aa";

const runLocalChainTests = process.env.RUN_AA_CHAIN_TESTS === "true";
const P256_ORDER = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");
const P256_HALF_ORDER = P256_ORDER / 2n;

describe.skipIf(!runLocalChainTests)("account abstraction local-chain smoke", () => {
  it("deploys a wallet smart account through the local EntryPoint path", async () => {
    const aaConfig = loadAaConfig();
    expect(aaConfig.entryPoint).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(aaConfig.accountFactory).toMatch(/^0x[a-fA-F0-9]{40}$/);

    const controller = privateKeyToAccount(`0x${randomBytes(32).toString("hex")}`);
    const prediction = predictSmartAccount({ kind: "wallet", walletAddress: controller.address }, aaConfig, { requireFactory: true });
    const prepared = prepareDeploymentUserOperation(prediction, aaConfig.chainId);
    expect(prepared?.signatureKind).toBe("wallet-personal-sign");

    const signature = await controller.signMessage({ message: { raw: prepared!.signingMessage } });
    const signedOperation = attachWalletSignature(prepared!.userOperation, signature);
    const submission = await submitUserOperation(signedOperation, { ...aaConfig, bundlerUrl: null });
    expect(submission.mode).toBe("local-entrypoint");
    expect(submission.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);

    await expectAccountCode(aaConfig, prediction.address);
  }, 30_000);

  it("relays a wallet smart-account deployment through the local bundler JSON-RPC endpoint", async () => {
    const aaConfig = loadAaConfig();
    const previousAaConfig = { ...config.accountAbstraction };
    Object.assign(config.accountAbstraction, aaConfig);
    const app = buildServer();
    try {
      const controller = privateKeyToAccount(`0x${randomBytes(32).toString("hex")}`);
      const prediction = predictSmartAccount({ kind: "wallet", walletAddress: controller.address }, aaConfig, { requireFactory: true });
      const prepared = prepareDeploymentUserOperation(prediction, aaConfig.chainId);
      const signature = await controller.signMessage({ message: { raw: prepared!.signingMessage } });
      const signedOperation = attachWalletSignature(prepared!.userOperation, signature);

      const response = await app.inject({
        method: "POST",
        url: "/auth/aa/bundler",
        payload: {
          jsonrpc: "2.0",
          id: 1,
          method: "eth_sendUserOperation",
          params: [toBundlerUserOperation(signedOperation), aaConfig.entryPoint]
        }
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ jsonrpc: "2.0", id: 1, result: prepared!.userOpHash });

      await expectAccountCode(aaConfig, prediction.address);
    } finally {
      Object.assign(config.accountAbstraction, previousAaConfig);
      await app.close();
    }
  }, 30_000);

  it("deploys a passkey smart account through WebAuthn P-256 validation", async (context) => {
    const aaConfig = loadAaConfig();
    const passkey = createPasskeyFixture();
    if (!(await verifierSupportsPasskey(aaConfig, passkey))) {
      context.skip(
        `Configured P-256 verifier ${aaConfig.p256Verifier ?? "(none)"} did not verify a generated WebAuthn ES256 signature. Use a chain with RIP-7212 or set PC_AA_P256_VERIFIER to a compatible verifier.`
      );
    }

    const prediction = predictSmartAccount(
      {
        kind: "passkey",
        credentialId: passkey.credentialId,
        passkeyX: passkey.x,
        passkeyY: passkey.y
      },
      aaConfig,
      { requireFactory: true }
    );
    const prepared = prepareDeploymentUserOperation(prediction, aaConfig.chainId);
    expect(prepared?.signatureKind).toBe("passkey-webauthn-p256");
    expect(prepared?.signingChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const assertion = signPasskeyAssertion(prepared!.signingChallenge!, passkey.privateKey);
    const signedOperation = attachPasskeySignature(prepared!.userOperation, assertion, prepared!.signingChallenge!);
    const submission = await submitUserOperation(signedOperation, { ...aaConfig, bundlerUrl: null });
    expect(submission.mode).toBe("local-entrypoint");
    expect(submission.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);

    await expectAccountCode(aaConfig, prediction.address);
  }, 30_000);
});

function createPasskeyFixture() {
  const keypair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const publicJwk = keypair.publicKey.export({ format: "jwk" });
  const x = Buffer.from(publicJwk.x ?? "", "base64url");
  const y = Buffer.from(publicJwk.y ?? "", "base64url");
  if (x.length !== 32 || y.length !== 32) throw new Error("Generated passkey coordinates are invalid");
  return {
    privateKey: keypair.privateKey,
    credentialId: randomBytes(16).toString("base64url"),
    x: `0x${x.toString("hex")}` as `0x${string}`,
    y: `0x${y.toString("hex")}` as `0x${string}`
  };
}

async function verifierSupportsPasskey(aaConfig: AccountAbstractionConfig, passkey: ReturnType<typeof createPasskeyFixture>) {
  if (!aaConfig.p256Verifier) return false;
  const assertion = signPasskeyAssertion("popular-consensus-p256-preflight-00000000", passkey.privateKey);
  const { r, s } = p256DerSignatureToRS(assertion.signature);
  const data = encodeAbiParameters(parseAbiParameters("bytes32,bytes32,bytes32,bytes32,bytes32"), [
    assertion.webAuthnHash,
    r,
    s,
    passkey.x,
    passkey.y
  ]);
  const publicClient = createAaPublicClient(aaConfig);
  const result = await publicClient
    .call({
      to: aaConfig.p256Verifier as Address,
      data
    })
    .catch(() => null);
  return result?.data === `0x${"0".repeat(63)}1`;
}

function signPasskeyAssertion(challenge: string, privateKey: ReturnType<typeof generateKeyPairSync>["privateKey"]) {
  const rpIdHash = createHash("sha256").update("127.0.0.1").digest();
  const flags = Buffer.from([0x05]);
  const counter = Buffer.alloc(4);
  counter.writeUInt32BE(1);
  const authenticatorData = Buffer.concat([rpIdHash, flags, counter]);
  const clientDataJSON = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge, origin: "http://127.0.0.1:3002" }));
  const clientDataHash = createHash("sha256").update(clientDataJSON).digest();
  const signer = createSign("SHA256");
  signer.update(Buffer.concat([authenticatorData, clientDataHash]));
  signer.end();
  return {
    authenticatorData: authenticatorData.toString("base64url"),
    clientDataJSON: clientDataJSON.toString("base64url"),
    signature: signer.sign(privateKey).toString("base64url"),
    webAuthnHash: `0x${createHash("sha256").update(Buffer.concat([authenticatorData, clientDataHash])).digest("hex")}` as Hex
  };
}

async function expectAccountCode(aaConfig: AccountAbstractionConfig, address: Address) {
  const publicClient = createAaPublicClient(aaConfig);
  const bytecode = await publicClient.getBytecode({ address });
  expect(bytecode).toMatch(/^0x[0-9a-fA-F]+$/);
}

function createAaPublicClient(aaConfig: AccountAbstractionConfig) {
  return createPublicClient({
    chain: defineChain({
      id: aaConfig.chainId,
      name: "Popular Consensus Local",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [aaConfig.rpcUrl] } }
    }),
    transport: http(aaConfig.rpcUrl)
  });
}

function loadAaConfig(): AccountAbstractionConfig {
  const deploymentPath = process.env.PC_LOCAL_DEPLOYMENT_FILE ?? path.join(process.cwd(), "..", "..", "data", "local-deployment.json");
  if (!existsSync(deploymentPath)) throw new Error(`Local deployment file is missing: ${deploymentPath}`);
  const deployment = JSON.parse(readFileSync(deploymentPath, "utf8")) as {
    chainId?: number;
    contracts?: Record<string, string | undefined>;
  };
  const contracts = deployment.contracts ?? {};
  return {
    chainId: Number(process.env.PC_AA_CHAIN_ID ?? deployment.chainId ?? 31337),
    rpcUrl: process.env.PC_AA_RPC_URL ?? process.env.RPC_URL ?? "http://127.0.0.1:8545",
    bundlerUrl: null,
    entryPoint: process.env.PC_AA_ENTRY_POINT ?? contracts.entryPoint ?? null,
    accountFactory: process.env.PC_AA_ACCOUNT_FACTORY ?? contracts.accountFactory ?? null,
    paymaster: process.env.PC_AA_PAYMASTER ?? contracts.paymaster ?? null,
    p256Verifier: process.env.PC_AA_P256_VERIFIER ?? contracts.p256Verifier ?? null,
    bundlerPrivateKey: process.env.PC_AA_BUNDLER_PRIVATE_KEY ?? null
  };
}

function p256DerSignatureToRS(signature: string): { r: Hex; s: Hex } {
  const der = Buffer.from(signature, "base64url");
  let offset = 0;
  if (der[offset++] !== 0x30) throw new Error("Passkey signature must be a DER sequence");
  const sequenceLength = readDerLength(der, offset);
  offset = sequenceLength.offset;
  if (offset + sequenceLength.length !== der.length) throw new Error("Passkey signature has trailing DER bytes");
  const r = readDerInteger32(der, offset);
  offset = r.offset;
  const s = readDerInteger32(der, offset);
  offset = s.offset;
  if (offset !== der.length) throw new Error("Passkey signature has trailing integer bytes");
  return { r: r.value, s: normalizeP256S(s.value) };
}

function readDerInteger32(der: Buffer, offset: number): { value: Hex; offset: number } {
  if (der[offset++] !== 0x02) throw new Error("Passkey signature integer is missing");
  const lengthInfo = readDerLength(der, offset);
  offset = lengthInfo.offset;
  const raw = der.subarray(offset, offset + lengthInfo.length);
  if (raw.length !== lengthInfo.length) throw new Error("Passkey signature integer is truncated");
  const trimmed = raw[0] === 0 ? raw.subarray(1) : raw;
  if (trimmed.length > 32) throw new Error("Passkey signature integer is too large");
  return { value: `0x${trimmed.toString("hex").padStart(64, "0")}` as Hex, offset: offset + lengthInfo.length };
}

function readDerLength(der: Buffer, offset: number): { length: number; offset: number } {
  const first = der[offset++];
  if (first < 0x80) return { length: first, offset };
  const byteLength = first & 0x7f;
  if (byteLength === 0 || byteLength > 2) throw new Error("Passkey signature DER length is unsupported");
  let length = 0;
  for (let index = 0; index < byteLength; index += 1) {
    length = (length << 8) | der[offset++];
  }
  return { length, offset };
}

function normalizeP256S(value: Hex): Hex {
  const s = BigInt(value);
  const normalized = s > P256_HALF_ORDER ? P256_ORDER - s : s;
  return `0x${normalized.toString(16).padStart(64, "0")}` as Hex;
}
