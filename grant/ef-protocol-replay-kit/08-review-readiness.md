# Review Readiness

This checklist is the hostile-review pass for the grant-facing protocol slice. It separates evidence that exists now from evidence that still needs to be produced before a formal EF submission.

## Current Evidence

| Criterion | Current status | Evidence |
| --- | --- | --- |
| Technical approach | Pass for deterministic backend replay slice | `pnpm grant:check`, `artifacts/grant-demo/full-lifecycle-report.json` |
| Replay verifier | Pass for production-slice and artifact-bundle verification | `@pc/replay`, `pnpm replay:verify`, replay tests |
| Public API replay verifier | Pass for CLI/schema/check implementation | `pc-replay verify-api`, `packages/replay/src/index.test.ts` |
| Live seeded API replay evidence | Pass locally | `pnpm grant:api-replay`, `artifacts/grant-demo/api-replay-report.json` |
| Onchain event adapter | Pass for grant-critical decoded Solidity events | `packages/replay/src/onchainEventAdapter.ts`, adapter tests |
| Chain replay CLI | Pass for command wiring and deterministic decoded-log verification | `pc-replay verify-chain`, `packages/replay/src/verifyChain.ts`, chain replay tests |
| Live local-chain replay evidence | Pass locally | `pnpm grant:chain-replay`, `artifacts/grant-demo/chain-replay-report.json`, `artifacts/grant-demo/chain-replay-transcript.txt` |
| Contract event alignment | Pass for full grant-critical Solidity lifecycle log assertions | `testFullProtocolLifecycleEmitsReplayableEvents`, `pnpm --filter @pc/contracts test` |
| Cryptography evidence inventory | Pass for local evidence checks plus explicit production non-claims | `pnpm grant:crypto-review`, `artifacts/grant-demo/crypto-review-report.json`, `grant/ef-protocol-replay-kit/11-cryptography-review.md` |
| Threshold custody hardening | Pass for threshold committee/share malformed-case evidence plus production DKG non-claims | `pnpm grant:threshold-custody`, `artifacts/grant-demo/threshold-custody-report.json`, `grant/ef-protocol-replay-kit/15-threshold-custody-hardening.md` |
| Replay test vectors | Pass for checked clean and tampered JSON fixtures | `pnpm grant:replay-test-vectors`, `packages/replay/test/fixtures/*.json`, `artifacts/grant-demo/replay-test-vectors-report.json` |
| Contract access control | Pass for split modules, steward guards, unauthorized-call tests, and production custody non-claims | `pnpm grant:contract-hardening`, `testStewardGuardsRejectUnauthorizedCoordinatorActions`, `artifacts/grant-demo/contract-hardening-report.json`, `grant/ef-protocol-replay-kit/13-contract-hardening-status.md` |
| Grant packet lint | Pass for short docs, reusable-builder sections, abstract scope hygiene, and quick/full command docs | `pnpm grant:packet-lint`, `artifacts/grant-demo/packet-lint-report.json` |
| Reviewer handoff | Pass for command dependency classification and reproducibility handoff | `pnpm grant:reviewer-handoff`, `artifacts/grant-demo/reviewer-handoff-report.json`, `grant/ef-protocol-replay-kit/14-reviewer-handoff.md` |
| Repo strategy audit | Pass for machine-readable mapping from repo strategy requirements to current evidence | `pnpm grant:repo-strategy-audit`, `artifacts/grant-demo/repo-strategy-audit-report.json`, `grant/ef-protocol-replay-kit/17-repo-strategy-audit.md` |
| External review index | Pass for compact reviewer table of contents over commands, reports, statuses, hashes, and blockers | `pnpm grant:external-review-index`, `artifacts/grant-demo/external-review-index.json`, `artifacts/grant-demo/external-review-index.md` |
| Grant track issue draft | Pass for local coordination handoff; public issue creation remains a maintainer action | `grant/ef-protocol-replay-kit/19-grant-track-issue.md` |
| Submission gate | Pass for machine-readable pre-submit criteria, with EF feedback still blocking formal submission | `pnpm grant:submission-gate`, `artifacts/grant-demo/submission-gate-report.json`, `grant/ef-protocol-replay-kit/20-submission-gate.md` |
| Protocol package publication status | Pass for source reuse and license evidence; npm publication readiness remains a non-claim | `pnpm grant:protocol-publication`, `artifacts/grant-demo/protocol-publication-report.json`, `grant/ef-protocol-replay-kit/21-protocol-package-publication.md` |
| Evidence manifest | Pass for SHA-256 manifest of docs, generated reports, transcripts, test vectors, source, and grant scripts | `pnpm grant:evidence-manifest`, `artifacts/grant-demo/evidence-manifest.json` |
| Machine-readable review readiness | Pass for required files, reports, license boundary, evidence statuses, and documented human blockers | `pnpm grant:review-readiness`, `artifacts/grant-demo/review-readiness-report.json`, `grant/ef-protocol-replay-kit/12-external-review-intake.md` |
| Tamper detection | Pass for result-hash tamper, reordered events, missing archive root, and duplicate nullifier checks | `packages/replay/src/index.test.ts`, generated report tamper section |
| Protocol/platform boundary | Pass for current package manifests and imports | `pnpm protocol:boundary:check` |
| License boundary | Pass for scoped protocol/package/docs/artifact terms | `LICENSE-BOUNDARY.md`, `LICENSE-PROTOCOL-MIT`, protocol package metadata, grant/artifact license files |
| Grant packet legibility | Pass for short scope, boundary, schema, replay, threat, demo, milestone, and office-hours docs | `grant/ef-protocol-replay-kit/*.md` |
| Contract compilation | Pass locally | `pnpm contracts:build` |
| Repo tests | Pass locally | `pnpm test` |

## Known Submission Gaps

| Gap | Why it matters | Next action |
| --- | --- | --- |
| External cryptography review and threshold ceremony | Current slice has local evidence and non-claims, not an external audit or production threshold custody process | Add reviewed threshold decryption implementation, key custody ceremony notes, external review notes, and test vectors |
| Office Hours feedback | Brief exists, feedback is not yet incorporated | Take EF alignment call and update scope before formal submission |

## Submission Gate

Do not submit the formal grant until these commands pass from a clean checkout:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm contracts:build
pnpm grant:check
pnpm grant:api-replay
pnpm grant:chain-replay
pnpm grant:crypto-review
pnpm grant:threshold-custody
pnpm grant:replay-test-vectors
pnpm grant:contract-hardening
pnpm grant:packet-lint
pnpm grant:reviewer-handoff
pnpm grant:repo-strategy-audit
pnpm grant:submission-gate
pnpm grant:protocol-publication
pnpm grant:external-review-index
pnpm grant:evidence-manifest
pnpm grant:review-readiness
pnpm grant:full-check
```

`pnpm grant:full-check` is the broad local shortcut for the same gate. It requires local Postgres because it includes `pnpm grant:api-replay`.

The current repo now satisfies the first grant-readiness slice, local API replay evidence, chain verifier command wiring, local-chain replay evidence, Foundry lifecycle event assertions, scoped public-good license files, local cryptography evidence inventory, and machine-readable review readiness. It does not yet satisfy the full submission gate because external cryptography review/threshold ceremony evidence and EF feedback remain open.

## What Other Builders Can Reuse

Other builders can reuse this readiness checklist as an evidence-based review gate for replayable civic-record protocols.
