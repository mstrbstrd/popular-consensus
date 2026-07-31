# Public Utility Readiness Roadmap

This roadmap begins where `docs/decentralized-protocol-roadmap.md` ends. The existing roadmap measures completion of the local protocol MVP and its independent public-testnet gate. This roadmap measures whether Popular Consensus can operate as durable, independently governed civic infrastructure.

## Maturity Levels

1. **Local protocol demo**: protocol boundaries and workflows are testable locally.
2. **Independent federation rehearsal**: external operators can deploy, index, replay, and attest.
3. **Security-complete public testnet**: authorization, identity, privacy, tallying, storage, and recovery are production-shaped and independently reviewed.
4. **Advisory public beta**: real communities can run bounded, explicitly advisory processes.
5. **Public utility candidate**: communities can verify, migrate, fork, and continue without the founding operator.
6. **Recognized decision infrastructure**: institutions formally adopt specific processes under their own legal and governance rules.

A maturity label is a claim with evidence requirements. Completing the MVP roadmap does not imply completion of this roadmap.

## Gate 0: Truthful Baseline And Claims

- [x] Create this public-utility roadmap.
- [x] Add a trust-assumption register.
- [x] Add machine-readable readiness auditing.
- [ ] Regenerate the MVP completion audit from current `main`.
- [ ] Publish project license, security, contribution, conduct, governance, maintainer, release, and support policies.
- [ ] Link every use of `decentralized`, `canonical`, `zero-knowledge`, `threshold`, `binding`, and `public utility` to its evidence and maturity level.

**Completion evidence:** `pnpm utility:audit` reports the current blockers without hiding demo assumptions. `pnpm utility:audit:strict` remains non-zero until every public-utility gate is satisfied.

## Gate 1: Canonical Protocol Network

- [ ] Choose and document the first real network boundary.
- [ ] Add a guarded public-testnet deployment adapter with no development-key fallback.
- [ ] Add contract-level authorization for every privileged transition.
- [ ] Enforce cross-module lifecycle invariants at the protocol layer.
- [ ] Build a chain-event indexer with confirmation, reorg, idempotency, and checkpoint handling.
- [ ] Rebuild every public projection from canonical events and verified artifacts.
- [ ] Produce matching state roots across independent indexers.
- [ ] Keep pilot economics non-speculative and legally reviewed.

**Completion evidence:** an empty database rebuilds to the same state root as at least two independently operated indexers, and unauthorized contract actions revert.

## Gate 2: Participant Identity And Ballot Privacy

- [ ] Replace request-supplied actor identifiers with participant-controlled signed identity.
- [ ] Add registration, authentication, recovery, key rotation, and revocation.
- [ ] Replace demo credential-secret verification with reviewed private eligibility proofs.
- [ ] Ensure credential secrets never reach an API or operator.
- [ ] Remove complete tally private keys from production storage.
- [ ] Implement distributed key generation and verifiable threshold decryption.
- [ ] Cryptographically authenticate tally committee members and shares.
- [ ] Define ballot secrecy, unlinkability, receipt, coercion, and metadata guarantees precisely.
- [ ] Add safe privacy thresholds, suppression, retention, and deletion rules.

**Completion evidence:** a leaked operator database cannot impersonate participants or decrypt ballots, and fewer than the tally threshold cannot publish a valid result.

## Gate 3: Federation, Availability, And Exit

- [ ] Publish signed operator metadata and discovery rules.
- [ ] Support multiple indexer endpoints, comparison, failover, and divergence warnings.
- [ ] Support signed transaction submission through independent relays or direct submission.
- [ ] Replicate finalized public artifacts across at least three independent providers.
- [ ] Add availability checks, repair rules, and retention classifications.
- [ ] Turn read-only community export into verified live continuation with visible fork lineage.
- [ ] Ship an independently hostable frontend with no founding-domain dependency.

**Completion evidence:** the founding API, frontend, one indexer, and one artifact provider can disappear without preventing a community from reading, verifying, submitting, or continuing through a fork.

## Gate 4: Security And Operations

