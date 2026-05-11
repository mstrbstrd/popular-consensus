import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const DEFAULT_LOG_PATH = "docs/public-testnet-operator-outreach-log.md";
const DEFAULT_ROSTER_PATH = "docs/public-testnet-operator-roster.md";
const VALID_STATUSES = ["candidate", "contacted", "interested", "accepted", "declined", "no-response", "blocked"] as const;
const OPEN_VALUE = "open";

type OutreachStatus = (typeof VALID_STATUSES)[number];

type Args = {
  log: string;
  roster: string;
  candidate: string | null;
  pool: string | null;
  contact: string | null;
  slot: string | null;
  role: string | null;
  status: OutreachStatus | null;
  lastContact: string;
  trackingIssue: string | null;
  trackingIssueFromRoster: boolean;
  notes: string | null;
  dryRun: boolean;
};

type RosterSlot = {
  role: string;
  trackingIssue: string;
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

function parseArgs(argv: string[]): Args {
  const args: Args = {
    log: DEFAULT_LOG_PATH,
    roster: DEFAULT_ROSTER_PATH,
    candidate: null,
    pool: null,
    contact: null,
    slot: null,
    role: null,
    status: null,
    lastContact: new Date().toISOString().slice(0, 10),
    trackingIssue: null,
    trackingIssueFromRoster: false,
    notes: null,
    dryRun: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--log") {
      args.log = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--roster") {
      args.roster = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--candidate") {
      args.candidate = requiredCellValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--pool") {
      args.pool = requiredCellValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--contact") {
      args.contact = requiredCellValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--slot") {
      args.slot = requiredCellValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--role") {
      args.role = requiredCellValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--status") {
      const status = requiredCellValue(argv, index, arg);
      if (!isStatus(status)) throw new Error(`Invalid outreach status: ${status}`);
      args.status = status;
      index += 1;
      continue;
    }
    if (arg === "--last-contact") {
      args.lastContact = requiredCellValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--tracking-issue") {
      args.trackingIssue = requiredCellValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--tracking-issue-from-roster") {
      args.trackingIssueFromRoster = true;
      continue;
    }
    if (arg === "--notes") {
      args.notes = requiredCellValue(argv, index, arg);
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

  if (!args.candidate) throw new Error("--candidate is required");
  if (!args.pool) throw new Error("--pool is required");
  if (!args.contact) throw new Error("--contact is required");
  if (!args.slot) throw new Error("--slot is required");
  if (!args.status) throw new Error("--status is required");
  if (!args.notes) throw new Error("--notes is required");
  if (args.trackingIssue && args.trackingIssueFromRoster) {
    throw new Error("--tracking-issue cannot be combined with --tracking-issue-from-roster");
  }

  return args;
}

function printHelp() {
  console.log(`Usage: pnpm testnet:record-outreach -- --slot <slot-id> --candidate <name> --pool <pool> --contact <route> --status <status> --notes <notes>

Records one public-testnet outreach attempt in docs/public-testnet-operator-outreach-log.md.
This does not assign a roster slot or create completion evidence.

Options:
  --log <path>              Outreach log markdown file to update.
  --roster <path>           Operator roster used to validate slot and derive role.
  --candidate <value>       Candidate, community, or route contacted.
  --pool <value>            Candidate pool name.
  --contact <value>         Public contact route, URL, handle, email, or key.
  --slot <slot-id>          Target roster slot.
  --role <role>             Optional role override; must match the roster.
  --status <status>         candidate, contacted, interested, accepted, declined, no-response, or blocked.
  --last-contact <date>     Contact date. Defaults to today's UTC date.
  --tracking-issue <value>  Public issue URL, issue number, or open. Required for contacted-or-later statuses.
  --tracking-issue-from-roster
                            Use the target slot's Tracking Issue value from the roster.
  --notes <value>           Short outreach note.
  --dry-run                 Print the updated log instead of writing it.
`);
}

async function recordOutreach(args: Args) {
  const rosterSlots = await readRosterSlots(args.roster);
  const rosterSlot = rosterSlots.get(args.slot ?? "");
  if (!rosterSlot) throw new Error(`Slot not found in roster: ${args.slot}`);
  const role = rosterSlot.role;
  if (args.role && args.role !== role) throw new Error(`${args.slot}: role ${args.role} does not match roster role ${role}`);
  const trackingIssue = args.trackingIssueFromRoster ? rosterSlot.trackingIssue : args.trackingIssue ?? OPEN_VALUE;
  if (args.trackingIssueFromRoster && isContactedOrLater(args.status ?? "candidate") && trackingIssue === OPEN_VALUE) {
    throw new Error(`${args.slot}: roster tracking issue is open; record an issue URL with pnpm testnet:update-roster-slot or pass --tracking-issue`);
  }

  const entry: OutreachEntry = {
    candidate: args.candidate ?? "",
    pool: args.pool ?? "",
    contact: args.contact ?? "",
    slot: args.slot ?? "",
    role,
    status: args.status ?? "candidate",
    lastContact: args.lastContact,
    trackingIssue,
    notes: args.notes ?? ""
  };
  validateEntry(entry);

  const source = await readFile(args.log, "utf8");
  const lines = source.split(/\r?\n/);
  const table = findOutreachTable(lines);
  const row = renderOutreachEntry(entry);
  const placeholderIndex = findOpenSlotRow(lines, table, entry.slot);
  let mode: "replaced-open-slot" | "appended";

  if (placeholderIndex >= 0) {
    lines[placeholderIndex] = row;
    mode = "replaced-open-slot";
  } else {
    lines.splice(table.end, 0, row);
    mode = "appended";
  }

  return { source: lines.join("\n"), entry, mode };
}

async function readRosterSlots(rosterPath: string) {
  const source = await readFile(rosterPath, "utf8");
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === "## Operator Slots");
  if (start < 0) throw new Error("Roster is missing ## Operator Slots");
  const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  const sectionEnd = end < 0 ? lines.length : end;
  const slots = new Map<string, RosterSlot>();

  for (let index = start + 1; index < sectionEnd; index += 1) {
    const line = lines[index];
    if (!line.trim().startsWith("|")) continue;
    const cells = splitTableRow(line);
    if (cells[0] === "Slot" || cells[0] === "---") continue;
    if (cells.length >= 3) slots.set(cells[0], { trackingIssue: cells[1], role: cells[2] });
  }

  return slots;
}

function findOutreachTable(lines: string[]) {
  const sectionStart = lines.findIndex((line) => line.trim() === "## Outreach Entries");
  if (sectionStart < 0) throw new Error("Outreach log is missing ## Outreach Entries");
  const header = lines.findIndex((line, index) => index > sectionStart && line.trim().startsWith("| Candidate |"));
  if (header < 0) throw new Error("Outreach Entries table is missing a header row");
  const separator = header + 1;
  if (!lines[separator]?.trim().startsWith("| ---")) throw new Error("Outreach Entries table is missing a separator row");

  let end = separator + 1;
  while (end < lines.length && lines[end].trim().startsWith("|")) end += 1;

  return { header, firstRow: separator + 1, end };
}

function findOpenSlotRow(lines: string[], table: ReturnType<typeof findOutreachTable>, slot: string) {
  for (let index = table.firstRow; index < table.end; index += 1) {
    const cells = splitTableRow(lines[index]);
    if (cells.length === 9 && cells[0] === OPEN_VALUE && cells[3] === slot) return index;
  }
  return -1;
}

function splitTableRow(line: string) {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function renderOutreachEntry(entry: OutreachEntry) {
  return `| ${[
    entry.candidate,
    entry.pool,
    entry.contact,
    entry.slot,
    entry.role,
    entry.status,
    entry.lastContact,
    entry.trackingIssue,
    entry.notes
  ].join(" | ")} |`;
}

function validateEntry(entry: OutreachEntry) {
  for (const [field, value] of Object.entries(entry)) {
    if (typeof value === "string" && value.includes("|")) throw new Error(`${field} cannot contain a markdown table pipe character`);
    if (typeof value === "string" && value.trim().length === 0) throw new Error(`${field} cannot be empty`);
  }

  if (entry.candidate === OPEN_VALUE) throw new Error("candidate must name a real candidate, community, or route");
  if (entry.pool === OPEN_VALUE) throw new Error("pool must name a candidate pool");
  if (entry.contact === OPEN_VALUE) throw new Error("contact must provide a public route");
  if (isContactedOrLater(entry.status) && entry.trackingIssue === OPEN_VALUE) {
    throw new Error(`${entry.status} outreach requires a tracking issue`);
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

function isStatus(value: string): value is OutreachStatus {
  return (VALID_STATUSES as readonly string[]).includes(value);
}

function isContactedOrLater(status: OutreachStatus) {
  return ["contacted", "interested", "accepted", "declined", "no-response", "blocked"].includes(status);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await recordOutreach(args);

  if (args.dryRun) {
    console.log(result.source);
    return;
  }

  await writeFile(args.log, result.source, "utf8");
  console.log(`Recorded outreach for ${result.entry.slot} in ${args.log}`);
  console.log(`Mode: ${result.mode}`);
  console.log(`Status: ${result.entry.status}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
