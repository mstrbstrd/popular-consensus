# Grant Track Issue Draft

## Purpose

This draft is the repo coordination artifact for the strategy requirement to create a track named `EF Grant Track: Protocol Replay Kit`. It is intentionally local: it can be pasted into GitHub Issues, a project board, or another public tracker after a maintainer chooses the repository target and approves the external action.

## Issue Title

```text
EF Grant Track: Protocol Replay Kit
```

## Labels

```text
grant, protocol, replay-kit, ethereum, external-review
```

## Issue Body

```markdown
## Scope

Build an open-source Ethereum civic-record replay kit that anchors Popular Consensus protocol events onchain, exports content-addressed civic artifacts, and verifies rebuilt state from event streams without trusting the application database.

## In Scope

- Canonical protocol events and artifact schemas
- Ethereum anchoring contracts and event alignment
- Replay verifier CLI for bundle, API, chain, and tamper paths
- Backend lifecycle demo and checked test vectors
- Threat model, license boundary, reviewer handoff, and evidence manifest

## Out of Scope

- Social feed or frontend polish
- Paid reports, customer workflows, and data-union monetization
- Token launch or tokenomics pitch
- Production privacy claims before external cryptography review
- Making the application database or platform UI the source of protocol truth

## Acceptance Criteria

- `pnpm grant:check` passes without local services.
- `pnpm grant:full-check` passes with local Postgres and ephemeral Anvil.
- Clean replay returns `Verified`.
- Tampered bundle/export replay returns `Mismatch`.
- Protocol packages do not import platform packages.
- Evidence artifacts keep `formalSubmissionReady: false` until EF feedback and external cryptography review are incorporated.

## Human Review Gates

- EF Office Hours or equivalent scope feedback
- External cryptography review
- Production threshold ceremony/custody evidence
- Production decryption-share proof review
```

## Suggested Project Board Columns

| Column | Meaning |
| --- | --- |
| Scope locked | Grant-facing protocol slice is defined and product scope is excluded |
| Machine evidence ready | Local commands and generated reports pass |
| External review | EF and cryptography reviewers are providing feedback |
| Incorporation | Review feedback is being converted into repo changes |
| Submission candidate | Maintainers can decide whether to submit |

## Current Local Status

The repo currently keeps this as a draft because no public issue tracker target has been selected in this workspace. Generated review artifacts should continue to record this as machine evidence, not as proof that an external public issue has been opened.

## What Other Builders Can Reuse

Other builders can reuse this issue shape to keep protocol grant work organized around replay evidence, public-good scope, and explicit human review gates instead of product roadmap sprawl.
