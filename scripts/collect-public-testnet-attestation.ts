import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { hashJson } from "../packages/artifacts/src/index.ts";
import {
  PublicApiV0ProtocolIndexerReplayResponseSchema,
  PublicApiV0UpgradeSafetyResponseSchema,
  PublicTestnetOperatorAttestationSchema,
  PublicTestnetOperatorRoleSchema
} from "../packages/shared/src/index.ts";

type OperatorRole = (typeof PublicTestnetOperatorRoleSchema.options)[number];
type Attestation = (typeof PublicTestnetOperatorAttestationSchema)["_output"];

const REQUIRED_CHECKS = ["typecheck", "sharedTests", "contractTests", "apiDbTests", "protocolIndexerReplay", "communityImportReplay"] as const;
const GOVERNANCE_DRILL_CHECKS = [
  "governanceParameterDrill",
  "adoptionPolicyDrill",
  "emergencySuspensionDrill",
  "communityExportReplay",
  "forkMetadata",
  "upgradeSafetyDrill"
] as const;

type Args = {
  operatorId: string | null;
  operatorContact: string | null;
  operatorOrganization: string | null;
  independenceStatement: string | null;
  operatorRole: OperatorRole | null;
  gitCommit: string | null;
  chainId: string | null;
  rpcUrl: string | null;
  apiBaseUrl: string | null;
  communityId: string | null;
  deploymentHash: string | null;
  deploymentJson: string | null;
  transactionStreamHash: string | null;
  eventStreamHash: string | null;
  upgradeSafetyModelHash: string | null;
  checksPreset: "none" | "required" | "complete";
  checks: Record<string, string>;
  observations: string[];
  out: string | null;
  attestedAt: string | null;
  json: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    operatorId: null,
    operatorContact: null,
    operatorOrganization: null,
    independenceStatement: null,
    operatorRole: null,
    gitCommit: null,
    chainId: null,
    rpcUrl: null,
    apiBaseUrl: null,
    communityId: null,
    deploymentHash: null,
    deploymentJson: null,
    transactionStreamHash: null,
    eventStreamHash: null,
    upgradeSafetyModelHash: null,
    checksPreset: "none",
    checks: {},
    observations: [],
    out: null,
    attestedAt: null,
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg === "--check") {
      const value = readNext(argv, index, arg);
      const [name, status] = splitKeyValue(value, arg);
      args.checks[name] = status;
      index += 1;
      continue;
    }
    if (arg === "--observation") {
      args.observations.push(readNext(argv, index, arg));
      index += 1;
      continue;
    }

    const value = readNext(argv, index, arg);
    switch (arg) {
      case "--operator-id":
        args.operatorId = value;
        break;
      case "--operator-contact":
        args.operatorContact = value;
        break;
      case "--operator-organization":
        args.operatorOrganization = value;
        break;
      case "--independence-statement":
        args.independenceStatement = value;
        break;
      case "--role":
        args.operatorRole = parseRole(value);
        break;
      case "--git-commit":
        args.gitCommit = value;
        break;
      case "--chain-id":
        args.chainId = value;
        break;
      case "--rpc-url":
        args.rpcUrl = value;
        break;
      case "--api-base-url":
        args.apiBaseUrl = trimTrailingSlash(value);
        break;
      case "--community-id":
        args.communityId = value;
        break;
      case "--deployment-hash":
        args.deploymentHash = value;
        break;
      case "--deployment-json":
        args.deploymentJson = value;
        break;
      case "--transaction-stream-hash":
        args.transactionStreamHash = value;
        break;
      case "--event-stream-hash":
        args.eventStreamHash = value;
        break;
      case "--upgrade-safety-model-hash":
        args.upgradeSafetyModelHash = value;
        break;
      case "--checks-preset":
        args.checksPreset = parseChecksPreset(value);
        break;
      case "--out":
        args.out = value;
        break;
      case "--attested-at":
        args.attestedAt = value;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
    index += 1;
  }

  return args;
}

