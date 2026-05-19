import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const OUT_DIR = path.join(REPO_ROOT, "artifacts/grant-demo");
const CONTRACT_SRC_DIR = "packages/contracts/src";
const AGGREGATE_ENTRYPOINT = "packages/contracts/src/PopularConsensus.sol";

type ContractAccessCheck = {
  id: string;
  contractName: string;
  methodName: string;
  ok: boolean;
  detail: string;
  line?: number;
};

const grantCriticalMethods = [
  { contractName: "StakeManager", methodName: "slash" },
  { contractName: "QuestionRegistry", methodName: "setStatus" },
  { contractName: "QuestionRegistry", methodName: "accept" },
  { contractName: "QuestionRegistry", methodName: "reject" },
  { contractName: "QuestionRegistry", methodName: "archive" },
  { contractName: "ChallengeCourt", methodName: "selectJuror" },
  { contractName: "ChallengeCourt", methodName: "rule" },
  { contractName: "ChallengeCourt", methodName: "ruleResultChallenge" },
  { contractName: "ChallengeCourt", methodName: "ruleAppeal" },
  { contractName: "CredentialRegistry", methodName: "registerSchema" },
  { contractName: "CredentialRegistry", methodName: "registerIssuer" },
  { contractName: "CredentialRegistry", methodName: "suspendIssuer" },
  { contractName: "CredentialRegistry", methodName: "updateRevocationRoot" },
  { contractName: "CredentialRegistry", methodName: "setTrustPolicy" },
  { contractName: "PollManager", methodName: "createPoll" },
  { contractName: "PollManager", methodName: "configurePoll" },
  { contractName: "PollManager", methodName: "setStatus" },
  { contractName: "PollManager", methodName: "openPoll" },
  { contractName: "PollManager", methodName: "closePoll" },
  { contractName: "PollManager", methodName: "markResultPublished" },
  { contractName: "TallyManager", methodName: "proposeCommittee" },
  { contractName: "TallyManager", methodName: "activateCommittee" },
  { contractName: "TallyManager", methodName: "failCommittee" },
  { contractName: "TallyManager", methodName: "publishTallyKey" },
  { contractName: "TallyManager", methodName: "publishTallyProof" },
  { contractName: "ResultArchive", methodName: "publishResult" },
  { contractName: "ResultArchive", methodName: "publishResultWithProof" },
  { contractName: "ResultArchive", methodName: "correctResult" },
  { contractName: "ResultArchive", methodName: "finalizeResult" },
  { contractName: "ResultArchive", methodName: "archiveQuestion" },
  { contractName: "AdoptionRegistry", methodName: "activatePolicy" },
  { contractName: "AdoptionRegistry", methodName: "suspendPolicy" },
  { contractName: "AdoptionRegistry", methodName: "setPolicy" },
  { contractName: "AdoptionRegistry", methodName: "activateGovernanceParameters" },
  { contractName: "AdoptionRegistry", methodName: "suspendCommunity" },
  { contractName: "AdoptionRegistry", methodName: "resolveCommunitySuspension" }
];

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const moduleLayoutChecks = await moduleLayoutChecksFor();
  const accessChecks = await Promise.all(grantCriticalMethods.map((method) => accessCheckFor(method.contractName, method.methodName)));
  const checks = [...moduleLayoutChecks, ...accessChecks];
  const failedChecks = checks.filter((entry) => !entry.ok);
  const report = {
    protocol: "popular-consensus",
    schemaVersion: "ef-protocol-replay-kit-contract-hardening-report-v1",
    generatedAt: new Date().toISOString(),
    command: "pnpm grant:contract-hardening",
    status: failedChecks.length === 0 ? "ContractHardeningEvidenceReady" : "Mismatch",
    productionDeploymentReady: false,
    moduleLayoutStatus: "SplitModuleFilesWithAggregateEntrypoint",
    productionBlockers: [
      "Grant-critical mutating methods now have a steward guard, but steward custody is still a single local authority.",
      "Production deployments must replace local steward custody with multisig, governance, or reviewed coordinator operations before deployment claims."
    ],
    checksPassed: checks.length - failedChecks.length,
    checksTotal: checks.length,
    failedChecks: failedChecks.map((entry) => entry.id),
    checks
  };

  const reportPath = path.join(OUT_DIR, "contract-hardening-report.json");
  const transcriptPath = path.join(OUT_DIR, "contract-hardening-transcript.txt");
  await writeJson(reportPath, report);
  await writeFile(
    transcriptPath,
    [
      "Popular Consensus Protocol Replay Kit contract hardening evidence",
      "",
      "Command: pnpm grant:contract-hardening",
      `Status: ${report.status}`,
      `Production deployment ready: ${report.productionDeploymentReady}`,
      `Module layout status: ${report.moduleLayoutStatus}`,
      `Checks: ${report.checksPassed}/${report.checksTotal}`,
      "",
      "Production blockers:",
      ...report.productionBlockers.map((blocker) => `- ${blocker}`),
      "",
      "Failed checks:",
      ...(failedChecks.length > 0 ? failedChecks.map((entry) => `- ${entry.id}: ${entry.detail}`) : ["- none"])
    ].join("\n") + "\n",
    "utf8"
  );

  if (failedChecks.length > 0) {
    throw new Error(`Contract hardening evidence failed: ${failedChecks.map((entry) => entry.id).join(", ")}`);
  }

  console.log("EF Protocol Replay Kit contract hardening evidence: ContractHardeningEvidenceReady");
  console.log(`Report: ${path.relative(REPO_ROOT, reportPath)}`);
  console.log(`Transcript: ${path.relative(REPO_ROOT, transcriptPath)}`);
}

