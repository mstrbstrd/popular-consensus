import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createPublicClient, decodeEventLog, http, type Abi, type Address, type Hex } from "viem";
import { adaptOnchainEventStream, type OnchainEventLog, type OnchainEventStreamReport } from "./onchainEventAdapter";
import type { ReplayCheck } from "./types";

export type VerifyChainOptions = {
  rpcUrl: string;
  addresses: string[];
  abi: Abi;
  fromBlock?: bigint;
  toBlock?: bigint | "latest";
};

export type VerifyDecodedChainOptions = {
  logs: OnchainEventLog[];
};

export type VerifyChainReport = Omit<OnchainEventStreamReport, "schemaVersion"> & {
  schemaVersion: "pc-chain-replay-report-v1";
  mode: "chain";
  rpcUrl?: string;
  addresses?: string[];
  fromBlock?: string;
  toBlock?: string;
  logCount: number;
};

export async function verifyChain(options: VerifyChainOptions): Promise<VerifyChainReport> {
  const client = createPublicClient({ transport: http(options.rpcUrl) });
  const rawLogs = await client.getLogs({
    address: options.addresses.map((address) => address as Address),
    fromBlock: options.fromBlock ?? 0n,
    toBlock: options.toBlock ?? "latest"
  });
  const decoded = rawLogs.map((log) => decodeOnchainLog(log, options.abi));
  return {
    ...verifyDecodedChain({ logs: decoded }),
    schemaVersion: "pc-chain-replay-report-v1",
    mode: "chain",
    rpcUrl: options.rpcUrl,
    addresses: options.addresses,
    fromBlock: String(options.fromBlock ?? 0n),
    toBlock: String(options.toBlock ?? "latest"),
    logCount: rawLogs.length
  };
}

export function verifyDecodedChain(options: VerifyDecodedChainOptions): VerifyChainReport {
  const checks: ReplayCheck[] = [];
  const logs = options.logs.map(normalizeOnchainLog);
  checks.push({ id: "chain-logs-present", ok: logs.length > 0, expected: "at least one decoded log", actual: logs.length });

  const adapted = adaptOnchainEventStream(logs);
  checks.push(...adapted.checks);

  return {
    protocol: "popular-consensus",
    schemaVersion: "pc-chain-replay-report-v1",
    mode: "chain",
    status: checks.every((check) => check.ok) ? "Verified" : "Mismatch",
    checks,
    events: adapted.events,
    logCount: logs.length
  };
}

export async function loadAbiFromFiles(files: string[]): Promise<Abi> {
  const abiItems: unknown[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    const artifact = JSON.parse(await readFile(file, "utf8")) as { abi?: unknown[] };
    for (const item of artifact.abi ?? []) {
      const key = JSON.stringify(item);
      if (!seen.has(key)) {
        seen.add(key);
        abiItems.push(item);
      }
    }
  }
  return abiItems as Abi;
}

export async function loadAddressesFromDeployment(file: string) {
  const deployment = JSON.parse(await readFile(file, "utf8")) as { contracts?: Record<string, unknown> };
  const contractNames = ["questionRegistry", "challengeCourt", "credentialRegistry", "pollManager", "tallyManager", "resultArchive"];
  return contractNames
    .map((name) => deployment.contracts?.[name])
    .filter((value): value is string => typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value));
}

export function defaultContractArtifactPaths(repoRoot: string) {
  return [
    "QuestionRegistry",
    "ChallengeCourt",
    "CredentialRegistry",
    "PollManager",
    "TallyManager",
    "ResultArchive"
  ].map((contractName) => contractArtifactPath(repoRoot, contractName));
}

export function contractArtifactPath(repoRoot: string, contractName: string) {
  const candidates = [
    path.join(repoRoot, "packages/contracts/out", `${contractName}.sol`, `${contractName}.json`),
    path.join(repoRoot, "packages/contracts/out/PopularConsensus.sol", `${contractName}.json`)
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function decodeOnchainLog(log: { address: Address; data: Hex; topics: readonly Hex[]; blockNumber?: bigint | null; transactionHash?: Hex; logIndex?: number | null }, abi: Abi): OnchainEventLog {
  try {
    const decoded = decodeEventLog({ abi, data: log.data, topics: normalizeTopics(log.topics), strict: false });
    if (!decoded.eventName) throw new Error("Decoded log did not include an event name");
    return {
      eventName: decoded.eventName,
      args: normalizeArgs(decoded.args),
      address: log.address,
      blockNumber: log.blockNumber ?? undefined,
      transactionHash: log.transactionHash,
      logIndex: log.logIndex ?? undefined
    };
  } catch {
    return {
      eventName: "UnknownEvent",
      args: {},
      address: log.address,
      blockNumber: log.blockNumber ?? undefined,
      transactionHash: log.transactionHash,
      logIndex: log.logIndex ?? undefined
    };
  }
}

function normalizeArgs(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>).filter(([key]) => Number.isNaN(Number(key)));
  return Object.fromEntries(entries.map(([key, entry]) => [key, normalizeValue(entry)]));
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, normalizeValue(entry)]));
  }
  return value;
}

function normalizeOnchainLog(log: OnchainEventLog): OnchainEventLog {
  return {
    ...log,
    args: normalizeArgs(log.args)
  };
}

function normalizeTopics(topics: readonly Hex[]): [] | [signature: Hex, ...args: Hex[]] {
  if (topics.length === 0) return [];
  return [topics[0], ...topics.slice(1)] as [signature: Hex, ...args: Hex[]];
}
