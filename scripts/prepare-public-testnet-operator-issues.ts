import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_ROSTER_PATH = "docs/public-testnet-operator-roster.md";
const DEFAULT_OUT_PATH = "docs/public-testnet-operator-issue-drafts.md";
const ISSUE_LABELS = ["public-testnet", "operator"] as const;
const VALID_ROLES = ["deployer", "api-indexer", "replay-verifier", "community-steward"] as const;
const VALID_STATUSES = ["unassigned", "invited", "accepted", "running", "attested", "reviewed", "blocked"] as const;

type Role = (typeof VALID_ROLES)[number];
type SlotStatus = (typeof VALID_STATUSES)[number];

type Args = {
  roster: string;
  out: string;
  bodyDir: string | null;
  githubRepo: string | null;
  check: boolean;
  json: boolean;
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

type IssueDraft = {
  slot: string;
  role: Role;
  title: string;
  labels: string[];
  body: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { roster: DEFAULT_ROSTER_PATH, out: DEFAULT_OUT_PATH, bodyDir: null, githubRepo: null, check: false, json: false };

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
    if (arg === "--out") {
      const value = argv[index + 1];
      if (!value) throw new Error("--out requires a path, or '-' for stdout");
      args.out = value;
      index += 1;
      continue;
    }
    if (arg === "--body-dir") {
      const value = argv[index + 1];
      if (!value) throw new Error("--body-dir requires a path");
      args.bodyDir = value;
      index += 1;
      continue;
    }
    if (arg === "--github-repo") {
      const value = argv[index + 1];
      if (!value) throw new Error("--github-repo requires an owner/repo value");
      if (!isGitHubRepo(value)) throw new Error("--github-repo must use owner/repo format");
      args.githubRepo = value;
      index += 1;
      continue;
    }
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg === "--check") {
      args.check = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (args.check && args.json) throw new Error("--check cannot be combined with --json");
  return args;
}

function printHelp() {
  console.log(`Usage: pnpm testnet:operator-issue-drafts [--roster ${DEFAULT_ROSTER_PATH}] [--out ${DEFAULT_OUT_PATH}] [--body-dir <path>] [--github-repo <owner/repo>] [--check] [--json]

Prepares local GitHub issue drafts for unassigned public-testnet operator slots that still need a tracking issue.

Options:
  --roster <path>  Roster markdown file to inspect.
  --out <path>     Markdown draft output path. Use '-' for stdout.
  --body-dir <path>
                   Also write one issue body file per slot plus a gh command README.
  --github-repo <owner/repo>
                   Include an explicit gh --repo target in generated issue commands.
  --check          Verify generated files are up to date without writing.
  --json           Print the machine-readable drafts only.
`);
}

async function readRoster(rosterPath: string) {
  const source = await readFile(rosterPath, "utf8");
  const lines = source.split(/\r?\n/);
  const tableLines = extractOperatorSlotTable(lines);
  const rows = tableLines.slice(2).filter((line) => line.trim().startsWith("|"));
  return rows.map(parseRosterSlot);
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

function buildIssueDrafts(slots: RosterSlot[]) {
  return slots
    .filter((slot) => slot.status === "unassigned" && slot.assignedOperator === "open" && slot.trackingIssue === "open")
    .map((slot) => ({
      slot: slot.slot,
      role: slot.role,
      title: `[Public testnet operator]: ${slot.slot} ${slot.role}`,
      labels: [...ISSUE_LABELS],
      body: renderIssueBody(slot)
    }));
}

function renderIssueBody(slot: RosterSlot) {
  return `Use this issue to coordinate an independent public testnet operator. The completion gate still requires a valid attestation JSON file, maintainer independence review, and a launch summary.

## Operator Role

${slot.role}

## Roster Slot

${slot.slot}

## Operator Identity

- Operator id: needs-operator-id
- Contact or public key: needs-contact-or-public-key
- Organization: independent individual or organization name
- Independence statement: explain why this operator is independent from maintainers and sibling operators

## Testnet Environment

- Testnet window: needs-testnet-window
- Chain id: needs-chain-id
- RPC URL: needs-rpc-url
- API base URL: only required for API/indexer operators
- Community id: needs-community-id

## Attestation Command Shape

\`\`\`sh
pnpm testnet:collect-attestation -- \\
  --operator-id needs-operator-id \\
  --operator-contact needs-contact-or-public-key \\
  --operator-organization "independent individual or organization name" \\
  --independence-statement "explain operator independence from maintainers and sibling operators" \\
  --role ${slot.role} \\
  --git-commit needs-git-commit \\
  --chain-id needs-chain-id \\
  --rpc-url needs-rpc-url \\
  --community-id needs-community-id \\
  --checks-preset complete \\
${roleSpecificCommandLines(slot.role)}  --out docs/public-testnet-attestations/needs-operator-id.json
\`\`\`

## Operator Checklist

- [ ] Operator has read docs/public-testnet-operator-runbook.md.
- [ ] Operator can provide the required contact or public key.
- [ ] Operator can provide an independence statement.
- [ ] Operator will publish or provide a public-testnet operator attestation JSON file.
- [ ] Maintainer independence review is complete.

## Attestation Output

- Attestation file: docs/public-testnet-attestations/needs-operator-id.json
- Attestation hash: pending
- Observations: pending

## Maintainer Notes

${slot.notes}
`;
}

function renderMarkdown(drafts: IssueDraft[]) {
  const sections = drafts.map((draft) => `## ${draft.slot}

Title: ${draft.title}
Labels: ${draft.labels.join(", ")}

\`\`\`\`markdown
${draft.body.trim()}
\`\`\`\`
`).join("\n");
  const draftSections = sections || "No unassigned operator slots with `Tracking Issue` set to `open` need new issue drafts.\n";

  return `# Public Testnet Operator Issue Drafts

These local drafts are generated from \`${DEFAULT_ROSTER_PATH}\` for unassigned slots that still have \`Tracking Issue\` set to \`open\`, and aligned with \`.github/ISSUE_TEMPLATE/public-testnet-operator.yml\`. They do not create GitHub issues, publish evidence, or complete the final public-testnet gate.

Regenerate them with:

\`\`\`sh
pnpm testnet:operator-issue-drafts
\`\`\`

Generate one body file per issue for GitHub CLI usage with:

\`\`\`sh
pnpm testnet:operator-issue-drafts -- --body-dir docs/public-testnet-operator-issue-bodies
\`\`\`

The body files can also be used for manual issue creation when the GitHub CLI \`gh\` is unavailable.

Generate machine-readable issue drafts for authenticated GitHub connector usage with:

\`\`\`sh
pnpm testnet:operator-issue-drafts -- --json
\`\`\`

After explicit maintainer approval, create one issue per \`drafts[]\` entry with the supplied \`title\`, \`body\`, and \`labels\`.

Check whether the generated files are current with:

\`\`\`sh
pnpm testnet:operator-issue-drafts:check
\`\`\`

If this workspace has no Git remote or GitHub default repository, generate commands with an explicit target:

\`\`\`sh
pnpm testnet:operator-issue-drafts -- --body-dir docs/public-testnet-operator-issue-bodies --github-repo <owner/repo>
\`\`\`

Create one public issue per operator slot that still has no tracking issue, then record the resulting issue URL or number with \`pnpm testnet:update-roster-slot -- --slot <slot> --tracking-issue <issue-url-or-number>\`.

${draftSections}`;
}

function roleSpecificCommandLines(role: Role) {
  if (role === "deployer") return "  --deployment-hash sha256:needs-deployment-hash \\\n";
  if (role === "api-indexer") return "  --api-base-url needs-api-base-url \\\n";
  return "";
}

async function writeOutput(outPath: string, content: string) {
  if (outPath === "-") {
    console.log(content);
    return;
  }

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, content, "utf8");
  console.log(`Wrote ${outPath}`);
}

async function writeIssueBodyFiles(bodyDir: string, drafts: IssueDraft[], githubRepo: string | null) {
  await mkdir(bodyDir, { recursive: true });
  await pruneStaleIssueBodyFiles(bodyDir, drafts);
  for (const draft of drafts) {
    await writeFile(path.join(bodyDir, `${fileStemForSlot(draft.slot)}.md`), draft.body, "utf8");
  }
  await writeFile(path.join(bodyDir, "README.md"), renderBodyFilesReadme(bodyDir, drafts, githubRepo), "utf8");
  console.log(`Wrote ${drafts.length} issue body files to ${bodyDir}`);
}

async function pruneStaleIssueBodyFiles(bodyDir: string, drafts: IssueDraft[]) {
  const expectedFiles = new Set(["README.md", ...drafts.map((draft) => `${fileStemForSlot(draft.slot)}.md`)]);
  let entries;
  try {
    entries = await readdir(bodyDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md") && !expectedFiles.has(entry.name)) {
      await rm(path.join(bodyDir, entry.name));
    }
  }
}

async function checkOutput(outPath: string, content: string, failures: string[]) {
  if (outPath === "-") throw new Error("--check requires --out to be a file path");
  await checkFile(outPath, content, failures);
}

async function checkIssueBodyFiles(bodyDir: string, drafts: IssueDraft[], githubRepo: string | null, failures: string[]) {
  const expectedFiles = new Set(["README.md", ...drafts.map((draft) => `${fileStemForSlot(draft.slot)}.md`)]);
  for (const draft of drafts) {
    await checkFile(path.join(bodyDir, `${fileStemForSlot(draft.slot)}.md`), draft.body, failures);
  }
  await checkFile(path.join(bodyDir, "README.md"), renderBodyFilesReadme(bodyDir, drafts, githubRepo), failures);

  try {
    const entries = await readdir(bodyDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md") && !expectedFiles.has(entry.name)) {
        failures.push(`${path.join(bodyDir, entry.name)}: extra`);
      }
    }
  } catch {
    failures.push(`${bodyDir}: missing`);
  }
}