async function moduleLayoutChecksFor(): Promise<ContractAccessCheck[]> {
  const moduleFiles = [
    "PCToken.sol",
    "ProtocolAccess.sol",
    "StakeManager.sol",
    "QuestionRegistry.sol",
    "ChallengeCourt.sol",
    "CredentialRegistry.sol",
    "PollManager.sol",
    "TallyManager.sol",
    "ResultArchive.sol",
    "AdoptionRegistry.sol",
    "PopularConsensusDeployment.sol"
  ];
  const aggregate = await readFile(path.join(REPO_ROOT, AGGREGATE_ENTRYPOINT), "utf8");
  const fileChecks = await Promise.all(
    moduleFiles.map(async (file) => {
      const filePath = path.join(CONTRACT_SRC_DIR, file);
      try {
        await readFile(path.join(REPO_ROOT, filePath), "utf8");
        return {
          id: `contract-module-file-${slug(file)}`,
          contractName: file.replace(/\.sol$/, ""),
          methodName: "module-file",
          ok: true,
          detail: `${filePath} exists`
        };
      } catch {
        return {
          id: `contract-module-file-${slug(file)}`,
          contractName: file.replace(/\.sol$/, ""),
          methodName: "module-file",
          ok: false,
          detail: `${filePath} is missing`
        };
      }
    })
  );
  const importChecks = moduleFiles
    .filter((file) => file !== "PopularConsensusDeployment.sol")
    .map((file) => ({
      id: `aggregate-imports-${slug(file)}`,
      contractName: "PopularConsensus",
      methodName: "aggregate-import",
      ok: new RegExp(`import\\s+(?:\\{[^}]+\\}\\s+from\\s+)?["']\\./${escapeRegex(file)}["'];`).test(aggregate),
      detail: `${AGGREGATE_ENTRYPOINT} imports ${file}`
    }));
  return [...fileChecks, ...importChecks];
}

async function accessCheckFor(contractName: string, methodName: string): Promise<ContractAccessCheck> {
  const sourcePath = path.join(CONTRACT_SRC_DIR, `${contractName}.sol`);
  const source = await readFile(path.join(REPO_ROOT, sourcePath), "utf8");
  const id = `contract-access-${slug(contractName)}-${slug(methodName)}`;
  const contractStart = source.search(new RegExp(`\\bcontract\\s+${escapeRegex(contractName)}\\b`));
  if (contractStart < 0) {
    return {
      id,
      contractName,
      methodName,
      ok: false,
      detail: `${contractName} is missing from ${sourcePath}`
    };
  }

  const nextContractOffset = source.slice(contractStart + 1).search(/\ncontract\s+\w+/);
  const contractEnd = nextContractOffset < 0 ? source.length : contractStart + 1 + nextContractOffset;
  const contractSource = source.slice(contractStart, contractEnd);
  const methodMatch = new RegExp(`\\bfunction\\s+${escapeRegex(methodName)}\\s*\\(`).exec(contractSource);
  if (!methodMatch) {
    return {
      id,
      contractName,
      methodName,
      ok: false,
      detail: `${contractName}.${methodName} is missing from ${sourcePath}`
    };
  }

  const methodIndex = contractStart + methodMatch.index;
  const declarationEnd = source.indexOf("{", methodIndex);
  const declaration = source.slice(methodIndex, declarationEnd < 0 ? methodIndex : declarationEnd);
  const linesBefore = source.slice(0, methodIndex).split(/\r?\n/);
  const nearbyComment = linesBefore.slice(-4).join("\n");
  const line = linesBefore.length;
  const hasAccessComment = nearbyComment.includes("@custom:access-control");
  const hasStewardGuard = /\bonlySteward\b/.test(declaration);

  return {
    id,
    contractName,
    methodName,
    ok: hasStewardGuard || hasAccessComment,
    detail: hasStewardGuard
      ? `${contractName}.${methodName} is guarded by onlySteward`
      : `${contractName}.${methodName} needs onlySteward or an @custom:access-control NatSpec note`,
    line
  };
}

function slug(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
