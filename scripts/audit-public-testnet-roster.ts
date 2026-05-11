import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_ROSTER_PATH = "docs/public-testnet-operator-roster.md";
const REQUIRED_ROLE_COUNTS = {
  deployer: 1,
  "api-indexer": 2,
  "replay-verifier": 3,
  "community-steward": 2
} as const;
const VALID_STATUSES = ["unassigned", "invited", "accepted", "running", "attested", "reviewed", "blocked"] as const;
const OPEN_VALUE = "open";

type Role = keyof typeof REQUIRED_ROLE_COUNTS;
type SlotStatus = (typeof VALID_STATUSES)[number];
type AuditStatus = "Ready" | "Pending" | "Blocked";

type Args = {
  roster: string;
  json: boolean;
  strict: boolean;
};

type RosterSlot = {
  slot: string;
  trackingIssue: string;
  role: Role;
  assignedOperator: string;
  contact: string;
  organization: string;
  independenceReview: string;
  attestationFile: string;
  status: SlotStatus;
  notes: string;
};

type SlotCount = {
  actual: number;
  required: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { roster: DEFAULT_ROSTER_PATH, json: false, strict: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--roster") {
      const value = argv[index + 1];
      if (!value) throw new Error("--roster requires a path");
      args.roster = value;
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
  console.log(`Usage: pnpm testnet:audit-roster [--roster ${DEFAULT_ROSTER_PATH}] [--json] [--strict]

Audits the public-testnet operator coordination roster.

Options:
  --roster <path>  Roster markdown file to inspect.
  --json           Print the machine-readable report only.
  --strict         Exit non-zero unless every required slot is reviewed with an attestation file.
`);
}

async function readRoster(rosterPath: string) {
  const source = await readFile(rosterPath, "utf8");
  const lines = source.split(/\r?\n/);
  const tableLines = extractOperatorSlotTable(lines);
  const rows = tableLines.slice(2).filter((line) => line.trim().startsWith("|"));
  const slots = rows.map(parseRosterSlot);
  const errors = validateSlots(slots);
  errors.push(...(await validateAttestationFiles(slots)));
  const warnings = [...findDuplicateContacts(slots), ...findDuplicateTrackingIssues(slots)];
  const trackingIssueSlots = countTrackingIssueSlots(slots);
  const roleCounts = buildRoleCounts(slots, (slot) => slot.assignedOperator !== OPEN_VALUE);
  const reviewedRoleCounts = buildRoleCounts(slots, (slot) => slot.status === "reviewed" && slot.independenceReview === "reviewed");
  const missing = buildMissing(roleCounts, reviewedRoleCounts);
  const status: AuditStatus = errors.length > 0 ? "Blocked" : missing.length === 0 ? "Ready" : "Pending";

  return {
    protocol: "popular-consensus",
    schemaVersion: "public-testnet-roster-audit-v0",
    status,
    roster: rosterPath,
    slots,
    trackingIssueSlots,
    roleCounts,
    reviewedRoleCounts,
    missing,
    warnings,
    errors
  };
}

function countTrackingIssueSlots(slots: RosterSlot[]): SlotCount {
  return {
    actual: slots.filter((slot) => slot.trackingIssue !== OPEN_VALUE).length,
    required: slots.length
  };
}

function extractOperatorSlotTable(lines: string[]) {
  const start = lines.findIndex((line) => line.trim() === "## Operator Slots");
  if (start < 0) throw new Error("Roster is missing ## Operator Slots");
  const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  const section = lines.slice(start + 1, end < 0 ? undefined : end).filter((line) => line.trim().startsWith("|"));
  if (section.length < 3) throw new Error("Operator Slots table is missing or incomplete");
  return section;
}

function parseRosterSlot(line: string): RosterSlot {
  const cells = line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
  if (cells.length !== 10) throw new Error(`Operator Slots row must have 10 cells: ${line}`);

  const [slot, trackingIssue, role, assignedOperator, contact, organization, independenceReview, attestationFile, status, notes] = cells;
  if (!slot || !trackingIssue || !role || !assignedOperator || !contact || !organization || !independenceReview || !attestationFile || !status) {
    throw new Error(`Operator Slots row contains an empty required cell: ${line}`);
  }

  if (!isRole(role)) throw new Error(`Invalid operator role in roster: ${role}`);
  if (!isStatus(status)) throw new Error(`Invalid slot status in roster: ${status}`);

  return {
    slot,
    trackingIssue,
    role,
    assignedOperator,
    contact,
    organization,
    independenceReview,
    attestationFile,
    status,
    notes: notes ?? ""
  };
}

function validateSlots(slots: RosterSlot[]) {
  const errors: string[] = [];
  const slotIds = new Set<string>();
  for (const slot of slots) {
    if (slotIds.has(slot.slot)) errors.push(`duplicate slot id: ${slot.slot}`);
    slotIds.add(slot.slot);

    if (slot.status !== "unassigned") {
      if (slot.trackingIssue === OPEN_VALUE) errors.push(`${slot.slot}: ${slot.status} status requires a tracking issue`);
      if (slot.assignedOperator === OPEN_VALUE) errors.push(`${slot.slot}: ${slot.status} status requires an assigned operator`);
      if (slot.contact === OPEN_VALUE) errors.push(`${slot.slot}: ${slot.status} status requires an operator contact`);
      if (slot.organization === OPEN_VALUE) errors.push(`${slot.slot}: ${slot.status} status requires an organization or independent-individual marker`);
    }
    if ((slot.status === "attested" || slot.status === "reviewed") && slot.attestationFile === OPEN_VALUE) {
      errors.push(`${slot.slot}: ${slot.status} status requires an attestation file`);
    }
    if (slot.status === "reviewed" && slot.independenceReview !== "reviewed") {
      errors.push(`${slot.slot}: reviewed status requires Independence Review column to be reviewed`);
    }
  }

  for (const role of Object.keys(REQUIRED_ROLE_COUNTS) as Role[]) {
    const actual = slots.filter((slot) => slot.role === role).length;
    const required = REQUIRED_ROLE_COUNTS[role];
    if (actual < required) errors.push(`${role}: roster has ${actual}/${required} required slots`);
  }

  return errors;
}

async function validateAttestationFiles(slots: RosterSlot[]) {
  const errors: string[] = [];
  for (const slot of slots) {
    if (slot.attestationFile === OPEN_VALUE) continue;
    const filePath = path.resolve(slot.attestationFile);
    try {
      await access(filePath);
    } catch {
      errors.push(`${slot.slot}: attestation file not found at ${slot.attestationFile}`);
    }
  }
  return errors;
}

function findDuplicateContacts(slots: RosterSlot[]) {
  const byContact = new Map<string, string[]>();
  for (const slot of slots) {
    if (slot.contact === OPEN_VALUE) continue;
    const contact = slot.contact.trim().toLowerCase();
    const slotIds = byContact.get(contact) ?? [];
    slotIds.push(slot.slot);
    byContact.set(contact, slotIds);
  }

  return [...byContact.entries()]
    .filter(([, slotIds]) => slotIds.length > 1)
    .map(([contact, slotIds]) => `contact ${contact} appears in multiple slots: ${slotIds.sort().join(", ")}`);
}

function findDuplicateTrackingIssues(slots: RosterSlot[]) {
  const byIssue = new Map<string, string[]>();
  for (const slot of slots) {
    if (slot.trackingIssue === OPEN_VALUE) continue;
    const issue = slot.trackingIssue.trim().toLowerCase();
    const slotIds = byIssue.get(issue) ?? [];
    slotIds.push(slot.slot);
    byIssue.set(issue, slotIds);
  }

  return [...byIssue.entries()]
    .filter(([, slotIds]) => slotIds.length > 1)
    .map(([issue, slotIds]) => `tracking issue ${issue} appears in multiple slots: ${slotIds.sort().join(", ")}`);
}

function buildRoleCounts(slots: RosterSlot[], predicate: (slot: RosterSlot) => boolean) {
  const counts = Object.fromEntries(Object.keys(REQUIRED_ROLE_COUNTS).map((role) => [role, 0])) as Record<Role, number>;
  for (const slot of slots) {
    if (predicate(slot)) counts[slot.role] += 1;
  }
  return counts;
}

function buildMissing(roleCounts: Record<Role, number>, reviewedRoleCounts: Record<Role, number>) {
  const missing: string[] = [];
  for (const role of Object.keys(REQUIRED_ROLE_COUNTS) as Role[]) {
    const required = REQUIRED_ROLE_COUNTS[role];
    if (roleCounts[role] < required) missing.push(`${role}: ${roleCounts[role]}/${required} assigned`);
    if (reviewedRoleCounts[role] < required) missing.push(`${role}: ${reviewedRoleCounts[role]}/${required} reviewed with attestation evidence`);
  }
  return missing;
}

function isRole(value: string): value is Role {
  return value in REQUIRED_ROLE_COUNTS;
}

function isStatus(value: string): value is SlotStatus {
  return (VALID_STATUSES as readonly string[]).includes(value);
}

function printHumanReport(report: Awaited<ReturnType<typeof readRoster>>) {
  console.log(`Public testnet roster audit: ${report.status}`);
  console.log(`Tracking issues: ${report.trackingIssueSlots.actual}/${report.trackingIssueSlots.required}`);
  console.log(
    `Assigned: ${formatRoleCounts(report.roleCounts)}`
  );
  console.log(`Reviewed: ${formatRoleCounts(report.reviewedRoleCounts)}`);

  if (report.missing.length > 0) {
    console.log("\nMissing:");
    for (const item of report.missing) console.log(`- ${item}`);
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

function formatRoleCounts(counts: Record<Role, number>) {
  return (Object.keys(REQUIRED_ROLE_COUNTS) as Role[]).map((role) => `${role} ${counts[role]}/${REQUIRED_ROLE_COUNTS[role]}`).join(", ");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = await readRoster(args.roster);
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
