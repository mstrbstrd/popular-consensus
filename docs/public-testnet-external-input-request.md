# Public Testnet External Input Request

The final roadmap item, `Run public testnet with independent operators`, cannot be completed from local readiness alone. Use this sheet to provide the next real-world input without mixing it with rehearsal evidence. In plain terms, this file asks for the outside proof we cannot create from this workspace.

Minimum unblocker: provide either a public repository plus explicit approval to create the eight operator tracking issues, or provide the eight already-created issue URLs. Until one of those happens, outreach, assignments, operator evidence, and the launch summary cannot be recorded as real completion evidence.

## Option 1: Public Repository And Issue Approval

Provide:

```text
Repository: <owner/repo>
Approval: Create the eight public-testnet operator issues.
```

Codex-ready reply:

```text
Repository: <owner/repo>
Approval: I approve creating the eight public-testnet operator issues in <owner/repo>.
```

Codex can only create externally visible public issues after both values are supplied and the action is explicitly approved. If the GitHub CLI is unavailable, Codex may use an authenticated GitHub connector when one is available; otherwise maintainers should create only the still-open issues from `docs/public-testnet-operator-issue-bodies/README.md` and any generated per-slot body files.

## Option 2: Created Issue URLs

Fill `docs/public-testnet-operator-issue-url-intake.md`, then run:

```sh
pnpm testnet:record-issue-urls -- --dry-run
pnpm testnet:record-issue-urls
pnpm testnet:audit-roster
```

## Option 3: Outreach Results

For each real sent message, provide:

```text
Slot:
Candidate:
Pool:
Contact route:
Status:
Tracking issue:
Notes:
```

Record with `pnpm testnet:record-outreach`. If the tracking issue is already on the roster, use `--tracking-issue-from-roster`.

## Option 4: Operator Assignments

For each accepted operator, provide the fields from `docs/public-testnet-operator-assignment-intake.md`, then record with:

```sh
pnpm testnet:update-roster-slot
pnpm testnet:audit-roster
```

## Option 5: Operator Evidence

Place real operator evidence JSON files in:

```text
docs/public-testnet-attestations
```

Then run:

```sh
pnpm testnet:verify-attestations:pending
```

Do not write the final `GO` launch summary until independent operators have published valid evidence files and maintainer independence review is complete.