async function checkFile(filePath: string, expected: string, failures: string[]) {
  let actual = "";
  try {
    actual = await readFile(filePath, "utf8");
  } catch {
    failures.push(`${filePath}: missing`);
    return;
  }

  if (actual !== expected) failures.push(`${filePath}: stale`);
}

function renderBodyFilesReadme(bodyDir: string, drafts: IssueDraft[], githubRepo: string | null) {
  const repoArg = githubRepo ? ` --repo ${githubRepo}` : "";
  const commands = drafts.map((draft) => `gh issue create${repoArg} --title "${draft.title}" ${draft.labels.map((label) => `--label ${label}`).join(" ")} --body-file ${path.join(bodyDir, `${fileStemForSlot(draft.slot)}.md`)}`).join("\n");
  const manualRows = drafts.length > 0
    ? drafts
        .map((draft) => `| ${draft.slot} | ${draft.title} | ${draft.labels.join(", ")} | ${path.join(bodyDir, `${fileStemForSlot(draft.slot)}.md`)} |`)
        .join("\n")
    : "| none | No slots currently need new tracking issues. | none | none |";
  const recordCommands = drafts.map((draft) => `pnpm testnet:update-roster-slot -- --slot ${draft.slot} --tracking-issue <${draft.slot}-issue-url-or-number>`).join("\n");
  const commandBlock = commands || "# No gh issue create commands are needed because every eligible slot already has a tracking issue.";
  const recordCommandBlock = recordCommands || "# No roster tracking commands are needed because every eligible slot already has a tracking issue.";
  const repoNote = githubRepo
    ? `These commands target \`${githubRepo}\` explicitly.`
    : "If this workspace has no Git remote or GitHub default repository, regenerate with `pnpm testnet:operator-issue-drafts -- --body-dir docs/public-testnet-operator-issue-bodies --github-repo <owner/repo>` or add `--repo <owner/repo>` to each command.";
  return `# Public Testnet Operator Issue Body Files

These files are generated from \`${DEFAULT_ROSTER_PATH}\` for GitHub CLI usage. They do not create issues, publish evidence, or complete the final public-testnet gate.

Create issues after a Git remote, GitHub default repository, or explicit \`--repo\` target is available and a maintainer approves the public action:

${repoNote}

The commands below require the GitHub CLI \`gh\`. If \`gh\` is unavailable, create the issues manually from these body files.

## Authenticated GitHub Connector Payloads

After explicit maintainer approval, Codex can use an authenticated GitHub connector to create one issue per machine-readable draft:

\`\`\`sh
pnpm testnet:operator-issue-drafts -- --json
\`\`\`

For each \`drafts[]\` entry, use \`repository_full_name\` from the approved repository, plus the entry's \`title\`, \`body\`, and \`labels\`.

## Manual Issue Creation

Use this table when creating issues through the GitHub web UI or another issue tracker:

| Slot | Title | Labels | Body file |
| --- | --- | --- | --- |
${manualRows}

## GitHub CLI Commands

\`\`\`sh
${commandBlock}
\`\`\`

## Roster Tracking Commands

After creating each issue, replace the placeholder with the public issue URL or number and record it on the roster:

\`\`\`sh
${recordCommandBlock}
\`\`\`

After an operator accepts, capture the assignment fields with \`docs/public-testnet-operator-assignment-intake.md\`, then record the accepted slot with \`pnpm testnet:update-roster-slot\`.
`;
}

