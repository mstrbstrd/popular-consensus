# Threat Model

## Threats Covered By The Current Demo

| Threat | Current check |
| --- | --- |
| Fake or inactive credential issuer | Credential issuer and trust policy checks |
| Duplicate voting | Duplicate nullifier check |
| Ballot tampering | Encrypted payload and ballot commitment checks |
| Missing threshold evidence | Threshold decryption share checks |
| Invalid decryption-share signer | Ed25519 member signature checks |
| Result artifact tampering | Result hash and bundle hash checks |
| Archive mismatch | Archive root and manifest checks |
| Event reorder or broken history | Previous-hash continuity checks |
| Wrong ballot decryption key | Crypto review wrong-key rejection |
| Encrypted ballot tampering | AES-GCM ciphertext and auth-tag rejection checks |
| Nullifier cross-context reuse | Poll-scoped and schema-scoped nullifier checks |
| Malformed anonymous proof | Semaphore proof verifier rejects malformed proof inputs |

## Still Needs Hardening

- Real external cryptographic review.
- Production key custody ceremonies.
- Real Semaphore proof generation and verifier integration outside fixtures.
- Production threshold decryption engine and ceremony evidence.
- Public testnet operator evidence.

## What Other Builders Can Reuse

The table separates claims that are currently backed by replay checks from claims that still require external review and production hardening.
