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

async function deploy(contractName, args = []) {
  const artifact = readArtifact(contractName);
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

function readArtifact(contractName) {
  const artifactPath = path.join(process.cwd(), "out", "PopularConsensus.sol", `${contractName}.json`);
  return JSON.parse(readFileSync(artifactPath, "utf8"));
}

const pc = await deploy("PCToken", [parseEther("1000000")]);
const stake = await deploy("StakeManager", [pc, account.address]);
const questionRegistry = await deploy("QuestionRegistry");
const challengeCourt = await deploy("ChallengeCourt");
const credentialRegistry = await deploy("CredentialRegistry");
const pollManager = await deploy("PollManager");
const tallyManager = await deploy("TallyManager");
const resultArchive = await deploy("ResultArchive");
const adoptionRegistry = await deploy("AdoptionRegistry");

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
    adoptionRegistry
  }
};

mkdirSync(path.join(process.cwd(), "..", "..", "data"), { recursive: true });
writeFileSync(path.join(process.cwd(), "..", "..", "data", "local-deployment.json"), `${JSON.stringify(deployment, null, 2)}\n`);
console.log(JSON.stringify(deployment, null, 2));
