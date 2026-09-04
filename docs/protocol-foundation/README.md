# Protocol foundation v0.2

Status: reviewable draft, not a production protocol release.

This work starts the privacy-first digital town square and data-union plan.
It does not replace the runnable v0.1 demo or claim to retire any existing trust
assumption. F0 established the constitution and draft policies. F1a adds a signed
question-acceptance evaluator and loopback-only legacy API startup containment.

## Start here

1. [Constitution](constitution.md): purpose, participant rights, and negative-space invariants.
2. [Decision register](decisions.md): accepted design direction versus unresolved mechanisms.
3. [Model migration](model-migration.md): schema boundaries, current-model changes, and ordered delivery gates.
4. [Invariant catalog](invariants.json): machine-readable IDs and deliberately limited enforcement status.
5. [Authorization admission](authorization-admission.md): F1a scope, real signature checks, runtime limits, and the required atomic persistence adapter.

The existing [MVP invariants](../mvp-invariants.md),
[decentralization roadmap](../decentralized-protocol-roadmap.md), and
[whitepaper](../popular-consensus-blueprint-whitepaper.md) remain useful context.
The MVP documentation describes the existing implementation. This folder specifies
its proposed successor. Where they differ, use explicit migration decisions.

## F0 policy schemas

`packages/shared/src/foundation.ts` introduces isolated, strict draft schemas for:

- question creation intent, with advisory authority and an ordered UTC window;
- contribution policies with disabled commercial use or explicit bounded opt-in;
- privacy design targets that cannot declare themselves cryptographically verified;
- fixed participation reward policies, separate from answer choice;
- aggregate-use intent requiring consent, community approval, and policy references.

These policy schemas are not imported into live routes. Prisma tables, contract
interfaces, and storage remain unchanged. Use explicit imports during migration;
do not change the meaning of the existing `CreateQuestionRequestSchema` in place.

Parsing is NOT authentication, permission, funding, cryptographic verification,
privacy protection, or a valid state transition. A supplied hash is only a
well-formed reference until its content and authority have been verified.
`PrivacyProfileDraft.assurance = DesignTarget` is intentionally not deployable
proof of privacy. No production credential, tally, consensus, payment provider,
or token is selected by these schemas.

## F1a authorization and runtime boundary

`packages/shared/src/question-authorization.ts` and
`apps/api/src/question-authorization.ts` implement a strict signed administrative
command and a side-effect-free acceptance evaluator with real Ed25519 signature
verification. The result is a proposed conditional transition, not a durable
receipt. Nonce/revision updates, key enrollment, transactional route integration,
and full authorization migration remain required. Private ballots are not forced
through public-profile authentication by this administrative command profile.

The existing `config.ts` now enforces literal loopback bindings and rejects public
runtime modes and `NODE_ENV=production`. Do not expose the legacy API through
proxies or tunnels; loopback is not authentication or a browser security boundary.
Normal local demo operation remains supported. See the admission document before
changing startup configuration or following any historical testnet runbook.

## Checks

From the repository root:

```bash
node scripts/check-protocol-foundation.mjs
node --test scripts/check-protocol-foundation.test.mjs
pnpm --filter @pc/shared test
pnpm --filter @pc/shared typecheck
pnpm --filter @pc/api exec vitest run src/question-authorization.test.ts src/runtime-policy.test.ts
pnpm exec tsx packages/shared/src/export-foundation-schemas.ts > foundation-schemas.json
```

The exporter remains a five-schema JSON Schema 2020-12 bundle for structural
interchange. It does not export the new administrative command profile yet.
Its `StructuralOnly` label is mandatory: ordinary JSON Schema does not express the
cross-field `closesAt > opensAt` rule, and none of those five schemas verifies
referenced evidence. Independent consumers must implement the semantic rules.
There are no new dependencies or changes to the existing lockfile.

CI checks the catalog, shared/privacy/artifact tests, schema export, API signature
and runtime tests, existing DB-backed API tests with disposable PostgreSQL, and
shared/API typechecking. This is not a browser, contract, cryptographic-security,
or deployment audit. Branch protection and required checks are separate settings.

## Release boundary

Whole-system invariants remain `NotIntegrated`; F1 is only partially implemented.
Do not mark a trust assumption retired or a public-utility gate complete based on
helper tests. The next slice must implement durable key/capability/nonce models
and an atomic route adapter, including concurrent delivery, rollback, recovery,
revocation races, and replay tests. Public operation stays blocked until the
legacy write and protected-read surfaces have been migrated and reviewed.
