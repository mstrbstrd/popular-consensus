# Public Testnet Operator Outreach Messages

Use these messages after choosing a candidate pool from `docs/public-testnet-operator-recruitment-targets.md`.

These messages are invitation drafts only. They do not assign an operator, create evidence, or close the final MVP gate.

## Infrastructure Operator

Subject: Independent public-testnet operator request for Popular Consensus

Hello,

We are preparing the Popular Consensus MVP public testnet and are looking for independent operators who can help verify that the protocol can be run and replayed outside the maintainer environment.

Would you be willing to run one infrastructure-oriented role during the testnet window?

Requested role: deployer, API/indexer operator, or replay checker
Roster slot: slot-id-here
Runbook: `docs/public-testnet-operator-runbook.md`
Role command reference: `docs/public-testnet-role-command-reference.md`

The output we need is a public operator evidence JSON file with your operator id, contact or public key, organization or independent-individual marker, independence statement, tested commit, chain/RPC details, and role-specific checks.

This does not require a perfect launch. If you find issues, record them in the evidence observations and we will include them in the launch summary.

## Civic Or Community Guide

Subject: Community-guide request for Popular Consensus public testnet

Hello,

We are preparing the Popular Consensus MVP public testnet for a community-governed opinion polling protocol. We need independent community guides to run governance and safety drills so the final MVP evidence is not maintained only by the project team.

Would you be willing to run a community-guide role during the testnet window?

Roster slot: steward-slot-here
Runbook: `docs/public-testnet-operator-runbook.md`
Assignment intake: `docs/public-testnet-operator-assignment-intake.md`

The community-guide role focuses on governance-process review, emergency/safety drill checks, and a public evidence file explaining what was tested. We will also ask for a contact or public key and a short independence statement.

## Open-Source Maintainer

Subject: Independent replay/indexer check for Popular Consensus MVP

Hello,

We are preparing the Popular Consensus MVP public testnet and need independent open-source maintainers to help verify that public protocol records can be indexed and replayed outside the maintainer environment.

Would you be willing to run an API/indexer or replay-checker role?

Requested role: api-indexer or replay checker (`replay-verifier` role id)
Roster slot: slot-id-here
Issue body: `docs/public-testnet-operator-issue-bodies/slot-id-here.md`

The key output is a `public-testnet-operator-attestation-v0` JSON evidence file. Replay checkers should independently report matching transaction and event stream hashes for the same testnet window. API/indexer operators should expose a public API base URL and publish replay hashes.

## Follow-Up After Acceptance

After the candidate accepts:

1. Capture the real assignment fields with `docs/public-testnet-operator-assignment-intake.md`.
2. Update the roster with `pnpm testnet:update-roster-slot`.
3. Run `pnpm testnet:audit-roster`.
4. Share the role-specific issue body or command reference.
5. Do not mark the slot reviewed until a valid evidence file exists and maintainer independence review passes.
