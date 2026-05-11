# Community Fork And Exit Expectations

Popular Consensus communities must be able to leave with their civic records, policies, and presentation metadata intact. The MVP supports this with content-addressed community exports, fork metadata, and read-only replay.

## What Can Be Exported

Use:

```bash
curl "http://localhost:4000/communities/<community-id>/export"
```

For private communities, include an active member account:

```bash
curl "http://localhost:4000/communities/<community-id>/export?userId=<member-id>"
```

The export response includes:

- Community metadata and active member records.
- Community frontend config, when configured.
- Adoption policies and their proposal, activation, and suspension artifacts.
- Questions, challenges, result challenges, archive records, and privacy-safe poll roots.
- Registry events and local devnet commitment records.
- Bond settlement records.
- An artifact manifest and export bundle with all referenced content artifacts.

Exports intentionally exclude raw encrypted ballot payloads and tally private keys. Poll data is exported as ballot commitment and nullifier roots so the public record remains auditable without exposing individual votes.

## Read-Only Replay

Use:

```bash
curl -X POST "http://localhost:4000/communities/imports/replay" \
  -H "content-type: application/json" \
  --data '{"bundle": <community-export-bundle>}'
```

Replay is read-only. It does not create local communities, questions, events, policies, or artifacts in the receiving database.

A verified replay checks:

- The root artifact is a `community-export` artifact.
- The root artifact hash matches its content.
- The artifact manifest hash matches the bundle manifest.
- Every manifest reference is present in the bundle.
- Every bundled artifact hash matches its content.
- Previous event hashes are resolvable from either exported event hashes or bundled artifact hashes.
- Commitment payload hashes and commitment hashes recompute correctly.
- Commitment source events are included in the exported event stream.

Replay returns `Verified` only when all checks pass. A tampered bundle returns `Mismatch` and lists failed checks.

## Recording A Fork

A community steward can record a fork from a known source export:

```bash
curl -X POST "http://localhost:4000/communities/<community-id>/forks" \
  -H "content-type: application/json" \
  --data '{
    "steward": "demo-curator",
    "forkName": "Community Read-Only Archive",
    "forkSlug": "community-read-only-archive",
    "reason": "Create an independently hosted civic archive.",
    "sourceExportHash": "sha256:..."
  }'
```

This creates a `community-fork` metadata artifact and emits `CommunityForked` on the source community. The source export hash and manifest hash are preserved so another client can prove which snapshot the fork used.

Recording a fork does not transfer authority, mutate prior records, or imply that the new frontend is canonical. It is a public exit signal and pointer to a replayable snapshot.

## Portable Frontend Config

Community stewards can publish presentation metadata:

```bash
curl -X POST "http://localhost:4000/communities/<community-id>/frontend-config" \
  -H "content-type: application/json" \
  --data '{
    "steward": "demo-curator",
    "displayName": "Community Civic Archive",
    "tagline": "Portable civic records.",
    "theme": {
      "primary": "#14532d",
      "accent": "#facc15",
      "background": "#f8fafc"
    }
  }'
```

Frontend config is stored as a `community-frontend-config` artifact and included in future community exports. Alternate clients may use it to render the community, but must still treat protocol events, artifacts, and replay checks as the audit source.

## Authority And Privacy Expectations

- Exports are snapshots, not live synchronization.
- Imported exports are read-only until a future canonical appchain or explicit import mode is implemented.
- Private community exports should only be shared by authorized members or stewards.
- Binding authority is not implied by export, fork, or alternate frontend display.
- Recognized or binding labels must still come from active adoption policy artifacts.
- A fork should preserve source hashes and make local presentation differences explicit.

## Current MVP Boundary

The MVP has local protocol transaction results, independent replay over the transaction feed, local devnet commitment records, and read-only community import replay. The next decentralization step is to run a public testnet with independent operators while keeping the export and replay contracts stable.
