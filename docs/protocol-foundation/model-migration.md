# Model migration and delivery gates

## Four categories, not one public database

Classify every model and field as normative public evidence, restricted evidence,
application projection, operational data, or secret. Normative means relevant to
validity, not automatically safe for publication. Keep personal data, consent
identity links, payout identities, and secret witnesses out of public logs.

## Current-to-target map

| Existing surface | Proposed evolution | First acceptance evidence |
| --- | --- | --- |
| `UserAccount`, caller IDs in request DTOs | Keep profiles; introduce principals, verification methods, capabilities, recovery, and separate verified authorization. Anonymous ballot authorization is allowed. | Impersonation, revoked-key, wrong-role, and replay rejection. |
| `Community`, `CommunityMember`, role strings | Version community policies and scoped grants; separate membership privacy from public governance. | Cross-community authority and private-read rejection. |
| `Question.version`, unique `Poll.questionId` | Immutable `QuestionVersion`; multiple `PollDefinition` observations over time, each bound to fixed wording and policies. | Previous observations remain reconstructable and unchanged. |
| `Credential.secretHash`, issuer public keys | Separate issuer-authenticated credential profiles from wallet secrets and private presentation proofs. | Forgery, stale status, wrong-scope proof, and duplicate-person/credential cases. |
| `TallyCommittee.memberIds`, parallel commitment arrays | Normalize authenticated committee members and ceremony participants; bind shares to keys, polls, and transcripts. | Duplicate/wrong-key/wrong-poll/invalid-share denial. |
| `Poll.tallyPrivateKeyPem`, `TallyKeySetup.demoPrivateKeyPem` | Isolate demo storage; remove complete key material from the production model. | Production startup/storage/log/backup secret tests. |
| `Ballot`, `privacyThreshold` | Keep poll-scoped anti-duplication; add reviewed privacy and publication profiles, not a universal safe-count assumption. | Correlation, one-person aggregate, and overlapping-release attacks. |
| `Result`, mutable final status | Version publications, corrections, evidence levels, and procedural finality separately. | No overwrite or unsupported verification label. |
| `RegistryEvent`, `ProtocolTransactionResult` | Versioned canonical commands/events, explicit ordering/finality, privacy-aware authorization disclosure, independent replay. | Tamper, truncation, reorder, equivocation, and historical-version vectors. |
| `Bond`, reward fields, `ReputationEvent` | Asset-specific journal/settlement; separate money, reputation, capability, funded entitlement, and payout. | Conservation, duplicate payout, appeal reversal, and no answer-link tests. |
| No adopted data-union baseline | Contribution policy, consent receipt, data-use authorization, report release, reward policy, and private payout claim. | Individual permission, collective approval, privacy release, funding, and withdrawal checked independently. |
| Exports, archives, forks | Public evidence export plus separately authorized private portability; explicit continuation namespace and lineage. | Founder-loss recovery without transferring others' private data or consent. |

## Incremental compatibility strategy

Keep the existing demo intact while new versions are introduced. Add strict draft
schemas alongside existing Zod DTOs, then adapt one vertical workflow at a time.
Do not silently strip unknown security fields, add demo actor defaults, or turn
legacy records into apparently authenticated production history.

Tag imported historical records with their original version and trust profile.
Capture a fixture before changing a projection. Expand, backfill with provenance,
compare reconstruction, switch reads/writes, and only then retire old columns.
Private/secret data does not belong in public migration artifacts. Test restore
before changing persistent data and never put private keys in migration logs.

The existing `db:migrate` script runs `prisma db push`; it remains a demo tool in
this PR. Introduce reviewed versioned migrations and backup/restore tests before
handling real participant data. A database migration is not a protocol upgrade.

## Ordered work packages

| Gate | Work | Evidence before advancement |
| --- | --- | --- |
| F0 (this slice) | Constitution, decisions, invariant catalog, isolated policy/intent schemas, rejection tests, scoped CI. | Draft scope is explicit; new shape checks pass; existing shared contracts remain compatible. No runtime security claim. |
| F1 | Authenticated actor/proof context, strict commands, capability matrix, executable transition engine, safe runtime modes. | Integration tests deny impersonation, replay, privilege escalation, invalid time/state, and demo shortcuts in public mode. |
| F2 | Reviewed private eligibility, first limited ballot/tally format, safe publication, recovery. | Independent crypto/privacy review and adversarial end-to-end tests for the declared properties. |
| F3 | Canonical evidence specification, replay kit, checkpoints, independent indexing and artifact availability. | Fresh databases agree; malicious/truncated histories fail; founding API loss is exercised. |
| F4 | Funded campaigns, consent/use engine, private entitlements, journal and payout adapters, remedies. | Funding established before work; policy references verified; no duplicate effects; compensation does not expose answers. |
| F5 | Independent rehearsal, accessibility tests, security/release review, real bounded paid pilot. | External evaluation, compensation reconciliation, useful community follow-up, incident and continuity drills. |
| F6 | Wider federation, contributor governance, repeat funding, independently maintained verifier. | Evidence-backed public-utility claims and continuation without founder permission. |

Discovery and community co-design can proceed in parallel. Real protected
participation or real-money obligations cannot skip their gates. Do not mark
F1-F6 complete because schemas or documentation exist.

## Release and repository settings still required

The new workflow validates foundation/shared contracts only. Add API/database,
privacy/artifact, browser, contract, fuzz/state-machine, secret/dependency, and
release-provenance checks in subsequent security work. Protect `main` and require
appropriate independent review once the checks exist. Do not impose an impossible
requirement for external review by naming reviewers who have not agreed to serve.
No license, treasury, domain, release-key, or branch-protection change is made here.
