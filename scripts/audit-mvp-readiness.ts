import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_ROADMAP_PATH = "docs/decentralized-protocol-roadmap.md";
const DEFAULT_ATTESTATION_DIR = "docs/public-testnet-attestations";
const DEFAULT_LAUNCH_SUMMARY_PATH = "docs/public-testnet-launch-summary.md";
const DEFAULT_ROSTER_PATH = "docs/public-testnet-operator-roster.md";
const DEFAULT_OUTREACH_LOG_PATH = "docs/public-testnet-operator-outreach-log.md";
const PUBLIC_TESTNET_ROLE_COUNTS = {
  deployer: 1,
  "api-indexer": 2,
  "replay-verifier": 3,
  "community-steward": 2
} as const;
const PUBLIC_TESTNET_ROLE_ORDER = Object.keys(PUBLIC_TESTNET_ROLE_COUNTS);

type Status = "Ready" | "Pending" | "Blocked";

type RoadmapStatus = "done" | "in-progress" | "open";

type RoadmapItem = {
  line: number;
  section: string;
  status: RoadmapStatus;
  text: string;
};

type RoadmapReport = {
  path: string;
  total: number;
  done: number;
  inProgress: number;
  open: number;
  items: RoadmapItem[];
  incompleteItems: RoadmapItem[];
};

type TestnetGateReport = {
  id: string;
  status: Status;
  evidence: string[];
  missing: string[];
};

type TestnetVerificationReport = {
  status: Status;
  attestationCount: number;
  roleCounts: Record<string, number>;
  gates: TestnetGateReport[];
  warnings: string[];
  errors: string[];
};

type PublicTestnetRosterReport = {
  status: Status;
  roster: string;
  trackingIssueSlots: {
    actual: number;
    required: number;
  };
  roleCounts: Record<string, number>;
  reviewedRoleCounts: Record<string, number>;
  missing: string[];
  warnings: string[];
  errors: string[];
};

type PublicTestnetOutreachReport = {
  status: Status;
  log: string;
  slots: number;
  identifiedSlots: {
    actual: number;
    required: number;
  };
  contactedSlots: {
    actual: number;
    required: number;
  };
  missing: string[];
  warnings: string[];
  errors: string[];
};

type AuditReport = {
  protocol: "popular-consensus";
  schemaVersion: "mvp-readiness-audit-v0";
  status: Status;
  generatedAt: string;
  workspaceWarnings: string[];
  roadmap: RoadmapReport;
  publicTestnet: TestnetVerificationReport;
  publicTestnetOutreach: PublicTestnetOutreachReport;
  publicTestnetRoster: PublicTestnetRosterReport;
  nextActions: string[];
};

type Args = {
  roadmap: string;
  attestationDir: string;
  launchSummary: string;
  roster: string;
  outreachLog: string;
  json: boolean;
  strict: boolean;
};

type ExecError = Error & {
  stdout?: string | Buffer;
  stderr?: string | Buffer;
  code?: string | number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    roadmap: DEFAULT_ROADMAP_PATH,
    attestationDir: DEFAULT_ATTESTATION_DIR,
    launchSummary: DEFAULT_LAUNCH_SUMMARY_PATH,
    roster: DEFAULT_ROSTER_PATH,
    outreachLog: DEFAULT_OUTREACH_LOG_PATH,
    json: false,
    strict: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--roadmap") {
      const value = argv[index + 1];
      if (!value) throw new Error("--roadmap requires a path");
      args.roadmap = value;
      index += 1;
      continue;
    }
    if (arg === "--attestation-dir") {
      const value = argv[index + 1];
      if (!value) throw new Error("--attestation-dir requires a path");
      args.attestationDir = value;
      index += 1;
      continue;
    }
    if (arg === "--launch-summary") {
      const value = argv[index + 1];
      if (!value) throw new Error("--launch-summary requires a path");
      args.launchSummary = value;
      index += 1;
      continue;
    }
    if (arg === "--roster") {
      const value = argv[index + 1];
      if (!value) throw new Error("--roster requires a path");
      args.roster = value;
      index += 1;
      continue;
    }
    if (arg === "--outreach-log") {
      const value = argv[index + 1];
      if (!value) throw new Error("--outreach-log requires a path");
      args.outreachLog = value;
      index += 1;
      continue;
    }
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg === "--strict") {
      args.strict = true;
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
  console.log(`Usage: pnpm mvp:audit [--roadmap ${DEFAULT_ROADMAP_PATH}] [--attestation-dir ${DEFAULT_ATTESTATION_DIR}] [--launch-summary ${DEFAULT_LAUNCH_SUMMARY_PATH}] [--roster ${DEFAULT_ROSTER_PATH}] [--outreach-log ${DEFAULT_OUTREACH_LOG_PATH}] [--json] [--strict]

Audits the MVP tracker by combining roadmap checkbox status, public-testnet attestation readiness, outreach status, and operator roster coordination status.

Options:
  --roadmap <path>          Roadmap markdown file to inspect.
  --attestation-dir <path>  Directory containing public-testnet operator attestations.
  --launch-summary <path>   Maintainer launch summary markdown file.
  --roster <path>           Public-testnet operator roster markdown file.
  --outreach-log <path>     Public-testnet operator outreach log markdown file.
  --json                   Print the machine-readable report only.
  --strict                 Exit non-zero unless the complete MVP is Ready.
`);
}

