# Public Testnet Operator Invitation

Use this packet when inviting an independent operator to help complete the final MVP gate.

The ask is simple: run one public-testnet role, publish a signed or attributable attestation JSON file, and allow maintainers to record an independence review in the launch summary.

## Maintainer Prep

Before sending an invitation:

1. Pick an open slot in `docs/public-testnet-operator-roster.md`.
2. Confirm which role you are asking for: deployer, API/indexer, replay verifier, or community steward.
3. Share the testnet window, chain id, RPC URL, community id, and expected response deadline.
4. Ask the operator for a contact or public key and an independence statement.
5. Generate local issue drafts with `pnpm testnet:operator-issue-drafts`.
6. Open a public operator tracking issue with `.github/ISSUE_TEMPLATE/public-testnet-operator.yml`, if GitHub Issues are being used.
7. Capture the assignment fields with `docs/public-testnet-operator-assignment-intake.md`.
8. Record the invitation status in the roster with `pnpm testnet:update-roster-slot`.

## Message Template

Subject: Popular Consensus public testnet operator request

Hello,

We are preparing the Popular Consensus MVP public testnet. The goal is to verify that the protocol can be operated and replayed by independent people or organizations, not only by the project maintainers.

Would you be willing to run one public-testnet operator role?

Requested role: role-name-here
Testnet window: window-here
Repo/runbook: `docs/public-testnet-operator-runbook.md`
Role commands: `docs/public-testnet-role-command-reference.md`
Roster slot: slot-id-here

What we need from you:

1. Run the required checks for your role.
2. Run or inspect the public testnet during the agreed window.
3. Generate an attestation with `pnpm testnet:collect-attestation`.
4. Provide the attestation JSON for `docs/public-testnet-attestations`.
5. Provide a contact or public key and a short statement explaining why your operation is independent from the maintainers and other operators.

The attestation does not need to claim the system is perfect. If you find issues, record them in `observations`; the launch summary has an unresolved-issues section.

Thank you for helping make the MVP evidence public and independently checkable.

## Role Summary

| Role | Minimum Count | Operator Output |
| --- | ---: | --- |
| deployer | 1 | Deployment hash, chain id, RPC URL, commit hash, attestation JSON. |
| api-indexer | 2 | Public API/indexer URL, replay hashes, commit hash, attestation JSON. |
| replay-verifier | 3 | Independently checked transaction/event stream hashes, attestation JSON. |
| community-steward | 2 | Governance and safety drill evidence, attestation JSON. |

## Operator Command Shape

Operators should start from the runbook. The usual attestation command shape is:

```sh
pnpm testnet:collect-attestation -- \
  --operator-id operator-name-or-public-key \
  --operator-contact contact-url-email-handle-or-public-key \
  --independence-statement "Independent operator not controlled by the maintainers or sibling operators." \
  --role replay-verifier \
  --git-commit commit-hash \
  --chain-id public-testnet-chain-id \
  --rpc-url public-testnet-rpc-url \
  --api-base-url api-base-url \
  --community-id community-id \
  --checks-preset complete \
  --out docs/public-testnet-attestations/operator-name.json
```

Role-specific notes:

- Deployer attestations must include `--deployment-hash` or `--deployment-json`.
- API/indexer attestations must include `--api-base-url`.
- Replay verifiers should publish matching `transactionStreamHash` and `eventStreamHash` values for the same testnet window.
- Community stewards should use `--checks-preset complete` only after finishing the governance and safety drills.

## Acceptance Criteria

An operator slot can move to `reviewed` only when:

- The attestation JSON exists in `docs/public-testnet-attestations`.
- `pnpm testnet:verify-attestations:pending` accepts the attestation content.
- `pnpm testnet:audit-roster` does not report duplicate contacts or missing files for the slot.
- A maintainer confirms the independence statement and records the result.

The MVP gate is complete only when `pnpm testnet:verify-attestations` and `pnpm mvp:audit` both report `Ready`.
