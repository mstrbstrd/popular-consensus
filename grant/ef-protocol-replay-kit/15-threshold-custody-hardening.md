# Threshold Custody Hardening

## Purpose

This document narrows the threshold-decryption story for external review. The current repo does not claim production distributed key generation or live production threshold decryption. It does provide replay-verifiable custody evidence for the protocol slice: committee metadata, accepted share rules, result binding, and failure cases.

## Current Evidence

Run:

```bash
pnpm grant:threshold-custody
```

The command writes:

- `artifacts/grant-demo/threshold-custody-report.json`
- `artifacts/grant-demo/threshold-custody-transcript.txt`

The report checks that:

- the golden threshold slice verifies
- exported private key material is rejected
- duplicate tally member ids are rejected
- duplicate tally member public keys are rejected
- invalid member public keys are rejected
- thresholds above the unique member count are rejected
- insufficient accepted shares are rejected
- unauthorized accepted shares are rejected
- duplicate accepted share hashes are rejected
- decryption shares must bind to the published aggregate counts hash

## Replay Boundary

The verifier treats threshold evidence as public replay data. It checks that the published result artifact is supported by accepted decryption-share hashes from the active committee and that those shares are signed by the committee public keys.

This is enough for grant-review evidence that the replay path does not blindly trust an application tally. It is not enough for a production privacy claim.

## Production Non-Claims

This evidence does not claim:

- audited distributed key generation
- externally reviewed key ceremony or custody operations
- production decryption-share proof verification
- slashing, replacement, or recovery policy for faulty committee members
- public testnet threshold ceremony evidence

## What Other Builders Can Reuse

Other builders can reuse the threshold custody case matrix as a replay evidence pattern: publish committee metadata, reject private-key material, bind accepted shares to ballot commitments and aggregate counts, and keep production cryptography non-claims explicit until external review is complete.
