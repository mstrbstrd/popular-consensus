import { readFile } from "node:fs/promises";
import process from "node:process";

const DEFAULT_LOG_PATH = "docs/public-testnet-operator-outreach-log.md";
const DEFAULT_ROSTER_PATH = "docs/public-testnet-operator-roster.md";
const VALID_STATUSES = ["candidate", "contacted", "interested", "accepted", "declined", "no-response", "blocked"] as const;
const OPEN_VALUE = "open";

type OutreachStatus = (typeof VALID_STATUSES)[number];
type AuditStatus = "Ready" | "Pending" | "Blocked";

type Args = {
  log: string;
  roster: string;
  json: boolean;
  strict: boolean;
};

type RosterSlot = {
  slot: string;
  trackingIssue: string;
  role: string;
  status: string;
};

type OutreachEntry = {
  candidate: string;
  pool: string;
  contact: string;
  slot: string;
  role: string;
  status: OutreachStatus;
  lastContact: string;
  trackingIssue: string;
  notes: string;
};

type SlotCount = {
  actual: number;
  required: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { log: DEFAULT_LOG_PATH, roster: DEFAULT_ROSTER_PATH, json: false, strict: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--log") {
      const value = argv[index + 1];
      if (!value) throw new Error("--log requires a path");
      args.log = value;
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
  console.log(`Usage: pnpm testnet:audit-outreach [--log ${DEFAULT_LOG_PATH}] [--roster ${DEFAULT_ROSTER_PATH}] [--json] [--strict]

Audits the public-testnet outreach prospect log.
This does not validate operator attestations or complete the final public-testnet gate.

Options:
  --log <path>     Outreach log markdown file to inspect.
  --roster <path>  Operator roster used to validate slot and role values.
  --json           Print the machine-readable report only.
  --strict         Exit non-zero unless every roster slot has a contacted-or-later outreach row.
`);
}

async function auditOutreach(args: Args) {
  const slots = await readRosterSlots(args.roster);
  const entries = await readOutreachEntries(args.log);
  const errors = validateEntries(entries, slots);
  const warnings = buildWarnings(entries, slots);
  const identifiedSlots = countIdentifiedSlots(entries, slots);
  const contactedSlots = countContactedSlots(entries, slots);
  const missing = buildMissing(entries, slots);
  const status: AuditStatus = errors.length > 0 ? "Blocked" : missing.length === 0 ? "Ready" : "Pending";

  return {
    protocol: "popular-consensus",
    schemaVersion: "public-testnet-outreach-audit-v0",
    status,
    log: args.log,
    roster: args.roster,
    slots: slots.length,
    entries,
    identifiedSlots,
    contactedSlots,
    missing,
    warnings,
    errors
  };
}

async function readRosterSlots(rosterPath: string) {
  const source = await readFile(rosterPath, "utf8");
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === "## Operator Slots");
  if (start < 0) throw new Error("Roster is missing ## Operator Slots");
  const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  const sectionEnd = end < 0 ? lines.length : end;
  const slots: RosterSlot[] = [];

  for (let index = start + 1; index < sectionEnd; index += 1) {
    const line = lines[index];
    if (!line.trim().startsWith("|")) continue;
    const cells = splitTableRow(line);
    if (cells[0] === "Slot" || cells[0] === "---") continue;
    if (cells.length < 9) throw new Error(`Operator Slots row must have at least 9 cells: ${line}`);
    slots.push({ slot: cells[0], trackingIssue: cells[1], role: cells[2], status: cells[8] });
  }

  return slots;
}

async function readOutreachEntries(logPath: string) {
  const source = await readFile(logPath, "utf8");
  const lines = source.split(/\r?\n/);
  const sectionStart = lines.findIndex((line) => line.trim() === "## Outreach Entries");
  if (sectionStart < 0) throw new Error("Outreach log is missing ## Outreach Entries");
  const header = lines.findIndex((line, index) => index > sectionStart && line.trim().startsWith("| Candidate |"));
  if (header < 0) throw new Error("Outreach Entries table is missing a header row");
  const separator = header + 1;
  if (!lines[separator]?.trim().startsWith("| ---")) throw new Error("Outreach Entries table is missing a separator row");
  const entries: OutreachEntry[] = [];

  for (let index = separator + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim().startsWith("|")) break;
    const cells = splitTableRow(line);
    if (cells.length !== 9) throw new Error(`Outreach row must have 9 cells: ${line}`);
    const [candidate, pool, contact, slot, role, status, lastContact, trackingIssue, notes] = cells;
    if (!isStatus(status)) throw new Error(`Invalid outreach status: ${status}`);
    entries.push({ candidate, pool, contact, slot, role, status, lastContact, trackingIssue, notes });
  }

  return entries;
}

