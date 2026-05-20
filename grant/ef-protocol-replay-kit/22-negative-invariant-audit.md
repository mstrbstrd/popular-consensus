# Negative Invariant Audit

## Purpose

This audit is the hostile-review pass for the protocol replay kit. It checks the things the grant path must not do: import platform code into protocol packages, make the platform the source of truth, creep product or data-union monetization into the grant evidence, center tokenomics, overclaim production privacy, blur license boundaries, or require the web client for grant demos.

## Command

Run:

```bash
pnpm grant:negative-invariants
```

The command writes:

- `artifacts/grant-demo/negative-invariant-report.json`
- `artifacts/grant-demo/negative-invariant-transcript.txt`

## What It Checks

The report checks:

- protocol manifests and source imports do not depend on `@pc/api`, `@pc/web`, `@pc/db`, `apps/api`, `apps/web`, or `packages/db`
- grant scripts do not import or run the web client, Playwright, Next, React, or e2e flows
- grant package scope excludes paid reports, customer workflows, token launch, and data-union monetization
- replay/export fixtures do not contain product monetization or data-union records
- generated readiness reports keep `formalSubmissionReady: false` and `productionDeploymentReady: false`
- crypto and threshold docs keep production non-claims explicit
- license files keep protocol, packet, artifact, and platform boundaries separate
- replay remains the source of trust over the application database

## Findings Model

The audit may acknowledge legacy product-adjacent schemas elsewhere in the monorepo, but the grant path fails if those records appear in the replay kit exports, fixtures, or grant demo reports.

## Non-Claims

This audit does not approve production deployment, EF submission, npm publication, or production-grade cryptography. It only checks that the grant-review slice preserves the intended negative space.

## What Other Builders Can Reuse

Other builders can reuse this audit shape to make "must not" constraints executable instead of leaving them as prose in a strategy document.
