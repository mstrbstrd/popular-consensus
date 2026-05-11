# Public Testnet Operator Roster

This roster tracks the real-world operators needed before the final roadmap item, `Run public testnet with independent operators`, can be marked complete.

The roster is for coordination only. The completion gate is still enforced by:

- JSON attestations in `docs/public-testnet-attestations`.
- `docs/public-testnet-launch-summary.md`.
- `pnpm testnet:verify-attestations` reporting `Ready`.
- `pnpm mvp:audit` reporting `Ready`.

Run `pnpm testnet:audit-roster` to check slot counts, duplicate contacts, reviewed status, and referenced attestation files while operators are being recruited. Use `pnpm testnet:audit-roster:strict` when every required slot should be reviewed with attestation evidence.

Do not mark a slot complete just because someone is assigned. A slot is complete only after the operator has run the required commands, published a valid attestation, and passed maintainer independence review.

Use `docs/public-testnet-operator-invitation.md` when inviting prospective operators.

Use `docs/public-testnet-operator-recruitment-targets.md` to identify candidate operator pools. Candidate pools are not assigned operators.

Use `docs/public-testnet-operator-outreach-messages.md` when adapting invitations for infrastructure, civic, or open-source operators.

Use `docs/public-testnet-operator-outreach-log.md` to track prospects before they accept a slot. Prospects are not roster assignments.

Use `docs/public-testnet-operator-assignment-intake.md` when recording a real operator assignment.

If GitHub Issues are being used, create one issue per operator with `.github/ISSUE_TEMPLATE/public-testnet-operator.yml`.

Generate local per-slot issue drafts with `pnpm testnet:operator-issue-drafts`; the output file is `docs/public-testnet-operator-issue-drafts.md`. For GitHub CLI body files, run `pnpm testnet:operator-issue-drafts -- --body-dir docs/public-testnet-operator-issue-bodies`. The generator only drafts unassigned slots whose tracking issue is still `open`, so record created issue URLs with `pnpm testnet:update-roster-slot -- --slot <slot-id> --tracking-issue <issue-url-or-number>` before regenerating.

Record accepted or invited operators with `pnpm testnet:update-roster-slot -- --slot <slot-id> --tracking-issue <issue> --operator-id <id> --contact <contact> --organization <organization> --status invited`, then rerun `pnpm testnet:audit-roster`.

When submitting attestation or launch-summary evidence through GitHub, use `.github/PULL_REQUEST_TEMPLATE/public-testnet-attestation.md`.

## Role Targets

| Role | Required | Current Attestations | Completion Source |
| --- | ---: | ---: | --- |
| Protocol deployer | 1 | 0 | `docs/public-testnet-attestations/*.json` |
| API/indexer operator | 2 | 0 | `docs/public-testnet-attestations/*.json` |
| Replay verifier | 3 | 0 | `docs/public-testnet-attestations/*.json` |
| Community steward | 2 | 0 | `docs/public-testnet-attestations/*.json` |

## Operator Slots

| Slot | Tracking Issue | Role | Assigned Operator | Contact | Organization | Independence Review | Attestation File | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| deployer-1 | https://github.com/mstrbstrd/popular-consensus/issues/1 | deployer | open | open | open | pending | open | unassigned | Publishes deployment hash and chain details. |
| indexer-1 | https://github.com/mstrbstrd/popular-consensus/issues/2 | api-indexer | open | open | open | pending | open | unassigned | Runs first public API/indexer endpoint. |
| indexer-2 | https://github.com/mstrbstrd/popular-consensus/issues/3 | api-indexer | open | open | open | pending | open | unassigned | Runs second independent public API/indexer endpoint. |
| replay-1 | https://github.com/mstrbstrd/popular-consensus/issues/4 | replay-verifier | open | open | open | pending | open | unassigned | Verifies transaction and event stream hashes. |
| replay-2 | https://github.com/mstrbstrd/popular-consensus/issues/5 | replay-verifier | open | open | open | pending | open | unassigned | Verifies transaction and event stream hashes. |
| replay-3 | https://github.com/mstrbstrd/popular-consensus/issues/6 | replay-verifier | open | open | open | pending | open | unassigned | Verifies transaction and event stream hashes. |
| steward-1 | https://github.com/mstrbstrd/popular-consensus/issues/7 | community-steward | open | open | open | pending | open | unassigned | Runs governance and safety drills. |
| steward-2 | https://github.com/mstrbstrd/popular-consensus/issues/8 | community-steward | open | open | open | pending | open | unassigned | Runs governance and safety drills. |

## Coordination Checklist

- [ ] Recruit at least one protocol deployer.
- [ ] Recruit at least two independent API/indexer operators.
- [ ] Recruit at least three independent replay verifiers.
- [ ] Recruit at least two independent community stewards.
- [ ] Confirm every assigned operator has a unique contact and an independence statement.
- [ ] Share `docs/public-testnet-operator-runbook.md` with every assigned operator.
- [ ] Collect every attestation into `docs/public-testnet-attestations`.
- [ ] Run `pnpm testnet:verify-attestations:pending` and resolve all missing evidence.
- [ ] Complete maintainer independence review.
- [ ] Write `docs/public-testnet-launch-summary.md` with `Decision: GO`.
- [ ] Run `pnpm testnet:verify-attestations` and require `Ready`.
- [ ] Run `pnpm mvp:audit` and require `Ready`.
- [ ] Mark the final roadmap checkbox complete only after both verifiers are ready.

## Status Values

- `unassigned`: no operator has accepted the slot.
- `invited`: operator has been contacted but has not accepted.
- `accepted`: operator has accepted the role.
- `running`: operator is running the public testnet process.
- `attested`: attestation JSON exists and passes schema/content validation.
- `reviewed`: maintainer independence review passed for this operator.
- `blocked`: operator cannot complete the role or evidence is invalid.

## Independence Notes

Maintainers must confirm that assigned operators are meaningfully independent people or organizations. A single person running multiple nodes is useful rehearsal evidence, but it is not enough to complete the final public-testnet gate.

The verifier blocks duplicate contacts across different operator ids, but it cannot prove real-world independence. The launch summary must record the maintainer review result.
