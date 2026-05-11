# Minimum Protocol Commitments

This is the MVP commitment set that must be anchored outside the application database before Popular Consensus can claim public auditability. The typed source of truth is `MinimumProtocolCommitments` in `packages/shared/src/index.ts`; this document explains the intent.

## Commitment Set

| Commitment | Covers | Event anchors | Artifact anchors | Target module |
| --- | --- | --- | --- | --- |
| Question version | Question body, answer schema, credential schema, authority metadata, and amendments | `QuestionSubmitted`, `QuestionAmended` | `question-body`, `sponsor-disclosure` | `QuestionRegistry` |
| Bond | Proposal/challenge escrow, settlement, rewards, refunds, slashing, and treasury accounting | `BondEscrowed`, `BondSettled` | none | `StakeManager` |
| Challenge | Question/result challenge opening, reason, challenger, evidence hash, and challenge bond | `ChallengeOpened`, `ResultChallenged` | `question-challenge-evidence`, `result-challenge-evidence` | `ChallengeCourt` |
| Ruling | Question/result rulings, resolution hashes, corrected result artifacts, and settlement effects | `ChallengeRuled`, `ResultChallengeRuled`, `ResultCorrected` | `question-challenge-resolution`, `result-challenge-resolution`, `result-artifact-correction` | `ChallengeCourt` |
| Result hash | Aggregate counts, tally proof, privacy report, turnout, invalid ballots, and final status | `ResultPublished`, `ResultCorrected`, `ResultFinalized` | `result-artifact`, `result-artifact-correction` | `ResultArchive` |
| Adoption policy | Authority level, quorum rule, approval rule, legal handoff, fork rule, activation, and suspension | `AdoptionPolicyProposed`, `AdoptionPolicyActivated`, `AdoptionPolicySuspended` | `adoption-policy-proposal`, `adoption-policy-activation`, `adoption-policy-suspension` | `AdoptionRegistry` |
| Archive | Final archive hash, artifact manifest, event snapshot, export bundle, and archived-by authority | `QuestionArchived` | `question-archive`, `artifact-manifest`, `artifact-export-bundle` | `QuestionRegistry` |

## Public Contract

The API exposes the current set at:

`GET /public/protocol/commitments`

The response includes a `minimum-commitments-v0` protocol block with a deterministic `commitmentSetHash`, plus the shared commitment definitions clients can use to know which event and artifact anchors are required.

## Local Devnet Records

Until lifecycle actions are wired to live contracts, the API writes explicit local commitment records for every registry event covered by the minimum set. These records use `devnet-commitment-v0` payloads and can be inspected at:

`GET /registry/commitments`

Each commitment record stores the commitment kind, target contract module, source registry event, payload hash, and commitment hash. This gives the indexer and tests a concrete public audit surface before replacing the local record writer with contract event ingestion.
