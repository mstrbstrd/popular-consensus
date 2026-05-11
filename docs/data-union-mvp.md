# Data Union MVP

The Popular Consensus data-union layer lets a community turn opt-in, privacy-safe aggregate poll outputs into governed data products. It is not a market for personal data. The MVP only exposes published aggregate result references, methodology hashes, privacy reports, policy records, consent records, buyer access grants, and treasury routing.

## Implemented Surface

- Community stewards can propose and activate data-union policies.
- Policies define allowed product types, minimum cohort size, consent revocation rule hash, retention window, and revenue split.
- Active members can opt in per policy and scope.
- Members can revoke consent for future aggregate-product participation.
- Stewards can publish aggregate result products only when active consent count and result turnout meet the policy cohort threshold.
- Product artifacts reference public result artifact hashes, aggregate-count hashes, tally proof hashes, and privacy report hashes.
- Product artifacts explicitly exclude raw ballots, encrypted payloads, credential secrets, and identifiable responses.
- Stewards can grant buyer access with purpose and license hashes.
- Access grants route payment into community treasury, participant pool, and operator pool ledger entries.
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

## Treasury Routing

Access payments are recorded as public treasury ledger entries:

- buyer debit: `DataUnionPayment`
- community treasury credit: `DataUnionRevenue`
- member pool credit: `ParticipantPoolCredit`
- operator pool credit: `OperatorPoolCredit`

The default policy split is 70 percent community treasury, 20 percent participant pool, and 10 percent operator pool. Policy proposals can set a different integer split as long as the total is exactly 100 percent.

## MVP Boundaries

- The MVP does not sell individual ballots, encrypted payloads, identities, credential secrets, or user-level response histories.
- Consent is enforced at product publication time by active community-member consent count and result turnout. It is not a retroactive deletion promise for aggregate products already published to the audit log.
- Buyer payment is local PC accounting, not external settlement.
- Participant and operator pool credits are ledger records; claim distribution mechanics are a later protocol slice.
- Product quality and buyer eligibility are steward-governed in this MVP; later versions should add community votes, allow/deny lists, buyer attestations, and automated license checks.

