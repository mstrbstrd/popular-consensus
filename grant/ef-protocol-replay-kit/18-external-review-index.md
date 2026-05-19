# External Review Index

## Purpose

This index is the reviewer-facing table of contents for generated evidence. It names the commands to run, the local dependencies each command needs, the reports that should exist, their expected statuses, and the human blockers that still prevent formal submission or production deployment claims.

## Command

Run:

```bash
pnpm grant:external-review-index
```

The command writes:

- `artifacts/grant-demo/external-review-index.json`
- `artifacts/grant-demo/external-review-index.md`

The JSON report also records a source snapshot with the current Git branch, HEAD commit, dirty-worktree flag, status entry count, and a short `git status --short` preview. That makes it clear whether the evidence was generated from a committed review candidate or from an in-progress local worktree.

## What It Checks

The generated index checks the main evidence reports:

- full lifecycle demo
- API replay
- chain replay
- cryptography review
- threshold custody hardening
- replay test vectors
- contract hardening
- packet lint
- reviewer handoff
- repo strategy audit

Each report must have the expected status and, where it exposes check counts, all checks must pass.

## Non-Claims

The index deliberately keeps `formalSubmissionReady: false` and `productionDeploymentReady: false`. It is a reviewer handoff artifact, not an audit, deployment approval, or EF submission approval.

## What Other Builders Can Reuse

Other builders can reuse this index pattern to package replay evidence as a small, navigable handoff instead of asking reviewers to infer the evidence graph from scripts and generated files.
