import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeAbiParameters, parseAbiParameters } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { attachPasskeySignature, attachWalletSignature, predictSmartAccount, prepareDeploymentUserOperation, submitUserOperation } from "./aa";

const aaConfig = {
  chainId: 31337,
  rpcUrl: "http://127.0.0.1:8545",
  entryPoint: "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318",
  accountFactory: "0x610178dA211FEF7D417bC0e6FeD39F05609AD788",
  paymaster: "0xB7f8BC63BbcaD18155201308C8f3540b07F84F5e",
  p256Verifier: "0x0000000000000000000000000000000000000100"
};

describe("account abstraction helper", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("predicts a factory-backed wallet account and prepares a deployment UserOperation", async () => {
    const owner = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
    const prediction = predictSmartAccount(
      { kind: "wallet", walletAddress: owner.address },
      aaConfig,
      { requireFactory: true }
    );

    expect(prediction.source).toBe("factory-create2");
    expect(prediction.accountStandard).toBe("erc-4337-local-v1");
    expect(prediction.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(prediction.initCode.toLowerCase()).toContain("610178da211fef7d417bc0e6fed39f05609ad788");
    expect(prediction.paymasterAndData.toLowerCase()).toContain("b7f8bc63bbcad18155201308c8f3540b07f84f5e");

    const prepared = prepareDeploymentUserOperation(prediction, 31337);
    expect(prepared?.userOpHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(prepared?.userOperation.sender).toBe(prediction.address);
    expect(prepared?.userOperation.signature).toBe("0x");

    const signature = await owner.signMessage({ message: { raw: prepared!.signingMessage } });
    const signed = attachWalletSignature(prepared!.userOperation, signature);
    expect(signed.signature.startsWith("0x00")).toBe(true);
    expect(signed.signature.length).toBe(132 + 2);
  });

  it("attaches a WebAuthn passkey assertion to a deployment UserOperation", () => {
    const credentialId = Buffer.from("passkey-aa-test").toString("base64url");
    const prediction = predictSmartAccount(
      {
        kind: "passkey",
        credentialId,
        passkeyX: `0x${"11".repeat(32)}`,
        passkeyY: `0x${"22".repeat(32)}`
      },
      aaConfig,
      { requireFactory: true }
    );
    const prepared = prepareDeploymentUserOperation(prediction, 31337);
    expect(prepared?.signatureKind).toBe("passkey-webauthn-p256");
    expect(prepared?.signingChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const authenticatorData = Buffer.alloc(37);
    authenticatorData[32] = 0x05;
    const clientDataJSON = Buffer.from(
      JSON.stringify({ type: "webauthn.get", challenge: prepared!.signingChallenge, origin: "http://127.0.0.1:3002" })
    );
    const signed = attachPasskeySignature(
      prepared!.userOperation,
      {
        authenticatorData: authenticatorData.toString("base64url"),
        clientDataJSON: clientDataJSON.toString("base64url"),
        signature: derSignature(Buffer.alloc(32, 0x33), Buffer.from("ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632550", "hex")).toString(
          "base64url"
        )
      },
      prepared!.signingChallenge!
    );
    expect(signed.signature.startsWith("0x01")).toBe(true);
    expect(signed.signature.length).toBeGreaterThan(2 + 128);
    const [, , , , normalizedS] = decodeAbiParameters(
      parseAbiParameters("bytes,bytes,uint256,bytes32,bytes32"),
      `0x${signed.signature.slice(4)}`
    );
    expect(normalizedS).toBe(`0x${"0".repeat(63)}1`);
  });

  it("submits signed UserOperations through configured bundler RPC", async () => {
    const owner = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
    const prediction = predictSmartAccount({ kind: "wallet", walletAddress: owner.address }, aaConfig, { requireFactory: true });
    const prepared = prepareDeploymentUserOperation(prediction, 31337);
    const signed = attachWalletSignature(prepared!.userOperation, `0x${"11".repeat(65)}`);
    const userOperationHash = `0x${"aa".repeat(32)}` as const;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: userOperationHash }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const result = await submitUserOperation(signed, { ...aaConfig, bundlerUrl: "https://bundler.example/rpc" });

    expect(result).toMatchObject({
      mode: "bundler-rpc",
      userOperationHash,
      sponsored: true,
      bundlerUrl: "https://bundler.example/rpc"
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://bundler.example/rpc");
    const body = JSON.parse(String(init?.body));
    expect(body.method).toBe("eth_sendUserOperation");
    expect(body.params[0]).toMatchObject({
      sender: signed.sender,
      nonce: "0x0",
      preVerificationGas: "0x0",
      signature: signed.signature
    });
    expect(body.params[1]).toBe(aaConfig.entryPoint);
  });
});

function derSignature(r: Buffer, s: Buffer) {
  const encodedR = derInteger(r);
  const encodedS = derInteger(s);
  return Buffer.concat([Buffer.from([0x30, encodedR.length + encodedS.length]), encodedR, encodedS]);
}

function derInteger(value: Buffer) {
  const needsPadding = (value[0] & 0x80) !== 0;
  const integer = needsPadding ? Buffer.concat([Buffer.from([0]), value]) : value;
  return Buffer.concat([Buffer.from([0x02, integer.length]), integer]);
}
