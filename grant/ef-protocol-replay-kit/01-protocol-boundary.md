# Protocol Boundary

## Principle

The platform may present, explain, and operate the protocol. It must not be the source of protocol truth.

## Protocol Owns

- Question and poll lifecycle events.
- Credential issuer and trust policy records.
- Encrypted ballot commitments and duplicate-vote nullifiers.
- Result artifacts and tally proof references.
- Challenge, finalization, archive, export, and replay records.
- Artifact manifests and content hashes.
- Contract event alignment and anchoring assumptions.

## Platform Owns

- Social feed and profile UX.
- Customer/reporting workflows.
- Rewards dashboard UX.
- Moderation and onboarding screens.
- Product copy and discovery.

## Dependency Direction

```text
platform -> protocol -> artifacts/contracts/replay
```

Platform may depend on protocol. Protocol must not depend on platform.

Protocol packages must not import web components, product analytics, customer reports, or rewards UI.

## Executable Guardrail

```bash
pnpm protocol:boundary:check
```

The boundary check scans protocol package manifests and source imports to reject dependencies on `@pc/api`, `@pc/web`, `@pc/db`, or relative imports into `apps/api`, `apps/web`, and `packages/db`.

## What Other Builders Can Reuse

Builders can use the protocol packages as a verification library and public-record toolkit without importing the Popular Consensus web application.
