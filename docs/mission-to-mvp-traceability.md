# Mission To MVP Traceability

This document connects the mission in `docs/popular_consensus_mission.md` to the current MVP evidence. Use it when reviewing new work: every major feature should strengthen at least one mission pillar without breaking the product promises in `docs/mvp-invariants.md`.

## Status Summary

The repo strongly supports the mission as a local demo. The main unfinished proof point is outside trust: independent public-testnet operators have not yet published evidence that they ran and checked the system.

## Mission Pillar Map

| Mission pillar | Current MVP evidence | Current gap | Next checkpoint |
| --- | --- | --- | --- |
| Trustworthy place to think together | Communities, question proposals, discussion posts, moderation logs, appeals, public feeds, and flag/edit flows. | Discussion and moderation are MVP-local; public norms and operator review are not yet proven in the wild. | Keep discussion/moderation actions backed by public records and exportable; run community-guide public-testnet drills. |
| Public utility for measuring consensus | Voting flow, voting-pass checks, combined result receipts, public civic-record APIs, and replay checks. | Representative real-world sampling depends on production voting-pass issuers and independent operators. | Complete public-testnet deployer, indexer, and replay-checker evidence files. |
| Rewards value return | Opt-in reward rules, consent/revocation, combined-result reports, approved customer access, and community/member/helper ledger splits. | Payments are local PC accounting; member claim distribution and external payment settlement are later work. | Define claim mechanics, customer eligibility, use-term checks, and question-author revenue treatment. |
| Transparency and verifiability | Content-addressed records, protocol transaction feed, replay endpoints, community exports, fork metadata, and public promise records. | Full source-of-truth status still needs independent replay over a public testnet. | Require matching replay hashes from three independent replay checkers. |
| Cannot be captured | Community export/fork paths, upgrade-safety model, community-signal-by-default status, and explicit next-step rules. | Community ownership and governance transition are not yet operationally complete. | Add a concrete governance transition plan and complete public community-guide review. |
| Every voice is a real person | Voting-pass types, issuer list, revocation roots, trust policies, duplicate-vote blockers, and anonymous ZK proof boundary. | Production human-verification issuers and real voting-pass ceremony are not established. | Specify issuer policy, voting-pass ceremony, revocation governance, and privacy/security review. |
| Privacy by design | Encrypted votes, duplicate-vote protection, anonymous ZK production vote path, private record gating, rewards aggregate-only reports, and production demo-mode guards. | Semaphore issuer/prover ceremony and cryptographic assurance remain outside local tests. | Run a production-like voting-pass/proof ceremony and obtain external privacy review. |
| Community self-governance | Next-step rules, governance parameters, community-guide powers, emergency pause, juror selection, conflict disclosures, and appeal records. | Early guiding-board-to-community handoff is not yet specified as a milestone plan. | Document governance transition stages, powers, eligibility, and emergency limits. |
| Participants share in what they create | Rewards ledger, participant pool credits, proposal/flag rewards, and non-transferable reputation exports. | Mission-level economic dignity requires real distribution, not just ledger accounting. | Implement participant claims, question-author royalties, and auditable payment reports. |

## Review Rule

Before marking a major milestone complete, confirm:

- the feature maps to at least one mission pillar above;
- the relevant invariant in `docs/mvp-invariants.md` still holds;
- the roadmap or audit command names the evidence path;
- privacy, rewards, and governance changes expose public receipts or replayable records where possible;
- claims about production legitimacy are backed by public-testnet evidence, not only local tests.