function validateEntries(entries: OutreachEntry[], slots: RosterSlot[]) {
  const errors: string[] = [];
  const slotsById = new Map(slots.map((slot) => [slot.slot, slot]));

  for (const entry of entries) {
    const rosterSlot = slotsById.get(entry.slot);
    if (!rosterSlot) {
      errors.push(`${entry.slot}: outreach target slot is not present in roster`);
      continue;
    }
    if (entry.role !== rosterSlot.role) errors.push(`${entry.slot}: outreach role ${entry.role} does not match roster role ${rosterSlot.role}`);
    if (isContactedOrLater(entry.status) && entry.trackingIssue === OPEN_VALUE) {
      errors.push(`${entry.slot}: ${entry.status} outreach requires a tracking issue`);
    }
    if (isContactedOrLater(entry.status) && entry.trackingIssue !== OPEN_VALUE) {
      if (rosterSlot.trackingIssue === OPEN_VALUE) {
        errors.push(`${entry.slot}: roster tracking issue is open but outreach records ${entry.trackingIssue}`);
      } else if (entry.trackingIssue !== rosterSlot.trackingIssue) {
        errors.push(`${entry.slot}: outreach tracking issue ${entry.trackingIssue} does not match roster tracking issue ${rosterSlot.trackingIssue}`);
      }
    }

    if (isOpenPlaceholder(entry)) continue;
    for (const field of ["candidate", "pool", "contact", "notes"] as const) {
      if (entry[field] === OPEN_VALUE || entry[field].trim().length === 0) errors.push(`${entry.slot}: ${field} is required for ${entry.status} outreach`);
    }
    if (entry.status !== "candidate" && (entry.lastContact === OPEN_VALUE || entry.lastContact.trim().length === 0)) {
      errors.push(`${entry.slot}: lastContact is required for ${entry.status} outreach`);
    }
  }

  return errors;
}

function buildWarnings(entries: OutreachEntry[], slots: RosterSlot[]) {
  const warnings: string[] = [];
  const slotsById = new Map(slots.map((slot) => [slot.slot, slot]));
  const acceptedUnpromoted = entries.filter((entry) => entry.status === "accepted" && slotsById.get(entry.slot)?.status === "unassigned");
  for (const entry of acceptedUnpromoted) {
    warnings.push(`${entry.slot}: accepted outreach should be promoted with pnpm testnet:update-roster-slot`);
  }

  const byContact = new Map<string, string[]>();
  for (const entry of entries) {
    if (entry.status === "candidate") continue;
    if (entry.contact === OPEN_VALUE) continue;
    const key = entry.contact.trim().toLowerCase();
    const slotIds = byContact.get(key) ?? [];
    slotIds.push(entry.slot);
    byContact.set(key, slotIds);
  }
  for (const [contact, slotIds] of byContact.entries()) {
    const uniqueSlots = [...new Set(slotIds)].sort();
    if (uniqueSlots.length > 1) warnings.push(`candidate contact ${contact} appears across multiple slots: ${uniqueSlots.join(", ")}`);
  }

  return warnings;
}

function isContactedOrLater(status: OutreachStatus) {
  return ["contacted", "interested", "accepted", "declined", "no-response", "blocked"].includes(status);
}

function countIdentifiedSlots(entries: OutreachEntry[], slots: RosterSlot[]): SlotCount {
  const identified = new Set(
    entries
      .filter((entry) => entry.candidate !== OPEN_VALUE && entry.pool !== OPEN_VALUE && entry.contact !== OPEN_VALUE)
      .map((entry) => entry.slot)
  );
  return {
    actual: slots.filter((slot) => identified.has(slot.slot)).length,
    required: slots.length
  };
}

function countContactedSlots(entries: OutreachEntry[], slots: RosterSlot[]): SlotCount {
  const contactedStatuses: OutreachStatus[] = ["contacted", "interested", "accepted", "declined", "no-response", "blocked"];
  const contacted = new Set(
    entries
      .filter((entry) => contactedStatuses.includes(entry.status) && entry.candidate !== OPEN_VALUE)
      .map((entry) => entry.slot)
  );
  return {
    actual: slots.filter((slot) => contacted.has(slot.slot)).length,
    required: slots.length
  };
}

function buildMissing(entries: OutreachEntry[], slots: RosterSlot[]) {
  const contactedStatuses: OutreachStatus[] = ["contacted", "interested", "accepted", "declined", "no-response", "blocked"];
  const contacted = new Set(
    entries
      .filter((entry) => contactedStatuses.includes(entry.status) && entry.candidate !== OPEN_VALUE)
      .map((entry) => entry.slot)
  );
  return slots.filter((slot) => !contacted.has(slot.slot)).map((slot) => `${slot.slot}: no contacted-or-later outreach row`);
}

function isOpenPlaceholder(entry: OutreachEntry) {
  return (
    entry.candidate === OPEN_VALUE &&
    entry.pool === OPEN_VALUE &&
    entry.contact === OPEN_VALUE &&
    entry.status === "candidate" &&
    entry.lastContact === OPEN_VALUE &&
    entry.trackingIssue === OPEN_VALUE
  );
}

function splitTableRow(line: string) {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function isStatus(value: string): value is OutreachStatus {
  return (VALID_STATUSES as readonly string[]).includes(value);
}

function printHumanReport(report: Awaited<ReturnType<typeof auditOutreach>>) {
  console.log(`Public testnet outreach audit: ${report.status}`);
  console.log(`Identified slots: ${report.identifiedSlots.actual}/${report.identifiedSlots.required}`);
  console.log(`Contacted slots: ${report.contactedSlots.actual}/${report.contactedSlots.required}`);

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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = await auditOutreach(args);

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHumanReport(report);
  }

  if (report.status === "Blocked" || (args.strict && report.status !== "Ready")) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
