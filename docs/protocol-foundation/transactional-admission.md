# F1b: transactional local signed admission

Status: local development implementation, not public readiness or complete F1.

## What is actually enforced

`POST /v0.2/commands/accept-question` in `apps/api/src/admission-server.ts`
applies the F1a evaluator to persisted local state. It resolves the principal,
public verification key, community, question and capabilities from a dedicated
Prisma/PostgreSQL store. No caller-supplied snapshot or legacy account role is
trusted. There is no HTTP bootstrap, key-enrollment or permission-grant route.

A successful transaction changes the question from Submitted to Accepted,
increments its revision, consumes one principal nonce, stores the original
signed administrative command and minimal receipt, and appends one matching
event. All effects commit together. A response is returned only after commit.

The signed admission service does NOT import the legacy server or operate on
its Question/UserAccount/Credential tables. Its database is explicitly separate.
This prevents a legacy actor-ID endpoint from mutating the new admission state.
It also means this is NOT an in-place migration of the old acceptance endpoint,
not an update to the existing web UI, and not an accepted v0.1 poll opening.
The legacy demonstration remains unchanged and must remain isolated.

## Negative-space requirements and evidence

| Requirement | Evidence in `question-admission.test.ts` |
| --- | --- |
| No partial state or consumed nonce after failure | A database trigger forces event insertion to fail after preceding writes; all effects roll back, and the command can subsequently succeed. |
| No double application | Concurrent exact delivery through independent clients yields one Applied receipt and the same AlreadyApplied receipt for the rest. |
| No nonce reuse across targets | Two different commands using one nonce can accept at most one question. |
| No stale state acceptance | Competing curators cannot both accept the same revision; the losing principal's nonce is not consumed. |
| No changed-command replay | Reusing commandId with different signed fields or signature returns COMMAND_ID_CONFLICT. |
| No memory-only duplicate protection | A fresh database client retrieves the original receipt after key revocation without producing any new effects. |
| No revocation race bypass | Tests hold real row locks for key revocation, capability revocation and emergency suspension; admission rechecks the state after the earlier change commits. |
| No stale clock admission | A command blocked until expiry is rejected using database time observed after lock acquisition. |
| No receipts without evidence | A deferred SQL constraint rejects a receipt without its matching event at commit. |
| No silent history mutation | SQL triggers reject receipt/event updates and deletes. Database owners remain trusted and can override database protections. |
| No inherited demo authority or secret enrollment | Bootstrap rejects duplicate identities, invalid references and private-key PEMs; a legacy demo-curator ID has no authority here. |
| No response or browser-origin leakage | Responses exclude keys/signatures/private context; the route rejects oversized bodies, malformed JSON and browser-origin requests. |

## Transaction and time semantics

Read order is principal, key, community, question, then sorted scoped grants.
Principal/question locks are FOR UPDATE; key/community/grant locks are FOR SHARE.
All reads, checks and writes occur in one SERIALIZABLE transaction. Conditional
nonce/revision updates provide an additional check; a mismatch throws and rolls
back. Serialization/deadlock/unique conflicts retry the whole transaction up to
three times, then return CONCURRENT_CONFLICT. There are no external effects in
these transactions and no test-only application bypass callbacks.

Time is database `clock_timestamp()` truncated to milliseconds, sampled after
locks are acquired. It is a LOCAL trusted clock, not distributed protocol time.
A revocation ordered first blocks acceptance. An acceptance that obtains the
necessary locks first can commit before the concurrent revocation. Revocation
does not retroactively undo an earlier committed transition.

Exact signed-command redelivery returns the original minimal receipt, including
after expiry/revocation. This does not authorize a new action or expose current
state. Any change to the signed fields or signature is a different envelope.

## Local data and evidence boundaries

Models live in `packages/db/prisma-admission/schema.prisma` with their own
reviewed initial SQL migration and generated client. The existing demo schema
and db:push workflow are not silently rebased into authenticated history.

The admission database stores administrative principals, public keys,
capabilities, community state, submitted question intents, command receipts and
events. It contains NO private ballot witnesses, payout identities or complete
tally keys. Command/signature metadata is restricted administrative evidence,
not a public feed. Bootstrap intent hashes remain references, not verified
methodology, privacy review, issuer proof or economic funding.

The event encoding is a fixed JSON scalar tuple, preceded by the hash domain
`popular-consensus:acceptance-event:v0.2-draft\n`. Tuple fields are:

