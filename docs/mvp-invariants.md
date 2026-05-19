# Popular Consensus MVP Invariants

This document lists the promises the runnable MVP must keep. These are not feature ideas. They are guardrails: if a change violates one, the MVP is no longer expressing the Popular Consensus mission in `docs/popular_consensus_mission.md`. For mission-level evidence and gaps, see `docs/mission-to-mvp-traceability.md`.

## 1. Civic Purpose, Not Market Mechanics

The application must remain a civic question, deliberation, and polling system.

- No answer-side financial positions.
- No market pricing signals or outcome speculation mechanics.
- No reward for choosing the side that later receives more support.
- PC utility is limited to local gas-adjacent demo balances, proposal staking, challenge staking, juror/tally rewards, and governance-adjacent utility.

Covered by:
- `pnpm lint:terms`
- contract tests for proposal/challenge stake behavior

## 2. Community Signal by Default

Every question, community, result, and next-step surface must default to a community signal.

- A committed decision must never be implied by question creation.
- "Guides a real next step" or "Committed decision" labels require an explicit active community rule.
- Next-step rule proposals have no effect until activated by a community lead or guide account.
- Committed-decision rules require explicit legal or community handoff metadata before activation.
- Paused rules must stop elevating future matching questions.
- Unpublished questions tied to a paused rule must return to community-signal status.
- Result receipts must include the authority level.
- Result receipts should include the next-step rule reference when a rule determined the authority level.

Covered by:
- API integration tests for `authorityLevel`
- DB-backed API tests for adoption proposal, activation, and suspension
- e2e assertions for `Advisory`
- contract adoption default test

## 3. Signed-In Actions

Actions that change the civic record must be attached to a local account in the MVP.

- Question proposals require an existing local proposer account.
- Challenges require an existing local challenger account.
- Amendments require an existing local proposer account.
- Communities require an existing local creator account.
- Question acceptance and flag decisions require an active community lead or guide account.
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

Individual vote choices must remain private by default.

- Ballots are encrypted before storage.
- API vote responses must not expose raw encrypted payload JSON.
- Result APIs must return combined counts and proof/record references, not individual choices.
- Result receipts must not include voting-pass secrets or private identity evidence.
- Rewards reports must reference published combined result receipts only; they must not include raw ballots, encrypted payloads, voting-pass secrets, or identifiable responses.
- Rewards report publication must require enough opted-in members and enough total votes to meet the active privacy threshold.

Covered by:
- privacy package tests
- DB-backed API tests
- e2e aggregate result assertions

## 7. Eligibility and Duplicate Participation

A respondent must prove local demo eligibility before voting, and each vote must reject duplicate participation.

- Invalid voting passes must fail.
- Voting-pass type mismatch must fail.
- Demo voting-pass issuance must allow only one active pass per holder, type, and issuer.
- Private community votes require the voting-pass holder alias to be an active member.
- A vote-specific duplicate blocker must prevent a second valid ballot from the same voting pass.

Covered by:
- privacy package tests
- DB-backed API tests
- e2e duplicate vote test

## 8. Voting Flow Controls

The UI and API must respect each voting step.

- New questions start in review with a prepared vote, not an open vote.
- Voting may open only after the question is accepted and all pending flags are resolved.
- Rejected questions must not open for voting.
- Voting is allowed only while voting is open.
- Closed or result-published votes must disable vote controls.
- Result loading is available only once a result exists.
- The UI must show clear voting state labels.

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

Every civic action that changes public state should leave a durable public trace.

- Question submission emits a public event.
- Flag opening emits a public event.
- Edits emit a public event.
- Review decisions and stake payments emit public events.
- Question acceptance and voting opening emit public events.
- Voting close and result publication emit public events.
- Question bodies, sponsor disclosures, evidence, and result receipts use content-addressed storage.

Covered by:
- artifact package tests
- DB-backed API history tests

## 11. Sponsor and Methodology Disclosure

Question context must not be detached from disclosure.

- Every proposed question requires sponsor disclosure input.
- Every question stores a sponsor disclosure record hash.
- Every question includes a methodology label.

Covered by:
- shared schema validation
- DB-backed API tests
- e2e question proposal test

## 12. Local Demo Trust Honesty

The MVP may use local shortcuts, but it must label them honestly.

- Local accounts are not production authentication.
- Private communities are API membership-gated, not voting-pass-encrypted spaces.
- The vote-counting coordinator is a demo trust assumption until a multi-party counting committee is implemented.

Covered by:
- README trust model
- result receipt privacy report

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

## 14. Plain-Language Public Copy

The public UI must explain actions in everyday words before exposing protocol terms.

- Primary actions should use words like ask, vote, review, count, share, save, and claim.
- Technical terms such as registry, artifact, nullifier, quorum, steward, and tally should not appear in primary user-facing labels unless they are paired with a plain explanation.
- Public proof should be introduced as a receipt or record everyone can check.
- Reward flows should describe people, reports, approved customers, payments, and claims before data-union internals.

Covered by:
- UI copy review
- README mission and trust-model review
