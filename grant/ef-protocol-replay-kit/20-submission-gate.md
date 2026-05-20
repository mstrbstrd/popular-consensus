# Submission Gate

## Purpose

This gate turns the strategy's "submit only after external replay works" checklist into machine-readable evidence. It checks the local proof points that can be verified from the repo and keeps human review requirements separate from machine evidence.

## Command

Run:

```bash
pnpm grant:submission-gate
```

The command writes:

- `artifacts/grant-demo/submission-gate-report.json`
- `artifacts/grant-demo/submission-gate-transcript.txt`

## What It Checks

The report checks that:

- `pnpm typecheck`, `pnpm test`, `pnpm contracts:build`, `pnpm grant:demo`, and `pnpm grant:crypto-hardening` are declared.
- The full lifecycle demo report is `Verified`.
- `pc-replay verify-bundle` is exposed through the replay package.
- Clean bundle replay is `Verified`.
- Tampered replay returns `Mismatch`.
- Crypto hardening evidence is `CryptoHardeningEvidenceReady` without production deployment claims.
- The grant packet passes packet lint.
- The grant scope excludes product monetization and token launch claims.
- The repo has a scoped public-good license plan.

The gate records `typecheck`, `test`, and `contracts:build` as clean-run requirements rather than pretending this report alone executed those commands. Use `pnpm grant:full-check` for the broad local run that executes typecheck, tests, contract build, API replay, chain replay, and quick grant evidence together.

## Non-Claims

This gate does not claim formal submission readiness. It deliberately keeps `formalSubmissionReady: false` until EF Office Hours or equivalent reviewer feedback is incorporated. It also does not claim production deployment readiness or production-grade private voting.

## What Other Builders Can Reuse

Other builders can reuse this gate to separate "the reproducible replay evidence exists" from "the grant is approved for submission" and avoid treating human review as a green automated check.
