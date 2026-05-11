# Public Testnet Operator Runbook

This runbook defines the evidence needed before Popular Consensus can mark "Run public testnet with independent operators" complete.

The current repo is public-testnet ready when it can produce repeatable deployments, protocol transaction feeds, independent replay results, and operator attestations. The checkbox is complete only after independent operators actually run the stack and publish attestations.

The machine-readable readiness contract is exposed at:

```text
GET /public/protocol/testnet-readiness
```

That response uses `public-testnet-readiness-v0` and includes operator role counts, required commands, required endpoints, governance drills, an attestation template, completion gates, and the CLI commands for collecting attestations, drafting launch notes, and verifying the final gate.

Maintainers can coordinate operator assignments in `docs/public-testnet-operator-roster.md`, generate local tracking issue drafts with `pnpm testnet:operator-issue-drafts`, record assignments with `pnpm testnet:update-roster-slot`, and use `docs/public-testnet-operator-invitation.md` when recruiting operators. Role-specific command shapes are in `docs/public-testnet-role-command-reference.md`. The roster is not completion evidence by itself; the verifier only accepts published attestations and the launch summary.

For the maintainer-side sequence from public issue creation through outreach, roster updates, attestations, launch summary, and final audit, follow `docs/public-testnet-maintainer-checklist.md`.

Maintainers can rehearse the workflow with `docs/public-testnet-rehearsal-plan.md`, but rehearsal evidence must not be used to complete the final gate.

Attestations are verified from `docs/public-testnet-attestations`:

```sh
pnpm testnet:verify-attestations
```

The verifier also checks the maintainer launch record at `docs/public-testnet-launch-summary.md`. The template lives at `docs/public-testnet-launch-summary.template.md`; the final launch record must include every operator id, every attestation hash, unresolved issues, and `Decision: GO`.

Before enough external evidence exists, maintainers can inspect missing gates without failing the shell:

```sh
pnpm testnet:verify-attestations:pending
```

After attestations are collected, maintainers can draft the launch summary:

```sh
pnpm testnet:write-launch-summary -- --testnet-window "2026-05-08 to 2026-05-15"
```

The summary writer defaults to `Decision: NO-GO`. It refuses `--decision GO` until the machine-checkable attestation counts and replay-hash matches are present and a maintainer passes `--independence-reviewed`; maintainers still need to confirm real-world operator independence before recording `GO`.

## Operator Roles

| Role | Minimum Count | Responsibility |
| --- | ---: | --- |
| Protocol deployer | 1 | Deploy the appchain/contracts and publish addresses, chain id, commit hash, and deployment transaction ids. |
| API/indexer operator | 2 | Run API/indexer nodes against the public testnet feed and publish replay hashes. |
| Replay verifier | 3 | Independently fetch public protocol transaction feeds and verify replay output without trusting domain tables. |
| Community steward | 2 | Exercise governance parameter, adoption, emergency pause, fork/export, and upgrade-safety reads. |

Operators should be independent people or organizations. A single person running multiple nodes is useful rehearsal, but it is not enough to complete the public-testnet gate.

## Launch Inputs

Each testnet launch must publish:

- Git commit hash.
- Chain id and RPC URL.
- Contract deployment addresses.
- API base URLs for every indexer operator.
- Artifact storage base or replication instructions.
- Operator contact or public key.
- Operator organization, if any.
- Operator independence statement explaining why the operator is independent from maintainers and other operators.
- Testnet start and planned end dates.
- Known MVP limitations from `GET /communities/:communityId/governance/upgrade-safety`.

Operators can start from the public testnet environment template:

```sh
cp infra/public-testnet.env.example .env.public-testnet
```

Operator-specific private keys and credentials must stay outside the repo.

## Required Commands

Run these from the repository root before joining the public testnet:

```sh
pnpm install --frozen-lockfile
cp infra/public-testnet.env.example .env.public-testnet
pnpm typecheck
pnpm --filter @pc/shared test
pnpm --filter @pc/contracts test
pnpm test:api:db
```

For contract deployment, set the target network explicitly:

```sh
RPC_URL=<public-testnet-rpc-url> DEPLOYER_PRIVATE_KEY=<operator-key> pnpm contracts:deploy:local
```

The deploy script name is still local because it is the current MVP deployment adapter. A public testnet launch must publish the resulting deployment JSON and the deployment transaction ids.

## Replay Checks

Every API/indexer operator must expose these reads:

```text
GET /public/protocol/appchain-boundary
GET /public/protocol/testnet-readiness
GET /registry/protocol-transactions
GET /registry/protocol-transactions/replay
GET /communities/:communityId/governance/upgrade-safety
GET /communities/:communityId/export
```

A replay verifier must confirm:

