# Public Testnet Operator Issue Drafts

These local drafts are generated from `docs/public-testnet-operator-roster.md` for unassigned slots that still have `Tracking Issue` set to `open`, and aligned with `.github/ISSUE_TEMPLATE/public-testnet-operator.yml`. They do not create GitHub issues, publish evidence, or complete the final public-testnet gate.

Regenerate them with:

```sh
pnpm testnet:operator-issue-drafts
```

Generate one body file per issue for GitHub CLI usage with:

```sh
pnpm testnet:operator-issue-drafts -- --body-dir docs/public-testnet-operator-issue-bodies
```

The body files can also be used for manual issue creation when the GitHub CLI `gh` is unavailable.

Generate machine-readable issue drafts for authenticated GitHub connector usage with:

```sh
pnpm testnet:operator-issue-drafts -- --json
```

After explicit maintainer approval, create one issue per `drafts[]` entry with the supplied `title`, `body`, and `labels`.

Check whether the generated files are current with:

```sh
pnpm testnet:operator-issue-drafts:check
```

If this workspace has no Git remote or GitHub default repository, generate commands with an explicit target:

```sh
pnpm testnet:operator-issue-drafts -- --body-dir docs/public-testnet-operator-issue-bodies --github-repo <owner/repo>
```

Create one public issue per operator slot that still has no tracking issue, then record the resulting issue URL or number with `pnpm testnet:update-roster-slot -- --slot <slot> --tracking-issue <issue-url-or-number>`.

No unassigned operator slots with `Tracking Issue` set to `open` need new issue drafts.
