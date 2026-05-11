# Public Testnet Operator Assignment Intake

Use this template when a real independent operator agrees to take a public-testnet slot.

This intake is coordination data only. It does not complete the final MVP gate. A slot is complete only after the operator publishes a valid attestation JSON file and maintainer independence review passes.

## Assignment Fields

```text
slot:
tracking issue:
operator id:
contact or public key:
organization or independent individual:
independence statement:
status:
notes:
```

`status` should usually start as `invited` or `accepted`.

Keep the `independence statement` in the public tracking issue or intake notes. The roster stores only the operator identity fields and independence-review status; the full statement is required later when the operator runs `pnpm testnet:collect-attestation`.

## First Slot To Fill

Start with `deployer-1` so the public testnet has deployment, chain, and RPC details for the other operators to reference.

```text
slot: deployer-1
tracking issue:
operator id:
contact or public key:
organization or independent individual:
independence statement:
status: invited
notes:
```

## Record The Assignment

After an issue exists and the operator identity fields are known, record the assignment with:

```sh
pnpm testnet:update-roster-slot -- \
  --slot deployer-1 \
  --tracking-issue <issue-url-or-number> \
  --operator-id <operator-id> \
  --contact <contact-or-public-key> \
  --organization <organization-or-independent-individual> \
  --status invited \
  --notes "<short-maintainer-note>"
```

Then verify the roster:

```sh
pnpm testnet:audit-roster
pnpm mvp:audit
```

## Evidence Still Required Later

- Operator follows `docs/public-testnet-operator-runbook.md`.
- Operator generates an attestation with `pnpm testnet:collect-attestation`.
- Attestation JSON is committed under `docs/public-testnet-attestations`.
- Maintainer records independence review.
- `pnpm testnet:verify-attestations` reports `Ready`.
- `pnpm mvp:audit` reports `Ready`.
