# Cryptography Review

## Current Evidence

The current protocol slice includes a local cryptography evidence command:

```bash
pnpm grant:crypto-review
```

It writes:

- `artifacts/grant-demo/crypto-review-report.json`
- `artifacts/grant-demo/crypto-review-transcript.txt`

The report currently checks 12 privacy and integrity properties:

- demo credential secret hashes verify before nullifier derivation
- nullifiers are deterministic for one credential, poll, and schema
- nullifiers change across polls
- nullifiers change across credential schemas
- identical ballot choices encrypt to different ciphertext and IV values
- the coordinator private key can decrypt valid ballot payloads
- wrong coordinator keys cannot decrypt ballot payloads
- ciphertext tampering is rejected
- authentication-tag tampering is rejected
- aggregate tally output omits holder aliases
- anonymous proof hashes are content-addressed
- malformed Semaphore proofs are rejected rather than accepted as hash-only claims

Threshold custody hardening has a separate evidence command:

```bash
pnpm grant:threshold-custody
```

It writes:

- `artifacts/grant-demo/threshold-custody-report.json`
- `artifacts/grant-demo/threshold-custody-transcript.txt`

That report checks threshold committee/member uniqueness, valid Ed25519 public keys, no exported private key material, minimum accepted shares, authorized share submitters, unique share hashes, and aggregate-binding tamper rejection.

## Primitives In Scope

- X25519 key agreement for demo coordinator ballot encryption
- AES-256-GCM authenticated encryption for ballot payloads
- SHA-256 content-addressed commitments and nullifiers
- Semaphore V4 verification path for anonymous ballot proofs

## Production Non-Claims

This evidence does not claim:

- external cryptography audit completion
- production threshold key ceremony or custody
- production threshold decryption engine completion
- production zero-knowledge credential membership proofs
- audited distributed key generation or decryption-share proof verification

Those items remain hardening work before production deployment claims.

## What Other Builders Can Reuse

Builders can reuse the command shape and report format as a review harness: evidence checks and production non-claims live together so a civic-record protocol can show useful privacy work without overstating audit readiness.
