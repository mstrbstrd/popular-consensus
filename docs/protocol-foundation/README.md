# Protocol foundation v0.2

Status: reviewable draft, not a production protocol release.

This work starts the privacy-first digital town square and data-union plan.
F0 established the constitution and draft policies. F1a added signed question
acceptance evaluation and loopback-only legacy startup. F1b adds a narrow local
HTTP service that applies this operation atomically to a separate admission
store. It does not replace the v0.1 demo or retire its trust assumptions.

## Start here

1. [Constitution](constitution.md): purpose, participant rights, negative-space invariants.
2. [Decision register](decisions.md): agreed direction versus unresolved mechanisms.
3. [Model migration](model-migration.md): boundaries, model changes and ordered gates.
4. [Invariant catalog](invariants.json): whole-system guarantees remain NotIntegrated.
5. [Authorization admission](authorization-admission.md): original F1a evaluator and contract.
6. [Transactional admission](transactional-admission.md): F1b implementation, local operation, tests and remaining trust.

The existing [MVP invariants](../mvp-invariants.md),
[decentralization roadmap](../decentralized-protocol-roadmap.md) and
[whitepaper](../popular-consensus-blueprint-whitepaper.md) remain context.
Where implementation and successor specifications differ, use explicit migration
decisions, not silent upgrades of historical records or readiness claims.

## Implemented boundaries

`packages/shared/src/foundation.ts` defines five strict draft policy/intent
schemas. Parsing does not establish consent, funding, signatures or actual
privacy. A supplied hash is a reference, not proof that its evidence was reviewed.
No production credential, tally, consensus, payment provider or token is selected.

`packages/shared/src/question-authorization.ts` and
`apps/api/src/question-authorization.ts` implement a strict administrative
Ed25519 command and side-effect-free guard. Alone this proposes a transition; it
does not consume a nonce or write state. Private ballots are not forced through
this attributable administrative signature profile.

`apps/api/src/question-admission.ts` now resolves persisted authority/state and
atomically applies this one transition. `apps/api/src/admission-server.ts` exposes
its strict versioned endpoint without importing any legacy routes. Models and
reviewed SQL migrations live in `packages/db/prisma-admission`; the database must
be separate from the legacy demo. Bootstrap is an explicit trusted local CLI,
not decentralized enrollment or an HTTP authority shortcut. Receipts identify
their trust profile as LocalDatabase.

Legacy API DTOs, tables, contracts and browser flows are not migrated. Normal
local demo operation remains supported. Both service startup paths remain local
only. Do not expose the legacy API through proxies/tunnels or follow historical
public-testnet runbooks. Loopback does not repair legacy authorization or CORS.

## Checks

From the repository root, with separate disposable local databases configured:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:admission:migrate
node scripts/check-protocol-foundation.mjs
node --test scripts/check-protocol-foundation.test.mjs
pnpm --filter @pc/shared test
pnpm --filter @pc/shared typecheck
RUN_DB_TESTS=true pnpm --filter @pc/api test
pnpm --filter @pc/api typecheck
pnpm exec tsx packages/shared/src/export-foundation-schemas.ts > foundation-schemas.json
```

Read the transactional admission document before configuring the database or
bootstrap. Do not run disposable test reset operations against retained data.
The original db:migrate remains the legacy demo's db push. Admission uses actual
versioned migrate deploy. No live database is changed by committing this code.

The exporter still contains five StructuralOnly JSON Schemas, not the complete
administrative command/receipt profile or cross-field semantic guarantees.
No dependencies or lockfile versions changed.

CI checks catalog/shared/privacy/artifact tests; migration application,
reapplication and drift; real PostgreSQL admission and legacy API tests; and
shared/API typechecking. This is not a browser, contract, independent crypto,
full backup/restore or deployment audit. Branch protection is a separate setting.

## Release boundary

F1 is partially implemented. No whole-system invariant or public-utility gate is
complete. The next slice is protocol-governed key/capability lifecycle, explicit
migration provenance and signed application integration. The current admission
bootstrap/database operator is still trusted; canonical ordering, eligibility,
private tally, data-use consent and rewards remain separate unfinished gates.
