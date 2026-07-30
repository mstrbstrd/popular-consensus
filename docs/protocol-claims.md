# Protocol Claims And Evidence

Popular Consensus uses maturity-qualified claims. A claim is permitted only when its evidence gate is satisfied.

| Claim | Meaning | Minimum evidence | Current status |
| --- | --- | --- | --- |
| Content-addressed | Public artifacts have deterministic hashes and can be verified against their content. | Canonical serialization, hash verification, manifest verification, export bundle tests. | Supported locally |
| Replayable | A client can verify and rebuild defined state from protocol transactions and artifacts without reading domain tables. | Public replay contract, deterministic checks, failed-check reporting. | Supported for the local transaction feed |
| Independently replayed | Independent operators replay the same live feed and publish matching hashes. | Required operator attestations and matching transaction/event stream hashes. | Pending public testnet |
| Canonical network | Shared network events, not an API database, determine protocol state. | Live event ingestion, reorg handling, complete database rebuild, matching independent state roots. | Not yet supported |
| Decentralized service | No single operator controls availability, transaction ingress, civic history, or community continuation. | Multiple indexers and relays, replicated artifacts, independent tallying, operator-aware client, live fork continuation. | Not yet supported |
| Portable identity | Participants control signing identity and can move between clients and operators. | Signed actions, key recovery/rotation/revocation, portable profile and credential boundaries. | Not yet supported |
| Private eligibility proof | Eligibility is proven without revealing the participant's reusable credential secret to an operator. | Reviewed proof system, client-side secret custody, revocation and expiry verification. | Not yet supported |
| Zero-knowledge | The deployed proof system demonstrates the claimed statement without disclosing protected witness data. | Formal statement, reviewed implementation, test vectors, independent cryptographic review. | Prohibited claim for current demo proof |
| Encrypted ballots | Stored ballot payloads are encrypted to the configured tally key. | Encryption tests and aggregate-only result interfaces. | Supported in demo mode |
| Threshold tallying | No complete tally private key exists and a valid result requires verified shares from an authorized threshold committee. | Distributed key generation, member authentication, verifiable shares, public transcript, threshold result proof. | Lifecycle scaffold only |
| Forkable | A community can preserve verified parent history and continue live operation under new operators and governance. | Verified live import, lineage, continued writes, independent frontend and operator configuration. | Read-only export/replay only |
| Public utility | Communities can use, verify, migrate, fork, and continue without the founding operator, under mission-bound governance. | All public-utility roadmap Gates 0 through 6 complete. | Not yet supported |
| Recognized authority | An external institution has formally committed to use a defined process or respond under adopted rules. | Active adoption policy, legal/organizational handoff, institutional response obligation. | Not yet demonstrated |
| Binding authority | A valid external decision-maker has formally made the result binding within a defined legal or organizational scope. | Qualified legal review, formally adopted rules, quorum/approval/remedy process, audited infrastructure. | Prohibited for current deployments |

## Language Rules

Use precise qualifiers:

- Say **local protocol transaction feed**, not canonical chain, until live network events are authoritative.
- Say **demo credential membership proof**, not zero-knowledge proof, until the reviewed proof system is deployed.
- Say **threshold tally lifecycle**, not threshold cryptography, until distributed key generation and share verification are complete.
- Say **read-only fork export**, not live fork, until a community can continue writing independently.
- Say **decentralization-ready architecture**, not decentralized service, until independent operation and failure tests pass.
- Say **advisory**, unless a recognized or binding adoption policy has valid external authority.

## Updating Claims

A pull request that changes a claim must include:

1. the evidence artifact or test;
2. the relevant trust-assumption update;
3. the public-utility roadmap gate update;
4. migration and rollback implications;
5. any external review required by the claim.