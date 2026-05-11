import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const HASHES = {
  transactionStreamHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  eventStreamHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  upgradeSafetyModelHash: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  deploymentHash: "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
};

type Role = "deployer" | "api-indexer" | "replay-verifier" | "community-steward";

type OperatorFixture = {
  id: string;
  role: Role;
  contact: string;
  apiBaseUrl?: string;
};

type ExecFailure = Error & {
  stdout?: string | Buffer;
  stderr?: string | Buffer;
};

async function main() {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "pc-public-testnet-tools-"));
  try {
    const readyFixture = await verifiesReadyLaunch(tempRoot);
    await auditsReviewedRoster(tempRoot, readyFixture);
    await blocksIncompleteActiveRosterSlot(tempRoot);
    await warnsDuplicateTrackingIssues(tempRoot);
    await generatesOperatorIssueDrafts(tempRoot);
    await auditsMvpNextActions(tempRoot);
    await updatesOperatorRosterSlot(tempRoot);
    await recordsIssueUrlsFromIntake(tempRoot);
    await recordsPublicTestnetOutreach(tempRoot);
    await auditsPublicTestnetOutreach(tempRoot);
    await blocksDuplicateOperatorContacts(tempRoot);
    console.log("Public testnet tool smoke tests passed.");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function verifiesReadyLaunch(tempRoot: string) {
  const attestationDir = path.join(tempRoot, "ready-attestations");
  const summaryPath = path.join(tempRoot, "ready-launch-summary.md");
  const operators: OperatorFixture[] = [
    { id: "deployer-1", role: "deployer", contact: "deployer-1@example.invalid" },
    { id: "indexer-1", role: "api-indexer", contact: "indexer-1@example.invalid", apiBaseUrl: "https://indexer-1.example.invalid" },
    { id: "indexer-2", role: "api-indexer", contact: "indexer-2@example.invalid", apiBaseUrl: "https://indexer-2.example.invalid" },
    { id: "replay-1", role: "replay-verifier", contact: "replay-1@example.invalid" },
    { id: "replay-2", role: "replay-verifier", contact: "replay-2@example.invalid" },
    { id: "replay-3", role: "replay-verifier", contact: "replay-3@example.invalid" },
    { id: "steward-1", role: "community-steward", contact: "steward-1@example.invalid" },
    { id: "steward-2", role: "community-steward", contact: "steward-2@example.invalid" }
  ];

  for (const operator of operators) {
    await collectAttestation(attestationDir, operator);
  }

  const summaryOutput = await run("pnpm", [
    "testnet:write-launch-summary",
    "--",
    "--dir",
    attestationDir,
    "--out",
    summaryPath,
    "--decision",
    "GO",
    "--independence-reviewed",
    "--testnet-window",
    "public-testnet-tools-smoke",
    "--force"
  ]);
  assert.match(summaryOutput, /Decision: GO/);
  assert.match(summaryOutput, /Independence review: reviewed/);

  const verifyOutput = await run("pnpm", ["testnet:verify-attestations", "--", "--dir", attestationDir, "--summary", summaryPath]);
  assert.match(verifyOutput, /Public testnet attestation verification: Ready/);
  assert.match(verifyOutput, /Role counts: deployer 1\/1, api-indexer 2\/2, replay-verifier 3\/3, community-steward 2\/2/);

  return { attestationDir, operators };
}

async function auditsReviewedRoster(tempRoot: string, fixture: { attestationDir: string; operators: OperatorFixture[] }) {
  const rosterPath = path.join(tempRoot, "reviewed-roster.md");
  const rows = fixture.operators
    .map((operator) => {
      const slot = slotIdForOperator(operator);
      const attestationFile = path.join(fixture.attestationDir, `${operator.id}.json`);
      return `| ${slot} | issue-${slot} | ${operator.role} | ${operator.id} | ${operator.contact} | Smoke ${operator.role} | reviewed | ${attestationFile} | reviewed | Smoke test reviewed slot. |`;
    })
    .join("\n");

  await writeFile(
    rosterPath,
    `# Reviewed Public Testnet Operator Roster

## Operator Slots

| Slot | Tracking Issue | Role | Assigned Operator | Contact | Organization | Independence Review | Attestation File | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows}

## Status Values

- reviewed
`,
    "utf8"
  );

  const output = await run("pnpm", ["testnet:audit-roster", "--", "--roster", rosterPath]);
  assert.match(output, /Public testnet roster audit: Ready/);
  assert.match(output, /Tracking issues: 8\/8/);
  assert.match(output, /Assigned: deployer 1\/1, api-indexer 2\/2, replay-verifier 3\/3, community-steward 2\/2/);
  assert.match(output, /Reviewed: deployer 1\/1, api-indexer 2\/2, replay-verifier 3\/3, community-steward 2\/2/);
}

async function blocksDuplicateOperatorContacts(tempRoot: string) {
  const attestationDir = path.join(tempRoot, "duplicate-contact-attestations");
  await collectAttestation(attestationDir, { id: "duplicate-replay-1", role: "replay-verifier", contact: "duplicate@example.invalid" });
  await collectAttestation(attestationDir, { id: "duplicate-replay-2", role: "replay-verifier", contact: "duplicate@example.invalid" });

  const output = await run(
    "pnpm",
    [
      "testnet:verify-attestations:pending",
      "--",
      "--dir",
      attestationDir,
      "--summary",
      path.join(tempRoot, "duplicate-launch-summary.md")
    ],
    { expectFailure: true }
  );
  assert.match(output, /Public testnet attestation verification: Blocked/);
  assert.match(output, /operatorContact duplicate@example.invalid appears for multiple operatorIds: duplicate-replay-1, duplicate-replay-2/);
}

async function blocksIncompleteActiveRosterSlot(tempRoot: string) {
  const rosterPath = path.join(tempRoot, "incomplete-active-roster.md");
  await writeFile(
    rosterPath,
    `# Incomplete Active Public Testnet Operator Roster

## Operator Slots

| Slot | Tracking Issue | Role | Assigned Operator | Contact | Organization | Independence Review | Attestation File | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| replay-1 | open | replay-verifier | open | open | open | pending | open | invited | Incomplete active slot. |

## Status Values

- invited
`,
    "utf8"
  );

  const output = await run("pnpm", ["testnet:audit-roster", "--", "--roster", rosterPath], { expectFailure: true });
  assert.match(output, /Public testnet roster audit: Blocked/);
  assert.match(output, /replay-1: invited status requires a tracking issue/);
  assert.match(output, /replay-1: invited status requires an assigned operator/);
  assert.match(output, /replay-1: invited status requires an operator contact/);
}

async function warnsDuplicateTrackingIssues(tempRoot: string) {
  const rosterPath = path.join(tempRoot, "duplicate-tracking-issue-roster.md");
  const rows = [
    "| deployer-1 | issue-duplicate | deployer | open | open | open | pending | open | unassigned | Open slot. |",
    "| indexer-1 | issue-duplicate | api-indexer | open | open | open | pending | open | unassigned | Open slot. |",
    "| indexer-2 | open | api-indexer | open | open | open | pending | open | unassigned | Open slot. |",
    "| replay-1 | open | replay-verifier | open | open | open | pending | open | unassigned | Open slot. |",
    "| replay-2 | open | replay-verifier | open | open | open | pending | open | unassigned | Open slot. |",
    "| replay-3 | open | replay-verifier | open | open | open | pending | open | unassigned | Open slot. |",
    "| steward-1 | open | community-steward | open | open | open | pending | open | unassigned | Open slot. |",
    "| steward-2 | open | community-steward | open | open | open | pending | open | unassigned | Open slot. |"
  ].join("\n");

  await writeFile(
    rosterPath,
    `# Duplicate Tracking Issue Public Testnet Operator Roster

## Operator Slots

| Slot | Tracking Issue | Role | Assigned Operator | Contact | Organization | Independence Review | Attestation File | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows}

## Status Values

- unassigned
`,
    "utf8"
  );

  const output = await run("pnpm", ["testnet:audit-roster", "--", "--roster", rosterPath]);
  assert.match(output, /Public testnet roster audit: Pending/);
  assert.match(output, /Tracking issues: 2\/8/);
  assert.match(output, /tracking issue issue-duplicate appears in multiple slots: deployer-1, indexer-1/);
}

async function generatesOperatorIssueDrafts(tempRoot: string) {
  const rosterPath = path.join(tempRoot, "issue-draft-roster.md");
  const draftPath = path.join(tempRoot, "operator-issue-drafts.md");
  await writeFile(
    rosterPath,
    `# Issue Draft Public Testnet Operator Roster

## Operator Slots

| Slot | Tracking Issue | Role | Assigned Operator | Contact | Organization | Independence Review | Attestation File | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| deployer-1 | open | deployer | open | open | open | pending | open | unassigned | Publishes deployment hash and chain details. |
| indexer-1 | open | api-indexer | open | open | open | pending | open | unassigned | Runs first public API/indexer endpoint. |
| steward-1 | https://github.com/example/popular-consensus/issues/8 | community-steward | open | open | open | pending | open | unassigned | Tracking issue already exists and should not be drafted again. |
| replay-1 | issue-replay-1 | replay-verifier | replay-one | replay-one@example.invalid | Independent individual | pending | open | accepted | Already accepted and should not be drafted. |

## Status Values

- unassigned
- accepted
`,
    "utf8"
  );

  const output = await run("pnpm", ["testnet:operator-issue-drafts", "--", "--roster", rosterPath, "--out", draftPath]);
  assert.match(output, new RegExp(`Wrote ${escapeRegExp(draftPath)}`));

  const drafts = await readFile(draftPath, "utf8");
  assert.match(drafts, /# Public Testnet Operator Issue Drafts/);
  assert.match(drafts, /````markdown/);
  assert.match(drafts, /manual issue creation when the GitHub CLI `gh` is unavailable/);
  assert.match(drafts, /machine-readable issue drafts for authenticated GitHub connector usage/);
  assert.match(drafts, /--github-repo <owner\/repo>/);
  assert.match(drafts, /\[Public testnet operator\]: deployer-1 deployer/);
  assert.match(drafts, /--deployment-hash sha256:needs-deployment-hash/);
  assert.match(drafts, /\[Public testnet operator\]: indexer-1 api-indexer/);
  assert.match(drafts, /--api-base-url needs-api-base-url/);
  assert.doesNotMatch(drafts, /\[Public testnet operator\]: steward-1 community-steward/);
  assert.doesNotMatch(drafts, /\[Public testnet operator\]: replay-1 replay-verifier/);

  const jsonOutput = await run("pnpm", ["testnet:operator-issue-drafts", "--", "--roster", rosterPath, "--json"]);
  const parsed = parseJsonObject(jsonOutput) as { schemaVersion: string; drafts: Array<{ slot: string; labels: string[] }> };
  assert.equal(parsed.schemaVersion, "public-testnet-operator-issue-drafts-v0");
  assert.deepEqual(parsed.drafts.map((draft) => draft.slot), ["deployer-1", "indexer-1"]);
  assert.deepEqual(parsed.drafts[0]?.labels, ["public-testnet", "operator"]);

  const bodyDir = path.join(tempRoot, "issue-bodies");
  const bodyOutput = await run("pnpm", ["testnet:operator-issue-drafts", "--", "--roster", rosterPath, "--out", "-", "--body-dir", bodyDir]);
  assert.match(bodyOutput, /Wrote 2 issue body files/);
  const deployerBody = await readFile(path.join(bodyDir, "deployer-1.md"), "utf8");
  const indexerBody = await readFile(path.join(bodyDir, "indexer-1.md"), "utf8");
  const bodyReadme = await readFile(path.join(bodyDir, "README.md"), "utf8");
  assert.match(deployerBody, /--deployment-hash sha256:needs-deployment-hash/);
  assert.match(indexerBody, /--api-base-url needs-api-base-url/);
  assert.match(bodyReadme, /gh issue create --title "\[Public testnet operator\]: deployer-1 deployer"/);
  assert.match(bodyReadme, /--github-repo <owner\/repo>/);
  assert.match(bodyReadme, /The commands below require the GitHub CLI `gh`/);
  assert.match(bodyReadme, /## Authenticated GitHub Connector Payloads/);
  assert.match(bodyReadme, /repository_full_name/);
  assert.match(bodyReadme, /## Manual Issue Creation/);
  assert.match(bodyReadme, /\| deployer-1 \| \[Public testnet operator\]: deployer-1 deployer \| public-testnet, operator \| .*deployer-1\.md \|/);
  assert.match(bodyReadme, /## Roster Tracking Commands/);
  assert.match(bodyReadme, /pnpm testnet:update-roster-slot -- --slot deployer-1 --tracking-issue <deployer-1-issue-url-or-number>/);
  assert.match(bodyReadme, /docs\/public-testnet-operator-assignment-intake\.md/);

  const checkOutput = await run("pnpm", ["testnet:operator-issue-drafts", "--", "--roster", rosterPath, "--out", draftPath, "--body-dir", bodyDir, "--check"]);
  assert.match(checkOutput, /Generated public testnet operator issue files are up to date\./);

  const trackedRosterPath = path.join(tempRoot, "tracked-issue-roster.md");
  const trackedDraftPath = path.join(tempRoot, "tracked-issue-drafts.md");
  const trackedBodyDir = path.join(tempRoot, "tracked-issue-bodies");
  await writeFile(
    trackedRosterPath,
    `# Tracked Issue Public Testnet Operator Roster

## Operator Slots

| Slot | Tracking Issue | Role | Assigned Operator | Contact | Organization | Independence Review | Attestation File | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| deployer-1 | https://github.com/example/popular-consensus/issues/1 | deployer | open | open | open | pending | open | unassigned | Issue exists. |
| indexer-1 | https://github.com/example/popular-consensus/issues/2 | api-indexer | open | open | open | pending | open | unassigned | Issue exists. |

## Status Values

- unassigned
`,
    "utf8"
  );

  const trackedOutput = await run("pnpm", [
    "testnet:operator-issue-drafts",
    "--",
    "--roster",
    trackedRosterPath,
    "--out",
    trackedDraftPath,
    "--body-dir",
    trackedBodyDir
  ]);
  assert.match(trackedOutput, /Wrote 0 issue body files/);
  const trackedDrafts = await readFile(trackedDraftPath, "utf8");
  const trackedReadme = await readFile(path.join(trackedBodyDir, "README.md"), "utf8");
  assert.match(trackedDrafts, /No unassigned operator slots with `Tracking Issue` set to `open` need new issue drafts\./);
  assert.match(trackedReadme, /No slots currently need new tracking issues\./);
  assert.match(trackedReadme, /No gh issue create commands are needed/);
  assert.match(trackedReadme, /No roster tracking commands are needed/);

  const trackedJsonOutput = await run("pnpm", ["testnet:operator-issue-drafts", "--", "--roster", trackedRosterPath, "--json"]);
  const trackedParsed = parseJsonObject(trackedJsonOutput) as { drafts: Array<{ slot: string }> };
  assert.deepEqual(trackedParsed.drafts, []);

  const extraBodyPath = path.join(bodyDir, "old-slot.md");
  await writeFile(extraBodyPath, "stale", "utf8");
  const extraOutput = await run("pnpm", ["testnet:operator-issue-drafts", "--", "--roster", rosterPath, "--out", draftPath, "--body-dir", bodyDir, "--check"], {
    expectFailure: true
  });
  assert.match(extraOutput, /old-slot\.md: extra/);
  await rm(extraBodyPath);

  await writeFile(path.join(bodyDir, "deployer-1.md"), "stale", "utf8");
  const staleOutput = await run("pnpm", ["testnet:operator-issue-drafts", "--", "--roster", rosterPath, "--out", draftPath, "--body-dir", bodyDir, "--check"], {
    expectFailure: true
  });
  assert.match(staleOutput, /Generated public testnet operator issue files are not up to date:/);
  assert.match(staleOutput, /deployer-1\.md: stale/);

  const pruneBodyDir = path.join(tempRoot, "issue-bodies-prune");
  await mkdir(pruneBodyDir, { recursive: true });
  const staleBodyPath = path.join(pruneBodyDir, "old-slot.md");
  await writeFile(staleBodyPath, "stale", "utf8");
  const pruneOutput = await run("pnpm", ["testnet:operator-issue-drafts", "--", "--roster", rosterPath, "--out", "-", "--body-dir", pruneBodyDir]);
  assert.match(pruneOutput, /Wrote 2 issue body files/);
  await assert.rejects(readFile(staleBodyPath, "utf8"));

  const explicitRepoBodyDir = path.join(tempRoot, "issue-bodies-explicit-repo");
  const explicitRepoOutput = await run("pnpm", ["testnet:operator-issue-drafts", "--", "--roster", rosterPath, "--out", "-", "--body-dir", explicitRepoBodyDir, "--github-repo", "example/popular-consensus"]);
  assert.match(explicitRepoOutput, /Wrote 2 issue body files/);
  const explicitRepoReadme = await readFile(path.join(explicitRepoBodyDir, "README.md"), "utf8");
  assert.match(explicitRepoReadme, /These commands target `example\/popular-consensus` explicitly\./);
  assert.match(explicitRepoReadme, /gh issue create --repo example\/popular-consensus --title "\[Public testnet operator\]: deployer-1 deployer"/);

  const invalidRepoOutput = await run(
    "pnpm",
    ["testnet:operator-issue-drafts", "--", "--roster", rosterPath, "--body-dir", bodyDir, "--github-repo", "not-a-repo"],
    { expectFailure: true }
  );
  assert.match(invalidRepoOutput, /--github-repo must use owner\/repo format/);
}

async function auditsMvpNextActions(tempRoot: string) {
  const fixtureRoot = path.join(tempRoot, "mvp-audit-next-actions");
  const roadmapPath = path.join(fixtureRoot, "roadmap.md");
  const rosterPath = path.join(fixtureRoot, "operator-roster.md");
  const outreachLogPath = path.join(fixtureRoot, "operator-outreach-log.md");
  const attestationDir = path.join(fixtureRoot, "attestations");
  const launchSummaryPath = path.join(fixtureRoot, "launch-summary.md");

  await mkdir(attestationDir, { recursive: true });
  await writeFile(
    roadmapPath,
    `# Fixture Roadmap

## Easiest To Hardest

### 9. Full Protocol/Appchain As Source Of Truth

- \`[ ]\` Run public testnet with independent operators.
`,
    "utf8"
  );

  const rows = [
    "| deployer-1 | open | deployer | open | open | open | pending | open | unassigned | Publishes deployment hash and chain details. |",
    "| indexer-1 | open | api-indexer | open | open | open | pending | open | unassigned | Runs first public API/indexer endpoint. |",
    "| indexer-2 | open | api-indexer | open | open | open | pending | open | unassigned | Runs second independent public API/indexer endpoint. |",
    "| replay-1 | open | replay-verifier | open | open | open | pending | open | unassigned | Verifies transaction and event stream hashes. |",
    "| replay-2 | open | replay-verifier | open | open | open | pending | open | unassigned | Verifies transaction and event stream hashes. |",
    "| replay-3 | open | replay-verifier | open | open | open | pending | open | unassigned | Verifies transaction and event stream hashes. |",
    "| steward-1 | open | community-steward | open | open | open | pending | open | unassigned | Runs governance and safety drills. |",
    "| steward-2 | open | community-steward | open | open | open | pending | open | unassigned | Runs governance and safety drills. |"
  ].join("\n");

  await writeFile(
    rosterPath,
    `# Fixture Public Testnet Operator Roster

## Operator Slots

| Slot | Tracking Issue | Role | Assigned Operator | Contact | Organization | Independence Review | Attestation File | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows}
`,
    "utf8"
  );

  await writeFile(
    outreachLogPath,
    `# Fixture Public Testnet Operator Outreach Log

## Outreach Entries

| Candidate | Pool | Candidate Contact | Target Slot | Role | Status | Last Contact | Tracking Issue | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dappnode partner route | Home-node and decentralization communities | https://dappnode.com/en-us/pages/contact | deployer-1 | deployer | candidate | open | open | Candidate route identified. |
| Dappnode app-store route | Home-node and decentralization communities | https://dappnode.com/ | indexer-1 | api-indexer | candidate | open | open | Candidate route identified. |
| Open Source Collective route | Open-source fiscal-hosted projects | https://oscollective.org/ | indexer-2 | api-indexer | candidate | open | open | Candidate route identified. |
| EthStaker route | Ethereum solo-staker communities | https://ethstaker.org/ | replay-1 | replay-verifier | candidate | open | open | Candidate route identified. |
| Open Collective directory route | Open-source/public-goods collectives | https://opencollective.com/search?hostname=opencollective.com | replay-2 | replay-verifier | candidate | open | open | Candidate route identified. |
| EthStaker allied route | Ethereum solo-staker communities | https://ethstaker.org/ | replay-3 | replay-verifier | candidate | open | open | Candidate route identified. |
| Open Fresno route | Local civic-tech volunteer groups | https://openfresno.org/ | steward-1 | community-steward | candidate | open | open | Candidate route identified. |
| SF Civic Tech route | Local civic-tech volunteer groups | https://www.sfcivictech.org/ | steward-2 | community-steward | candidate | open | open | Candidate route identified. |
`,
    "utf8"
  );

  const output = await run("pnpm", [
    "mvp:audit",
    "--",
    "--roadmap",
    roadmapPath,
    "--attestation-dir",
    attestationDir,
    "--launch-summary",
    launchSummaryPath,
    "--roster",
    rosterPath,
    "--outreach-log",
    outreachLogPath,
    "--json"
  ]);
  const parsed = parseJsonObject(output) as {
    status: string;
    nextActions: string[];
    publicTestnetOutreach: { identifiedSlots: { actual: number; required: number }; contactedSlots: { actual: number; required: number } };
    publicTestnetRoster: { trackingIssueSlots: { actual: number; required: number } };
  };
  assert.equal(parsed.status, "Pending");
  assert.deepEqual(parsed.publicTestnetOutreach.identifiedSlots, { actual: 8, required: 8 });
  assert.deepEqual(parsed.publicTestnetOutreach.contactedSlots, { actual: 0, required: 8 });
  assert.deepEqual(parsed.publicTestnetRoster.trackingIssueSlots, { actual: 0, required: 8 });
  assert.ok(
    parsed.nextActions.some((action) => action.includes("docs/public-testnet-maintainer-checklist.md")),
    "MVP audit should route maintainers through the public testnet checklist"
  );
  assert.ok(
    parsed.nextActions.some((action) => action.includes("creating issues manually from the body files when gh is unavailable")),
    "MVP audit should include the manual issue-creation fallback"
  );
  assert.ok(
    parsed.nextActions.some((action) => action.includes("using an authenticated GitHub connector after explicit approval when available")),
    "MVP audit should include the authenticated GitHub connector fallback"
  );
  assert.ok(
    parsed.nextActions.some(
      (action) =>
        action.includes("docs/public-testnet-operator-issue-url-intake.md") &&
        action.includes("pnpm testnet:record-issue-urls -- --dry-run") &&
        action.includes("pnpm testnet:record-issue-urls")
    ),
    "MVP audit should tell maintainers to validate and record created issue URLs from the intake sheet"
  );
  assert.ok(
    parsed.nextActions.some((action) => action.includes("pnpm testnet:record-outreach -- --tracking-issue-from-roster")),
    "MVP audit should tell maintainers to reuse roster tracking issues when recording outreach"
  );
}

async function updatesOperatorRosterSlot(tempRoot: string) {
  const rosterPath = path.join(tempRoot, "updatable-roster.md");
  const rows = [
    "| deployer-1 | open | deployer | open | open | open | pending | open | unassigned | Publishes deployment hash and chain details. |",
    "| indexer-1 | open | api-indexer | open | open | open | pending | open | unassigned | Runs first public API/indexer endpoint. |",
    "| indexer-2 | open | api-indexer | open | open | open | pending | open | unassigned | Runs second independent public API/indexer endpoint. |",
    "| replay-1 | open | replay-verifier | open | open | open | pending | open | unassigned | Verifies transaction and event stream hashes. |",
    "| replay-2 | open | replay-verifier | open | open | open | pending | open | unassigned | Verifies transaction and event stream hashes. |",
    "| replay-3 | open | replay-verifier | open | open | open | pending | open | unassigned | Verifies transaction and event stream hashes. |",
    "| steward-1 | open | community-steward | open | open | open | pending | open | unassigned | Runs governance and safety drills. |",
    "| steward-2 | open | community-steward | open | open | open | pending | open | unassigned | Runs governance and safety drills. |"
  ].join("\n");

  await writeFile(
    rosterPath,
    `# Updatable Public Testnet Operator Roster

## Operator Slots

| Slot | Tracking Issue | Role | Assigned Operator | Contact | Organization | Independence Review | Attestation File | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows}

## Status Values

- unassigned
- invited
`,
    "utf8"
  );

  const output = await run("pnpm", [
    "testnet:update-roster-slot",
    "--",
    "--roster",
    rosterPath,
    "--slot",
    "deployer-1",
    "--tracking-issue",
    "issue-deployer-1",
    "--operator-id",
    "alice-deployer",
    "--contact",
    "did:key:alice-deployer",
    "--organization",
    "Independent individual",
    "--status",
    "invited",
    "--notes",
    "Invitation sent."
  ]);
  assert.match(output, /Updated deployer-1/);
  assert.match(output, /Status: unassigned -> invited/);

  const roster = await readFile(rosterPath, "utf8");
  assert.match(roster, /\| deployer-1 \| issue-deployer-1 \| deployer \| alice-deployer \| did:key:alice-deployer \| Independent individual \| pending \| open \| invited \| Invitation sent\. \|/);

  const auditOutput = await run("pnpm", ["testnet:audit-roster", "--", "--roster", rosterPath]);
  assert.match(auditOutput, /Public testnet roster audit: Pending/);
  assert.match(auditOutput, /Assigned: deployer 1\/1, api-indexer 0\/2, replay-verifier 0\/3, community-steward 0\/2/);

  const incompleteOutput = await run(
    "pnpm",
    ["testnet:update-roster-slot", "--", "--roster", rosterPath, "--slot", "indexer-1", "--status", "invited"],
    { expectFailure: true }
  );
  assert.match(incompleteOutput, /indexer-1: invited status requires a tracking issue/);
  assert.match(incompleteOutput, /ELIFECYCLE/);

  const unsafeCellOutput = await run(
    "pnpm",
    ["testnet:update-roster-slot", "--", "--roster", rosterPath, "--slot", "indexer-1", "--notes", "contains | pipe"],
    { expectFailure: true }
  );
  assert.match(unsafeCellOutput, /--notes cannot contain a markdown table pipe character/);
}

async function recordsIssueUrlsFromIntake(tempRoot: string) {
  const rosterPath = path.join(tempRoot, "issue-url-intake-roster.md");
  const intakePath = path.join(tempRoot, "issue-url-intake.md");
  await writeFile(
    rosterPath,
    `# Issue URL Intake Public Testnet Operator Roster

## Operator Slots

| Slot | Tracking Issue | Role | Assigned Operator | Contact | Organization | Independence Review | Attestation File | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| deployer-1 | open | deployer | open | open | open | pending | open | unassigned | Publishes deployment hash and chain details. |
| indexer-1 | open | api-indexer | open | open | open | pending | open | unassigned | Runs first public API/indexer endpoint. |

## Status Values

- unassigned
`,
    "utf8"
  );

  await writeFile(
    intakePath,
    `# Issue URL Intake

## Issue URLs

| Slot | Role | Tracking Issue URL Or Number |
| --- | --- | --- |
| deployer-1 | deployer | https://github.example.invalid/popular-consensus/issues/1 |
| indexer-1 | api-indexer | open |
`,
    "utf8"
  );

  const dryRunOutput = await run("pnpm", ["testnet:record-issue-urls", "--", "--intake", intakePath, "--roster", rosterPath, "--dry-run"]);
  assert.match(dryRunOutput, /Would record 1 tracking issue URL\(s\)/);
  assert.match(dryRunOutput, /Slots: deployer-1/);

  const dryRunRoster = await readFile(rosterPath, "utf8");
  assert.match(dryRunRoster, /\| deployer-1 \| open \| deployer \| open \| open \| open \| pending \| open \| unassigned \| Publishes deployment hash and chain details\. \|/);

  const output = await run("pnpm", ["testnet:record-issue-urls", "--", "--intake", intakePath, "--roster", rosterPath]);
  assert.match(output, /Recorded 1 tracking issue URL\(s\)/);
  assert.match(output, /Slots: deployer-1/);

  const roster = await readFile(rosterPath, "utf8");
  assert.match(roster, /\| deployer-1 \| https:\/\/github\.example\.invalid\/popular-consensus\/issues\/1 \| deployer \| open \| open \| open \| pending \| open \| unassigned \| Publishes deployment hash and chain details\. \|/);
  assert.match(roster, /\| indexer-1 \| open \| api-indexer \| open \| open \| open \| pending \| open \| unassigned \| Runs first public API\/indexer endpoint\. \|/);

  await writeFile(
    intakePath,
    `# Bad Issue URL Intake

## Issue URLs

| Slot | Role | Tracking Issue URL Or Number |
| --- | --- | --- |
| indexer-1 | replay-verifier | https://github.example.invalid/popular-consensus/issues/2 |
`,
    "utf8"
  );

  const mismatchOutput = await run("pnpm", ["testnet:record-issue-urls", "--", "--intake", intakePath, "--roster", rosterPath], {
    expectFailure: true
  });
  assert.match(mismatchOutput, /indexer-1: intake role replay-verifier does not match roster role api-indexer/);
}

async function recordsPublicTestnetOutreach(tempRoot: string) {
  const rosterPath = path.join(tempRoot, "outreach-roster.md");
  const logPath = path.join(tempRoot, "outreach-log.md");
  const rows = [
    "| deployer-1 | open | deployer | open | open | open | pending | open | unassigned | Publishes deployment hash and chain details. |",
    "| indexer-1 | https://github.example.invalid/popular-consensus/issues/2 | api-indexer | open | open | open | pending | open | unassigned | Runs first public API/indexer endpoint. |",
    "| replay-1 | open | replay-verifier | open | open | open | pending | open | unassigned | Runs replay verification. |"
  ].join("\n");

  await writeFile(
    rosterPath,
    `# Outreach Test Roster

## Operator Slots

| Slot | Tracking Issue | Role | Assigned Operator | Contact | Organization | Independence Review | Attestation File | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows}
`,
    "utf8"
  );

  await writeFile(
    logPath,
    `# Outreach Test Log

## Outreach Entries

| Candidate | Pool | Candidate Contact | Target Slot | Role | Status | Last Contact | Tracking Issue | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| open | open | open | deployer-1 | deployer | candidate | open | open | First slot to fill. |
| open | open | open | indexer-1 | api-indexer | candidate | open | open | First indexer. |
| open | open | open | replay-1 | replay-verifier | candidate | open | open | First replay verifier. |
`,
    "utf8"
  );

  const output = await run("pnpm", [
    "testnet:record-outreach",
    "--",
    "--log",
    logPath,
    "--roster",
    rosterPath,
    "--candidate",
    "Dappnode partner route",
    "--pool",
    "Home-node and decentralization communities",
    "--contact",
    "https://dappnode.com/en-us/pages/contact",
    "--slot",
    "deployer-1",
    "--status",
    "contacted",
    "--last-contact",
    "2026-05-09",
    "--tracking-issue",
    "https://github.example.invalid/popular-consensus/issues/1",
    "--notes",
    "Sent deployer packet."
  ]);
  assert.match(output, /Recorded outreach for deployer-1/);
  assert.match(output, /Mode: replaced-open-slot/);
  assert.match(output, /Status: contacted/);

  const log = await readFile(logPath, "utf8");
  assert.match(
    log,
    /\| Dappnode partner route \| Home-node and decentralization communities \| https:\/\/dappnode\.com\/en-us\/pages\/contact \| deployer-1 \| deployer \| contacted \| 2026-05-09 \| https:\/\/github\.example\.invalid\/popular-consensus\/issues\/1 \| Sent deployer packet\. \|/
  );
  assert.match(log, /\| open \| open \| open \| indexer-1 \| api-indexer \| candidate \| open \| open \| First indexer\. \|/);

  const fromRosterOutput = await run("pnpm", [
    "testnet:record-outreach",
    "--",
    "--log",
    logPath,
    "--roster",
    rosterPath,
    "--candidate",
    "Dappnode app-store route",
    "--pool",
    "Home-node and decentralization communities",
    "--contact",
    "https://dappnode.com/",
    "--slot",
    "indexer-1",
    "--status",
    "contacted",
    "--last-contact",
    "2026-05-09",
    "--tracking-issue-from-roster",
    "--notes",
    "Sent indexer packet."
  ]);
  assert.match(fromRosterOutput, /Recorded outreach for indexer-1/);

  const logWithRosterIssue = await readFile(logPath, "utf8");
  assert.match(
    logWithRosterIssue,
    /\| Dappnode app-store route \| Home-node and decentralization communities \| https:\/\/dappnode\.com\/ \| indexer-1 \| api-indexer \| contacted \| 2026-05-09 \| https:\/\/github\.example\.invalid\/popular-consensus\/issues\/2 \| Sent indexer packet\. \|/
  );

  const roleMismatchOutput = await run(
    "pnpm",
    [
      "testnet:record-outreach",
      "--",
      "--log",
      logPath,
      "--roster",
      rosterPath,
      "--candidate",
      "Wrong role route",
      "--pool",
      "Home-node and decentralization communities",
      "--contact",
      "https://example.invalid",
      "--slot",
      "deployer-1",
      "--role",
      "api-indexer",
      "--status",
      "candidate",
      "--notes",
      "Should fail."
    ],
    { expectFailure: true }
  );
  assert.match(roleMismatchOutput, /deployer-1: role api-indexer does not match roster role deployer/);

  const missingIssueOutput = await run(
    "pnpm",
    [
      "testnet:record-outreach",
      "--",
      "--log",
      logPath,
      "--roster",
      rosterPath,
      "--candidate",
      "Dappnode route",
      "--pool",
      "Home-node and decentralization communities",
      "--contact",
      "https://example.invalid",
      "--slot",
      "replay-1",
      "--status",
      "contacted",
      "--notes",
      "Sent without issue."
    ],
    { expectFailure: true }
  );
  assert.match(missingIssueOutput, /contacted outreach requires a tracking issue/);

  const openRosterIssueOutput = await run(
    "pnpm",
    [
      "testnet:record-outreach",
      "--",
      "--log",
      logPath,
      "--roster",
      rosterPath,
      "--candidate",
      "Replay route",
      "--pool",
      "Ethereum solo-staker communities",
      "--contact",
      "https://example.invalid/replay",
      "--slot",
      "replay-1",
      "--status",
      "contacted",
      "--tracking-issue-from-roster",
      "--notes",
      "Should fail until issue URL is recorded."
    ],
    { expectFailure: true }
  );
  assert.match(openRosterIssueOutput, /replay-1: roster tracking issue is open/);

  const unsafeCellOutput = await run(
    "pnpm",
    [
      "testnet:record-outreach",
      "--",
      "--log",
      logPath,
      "--roster",
      rosterPath,
      "--candidate",
      "Unsafe route",
      "--pool",
      "Home-node and decentralization communities",
      "--contact",
      "https://example.invalid",
      "--slot",
      "indexer-1",
      "--status",
      "contacted",
      "--notes",
      "contains | pipe"
    ],
    { expectFailure: true }
  );
  assert.match(unsafeCellOutput, /--notes cannot contain a markdown table pipe character/);
}

async function auditsPublicTestnetOutreach(tempRoot: string) {
  const rosterPath = path.join(tempRoot, "auditable-outreach-roster.md");
  const logPath = path.join(tempRoot, "auditable-outreach-log.md");

  await writeFile(
    rosterPath,
    `# Auditable Outreach Test Roster

## Operator Slots

| Slot | Tracking Issue | Role | Assigned Operator | Contact | Organization | Independence Review | Attestation File | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| deployer-1 | issue-deployer-1 | deployer | deployer-one | deployer-one@example.invalid | Independent individual | pending | open | accepted | Accepted deployer. |
| indexer-1 | issue-indexer-1 | api-indexer | open | open | open | pending | open | unassigned | Open indexer. |
`,
    "utf8"
  );

  await writeFile(
    logPath,
    `# Auditable Outreach Test Log

## Outreach Entries

| Candidate | Pool | Candidate Contact | Target Slot | Role | Status | Last Contact | Tracking Issue | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dappnode partner route | Home-node and decentralization communities | https://dappnode.com/en-us/pages/contact | deployer-1 | deployer | contacted | 2026-05-09 | issue-deployer-1 | Sent deployer packet. |
| Open-source maintainer route | Open-source/public-goods collectives | https://example.invalid/indexer | indexer-1 | api-indexer | interested | 2026-05-09 | issue-indexer-1 | Candidate is checking capacity. |
`,
    "utf8"
  );

  const output = await run("pnpm", ["testnet:audit-outreach", "--", "--log", logPath, "--roster", rosterPath]);
  assert.match(output, /Public testnet outreach audit: Ready/);
  assert.match(output, /Contacted slots: 2\/2/);

  const jsonOutput = await run("pnpm", ["testnet:audit-outreach", "--", "--log", logPath, "--roster", rosterPath, "--json"]);
  const parsed = parseJsonObject(jsonOutput) as {
    schemaVersion: string;
    status: string;
    identifiedSlots: { actual: number; required: number };
    contactedSlots: { actual: number; required: number };
  };
  assert.equal(parsed.schemaVersion, "public-testnet-outreach-audit-v0");
  assert.equal(parsed.status, "Ready");
  assert.deepEqual(parsed.identifiedSlots, { actual: 2, required: 2 });
  assert.deepEqual(parsed.contactedSlots, { actual: 2, required: 2 });

  await writeFile(
    logPath,
    `# Blocked Outreach Test Log

## Outreach Entries

| Candidate | Pool | Candidate Contact | Target Slot | Role | Status | Last Contact | Tracking Issue | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Wrong role route | Home-node and decentralization communities | https://example.invalid | deployer-1 | api-indexer | contacted | 2026-05-09 | issue-deployer-1 | Wrong role. |
`,
    "utf8"
  );

  const mismatchOutput = await run("pnpm", ["testnet:audit-outreach", "--", "--log", logPath, "--roster", rosterPath], { expectFailure: true });
  assert.match(mismatchOutput, /Public testnet outreach audit: Blocked/);
  assert.match(mismatchOutput, /deployer-1: outreach role api-indexer does not match roster role deployer/);

  await writeFile(
    logPath,
    `# Mismatched Tracking Issue Outreach Test Log

## Outreach Entries

| Candidate | Pool | Candidate Contact | Target Slot | Role | Status | Last Contact | Tracking Issue | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dappnode partner route | Home-node and decentralization communities | https://dappnode.com/en-us/pages/contact | deployer-1 | deployer | contacted | 2026-05-09 | issue-wrong | Wrong issue. |
`,
    "utf8"
  );

  const mismatchIssueOutput = await run("pnpm", ["testnet:audit-outreach", "--", "--log", logPath, "--roster", rosterPath], { expectFailure: true });
  assert.match(mismatchIssueOutput, /Public testnet outreach audit: Blocked/);
  assert.match(mismatchIssueOutput, /deployer-1: outreach tracking issue issue-wrong does not match roster tracking issue issue-deployer-1/);

  await writeFile(
    logPath,
    `# Missing Tracking Issue Outreach Test Log

## Outreach Entries

| Candidate | Pool | Candidate Contact | Target Slot | Role | Status | Last Contact | Tracking Issue | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dappnode partner route | Home-node and decentralization communities | https://dappnode.com/en-us/pages/contact | deployer-1 | deployer | contacted | 2026-05-09 | open | Sent without issue. |
`,
    "utf8"
  );

  const missingIssueOutput = await run("pnpm", ["testnet:audit-outreach", "--", "--log", logPath, "--roster", rosterPath], { expectFailure: true });
  assert.match(missingIssueOutput, /Public testnet outreach audit: Blocked/);
  assert.match(missingIssueOutput, /deployer-1: contacted outreach requires a tracking issue/);
}

async function collectAttestation(attestationDir: string, operator: OperatorFixture) {
  const args = [
    "testnet:collect-attestation",
    "--",
    "--operator-id",
    operator.id,
    "--operator-contact",
    operator.contact,
    "--independence-statement",
    `Smoke test fixture for ${operator.id}; real launches require maintainer-reviewed independence.`,
    "--operator-organization",
    `Smoke ${operator.role}`,
    "--role",
    operator.role,
    "--git-commit",
    "smoke-test-commit",
    "--chain-id",
    "pc-public-testnet-smoke",
    "--rpc-url",
    "https://rpc.example.invalid",
    "--transaction-stream-hash",
    HASHES.transactionStreamHash,
    "--event-stream-hash",
    HASHES.eventStreamHash,
    "--upgrade-safety-model-hash",
    HASHES.upgradeSafetyModelHash,
    "--checks-preset",
    operator.role === "community-steward" ? "complete" : "required",
    "--attested-at",
    "2026-05-09T00:00:00.000Z",
    "--out",
    path.join(attestationDir, `${operator.id}.json`)
  ];

  if (operator.role === "deployer") args.push("--deployment-hash", HASHES.deploymentHash);
  if (operator.apiBaseUrl) args.push("--api-base-url", operator.apiBaseUrl);

  const output = await run("pnpm", args);
  assert.match(output, new RegExp(`Operator: ${operator.id} \\(${operator.role}\\)`));
}

function slotIdForOperator(operator: OperatorFixture) {
  if (operator.role === "deployer") return "deployer-1";
  return operator.id.replace("indexer-", "indexer-").replace("replay-", "replay-").replace("steward-", "steward-");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseJsonObject(output: string) {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error(`Output does not contain a JSON object:\n${output}`);
  return JSON.parse(output.slice(start, end + 1)) as unknown;
}

async function run(command: string, args: string[], options: { expectFailure?: boolean } = {}) {
  try {
    const result = await execFileAsync(command, args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 10
    });
    const output = `${toText(result.stdout)}${toText(result.stderr)}`;
    if (options.expectFailure) throw new Error(`Expected command to fail: ${command} ${args.join(" ")}\n${output}`);
    return output;
  } catch (error) {
    const failure = error as ExecFailure;
    const output = `${toText(failure.stdout)}${toText(failure.stderr)}`;
    if (options.expectFailure) return output;
    throw new Error(`Command failed: ${command} ${args.join(" ")}\n${output}`);
  }
}

function toText(value: string | Buffer | undefined) {
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  return value ?? "";
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
