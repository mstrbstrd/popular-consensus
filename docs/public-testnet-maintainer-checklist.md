# Public Testnet Maintainer Checklist

Use this checklist to move the final roadmap item, "Run public testnet with independent operators," from local readiness to real completion evidence. In plain terms: this is how maintainers prove that people outside the core workspace ran the system and checked the same public record.

This file is not completion evidence. The gate remains open until independent operators publish valid evidence JSON files, maintainers record independence review, `docs/public-testnet-launch-summary.md` says `Decision: GO`, and `pnpm mvp:audit` reports `Ready`.

If handing this work to another maintainer or back to Codex, use `docs/public-testnet-external-input-request.md` for the exact external inputs needed next.

## 1. Create Public Operator Issues

Pick the public GitHub repository operators should use for tracking.

If asking Codex to create the public issues, provide the repository as `owner/repo` and explicitly approve issue creation. Without that target and approval, keep this step local and use the generated commands as a maintainer handoff.

The generated issue commands require the GitHub CLI `gh`. If `gh` is unavailable, Codex can use an authenticated GitHub connector after the repository and explicit issue-creation approval are supplied; otherwise create the issues manually from the table and body files in `docs/public-testnet-operator-issue-bodies`.

For authenticated GitHub connector creation after explicit approval:

1. Run `pnpm testnet:operator-issue-drafts -- --json`.
2. For each `drafts[]` entry, call the connector issue-create action with `repository_full_name` set to the approved repository, plus the entry's `title`, `body`, and `labels`.
3. Copy each returned public issue URL into `docs/public-testnet-operator-issue-url-intake.md`.
4. Validate the intake rows with `pnpm testnet:record-issue-urls -- --dry-run`, then record them with `pnpm testnet:record-issue-urls`.

If this workspace has a Git remote or GitHub default repository, regenerate the issue body files with:

```sh
pnpm testnet:operator-issue-drafts -- --body-dir docs/public-testnet-operator-issue-bodies
```

If this workspace has no Git remote, generate commands with an explicit repository:

```sh
pnpm testnet:operator-issue-drafts -- --body-dir docs/public-testnet-operator-issue-bodies --github-repo <owner/repo>
```

Verify the generated issue draft and body files are current:

```sh
pnpm testnet:operator-issue-drafts:check
```

Create one public issue per slot from `docs/public-testnet-operator-issue-bodies/README.md`:

- `deployer-1`
- `indexer-1`
- `indexer-2`
- `replay-1`
- `replay-2`
- `replay-3`
- `steward-1`
- `steward-2`

Use `docs/public-testnet-operator-issue-url-intake.md` to collect the eight issue URLs, validate them with `pnpm testnet:record-issue-urls -- --dry-run`, then run `pnpm testnet:record-issue-urls` to record non-`open` intake rows on the roster.

After each issue exists, use the generated per-slot commands in `docs/public-testnet-operator-issue-bodies/README.md`, or record the issue URL or number on the roster while the slot is still unassigned:

```sh
pnpm testnet:update-roster-slot -- --slot <slot> --tracking-issue <issue-url-or-number>
```

Do not mark outreach as sent until the message has actually been sent through the relevant public channel.

## 2. Send And Record First-Wave Outreach

Use `docs/public-testnet-operator-send-packets.md` for slot-specific messages. Fill in the public repo URL and the slot tracking issue URL before sending.

After sending a message, record it. If you recorded the public issue URL on the roster in step 1, use `--tracking-issue-from-roster`; otherwise pass `--tracking-issue <issue-url-or-number>` explicitly.

```sh
pnpm testnet:record-outreach -- --candidate "<candidate route>" --pool "<candidate pool>" --contact "<contact URL>" --slot <slot> --status contacted --tracking-issue-from-roster --notes "Sent <slot> packet."
```

Check outreach consistency:

```sh
pnpm testnet:audit-outreach
```

This audit also checks that contacted-or-later outreach rows use the same tracking issue recorded on the roster.

Use strict mode only when every required slot should have contacted-or-later outreach:

```sh
pnpm testnet:audit-outreach:strict
```

## 3. Promote Accepted Operators Into The Roster

When a candidate accepts, collect the assignment fields in `docs/public-testnet-operator-assignment-intake.md`.

Record the slot with:

```sh
pnpm testnet:update-roster-slot -- --slot <slot> --tracking-issue <issue-url-or-number> --operator-id <operator-id> --contact "<contact-or-public-key>" --organization "<organization-or-independent-individual>" --status invited --notes "<short status note>"
```

Run:

```sh
pnpm testnet:audit-roster
```

Do not change a slot to `reviewed` until its real evidence file exists and maintainer independence review passes.

## 4. Collect Operator Evidence

Operators should follow `docs/public-testnet-operator-runbook.md` and `docs/public-testnet-role-command-reference.md`.

Operator evidence files must land in:

```text
docs/public-testnet-attestations
```

Inspect pending evidence without failing the shell:

```sh
pnpm testnet:verify-attestations:pending
```

The final evidence set must include:

- 1 deployer evidence file.
- 2 API/indexer evidence files.
- 3 replay-checker evidence files with matching transaction and event stream hashes.
- 2 community-guide evidence files.

## 5. Record Launch Summary And Close The Gate

After real-world operator independence review passes, write the launch summary:

```sh
pnpm testnet:write-launch-summary -- --decision GO --independence-reviewed --testnet-window "<testnet window>"
```

Then verify the final gate:

```sh
pnpm testnet:verify-attestations
pnpm mvp:audit
```

Only after `pnpm mvp:audit` reports `Ready` should maintainers mark the roadmap checkbox complete.
