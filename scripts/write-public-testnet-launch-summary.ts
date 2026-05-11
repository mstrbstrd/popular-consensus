import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { hashJson } from "../packages/artifacts/src/index.ts";
import { PublicTestnetOperatorAttestationSchema, PublicTestnetOperatorRoleSchema } from "../packages/shared/src/index.ts";

const DEFAULT_ATTESTATION_DIR = "docs/public-testnet-attestations";
const DEFAULT_SUMMARY_PATH = "docs/public-testnet-launch-summary.md";

type OperatorRole = (typeof PublicTestnetOperatorRoleSchema.options)[number];
type Attestation = (typeof PublicTestnetOperatorAttestationSchema)["_output"];

const REQUIRED_ROLE_COUNTS = {
  deployer: 1,
  "api-indexer": 2,
  "replay-verifier": 3,
  "community-steward": 2
} as const satisfies Record<OperatorRole, number>;

type VerifiedAttestation = {
  path: string;
  hash: string;
  value: Attestation;
};

type Args = {
  dir: string;
  out: string;
  decision: "GO" | "NO-GO";
  testnetWindow: string;
  independenceReviewed: boolean;
  independenceNotes: string[];
  unresolvedIssues: string[];
  force: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dir: DEFAULT_ATTESTATION_DIR,
    out: DEFAULT_SUMMARY_PATH,
    decision: "NO-GO",
    testnetWindow: "not recorded",
    independenceReviewed: false,
    independenceNotes: [],
    unresolvedIssues: [],
    force: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--force") {
      args.force = true;
      continue;
    }
    if (arg === "--independence-reviewed") {
      args.independenceReviewed = true;
      continue;
    }

    const value = readNext(argv, index, arg);
    switch (arg) {
      case "--dir":
        args.dir = value;
        break;
      case "--out":
        args.out = value;
        break;
      case "--decision":
        args.decision = parseDecision(value);
        break;
      case "--testnet-window":
        args.testnetWindow = value;
        break;
      case "--independence-note":
        args.independenceNotes.push(value);
        break;
      case "--unresolved-issue":
        args.unresolvedIssues.push(value);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
    index += 1;
  }

  return args;
}

