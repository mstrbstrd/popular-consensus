# Roadmap To Shared Public Trust

This tracker turns the mission in `docs/popular_consensus_mission.md` into implementation slices we can mark off as we go. The mission-to-MVP evidence map is tracked in `docs/mission-to-mvp-traceability.md`.

North star: Popular Consensus becomes shared civic infrastructure for clear questions, private votes, public result receipts, and community-led decisions. The app should create one dependable public record without putting all power in one company or institution.

## Status Legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done for the current milestone

## Tracking Command

Run `pnpm mvp:audit` for the live MVP completion report. It reads this checklist, runs the public testnet evidence verifier in pending-safe mode, and prints the remaining gates. Use `pnpm mvp:audit:strict` when a non-zero exit is useful until the final gate is genuinely complete. The prompt-to-artifact completion audit is tracked in `docs/mvp-completion-audit.md`.

## Easiest To Hardest

### 1. Checkable Public Records

Goal: Every public civic record can be reproduced, checked, and exported.

- `[x]` Define predictable record lists for archives.
- `[x]` Add labels and versions for results, archives, discussion, voting passes, and next-step rules.
- `[x]` Add verification helpers that recompute hashes and validate record references.
- `[x]` Add export bundle format for community fork/replication.
- `[x]` Add optional storage adapter boundary for IPFS, Arweave, or equivalent content-addressed storage.

### 2. Public API As A Reader Layer

Goal: The API presents public protocol facts, not hidden server authority.

- `[x]` Add public civic-record endpoint for questions, events, results, archive metadata, and privacy-safe aggregates.
- `[x]` Normalize public responses around ids, hashes, statuses, and next-step metadata.
- `[x]` Add pagination/filtering for public events, archives, communities, and result receipts.
- `[x]` Add response contracts for public API v0.
- `[x]` Add replay/rebuild checks from events plus public records.

### 3. Public Audit Promises

Goal: Critical lifecycle commitments are anchored outside the application database.

- `[x]` Define minimum public promises: question versions, stakes, flags, review decisions, result receipts, next-step rules, archives, and rewards records.
- `[x]` Wire local API lifecycle actions to local contract calls or explicit devnet commit records.
- `[x]` Add indexer path from contract events into API views.
- `[x]` Add tests proving API state matches emitted commitments.
- `[x]` Add deployment/runbook for local appchain devnet.

### 4. Community Fork And Alternate Frontend Support

Goal: Communities can leave or mirror the system with their records, rules, and presentation intact.

- `[x]` Add community export bundle that includes metadata, rules, questions, events, archives, and record lists.
- `[x]` Add fork metadata and fork event type.
- `[x]` Add community frontend config record.
- `[x]` Add import/read-only replay path for exported communities.
- `[x]` Document fork and exit expectations.

### 5. Federated Social Layer

Goal: Discussion, membership, reputation, and moderation can move across clients and community forks.

- `[x]` Add basic public discussion posts on questions.
- `[x]` Add source, pro, con, clarifying-question, and moderator-note views.
- `[x]` Add moderation log and appeal records.
- `[x]` Add portable profile identifiers.
- `[x]` Add follow/topic/community discovery data.
- `[x]` Add reputation export and replay rules.

### 6. Community Rules And Legitimacy

Goal: Communities can govern process rules without handing unlimited power to the platform.

- `[x]` Add community next-step rules with community-signal, recognized, and committed-decision levels.
- `[x]` Add formal challenge appeal flow.
- `[x]` Add juror selection and conflict-disclosure rules.
- `[x]` Add governance parameters for bonds, privacy thresholds, tally windows, and reputation decay.
- `[x]` Add treasury/reward accounting beyond local demo ledgers.
- `[x]` Add transparent community-guide powers and emergency pause rules.

### 7. Portable Voting Passes

Goal: Eligibility is private, portable, revocable, and issuer-diverse.

- `[x]` Add local voting-pass types and issuer list.
- `[x]` Add issuer suspension effects and public annotations for affected questions.
- `[x]` Add revocation root and expiry enforcement.
- `[x]` Add wallet-held voting-pass import/export boundary.
- `[x]` Add ZK membership/nullifier proof integration.
- `[x]` Add multiple issuer trust policies per community.

### 8. Private Vote Counting

Goal: The single coordinator is replaced by multi-party counting with verifiable result publication.

- `[x]` Define counting-team metadata and lifecycle.
- `[x]` Add threshold public key setup.
- `[x]` Add decryption share submission.
- `[x]` Add proof/reference validation for result publication.
- `[x]` Add committee failure and replacement flow.
- `[x]` Remove single-coordinator trust from non-demo mode.

### 9. Full Protocol/Appchain As Source Of Truth

Goal: Contracts or appchain modules become canonical; API and UI become readers of public state.

- `[x]` Choose appchain/module boundary and canonical state machines.
- `[x]` Implement canonical registry, stake, challenge, poll, tally, adoption, and archive modules.
- `[x]` Move protocol-owned database writes behind event ingestion or protocol transaction results.
- `[x]` Add independent client/indexer replay.
- `[x]` Add upgrade/governance safety model.
- `[ ]` Run public testnet with independent operators.

### 10. Community Rewards MVP

Goal: Communities can govern opt-in privacy-safe reports without exposing individual responses.

- `[x]` Add rewards-rule proposal and activation records.
- `[x]` Add member opt-in consent and future-use revocation records.
- `[x]` Add minimum-group-size report publication from public result receipts.
- `[x]` Add customer access grants with purpose and license hashes.
- `[x]` Add shared-value routing into community funds, member rewards, and operator rewards.
- `[x]` Add public API, protocol transaction records, community export references, and focused DB-backed lifecycle tests.
- `[x]` Document rewards MVP boundaries and privacy guardrails.

## Current Focus

Items 1, 2, 3, 4, 5, 6, 7, 8, and 10 are complete for the current milestone. Section 9 is almost complete: the app has a canonical appchain boundary, public action flows, Solidity modules for core flows, and a replayable public transaction feed.

In plain terms, the MVP can now ask questions, gather private votes, publish result receipts, export community records, support forks, moderate discussion, track public review decisions, manage community rules, protect voting eligibility, publish rewards reports, and let independent readers replay public state.

The final checkbox remains open until independent operators actually run the public testnet, publish evidence, and a maintainer records the launch summary. That launch package is documented in `docs/public-testnet-operator-runbook.md`, exposed at `GET /public/protocol/testnet-readiness`, and verified with `pnpm testnet:verify-attestations`.
