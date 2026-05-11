# Decentralized Protocol Roadmap

This tracker turns the larger north star into implementation slices we can mark off as we go.

North star: Popular Consensus becomes shared, privacy-preserving civic infrastructure for community-governed direct democratic opinion polling. The app should centralize civic records without centralizing civic power.

## Status Legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done for the current milestone

## Tracking Command

Run `pnpm mvp:audit` for the live MVP completion report. It reads this checklist, runs the public testnet attestation verifier in pending-safe mode, and prints the remaining gates. Use `pnpm mvp:audit:strict` when a non-zero exit is useful until the final gate is genuinely complete. The prompt-to-artifact completion audit is tracked in `docs/mvp-completion-audit.md`.

## Easiest To Hardest

### 1. Content-Addressed Public Artifacts

Goal: Every public civic record is reproducible, hash-addressed, and exportable.

- `[x]` Define deterministic artifact manifests for archives.
- `[x]` Add schema labels and versions for result, archive, discussion, credential, and adoption artifacts.
- `[x]` Add artifact verification helpers that recompute hashes and validate manifest references.
- `[x]` Add export bundle format for community fork/replication.
- `[x]` Add optional storage adapter boundary for IPFS, Arweave, or equivalent content-addressed storage.

### 2. Public API As Indexer/Client Layer

Goal: The API presents protocol facts derived from events and artifacts, not hidden server authority.

- `[x]` Add public civic-record endpoint for questions, events, results, archive metadata, and privacy-safe aggregates.
- `[x]` Normalize all public responses around protocol ids, hashes, statuses, and authority metadata.
- `[x]` Add pagination/filtering for registry events, archives, communities, and result artifacts.
- `[x]` Add response contracts for public API v0.
- `[x]` Add replay/rebuild checks from events plus artifacts.

### 3. On-Chain/Public Audit Commitments

Goal: Critical lifecycle commitments are anchored outside the application database.

- `[x]` Define minimum commitment set: question versions, bonds, challenges, rulings, result hashes, adoption policies, archives, and data-union records.
- `[x]` Wire local API lifecycle actions to local contract calls or explicit devnet commit records.
- `[x]` Add indexer path from contract events into API views.
- `[x]` Add tests proving API state matches emitted commitments.
- `[x]` Add deployment/runbook for local appchain devnet.

### 4. Community Fork And Alternate Frontend Support

Goal: Communities can exit with their records, policies, and presentation intact.

- `[x]` Add community export bundle that includes metadata, policies, questions, events, archives, and artifact manifest.
- `[x]` Add fork metadata and fork event type.
- `[x]` Add community frontend config artifact.
- `[x]` Add import/read-only replay path for exported communities.
- `[x]` Document fork and exit expectations.

### 5. Federated Social Layer

Goal: Discussion, membership, reputation, and moderation are portable across clients and community forks.

- `[x]` Add basic public discussion posts on questions.
- `[x]` Add source, pro, con, clarifying-question, and moderator-note views.
- `[x]` Add moderation log and appeal records.
- `[x]` Add portable profile identifiers.
- `[x]` Add follow/topic/community discovery data.
- `[x]` Add reputation export and replay rules.

### 6. Governance And Legitimacy System

Goal: Communities can govern process rules without handing unlimited power to the platform.

- `[x]` Add community adoption policies with advisory, recognized, and binding authority levels.
- `[x]` Add formal challenge appeal flow.
- `[x]` Add juror selection and conflict-disclosure rules.
- `[x]` Add governance parameters for bonds, privacy thresholds, tally windows, and reputation decay.
- `[x]` Add treasury/reward accounting beyond local demo ledgers.
- `[x]` Add transparent steward powers and emergency suspension rules.

### 7. Portable Credential Ecosystem

Goal: Eligibility is private, portable, revocable, and issuer-diverse.

- `[x]` Add local credential schema and issuer registry.
- `[x]` Add issuer suspension effects and public annotations for affected questions.
- `[x]` Add revocation root and expiry enforcement.
- `[x]` Add wallet-held credential import/export boundary.
- `[x]` Add ZK membership/nullifier proof integration.
- `[x]` Add multiple issuer trust policies per community.

### 8. Threshold Private Tallying

Goal: The coordinator is replaced by threshold tallying with verifiable result publication.

