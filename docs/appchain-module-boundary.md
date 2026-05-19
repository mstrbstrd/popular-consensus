# Appchain Source Of Truth

Popular Consensus needs one dependable public record of what happened. This document describes the first MVP boundary for that source of truth: which part of the protocol owns each kind of action, and which public views people can check.

The machine-readable version is exposed at:

- `GET /public/protocol/appchain-boundary`
- Shared schema: `CanonicalProtocolBoundarySchema`
- Schema version: `canonical-appchain-boundary-v0`

The goal is simple: the website and API should read from public protocol facts instead of quietly trusting private database writes.

## Protocol Areas

| Technical module | Plain responsibility | Public views |
| --- | --- | --- |
| `QuestionRegistry` | Keeps the question text, status, edits, export history, and fork references. | Questions, civic records, archives, community exports. |
| `StakeManager` | Tracks proposal stakes, flags, appeals, refunds, rewards, and community funds. | Treasury ledger, civic records, community exports. |
| `ChallengeCourt` | Handles flags, evidence, reviewer selection, conflicts, decisions, and appeals. | Civic records, challenge appeals, reviewer assignments, community exports. |
| `PollManager` | Opens and closes voting, accepts one private vote per eligible person, and stores vote proofs. | Civic records, community exports. |
| `TallyManager` | Counts private votes, checks proof references, and supports multi-person counting ceremonies. | Counting setup, proof records, result receipts, community exports. |
| `AdoptionRegistry` | Stores community rules, next-step rules, guide powers, and emergency pauses. | Rule records, guide powers, community exports. |
| `ResultArchive` | Stores final result receipts, archive packages, and export roots. | Result receipts, archives, archive exports, community exports. |
| `CredentialRegistry` | Tracks voting-pass types, issuers, revocations, suspensions, and community trust rules. | Voting-pass trust records, civic records, community exports. |
| `DataUnionRegistry` | Tracks opt-in consent, privacy-safe reports, approved customers, and shared value. | Rewards views, treasury ledger, result receipts, community exports. |
| `SocialGraph` | Stores profiles, discussion, moderation, follows, and reputation events. | Profile records, discussion views, discovery, reputation, community exports. |

## Expected Action Flows

The boundary defines six MVP action flows:

- `question-lifecycle-v0`
- `poll-lifecycle-v0`
- `tally-lifecycle-v0`
- `bond-lifecycle-v0`
- `adoption-policy-lifecycle-v0`
- `archive-lifecycle-v0`

Every step names:

- source and destination state
- canonical event type
- owning module
- guard condition
- protocol fields written by the transition

This is intentionally stricter than the current database model. It gives the next implementation slice a concrete target: every action that changes public state should become either a protocol transaction or a direct result of indexed protocol events.

## Implementation Status

The shared boundary now represents question flow, stakes, flags, voting, counting, next-step rules, archives, voting passes, rewards, social features, and reputation.

The Solidity suite now splits the core protocol modules into separate files under `packages/contracts/src`, with `PopularConsensus.sol` kept as an aggregate import entrypoint for compatibility. Rewards-report records are currently implemented through local protocol transaction results, stored records, and public API/indexer state.

Registry events are backed by local protocol transaction results exposed at `GET /registry/protocol-transactions`. Independent clients can replay those records through `GET /registry/protocol-transactions/replay`, verify hashes, and rebuild public state without reading private database tables.

Communities can inspect `GET /communities/:communityId/governance/upgrade-safety` for upgrade gates, activation delays, replay requirements, emergency pause limits, fork/exit guarantees, and the still-pending public testnet operator gate. The rewards MVP is documented in `docs/data-union-mvp.md`. The public testnet operator launch package is documented in `docs/public-testnet-operator-runbook.md`.

The final source-of-truth gate remains open until independent operators run the network and publish evidence.
