#!/usr/bin/env node
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  defaultContractArtifactPaths,
  loadAbiFromFiles,
  loadAddressesFromDeployment,
  tamperReplayValue,
  verifyApi,
  verifyChain,
  verifyReplayValue,
  type ReplayReport,
  type VerifyChainReport
} from "./index";

const [command] = process.argv.slice(2);

if (command === "verify-bundle") {
  const bundlePath = arg("--bundle");
  if (!bundlePath) fail("Missing --bundle <path>");
  const value = JSON.parse(await readFile(bundlePath, "utf8"));
  const report = verifyReplayValue(value);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }
  process.exitCode = report.status === "Verified" ? 0 : 1;
} else if (command === "verify-api") {
  const baseUrl = arg("--base-url");
  const questionId = arg("--question-id");
  if (!baseUrl) fail("Missing --base-url <url>");
  if (!questionId) fail("Missing --question-id <id>");
  const report = await verifyApi(baseUrl, questionId);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }
  process.exitCode = report.status === "Verified" ? 0 : 1;
} else if (command === "tamper-bundle") {
  const bundlePath = arg("--bundle");
  const outPath = arg("--out");
  if (!bundlePath) fail("Missing --bundle <path>");
  if (!outPath) fail("Missing --out <path>");
  const value = JSON.parse(await readFile(bundlePath, "utf8"));
  const tampered = tamperReplayValue(value, arg("--field") ?? "resultArtifactHash");
  await writeFile(outPath, `${JSON.stringify(tampered, null, 2)}\n`, "utf8");
  console.log(`Tampered bundle written: ${outPath}`);
} else if (command === "verify-chain") {
  const rpcUrl = arg("--rpc-url");
  if (!rpcUrl) fail("Missing --rpc-url <url>");

  const repoRoot = findRepoRoot(process.cwd());
  const deploymentPath = arg("--deployment") ?? path.join(repoRoot, "data/local-deployment.json");
  const abiFiles = args("--abi");
  const addressArgs = args("--address");
  const abi = await loadAbiFromFiles(abiFiles.length > 0 ? abiFiles : defaultContractArtifactPaths(repoRoot));
  const addresses = addressArgs.length > 0 ? addressArgs : await loadAddressesFromDeployment(deploymentPath);
  if (addresses.length === 0) fail("No contract addresses found. Pass --address or a deployment file with protocol module addresses.");

  const report = await verifyChain({
    rpcUrl,
    addresses,
    abi,
    fromBlock: parseBlock("--from-block", arg("--from-block") ?? "0"),
    toBlock: parseToBlock(arg("--to-block"))
  });
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printChainReport(report);
  }
  process.exitCode = report.status === "Verified" ? 0 : 1;
} else {
  console.log(`Usage:
  pc-replay verify-api --base-url <url> --question-id <id> [--json]
  pc-replay verify-bundle --bundle <path> [--json]
  pc-replay verify-chain --rpc-url <url> [--from-block 0] [--to-block latest] [--deployment data/local-deployment.json] [--abi <artifact.json>] [--address <address>] [--json]
  pc-replay tamper-bundle --bundle <path> --out <path> [--field resultArtifactHash]`);
  process.exitCode = command ? 1 : 0;
}

function printReport(report: ReplayReport) {
  const failed = report.checks.filter((check) => !check.ok);
  console.log(`PC Replay: ${report.status}`);
  console.log(`Mode: ${report.mode}`);
  console.log(`Checks: ${report.checks.length - failed.length}/${report.checks.length} passed`);
  if (report.hashes.eventStreamHash) console.log(`Event stream: ${report.hashes.eventStreamHash}`);
  if (report.hashes.rootHash) console.log(`Root: ${report.hashes.rootHash}`);
  if (report.api) {
    console.log(`API: ${report.api.baseUrl}`);
    console.log(`Question: ${report.api.questionId}`);
  }
  for (const check of failed) console.log(`- ${check.id}`);
}

function printChainReport(report: VerifyChainReport) {
  const failed = report.checks.filter((check) => !check.ok);
  console.log(`PC Chain Replay: ${report.status}`);
  console.log(`Mode: ${report.mode}`);
  console.log(`Checks: ${report.checks.length - failed.length}/${report.checks.length} passed`);
  console.log(`Logs: ${report.logCount}`);
  console.log(`Events: ${report.events.length}`);
  if (report.rpcUrl) console.log(`RPC: ${report.rpcUrl}`);
  if (report.addresses?.length) console.log(`Contracts: ${report.addresses.length}`);
  for (const check of failed) console.log(`- ${check.id}`);
}

function arg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function args(name: string) {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function parseBlock(name: string, value: string) {
  if (!/^\d+$/.test(value)) fail(`${name} must be a non-negative integer`);
  return BigInt(value);
}

function parseToBlock(value: string | null) {
  if (!value || value === "latest") return "latest";
  return parseBlock("--to-block", value);
}

function findRepoRoot(startDir: string) {
  let current = startDir;
  while (true) {
    if (existsSync(path.join(current, "pnpm-workspace.yaml")) && existsSync(path.join(current, "package.json"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return startDir;
    current = parent;
  }
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
