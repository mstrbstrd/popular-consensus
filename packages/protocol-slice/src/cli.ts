import { readFile } from "node:fs/promises";
import { createProductionSliceFixture, productionSliceInputFromJson, verifyProductionSlice } from "./index";

const input = await readInput();
const report = verifyProductionSlice(input);
const json = process.argv.includes("--json");

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const failed = report.checks.filter((check) => !check.ok);
  console.log(`Production Slice V1: ${report.status}`);
  console.log(`Crypto mode: ${report.cryptoMode}`);
  console.log(`Checks: ${report.counts.checks - report.counts.failedChecks}/${report.counts.checks} passed`);
  console.log(`Threshold shares: ${report.counts.acceptedDecryptionShares}/${report.counts.threshold}`);
  console.log(`Event stream: ${report.hashes.eventStreamHash}`);
  console.log(`Archive: ${report.hashes.archiveHash ?? "(missing)"}`);
  if (failed.length > 0) {
    console.log("Failed checks:");
    for (const check of failed) console.log(`- ${check.id}`);
  }
}

process.exitCode = report.status === "Verified" ? 0 : 1;

async function readInput() {
  const inputIndex = process.argv.indexOf("--input");
  const inputPath = inputIndex >= 0 ? process.argv[inputIndex + 1] : null;
  if (inputPath && inputPath !== "-") {
    return productionSliceInputFromJson(JSON.parse(await readFile(inputPath, "utf8")));
  }
  if (inputPath === "-") {
    return productionSliceInputFromJson(JSON.parse(await readStdin()));
  }
  return createProductionSliceFixture().input;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}
