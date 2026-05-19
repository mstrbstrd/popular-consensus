# Mission To MVP Traceability

This document connects the mission in `docs/popular_consensus_mission.md` to the current MVP evidence. Use it when reviewing new work: every major feature should strengthen at least one mission pillar without violating `docs/mvp-invariants.md`.

## Status Summary

The repo strongly supports the mission as a local protocol MVP. The main unfinished proof point is external legitimacy: independent public-testnet operators have not yet published attestations.

## Mission Pillar Map

| Mission pillar | Current MVP evidence | Current gap | Next checkpoint |
| --- | --- | --- | --- |
| Trustworthy place to think together | Communities, question proposals, discussion posts, moderation logs, appeals, public feeds, and challenge/amendment flows. | Discussion and moderation are MVP-local; public norms and operator review are not yet proven in the wild. | Keep discussion/moderation actions artifact-backed and exportable; run community-steward public-testnet drills. |
| Public utility for measuring consensus | Poll lifecycle, credential-gated voting, aggregate result artifacts, public civic-record APIs, and replay checks. | Representative real-world sampling depends on production credential issuers and independent operators. | Complete public-testnet deployer, indexer, and replay-verifier attestations. |
| Data Union value return | Opt-in data-union policies, consent/revocation, aggregate-only products, buyer access grants, and treasury/participant/operator ledger splits. | Payments are local PC accounting; participant claim distribution and external settlement are later work. | Define payout/claim mechanics, buyer eligibility, licensing checks, and poll-author revenue treatment. |
| Transparency and verifiability | Content-addressed artifacts, protocol transaction feed, replay endpoints, community exports, fork metadata, and public commitment records. | Full source-of-truth status still needs independent replay over a public testnet. | Require matching replay hashes from three independent replay verifiers. |
| Cannot be captured | Community export/fork paths, upgrade-safety model, advisory-by-default authority, and explicit adoption policies. | Community ownership and governance transition are not yet operationally complete. | Add a concrete governance transition plan and complete public steward review. |
| Every voice is a real person | Credential schemas, issuer registry, revocation roots, trust policies, nullifiers, and anonymous ZK proof boundary. | Production human-verification issuers and real credential ceremony are not established. | Specify issuer policy, credential ceremony, revocation governance, and privacy/security review. |
| Privacy by design | Encrypted ballots, nullifier duplicate protection, anonymous ZK production vote path, private artifact gating, data-union aggregate-only products, and production demo-mode guards. | Semaphore issuer/prover ceremony and cryptographic assurance remain outside local tests. | Run a production-like credential/proof ceremony and obtain external privacy review. |
| Community self-governance | Adoption policies, governance parameters, steward powers, emergency suspension, juror selection, conflict disclosures, and appeal records. | Early guiding-board-to-community handoff is not yet specified as a milestone plan. | Document governance transition stages, powers, eligibility, and emergency limits. |
| Participants share in what they create | Data-union revenue ledger, participant pool credits, proposal/challenge rewards, and non-transferable reputation exports. | Mission-level economic dignity requires real distribution, not just ledger accounting. | Implement participant claims, poll-author royalties, and auditable payout reports. |

## Review Rule

Before marking a major milestone complete, confirm:

- the feature maps to at least one mission pillar above;
- the relevant invariant in `docs/mvp-invariants.md` still holds;
- the roadmap or audit command names the evidence path;
- privacy, data-union, and governance changes expose public hashes or replayable records where possible;
- claims about production legitimacy are backed by public-testnet attestations, not only local tests.
