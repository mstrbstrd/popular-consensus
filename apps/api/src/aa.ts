import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  concatHex,
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeAbiParameters,
  encodeDeployData,
  encodeFunctionData,
  encodePacked,
  getAddress,
  getCreate2Address,
  http,
  keccak256,
  parseAbi,
  parseAbiParameters,
  toHex,
  type Abi,
  type Address,
  type Hex
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base64UrlDecode, base64UrlEncode, counterfactualSmartAccountAddress } from "./auth";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
const DEFAULT_ANVIL_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const P256_ORDER = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");
const P256_HALF_ORDER = P256_ORDER / 2n;

const accountAbi = parseAbi([
  "constructor(address entryPoint_, address p256Verifier_, address walletController_, bytes32 passkeyX_, bytes32 passkeyY_)",
  "function executeBatch(address[] targets, uint256[] values, bytes[] payloads)"
]);

const factoryAbi = parseAbi([
  "function createAccount(address walletController, bytes32 passkeyX, bytes32 passkeyY, bytes32 salt) returns (address)"
]);

const entryPointAbi = parseAbi([
  "function handleOps((address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature)[] ops,address beneficiary)"
]);

const paymasterAbi = parseAbi(["function setSponsoredSender(address sender,bool sponsored)"]);

export type AccountAbstractionConfig = {
  chainId: number;
  rpcUrl: string;
  bundlerUrl?: string | null;
  entryPoint: string | null;
  accountFactory: string | null;
  paymaster: string | null;
  p256Verifier: string | null;
  bundlerPrivateKey?: string | null;
};

export type SmartAccountPrediction = {
  address: Address;
  accountStandard: "erc-4337-local-v1" | "erc-4337-counterfactual-v0";
  source: "factory-create2" | "legacy-hash";
  entryPoint: Address | null;
  accountFactory: Address | null;
  paymaster: Address | null;
  p256Verifier: Address | null;
  walletController: Address;
  passkeyX: Hex;
  passkeyY: Hex;
  salt: Hex | null;
  initCode: Hex;
  paymasterAndData: Hex;
};

export type SerializedUserOperation = {
  sender: Address;
  nonce: string;
  initCode: Hex;
  callData: Hex;
  accountGasLimits: Hex;
  preVerificationGas: string;
  gasFees: Hex;
  paymasterAndData: Hex;
  signature: Hex;
};

export type PreparedUserOperation = {
  userOperation: SerializedUserOperation;
  userOpHash: Hex;
  signatureKind: "wallet-personal-sign" | "passkey-webauthn-p256";
  signingMessage: Hex;
  signingChallenge?: string;
};

export type UserOperationSubmission = {
  mode: "local-entrypoint" | "bundler-rpc";
  sponsored: boolean;
  transactionHash?: Hex;
  userOperationHash?: Hex;
  bundlerUrl?: string;
};

export type BundlerUserOperation = {
  sender: string;
  nonce: string;
  initCode: string;
  callData: string;
  accountGasLimits: string;
  preVerificationGas: string;
  gasFees: string;
  paymasterAndData: string;
  signature: string;
};

type WalletControllerInput = {
  kind: "wallet";
  walletAddress: string;
};

type PasskeyControllerInput = {
  kind: "passkey";
  credentialId: string;
  passkeyX: Hex;
  passkeyY: Hex;
};

