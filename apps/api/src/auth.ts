import { createHash, createPublicKey, createVerify, randomBytes, timingSafeEqual } from "node:crypto";

export type ParsedPasskeyAttestation = {
  credentialId: string;
  publicKeyCose: string;
  publicKeyX: `0x${string}`;
  publicKeyY: `0x${string}`;
  counter: number;
};

export type ParsedPasskeyAssertion = {
  challenge: string;
  origin: string;
  type: string;
  counter: number;
  rpIdHash: Buffer;
  signedPayload: Buffer;
};

type CborValue = Buffer | string | number | boolean | null | CborValue[] | Map<CborValue, CborValue>;

const textDecoder = new TextDecoder();

export function base64UrlEncode(value: Buffer | Uint8Array | string) {
  const buffer = typeof value === "string" ? Buffer.from(value) : Buffer.from(value);
  return buffer.toString("base64url");
}

export function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url");
}

export function sha256Hex(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

export function newAuthChallenge() {
  return base64UrlEncode(randomBytes(32));
}

export function newSessionToken() {
  return `pc_session_${base64UrlEncode(randomBytes(32))}`;
}

export function hashSessionToken(token: string) {
  return sha256Hex(token);
}

export function counterfactualSmartAccountAddress(kind: "passkey" | "wallet", controllerId: string) {
  const seed = sha256Hex(`popular-consensus-aa-v1:${kind}:${controllerId.toLowerCase()}`);
  return `0x${seed.slice(-40)}`;
}

export function buildWalletAuthMessage(input: {
  address: string;
  challenge: string;
  issuedAt: Date;
  smartAccountAddress: string;
  accountStandard?: string;
  chainId?: number;
}) {
  return [
    "Popular Consensus wants you to sign in with an account-abstraction controller.",
    "",
    `Controller: ${input.address}`,
    `Smart account: ${input.smartAccountAddress}`,
    `Account standard: ${input.accountStandard ?? "erc-4337-counterfactual-v0"}`,
    "URI: popular-consensus://auth",
    "Version: 1",
    `Chain ID: ${input.chainId ?? 31337}`,
    `Nonce: ${input.challenge}`,
    `Issued At: ${input.issuedAt.toISOString()}`,
    "",
    "This signature authenticates the controller for protocol account actions. It does not reveal or authorize private ballot contents."
  ].join("\n");
}

export function parsePasskeyAttestation(input: {
  expectedChallenge: string;
  clientDataJSON: string;
  attestationObject: string;
  allowedOrigins: string[];
}): ParsedPasskeyAttestation {
  const clientData = parseClientData(input.clientDataJSON, "webauthn.create", input.expectedChallenge, input.allowedOrigins);
  if (clientData.type !== "webauthn.create") throw new Error("Invalid passkey registration type");

  const attestationObject = decodeCbor(base64UrlDecode(input.attestationObject));
  if (!(attestationObject instanceof Map)) throw new Error("Invalid passkey attestation object");
  const authData = getCborMapBuffer(attestationObject, "authData");
  const flags = authData[32];
  if ((flags & 0x40) === 0) throw new Error("Passkey attestation is missing credential data");

  const counter = authData.readUInt32BE(33);
  const credentialIdLength = authData.readUInt16BE(53);
  const credentialIdStart = 55;
  const credentialIdEnd = credentialIdStart + credentialIdLength;
  if (authData.length <= credentialIdEnd) throw new Error("Passkey credential data is truncated");
  const credentialId = authData.subarray(credentialIdStart, credentialIdEnd);
  const publicKeyCose = authData.subarray(credentialIdEnd);
  const coordinates = coseP256PublicKeyCoordinates(publicKeyCose);

  return {
    credentialId: base64UrlEncode(credentialId),
    publicKeyCose: base64UrlEncode(publicKeyCose),
    publicKeyX: coordinates.x,
    publicKeyY: coordinates.y,
    counter
  };
}

export function parsePasskeyAssertion(input: {
  expectedChallenge: string;
  clientDataJSON: string;
  authenticatorData: string;
  allowedOrigins: string[];
}): ParsedPasskeyAssertion {
  const clientData = parseClientData(input.clientDataJSON, "webauthn.get", input.expectedChallenge, input.allowedOrigins);
  const authenticatorData = base64UrlDecode(input.authenticatorData);
  if (authenticatorData.length < 37) throw new Error("Passkey assertion authenticator data is truncated");
  const clientDataHash = createHash("sha256").update(base64UrlDecode(input.clientDataJSON)).digest();
  return {
    challenge: clientData.challenge,
    origin: clientData.origin,
    type: clientData.type,
    counter: authenticatorData.readUInt32BE(33),
    rpIdHash: authenticatorData.subarray(0, 32),
    signedPayload: Buffer.concat([authenticatorData, clientDataHash])
  };
}

export function verifyPasskeySignature(input: { publicKeyCose: string; signedPayload: Buffer; signature: string }) {
  const publicKey = coseP256PublicKeyToKeyObject(base64UrlDecode(input.publicKeyCose));
  const verifier = createVerify("SHA256");
  verifier.update(input.signedPayload);
  verifier.end();
  return verifier.verify(publicKey, base64UrlDecode(input.signature));
}

export function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function parseClientData(clientDataJSON: string, expectedType: string, expectedChallenge: string, allowedOrigins: string[]) {
  const clientData = JSON.parse(base64UrlDecode(clientDataJSON).toString("utf8")) as {
    type?: string;
    challenge?: string;
    origin?: string;
  };
  if (clientData.type !== expectedType) throw new Error("Invalid passkey ceremony type");
  if (!clientData.challenge || !safeEqual(clientData.challenge, expectedChallenge)) throw new Error("Passkey challenge mismatch");
  if (!clientData.origin || !allowedOrigins.includes(clientData.origin)) throw new Error("Passkey origin is not allowed");
  return { type: clientData.type, challenge: clientData.challenge, origin: clientData.origin };
}

function validateCoseP256Key(value: Buffer) {
  coseP256PublicKeyToKeyObject(value);
}

export function passkeyPublicKeyCoordinates(publicKeyCose: string) {
  return coseP256PublicKeyCoordinates(base64UrlDecode(publicKeyCose));
}

function coseP256PublicKeyCoordinates(value: Buffer) {
  const key = decodeCbor(value);
  if (!(key instanceof Map)) throw new Error("Invalid COSE public key");
  const kty = key.get(1);
  const alg = key.get(3);
  const crv = key.get(-1);
  const x = key.get(-2);
  const y = key.get(-3);
  if (kty !== 2 || alg !== -7 || crv !== 1 || !Buffer.isBuffer(x) || !Buffer.isBuffer(y)) {
    throw new Error("Passkey must use ES256 over P-256");
  }
  if (x.length !== 32 || y.length !== 32) throw new Error("Passkey P-256 coordinates must be 32 bytes");
  return { x: `0x${x.toString("hex")}` as `0x${string}`, y: `0x${y.toString("hex")}` as `0x${string}` };
}

function coseP256PublicKeyToKeyObject(value: Buffer) {
  const { x, y } = coseP256PublicKeyCoordinates(value);
  return createPublicKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: base64UrlEncode(Buffer.from(x.slice(2), "hex")),
      y: base64UrlEncode(Buffer.from(y.slice(2), "hex"))
    },
    format: "jwk"
  });
}

