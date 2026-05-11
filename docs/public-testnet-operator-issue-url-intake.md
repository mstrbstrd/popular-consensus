# Public Testnet Operator Issue URL Intake

Use this sheet after the eight public operator tracking issues are created. It is an intake helper only; it does not create issues, record outreach, assign operators, publish attestations, or complete the final public-testnet gate.

After filling the table, record each URL on `docs/public-testnet-operator-roster.md` with:

```sh
pnpm testnet:record-issue-urls
```

To validate the intake rows before changing the roster, run:

```sh
pnpm testnet:record-issue-urls -- --dry-run
```

You can also use the per-slot commands from `docs/public-testnet-operator-issue-bodies/README.md`.

Then run:

```sh
pnpm testnet:audit-roster
```

## Issue URLs

| Slot | Role | Tracking Issue URL Or Number |
| --- | --- | --- |
| deployer-1 | deployer | https://github.com/mstrbstrd/popular-consensus/issues/1 |
| indexer-1 | api-indexer | https://github.com/mstrbstrd/popular-consensus/issues/2 |
| indexer-2 | api-indexer | https://github.com/mstrbstrd/popular-consensus/issues/3 |
| replay-1 | replay-verifier | https://github.com/mstrbstrd/popular-consensus/issues/4 |
| replay-2 | replay-verifier | https://github.com/mstrbstrd/popular-consensus/issues/5 |
| replay-3 | replay-verifier | https://github.com/mstrbstrd/popular-consensus/issues/6 |
| steward-1 | community-steward | https://github.com/mstrbstrd/popular-consensus/issues/7 |
| steward-2 | community-steward | https://github.com/mstrbstrd/popular-consensus/issues/8 |

## Recording Checklist

- [x] Every slot above has a public tracking issue URL or issue number.
- [x] Every issue URL has been recorded on `docs/public-testnet-operator-roster.md`.
- [x] `pnpm testnet:audit-roster` reports the expected tracking issue count.
- [x] `docs/public-testnet-operator-send-packets.md` has the public repo URL and per-slot tracking issue URLs filled before outreach is sent.
