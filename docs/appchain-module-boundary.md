# Appchain Module Boundary

This document records the first canonical source-of-truth boundary for the Popular Consensus MVP. The public machine-readable version is exposed at:

- `GET /public/protocol/appchain-boundary`
- Shared schema: `CanonicalProtocolBoundarySchema`
- Schema version: `canonical-appchain-boundary-v0`

The goal is to make the API and frontend behave like clients/indexers of protocol state before the database writes are fully moved behind appchain transaction results.

## Canonical Modules

| Module | Owns | Public indexes |
| --- | --- | --- |
| `QuestionRegistry` | Question versions, question lifecycle state, archive eligibility, fork references. | Questions, civic records, archives, community exports. |
| `StakeManager` | Proposal, challenge, appeal, reward, refund, slash, and treasury ledger accounting. | Treasury ledger, civic records, community exports. |
| `ChallengeCourt` | Question/result challenges, juror assignment, conflict disclosure, rulings, and appeals. | Civic records, challenge appeals, juror assignments, community exports. |
| `PollManager` | Poll configuration, open/close state, ballot commitments, nullifiers, encrypted payload hashes. | Civic records, community exports. |
| `TallyManager` | Tally committee lifecycle, threshold public keys, decryption shares, publication proof references. | Tally committees, tally key setups, decryption shares, result artifacts, community exports. |
| `AdoptionRegistry` | Adoption policies, governance parameters, steward powers, emergency suspensions. | Governance parameters, steward powers, community exports. |
| `ResultArchive` | Result artifact commitments, result finalization, archive manifests, export roots. | Result artifacts, archives, archive exports, community exports. |
| `CredentialRegistry` | Credential schemas, issuer registry, credential issuance, credential revocations, issuer suspension, revocation roots, community trust policies. | Credential trust policies, civic records, community exports. |
| `DataUnionRegistry` | Data-union policies, member consent records, aggregate data products, buyer access grants, and commercial aggregate revenue splits. | Data-union views, treasury ledger, result artifacts, community exports. |
| `SocialGraph` | Profiles, discussion records, moderation records, follows, reputation events. | Profile records, discussion/moderation views, discovery, reputation, community exports. |

## Canonical State Machines

The boundary defines six MVP state machines:

- `question-lifecycle-v0`
- `poll-lifecycle-v0`
- `tally-lifecycle-v0`
- `bond-lifecycle-v0`
- `adoption-policy-lifecycle-v0`
- `archive-lifecycle-v0`

Every transition names:

- source and destination state
- canonical event type
- owning module
- guard condition
- protocol fields written by the transition

This is intentionally stricter than the current database model. It gives the next implementation slice a concrete target: each state-changing API action should become either a protocol transaction or a direct result of indexed protocol events.

## Implementation Status

The canonical registry, stake, challenge, poll, tally, adoption, archive, credential, social, and data-union modules are represented in the shared boundary. The canonical Solidity suite still implements the original registry, stake, challenge, poll, tally, adoption, and archive modules in `packages/contracts/src/PopularConsensus.sol`; `DataUnionRegistry` is currently implemented as local protocol transaction results, artifacts, and public API/indexer state. Registry events are now backed by local protocol transaction results exposed at `GET /registry/protocol-transactions`, which is the first bridge toward event ingestion. Protocol-owned API writes now pre-build and ingest protocol transaction results inside the database transaction before their domain rows are persisted across question registry, stake/bond, challenge court, poll manager, tally manager, adoption registry, result/archive, credential registry, data-union registry, social graph, and reputation flows. Wallet credential import/export remains an explicit client-wallet boundary/cache rather than a canonical credential issuance path. Independent clients can replay the protocol transaction feed through `GET /registry/protocol-transactions/replay`, verify payload/event/result hashes and canonical module membership, and rebuild per-module/per-subject heads without reading domain tables. Communities can inspect `GET /communities/:communityId/governance/upgrade-safety` for proposal-artifact gates, effective-at activation delay, replay requirements, emergency pause limits, fork/exit guarantees, and the still-pending public testnet operator gate. The data-union MVP is documented in `docs/data-union-mvp.md`. The public testnet operator launch package is documented in `docs/public-testnet-operator-runbook.md`; the final source-of-truth gate remains open until independent operators run the network and publish attestations.
