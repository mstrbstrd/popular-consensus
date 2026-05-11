import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { hashJson } from "../packages/artifacts/src/index.ts";
import { PublicTestnetOperatorAttestationSchema, PublicTestnetOperatorRoleSchema } from "../packages/shared/src/index.ts";

const DEFAULT_ATTESTATION_DIR = "docs/public-testnet-attestations";
const DEFAULT_LAUNCH_SUMMARY_PATH = "docs/public-testnet-launch-summary.md";
const SHA256_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const MIN_INDEPENDENCE_STATEMENT_LENGTH = 20;

type OperatorRole = (typeof PublicTestnetOperatorRoleSchema.options)[number];
type Attestation = (typeof PublicTestnetOperatorAttestationSchema)["_output"];

const REQUIRED_ROLE_COUNTS = {
  deployer: 1,
  "api-indexer": 2,
  "replay-verifier": 3,
  "community-steward": 2
} as const satisfies Record<OperatorRole, number>;

const REQUIRED_CHECKS = [
  "typecheck",
  "sharedTests",
  "contractTests",
  "apiDbTests",
  "protocolIndexerReplay",
  "communityImportReplay"
] as const;

const GOVERNANCE_DRILL_CHECKS = [
  "governanceParameterDrill",
  "adoptionPolicyDrill",
  "emergencySuspensionDrill",
  "communityExportReplay",
  "forkMetadata",
  "upgradeSafetyDrill"
] as const;

type VerifiedAttestation = {
  path: string;
  hash: string;
  value: Attestation;
};

type GateReport = {
  id: string;
  status: "Ready" | "Pending" | "Blocked";
  evidence: string[];
  missing: string[];
};

