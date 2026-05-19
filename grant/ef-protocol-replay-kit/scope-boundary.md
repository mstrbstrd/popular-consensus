# EF Protocol Replay Kit Scope Boundary

## Scope Statement

Build an open-source Ethereum civic-record replay kit that anchors Popular Consensus protocol events, exports content-addressed civic artifacts, and verifies rebuilt state from event streams without trusting the application database.

## In Scope

- Canonical protocol event and artifact schemas.
- Content-addressed artifact manifests and export bundles.
- Replay verification for clean and tampered records.
- Ethereum anchoring contract alignment.
- Public civic-record API and backend demo scripts.
- Test vectors, demo reports, and threat model notes.

## Out Of Scope

- Social feed growth work.
- Paid report marketplace features.
- Customer sales workflows.
- Production reward commercialization.
- Platform analytics and onboarding polish.
- Token launch or tokenomics.

## Boundary Rule

Platform code may depend on protocol code. Protocol code must not depend on platform-specific UI, customer workflows, paid reports, or social-feed behavior.

## Acceptance Criteria

- The grant scope can be explained in one paragraph.
- The proposal still makes sense if Popular Consensus never becomes a commercial platform.
- Protocol truth is replayable outside the app database and outside the web client.

## What Other Builders Can Reuse

Other builders can reuse the event model, artifact bundle format, replay checks, tamper fixtures, and grant demo script without adopting the Popular Consensus social platform.
