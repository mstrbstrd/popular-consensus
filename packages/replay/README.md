# @pc/replay

Standalone replay verification tools for the Popular Consensus Protocol Replay Kit.

## Commands

```bash
pc-replay verify-bundle --bundle artifacts/grant-demo/community-export.json
pc-replay verify-api --base-url http://localhost:4000 --question-id <question-id>
pc-replay verify-chain --rpc-url http://127.0.0.1:8545 --from-block 0
pc-replay tamper-bundle --bundle artifacts/grant-demo/community-export.json --out /tmp/tampered.json --field resultArtifactHash
```

## Current Verification Modes

- `verify-bundle` verifies artifact export bundle integrity, archive root presence, manifest hash, artifact hashes, and manifest references.
- `verify-api` fetches `/public/questions/:questionId/civic-record` and `/public/questions/:questionId/replay-check`, validates their public schemas, requires replay status `Verified`, requires all replay checks to pass, and compares event stream, result artifact, and archive hashes across the public record and rebuilt replay state.
- `verify-chain` reads deployed protocol module logs over RPC, decodes them with the contract artifacts, maps grant-critical onchain events into canonical replay events, and fails empty, unknown, or under-specified evidence.
- `onchainEventAdapter` maps grant-critical Solidity event names into canonical replay events and fails unknown event names instead of silently dropping them.
- `tamper-bundle` creates deterministic mismatch fixtures for reviewer testing.

## Package Layout

- `verifyBundle.ts` verifies production-slice exports and standalone artifact bundles.
- `verifyApi.ts` verifies public civic-record and replay-check endpoints together.
- `verifyChain.ts` verifies decoded contract logs from an RPC source.
- `rebuildState.ts` wraps the production-slice rebuild path.
- `checks.ts` contains shared report/check helpers.
- `tamper.ts` creates mismatch fixtures.

## What Other Builders Can Reuse

Other builders can reuse the CLI pattern, report shape, artifact-bundle checks, public-API replay checks, and tamper helpers without running the Popular Consensus web client.
