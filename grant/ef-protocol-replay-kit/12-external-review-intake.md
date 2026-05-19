# External Review Intake

## Purpose

This document captures the human review work that must happen before a formal grant submission or production privacy claim. The repo now has local replay, chain, API, contract-event, license, reviewer-handoff, and crypto-evidence artifacts; this intake keeps external feedback separate from machine-generated evidence.

## EF Feedback To Collect

| Question | Why it matters | Response |
| --- | --- | --- |
| Should this be framed as governance infrastructure, indexer tooling, privacy-preserving voting infrastructure, or public-good research? | Determines grant narrative and reviewer expectations | Pending |
| Is the reusable surface broad enough for builders outside Popular Consensus? | Tests whether this is public-good infrastructure rather than app-specific product work | Pending |
| Are local-chain replay artifacts sufficient for initial review, or is a public testnet transcript expected before submission? | Sets the next evidence milestone | Pending |
| Should the grant scope include threshold decryption hardening, or should that be a follow-on milestone? | Prevents overloading the first proposal | Pending |
| Are the protocol/platform and license boundaries clear enough for EF review? | Reduces risk that the project reads as a platform grant | Pending |
| Is the command handoff enough for reviewers to reproduce evidence from a clean checkout? | Confirms the repo is externally inspectable instead of only locally understood | Pending |

## External Cryptography Review To Collect

| Review area | Current evidence | Needed reviewer output |
| --- | --- | --- |
| Ballot encryption | `pnpm grant:crypto-review`, AES-GCM tamper checks, wrong-key rejection | Review note on construction, key derivation, nonce/IV assumptions, and production gaps |
| Nullifier derivation | Poll/schema scoping checks | Review note on unlinkability assumptions and collision/preimage expectations |
| Anonymous proof path | Malformed Semaphore proof rejection | Review note on production proof generation, verifier integration, and test vectors |
| Threshold decryption | `pnpm grant:threshold-custody`, threshold share evidence exists in replay, not production engine | Review note on ceremony, custody, DKG/decryption-share verification, slashing or replacement assumptions |
| Export/replay privacy | Artifact and replay checks avoid private-key material | Review note on metadata leakage and archive minimization |

## Incorporation Log

| Date | Reviewer/source | Feedback summary | Repo change |
| --- | --- | --- | --- |
| Pending | EF Office Hours | Pending | Pending |
| Pending | External cryptography reviewer | Pending | Pending |

## What Other Builders Can Reuse

Builders can reuse this intake as a lightweight gate that separates machine-verifiable protocol evidence from human review, scope alignment, and production cryptography sign-off.