function fileStemForSlot(slot: string) {
  return slot.replace(/[^a-z0-9_.-]/gi, "-");
}

function isRole(value: string): value is Role {
  return (VALID_ROLES as readonly string[]).includes(value);
}

function isStatus(value: string): value is SlotStatus {
  return (VALID_STATUSES as readonly string[]).includes(value);
}

function isGitHubRepo(value: string) {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const slots = await readRoster(args.roster);
  const drafts = buildIssueDrafts(slots);
  const markdown = renderMarkdown(drafts);

  if (args.json) {
    console.log(JSON.stringify({ schemaVersion: "public-testnet-operator-issue-drafts-v0", roster: args.roster, drafts }, null, 2));
    return;
  }

  if (args.check) {
    const failures: string[] = [];
    await checkOutput(args.out, markdown, failures);
    if (args.bodyDir) await checkIssueBodyFiles(args.bodyDir, drafts, args.githubRepo, failures);
    if (failures.length > 0) {
      throw new Error(`Generated public testnet operator issue files are not up to date:\n- ${failures.join("\n- ")}`);
    }
    console.log("Generated public testnet operator issue files are up to date.");
    return;
  }

  await writeOutput(args.out, markdown);
  if (args.bodyDir) await writeIssueBodyFiles(args.bodyDir, drafts, args.githubRepo);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
