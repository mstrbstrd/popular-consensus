# Replay Test Vectors

## Purpose

Replay test vectors make the verifier easier to inspect outside the running app. They give reviewers fixed JSON artifacts that should either verify cleanly or fail for a named reason.

## Current Vectors

Run:

```bash
pnpm grant:replay-test-vectors
```

The command writes fixtures under:

```text
packages/replay/test/fixtures/
```

Current fixture files:

- `clean-production-slice-export.json`
- `clean-community-export.json`
- `tampered-result-hash.json`
- `missing-archive-artifact.json`
- `reordered-events.json`

The command also writes:

- `artifacts/grant-demo/replay-test-vectors-report.json`
- `artifacts/grant-demo/replay-test-vectors-transcript.txt`

## Expected Results

| Fixture | Expected status | Review point |
| --- | --- | --- |
| `clean-production-slice-export.json` | `Verified` | The full credential-to-archive production slice verifies |
| `clean-community-export.json` | `Verified` | The standalone artifact bundle verifies without the app database |
| `tampered-result-hash.json` | `Mismatch` | Result artifact tampering is detected |
| `missing-archive-artifact.json` | `Mismatch` | Archive root removal is detected |
| `reordered-events.json` | `Mismatch` | Event stream continuity rejects reordered events |

## Test Coverage

The replay package test suite reads these fixture files directly. That keeps the test vectors from becoming decorative docs; if a fixture drifts away from verifier behavior, `pnpm --filter @pc/replay test` fails.

## What Other Builders Can Reuse

Other builders can reuse the vector shape and expected-status pattern to publish clean and tampered civic-record fixtures for independent verifier implementations.
