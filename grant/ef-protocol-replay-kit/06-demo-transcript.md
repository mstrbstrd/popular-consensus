# Demo Transcript

## Command

```bash
pnpm grant:demo
```

## Expected Output

```text
EF Protocol Replay Kit demo: Verified
Report: artifacts/grant-demo/full-lifecycle-report.json
Production slice export: artifacts/grant-demo/production-slice-export.json
Community export bundle: artifacts/grant-demo/community-export.json
Tamper status: Mismatch
```

## Current Report Snapshot

The generated report is written to:

```text
artifacts/grant-demo/full-lifecycle-report.json
```

Current report values:

| Field | Value |
| --- | --- |
| Replay status | `Verified` |
| Replay checks | `100/100` |
| Bundle replay checks | `6/6` |
| Duplicate nullifier status | `Mismatch` |
| Tamper status | `Mismatch` |
| Result artifact hash | `sha256:8815c1675706ad00c30f87cc970c8dc548e4bc854fe55b5eee08e3687ea37642` |
| Archive hash | `sha256:6ef6e252b7debfd60d948ffdf15d0b9d51e13734d522c7804894b74e2508de34` |
| Artifact manifest hash | `sha256:eaa3e1232e80eaaa0e4d3139faebf1b16d7ac7d2ba3e16f8fd3b5e8f0bb842c3` |
| Transaction stream hash | `sha256:ccdd3f0db6316e74fe9e63f8396c8dda875e5ccec71089411d851d2492bc16bf` |
| Event stream hash | `sha256:65c7d04d248a85a70acbb6f53dbfafefb08cfba0cbbebbad247b18c81e55dc9d` |

## Backend Path

The demo does not require the web client. It uses a deterministic backend protocol fixture that includes credential issuer/trust policy state, tally-key setup, encrypted ballot commitments, nullifiers, result artifacts, challenge/finalization/archive records, and export bundles.

Live HTTP API replay and public-chain event replay are grant milestones, not current claims.

## What The Demo Proves

- A replayable question, poll, ballot, result, challenge, finalization, and archive slice exists.
- Clean replay returns `Verified`.
- Duplicate nullifiers return `Mismatch`.
- Tampering with the result artifact hash returns `Mismatch`.
- Bundle integrity checks pass for the clean artifact export.

## What Other Builders Can Reuse

Builders can run the same command and inspect the generated JSON report to see the evidence shape expected from an independently replayable civic record.