- `protocol.schemaVersion` is `protocol-indexer-replay-v0`.
- `status` is `Verified`.
- `protocol.statuses.failedChecks` is empty.
- `rebuilt.transactionStreamHash` matches across operators that indexed the same feed.
- `rebuilt.eventStreamHash` matches across operators that indexed the same feed.
- `protocol.authority.boundaryVersion` is `canonical-appchain-boundary-v0`.
- `GET /communities/:communityId/governance/upgrade-safety` still reports `independent-testnet-operators` as pending until enough external attestations are published.

## Governance And Safety Exercises

At least one community on the public testnet must complete these drills:

1. Propose and activate governance parameters with an explicit `effectiveAt`.
2. Propose and activate an adoption policy.
3. Open and resolve an emergency suspension.
4. Export a community bundle and replay it through `/communities/imports/replay`.
5. Publish fork metadata against a community export hash.
6. Verify that `/communities/:communityId/governance/upgrade-safety` reflects active parameters and emergency state changes.

## Operator Attestation

Each independent operator should publish a JSON attestation:

Operators can generate the attestation from live endpoint reads:

```sh
pnpm testnet:collect-attestation -- \
  --operator-id operator-name-or-public-key \
  --operator-contact contact-url-email-handle-or-public-key \
  --independence-statement "Independent operator not controlled by the maintainers or sibling operators." \
  --role replay-verifier \
  --git-commit <commit> \
  --chain-id <chain-id> \
  --rpc-url <public-testnet-rpc-url> \
  --api-base-url <api-base-url> \
  --community-id <community-id> \
  --checks-preset complete \
  --out docs/public-testnet-attestations/operator-name.json
```

`--checks-preset complete` should be used only after the operator has run the required commands and completed the relevant drills. Operators can instead pass individual `--check name=status` values. Deployer attestations must include `--deployment-hash` or `--deployment-json`.

```json
{
  "protocol": "popular-consensus",
  "schemaVersion": "public-testnet-operator-attestation-v0",
  "operatorId": "operator-name-or-public-key",
  "operatorContact": "contact-url-email-handle-or-public-key",
  "operatorOrganization": null,
  "independenceStatement": "Independent operator not controlled by the maintainers or sibling operators.",
  "operatorRole": "api-indexer | replay-verifier | community-steward | deployer",
  "gitCommit": "<commit>",
  "chainId": "<chain-id>",
  "rpcUrl": "<rpc-url>",
  "apiBaseUrl": "<api-base-url-or-null>",
  "deploymentHash": "<hash-of-deployment-json-or-null>",
  "transactionStreamHash": "<from /registry/protocol-transactions/replay>",
  "eventStreamHash": "<from /registry/protocol-transactions/replay>",
  "upgradeSafetyModelHash": "<protocol.hashes.modelHash>",
  "checks": {
    "typecheck": "passed",
    "sharedTests": "passed",
    "contractTests": "passed",
    "apiDbTests": "passed",
    "protocolIndexerReplay": "Verified",
    "communityImportReplay": "Verified",
    "governanceParameterDrill": "passed",
    "adoptionPolicyDrill": "passed",
    "emergencySuspensionDrill": "passed",
    "communityExportReplay": "Verified",
    "forkMetadata": "passed",
    "upgradeSafetyDrill": "passed"
  },
  "observations": [],
  "attestedAt": "ISO-8601 timestamp"
}
```

Attestations should be content-addressed and listed in the launch notes. The launch notes should include the hash of each attestation and any mismatch reports.

The verifier computes the content hash for each attestation using the repo's canonical JSON hashing rules, checks required role counts, checks matching replay hashes across independent replay verifiers, requires operator contact and independence-statement fields, rejects template placeholders, blocks duplicate contacts across different operator ids, and reports the remaining completion gates. It cannot prove real-world independence by itself; maintainers must confirm that each `operatorId` maps to an independent person or organization.

## Completion Gate

The final roadmap checkbox can be marked complete only when all are true:

- At least three independent replay verifiers publish matching `transactionStreamHash` and `eventStreamHash` values for the same testnet window.
- At least two independently operated API/indexer endpoints remain available for the agreed testnet window.
- Governance and safety drills complete with public artifacts and no unresolved critical replay mismatch.
- Operator attestations are published with content hashes, contacts, and independence statements.
- A maintainer confirms operator independence in the launch summary.
- `pnpm testnet:write-launch-summary -- --decision GO --independence-reviewed` succeeds and writes `docs/public-testnet-launch-summary.md`.
- `pnpm testnet:verify-attestations` reports `Ready`.
- A maintainer records the launch summary, operator list, hashes, unresolved issues, and go/no-go decision in the repo.

Until then, the roadmap item stays open.
