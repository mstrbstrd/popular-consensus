import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  stringToHex,
  type Abi,
  type Address,
  type Hex
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { contractArtifactPath, defaultContractArtifactPaths, loadAbiFromFiles, verifyChain } from "../../packages/replay/src/index.ts";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const OUT_DIR = path.join(REPO_ROOT, "artifacts/grant-demo");
const DEFAULT_RPC_URL = "http://127.0.0.1:18545";
const DEPLOYER_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

type ContractArtifact = {
  abi: Abi;
  bytecode: string | { object: string };
};

type DeployedContract = {
  address: Address;
  abi: Abi;
};

type AnvilHandle = {
  child: ChildProcess;
  stderr: () => string;
  startupError: () => Error | null;
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const rpcUrl = process.env.RPC_URL ?? DEFAULT_RPC_URL;
  const shouldStartAnvil = !process.env.RPC_URL;
  const anvil = shouldStartAnvil ? startAnvil(rpcUrl) : null;
  const chain = defineChain({
    id: 31337,
    name: "Anvil",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } }
  });
  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const account = privateKeyToAccount((process.env.DEPLOYER_PRIVATE_KEY ?? DEPLOYER_PRIVATE_KEY) as Hex);
  const wallet = createWalletClient({ account, chain, transport });
  const steps: string[] = [];

  try {
    await waitForRpc(publicClient, anvil);

    const credentialRegistry = await deploy("CredentialRegistry");
    const questionRegistry = await deploy("QuestionRegistry");
    const pollManager = await deploy("PollManager");
    const tallyManager = await deploy("TallyManager");
    const challengeCourt = await deploy("ChallengeCourt");
    const resultArchive = await deploy("ResultArchive");

    const deployment = {
      chainId: chain.id,
      deployer: account.address,
      contracts: {
        credentialRegistry: credentialRegistry.address,
        questionRegistry: questionRegistry.address,
        pollManager: pollManager.address,
        tallyManager: tallyManager.address,
        challengeCourt: challengeCourt.address,
        resultArchive: resultArchive.address
      }
    };

    const ids = {
      communityId: hashLabel("grant-demo-community"),
      schemaId: hashLabel("resident-schema"),
      issuerId: hashLabel("resident-issuer"),
      questionId: hashLabel("grant-demo-question"),
      questionVersionHash: hashLabel("question-version-v1"),
      trustPolicyHash: hashLabel("trust-policy-v1"),
      tallyPublicKeyId: hashLabel("tally-public-key"),
      tallySetupHash: hashLabel("tally-setup"),
      activationHash: hashLabel("committee-activation"),
      nullifier: hashLabel("resident-nullifier"),
      ballotCommitment: hashLabel("encrypted-ballot-commitment"),
      encryptedPayloadHash: hashLabel("encrypted-payload"),
      ballotProofHash: hashLabel("eligibility-proof"),
      memberOne: hashLabel("member-one"),
      memberTwo: hashLabel("member-two"),
      shareOne: hashLabel("share-one"),
      shareTwo: hashLabel("share-two"),
      shareProofOne: hashLabel("share-proof-one"),
      shareProofTwo: hashLabel("share-proof-two"),
      tallyPublicationProofHash: hashLabel("tally-publication-proof"),
      resultArtifactHash: hashLabel("result-artifact"),
      aggregateCountsHash: hashLabel("aggregate-counts"),
      tallyProofHash: hashLabel("tally-proof"),
      privacyReportHash: hashLabel("privacy-report"),
      resultChallengeEvidenceHash: hashLabel("result-challenge-evidence"),
      resultChallengeResolutionHash: hashLabel("result-challenge-resolution"),
      archiveHash: hashLabel("archive-root"),
      artifactManifestHash: hashLabel("artifact-manifest")
    };

    await send("Credential schema registered", credentialRegistry, "registerSchema", [ids.schemaId]);
    await send("Credential issuer registered", credentialRegistry, "registerIssuer", [ids.issuerId, ids.schemaId]);
    await send("Credential trust policy set", credentialRegistry, "setTrustPolicy", [ids.communityId, ids.trustPolicyHash]);
    await send("Tally committee proposed", tallyManager, "proposeCommittee", [ids.communityId, hashLabel("committee-metadata"), 2n, 3n, 0n]);
    await send("Tally committee activated", tallyManager, "activateCommittee", [1n, ids.activationHash]);
    await send("Tally key setup published", tallyManager, "publishTallyKey", [1n, ids.tallyPublicKeyId, ids.tallySetupHash]);
    await send("Question submitted", questionRegistry, "submitQuestion", [ids.questionId, ids.questionVersionHash, 1n, "Verified resident response"]);
    await send("Question accepted", questionRegistry, "accept", [ids.questionId]);
    await send("Poll configured", pollManager, "createPoll", [ids.questionId, ids.schemaId, ids.tallyPublicKeyId]);
    await send("Poll opened", pollManager, "openPoll", [1n]);
    await send("Encrypted ballot accepted", pollManager, "submitBallot", [
      1n,
      ids.nullifier,
      ids.ballotCommitment,
      ids.encryptedPayloadHash,
      ids.ballotProofHash
    ]);

    let duplicateRejected = false;
    try {
      await send("Duplicate nullifier accepted unexpectedly", pollManager, "submitBallot", [
        1n,
        ids.nullifier,
        hashLabel("duplicate-ballot"),
        hashLabel("duplicate-payload"),
        ids.ballotProofHash
      ]);
    } catch (error) {
      duplicateRejected = true;
      steps.push(`Duplicate nullifier rejected: ${contractRevertReason(error)}`);
    }
    if (!duplicateRejected) throw new Error("Duplicate nullifier was accepted by PollManager");

    await send("Poll closed", pollManager, "closePoll", [1n]);
    await send("First decryption share submitted", tallyManager, "submitDecryptionShare", [1n, 1n, ids.memberOne, ids.shareOne, ids.shareProofOne]);
    await send("Second decryption share submitted", tallyManager, "submitDecryptionShare", [1n, 1n, ids.memberTwo, ids.shareTwo, ids.shareProofTwo]);
    await send("Tally proof published", tallyManager, "publishTallyProof", [1n, 1n, ids.tallyPublicationProofHash]);
    await send("Result artifact published", resultArchive, "publishResultWithProof", [
      1n,
      ids.resultArtifactHash,
      ids.aggregateCountsHash,
      ids.tallyProofHash,
      ids.tallyPublicationProofHash,
      ids.privacyReportHash,
      1n,
      0n,
      0n
    ]);
    await send("Result challenge opened", challengeCourt, "openResultChallenge", [ids.questionId, "tally-proof", ids.resultChallengeEvidenceHash, 2n]);
    await send("Result challenge resolved", challengeCourt, "ruleResultChallenge", [1n, 2, ids.resultChallengeResolutionHash]);
    await send("Result finalized", resultArchive, "finalizeResult", [1n]);
    await send("Question archived", resultArchive, "archiveQuestion", [ids.questionId, ids.archiveHash, ids.artifactManifestHash]);

    const abi = await loadAbiFromFiles(defaultContractArtifactPaths(REPO_ROOT));
    const addresses = Object.values(deployment.contracts);
    const replay = await verifyChain({ rpcUrl, addresses, abi, fromBlock: 0n, toBlock: "latest" });
    if (replay.status !== "Verified") throw new Error(`Chain replay expected Verified but got ${replay.status}`);

    const failedChecks = replay.checks.filter((check) => !check.ok).map((check) => check.id);
    const reportPath = path.join(OUT_DIR, "chain-replay-report.json");
    const transcriptPath = path.join(OUT_DIR, "chain-replay-transcript.txt");
    const deploymentPath = path.join(OUT_DIR, "chain-local-deployment.json");
    const report = {
      protocol: "popular-consensus",
      schemaVersion: "ef-protocol-replay-kit-chain-replay-report-v1",
      generatedAt: new Date().toISOString(),
      command: "pnpm grant:chain-replay",
      status: replay.status,
      mode: replay.mode,
      rpcUrl,
      deployment,
      ids,
      duplicateNullifier: {
        expected: "rejected",
        actual: duplicateRejected ? "rejected" : "accepted"
      },
      replay: {
        schemaVersion: replay.schemaVersion,
        logCount: replay.logCount,
        eventCount: replay.events.length,
        checksPassed: replay.checks.length - failedChecks.length,
        checksTotal: replay.checks.length,
        failedChecks
      },
      lifecycle: steps
    };
    const transcript = [
      "Popular Consensus Protocol Replay Kit chain replay demo",
      "",
      "Command: pnpm grant:chain-replay",
      `RPC: ${rpcUrl}`,
      `Replay status: ${replay.status}`,
      `Replay checks: ${report.replay.checksPassed}/${report.replay.checksTotal}`,
      `Decoded logs: ${replay.logCount}`,
      `Canonical events: ${replay.events.length}`,
      `Duplicate nullifier: ${report.duplicateNullifier.actual}`,
      "",
      "Contracts:",
      ...Object.entries(deployment.contracts).map(([name, address]) => `- ${name}: ${address}`),
      "",
      "Lifecycle:",
      ...steps.map((step) => `- ${step}`)
    ].join("\n");

    await writeJson(reportPath, report);
    await writeJson(deploymentPath, deployment);
    await writeFile(transcriptPath, `${transcript}\n`, "utf8");

    console.log("EF Protocol Replay Kit chain replay: Verified");
    console.log(`Report: ${relative(reportPath)}`);
    console.log(`Transcript: ${relative(transcriptPath)}`);
    console.log(`Deployment: ${relative(deploymentPath)}`);
  } finally {
    if (anvil) {
      anvil.child.kill("SIGTERM");
    }
  }

  async function deploy(contractName: string, args: readonly unknown[] = []): Promise<DeployedContract> {
    const artifact = await readContractArtifact(contractName);
    const hash = await wallet.deployContract({
      abi: artifact.abi,
      bytecode: bytecodeOf(artifact),
      args
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (!receipt.contractAddress) throw new Error(`No contract address for ${contractName}`);
    return { address: receipt.contractAddress, abi: artifact.abi };
  }

  async function send(label: string, contract: DeployedContract, functionName: string, args: readonly unknown[]) {
    const hash = await wallet.writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName,
      args
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    steps.push(`${label}: ${receipt.transactionHash}`);
  }
}

function startAnvil(rpcUrl: string): AnvilHandle {
  const url = new URL(rpcUrl);
  const child = spawn("anvil", ["--host", url.hostname, "--port", url.port || "8545", "--silent"], {
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  let startupError: Error | null = null;
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });
  child.once("error", (error) => {
    startupError = error;
  });
  return { child, stderr: () => stderr, startupError: () => startupError };
}

async function waitForRpc(publicClient: ReturnType<typeof createPublicClient>, anvil: AnvilHandle | null) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (anvil?.startupError()) throw anvil.startupError();
    try {
      await publicClient.getBlockNumber();
      return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error(`Timed out waiting for RPC. ${anvil?.stderr() ?? ""}`.trim());
}

async function readContractArtifact(contractName: string): Promise<ContractArtifact> {
  const artifactPath = contractArtifactPath(REPO_ROOT, contractName);
  try {
    return JSON.parse(await readFile(artifactPath, "utf8")) as ContractArtifact;
  } catch (error) {
    throw new Error(`Unable to read ${artifactPath}. Run pnpm contracts:build first. ${errorMessage(error)}`);
  }
}

function bytecodeOf(artifact: ContractArtifact): Hex {
  const bytecode = typeof artifact.bytecode === "string" ? artifact.bytecode : artifact.bytecode.object;
  return (bytecode.startsWith("0x") ? bytecode : `0x${bytecode}`) as Hex;
}

function hashLabel(label: string): Hex {
  return keccak256(stringToHex(label));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, bigintReplacer, 2)}\n`, "utf8");
}

function bigintReplacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}

function relative(filePath: string) {
  return path.relative(REPO_ROOT, filePath);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function contractRevertReason(error: unknown) {
  const message = errorMessage(error);
  const details = message.match(/Details: execution reverted: ([^\n]+)/);
  if (details?.[1]) return `execution reverted: ${details[1]}`;
  const reason = message.match(/with the following reason:\n([^\n]+)/);
  if (reason?.[1]) return `execution reverted: ${reason[1]}`;
  return message.split("\n")[0] ?? "reverted";
}