async function readRoadmap(roadmapPath: string): Promise<RoadmapReport> {
  const resolvedPath = path.resolve(roadmapPath);
  const source = await readFile(resolvedPath, "utf8");
  const lines = source.split(/\r?\n/);
  const items: RoadmapItem[] = [];
  let section = "Roadmap";
  let inRankedRoadmap = false;

  lines.forEach((line, index) => {
    if (line.startsWith("## ")) {
      inRankedRoadmap = line.trim() === "## Easiest To Hardest";
      return;
    }

    if (line.startsWith("### ")) {
      section = line.replace(/^###\s+/, "").trim();
      return;
    }

    if (!inRankedRoadmap) return;

    const checkbox = line.match(/^-\s+`?\[(x|X|~| )\]`?\s+(.+?)\s*$/);
    if (!checkbox) return;

    const marker = checkbox[1];
    const text = checkbox[2];
    if (!marker || !text) return;

    items.push({
      line: index + 1,
      section,
      status: marker.toLowerCase() === "x" ? "done" : marker === "~" ? "in-progress" : "open",
      text
    });
  });

  const done = items.filter((item) => item.status === "done").length;
  const inProgress = items.filter((item) => item.status === "in-progress").length;
  const open = items.filter((item) => item.status === "open").length;

  return {
    path: roadmapPath,
    total: items.length,
    done,
    inProgress,
    open,
    items,
    incompleteItems: items.filter((item) => item.status !== "done")
  };
}

async function runTestnetVerifier(args: Pick<Args, "attestationDir" | "launchSummary">): Promise<TestnetVerificationReport> {
  const verifierPath = path.resolve("scripts/verify-public-testnet-attestations.ts");
  const verifierArgs = [
    "--import",
    "tsx",
    verifierPath,
    "--allow-pending",
    "--json",
    "--dir",
    args.attestationDir,
    "--summary",
    args.launchSummary
  ];

  let stdout = "";
  let stderr = "";

  try {
    const result = await execFileAsync(process.execPath, verifierArgs, {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 10
    });
    stdout = toText(result.stdout);
    stderr = toText(result.stderr);
  } catch (error) {
    const execError = error as ExecError;
    stdout = toText(execError.stdout);
    stderr = toText(execError.stderr);
    if (!stdout.trim()) {
      throw new Error(`Public testnet verifier failed before producing JSON${stderr.trim() ? `: ${stderr.trim()}` : ""}`);
    }
  }

  const parsed = JSON.parse(stdout) as Partial<TestnetVerificationReport>;
  if (parsed.status !== "Ready" && parsed.status !== "Pending" && parsed.status !== "Blocked") {
    throw new Error("Public testnet verifier returned an invalid status");
  }

  return {
    status: parsed.status,
    attestationCount: parsed.attestationCount ?? 0,
    roleCounts: parsed.roleCounts ?? {},
    gates: parsed.gates ?? [],
    warnings: parsed.warnings ?? [],
    errors: parsed.errors ?? []
  };
}

async function runRosterAudit(args: Pick<Args, "roster">): Promise<PublicTestnetRosterReport> {
  const auditPath = path.resolve("scripts/audit-public-testnet-roster.ts");
  const auditArgs = ["--import", "tsx", auditPath, "--json", "--roster", args.roster];

  let stdout = "";
  let stderr = "";

  try {
    const result = await execFileAsync(process.execPath, auditArgs, {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 10
    });
    stdout = toText(result.stdout);
    stderr = toText(result.stderr);
  } catch (error) {
    const execError = error as ExecError;
    stdout = toText(execError.stdout);
    stderr = toText(execError.stderr);
    if (!stdout.trim()) {
      throw new Error(`Public testnet roster audit failed before producing JSON${stderr.trim() ? `: ${stderr.trim()}` : ""}`);
    }
  }

  const parsed = JSON.parse(stdout) as Partial<PublicTestnetRosterReport>;
  if (parsed.status !== "Ready" && parsed.status !== "Pending" && parsed.status !== "Blocked") {
    throw new Error("Public testnet roster audit returned an invalid status");
  }

  return {
    status: parsed.status,
    roster: parsed.roster ?? args.roster,
    trackingIssueSlots: parsed.trackingIssueSlots ?? { actual: 0, required: 0 },
    roleCounts: parsed.roleCounts ?? {},
    reviewedRoleCounts: parsed.reviewedRoleCounts ?? {},
    missing: parsed.missing ?? [],
    warnings: parsed.warnings ?? [],
    errors: parsed.errors ?? []
  };
}

async function runOutreachAudit(args: Pick<Args, "outreachLog" | "roster">): Promise<PublicTestnetOutreachReport> {
  const auditPath = path.resolve("scripts/audit-public-testnet-outreach.ts");
  const auditArgs = ["--import", "tsx", auditPath, "--json", "--log", args.outreachLog, "--roster", args.roster];

  let stdout = "";
  let stderr = "";

  try {
    const result = await execFileAsync(process.execPath, auditArgs, {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 10
    });
    stdout = toText(result.stdout);
    stderr = toText(result.stderr);
  } catch (error) {
    const execError = error as ExecError;
    stdout = toText(execError.stdout);
    stderr = toText(execError.stderr);
    if (!stdout.trim()) {
      throw new Error(`Public testnet outreach audit failed before producing JSON${stderr.trim() ? `: ${stderr.trim()}` : ""}`);
    }
  }

  const parsed = JSON.parse(stdout) as Partial<PublicTestnetOutreachReport>;
  if (parsed.status !== "Ready" && parsed.status !== "Pending" && parsed.status !== "Blocked") {
    throw new Error("Public testnet outreach audit returned an invalid status");
  }

  return {
    status: parsed.status,
    log: parsed.log ?? args.outreachLog,
    slots: parsed.slots ?? 0,
    identifiedSlots: parsed.identifiedSlots ?? { actual: 0, required: 0 },
    contactedSlots: parsed.contactedSlots ?? { actual: 0, required: 0 },
    missing: parsed.missing ?? [],
    warnings: parsed.warnings ?? [],
    errors: parsed.errors ?? []
  };
}

function toText(value: string | Buffer | undefined) {
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  return value ?? "";
}

function buildAuditReport(
  roadmap: RoadmapReport,
  publicTestnet: TestnetVerificationReport,
  publicTestnetOutreach: PublicTestnetOutreachReport,
  publicTestnetRoster: PublicTestnetRosterReport,
  workspaceWarnings: string[]
): AuditReport {
  const status =
    publicTestnet.status === "Blocked" || publicTestnetOutreach.status === "Blocked" || publicTestnetRoster.status === "Blocked"
      ? "Blocked"
      : roadmap.incompleteItems.length === 0 && publicTestnet.status === "Ready"
        ? "Ready"
        : "Pending";

  return {
    protocol: "popular-consensus",
    schemaVersion: "mvp-readiness-audit-v0",
    status,
    generatedAt: new Date().toISOString(),
    workspaceWarnings,
    roadmap,
    publicTestnet,
    publicTestnetOutreach,
    publicTestnetRoster,
    nextActions: buildNextActions(roadmap, publicTestnet, publicTestnetOutreach, publicTestnetRoster)
  };
}

function buildNextActions(
  roadmap: RoadmapReport,
  publicTestnet: TestnetVerificationReport,
  publicTestnetOutreach: PublicTestnetOutreachReport,
  publicTestnetRoster: PublicTestnetRosterReport
) {
  const actions: string[] = [];

  for (const item of roadmap.incompleteItems) {
    actions.push(`Resolve roadmap item: ${item.text} (${roadmap.path}:${item.line})`);
  }

  const blockedGate = publicTestnet.gates.find((gate) => gate.status === "Blocked");
  if (blockedGate) {
    actions.push(`Fix blocked public-testnet gate: ${blockedGate.id}`);
  }

  const pendingGate = publicTestnet.gates.find((gate) => gate.status === "Pending");
  if (pendingGate) {
    actions.push(`Collect remaining public-testnet evidence for gate: ${pendingGate.id}`);
  }

  if (publicTestnet.status !== "Ready") {
    if (publicTestnetOutreach.status !== "Ready" && publicTestnetRoster.status !== "Ready") {
      if (publicTestnetOutreach.identifiedSlots.actual < publicTestnetOutreach.identifiedSlots.required) {
        actions.push("Identify candidate routes in docs/public-testnet-operator-outreach-log.md, then run pnpm testnet:audit-outreach.");
      } else {
        actions.push("Follow docs/public-testnet-maintainer-checklist.md to create public tracking issues from docs/public-testnet-operator-issue-bodies, using pnpm testnet:operator-issue-drafts -- --body-dir docs/public-testnet-operator-issue-bodies --github-repo <owner/repo> when no Git remote is configured, using an authenticated GitHub connector after explicit approval when available, or creating issues manually from the body files when gh is unavailable; collect issue URLs in docs/public-testnet-operator-issue-url-intake.md, validate them with pnpm testnet:record-issue-urls -- --dry-run, record them with pnpm testnet:record-issue-urls, fill the repo and issue URLs in docs/public-testnet-operator-send-packets.md, send first-wave outreach, record contacted rows with pnpm testnet:record-outreach -- --tracking-issue-from-roster, then run pnpm testnet:audit-outreach.");
      }
    }
    if (publicTestnetRoster.status !== "Ready") {
      actions.push("Assign and review public-testnet operators in docs/public-testnet-operator-roster.md.");
    }
    actions.push("Have independent operators follow docs/public-testnet-operator-runbook.md and publish attestation JSON files.");
    actions.push("Write docs/public-testnet-launch-summary.md with Decision: GO after maintainer independence review passes.");
  }

  return unique(actions);
}

function unique(values: string[]) {
  return [...new Set(values)];
}

async function readWorkspaceWarnings() {
  const warnings: string[] = [];

  try {
    const result = await execFileAsync("git", ["remote", "-v"], {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 1024 * 1024
    });
    if (!toText(result.stdout).trim()) {
      warnings.push("no Git remote is configured; create public operator issues with a remote, GitHub default repo, --github-repo <owner/repo>, or an approved connector repository_full_name");
    }
  } catch (error) {
    const execError = error as ExecError;
    const stderr = toText(execError.stderr).trim();
    warnings.push(`could not inspect Git remotes${stderr ? `: ${stderr}` : ""}`);
  }

  try {
    await execFileAsync("gh", ["--version"], {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 1024 * 1024
    });
  } catch {
    warnings.push("GitHub CLI gh is not available; use an authenticated GitHub connector after explicit approval, create public operator issues manually from docs/public-testnet-operator-issue-bodies, or install gh before using generated commands");
  }

  return warnings;
}

function printHumanReport(report: AuditReport) {
  console.log(`MVP readiness audit: ${report.status}`);
  console.log(`Roadmap: ${report.roadmap.done}/${report.roadmap.total} done, ${report.roadmap.inProgress} in progress, ${report.roadmap.open} open`);

  if (report.roadmap.incompleteItems.length > 0) {
    console.log("\nOpen roadmap items:");
    for (const item of report.roadmap.incompleteItems) {
      const marker = item.status === "in-progress" ? "[~]" : "[ ]";
      console.log(`- ${marker} ${item.text} (${report.roadmap.path}:${item.line}, ${item.section})`);
    }
  }

  console.log(`\nPublic testnet: ${report.publicTestnet.status}`);
  console.log(`Attestations: ${report.publicTestnet.attestationCount}`);
  console.log(`Role counts: ${formatRoleCounts(report.publicTestnet.roleCounts, true)}`);

  for (const gate of report.publicTestnet.gates.filter((entry) => entry.status !== "Ready")) {
    console.log(`\n${gate.status === "Blocked" ? "[!]" : "[ ]"} ${gate.id}`);
    for (const missing of gate.missing) console.log(`  missing: ${missing}`);
  }

  console.log(`\nOperator outreach: ${report.publicTestnetOutreach.status}`);
  console.log(`Identified slots: ${report.publicTestnetOutreach.identifiedSlots.actual}/${report.publicTestnetOutreach.identifiedSlots.required}`);
  console.log(`Contacted slots: ${report.publicTestnetOutreach.contactedSlots.actual}/${report.publicTestnetOutreach.contactedSlots.required}`);
  for (const missing of report.publicTestnetOutreach.missing) console.log(`  missing: ${missing}`);

  console.log(`\nOperator roster: ${report.publicTestnetRoster.status}`);
  console.log(`Tracking issues: ${report.publicTestnetRoster.trackingIssueSlots.actual}/${report.publicTestnetRoster.trackingIssueSlots.required}`);
  console.log(`Assigned: ${formatRoleCounts(report.publicTestnetRoster.roleCounts, true)}`);
  console.log(`Reviewed: ${formatRoleCounts(report.publicTestnetRoster.reviewedRoleCounts, true)}`);
  for (const missing of report.publicTestnetRoster.missing) console.log(`  missing: ${missing}`);

  const warnings = [...report.workspaceWarnings, ...report.publicTestnet.warnings, ...report.publicTestnetOutreach.warnings, ...report.publicTestnetRoster.warnings];
  if (warnings.length > 0) {
    console.log("\nWarnings:");
    for (const warning of warnings) console.log(`- ${warning}`);
  }

  const errors = [...report.publicTestnet.errors, ...report.publicTestnetOutreach.errors, ...report.publicTestnetRoster.errors];
  if (errors.length > 0) {
    console.log("\nErrors:");
    for (const error of errors) console.log(`- ${error}`);
  }

  if (report.nextActions.length > 0) {
    console.log("\nNext actions:");
    for (const action of report.nextActions) console.log(`- ${action}`);
  }
}

function formatRoleCounts(roleCounts: Record<string, number>, includeTargets = false) {
  const knownEntries = PUBLIC_TESTNET_ROLE_ORDER
    .filter((role) => role in roleCounts)
    .map((role) => [role, roleCounts[role] ?? 0] as const);
  const unknownEntries = Object.entries(roleCounts)
    .filter(([role]) => !PUBLIC_TESTNET_ROLE_ORDER.includes(role))
    .sort(([left], [right]) => left.localeCompare(right));
  const entries = [...knownEntries, ...unknownEntries];
  if (entries.length === 0) return "none";
  return entries
    .map(([role, count]) => (includeTargets && role in PUBLIC_TESTNET_ROLE_COUNTS ? `${role} ${count}/${PUBLIC_TESTNET_ROLE_COUNTS[role as keyof typeof PUBLIC_TESTNET_ROLE_COUNTS]}` : `${role} ${count}`))
    .join(", ");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const roadmap = await readRoadmap(args.roadmap);
  const publicTestnet = await runTestnetVerifier(args);
  const publicTestnetOutreach = await runOutreachAudit(args);
  const publicTestnetRoster = await runRosterAudit(args);
  const workspaceWarnings = await readWorkspaceWarnings();
  const report = buildAuditReport(roadmap, publicTestnet, publicTestnetOutreach, publicTestnetRoster, workspaceWarnings);

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHumanReport(report);
  }

  if (report.status === "Blocked") process.exitCode = 1;
  if (args.strict && report.status !== "Ready") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
