# Popular Consensus Protocol Replay Kit

This packet is the EF grant-facing surface for the protocol replay kit. It keeps the social platform and data-union product out of the core claim: a civic governance record should be exportable, content-addressed, tamper-evident, and independently replayable without trusting the application database.

## Reviewer Quick Start

```bash
pnpm install
pnpm grant:check
```

The check command runs:

- `pnpm grant:demo`
- `pnpm grant:crypto-review`
- `pnpm grant:threshold-custody`
- `pnpm grant:replay-test-vectors`
- `pnpm grant:contract-hardening`
- `pnpm grant:packet-lint`
- `pnpm grant:reviewer-handoff`
- `pnpm grant:repo-strategy-audit`
- `pnpm grant:submission-gate`
- `pnpm grant:protocol-publication`
- `pnpm grant:negative-invariants`
- `pnpm grant:external-review-index`
- `pnpm grant:evidence-manifest`
- `pnpm grant:review-readiness`
- `pnpm replay:verify`
- `pnpm protocol:boundary:check`
- `pnpm --filter @pc/replay test`

Expected result:

- the demo report is written to `artifacts/grant-demo/full-lifecycle-report.json`
- clean production-slice replay returns `Verified`
- tampered result data returns `Mismatch`
- protocol packages do not depend on platform packages
- replay package tests pass
- decoded grant-critical onchain event names fail closed when unsupported
- crypto review evidence is written with explicit production non-claims
- threshold custody hardening evidence rejects malformed committee/share cases without claiming production DKG
- replay test vectors are regenerated for clean and tampered bundle/export cases
- contract access-control assumptions are checked without claiming production readiness
- packet docs pass length, reuse-section, and abstract-scope lint checks
- reviewer commands are documented by dependency mode for external handoff
- repo strategy requirements are mapped to current evidence paths
- the submission gate records machine-proven pre-submit criteria while keeping EF feedback as a blocker
- protocol package publication status is explicit: source-reuse ready, npm publication not claimed
- negative invariants are checked directly for product-scope creep, web-client dependency, token pitch, production overclaims, and license blur
- external review index is generated as a compact evidence table of contents
- an evidence manifest with content hashes is written for reviewer handoff
- review readiness evidence is written while keeping formal submission blocked on human review

## Full Local Evidence Gate

For the complete local reviewer path, start local Postgres first and run:

```bash
docker compose up -d postgres
pnpm db:migrate
pnpm grant:full-check
```

`pnpm grant:full-check` runs typecheck, repo tests, contract build, DB-backed API replay, local-chain replay, and then the quick grant checks so the final machine-readable readiness report and evidence manifest cover the latest generated reports. It is the broadest local command, but it still reports `formalSubmissionReady: false` until EF feedback and external cryptography review are incorporated.

The replay package also exposes:

```bash
pc-replay verify-api --base-url http://localhost:4000 --question-id <question-id>
pc-replay verify-chain --rpc-url http://127.0.0.1:8545 --from-block 0
```

The API command verifies the public civic-record API and replay-check API together. The chain command reads deployed protocol module logs over RPC, decodes them with the compiled contract artifacts, and adapts grant-critical Solidity events into canonical replay events.

For DB-backed local evidence, run:

```bash
pnpm grant:api-replay
```

This resets local demo data, drives a backend question lifecycle through the API, starts the API on an ephemeral localhost port, runs `verify-api`, and writes `artifacts/grant-demo/api-replay-report.json` plus `artifacts/grant-demo/api-replay-transcript.txt`.

For local-chain evidence, run:

```bash
pnpm grant:chain-replay
```

This starts an ephemeral Anvil RPC, deploys the protocol modules, drives the credential/question/ballot/tally/challenge/finalize/archive lifecycle, runs `verify-chain` over emitted logs, and writes `artifacts/grant-demo/chain-replay-report.json` plus `artifacts/grant-demo/chain-replay-transcript.txt`.

For privacy and cryptography evidence, run:

```bash
pnpm grant:crypto-review
```

This checks ballot encryption tamper rejection, wrong-key rejection, nullifier scoping, aggregate-output privacy, malformed Semaphore proof rejection, and writes a report with explicit production non-claims.

For threshold custody hardening evidence, run:

```bash
pnpm grant:threshold-custody
```

This checks that threshold committee metadata and accepted-share evidence fail closed for duplicate members, invalid keys, exported private key material, insufficient shares, unauthorized shares, duplicate share hashes, and aggregate-binding tampering. It writes `artifacts/grant-demo/threshold-custody-report.json` with `productionDeploymentReady: false`.

For replay test vectors, run:

```bash
pnpm grant:replay-test-vectors
```

This writes clean and tampered JSON fixtures under `packages/replay/test/fixtures/`, verifies each expected status, and writes `artifacts/grant-demo/replay-test-vectors-report.json`.

For contract access-control assumption evidence, run:

```bash
pnpm grant:contract-hardening
```

This checks grant-critical mutating contract methods for split-module coverage, steward guards, open-participant method assumptions, unauthorized-call tests, and writes `artifacts/grant-demo/contract-hardening-report.json` with `productionDeploymentReady: false`.