type Args = {
  dir: string;
  summary: string;
  allowPending: boolean;
  json: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { dir: DEFAULT_ATTESTATION_DIR, summary: DEFAULT_LAUNCH_SUMMARY_PATH, allowPending: false, json: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--dir") {
      const value = argv[index + 1];
      if (!value) throw new Error("--dir requires a path");
      args.dir = value;
      index += 1;
      continue;
    }
    if (arg === "--summary") {
      const value = argv[index + 1];
      if (!value) throw new Error("--summary requires a path");
      args.summary = value;
      index += 1;
      continue;
    }
    if (arg === "--allow-pending") {
      args.allowPending = true;
      continue;
    }
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function printHelp() {
  console.log(`Usage: pnpm testnet:verify-attestations [--dir ${DEFAULT_ATTESTATION_DIR}] [--summary ${DEFAULT_LAUNCH_SUMMARY_PATH}] [--allow-pending] [--json]

Validates public-testnet operator attestation JSON files against the MVP completion gate.

Options:
  --dir <path>       Directory containing *.json attestations.
  --summary <path>   Maintainer launch summary markdown file.
  --allow-pending   Exit 0 when valid evidence is incomplete; malformed attestations still fail.
  --json            Print the machine-readable report only.
`);
}

async function readAttestations(dir: string) {
  let entries: string[] = [];
  try {
    entries = await readdir(dir);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return { verified: [], errors: [`Attestation directory not found: ${dir}`] };
    throw error;
  }

  const jsonPaths = entries
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => path.join(dir, entry))
    .sort((left, right) => left.localeCompare(right));

  const verified: VerifiedAttestation[] = [];
  const errors: string[] = [];

  for (const filePath of jsonPaths) {
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      const result = PublicTestnetOperatorAttestationSchema.safeParse(parsed);
      if (!result.success) {
        errors.push(`${filePath}: ${result.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join("; ")}`);
        continue;
      }
      const attestation = result.data;
      const contentErrors = validateAttestationContent(attestation);
      if (contentErrors.length > 0) {
        errors.push(...contentErrors.map((message) => `${filePath}: ${message}`));
        continue;
      }
      verified.push({ path: filePath, hash: hashJson(attestation), value: attestation });
    } catch (error) {
      errors.push(`${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { verified, errors };
}

function validateAttestationContent(attestation: Attestation) {
  const errors: string[] = [];
  const hashFields = [
    ["transactionStreamHash", attestation.transactionStreamHash],
    ["eventStreamHash", attestation.eventStreamHash],
    ["upgradeSafetyModelHash", attestation.upgradeSafetyModelHash]
  ] as const;

  for (const [field, value] of hashFields) {
    if (!SHA256_HASH_PATTERN.test(value)) errors.push(`${field} must be a sha256:<64 hex> content hash`);
  }

  if (attestation.deploymentHash !== null && !SHA256_HASH_PATTERN.test(attestation.deploymentHash)) {
    errors.push("deploymentHash must be null or a sha256:<64 hex> content hash");
  }

  if (hasPlaceholder(attestation)) errors.push("attestation still contains template placeholders");

  if (attestation.operatorContact.trim().length === 0) errors.push("operatorContact is required");
  if (attestation.operatorOrganization !== null && attestation.operatorOrganization.trim().length === 0) {
    errors.push("operatorOrganization must be null or non-empty");
  }
  if (attestation.independenceStatement.trim().length < MIN_INDEPENDENCE_STATEMENT_LENGTH) {
    errors.push(`independenceStatement must be at least ${MIN_INDEPENDENCE_STATEMENT_LENGTH} characters`);
  }

  if (attestation.operatorRole === "api-indexer") {
    if (!attestation.apiBaseUrl) {
      errors.push("api-indexer attestations must include apiBaseUrl");
    } else if (!isValidUrl(attestation.apiBaseUrl)) {
      errors.push("apiBaseUrl must be an absolute URL");
    }
  }

  if (attestation.operatorRole === "deployer" && !attestation.deploymentHash) {
    errors.push("deployer attestations must include deploymentHash");
  }

  for (const checkName of REQUIRED_CHECKS) {
    if (!isPassingCheck(attestation.checks[checkName])) errors.push(`checks.${checkName} must be passed or Verified`);
  }

  if (attestation.operatorRole === "community-steward") {
    for (const checkName of GOVERNANCE_DRILL_CHECKS) {
      if (!isPassingCheck(attestation.checks[checkName])) errors.push(`checks.${checkName} must be passed or Verified`);
    }
  }

  return errors;
}

async function inspectLaunchSummary(summaryPath: string, attestations: VerifiedAttestation[]) {
  try {
    const summary = await readFile(summaryPath, "utf8");
    const missing: string[] = [];
    const independenceReviewed = /^Independence status:\s*reviewed\b/im.test(summary);
    if (hasTextPlaceholder(summary)) missing.push("launch summary still contains template placeholders");
    if (!/^Decision:\s*GO\b/im.test(summary)) {
      if (/^Decision:\s*NO-GO\b/im.test(summary)) {
        return { status: "Blocked" as const, evidence: [summaryPath], missing: ["launch summary decision is NO-GO"], independenceReviewed };
      }
      missing.push("launch summary must include `Decision: GO`");
    }
    if (!/## Independence Review/im.test(summary)) missing.push("launch summary must include independence review");
    if (!independenceReviewed) missing.push("launch summary must include reviewed independence status");
    if (!/Unresolved Issues/im.test(summary)) missing.push("launch summary must include unresolved issues");
    for (const attestation of attestations) {
      if (!summary.includes(attestation.hash)) missing.push(`launch summary must list attestation hash ${attestation.hash}`);
      if (!summary.includes(attestation.value.operatorId)) missing.push(`launch summary must list operator ${attestation.value.operatorId}`);
    }

    return {
      status: missing.length === 0 ? ("Ready" as const) : ("Pending" as const),
      evidence: [summaryPath],
      missing,
      independenceReviewed
    };
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return {
        status: "Pending" as const,
        evidence: [],
        missing: [`maintainer launch summary not found at ${summaryPath}`],
        independenceReviewed: false
      };
    }
    throw error;
  }
}

function buildReport(attestations: VerifiedAttestation[], errors: string[], launchSummary: Awaited<ReturnType<typeof inspectLaunchSummary>>) {
  const evidenceErrors = [...errors, ...findDuplicateOperatorContacts(attestations)];
  const byRole = new Map<OperatorRole, VerifiedAttestation[]>();
  for (const role of PublicTestnetOperatorRoleSchema.options) byRole.set(role, []);
  for (const attestation of attestations) byRole.get(attestation.value.operatorRole)?.push(attestation);

  const roleCounts = Object.fromEntries(
    PublicTestnetOperatorRoleSchema.options.map((role) => [role, uniqueOperators(byRole.get(role) ?? []).length])
  ) as Record<OperatorRole, number>;

  const replayVerifierAttestations = byRole.get("replay-verifier") ?? [];
  const apiIndexerAttestations = byRole.get("api-indexer") ?? [];
  const communityStewardAttestations = byRole.get("community-steward") ?? [];

  const commonChainIds = uniqueValues(attestations.map((attestation) => attestation.value.chainId));
  const commonGitCommits = uniqueValues(attestations.map((attestation) => attestation.value.gitCommit));
  const replayTransactionHashes = uniqueValues(replayVerifierAttestations.map((attestation) => attestation.value.transactionStreamHash));
  const replayEventHashes = uniqueValues(replayVerifierAttestations.map((attestation) => attestation.value.eventStreamHash));

  const gates: GateReport[] = [
    {
      id: "matching-replay-hashes",
      status:
        uniqueOperators(replayVerifierAttestations).length >= REQUIRED_ROLE_COUNTS["replay-verifier"] &&
        replayTransactionHashes.length === 1 &&
        replayEventHashes.length === 1
          ? "Ready"
          : "Pending",
      evidence: replayVerifierAttestations.map((attestation) => `${attestation.hash} ${attestation.path}`),
      missing: [
        ...countMissing("replay-verifier", uniqueOperators(replayVerifierAttestations).length),
        ...(replayTransactionHashes.length === 1 ? [] : ["replay verifier transactionStreamHash values must match"]),
        ...(replayEventHashes.length === 1 ? [] : ["replay verifier eventStreamHash values must match"])
      ]
    },
    {
      id: "independent-api-indexers",
      status: uniqueOperators(apiIndexerAttestations).length >= REQUIRED_ROLE_COUNTS["api-indexer"] ? "Ready" : "Pending",
      evidence: apiIndexerAttestations.map((attestation) => `${attestation.value.apiBaseUrl} ${attestation.hash}`),
      missing: countMissing("api-indexer", uniqueOperators(apiIndexerAttestations).length)
    },
    {
      id: "governance-safety-drills",
      status: uniqueOperators(communityStewardAttestations).length >= REQUIRED_ROLE_COUNTS["community-steward"] ? "Ready" : "Pending",
      evidence: communityStewardAttestations.map((attestation) => `${attestation.value.operatorId} ${attestation.hash}`),
      missing: countMissing("community-steward", uniqueOperators(communityStewardAttestations).length)
    },
    {
      id: "operator-attestations",
      status: hasRequiredRoleCounts(roleCounts) ? "Ready" : "Pending",
      evidence: attestations.map((attestation) => `${attestation.value.operatorId} ${attestation.hash}`),
      missing: PublicTestnetOperatorRoleSchema.options.flatMap((role) => countMissing(role, roleCounts[role]))
    },
    {
      id: "launch-summary",
      status: launchSummary.status,
      evidence: launchSummary.evidence,
      missing: launchSummary.missing
    }
  ];

  const warnings = [
    ...(commonChainIds.length <= 1 ? [] : [`attestations reference multiple chainIds: ${commonChainIds.join(", ")}`]),
    ...(commonGitCommits.length <= 1 ? [] : [`attestations reference multiple git commits: ${commonGitCommits.join(", ")}`]),
    ...(launchSummary.independenceReviewed ? [] : ["operator independence must be confirmed by maintainers; this verifier only counts unique operatorId values"])
  ];

  return {
    protocol: "popular-consensus",
    schemaVersion: "public-testnet-attestation-verification-v0",
    status: evidenceErrors.length > 0 || gates.some((gate) => gate.status === "Blocked") ? "Blocked" : gates.every((gate) => gate.status === "Ready") ? "Ready" : "Pending",
    attestationCount: attestations.length,
    roleCounts,
    gates,
    attestationHashes: attestations.map((attestation) => ({
      path: attestation.path,
      hash: attestation.hash,
      operatorId: attestation.value.operatorId,
      operatorRole: attestation.value.operatorRole
    })),
    warnings,
    errors: evidenceErrors
  };
}

function findDuplicateOperatorContacts(attestations: VerifiedAttestation[]) {
  const byContact = new Map<string, Set<string>>();
  for (const attestation of attestations) {
    const contact = attestation.value.operatorContact.trim().toLowerCase();
    const operatorIds = byContact.get(contact) ?? new Set<string>();
    operatorIds.add(attestation.value.operatorId);
    byContact.set(contact, operatorIds);
  }

  return [...byContact.entries()]
    .filter(([, operatorIds]) => operatorIds.size > 1)
    .map(([contact, operatorIds]) => `operatorContact ${contact} appears for multiple operatorIds: ${[...operatorIds].sort().join(", ")}`);
}

function uniqueOperators(attestations: VerifiedAttestation[]) {
  return uniqueValues(attestations.map((attestation) => attestation.value.operatorId));
}

function uniqueValues(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function countMissing(role: OperatorRole, actual: number) {
  const required = REQUIRED_ROLE_COUNTS[role];
  return actual >= required ? [] : [`${role}: ${actual}/${required} unique operator attestations`];
}

function hasRequiredRoleCounts(roleCounts: Record<OperatorRole, number>) {
  return PublicTestnetOperatorRoleSchema.options.every((role) => roleCounts[role] >= REQUIRED_ROLE_COUNTS[role]);
}

function hasPlaceholder(value: unknown): boolean {
  if (typeof value === "string") return value.includes("<") || value.includes(">") || value.includes("|");
  if (Array.isArray(value)) return value.some((entry) => hasPlaceholder(entry));
  if (value && typeof value === "object") return Object.values(value).some((entry) => hasPlaceholder(entry));
  return false;
}

function hasTextPlaceholder(value: string) {
  return value.includes("<") || value.includes(">");
}

function isPassingCheck(value: string | undefined) {
  return value === "passed" || value === "Verified";
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function printHumanReport(report: ReturnType<typeof buildReport>) {
  console.log(`Public testnet attestation verification: ${report.status}`);
  console.log(`Attestations: ${report.attestationCount}`);
  console.log(
    `Role counts: ${PublicTestnetOperatorRoleSchema.options.map((role) => `${role} ${report.roleCounts[role]}/${REQUIRED_ROLE_COUNTS[role]}`).join(", ")}`
  );

  for (const gate of report.gates) {
    console.log(`\n${gate.status === "Ready" ? "[x]" : "[ ]"} ${gate.id}`);
    for (const evidence of gate.evidence) console.log(`  evidence: ${evidence}`);
    for (const missing of gate.missing) console.log(`  missing: ${missing}`);
  }

  if (report.warnings.length > 0) {
    console.log("\nWarnings:");
    for (const warning of report.warnings) console.log(`- ${warning}`);
  }

  if (report.errors.length > 0) {
    console.log("\nErrors:");
    for (const error of report.errors) console.log(`- ${error}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { verified, errors } = await readAttestations(args.dir);
  const launchSummary = await inspectLaunchSummary(args.summary, verified);
  const report = buildReport(verified, errors, launchSummary);

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHumanReport(report);
  }

  if (report.status === "Blocked") process.exitCode = 1;
  if (report.status === "Pending" && !args.allowPending) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
