# Rewards and Data Union MVP

The Popular Consensus rewards layer lets a community turn opt-in, privacy-safe results into approved reports. It is not a market for personal data. The MVP only shares combined results, method records, privacy notes, reward rules, opt-in records, approved customer access, and payment routing.

## Implemented Surface

- Community guides can suggest and activate reward rules.
- Reward rules define what reports are allowed, how many people must opt in, how long records are kept, and how value is split.
- Active members can opt in for each rule.
- Members can revoke consent for future reports.
- Guides can publish combined-result reports only when enough people opted in and enough people voted.
- Reports point to public result receipts, count receipts, proof receipts, and privacy notes.
- Reports never include raw ballots, encrypted vote payloads, voting-pass secrets, or identifiable responses.
- Guides can approve customer access with a stated purpose and clear use terms.
- Customer payments are routed into community fund, member reward, author reward, and helper reward ledger entries.
- Public reads are available at `GET /communities/:communityId/data-union`.
- Data-union records are included in community exports and protocol transaction replay through `DataUnionRegistry`.

## API Lifecycle

| Step | Endpoint | Protocol event |
| --- | --- | --- |
| Propose policy | `POST /communities/:communityId/data-union/policies` | `DataUnionPolicyProposed` |
| Activate policy | `POST /communities/:communityId/data-union/policies/:policyId/activate` | `DataUnionPolicyActivated` |
| Record consent | `POST /communities/:communityId/data-union/consents` | `DataUnionConsentRecorded` |
| Revoke consent | `POST /communities/:communityId/data-union/consents/:consentId/revoke` | `DataUnionConsentRevoked` |
| Publish product | `POST /communities/:communityId/data-union/products` | `DataUnionProductPublished` |
| Grant access | `POST /communities/:communityId/data-union/products/:productId/access-grants` | `DataUnionAccessGranted` |

## Payment Routing

Customer payments are recorded as public ledger entries:

- buyer debit: `DataUnionPayment`
- community treasury credit: `DataUnionRevenue`
- member pool credit: `ParticipantPoolCredit`
- operator pool credit: `OperatorPoolCredit`

The demo policy can split value across the community fund, members, the question author, and operators. Any split must total exactly 100 percent.

## MVP Boundaries

- The MVP does not sell individual ballots, encrypted payloads, identities, voting-pass secrets, or user-level response histories.
- Consent is checked when a report is published. It is not a promise to delete combined reports that were already published to the public record.
- Customer payment is local PC accounting, not an external payment rail.
- Member and operator credits are ledger records. Full claim distribution is a later protocol slice.
- Report quality and customer eligibility are guide-approved in this MVP. Later versions should add community votes, allow/deny lists, customer evidence files, and automated use-term checks.