For reviewer handoff evidence, run:

```bash
pnpm grant:reviewer-handoff
```

This writes `artifacts/grant-demo/reviewer-handoff-report.json`, confirms the quick reviewer path avoids local services, confirms the full gate includes API and chain replay, and records which commands require Postgres or an ephemeral local chain.

For repo strategy audit evidence, run:

```bash
pnpm grant:repo-strategy-audit
```

This writes `artifacts/grant-demo/repo-strategy-audit-report.json` and maps the monorepo strategy requirements to specific docs, commands, reports, source paths, and non-claims.

For submission gate evidence, run:

```bash
pnpm grant:submission-gate
```

This writes `artifacts/grant-demo/submission-gate-report.json`, checks the strategy's pre-submit evidence criteria that can be proven locally, and keeps `formalSubmissionReady: false` until EF feedback is incorporated.

For protocol package publication status, run:

```bash
pnpm grant:protocol-publication
```

This writes `artifacts/grant-demo/protocol-publication-report.json`, confirms the protocol package source is MIT-scoped and platform-independent, and keeps `npmPublicationReady: false` while package manifests still use no-publish guards.

For negative invariant evidence, run:

```bash
pnpm grant:negative-invariants
```

This writes `artifacts/grant-demo/negative-invariant-report.json` and checks that the grant path does not import platform code, rely on the web client, creep product/data-union monetization into replay evidence, center tokenomics, overclaim production readiness, blur license boundaries, or make the platform the source of truth.

For the external review index, run:

```bash
pnpm grant:external-review-index
```

This writes `artifacts/grant-demo/external-review-index.json` and `artifacts/grant-demo/external-review-index.md`, listing reviewer commands, dependency modes, key reports, statuses, hashes, source snapshot metadata, and remaining human blockers.

For machine-readable external-review readiness, run:

```bash
pnpm grant:review-readiness
```

This validates that the packet, reports, license files, replay package, and known human blockers are present. It writes `artifacts/grant-demo/review-readiness-report.json` and deliberately reports `formalSubmissionReady: false` until external cryptography review and EF feedback are incorporated.

For grant packet linting, run:

```bash
pnpm grant:packet-lint
```

This verifies each packet document is short, includes a reusable-builder section, keeps the abstract away from product monetization language, and writes `artifacts/grant-demo/packet-lint-report.json`.

For a hash manifest of the review packet, run:

```bash
pnpm grant:evidence-manifest
```

This writes `artifacts/grant-demo/evidence-manifest.json`, listing the grant docs, generated reports, transcripts, test vectors, replay source, and grant scripts with SHA-256 hashes.

## Current Evidence Mode

The current demo is a deterministic backend protocol fixture. It proves the replay/export/tamper path without running the web client and without relying on the application database as the source of truth.

It is not yet a public-chain deployment or an externally reviewed production cryptography implementation. Those are tracked as grant milestones, not claimed as finished work.

## Packet Map

- `00-abstract.md` gives the grant-facing summary.
- `01-protocol-boundary.md` defines the protocol/platform dependency rule.
- `02-event-schema.md` maps protocol events and the onchain alignment target.
- `03-artifact-schema.md` describes content-addressed export artifacts.
- `04-replay-rules.md` lists current verification checks and commands.
- `05-threat-model.md` names the current security/privacy assumptions.
- `06-demo-transcript.md` records the demo command and report evidence.
- `07-budget-and-milestones.md` proposes the 16-week grant plan.
- `08-review-readiness.md` separates current evidence from submission gaps.
- `09-license-plan.md` drafts the public-good licensing boundary.
- `10-api-replay-transcript.md` records the DB-backed API replay evidence path.
- `11-cryptography-review.md` records the current cryptography evidence and non-claims.
- `12-external-review-intake.md` tracks EF and cryptography review feedback still needing human input.
- `13-contract-hardening-status.md` documents access-control assumptions and production contract-hardening blockers.
- `14-reviewer-handoff.md` gives command-by-command reproduction guidance for external reviewers.
- `15-threshold-custody-hardening.md` documents threshold custody evidence and production non-claims.
- `16-replay-test-vectors.md` documents checked replay fixture files and expected statuses.
- `17-repo-strategy-audit.md` maps the repo strategy to machine-readable evidence.
- `18-external-review-index.md` documents the generated reviewer evidence index.
- `19-grant-track-issue.md` is the local issue/project-board draft for `EF Grant Track: Protocol Replay Kit`.
- `20-submission-gate.md` documents the machine-readable pre-submit evidence gate.
- `21-protocol-package-publication.md` explains source reuse versus npm publication readiness.
- `22-negative-invariant-audit.md` documents the hostile-review negative invariant gate.
- `office-hours-brief.md` is the short EF alignment brief.
- `scope-boundary.md` states what is in and out of grant scope.

## What Other Builders Can Reuse

Other builders can reuse the artifact bundle shape, replay report format, protocol boundary rule, tamper fixtures, verifier package, and grant evidence workflow without adopting the Popular Consensus social platform.