- `[x]` Define tally committee metadata and lifecycle.
- `[x]` Add threshold public key setup.
- `[x]` Add decryption share submission.
- `[x]` Add proof/reference validation for tally publication.
- `[x]` Add committee failure and replacement flow.
- `[x]` Remove single-coordinator trust from non-demo mode.

### 9. Full Protocol/Appchain As Source Of Truth

Goal: Contracts or appchain modules become canonical; API and UI become clients/indexers.

- `[x]` Choose appchain/module boundary and canonical state machines.
- `[x]` Implement canonical registry, stake, challenge, poll, tally, adoption, and archive modules.
- `[x]` Move protocol-owned database writes behind event ingestion or protocol transaction results.
- `[x]` Add independent client/indexer replay.
- `[x]` Add upgrade/governance safety model.
- `[ ]` Run public testnet with independent operators.

### 10. Community Data Union MVP

Goal: Communities can govern opt-in aggregate data products without exposing individual responses.

- `[x]` Add data-union policy proposal and activation records.
- `[x]` Add member opt-in consent and future-use revocation records.
- `[x]` Add cohort-thresholded aggregate product publication from public result artifacts.
- `[x]` Add buyer access grants with purpose and license hashes.
- `[x]` Add data-union revenue routing into community treasury, participant pool, and operator pool ledger entries.
- `[x]` Add public API, protocol transaction records, community export references, and focused DB-backed lifecycle tests.
- `[x]` Document data-union MVP boundaries and privacy guardrails.

## Current Focus

Items 1, 2, 3, 4, 5, 6, 7, 8, and 10 are complete for the current milestone, and Section 9 now has a canonical appchain/module boundary with typed state machines exposed through the public API plus canonical Solidity modules for registry, stake, challenge, poll, tally, adoption, and archive flows. The MVP supports reproducible public records, indexer-style public APIs, local devnet commitments, community export bundles, fork metadata, portable frontend config, read-only import replay, documented fork/exit expectations, portable federated discussion views, moderation appeals, profile identifiers, discovery follows, reputation export/replay, content-addressed question/result challenge appeals, public juror assignment/disclosure records, configurable community rules for bonds, privacy thresholds, tally windows, and reputation decay, bond-derived treasury/reward ledgers in public API and community exports, data-union revenue routing for opt-in aggregate products, transparent steward-power/emergency-suspension records with protocol-write enforcement, issuer suspension annotations, credential revocation-root/expiry enforcement, wallet-held credential import/export boundaries, local credential membership/nullifier proof verification, community-scoped issuer trust policies, public tally committee proposal/activation records, artifact-backed threshold tally public keys, accepted decryption share records required before threshold-key tally publication, publication proof artifacts that validate key/share references before result publication, artifact-backed failed-committee records with explicit replacement lineage, demo-only coordinator fallback that is disabled in non-demo mode, a documented `canonical-appchain-boundary-v0`, tested appchain modules, and a public protocol transaction-result feed backing registry events.

For the MVP source-of-truth milestone, protocol-owned API writes now pre-build and ingest local protocol transaction results before their domain rows are persisted across question registry, stake/bonds, challenge court, poll manager, tally manager, adoption registry, result/archive, credential registry, data-union registry, social graph, and reputation flows. Wallet credential import/export remains an explicit client-wallet boundary/cache rather than a canonical credential issuance path. Independent clients can now replay `GET /registry/protocol-transactions/replay` to verify transaction payload hashes, event hashes, result hashes, canonical module/event membership, and rebuilt per-module/per-subject heads without reading domain tables. Communities can also inspect `GET /communities/:communityId/governance/upgrade-safety` for the upgrade safety model, including proposal-artifact gates, effective-at activation delay, independent replay, emergency pause limits, fork/exit guarantees, and the still-pending independent testnet operator gate. The data-union MVP is exposed through `GET /communities/:communityId/data-union` and documented in `docs/data-union-mvp.md`. The public testnet launch package is now documented in `docs/public-testnet-operator-runbook.md`, exposed at `GET /public/protocol/testnet-readiness`, can collect operator evidence with `pnpm testnet:collect-attestation`, can draft launch records with `pnpm testnet:write-launch-summary`, and is backed by `pnpm testnet:verify-attestations`; the final checkbox remains open until independent operators actually run the network, publish attestations, and a maintainer records the launch summary.
