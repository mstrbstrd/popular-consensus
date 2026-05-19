# Minimum Public Promises

Popular Consensus should never ask people to “just trust the app.” Important actions must leave a public record that someone else can check later.

This page lists the minimum public promises the MVP must publish outside the app database before we can claim public auditability. The typed source of truth is `MinimumProtocolCommitments` in `packages/shared/src/index.ts`; this document explains what those commitments mean in plain language.

## Promise Set

| Promise | Plain meaning | Event anchors | Record anchors | Technical owner |
| --- | --- | --- | --- | --- |
| Question text | What was asked, what answers were allowed, who could vote, and how the question changed. | `QuestionSubmitted`, `QuestionAmended` | `question-body`, `sponsor-disclosure` | `QuestionRegistry` |
| Stake and rewards | Money-like demo value held for proposals, flags, refunds, rewards, and community funds. | `BondEscrowed`, `BondSettled` | none | `StakeManager` |
| Flagged question or result | Who raised a concern, why they raised it, and what evidence they shared. | `ChallengeOpened`, `ResultChallenged` | `question-challenge-evidence`, `result-challenge-evidence` | `ChallengeCourt` |
| Review decision | How a concern was resolved, whether a result changed, and where value was paid. | `ChallengeRuled`, `ResultChallengeRuled`, `ResultCorrected` | `question-challenge-resolution`, `result-challenge-resolution`, `result-artifact-correction` | `ChallengeCourt` |
| Result receipt | The final vote count, privacy report, invalid vote count, and public proof reference. | `ResultPublished`, `ResultCorrected`, `ResultFinalized` | `result-artifact`, `result-artifact-correction` | `ResultArchive` |
| Next-step rule | Whether a result is only a community signal or is tied to a real-world handoff. | `AdoptionPolicyProposed`, `AdoptionPolicyActivated`, `AdoptionPolicySuspended` | `adoption-policy-proposal`, `adoption-policy-activation`, `adoption-policy-suspension` | `AdoptionRegistry` |
| Export package | The complete record a community can take with it if it leaves or mirrors the system. | `QuestionArchived` | `question-archive`, `artifact-manifest`, `artifact-export-bundle` | `QuestionRegistry` |
| Rewards report | Opt-in member consent, privacy-safe reports, approved customers, and value sharing. | `DataUnionPolicyProposed`, `DataUnionPolicyActivated`, `DataUnionConsentRecorded`, `DataUnionConsentRevoked`, `DataUnionProductPublished`, `DataUnionAccessGranted` | `data-union-policy`, `data-union-policy-activation`, `data-union-consent`, `data-union-consent-revocation`, `data-union-product`, `data-union-access-grant` | `DataUnionRegistry` |

## Public Contract

The API exposes the current set at:

`GET /public/protocol/commitments`

The response includes a `minimum-commitments-v0` protocol block with a deterministic `commitmentSetHash`, plus the shared definitions clients can use to check which public events and record anchors are required.

## Local Devnet Records

Until lifecycle actions are wired to live contracts, the API writes local public-promise records for every covered event. These records use `devnet-commitment-v0` payloads and can be inspected at:

`GET /registry/commitments`

Each record stores the promise kind, technical owner, source event, payload hash, and commitment hash. That gives indexers, testers, and public reviewers a concrete surface to check before local records are replaced by live contract events.
