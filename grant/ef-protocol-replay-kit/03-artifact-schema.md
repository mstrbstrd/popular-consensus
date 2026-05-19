# Artifact Schema

## Model

Popular Consensus artifacts are content-addressed JSON records. Each artifact includes:

- `artifactKind`
- `schemaVersion`
- domain payload fields
- a canonical SHA-256 hash computed from sorted JSON

Artifact manifests list required references by kind, hash, and role. Export bundles include a root artifact, manifest, manifest hash, and referenced artifacts.

## Grant Demo Artifacts

The grant demo currently writes:

```text
artifacts/grant-demo/production-slice-export.json
artifacts/grant-demo/community-export.json
artifacts/grant-demo/tampered-production-slice-export.json
artifacts/grant-demo/full-lifecycle-report.json
```

## What Other Builders Can Reuse

Builders can reuse the manifest pattern and bundle integrity checks to make their own civic records portable and tamper-evident.