function printHelp() {
  console.log(`Usage: pnpm testnet:collect-attestation -- --operator-id <id> --role <role> --git-commit <commit> --chain-id <id> --rpc-url <url> [options]

Collects a public-testnet operator attestation JSON file.

Required:
  --operator-id <id>       Independent operator id, handle, or public key.
  --operator-contact <id>  Contact URL, email, handle, or public key for independence review.
  --independence-statement <text>
                           Short statement explaining why this operator is independent.
  --role <role>            deployer, api-indexer, replay-verifier, or community-steward.
  --git-commit <commit>    Git commit tested by this operator.
  --chain-id <id>          Public testnet chain id.
  --rpc-url <url>          Public testnet RPC URL.
  --operator-organization <name>
                           Optional organization name; omit for independent individuals.

Endpoint collection:
  --api-base-url <url>     API/indexer endpoint to query.
  --community-id <id>      Community id used for upgrade-safety reads.

Manual hash inputs:
  --transaction-stream-hash <hash>
  --event-stream-hash <hash>
  --upgrade-safety-model-hash <hash>
  --deployment-hash <hash>
  --deployment-json <path> Compute deploymentHash from a deployment JSON file.

Checks and output:
  --checks-preset required Marks required command/replay checks as passed or Verified.
  --checks-preset complete Marks required checks and governance drill checks as passed or Verified.
  --check name=status      Add or override one check value. Repeatable.
  --observation <text>     Add an observation. Repeatable.
  --out <path>             Write the attestation to a file.
  --attested-at <iso>      Override attestation timestamp.
  --json                   Print only the attestation JSON.
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  requireBaseArgs(args);

  const endpointEvidence = await collectEndpointEvidence(args);
  const deploymentHash = await resolveDeploymentHash(args);
  const checks = buildChecks(args);

  const attestation = {
    protocol: "popular-consensus",
    schemaVersion: "public-testnet-operator-attestation-v0",
    operatorId: args.operatorId,
    operatorContact: args.operatorContact,
    operatorOrganization: args.operatorOrganization,
    independenceStatement: args.independenceStatement,
    operatorRole: args.operatorRole,
    gitCommit: args.gitCommit,
    chainId: args.chainId,
    rpcUrl: args.rpcUrl,
    apiBaseUrl: args.apiBaseUrl,
    deploymentHash,
    transactionStreamHash: args.transactionStreamHash ?? endpointEvidence.transactionStreamHash,
    eventStreamHash: args.eventStreamHash ?? endpointEvidence.eventStreamHash,
    upgradeSafetyModelHash: args.upgradeSafetyModelHash ?? endpointEvidence.upgradeSafetyModelHash,
    checks,
    observations: args.observations,
    attestedAt: args.attestedAt ?? new Date().toISOString()
  };

  const parsed = PublicTestnetOperatorAttestationSchema.safeParse(attestation);
  if (!parsed.success) {
    throw new Error(`Built attestation does not match public-testnet-operator-attestation-v0: ${parsed.error.issues.map((issue) => `${issue.path.join(".") || "root"} ${issue.message}`).join("; ")}`);
  }

  enforceRoleRequirements(parsed.data);
  const content = `${JSON.stringify(parsed.data, null, 2)}\n`;
  if (args.out) {
    await mkdir(path.dirname(args.out), { recursive: true });
    await writeFile(args.out, content, "utf8");
  }

  if (args.json) {
    process.stdout.write(content);
  } else {
    if (args.out) console.log(`Wrote ${args.out}`);
    console.log(`Attestation hash: ${hashJson(parsed.data)}`);
    console.log(`Operator: ${parsed.data.operatorId} (${parsed.data.operatorRole})`);
    console.log(`Replay hashes: ${parsed.data.transactionStreamHash} ${parsed.data.eventStreamHash}`);
  }
}

async function collectEndpointEvidence(args: Args) {
  if (hasManualHashes(args)) return requireManualHashes(args);

  if (!args.apiBaseUrl) {
    return requireManualHashes(args);
  }

  const replay = await fetchJson(`${args.apiBaseUrl}/registry/protocol-transactions/replay`, PublicApiV0ProtocolIndexerReplayResponseSchema, "protocol replay");
  if (replay.status !== "Verified") throw new Error(`protocol replay status is ${replay.status}; expected Verified`);
  const failedChecks = replay.protocol.statuses.failedChecks;
  if (Array.isArray(failedChecks) && failedChecks.length > 0) {
    throw new Error(`protocol replay has failed checks: ${failedChecks.join(", ")}`);
  }

  if (!args.communityId && !args.upgradeSafetyModelHash) {
    throw new Error("--community-id is required with --api-base-url unless --upgrade-safety-model-hash is provided");
  }

  const upgradeSafetyModelHash =
    args.upgradeSafetyModelHash ??
    (
      await fetchJson(
        `${args.apiBaseUrl}/communities/${encodeURIComponent(args.communityId ?? "")}/governance/upgrade-safety`,
        PublicApiV0UpgradeSafetyResponseSchema,
        "upgrade safety"
      )
    ).protocol.hashes.modelHash;

  if (typeof upgradeSafetyModelHash !== "string") throw new Error("upgrade-safety response did not include protocol.hashes.modelHash");

  return {
    transactionStreamHash: replay.rebuilt.transactionStreamHash,
    eventStreamHash: replay.rebuilt.eventStreamHash,
    upgradeSafetyModelHash
  };
}

function requireManualHashes(args: Args) {
  const missing = [
    args.transactionStreamHash ? null : "--transaction-stream-hash",
    args.eventStreamHash ? null : "--event-stream-hash",
    args.upgradeSafetyModelHash ? null : "--upgrade-safety-model-hash"
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(`Provide --api-base-url and --community-id, or provide manual hashes: ${missing.join(", ")}`);
  }
  return {
    transactionStreamHash: args.transactionStreamHash,
    eventStreamHash: args.eventStreamHash,
    upgradeSafetyModelHash: args.upgradeSafetyModelHash
  };
}

function hasManualHashes(args: Args) {
  return Boolean(args.transactionStreamHash && args.eventStreamHash && args.upgradeSafetyModelHash);
}

async function resolveDeploymentHash(args: Args) {
  if (args.deploymentHash && args.deploymentJson) throw new Error("Use either --deployment-hash or --deployment-json, not both");
  if (args.deploymentHash) return args.deploymentHash;
  if (!args.deploymentJson) return null;
  const raw = await readFile(args.deploymentJson, "utf8");
  return hashJson(JSON.parse(raw) as unknown);
}

function buildChecks(args: Args) {
  const checks: Record<string, string> = {};
  if (args.checksPreset === "required" || args.checksPreset === "complete") {
    for (const check of REQUIRED_CHECKS) checks[check] = defaultStatusForCheck(check);
  }
  if (args.checksPreset === "complete") {
    for (const check of GOVERNANCE_DRILL_CHECKS) checks[check] = defaultStatusForCheck(check);
  }
  return { ...checks, ...args.checks };
}

function defaultStatusForCheck(check: string) {
  return check.endsWith("Replay") || check === "protocolIndexerReplay" ? "Verified" : "passed";
}

function requireBaseArgs(args: Args): asserts args is Args & {
  operatorId: string;
  operatorContact: string;
  independenceStatement: string;
  operatorRole: OperatorRole;
  gitCommit: string;
  chainId: string;
  rpcUrl: string;
} {
  const missing = [
    args.operatorId ? null : "--operator-id",
    args.operatorContact ? null : "--operator-contact",
    args.independenceStatement ? null : "--independence-statement",
    args.operatorRole ? null : "--role",
    args.gitCommit ? null : "--git-commit",
    args.chainId ? null : "--chain-id",
    args.rpcUrl ? null : "--rpc-url"
  ].filter(Boolean);
  if (missing.length > 0) throw new Error(`Missing required arguments: ${missing.join(", ")}`);
}

function enforceRoleRequirements(attestation: Attestation) {
  if (attestation.operatorRole === "api-indexer" && !attestation.apiBaseUrl) {
    throw new Error("api-indexer attestations require --api-base-url");
  }
  if (attestation.operatorRole === "deployer" && !attestation.deploymentHash) {
    throw new Error("deployer attestations require --deployment-hash or --deployment-json");
  }
}

async function fetchJson<Schema extends { parse(value: unknown): unknown }>(
  url: string,
  schema: Schema,
  label: string
): Promise<ReturnType<Schema["parse"]>> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${label} request failed: ${response.status} ${response.statusText} (${url})`);
  return schema.parse(await response.json()) as ReturnType<Schema["parse"]>;
}

function readNext(argv: string[], index: number, name: string) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

function splitKeyValue(value: string, name: string) {
  const splitAt = value.indexOf("=");
  if (splitAt <= 0 || splitAt === value.length - 1) throw new Error(`${name} requires name=status`);
  return [value.slice(0, splitAt), value.slice(splitAt + 1)] as const;
}

function parseRole(value: string): OperatorRole {
  const result = PublicTestnetOperatorRoleSchema.safeParse(value);
  if (!result.success) throw new Error(`Invalid role: ${value}`);
  return result.data;
}

function parseChecksPreset(value: string) {
  if (value === "none" || value === "required" || value === "complete") return value;
  throw new Error(`Invalid --checks-preset: ${value}`);
}

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
