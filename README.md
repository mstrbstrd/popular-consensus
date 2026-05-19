# Popular Consensus MVP

Popular Consensus is a working local demo of a simple idea: give communities a trusted place to ask clear questions, collect private votes, publish answers everyone can check, and share value with the people who helped create those answers.

## Protocol Replay Kit

The EF grant-facing protocol surface lives in `grant/ef-protocol-replay-kit`. It is intentionally narrower than the social platform: event and artifact schemas, replay verification, tamper detection, archive/export evidence, and protocol/platform dependency boundaries.

For a backend-only review path, run:

```bash
pnpm grant:check
```

This generates `artifacts/grant-demo/full-lifecycle-report.json`, verifies the clean replay path, confirms a tampered result produces `Mismatch`, checks that protocol packages do not depend on platform packages, and runs the replay package tests.

For a DB-backed API replay run against the public civic-record endpoints, start local Postgres and run:

```bash
pnpm grant:api-replay
```

For a local-chain replay proof, run:

```bash
pnpm grant:chain-replay
```

This starts an ephemeral Anvil RPC, deploys the protocol modules, drives the credential/question/ballot/tally/challenge/finalize/archive lifecycle, and verifies the emitted contract logs through `pc-replay verify-chain`. The current evidence mode is local, not a public-chain deployment or externally reviewed production cryptography implementation.

For the local cryptography evidence inventory, run:

```bash
pnpm grant:crypto-review
```

This writes current privacy/integrity checks plus explicit production non-claims to `artifacts/grant-demo/crypto-review-report.json`.

For threshold custody hardening evidence, run:

```bash
pnpm grant:threshold-custody
```

This writes `artifacts/grant-demo/threshold-custody-report.json` and checks malformed committee/share cases without claiming production distributed key generation.

For checked replay test vectors, run:

```bash
pnpm grant:replay-test-vectors
```

This writes clean and tampered fixtures under `packages/replay/test/fixtures/` and verifies their expected `Verified` or `Mismatch` status.

For contract access-control assumption evidence, run:

```bash
pnpm grant:contract-hardening
```

This checks grant-critical mutating contract methods for split-module coverage, steward guards, open-participant method assumptions, unauthorized-call tests, and production custody non-claims.

For reviewer handoff evidence, run:

```bash
pnpm grant:reviewer-handoff
```

This writes `artifacts/grant-demo/reviewer-handoff-report.json` and records which reviewer commands require no services, Postgres, an ephemeral local chain, or both.

For the machine-readable external review packet check, run:

```bash
pnpm grant:review-readiness
```

This writes `artifacts/grant-demo/review-readiness-report.json` and keeps `formalSubmissionReady` false until EF feedback and external cryptography review are incorporated.

For the repo strategy audit, run:

```bash
pnpm grant:repo-strategy-audit
```

This writes `artifacts/grant-demo/repo-strategy-audit-report.json` and maps the monorepo/protocol-boundary strategy to concrete evidence paths.

For the external review index, run:

```bash
pnpm grant:external-review-index
```

This writes `artifacts/grant-demo/external-review-index.json` and `artifacts/grant-demo/external-review-index.md` as the reviewer-facing table of contents for commands, statuses, hashes, source snapshot metadata, and blockers.

For grant packet linting, run:

```bash
pnpm grant:packet-lint
```

This checks packet length, reusable-builder sections, abstract scope hygiene, and quick/full reviewer command docs.

For a reviewer hash manifest, run:

```bash
pnpm grant:evidence-manifest
```

This writes `artifacts/grant-demo/evidence-manifest.json` with SHA-256 hashes for the grant docs, reports, transcripts, exports, replay source, and grant scripts.

For the broadest local evidence gate, start Postgres and run:

```bash
docker compose up -d postgres
pnpm db:migrate
pnpm grant:full-check
```

This runs typecheck, repo tests, contract build, DB-backed API replay, local-chain replay, and then the quick grant checks so the final evidence manifest covers the latest generated reports.

Licensing is scoped, not monorepo-wide. See `LICENSE-BOUNDARY.md` for the protocol, grant packet, artifact, and platform boundaries.

The mission lives in `docs/popular_consensus_mission.md`. Start there for the human purpose behind the product. `docs/mission-to-mvp-traceability.md` connects that mission to the features in this repo and calls out the gaps that still need real-world proof.

## Local Run

```bash
pnpm install
docker compose up -d postgres
pnpm db:migrate
pnpm dev:chain
pnpm contracts:deploy:local
pnpm privacy:setup
pnpm dev
```

Local URLs:

- Web app: http://localhost:3000
- API: http://localhost:4000
- Anvil RPC: http://localhost:8545
- Postgres: localhost:5432

For the full local setup, contract deployment, reset steps, audit checks, and verification commands, see `docs/local-appchain-devnet-runbook.md`.

Helpful docs:

- `docs/community-fork-and-exit.md` explains how a community can leave with its records if the shared system stops serving it.
- `docs/account-abstraction-auth.md` explains passkey and wallet login.
- `docs/erc4337-account-execution.md` documents the local smart-account execution bridge.
- `docs/data-union-mvp.md` explains the opt-in rewards model for privacy-safe reports.
- `docs/public-copy-style-guide.md` keeps public UI and docs language clear for non-technical users.
- `docs/mvp-invariants.md` lists the product promises this MVP must keep.
- `docs/decentralized-protocol-roadmap.md` tracks the longer path from local demo to public infrastructure.

Public testnet coordination lives in the `docs/public-testnet-*` files. Start with `docs/public-testnet-maintainer-checklist.md`, `docs/public-testnet-operator-runbook.md`, and `docs/public-testnet-external-input-request.md`.

To check the current MVP completion state, run:

```bash
pnpm mvp:audit
```

Use `pnpm mvp:audit:strict` for a CI-style check that fails until every roadmap item and public-testnet gate is ready. The current audit is recorded in `docs/mvp-completion-audit.md`.

## What You Can Try

The first demo is a civic community app. It lets people create an account, join public or private communities, ask questions, review unclear wording, vote privately, count votes, publish a public result receipt, discuss the result, and save the final record.

Community answers are advisory by default: they show where people stand. A community can also turn on explicit next-step rules when a result should guide a real-world action or committed decision.

Playwright e2e tests run the web app on http://localhost:3001 so a development server can stay open on port 3000.

## Current Product Surface

- Create passkey-backed or wallet-backed accounts.
- Keep a local testing hub for demo account switching.
- Create, join, and follow public or private communities.
- Ask community-scoped questions from the UI.
- Browse a question feed by community, profile, following, or open vote.
- Flag unclear questions, clarify wording, clear or keep flags, and open voting.
- Get a voting pass, cast one private vote, close voting, and count results.
- Publish public result receipts and privacy notes without exposing individual choices.
- Flag result problems, clear result flags, save final results, and publish question records.
- Post public discussion notes on question pages.
- See rewards for opt-in, privacy-safe reports, including customer approval, report sharing, payment recording, and reward claims.
- Create next-step rules that explain whether an answer is a community signal, a recognized guide for action, or a committed decision.
- Expose public civic-record API views for privacy-safe question, event, result, and archive metadata.
- Keep private community feeds visible only to active members.

## Trust Model

Votes are encrypted before storage. The app blocks repeat voting with one-time voting passes, then publishes public result receipts that can be checked without revealing individual answers.

For this local MVP, the coordinator is still a demo trust assumption. The long-term design replaces that single coordinator with a group that counts votes together.

Passkeys, wallets, and smart accounts prove that actions came from the right signed-in account. They are not linked to individual private answers.