export function predictSmartAccount(
  controller: WalletControllerInput | PasskeyControllerInput,
  aaConfig: AccountAbstractionConfig,
  options: { requireFactory?: boolean } = {}
): SmartAccountPrediction {
  const entryPoint = maybeAddress(aaConfig.entryPoint);
  const accountFactory = maybeAddress(aaConfig.accountFactory);
  const paymaster = maybeAddress(aaConfig.paymaster);
  const p256Verifier = maybeAddress(aaConfig.p256Verifier) ?? ZERO_ADDRESS;
  const legacyAddress = getAddress(
    controller.kind === "wallet"
      ? counterfactualSmartAccountAddress("wallet", getAddress(controller.walletAddress))
      : counterfactualSmartAccountAddress("passkey", controller.credentialId)
  );
  const legacy = {
    address: legacyAddress,
    accountStandard: "erc-4337-counterfactual-v0" as const,
    source: "legacy-hash" as const,
    entryPoint,
    accountFactory,
    paymaster,
    p256Verifier,
    walletController: controller.kind === "wallet" ? getAddress(controller.walletAddress) : ZERO_ADDRESS,
    passkeyX: controller.kind === "passkey" ? controller.passkeyX : ZERO_BYTES32,
    passkeyY: controller.kind === "passkey" ? controller.passkeyY : ZERO_BYTES32,
    salt: null,
    initCode: "0x" as Hex,
    paymasterAndData: "0x" as Hex
  };

  if (!entryPoint || !accountFactory) {
    if (options.requireFactory) throw new Error("Account factory deployment is not configured");
    return legacy;
  }

  const accountBytecode = readAccountBytecode();
  if (!accountBytecode) {
    if (options.requireFactory) throw new Error("PopularConsensusAccount bytecode artifact is unavailable");
    return legacy;
  }

  const walletController = controller.kind === "wallet" ? getAddress(controller.walletAddress) : ZERO_ADDRESS;
  const passkeyX = controller.kind === "passkey" ? controller.passkeyX : ZERO_BYTES32;
  const passkeyY = controller.kind === "passkey" ? controller.passkeyY : ZERO_BYTES32;
  const salt =
    controller.kind === "wallet"
      ? keccak256(encodePacked(["string", "address"], ["popular-consensus-aa-wallet-v1", walletController]))
      : keccak256(encodePacked(["string", "bytes32"], ["popular-consensus-aa-passkey-v1", passkeyCredentialHash(controller.credentialId)]));
  const deploymentBytecode = encodeDeployData({
    abi: accountAbi,
    bytecode: accountBytecode,
    args: [entryPoint, p256Verifier, walletController, passkeyX, passkeyY]
  });
  const createAccountData = encodeFunctionData({
    abi: factoryAbi,
    functionName: "createAccount",
    args: [walletController, passkeyX, passkeyY, salt]
  });
  return {
    address: getCreate2Address({ from: accountFactory, salt, bytecode: deploymentBytecode }),
    accountStandard: "erc-4337-local-v1",
    source: "factory-create2",
    entryPoint,
    accountFactory,
    paymaster,
    p256Verifier,
    walletController,
    passkeyX,
    passkeyY,
    salt,
    initCode: concatHex([accountFactory, createAccountData]),
    paymasterAndData: paymaster ? concatHex([paymaster, toHex("popular-consensus-local-paymaster")]) : "0x"
  };
}

export function prepareDeploymentUserOperation(prediction: SmartAccountPrediction, chainId: number): PreparedUserOperation | null {
  if (prediction.source !== "factory-create2" || !prediction.entryPoint) return null;
  const userOperation: SerializedUserOperation = {
    sender: prediction.address,
    nonce: "0",
    initCode: prediction.initCode,
    callData: encodeFunctionData({
      abi: accountAbi,
      functionName: "executeBatch",
      args: [[], [], []]
    }),
    accountGasLimits: ZERO_BYTES32,
    preVerificationGas: "0",
    gasFees: ZERO_BYTES32,
    paymasterAndData: prediction.paymasterAndData,
    signature: "0x"
  };
  const userOpHash = getLocalUserOpHash(userOperation, prediction.entryPoint, chainId);
  return {
    userOperation,
    userOpHash,
    signatureKind: prediction.walletController === ZERO_ADDRESS ? "passkey-webauthn-p256" : "wallet-personal-sign",
    signingMessage: userOpHash,
    signingChallenge: userOpHashToPasskeyChallenge(userOpHash)
  };
}

export function attachWalletSignature(userOperation: SerializedUserOperation, signature: Hex): SerializedUserOperation {
  const normalized = normalizeHex(signature);
  return { ...userOperation, signature: concatHex(["0x00", normalized]) };
}

export function attachPasskeySignature(
  userOperation: SerializedUserOperation,
  assertion: { clientDataJSON: string; authenticatorData: string; signature: string },
  expectedChallenge: string
): SerializedUserOperation {
  const clientDataJSON = base64UrlDecode(assertion.clientDataJSON);
  const authenticatorData = base64UrlDecode(assertion.authenticatorData);
  const { r, s } = p256DerSignatureToRS(assertion.signature);
  const challengeOffset = findClientDataChallengeOffset(clientDataJSON, expectedChallenge);
  const payload = encodeAbiParameters(parseAbiParameters("bytes,bytes,uint256,bytes32,bytes32"), [
    toHex(authenticatorData),
    toHex(clientDataJSON),
    BigInt(challengeOffset),
    r,
    s
  ]);
  return { ...userOperation, signature: concatHex(["0x01", payload]) };
}

