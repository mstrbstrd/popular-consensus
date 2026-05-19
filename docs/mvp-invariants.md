# Popular Consensus MVP Invariants

This document lists the product and protocol invariants the runnable MVP must preserve. These are not feature ideas. They are guardrails: if a change violates one, the MVP is no longer expressing the Popular Consensus mission in `docs/popular_consensus_mission.md`. For mission-level evidence and gaps, see `docs/mission-to-mvp-traceability.md`.

## 1. Civic Purpose, Not Market Mechanics

The application must remain a civic question, deliberation, and polling system.

- No answer-side financial positions.
- No market pricing signals or outcome speculation mechanics.
- No reward for choosing the side that later receives more support.
- PC utility is limited to local gas-adjacent demo balances, proposal staking, challenge staking, juror/tally rewards, and governance-adjacent utility.

Covered by:
- `pnpm lint:terms`
- contract tests for proposal/challenge stake behavior

## 2. Advisory by Default

Every question, community, result, and adoption surface must default to advisory authority.

- Binding authority must never be implied by question creation.
- Recognized or binding labels require an explicit active community adoption policy.
- Adoption policy proposals have no authority effect until activated by a community owner or moderator account.
- Binding adoption policies require explicit legal handoff metadata before activation.
- Suspended adoption policies must stop elevating future matching questions.
- Unpublished questions tied to a suspended policy must return to advisory authority.
- Result artifacts must include the authority level.
- Result artifacts should include the adoption policy reference when a policy determined the authority level.

Covered by:
- API integration tests for `authorityLevel`
- DB-backed API tests for adoption proposal, activation, and suspension
- e2e assertions for `Advisory`
- contract adoption default test

## 3. Account-Backed Writes

Protocol-changing product actions must be attached to a local account in the MVP.

- Question proposals require an existing local proposer account.
- Challenges require an existing local challenger account.
- Amendments require an existing local proposer account.
- Communities require an existing local creator account.
- Question acceptance and challenge rulings require an active community owner or moderator account.
- Proposers cannot challenge or accept their own question.
- Proposers and challengers cannot rule on their own challenge dispute.

Covered by:
- DB-backed API tests
- e2e account creation flow

## 4. Community Boundary Integrity

Communities are first-class scopes for civic discourse.

- Public communities are visible to everyone.
- Private communities can be discovered in local demo mode, but their question feeds are member-gated.
- Non-members cannot propose into private communities.
- Non-members cannot challenge or amend questions in private communities.
- Joining a community must update the active user's visible feed.

Covered by:
- DB-backed API invariant tests
- e2e private community join test

## 5. Private Content Access Control

Private community content must not leak through alternate API routes.

- Private questions must not appear in unauthenticated/global feeds.
- Private questions must not appear in non-member global feeds.
- Direct question lookup must reject non-members.
- Question history lookup must reject non-members.
- Poll result lookup must reject non-members.

Covered by:
- DB-backed API invariant tests

## 6. Ballot Secrecy

Individual ballot contents must remain private by default.

- Ballots are encrypted before storage.
- API vote responses must not expose raw encrypted payload JSON.
- Result APIs must return aggregates and proof/artifact references, not individual choices.
- Result artifacts must not include credential secrets or private identity evidence.
- Data-union products must reference published aggregate result artifacts only; they must not include raw ballots, encrypted payloads, credential secrets, or identifiable responses.
- Data-union product publication must require active member consent count and result turnout to meet the active policy cohort threshold.

Covered by:
- privacy package tests
- DB-backed API tests
- e2e aggregate result assertions

## 7. Eligibility and Duplicate Participation

A respondent must prove local demo eligibility before voting, and a poll must reject duplicate participation.

- Invalid credentials must fail.
- Credential schema mismatch must fail.
- Demo credential issuance must allow only one active credential per holder, schema, and issuer.
- Private community polls require the credential holder alias to be an active member.
- A poll-specific nullifier must prevent a second valid ballot from the same credential.

Covered by:
- privacy package tests
- DB-backed API tests
- e2e duplicate vote test

## 8. Poll Lifecycle Controls

The UI and API must respect poll lifecycle state.

- New questions start in registry review with a configured poll, not an open poll.
- A poll may open only after the question is accepted and all pending challenges are resolved.
- Rejected questions must not open for voting.
- Voting is allowed only while the poll status is open.
- Closed or result-published polls must disable vote controls.
- Result loading is available only once a result exists.
- The UI must show explicit poll state labels.

Covered by:
- e2e poll lifecycle tests
- API vote status checks

## 9. Civic TCR Bond Settlement

Proposal and challenge economics must protect registry quality without creating answer-side markets.

- Proposals create proposal bond ledger entries with owner, amount, status, and settlement fields.
- Challenges create challenge bond ledger entries with owner, amount, status, and settlement fields.
- Sustained challenges slash proposal bonds and refund/reward challengers according to governance parameters.
- Rejected challenges slash challenge bonds and preserve the path for question acceptance.
- Amendments that resolve pending challenges refund challenge bonds.
- Accepted questions refund proposal bonds when the poll opens.
- Reputation events are non-transferable service records for curation work.

Covered by:
- DB-backed API bond settlement tests
- contract tests for proposal/challenge stake behavior

## 10. Public Archive and Auditability

Every civic action that changes registry state should leave a durable public trace.

- Question submission emits a registry event.
- Challenge opening emits a registry event.
- Amendment emits a registry event.
- Challenge rulings and bond settlement emit registry events.
- Question acceptance and poll opening emit registry events.
- Poll close and result publication emit registry events.
- Question bodies, sponsor disclosures, evidence, and result artifacts use content-addressed storage.

Covered by:
- artifact package tests
- DB-backed API history tests

## 11. Sponsor and Methodology Disclosure

Question context must not be detached from disclosure.

- Every proposed question requires sponsor disclosure input.
- Every question stores a sponsor disclosure artifact hash.
- Every question includes a methodology label.

Covered by:
- shared schema validation
- DB-backed API tests
- e2e question proposal test

## 12. Local Demo Trust Honesty

The MVP may use local shortcuts, but it must label them honestly.

- Local accounts are not production authentication.
- Private communities are API membership-gated, not credential-encrypted spaces.
- The tally coordinator is a demo trust assumption until a threshold tally committee is implemented.

Covered by:
- README trust model
- result artifact privacy report

## 13. User-Facing Error Recovery

Expected product errors must be shown inline rather than crashing the app.

- Duplicate local account creation shows a useful UI message.
- Duplicate community slug creation shows a useful UI message.
- Duplicate ballot submission shows a useful UI message.
- Private feed denial shows a useful UI message and allows joining.

Covered by:
- e2e account/community conflict tests
- e2e duplicate vote test
- e2e private join test
