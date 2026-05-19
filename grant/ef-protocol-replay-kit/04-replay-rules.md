# Replay Rules

## Current Checks

The replay verifier checks:

- protocol and schema versions
- credential schema and issuer status
- trust policy hash and issuer allow-list
- question version hash
- poll and tally key setup consistency
- no private key material in exported input
- duplicate nullifier rejection
- encrypted ballot payload hashes
- eligibility proof hash and signature
- threshold decryption share count and signatures
- result aggregate, ballot commitment, and tally proof hashes
- challenge resolution before finalization
- archive root and manifest hash
- bundle artifact hashes
- manifest references
- event previous-hash continuity
- required event types

## Verification Commands

```bash
pnpm grant:check
pnpm grant:api-replay
pnpm grant:chain-replay
pnpm grant:crypto-review
pnpm grant:threshold-custody
pnpm grant:replay-test-vectors
pnpm grant:contract-hardening
pnpm grant:packet-lint
pnpm grant:evidence-manifest
pnpm grant:review-readiness
pnpm grant:repo-strategy-audit
pnpm grant:external-review-index
pnpm grant:full-check
pnpm grant:demo
pnpm replay:verify
pnpm --filter @pc/replay verify
pnpm --filter @pc/replay exec node --import tsx src/cli.ts verify-api --base-url http://localhost:4000 --question-id <question-id>
pnpm --filter @pc/replay exec node --import tsx src/cli.ts verify-chain --rpc-url http://127.0.0.1:8545 --from-block 0
pnpm protocol:boundary:check
```

`pnpm grant:check` is the external-review shortcut. It regenerates the demo report, writes crypto and threshold custody evidence, regenerates replay test vectors, writes review-readiness evidence, verifies the exported production slice, enforces the protocol/platform dependency boundary, and runs the replay package tests.

`verify-api` checks a public civic-record endpoint and its replay-check endpoint together. It validates the public response schemas, requires replay status `Verified`, requires all replay checks to pass, and compares question id, event stream hash, result artifact hash, and archive hash across the public record and rebuilt replay state.

`verify-chain` checks protocol module logs from an RPC endpoint. By default it reads `data/local-deployment.json` and the compiled contract artifacts, decodes matching logs, adapts grant-critical Solidity events into canonical replay events, and fails empty, unknown, or under-specified event evidence.

The replay package is organized as standalone verifier modules: `verifyBundle.ts`, `verifyApi.ts`, `verifyChain.ts`, `rebuildState.ts`, `checks.ts`, and `tamper.ts`. The CLI imports those modules through `packages/replay/src/index.ts`.

`pnpm grant:api-replay` is the DB-backed evidence path. It creates a fresh lifecycle through the API and verifies the resulting public record over localhost.

`pnpm grant:chain-replay` is the local-chain evidence path. It starts an ephemeral Anvil RPC, deploys the protocol modules, drives the lifecycle through contract calls, rejects a duplicate nullifier, and verifies emitted logs through `verify-chain`.

`pnpm grant:crypto-review` is the cryptography evidence path. It checks nullifier scoping, ballot encryption randomization, wrong-key rejection, AES-GCM tamper rejection, aggregate-output privacy, and malformed Semaphore proof rejection. It also writes production non-claims so reviewers can distinguish evidence from still-open audit work.

`pnpm grant:threshold-custody` is the threshold custody evidence path. It checks malformed committee/member/share cases against the replay verifier and writes production non-claims for DKG, ceremony, custody, and decryption-share proof review.

`pnpm grant:replay-test-vectors` writes clean and tampered JSON fixtures under `packages/replay/test/fixtures/` and verifies their expected `Verified` or `Mismatch` status.

`pnpm grant:contract-hardening` checks split module layout, coordinator/steward guards, unauthorized-call tests, open participant actions, and production custody non-claims.

`pnpm grant:packet-lint` checks the grant packet acceptance criteria: short docs, reusable-builder sections, abstract scope hygiene, explicit protocol/platform boundary, and quick/full review commands.

`pnpm grant:repo-strategy-audit` maps the repo strategy requirements to current evidence paths and keeps formal submission and production deployment non-claims explicit.

`pnpm grant:external-review-index` writes a compact evidence table of contents with reviewer commands, dependency modes, report statuses, key hashes, and human blockers.

`pnpm grant:evidence-manifest` writes a hash manifest for grant docs, generated reports, transcripts, test vectors, replay source, and grant scripts.

`pnpm grant:review-readiness` validates that required packet files, reports, licenses, replay tooling, contract-event tests, and known human blockers are present. It is intentionally not a formal-submission approval because EF feedback and external cryptography review remain human gates.

`pnpm grant:full-check` is the broad local evidence gate. It runs typecheck, repo tests, contract build, DB-backed API replay, local-chain replay, and then quick grant checks so the final manifest and review-readiness report cover the latest generated evidence. It requires local Postgres for `grant:api-replay`; the chain replay starts its own ephemeral Anvil instance.

## What Other Builders Can Reuse

Builders can reuse the replay rule list as a baseline for independent civic-record verification and tamper detection.
