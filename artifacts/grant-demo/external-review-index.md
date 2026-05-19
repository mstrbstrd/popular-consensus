# External Review Index

Status: ExternalReviewIndexReady
Formal submission ready: false
Production deployment ready: false

## Source Snapshot

Git available: true
Branch: codex/north-star-roadmap
HEAD: de4fbb6e35237bf15d25ee641782192685874dfa
Dirty worktree: false
Status entries: 0

## Reviewer Commands

| Command | Dependency mode | Purpose |
| --- | --- | --- |
| `pnpm grant:check` | `no-local-services` | Regenerate the deterministic protocol slice, machine evidence, reviewer handoff, strategy audit, manifest, and replay tests. |
| `pnpm grant:api-replay` | `local-postgres` | Drive the public API lifecycle and verify civic-record/replay-check endpoints through @pc/replay. |
| `pnpm grant:chain-replay` | `ephemeral-anvil` | Deploy protocol modules locally and verify decoded Solidity logs through @pc/replay. |
| `pnpm grant:full-check` | `local-postgres-and-ephemeral-anvil` | Run typecheck, tests, contract build, API replay, chain replay, and the quick grant gate. |

## Evidence Reports

| Evidence | Status | Checks | Path |
| --- | --- | ---: | --- |
| full-lifecycle | Verified | 105/105 | `artifacts/grant-demo/full-lifecycle-report.json` |
| api-replay | Verified | 10/10 | `artifacts/grant-demo/api-replay-report.json` |
| chain-replay | Verified | 31/31 | `artifacts/grant-demo/chain-replay-report.json` |
| crypto-review | EvidenceReady | 12/12 | `artifacts/grant-demo/crypto-review-report.json` |
| threshold-custody | ThresholdCustodyEvidenceReady | 10/10 | `artifacts/grant-demo/threshold-custody-report.json` |
| replay-test-vectors | ReplayTestVectorsReady | 5/5 | `artifacts/grant-demo/replay-test-vectors-report.json` |
| contract-hardening | ContractHardeningEvidenceReady | 57/57 | `artifacts/grant-demo/contract-hardening-report.json` |
| packet-lint | PacketReady | 65/65 | `artifacts/grant-demo/packet-lint-report.json` |
| reviewer-handoff | ReviewerHandoffReady | 12/12 | `artifacts/grant-demo/reviewer-handoff-report.json` |
| repo-strategy-audit | RepoStrategyEvidenceReady | 15/15 | `artifacts/grant-demo/repo-strategy-audit-report.json` |
| submission-gate | SubmissionGateEvidenceReady | 14/14 | `artifacts/grant-demo/submission-gate-report.json` |
| protocol-publication | ProtocolPackagePublicationEvidenceReady | 36/36 | `artifacts/grant-demo/protocol-publication-report.json` |

## Human Blockers

- External cryptography review has not been completed.
- Production threshold ceremony/custody evidence has not been completed.
- Production decryption-share proof system has not been externally reviewed.
- EF Office Hours or equivalent reviewer feedback has not been incorporated.
