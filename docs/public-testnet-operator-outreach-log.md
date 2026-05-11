# Public Testnet Operator Outreach Log

Use this log to track outreach attempts before a candidate becomes an assigned operator.

This file is not completion evidence. Do not count a prospect as assigned until they accept a slot and the assignment is recorded in `docs/public-testnet-operator-roster.md`.

Use `docs/public-testnet-operator-outreach-queue.md` for the first pass of public contact routes and slot mapping. Use `docs/public-testnet-operator-send-packets.md` for per-slot messages, then record only actual outreach attempts in this log.

Prefer the helper command so slot roles stay aligned with `docs/public-testnet-operator-roster.md`:

```sh
pnpm testnet:record-outreach -- \
  --candidate "Dappnode partner route" \
  --pool "Home-node and decentralization communities" \
  --contact "https://dappnode.com/en-us/pages/contact" \
  --slot deployer-1 \
  --status contacted \
  --tracking-issue-from-roster \
  --notes "Sent deployer packet."
```

This command updates the prospect log only. It does not assign a roster slot.

Audit the prospect log with:

```sh
pnpm testnet:audit-outreach
```

The audit validates slot roles and blocks contacted-or-later rows whose tracking issue does not match the roster.

Use `pnpm testnet:audit-outreach:strict` only when every required slot should have a contacted-or-later outreach row.

## Status Values

- `candidate`: candidate identified but not contacted.
- `contacted`: message sent; requires a public tracking issue.
- `interested`: candidate responded positively but has not accepted a role; requires a public tracking issue.
- `accepted`: candidate accepted a specific slot; requires a public tracking issue and should move into the roster with `pnpm testnet:update-roster-slot`.
- `declined`: candidate declined; requires a public tracking issue.
- `no-response`: no response after follow-up; requires a public tracking issue.
- `blocked`: candidate cannot satisfy independence, timing, or attestation requirements; requires a public tracking issue.

## Outreach Entries

| Candidate | Pool | Candidate Contact | Target Slot | Role | Status | Last Contact | Tracking Issue | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dappnode community or partner route | Home-node and decentralization communities | https://dappnode.com/en-us/pages/contact | deployer-1 | deployer | candidate | open | open | Candidate route identified from first-wave queue; not contacted. |
| Dappnode community or app-store builder route | Home-node and decentralization communities | https://dappnode.com/ | indexer-1 | api-indexer | candidate | open | open | Candidate route identified from first-wave queue; not contacted. |
| Open Source Collective hosted-project community | Open-source fiscal-hosted projects | https://oscollective.org/ | indexer-2 | api-indexer | candidate | open | open | Candidate route identified from first-wave queue; not contacted. |
| EthStaker community | Ethereum solo-staker communities | https://ethstaker.org/ | replay-1 | replay-verifier | candidate | open | open | Candidate route identified from first-wave queue; not contacted. |
| Open Collective open-source project directory | Open-source/public-goods collectives | https://opencollective.com/search?hostname=opencollective.com | replay-2 | replay-verifier | candidate | open | open | Candidate route identified from first-wave queue; not contacted. |
| EthStaker allied-community route | Ethereum solo-staker communities | https://ethstaker.org/ | replay-3 | replay-verifier | candidate | open | open | Candidate route identified from first-wave queue; not contacted. |
| Open Fresno civic-tech volunteer community | Local civic-tech volunteer groups | https://openfresno.org/ | steward-1 | community-steward | candidate | open | open | Candidate route identified from first-wave queue; not contacted. |
| SF Civic Tech volunteer community | Local civic-tech volunteer groups | https://www.sfcivictech.org/ | steward-2 | community-steward | candidate | open | open | Candidate route identified from first-wave queue; not contacted. |

## Promotion Rule

When a candidate accepts:

1. Capture assignment details with `docs/public-testnet-operator-assignment-intake.md`.
2. Update `docs/public-testnet-operator-roster.md` with `pnpm testnet:update-roster-slot`.
3. Keep the outreach-log row for history, but the roster becomes the coordination source for the assigned slot.
4. Do not mark the roster slot `reviewed` until the attestation exists and maintainer independence review passes.