1. event schema, networkId, commandId, commandHash;
2. principalId, keyId, capabilityId;
3. communityId, questionId, question version, previous revision, next revision;
4. previous status, next status, acceptedAt.

Versions/revisions in the tuple are decimal strings. Hashes are lowercase
sha256-prefixed digests. This is NOT the future general event/JCS/finality
protocol. The receipt explicitly states trustProfile=LocalDatabase.

## Local operation

Use separate, disposable local databases while these contracts remain drafts.
Do not place production participants, real ballots, or money in this service.
An example uses the same local PostgreSQL instance with a different database:

```bash
export PC_RUNTIME_MODE=development
export PC_DEV_MODE=false
export PC_DEMO_MODE=false
export PC_NETWORK_ID=popcon-local-admission
export ADMISSION_DATABASE_URL=postgresql://pc:pc@127.0.0.1:5432/popcon_admission
pnpm install --frozen-lockfile --ignore-scripts
pnpm db:admission:generate
pnpm db:admission:migrate
pnpm admission:bootstrap --file /absolute/path/to/public-bootstrap.json
pnpm admission:dev
```

Those credentials are illustrative local-development credentials only.
The runtime URL must identify a local PostgreSQL database, must not reuse
DATABASE_URL's database name, and does not accept query/fragment overrides.
No database URL is inherited by the runtime. The migrate deploy command is an
explicit operator action: verify its target before execution. Create the database
with local administrative tools where the migration role lacks that permission.

The bootstrap file must match AdmissionBootstrapSchema. It explicitly identifies
principals, canonical Ed25519 PUBLIC PEM keys and validity windows, communities,
strict F0 question intents and challenge deadlines, and scoped QuestionAccept
grants. Questions start at version 1/revision 0, and nonces at 0. Keep private
signing keys with their holders, not in the file or environment. The bootstrap
CLI reads at most 64 KiB and atomically refuses to overwrite an existing network.
This is trusted operator provisioning, NOT reviewed decentralized enrollment.

The service binds to loopback on port 4001 (override ADMISSION_PORT), registers
only health and signed acceptance, does not log request bodies, and refuses all
browser-origin/fetch-metadata requests. It is initially for signed machine-client
rehearsals. It deliberately provides no browser CORS, private-read endpoints,
reset command, key recovery, capability administration, credential issuer, poll
opening, result processing, or payment integration.

Use questionAcceptanceSigningText to encode a command, then sign those exact
UTF-8 bytes with the holder's Ed25519 private key locally. POST only the strict
signed envelope, not the private key or a snapshot. The integration tests give
executable examples with freshly generated, ephemeral keys.

## Migration and validation

`db:admission:migrate` runs Prisma migrate deploy, NOT db push. CI creates an
empty admission database, deploys the migration twice, checks schema drift and
runs real PostgreSQL transaction/route tests. SQL constraints/triggers are part
of the migration and must not be removed by regenerating the schema with db push.
The legacy database suite runs against a DIFFERENT disposable database.

No live database is migrated by committing this PR. The tests initialize and
truncate only disposable fixture data. A reviewed real-data bridge and actual
backup/restore exercise are still required before a non-disposable deployment.

## Remaining work

F1b establishes durable local effects for ONE administrative operation. It does
not retire founder/operator trust, canonical-state trust or any privacy assumption.
The database owner and bootstrap operator still control key/capability/state
records. AdmissionQuestion's dispute counters require an eventual authenticated
challenge/appeal workflow. There is not yet a protocol-governed enrollment,
rotation/recovery, grant/revocation or emergency command path.

Next: add those lifecycle commands with immutable change evidence, explicit
migration/import provenance, then a signed application adapter and protected
reads. Keep anonymous eligibility and private ballots outside this attributable
administrative channel. Canonical ordering, independent replay and cryptographic
privacy remain their separate gates. Do not open public runtime modes yet.

## Implementation references

- PostgreSQL 16 explicit locking: https://www.postgresql.org/docs/16/explicit-locking.html
- PostgreSQL 16 transaction isolation: https://www.postgresql.org/docs/16/transaction-iso.html
- Prisma transactions: https://www.prisma.io/docs/orm/prisma-client/queries/transactions

These describe implementation mechanisms, not evidence that PopCon has achieved
independent public-utility operation.
