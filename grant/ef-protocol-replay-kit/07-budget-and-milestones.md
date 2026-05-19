# Budget And Milestones

## Proposed Grant Track

Recommended ask: USD 92,000.

| Milestone | Timeline | Deliverables | Acceptance criteria | Budget |
| --- | ---: | --- | --- | ---: |
| Protocol spec and threat model | Weeks 1 to 4 | Protocol boundary, event schema, artifact schema, replay rules, threat model, test vectors | Third party can understand how to rebuild civic state from events and artifacts | USD 18,000 |
| Ethereum anchoring contracts | Weeks 5 to 8 | Split contracts, event alignment, access-control assumptions, local deployment, Foundry tests | Full lifecycle can be anchored locally and event logs map to canonical protocol events | USD 24,000 |
| Replay verifier and indexer kit | Weeks 9 to 13 | `@pc/replay`, CLI verifier, API verifier, bundle verifier, chain verifier, tamper tests | Clean bundle verifies, tampered bundle fails, chain events rebuild state | USD 32,000 |
| Public testnet demo and final report | Weeks 14 to 16 | Public deployment, operator runbook, demo transcript, final public report | External reviewer can run the verifier and reproduce the report | USD 18,000 |

## What Other Builders Can Reuse

The milestone shape is reusable by grant reviewers and ecosystem builders who want concrete, testable outputs instead of platform promises.
