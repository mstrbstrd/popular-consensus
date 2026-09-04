# F1a: signed question acceptance and local runtime containment

Status: partial F1 implementation. Not a production authentication system.

## Implemented boundaries

`packages/shared/src/question-authorization.ts` defines a strict, versioned
administrative command, an internal trusted state snapshot, and exact signing
bytes. `apps/api/src/question-authorization.ts` verifies an Ed25519 signature
using Node's maintained crypto implementation and evaluates question acceptance.
It never trusts a request-supplied verification key, role, capability, or claim
that authentication already happened. Actor fields exist in the signed envelope,
not in the business payload.

The one allowed transition in this slice is `Submitted -> Accepted`. Its guards
require an active principal and key, a current `QuestionAccept` capability scoped
to the target community and optionally the exact question, the expected nonce,
matching wording version and revision, no self-approval, an active community, no
emergency, no unresolved challenge/appeal, and a completed challenge window.
An amendment must be resubmitted before this gate accepts it.

Commands are valid in `[issuedAt, expiresAt)` for at most five minutes in this
development adapter. The challenge window ends at its exact recorded deadline.
Key and capability intervals are also half-open. Time is supplied by a trusted
adapter, never read from the command or implicitly from `Date.now()`. This is not
selection of a production time/finality system; that decision remains open.

## What is and is not wired into the API

The existing `config.ts` now calls `readRuntimeConfig` before the legacy server
can listen. It defaults to literal loopback (`127.0.0.1`), rejects non-loopback
bindings and malformed flags/ports, rejects `NODE_ENV=production`, and refuses
`testnet`, `advisory-public`, and `utility-production` until legacy authorization
is migrated. Disabling demo flags alone does not turn the API into a safe public
service. Existing public-testnet runbooks are planning documents, not permission
to bypass this gate. Normal local-demo operation and DB tests remain supported.

**This is not a network security perimeter.** Do not expose the legacy API via a
reverse proxy, tunnel, port forward, container-published service, or untrusted
browser origin. Legacy CORS, identity, private-read, credential, and tally limits
remain. Loopback defaults do not fix these issues. Independent read-only replay
requires a separately reviewed service rather than publishing this legacy API.

The signed evaluator is NOT yet connected to legacy `/questions/:id/accept` or
any other route. Those routes still have the documented demo trust assumptions.
There is no new public endpoint, key enrollment API, recovery path, or accepted
production proof suite in this change. Ed25519 is a development command adapter,
not a decision about the final protocol signature/credential/tally construction.
It does not provide anonymous credentials, ZK proofs, or threshold tallying.

## Atomic persistence contract for the next adapter

`AuthorizedTransition` is a proposed conditional transition, NOT a receipt,
durable acceptance, or reusable authorization token. Evaluation has no I/O and
must not mutate either input. Calling it twice with the same unchanged snapshot
can return two proposals. **This slice does not provide durable replay protection
or concurrent at-most-once execution.**

The next adapter must, in a serializable transaction:

1. Resolve the principal, key, scoped grants, question, disputes, suspension,
   expected principal/network nonce, and trusted time from authoritative state.
2. Evaluate the signed command. Never accept the snapshot from an HTTP caller.
3. Atomically compare/update the expected nonce and question revision, persist
   the transition and evidence, and store the command result. Include key/grant,
   dispute, and emergency changes in the same concurrency-control boundary.
4. Enforce durable unique `(networkId, principalId, nonce)` and command-ID rules.
   A reused command ID with different signed bytes must fail. Exact redelivery
   may return its previously committed receipt without any new side effect.
5. Roll back every write if any comparison, event write, or projection write fails.
   Publish external effects via a transactional outbox, never before commit.

A stale nonce is denied by the evaluator after committed state advances, but a
read/check/write split is not sufficient. Do not wire the evaluator to a route
until conflict, rollback, replay, and concurrent-delivery integration tests pass.
Legacy IDs cannot enroll themselves as production keys. Enrollment/recovery and
migration of caller-selected identities need their own reviewed implementation.

## Privacy and capability separation

Question acceptance is an attributable curator operation. It is not a ballot
operation. Do not reuse this signed-principal envelope as a mandatory login for
private voting. Future ballot authorization must separately verify privacy-safe
eligibility proofs/nullifiers without a public profile or payout-identity join.
The internal snapshot contains operational public keys and scoped authority, not
participant credential secrets or responses. Do not publish snapshots or log
raw requests. Rejections return stable codes without echoing key material.

## Command bytes and evidence scope

The signature covers a domain-separated UTF-8 string followed by a fixed JSON
array of every command field, including protocol-adapter version, network,
principal/key, nonce, timestamps, target, wording version and revision. Integers
are encoded as canonical decimal strings in the tuple. This limited encoding is
not JCS and does not choose the future canonical event representation. Schema
changes require a new signing version and vectors. Unknown fields are rejected.

The command hash excludes the signature and covers these exact signed bytes.
Proof verification checks the server-resolved key type is Ed25519 and rejects
private PEM input or keys supplied in the request. Duplicate JSON member-name
rejection, HTTP body limits, origin policy and transport protections remain
requirements for the future route adapter.

## Validation and remaining work

New tests use actual generated Ed25519 keys and signatures. They cover revoked,
expired and wrong keys/grants; scope confusion; forged signatures; altered
payloads; nonce mismatch/exhaustion; unsafe integer revision overflow; temporal
boundaries; every undeclared legacy question state; self-dealing; pending cases;
emergency state; strict payloads; nonmutation; and subprocess config-import
failures. CI also runs existing shared, privacy, artifact, and DB-backed API tests
plus shared/API typechecking against a disposable PostgreSQL service.

The F0 invariant catalog remains `NotIntegrated`: it describes whole-system
requirements, not partial helper coverage. F1 is not complete. Next work is the
transactional route adapter and durable key/capability/nonces models, followed by
migration of all privileged writes and protected reads. Public runtime operation
remains blocked until that enforcement is complete and reviewed. No real-money
obligations, private ballot processing, deployments, or token changes are enabled.

Reference: Node.js crypto.sign/crypto.verify with algorithm null for Ed25519:
https://nodejs.org/docs/latest-v22.x/api/crypto.html
