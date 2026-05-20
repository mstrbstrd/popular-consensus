# Reviewer Handoff

## Purpose

This handoff gives an external reviewer the shortest reliable path from a clean checkout to independently reproduced protocol evidence. It separates commands that need no local services from commands that need Postgres or an ephemeral local chain.

## Command Matrix

| Command | Dependency mode | What it proves | Expected result |
| --- | --- | --- | --- |
| `pnpm grant:check` | `no-local-services` | Backend lifecycle fixture, clean replay, tamper mismatch, crypto evidence inventory, threshold custody hardening, replay test vectors, contract-hardening evidence, packet lint, repo strategy audit, submission gate, protocol publication status, negative invariant audit, external review index, manifest, readiness report, replay tests, and protocol boundary check | Machine checks pass; formal submission remains blocked on human review |
| `pnpm grant:api-replay` | `local-postgres` | Public civic-record API export and replay-check endpoints can be verified by `pc-replay verify-api` | `Verified` |
| `pnpm grant:chain-replay` | `ephemeral-anvil` | Local deployed contract logs can be decoded, mapped to canonical events, and replayed by `pc-replay verify-chain` | `Verified` |
| `pnpm grant:full-check` | `local-postgres-and-ephemeral-anvil` | Typecheck, repo tests, contract build, API replay, chain replay, and quick machine evidence all pass together | Machine evidence ready; formal submission remains blocked on human review |

## Review Order

Start with `pnpm grant:check`. It does not require the web client, Postgres, public testnet credentials, or a long-running local chain.

Then run `pnpm grant:api-replay` if the review includes the API/public-record surface. Start local Postgres first and run the repo migration command documented in the packet README.

Then run `pnpm grant:chain-replay` if the review includes Solidity event alignment. The command starts its own local Anvil process, deploys the protocol modules, drives the lifecycle, and verifies emitted logs.

Use `pnpm grant:full-check` for the complete local gate once Postgres is running. This is the broadest reproducibility command, not a production-readiness claim.

## Machine-Generated Handoff

Run:

```bash
pnpm grant:reviewer-handoff
```

The command writes:

- `artifacts/grant-demo/reviewer-handoff-report.json`
- `artifacts/grant-demo/reviewer-handoff-transcript.txt`

The report confirms the reviewer commands exist in `package.json`, that the quick path avoids local services, that the full path includes API and chain replay, and that this packet documents each dependency mode.

## Non-Claims

This handoff does not claim a public-chain deployment, external cryptography audit, production threshold ceremony, production steward custody, or formal EF submission readiness. Those remain human-review and production-hardening gates.

## What Other Builders Can Reuse

Other builders can reuse this handoff pattern to separate no-service replay evidence from DB-backed API evidence, local-chain event evidence, and human review blockers.
