# Public Testnet Operator Issue Body Files

These files are generated from `docs/public-testnet-operator-roster.md` for GitHub CLI usage. They do not create issues, publish evidence, or complete the final public-testnet gate.

Create issues after a Git remote, GitHub default repository, or explicit `--repo` target is available and a maintainer approves the public action:

If this workspace has no Git remote or GitHub default repository, regenerate with `pnpm testnet:operator-issue-drafts -- --body-dir docs/public-testnet-operator-issue-bodies --github-repo <owner/repo>` or add `--repo <owner/repo>` to each command.

The commands below require the GitHub CLI `gh`. If `gh` is unavailable, create the issues manually from these body files.

## Authenticated GitHub Connector Payloads

After explicit maintainer approval, Codex can use an authenticated GitHub connector to create one issue per machine-readable draft:

```sh
pnpm testnet:operator-issue-drafts -- --json
```

For each `drafts[]` entry, use `repository_full_name` from the approved repository, plus the entry's `title`, `body`, and `labels`.

## Manual Issue Creation

Use this table when creating issues through the GitHub web UI or another issue tracker:

| Slot | Title | Labels | Body file |
| --- | --- | --- | --- |
| none | No slots currently need new tracking issues. | none | none |

## GitHub CLI Commands

```sh
# No gh issue create commands are needed because every eligible slot already has a tracking issue.
```

## Roster Tracking Commands

After creating each issue, replace the placeholder with the public issue URL or number and record it on the roster:

```sh
# No roster tracking commands are needed because every eligible slot already has a tracking issue.
```

After an operator accepts, capture the assignment fields with `docs/public-testnet-operator-assignment-intake.md`, then record the accepted slot with `pnpm testnet:update-roster-slot`.