function printHelp() {
  console.log(`Usage: pnpm testnet:write-launch-summary -- [options]

Writes a maintainer launch summary from public-testnet operator attestations.

Options:
  --dir <path>              Attestation directory. Default: ${DEFAULT_ATTESTATION_DIR}
  --out <path>              Launch summary path. Default: ${DEFAULT_SUMMARY_PATH}
  --decision GO|NO-GO       Maintainer decision. Default: NO-GO
  --testnet-window <text>   Public testnet time window.
  --independence-reviewed   Confirm maintainer review of operator independence.
  --independence-note <text> Add an independence-review note. Repeatable.
  --unresolved-issue <text> Add an unresolved issue. Repeatable.
  --force                   Allow overwriting an existing summary file.
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { attestations, errors } = await readAttestations(args.dir);
  const evidence = buildEvidence(attestations, errors);

  if (args.decision === "GO" && !evidence.readyForGo) {
    throw new Error(`Cannot write GO launch summary; missing evidence:\n${evidence.missing.map((item) => `- ${item}`).join("\n")}`);
  }
  if (args.decision === "GO" && !args.independenceReviewed) {
    throw new Error("Cannot write GO launch summary until maintainer passes --independence-reviewed.");
  }

  if (!args.force && (await fileExists(args.out))) {
    throw new Error(`${args.out} already exists. Re-run with --force to overwrite it.`);
  }

  const summary = buildSummary(args, attestations, evidence);
  await mkdir(path.dirname(args.out), { recursive: true });
  await writeFile(args.out, summary, "utf8");

  console.log(`Wrote ${args.out}`);
  console.log(`Decision: ${args.decision}`);
  console.log(`Independence review: ${args.independenceReviewed ? "reviewed" : "pending"}`);
  console.log(`Attestations: ${attestations.length}`);
  if (evidence.missing.length > 0) {
    console.log("Missing evidence:");
    for (const item of evidence.missing) console.log(`- ${item}`);
  }
}

async function readAttestations(dir: string) {
  let entries: string[] = [];
  try {
    entries = await readdir(dir);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return { attestations: [], errors: [`Attestation directory not found: ${dir}`] };
    throw error;
  }

  const jsonPaths = entries
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => path.join(dir, entry))
    .sort((left, right) => left.localeCompare(right));

  const attestations: VerifiedAttestation[] = [];
  const errors: string[] = [];

  for (const filePath of jsonPaths) {
    try {
      const parsed = JSON.parse(await readFile(filePath, "utf8")) as unknown;
      const result = PublicTestnetOperatorAttestationSchema.safeParse(parsed);
      if (!result.success) {
        errors.push(`${filePath}: ${result.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join("; ")}`);
        continue;
      }
      attestations.push({ path: filePath, hash: hashJson(result.data), value: result.data });
    } catch (error) {
      errors.push(`${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { attestations, errors };
}

function buildEvidence(attestations: VerifiedAttestation[], errors: string[]) {
  const byRole = new Map<OperatorRole, VerifiedAttestation[]>();
  for (const role of PublicTestnetOperatorRoleSchema.options) byRole.set(role, []);
  for (const attestation of attestations) byRole.get(attestation.value.operatorRole)?.push(attestation);

  const roleCounts = Object.fromEntries(
    PublicTestnetOperatorRoleSchema.options.map((role) => [role, uniqueOperators(byRole.get(role) ?? []).length])
  ) as Record<OperatorRole, number>;

  const replayVerifierAttestations = byRole.get("replay-verifier") ?? [];
  const transactionStreamHashes = uniqueValues(replayVerifierAttestations.map((attestation) => attestation.value.transactionStreamHash));
  const eventStreamHashes = uniqueValues(replayVerifierAttestations.map((attestation) => attestation.value.eventStreamHash));
  const upgradeSafetyModelHashes = uniqueValues(attestations.map((attestation) => attestation.value.upgradeSafetyModelHash));
  const gitCommits = uniqueValues(attestations.map((attestation) => attestation.value.gitCommit));
  const chainIds = uniqueValues(attestations.map((attestation) => attestation.value.chainId));
  const rpcUrls = uniqueValues(attestations.map((attestation) => attestation.value.rpcUrl));

  const missing = [
    ...errors,
    ...PublicTestnetOperatorRoleSchema.options.flatMap((role) => {
      const required = REQUIRED_ROLE_COUNTS[role];
      const actual = roleCounts[role];
      return actual >= required ? [] : [`${role}: ${actual}/${required} unique operator attestations`];
    }),
    ...(transactionStreamHashes.length === 1 ? [] : ["replay verifier transactionStreamHash values must match"]),
    ...(eventStreamHashes.length === 1 ? [] : ["replay verifier eventStreamHash values must match"])
  ];

  return {
    readyForGo: missing.length === 0,
    roleCounts,
    transactionStreamHashes,
    eventStreamHashes,
    upgradeSafetyModelHashes,
    gitCommits,
    chainIds,
    rpcUrls,
    missing
  };
}

function buildSummary(args: Args, attestations: VerifiedAttestation[], evidence: ReturnType<typeof buildEvidence>) {
  const operators = attestations.length > 0
    ? attestations
        .map(
          (attestation) =>
            `| ${escapeCell(attestation.value.operatorId)} | ${attestation.value.operatorRole} | ${escapeCell(attestation.value.operatorOrganization ?? "individual")} | ${escapeCell(attestation.value.operatorContact)} | ${escapeCell(attestation.value.apiBaseUrl ?? attestation.value.rpcUrl)} | ${escapeCell(attestation.value.independenceStatement)} | ${attestation.hash} |`
        )
        .join("\n")
    : "| none recorded | none | none | none | none | none | none |";

  const unresolvedIssues = args.unresolvedIssues.length > 0
    ? args.unresolvedIssues.map((issue) => `- ${issue}`).join("\n")
    : evidence.missing.length > 0
      ? evidence.missing.map((issue) => `- ${issue}`).join("\n")
      : "- None recorded.";

  return `# Public Testnet Launch Summary

Git commit: ${joinOrNone(evidence.gitCommits)}
Chain id: ${joinOrNone(evidence.chainIds)}
RPC URL: ${joinOrNone(evidence.rpcUrls)}
Testnet window: ${args.testnetWindow}

## Operators

| Operator ID | Role | Organization | Contact | Endpoint | Independence Statement | Attestation Hash |
| --- | --- | --- | --- | --- | --- | --- |
${operators}

## Replay Hashes

Transaction stream hash: ${joinOrNone(evidence.transactionStreamHashes)}
Event stream hash: ${joinOrNone(evidence.eventStreamHashes)}
Upgrade safety model hash: ${joinOrNone(evidence.upgradeSafetyModelHashes)}

## Governance And Safety Drills

| Drill | Evidence | Status |
| --- | --- | --- |
| Governance parameter activation | community-steward attestations | ${evidence.roleCounts["community-steward"] >= REQUIRED_ROLE_COUNTS["community-steward"] ? "attested" : "pending"} |
| Adoption policy activation | community-steward attestations | ${evidence.roleCounts["community-steward"] >= REQUIRED_ROLE_COUNTS["community-steward"] ? "attested" : "pending"} |
| Emergency suspension resolution | community-steward attestations | ${evidence.roleCounts["community-steward"] >= REQUIRED_ROLE_COUNTS["community-steward"] ? "attested" : "pending"} |
| Community export/import replay | community-steward attestations | ${evidence.roleCounts["community-steward"] >= REQUIRED_ROLE_COUNTS["community-steward"] ? "attested" : "pending"} |
| Fork metadata publication | community-steward attestations | ${evidence.roleCounts["community-steward"] >= REQUIRED_ROLE_COUNTS["community-steward"] ? "attested" : "pending"} |
| Upgrade-safety model review | community-steward attestations | ${evidence.roleCounts["community-steward"] >= REQUIRED_ROLE_COUNTS["community-steward"] ? "attested" : "pending"} |

## Independence Review

Independence status: ${args.independenceReviewed ? "reviewed" : "pending"}

${independenceNotes(args)}

## Unresolved Issues

${unresolvedIssues}

Decision: ${args.decision}
`;
}

function uniqueOperators(attestations: VerifiedAttestation[]) {
  return uniqueValues(attestations.map((attestation) => attestation.value.operatorId));
}

function uniqueValues(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function joinOrNone(values: string[]) {
  return values.length > 0 ? values.join(", ") : "none recorded";
}

function escapeCell(value: string) {
  return value.replaceAll("|", "\\|");
}

function independenceNotes(args: Args) {
  if (args.independenceNotes.length > 0) return args.independenceNotes.map((note) => `- ${note}`).join("\n");
  if (args.independenceReviewed) return "- Maintainer confirms each operator id maps to an independent person or organization.";
  return "- Maintainer independence review pending.";
}

function readNext(argv: string[], index: number, name: string) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

function parseDecision(value: string) {
  if (value === "GO" || value === "NO-GO") return value;
  throw new Error("--decision must be GO or NO-GO");
}

async function fileExists(filePath: string) {
  try {
    await readFile(filePath, "utf8");
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return false;
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