- [ ] Publish protocol, identity, privacy, federation, moderation, governance, and economic threat models.
- [ ] Add fuzz, property, state-machine, malicious-indexer, malicious-issuer, and malicious-tally-member tests.
- [ ] Add strict production CORS, rate limits, request limits, least privilege, secret management, and hardware-backed or multisig signing.
- [ ] Add dependency, secret, provenance, SBOM, and reproducible-build controls.
- [ ] Define service objectives, monitoring, state-root alerts, backups, restoration, and key rotation.
- [ ] Publish incident response and public postmortem rules.
- [ ] Complete independent contract, cryptography, application, privacy, accessibility, and governance reviews.

**Completion evidence:** no unresolved critical or high-severity findings remain, signed releases are reproducible, and recovery drills have public evidence.

## Gate 5: Independent Public Utility Testnet

- [ ] Complete the existing deployer, indexer, replay-verifier, and community-steward roster.
- [ ] Add independent artifact storage, relay, credential issuer, and threshold tally operators.
- [ ] Run full civic lifecycle and adversarial failure drills.
- [ ] Publish content-addressed operator attestations and unresolved issues.
- [ ] Record a reviewed `GO` launch summary.

**Completion evidence:** independent indexers agree, threshold tallying completes, artifacts remain available, relay censorship is bypassed, and the client survives operator failure.

## Gate 6: Public-Good Governance

- [ ] Establish a Canadian mission-bound protocol steward and define any separate services entity.
- [ ] Publish charter, bylaws, conflicts, privacy, moderation, treasury, security, data access, research ethics, sponsorship, operator conduct, and exit policies.
- [ ] Publish a protocol change process with review periods, activation delays, migrations, dissent, and fork rights.
- [ ] Move release, domain, treasury, deployment, and emergency control away from any single person.
- [ ] Publish normative schemas, state machines, test vectors, conformance tests, compatibility, and deprecation rules.
- [ ] Support at least one independent implementation.

**Completion evidence:** founder absence does not freeze governance or releases, and another team can implement and operate the protocol from public specifications.

## Gate 7: Canadian Advisory Pilot

- [ ] Secure a community or institution, independent evaluator, privacy advisor, operators, and participant representatives.
- [ ] Publish question wording, eligibility, methods, authority, challenges, privacy, tally, retention, operators, and institutional commitments before participation.
- [ ] Add an institutional-response artifact and lifecycle.
- [ ] Complete a real advisory question from proposal through public archive and institutional response.
- [ ] Publish successes, failures, exclusions, accessibility findings, costs, and unresolved risks.

**Completion evidence:** a real community completes the full advisory lifecycle with external evaluation and no implied electoral or automatic legal authority.

## Gate 8: Recognized Decision Infrastructure

- [ ] Publish adoption templates, legal handoff patterns, public-record integrations, archival standards, procurement materials, operator certification, and long-term support policies.
- [ ] Require formal adoption, eligibility, issuer, quorum, approval, dispute, audit, exit, emergency, and institutional-response rules for recognized or binding processes.
- [ ] Maintain recurring transparency reports and external audits.

**Completion evidence:** an institution formally recognizes a narrowly defined Popular Consensus process under its own valid rules, with public remedies and exit guarantees.

## Immediate Critical Path

1. Regenerate the current MVP audit.
2. Guard the public-testnet deployment path.
3. Add contract authorization and protocol lifecycle invariants.
4. Make live network events canonical and prove database reconstruction.
5. Replace demo identity and credential proofs.
6. Replace coordinator-key tallying with real threshold cryptography.
7. Add federation, replicated storage, and live fork continuation.
8. Complete external review and the expanded independent testnet.

## Prohibited Claims Until Their Gates Pass

- Do not call a deployment decentralized merely because it can export or replay data.
- Do not call hash-based credential checks zero-knowledge.
- Do not call tally-share records threshold cryptography without verifiable distributed decryption.
- Do not call PostgreSQL disposable until a complete independent rebuild is demonstrated.
- Do not call a process binding without a formal external adoption and legal handoff.
- Do not call the system a public utility while communities still depend on the founding operator to continue.