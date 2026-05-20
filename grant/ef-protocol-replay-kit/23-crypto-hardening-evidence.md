# Crypto Hardening Evidence

## Purpose

This evidence pass upgrades the cryptography boundary from a demo helper to an audit-ready shape. It checks v2 ballot encryption context binding, replay rejection for malformed encrypted payloads, and threshold custody signatures bound to tally setup and result-publication evidence.

## Command

Run:

```bash
pnpm grant:crypto-hardening
```

The command writes:

- `artifacts/grant-demo/crypto-hardening-report.json`
- `artifacts/grant-demo/crypto-hardening-transcript.txt`

## What It Checks

The report checks that:

- ballot encryption emits `pc-encrypted-ballot-v2`
- the suite is `X25519-HKDF-SHA256-AES-256-GCM`
- the encrypted payload binds recipient key id and poll/question/schema/tally-key context
- wrong keys, wrong context, AAD tampering, and ciphertext tampering fail closed
- plaintext ballot responses are not exported in encrypted payloads
- production-slice replay rejects v1 payloads, wrong encrypted-payload context, wrong recipient key id, wrong tally setup share binding, and wrong result-binding share evidence

## Production Non-Claims

This evidence does not claim external cryptography audit completion, audited distributed key generation, production threshold decryption, production key custody, or deployment readiness.

## What Other Builders Can Reuse

Other builders can reuse this pattern to make encrypted ballot context, replay commitments, and threshold-share evidence explicit before asking external reviewers to inspect the implementation.
