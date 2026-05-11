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
| deployer-1 | [Public testnet operator]: deployer-1 deployer | public-testnet, operator | docs/public-testnet-operator-issue-bodies/deployer-1.md |
| indexer-1 | [Public testnet operator]: indexer-1 api-indexer | public-testnet, operator | docs/public-testnet-operator-issue-bodies/indexer-1.md |
| indexer-2 | [Public testnet operator]: indexer-2 api-indexer | public-testnet, operator | docs/public-testnet-operator-issue-bodies/indexer-2.md |
| replay-1 | [Public testnet operator]: replay-1 replay-verifier | public-testnet, operator | docs/public-testnet-operator-issue-bodies/replay-1.md |
| replay-2 | [Public testnet operator]: replay-2 replay-verifier | public-testnet, operator | docs/public-testnet-operator-issue-bodies/replay-2.md |
| replay-3 | [Public testnet operator]: replay-3 replay-verifier | public-testnet, operator | docs/public-testnet-operator-issue-bodies/replay-3.md |
| steward-1 | [Public testnet operator]: steward-1 community-steward | public-testnet, operator | docs/public-testnet-operator-issue-bodies/steward-1.md |
| steward-2 | [Public testnet operator]: steward-2 community-steward | public-testnet, operator | docs/public-testnet-operator-issue-bodies/steward-2.md |

## GitHub CLI Commands

```sh
gh issue create --title "[Public testnet operator]: deployer-1 deployer" --label public-testnet --label operator --body-file docs/public-testnet-operator-issue-bodies/deployer-1.md
gh issue create --title "[Public testnet operator]: indexer-1 api-indexer" --label public-testnet --label operator --body-file docs/public-testnet-operator-issue-bodies/indexer-1.md
gh issue create --title "[Public testnet operator]: indexer-2 api-indexer" --label public-testnet --label operator --body-file docs/public-testnet-operator-issue-bodies/indexer-2.md
gh issue create --title "[Public testnet operator]: replay-1 replay-verifier" --label public-testnet --label operator --body-file docs/public-testnet-operator-issue-bodies/replay-1.md
gh issue create --title "[Public testnet operator]: replay-2 replay-verifier" --label public-testnet --label operator --body-file docs/public-testnet-operator-issue-bodies/replay-2.md
gh issue create --title "[Public testnet operator]: replay-3 replay-verifier" --label public-testnet --label operator --body-file docs/public-testnet-operator-issue-bodies/replay-3.md
gh issue create --title "[Public testnet operator]: steward-1 community-steward" --label public-testnet --label operator --body-file docs/public-testnet-operator-issue-bodies/steward-1.md
gh issue create --title "[Public testnet operator]: steward-2 community-steward" --label public-testnet --label operator --body-file docs/public-testnet-operator-issue-bodies/steward-2.md
```

## Roster Tracking Commands

After creating each issue, replace the placeholder with the public issue URL or number and record it on the roster:

```sh
pnpm testnet:update-roster-slot -- --slot deployer-1 --tracking-issue <deployer-1-issue-url-or-number>
pnpm testnet:update-roster-slot -- --slot indexer-1 --tracking-issue <indexer-1-issue-url-or-number>
pnpm testnet:update-roster-slot -- --slot indexer-2 --tracking-issue <indexer-2-issue-url-or-number>
pnpm testnet:update-roster-slot -- --slot replay-1 --tracking-issue <replay-1-issue-url-or-number>
pnpm testnet:update-roster-slot -- --slot replay-2 --tracking-issue <replay-2-issue-url-or-number>
pnpm testnet:update-roster-slot -- --slot replay-3 --tracking-issue <replay-3-issue-url-or-number>
pnpm testnet:update-roster-slot -- --slot steward-1 --tracking-issue <steward-1-issue-url-or-number>
pnpm testnet:update-roster-slot -- --slot steward-2 --tracking-issue <steward-2-issue-url-or-number>
```

After an operator accepts, capture the assignment fields with `docs/public-testnet-operator-assignment-intake.md`, then record the accepted slot with `pnpm testnet:update-roster-slot`.