export function userOpHashToPasskeyChallenge(userOpHash: Hex) {
  return base64UrlEncode(Buffer.from(userOpHash.slice(2), "hex"));
}

export function getLocalUserOpHash(userOperation: SerializedUserOperation, entryPoint: Address, chainId: number) {
  const packed = keccak256(
    encodeAbiParameters(parseAbiParameters("address,uint256,bytes32,bytes32,bytes32,uint256,bytes32,bytes32"), [
      userOperation.sender,
      BigInt(userOperation.nonce),
      keccak256(userOperation.initCode),
      keccak256(userOperation.callData),
      userOperation.accountGasLimits,
      BigInt(userOperation.preVerificationGas),
      userOperation.gasFees,
      keccak256(userOperation.paymasterAndData)
    ])
  );
  return keccak256(encodeAbiParameters(parseAbiParameters("bytes32,address,uint256"), [packed, entryPoint, BigInt(chainId)]));
}

export async function submitLocalUserOperation(
  userOperation: SerializedUserOperation,
  aaConfig: AccountAbstractionConfig
): Promise<UserOperationSubmission> {
  const entryPoint = maybeAddress(aaConfig.entryPoint);
  if (!entryPoint) throw new Error("EntryPoint deployment is not configured");
  const paymaster = paymasterOf(userOperation.paymasterAndData);
  const account = privateKeyToAccount(normalizeHex(aaConfig.bundlerPrivateKey ?? process.env.PC_AA_BUNDLER_PRIVATE_KEY ?? DEFAULT_ANVIL_PRIVATE_KEY));
  const chain = defineChain({
    id: aaConfig.chainId,
    name: "Popular Consensus Local",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [aaConfig.rpcUrl] } }
  });
  const walletClient = createWalletClient({ account, chain, transport: http(aaConfig.rpcUrl) });
  const publicClient = createPublicClient({ chain, transport: http(aaConfig.rpcUrl) });

  if (paymaster) {
    const sponsorHash = await walletClient.writeContract({
      address: paymaster,
      abi: paymasterAbi,
      functionName: "setSponsoredSender",
      args: [userOperation.sender, true]
    });
    await publicClient.waitForTransactionReceipt({ hash: sponsorHash });
  }

  const transactionHash = await walletClient.writeContract({
    address: entryPoint,
    abi: entryPointAbi,
    functionName: "handleOps",
    args: [[deserializeUserOperation(userOperation)], account.address]
  });
  await publicClient.waitForTransactionReceipt({ hash: transactionHash });
  return { mode: "local-entrypoint", transactionHash, sponsored: Boolean(paymaster) };
}

export async function submitUserOperation(
  userOperation: SerializedUserOperation,
  aaConfig: AccountAbstractionConfig
): Promise<UserOperationSubmission> {
  if (aaConfig.bundlerUrl) return submitBundlerUserOperation(userOperation, aaConfig);
  return submitLocalUserOperation(userOperation, aaConfig);
}

export async function submitBundlerUserOperation(
  userOperation: SerializedUserOperation,
  aaConfig: AccountAbstractionConfig
): Promise<UserOperationSubmission> {
  const entryPoint = maybeAddress(aaConfig.entryPoint);
  if (!entryPoint) throw new Error("EntryPoint deployment is not configured");
  if (!aaConfig.bundlerUrl) throw new Error("Bundler URL is not configured");
  const userOperationHash = await bundlerRpc<Hex>(aaConfig.bundlerUrl, "eth_sendUserOperation", [
    toBundlerUserOperation(userOperation),
    entryPoint
  ]);
  return {
    mode: "bundler-rpc",
    userOperationHash,
    sponsored: Boolean(paymasterOf(userOperation.paymasterAndData)),
    bundlerUrl: aaConfig.bundlerUrl
  };
}

export function passkeyCredentialHash(credentialId: string) {
  return keccak256(toHex(base64UrlDecode(credentialId)));
}

function deserializeUserOperation(userOperation: SerializedUserOperation) {
  return {
    sender: userOperation.sender,
    nonce: BigInt(userOperation.nonce),
    initCode: userOperation.initCode,
    callData: userOperation.callData,
    accountGasLimits: userOperation.accountGasLimits,
    preVerificationGas: BigInt(userOperation.preVerificationGas),
    gasFees: userOperation.gasFees,
    paymasterAndData: userOperation.paymasterAndData,
    signature: userOperation.signature
  };
}

