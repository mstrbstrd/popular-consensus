import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createPublicClient, createWalletClient, defineChain, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const anvil = defineChain({
  id: 31337,
  name: "Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [process.env.RPC_URL ?? "http://127.0.0.1:8545"] } }
});

const account = privateKeyToAccount(
  process.env.DEPLOYER_PRIVATE_KEY ??
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
);
const transport = http(process.env.RPC_URL ?? "http://127.0.0.1:8545");
const wallet = createWalletClient({ account, chain: anvil, transport });
const publicClient = createPublicClient({ chain: anvil, transport });

async function deploy(sourceFile, contractName, args = []) {
  const artifact = readArtifact(sourceFile, contractName);
  const bytecode = artifact.bytecode.object.startsWith("0x")
    ? artifact.bytecode.object
    : `0x${artifact.bytecode.object}`;
  const hash = await wallet.deployContract({
    abi: artifact.abi,
    bytecode,
    args
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) {
    throw new Error(`No contract address for ${contractName}`);
  }
  return receipt.contractAddress;
}

function readArtifact(sourceFile, contractName) {
  const artifactPath = path.join(process.cwd(), "out", sourceFile, `${contractName}.json`);
  return JSON.parse(readFileSync(artifactPath, "utf8"));
}

const pc = await deploy("PopularConsensus.sol", "PCToken", [parseEther("1000000")]);
const stake = await deploy("PopularConsensus.sol", "StakeManager", [pc, account.address]);
const questionRegistry = await deploy("PopularConsensus.sol", "QuestionRegistry");
const challengeCourt = await deploy("PopularConsensus.sol", "ChallengeCourt");
const credentialRegistry = await deploy("PopularConsensus.sol", "CredentialRegistry");
const pollManager = await deploy("PopularConsensus.sol", "PollManager");
const tallyManager = await deploy("PopularConsensus.sol", "TallyManager");
const resultArchive = await deploy("PopularConsensus.sol", "ResultArchive");
const adoptionRegistry = await deploy("PopularConsensus.sol", "AdoptionRegistry");
const entryPoint = await deploy("AccountAbstraction.sol", "PopularConsensusEntryPoint");
const configuredP256Verifier = process.env.P256_VERIFIER_ADDRESS || process.env.PC_AA_P256_VERIFIER || null;
const p256Verifier = configuredP256Verifier ?? await deploy("AccountAbstraction.sol", "PopularConsensusP256Verifier");
const p256VerifierMode = configuredP256Verifier ? "configured" : "local-solidity";
const accountFactory = await deploy("AccountAbstraction.sol", "PopularConsensusAccountFactory", [entryPoint, p256Verifier]);
const paymaster = await deploy("AccountAbstraction.sol", "PopularConsensusPaymaster", [entryPoint]);

const deployment = {
  chainId: anvil.id,
  deployer: account.address,
  contracts: {
    pc,
    stake,
    questionRegistry,
    challengeCourt,
    credentialRegistry,
    pollManager,
    pollAdapter: pollManager,
    tallyManager,
    resultArchive,
    adoptionRegistry,
    entryPoint,
    accountFactory,
    paymaster,
    p256Verifier,
    p256VerifierMode
  }
};

mkdirSync(path.join(process.cwd(), "..", "..", "data"), { recursive: true });
writeFileSync(path.join(process.cwd(), "..", "..", "data", "local-deployment.json"), `${JSON.stringify(deployment, null, 2)}\n`);
console.log(JSON.stringify(deployment, null, 2));
