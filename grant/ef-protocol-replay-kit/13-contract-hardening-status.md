# Contract Hardening Status

## Current Position

The grant-facing contracts are local replay and anchoring evidence, not production governance custody. They emit the lifecycle events needed by the replay verifier, reject duplicate ballot nullifiers, enforce challenge-window finalization, and are covered by Foundry lifecycle tests.

The protocol contracts are split into module files under `packages/contracts/src`, while `PopularConsensus.sol` remains as an aggregate import entrypoint for existing tests and tooling. Sensitive coordinator and governance methods now inherit `ProtocolAccess` and use `onlySteward` instead of relying on MVP-open comments.

## Executable Evidence

```bash
pnpm grant:contract-hardening
```

The command writes:

- `artifacts/grant-demo/contract-hardening-report.json`
- `artifacts/grant-demo/contract-hardening-transcript.txt`

The report checks module layout plus grant-critical coordinator and governance methods:

- `StakeManager.slash`
- `QuestionRegistry.setStatus`, `accept`, `reject`, `archive`
- `ChallengeCourt.selectJuror`, `rule`, `ruleResultChallenge`, `ruleAppeal`
- `CredentialRegistry` schema, issuer, revocation-root, and trust-policy administration
- `PollManager` poll configuration and lifecycle status administration
- `TallyManager` committee, tally-key, and proof publication administration
- `ResultArchive.publishResult`, `correctResult`, `finalizeResult`, `archiveQuestion`
- `AdoptionRegistry` policy, governance-parameter, and emergency suspension administration

Foundry also includes an unauthorized-caller test for representative steward-only paths across the question, credential, poll, tally, challenge, result, and adoption modules.

## Production Non-Claims

The contract module split is complete for the grant-facing modules, and `PopularConsensusDeployment.sol` provides a local aggregate deployment wrapper. This is not yet a production deployment claim because the steward role is still a single local authority; production still needs multisig/governance custody, operational runbooks, and external review.

The current access-control evidence also does not claim production-ready authorization. It proves the repo does not hide the MVP openness from reviewers.

## What Other Builders Can Reuse

Builders can reuse this pattern as a review harness: sensitive protocol methods must either have a real role guard, an unauthorized-call test, or a machine-checked note saying exactly why the method is open and what production guard replaces it.
