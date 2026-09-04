# Protocol foundation v0.2

Status: reviewable draft, not a production protocol release.

This is the first implementation slice of the privacy-first digital town square
and data-union plan. It does not replace the runnable v0.1 demo or claim to retire
any existing trust assumption.

## Start here

1. [Constitution](constitution.md): purpose, participant rights, and negative-space invariants.
2. [Decision register](decisions.md): accepted design direction versus unresolved mechanisms.
3. [Model migration](model-migration.md): schema boundaries, current-model changes, and ordered delivery gates.
4. [Invariant catalog](invariants.json): machine-readable IDs and deliberately limited enforcement status.

The existing [MVP invariants](../mvp-invariants.md),
[decentralization roadmap](../decentralized-protocol-roadmap.md), and
[whitepaper](../popular-consensus-blueprint-whitepaper.md) remain useful context.
The MVP documentation describes the existing implementation. This folder specifies
its proposed successor. Where they differ, use explicit migration decisions;
do not claim that adding this folder changes running behavior.

## What this slice actually implements

`packages/shared/src/foundation.ts` introduces isolated, strict draft schemas for:

- question creation intent, with advisory authority and an ordered UTC window;
- contribution policies with disabled commercial use or explicit bounded opt-in;
- privacy design targets that cannot declare themselves cryptographically verified;
- fixed participation reward policies, separate from answer choice;
- aggregate-use intent requiring consent, community approval, and policy references.

Existing API DTOs, Prisma tables, contract interfaces, demo routes, and storage are
unchanged. The new schemas are not imported into the application entrypoint. Use
an explicit import from `packages/shared/src/foundation.ts` during migration; do
not change the meaning of the existing `CreateQuestionRequestSchema` in place.

Parsing is NOT authentication, permission, funding, cryptographic verification,
privacy protection, or a valid state transition. A supplied hash is only a
well-formed reference until its content and authority have been verified.
`PrivacyProfileDraft.assurance = DesignTarget` is intentionally not deployable
proof of privacy. No credential, tally, consensus, payment provider, or token is
selected by these schemas.

## Checks

From the repository root:

```bash
node scripts/check-protocol-foundation.mjs
node --test scripts/check-protocol-foundation.test.mjs
pnpm --filter @pc/shared exec vitest run src/foundation.test.ts
pnpm --filter @pc/shared test
pnpm --filter @pc/shared typecheck
pnpm exec tsx packages/shared/src/export-foundation-schemas.ts > foundation-schemas.json
```

The exporter produces a JSON Schema 2020-12 bundle for structural interchange.
Its `StructuralOnly` label is mandatory: ordinary JSON Schema does not express the
cross-field `closesAt > opensAt` rule, and none of the schemas verifies referenced
evidence. Independent consumers must also implement the published semantic rules.
There are no new dependencies or changes to the existing lockfile.

`Protocol foundation / shared-schema-contracts` runs the catalog check, shared
unit tests, shared type checking, and schema export on pull requests. It is not a
full API/database, browser, contract, cryptography, or deployment audit. Branch
protection and required checks are separate repository settings, not enabled by
adding a workflow file.

## Merge boundary

This PR establishes reviewable purpose and schema-level rejection behavior only.
Do not mark a runtime invariant enforced, a trust assumption retired, or a public
utility gate complete on the strength of these checks. The next implementation
slice must add authenticated actor context and executable transition guards,
with compatibility adapters and adversarial integration tests.
