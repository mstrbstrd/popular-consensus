# Trust Assumption Register

This register records who or what must currently be trusted, what happens when that assumption fails, and what evidence is required to retire it. It is intentionally stricter than feature checklists.

| Area | Current trust assumption | Failure if assumption is false | Required replacement | Current maturity |
| --- | --- | --- | --- | --- |
| Canonical state | The API-generated protocol transaction feed and PostgreSQL domain rows are consistent. | An operator can serve or persist a view that is not derived from an independently shared network. | Live canonical network events, deterministic event ingestion, complete rebuild, matching independent state roots. | Local protocol demo |
| Contract deployment | The maintainer selects the intended RPC, signer, bytecode, and chain. | Known development keys, wrong chain, or unverified bytecode can control a deployment. | Explicit remote chain checks, external signer, bytecode verification, versioned deployment manifest, multisig ownership. | Local protocol demo |
| Contract authorization | API role checks prevent unauthorized calls to permissive contract functions. | A direct caller can bypass application policy and mutate protocol state. | Contract-enforced roles, signatures, lifecycle guards, timelocks, and negative authorization tests. | Local protocol demo |
| User identity | A caller-provided local account identifier represents the acting participant. | Impersonation and unauthorized civic actions. | Participant-controlled signing keys, verified sessions, recovery, rotation, and revocation. | Demo only |
| Credential eligibility | The API may receive a credential secret and compare deterministic hashes correctly. | Operator learns reusable secrets and proof privacy claims are false. | Reviewed selective-disclosure or zero-knowledge proof system where secrets remain client-held. | Demo only |
| Duplicate voting | Nullifiers derived from a secret are unique and not reusable across a poll. | Duplicate or linkable participation. | Reviewed poll-bound nullifier construction tied to valid, unrevoked credentials. | Prototype |
| Ballot encryption | The coordinator private key remains secret and is used honestly. | One database or operator compromise reveals ballots or manipulates tallying. | Distributed key generation, no complete private key, authenticated and verifiable threshold decryption. | Demo only |
| Tally committee | Recorded share and proof hashes represent valid shares from real committee members. | Fabricated or unauthorized shares can satisfy the lifecycle threshold. | Cryptographic share verification, member authentication, public transcript, failure and replacement protocol. | Lifecycle scaffold |
| Artifact integrity | SHA-256 canonical JSON hashes bind artifacts correctly. | Tampered artifacts may be accepted if canonicalization or verification differs. | Stable normative canonicalization, test vectors, independent implementations, signed release compatibility policy. | Implemented locally |
| Artifact availability | The local artifact directory remains available and backed up. | Civic records disappear despite valid hashes. | Independent replicated storage, availability attestations, repair rules, archival policy. | Local only |
| API availability | The configured API endpoint is honest and reachable. | Users cannot read or submit, or receive a censored/divergent view. | Signed operator discovery, multiple indexers and relays, comparison, failover, divergence warnings. | Central endpoint |
| Database durability | The operator's PostgreSQL volume and backups remain intact. | Service outage or loss of derived state. | Disposable projections rebuilt from canonical events and artifacts, tested recovery. | Central projection and domain store |
| Private community access | API membership checks prevent non-member access. | Private content leaks through operator compromise or alternate routes. | Cryptographic group access, key distribution, revocation, rekeying, explicit metadata leakage model. | API-gated |
| Community exit | A verified read-only export is sufficient for practical exit. | A community can archive but cannot continue governing independently. | Verified live import, new namespace, continuing transactions, visible parent lineage, independent frontend and operators. | Read-only exit |
| Governance | Maintainers exercise emergency and upgrade powers in the public interest. | Capture, silent rule changes, frozen releases, or founder dependency. | Mission-bound steward, narrow councils, multisig, timelocks, public proposals, founder-power sunset, fork rights. | Founding stewardship |
| Legal authority | Authority labels and legal handoff metadata are accurate. | Advisory output is misrepresented as recognized or binding. | Institutionally adopted rules, verified legal handoff, public response and remedy process. | Advisory default |
| Security | Tests and maintainer review are sufficient to find serious flaws. | Contract, application, privacy, or operational compromise. | Independent audits, threat models, fuzz/property tests, disclosure process, incident drills, bug bounty. | Pre-audit |
| Continuity | The founder and original repository remain available. | Governance, domains, releases, or operations stall. | Distributed maintainership, documented succession, protected protocol assets, independent implementations and operators. | Founder-dependent |

## Trust-Retirement Rule

An assumption is retired only when all of the following exist:

1. a documented replacement mechanism;
2. automated tests for normal and adversarial behavior;
3. independent operational evidence;
4. a recovery process;
5. a public artifact that records the evidence;
6. an updated readiness claim.

Code paths, schemas, adapters, or documentation alone do not retire a trust assumption.

## Review Cadence

Review this register whenever:

- a maturity gate changes;
- a new operator role is introduced;
- a security or privacy claim changes;
- an incident or audit reveals a new dependency;
- a community adopts recognized or binding authority;
- a protocol upgrade changes custody, identity, tally, storage, or governance.