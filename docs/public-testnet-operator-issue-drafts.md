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

## deployer-1

Title: [Public testnet operator]: deployer-1 deployer
Labels: public-testnet, operator

````markdown
Use this issue to coordinate an independent public testnet operator. The completion gate still requires a valid attestation JSON file, maintainer independence review, and a launch summary.

## Operator Role

deployer

## Roster Slot

deployer-1

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

```sh
pnpm testnet:collect-attestation -- \
  --operator-id needs-operator-id \
  --operator-contact needs-contact-or-public-key \
  --operator-organization "independent individual or organization name" \
  --independence-statement "explain operator independence from maintainers and sibling operators" \
  --role deployer \
  --git-commit needs-git-commit \
  --chain-id needs-chain-id \
  --rpc-url needs-rpc-url \
  --community-id needs-community-id \
  --checks-preset complete \
  --deployment-hash sha256:needs-deployment-hash \
  --out docs/public-testnet-attestations/needs-operator-id.json
```

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

Publishes deployment hash and chain details.
````

## indexer-1

Title: [Public testnet operator]: indexer-1 api-indexer
Labels: public-testnet, operator

````markdown
Use this issue to coordinate an independent public testnet operator. The completion gate still requires a valid attestation JSON file, maintainer independence review, and a launch summary.

## Operator Role

api-indexer

## Roster Slot

indexer-1

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

```sh
pnpm testnet:collect-attestation -- \
  --operator-id needs-operator-id \
  --operator-contact needs-contact-or-public-key \
  --operator-organization "independent individual or organization name" \
  --independence-statement "explain operator independence from maintainers and sibling operators" \
  --role api-indexer \
  --git-commit needs-git-commit \
  --chain-id needs-chain-id \
  --rpc-url needs-rpc-url \
  --community-id needs-community-id \
  --checks-preset complete \
  --api-base-url needs-api-base-url \
  --out docs/public-testnet-attestations/needs-operator-id.json
```

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

Runs first public API/indexer endpoint.
````

## indexer-2

Title: [Public testnet operator]: indexer-2 api-indexer
Labels: public-testnet, operator

````markdown
Use this issue to coordinate an independent public testnet operator. The completion gate still requires a valid attestation JSON file, maintainer independence review, and a launch summary.

## Operator Role

api-indexer

## Roster Slot

indexer-2

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

```sh
pnpm testnet:collect-attestation -- \
  --operator-id needs-operator-id \
  --operator-contact needs-contact-or-public-key \
  --operator-organization "independent individual or organization name" \
  --independence-statement "explain operator independence from maintainers and sibling operators" \
  --role api-indexer \
  --git-commit needs-git-commit \
  --chain-id needs-chain-id \
  --rpc-url needs-rpc-url \
  --community-id needs-community-id \
  --checks-preset complete \
  --api-base-url needs-api-base-url \
  --out docs/public-testnet-attestations/needs-operator-id.json
```

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

Runs second independent public API/indexer endpoint.
````

## replay-1

Title: [Public testnet operator]: replay-1 replay-verifier
Labels: public-testnet, operator

````markdown
Use this issue to coordinate an independent public testnet operator. The completion gate still requires a valid attestation JSON file, maintainer independence review, and a launch summary.

## Operator Role

replay-verifier

## Roster Slot

replay-1

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

```sh
pnpm testnet:collect-attestation -- \
  --operator-id needs-operator-id \
  --operator-contact needs-contact-or-public-key \
  --operator-organization "independent individual or organization name" \
  --independence-statement "explain operator independence from maintainers and sibling operators" \
  --role replay-verifier \
  --git-commit needs-git-commit \
  --chain-id needs-chain-id \
  --rpc-url needs-rpc-url \
  --community-id needs-community-id \
  --checks-preset complete \
  --out docs/public-testnet-attestations/needs-operator-id.json
```

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

Verifies transaction and event stream hashes.
````

## replay-2

Title: [Public testnet operator]: replay-2 replay-verifier
Labels: public-testnet, operator

````markdown
Use this issue to coordinate an independent public testnet operator. The completion gate still requires a valid attestation JSON file, maintainer independence review, and a launch summary.

## Operator Role

replay-verifier

## Roster Slot

replay-2

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

```sh
pnpm testnet:collect-attestation -- \
  --operator-id needs-operator-id \
  --operator-contact needs-contact-or-public-key \
  --operator-organization "independent individual or organization name" \
  --independence-statement "explain operator independence from maintainers and sibling operators" \
  --role replay-verifier \
  --git-commit needs-git-commit \
  --chain-id needs-chain-id \
  --rpc-url needs-rpc-url \
  --community-id needs-community-id \
  --checks-preset complete \
  --out docs/public-testnet-attestations/needs-operator-id.json
```

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

Verifies transaction and event stream hashes.
````

## replay-3

Title: [Public testnet operator]: replay-3 replay-verifier
Labels: public-testnet, operator

````markdown
Use this issue to coordinate an independent public testnet operator. The completion gate still requires a valid attestation JSON file, maintainer independence review, and a launch summary.

## Operator Role

replay-verifier

## Roster Slot

replay-3

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

```sh
pnpm testnet:collect-attestation -- \
  --operator-id needs-operator-id \
  --operator-contact needs-contact-or-public-key \
  --operator-organization "independent individual or organization name" \
  --independence-statement "explain operator independence from maintainers and sibling operators" \
  --role replay-verifier \
  --git-commit needs-git-commit \
  --chain-id needs-chain-id \
  --rpc-url needs-rpc-url \
  --community-id needs-community-id \
  --checks-preset complete \
  --out docs/public-testnet-attestations/needs-operator-id.json
```

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

Verifies transaction and event stream hashes.
````

## steward-1

Title: [Public testnet operator]: steward-1 community-steward
Labels: public-testnet, operator

````markdown
Use this issue to coordinate an independent public testnet operator. The completion gate still requires a valid attestation JSON file, maintainer independence review, and a launch summary.

## Operator Role

community-steward

## Roster Slot

steward-1

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

```sh
pnpm testnet:collect-attestation -- \
  --operator-id needs-operator-id \
  --operator-contact needs-contact-or-public-key \
  --operator-organization "independent individual or organization name" \
  --independence-statement "explain operator independence from maintainers and sibling operators" \
  --role community-steward \
  --git-commit needs-git-commit \
  --chain-id needs-chain-id \
  --rpc-url needs-rpc-url \
  --community-id needs-community-id \
  --checks-preset complete \
  --out docs/public-testnet-attestations/needs-operator-id.json
```

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

Runs governance and safety drills.
````

## steward-2

Title: [Public testnet operator]: steward-2 community-steward
Labels: public-testnet, operator

````markdown
Use this issue to coordinate an independent public testnet operator. The completion gate still requires a valid attestation JSON file, maintainer independence review, and a launch summary.

## Operator Role

community-steward

## Roster Slot

steward-2

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

```sh
pnpm testnet:collect-attestation -- \
  --operator-id needs-operator-id \
  --operator-contact needs-contact-or-public-key \
  --operator-organization "independent individual or organization name" \
  --independence-statement "explain operator independence from maintainers and sibling operators" \
  --role community-steward \
  --git-commit needs-git-commit \
  --chain-id needs-chain-id \
  --rpc-url needs-rpc-url \
  --community-id needs-community-id \
  --checks-preset complete \
  --out docs/public-testnet-attestations/needs-operator-id.json
```

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

Runs governance and safety drills.
````