function getCborMapBuffer(map: Map<CborValue, CborValue>, key: string) {
  const value = map.get(key);
  if (!Buffer.isBuffer(value)) throw new Error(`CBOR field ${key} is missing`);
  return value;
}

function decodeCbor(buffer: Buffer) {
  const [value, offset] = readCbor(buffer, 0);
  if (offset !== buffer.length) throw new Error("Unexpected CBOR trailing data");
  return value;
}

function readCbor(buffer: Buffer, offset: number): [CborValue, number] {
  if (offset >= buffer.length) throw new Error("Unexpected CBOR end");
  const first = buffer[offset];
  const major = first >> 5;
  const additional = first & 0x1f;
  const [length, nextOffset] = readCborLength(buffer, offset + 1, additional);

  if (major === 0) return [length, nextOffset];
  if (major === 1) return [-1 - length, nextOffset];
  if (major === 2) return [buffer.subarray(nextOffset, nextOffset + length), nextOffset + length];
  if (major === 3) return [textDecoder.decode(buffer.subarray(nextOffset, nextOffset + length)), nextOffset + length];
  if (major === 4) {
    const values: CborValue[] = [];
    let cursor = nextOffset;
    for (let index = 0; index < length; index += 1) {
      const [value, childOffset] = readCbor(buffer, cursor);
      values.push(value);
      cursor = childOffset;
    }
    return [values, cursor];
  }
  if (major === 5) {
    const values = new Map<CborValue, CborValue>();
    let cursor = nextOffset;
    for (let index = 0; index < length; index += 1) {
      const [key, keyOffset] = readCbor(buffer, cursor);
      const [value, valueOffset] = readCbor(buffer, keyOffset);
      values.set(key, value);
      cursor = valueOffset;
    }
    return [values, cursor];
  }
  if (major === 7) {
    if (additional === 20) return [false, nextOffset];
    if (additional === 21) return [true, nextOffset];
    if (additional === 22) return [null, nextOffset];
  }
  throw new Error("Unsupported CBOR value");
}

function readCborLength(buffer: Buffer, offset: number, additional: number): [number, number] {
  if (additional < 24) return [additional, offset];
  if (additional === 24) return [buffer.readUInt8(offset), offset + 1];
  if (additional === 25) return [buffer.readUInt16BE(offset), offset + 2];
  if (additional === 26) return [buffer.readUInt32BE(offset), offset + 4];
  throw new Error("Unsupported CBOR length");
}
