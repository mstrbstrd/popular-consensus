import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const DEFAULT_INTAKE_PATH = "docs/public-testnet-operator-issue-url-intake.md";
const DEFAULT_ROSTER_PATH = "docs/public-testnet-operator-roster.md";
const OPEN_VALUE = "open";

type Args = {
  intake: string;
  roster: string;
  dryRun: boolean;
};

type IssueUrlEntry = {
  slot: string;
  role: string;
  trackingIssue: string;
};

type RosterSlot = {
  slot: string;
  trackingIssue: string;
  role: string;
  cells: string[];
};

function parseArgs(argv: string[]): Args {
  const args: Args = { intake: DEFAULT_INTAKE_PATH, roster: DEFAULT_ROSTER_PATH, dryRun: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--intake") {
      args.intake = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--roster") {
      args.roster = requiredValue(argv, index, arg);
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

  return args;
}

function printHelp() {
  console.log(`Usage: pnpm testnet:record-issue-urls [--intake ${DEFAULT_INTAKE_PATH}] [--roster ${DEFAULT_ROSTER_PATH}] [--dry-run]

Records public-testnet operator tracking issue URLs from the issue URL intake sheet onto the roster.
Rows whose Tracking Issue URL Or Number is \`open\` are skipped.

Options:
  --intake <path>  Issue URL intake markdown file.
  --roster <path>  Operator roster markdown file to update.
  --dry-run        Validate and report planned updates without writing the roster.
`);
}

async function readIssueUrlEntries(intakePath: string) {
  const source = await readFile(intakePath, "utf8");
  const lines = source.split(/\r?\n/);
  const sectionStart = lines.findIndex((line) => line.trim() === "## Issue URLs");
  if (sectionStart < 0) throw new Error("Issue URL intake is missing ## Issue URLs");
  const header = lines.findIndex((line, index) => index > sectionStart && line.trim().startsWith("| Slot |"));
  if (header < 0) throw new Error("Issue URL intake table is missing a header row");
  const separator = header + 1;
  if (!lines[separator]?.trim().startsWith("| ---")) throw new Error("Issue URL intake table is missing a separator row");

  const entries: IssueUrlEntry[] = [];
  for (let index = separator + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim().startsWith("|")) break;
    const cells = splitTableRow(line);
    if (cells.length !== 3) throw new Error(`Issue URL row must have 3 cells: ${line}`);
    const [slot, role, trackingIssue] = cells;
    validateCell("slot", slot);
    validateCell("role", role);
    validateCell("trackingIssue", trackingIssue);
    entries.push({ slot, role, trackingIssue });
  }

  return entries;
}

async function updateRosterFromIntake(args: Args) {
  const entries = (await readIssueUrlEntries(args.intake)).filter((entry) => entry.trackingIssue !== OPEN_VALUE);
  const source = await readFile(args.roster, "utf8");
  const lines = source.split(/\r?\n/);
  const table = findRosterTable(lines);
  const rosterSlots = new Map<string, { index: number; slot: RosterSlot }>();

  for (let index = table.firstRow; index < table.end; index += 1) {
    const cells = splitTableRow(lines[index]);
    if (cells.length !== 10) throw new Error(`Operator Slots row must have 10 cells: ${lines[index]}`);
    const slot = { slot: cells[0], trackingIssue: cells[1], role: cells[2], cells };
    rosterSlots.set(slot.slot, { index, slot });
  }

  const updatedSlots: string[] = [];
  for (const entry of entries) {
    const rosterEntry = rosterSlots.get(entry.slot);
    if (!rosterEntry) throw new Error(`${entry.slot}: issue URL intake slot is not present in roster`);
    if (entry.role !== rosterEntry.slot.role) {
      throw new Error(`${entry.slot}: intake role ${entry.role} does not match roster role ${rosterEntry.slot.role}`);
    }
    rosterEntry.slot.cells[1] = entry.trackingIssue;
    lines[rosterEntry.index] = renderTableRow(rosterEntry.slot.cells);
    updatedSlots.push(entry.slot);
  }

  return { source: lines.join("\n"), updatedSlots };
}

function findRosterTable(lines: string[]) {
  const sectionStart = lines.findIndex((line) => line.trim() === "## Operator Slots");
  if (sectionStart < 0) throw new Error("Roster is missing ## Operator Slots");
  const header = lines.findIndex((line, index) => index > sectionStart && line.trim().startsWith("| Slot |"));
  if (header < 0) throw new Error("Operator Slots table is missing a header row");
  const separator = header + 1;
  if (!lines[separator]?.trim().startsWith("| ---")) throw new Error("Operator Slots table is missing a separator row");

  let end = separator + 1;
  while (end < lines.length && lines[end].trim().startsWith("|")) end += 1;

  return { header, firstRow: separator + 1, end };
}

function splitTableRow(line: string) {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function renderTableRow(cells: string[]) {
  return `| ${cells.join(" | ")} |`;
}

function validateCell(name: string, value: string) {
  if (value.trim().length === 0) throw new Error(`${name} cannot be empty`);
  if (value.includes("|")) throw new Error(`${name} cannot contain a markdown table pipe character`);
}

function requiredValue(argv: string[], index: number, flag: string) {
  const value = argv[index + 1];
  if (!value) throw new Error(`${flag} requires a value`);
  return value;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await updateRosterFromIntake(args);

  if (args.dryRun) {
    console.log(`Would record ${result.updatedSlots.length} tracking issue URL(s) in ${args.roster}`);
    if (result.updatedSlots.length > 0) {
      console.log(`Slots: ${result.updatedSlots.join(", ")}`);
    } else {
      console.log("No non-open issue URLs found in the intake sheet.");
    }
    return;
  }

  await writeFile(args.roster, result.source, "utf8");
  console.log(`Recorded ${result.updatedSlots.length} tracking issue URL(s) in ${args.roster}`);
  if (result.updatedSlots.length > 0) console.log(`Slots: ${result.updatedSlots.join(", ")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
