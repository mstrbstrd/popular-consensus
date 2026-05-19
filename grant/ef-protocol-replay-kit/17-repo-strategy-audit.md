# Repo Strategy Audit

## Purpose

This audit maps the repo strategy to machine-readable evidence. It gives reviewers one place to check whether the monorepo stayed intact, the protocol/platform boundary is enforced, the grant packet exists, replay is independently verifiable, and the platform is not treated as the source of protocol truth.

## Command

Run:

```bash
pnpm grant:repo-strategy-audit
```

The command writes:

- `artifacts/grant-demo/repo-strategy-audit-report.json`
- `artifacts/grant-demo/repo-strategy-audit-transcript.txt`

## Requirements Checked

The report checks:

- monorepo kept intact for grant-readiness
- protocol/platform boundary documented and executable
- EF grant packet created and linted
- one-command backend lifecycle demo exists
- standalone replay verifier exists for bundle, API, chain, and tamper paths
- API replay and local-chain replay evidence exist
- replay test vectors exist for clean and tampered cases
- contract module split/access-control evidence exists
- crypto and threshold custody non-claims remain explicit
- reviewer handoff and review readiness evidence exist
- platform is not the protocol source of truth
- license boundary is scoped and not monorepo-wide

## Non-Claims

This audit does not mark the project formally submission-ready or production deployment-ready. It records the strategy evidence that exists now and keeps external cryptography review, production threshold ceremony/custody evidence, and EF feedback as human blockers.

## What Other Builders Can Reuse

Other builders can reuse this audit shape to turn a repo strategy into explicit review requirements with evidence paths, pass/fail status, and non-claims.
