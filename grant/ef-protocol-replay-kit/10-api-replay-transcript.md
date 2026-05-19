# API Replay Transcript

## Command

```bash
pnpm grant:api-replay
```

## Expected Output

```text
EF Protocol Replay Kit API replay: Verified
Report: artifacts/grant-demo/api-replay-report.json
Transcript: artifacts/grant-demo/api-replay-transcript.txt
Checks: 10/10
```

## What The Demo Does

- Resets local demo data.
- Creates a public advisory question through the API.
- Accepts the question and opens the poll.
- Issues a demo credential.
- Generates a credential proof by signing up for the poll.
- Submits an encrypted ballot.
- Confirms the duplicate nullifier is rejected.
- Closes the poll, tallies, finalizes, and archives the question.
- Starts the API on an ephemeral localhost port.
- Runs API replay verification against the public civic-record and replay-check endpoints.

## Current Evidence

The latest local run wrote:

```text
artifacts/grant-demo/api-replay-report.json
artifacts/grant-demo/api-replay-transcript.txt
```

The replay status was `Verified`, with `10/10` checks passing.

## What Other Builders Can Reuse

Other builders can reuse the API replay pattern to prove that a public record endpoint and its replay endpoint agree on lifecycle state, event stream hash, result artifact hash, and archive hash.