export function toBundlerUserOperation(userOperation: SerializedUserOperation) {
  return {
    sender: userOperation.sender,
    nonce: toQuantityHex(userOperation.nonce),
    initCode: userOperation.initCode,
    callData: userOperation.callData,
    accountGasLimits: userOperation.accountGasLimits,
    preVerificationGas: toQuantityHex(userOperation.preVerificationGas),
    gasFees: userOperation.gasFees,
    paymasterAndData: userOperation.paymasterAndData,
    signature: userOperation.signature
  };
}

export function fromBundlerUserOperation(userOperation: BundlerUserOperation): SerializedUserOperation {
  assertAddress("sender", userOperation.sender);
  assertHex("initCode", userOperation.initCode);
  assertHex("callData", userOperation.callData);
  assertBytes32("accountGasLimits", userOperation.accountGasLimits);
  assertBytes32("gasFees", userOperation.gasFees);
  assertHex("paymasterAndData", userOperation.paymasterAndData);
  assertHex("signature", userOperation.signature);
  return {
    sender: getAddress(userOperation.sender),
    nonce: quantityToDecimal("nonce", userOperation.nonce),
    initCode: userOperation.initCode as Hex,
    callData: userOperation.callData as Hex,
    accountGasLimits: userOperation.accountGasLimits as Hex,
    preVerificationGas: quantityToDecimal("preVerificationGas", userOperation.preVerificationGas),
    gasFees: userOperation.gasFees as Hex,
    paymasterAndData: userOperation.paymasterAndData as Hex,
    signature: userOperation.signature as Hex
  };
}

function readAccountBytecode(): Hex | null {
  const artifactPath = path.join(repoRoot(), "packages", "contracts", "out", "AccountAbstraction.sol", "PopularConsensusAccount.json");
  try {
    const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as { bytecode?: { object?: string } };
    const object = artifact.bytecode?.object;
    if (!object) return null;
    return normalizeHex(object);
  } catch {
    return null;
  }
}

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
}

function maybeAddress(value?: string | null): Address | null {
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) return null;
  return getAddress(value);
}

function normalizeHex(value: string): Hex {
  return value.startsWith("0x") ? (value as Hex) : (`0x${value}` as Hex);
}

function paymasterOf(paymasterAndData: Hex): Address | null {
  if (paymasterAndData.length < 42) return null;
  return getAddress(paymasterAndData.slice(0, 42));
}

async function bundlerRpc<T>(bundlerUrl: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(bundlerUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  });
  const body = (await response.json().catch(() => null)) as {
    result?: T;
    error?: { code?: number; message?: string; data?: unknown };
  } | null;
  if (!response.ok) throw new Error(`Bundler RPC ${method} failed with HTTP ${response.status}`);
  if (!body) throw new Error(`Bundler RPC ${method} returned an invalid JSON response`);
  if (body.error) throw new Error(`Bundler RPC ${method} failed: ${body.error.message ?? body.error.code ?? "unknown error"}`);
  if (body.result === undefined || body.result === null) throw new Error(`Bundler RPC ${method} returned no result`);
  return body.result;
}

function toQuantityHex(value: string) {
  return `0x${BigInt(value).toString(16)}` as Hex;
}

function quantityToDecimal(field: string, value: string) {
  if (!/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value)) throw new Error(`${field} must be a hex quantity`);
  return BigInt(value).toString(10);
}

function assertAddress(field: string, value: string) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) throw new Error(`${field} must be an address`);
}

function assertBytes32(field: string, value: string) {
  if (!/^0x[a-fA-F0-9]{64}$/.test(value)) throw new Error(`${field} must be bytes32`);
}

function assertHex(field: string, value: string) {
  if (!/^0x[a-fA-F0-9]*$/.test(value)) throw new Error(`${field} must be hex`);
}

function findClientDataChallengeOffset(clientDataJSON: Buffer, expectedChallenge: string) {
  const clientData = clientDataJSON.toString("utf8");
  const marker = `"challenge":"${expectedChallenge}"`;
  const markerOffset = clientData.indexOf(marker);
  if (markerOffset === -1) throw new Error("Passkey UserOperation challenge is not bound to the signed client data");
  return markerOffset + `"challenge":"`.length;
}

function p256DerSignatureToRS(signature: string): { r: Hex; s: Hex } {
  const der = base64UrlDecode(signature);
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
