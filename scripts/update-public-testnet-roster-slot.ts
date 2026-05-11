import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const DEFAULT_ROSTER_PATH = "docs/public-testnet-operator-roster.md";
const VALID_STATUSES = ["unassigned", "invited", "accepted", "running", "attested", "reviewed", "blocked"] as const;
const OPEN_VALUE = "open";

type SlotStatus = (typeof VALID_STATUSES)[number];

type Args = {
  roster: string;
  slot: string | null;
  dryRun: boolean;
  updates: Partial<RosterSlot>;
};

type RosterSlot = {
  slot: string;
  trackingIssue: string;
  role: string;
  assignedOperator: string;
  contact: string;
  organization: string;
  independenceReview: string;
  attestationFile: string;
  status: SlotStatus;
  notes: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { roster: DEFAULT_ROSTER_PATH, slot: null, dryRun: false, updates: {} };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--roster") {
      args.roster = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--slot") {
      args.slot = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--tracking-issue") {
      args.updates.trackingIssue = requiredCellValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--operator-id") {
      args.updates.assignedOperator = requiredCellValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--contact") {
      args.updates.contact = requiredCellValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--organization") {
      args.updates.organization = requiredCellValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--independence-review") {
      args.updates.independenceReview = requiredCellValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--attestation-file") {
      args.updates.attestationFile = requiredCellValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--status") {
      const status = requiredCellValue(argv, index, arg);
      if (!isStatus(status)) throw new Error(`Invalid status: ${status}`);
      args.updates.status = status;
      index += 1;
      continue;
    }
    if (arg === "--notes") {
      args.updates.notes = requiredCellValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.slot) throw new Error("--slot is required");
  if (Object.keys(args.updates).length === 0) throw new Error("At least one update argument is required");

  return args;
}

function printHelp() {
  console.log(`Usage: pnpm testnet:update-roster-slot -- --slot <slot-id> [updates]

Updates one row in docs/public-testnet-operator-roster.md without changing the rest of the table.

Options:
  --roster <path>               Roster markdown file to update.
  --slot <slot-id>              Slot id from the Operator Slots table.
  --tracking-issue <value>      Public issue URL, issue number, or tracking id.
  --operator-id <value>         Operator id, handle, or public key.
  --contact <value>             Operator contact URL, handle, email, or public key.
  --organization <value>        Organization name, or independent individual.
  --independence-review <value> pending or reviewed.
  --attestation-file <path>     Attestation JSON path.
  --status <status>             unassigned, invited, accepted, running, attested, reviewed, or blocked.
  --notes <value>               Maintainer notes for the slot.
  --dry-run                     Print the updated roster instead of writing it.
`);
}

async function updateRoster(args: Args) {
  const source = await readFile(args.roster, "utf8");
  const lines = source.split(/\r?\n/);
  const rowIndex = findSlotRowIndex(lines, args.slot ?? "");
  const currentSlot = parseRosterSlot(lines[rowIndex]);
  const nextSlot = { ...currentSlot, ...args.updates };
  validateSlotUpdate(nextSlot);

  lines[rowIndex] = renderRosterSlot(nextSlot);
  return { source: lines.join("\n"), currentSlot, nextSlot };
}

function findSlotRowIndex(lines: string[], slot: string) {
  const start = lines.findIndex((line) => line.trim() === "## Operator Slots");
  if (start < 0) throw new Error("Roster is missing ## Operator Slots");
  const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  const sectionEnd = end < 0 ? lines.length : end;

  for (let index = start + 1; index < sectionEnd; index += 1) {
    const line = lines[index];
    if (!line.trim().startsWith("|")) continue;
    const cells = splitTableRow(line);
    if (cells[0] === slot) return index;
  }

  throw new Error(`Slot not found in roster: ${slot}`);
}

function parseRosterSlot(line: string): RosterSlot {
  const cells = splitTableRow(line);
  if (cells.length !== 10) throw new Error(`Operator Slots row must have 10 cells: ${line}`);

  const [slot, trackingIssue, role, assignedOperator, contact, organization, independenceReview, attestationFile, status, notes] = cells;
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
    notes
  };
}

function splitTableRow(line: string) {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function renderRosterSlot(slot: RosterSlot) {
  const cells = [
    slot.slot,
    slot.trackingIssue,
    slot.role,
    slot.assignedOperator,
    slot.contact,
    slot.organization,
    slot.independenceReview,
    slot.attestationFile,
    slot.status,
    slot.notes
  ];
  return `| ${cells.join(" | ")} |`;
}

function validateSlotUpdate(slot: RosterSlot) {
  for (const [field, value] of Object.entries(slot)) {
    if (typeof value === "string" && value.includes("|")) throw new Error(`${field} cannot contain a markdown table pipe character`);
    if (typeof value === "string" && value.trim().length === 0) throw new Error(`${field} cannot be empty`);
  }

  if (slot.status !== "unassigned") {
    if (slot.trackingIssue === OPEN_VALUE) throw new Error(`${slot.slot}: ${slot.status} status requires a tracking issue`);
    if (slot.assignedOperator === OPEN_VALUE) throw new Error(`${slot.slot}: ${slot.status} status requires an assigned operator`);
    if (slot.contact === OPEN_VALUE) throw new Error(`${slot.slot}: ${slot.status} status requires an operator contact`);
    if (slot.organization === OPEN_VALUE) throw new Error(`${slot.slot}: ${slot.status} status requires an organization or independent-individual marker`);
  }
  if ((slot.status === "attested" || slot.status === "reviewed") && slot.attestationFile === OPEN_VALUE) {
    throw new Error(`${slot.slot}: ${slot.status} status requires an attestation file`);
  }
  if (slot.status === "reviewed" && slot.independenceReview !== "reviewed") {
    throw new Error(`${slot.slot}: reviewed status requires --independence-review reviewed`);
  }
}

function requiredValue(argv: string[], index: number, flag: string) {
  const value = argv[index + 1];
  if (!value) throw new Error(`${flag} requires a value`);
  return value;
}

function requiredCellValue(argv: string[], index: number, flag: string) {
  const value = requiredValue(argv, index, flag).trim();
  if (value.length === 0) throw new Error(`${flag} requires a non-empty value`);
  if (value.includes("|")) throw new Error(`${flag} cannot contain a markdown table pipe character`);
  return value;
}

function isStatus(value: string): value is SlotStatus {
  return (VALID_STATUSES as readonly string[]).includes(value);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await updateRoster(args);

  if (args.dryRun) {
    console.log(result.source);
    return;
  }

  await writeFile(args.roster, result.source, "utf8");
  console.log(`Updated ${result.nextSlot.slot} in ${args.roster}`);
  console.log(`Status: ${result.currentSlot.status} -> ${result.nextSlot.status}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
