# Popular Consensus

## A Blueprint and White Paper for Trusted Public Answers

Version: 0.1 draft  
Date: April 27, 2026  
Working title: Popular Consensus

This document is a planning draft, not legal, tax, investment, or compliance advice. A real launch requires qualified counsel in every operating jurisdiction, independent security review, user research, and governance design review.

Plain-language summary: Popular Consensus is a way for communities to ask clear questions, gather private answers from real people, publish results anyone can check, and share value when those answers become useful reports.

## Abstract

Popular Consensus is a public-opinion and question-quality platform inspired by the clarity of prediction-market interfaces, but deliberately separated from gambling, event-contract trading, and winner-take-all speculation.

Instead of asking users to buy positions on future outcomes, the platform lets people ask civic questions, improve question quality, vote privately, discuss context in public, and publish answers that can be checked. The core unit is not a bet. The core unit is a question.

The platform combines four ideas:

1. A public question list with rules for keeping questions clear and useful.
2. Privacy-preserving civic polling where verified humans can answer without exposing their identity or full response history.
3. A social layer for discussion, evidence, amendments, sponsorship, local communities, and follow-based discovery.
4. A public data layer that exposes checkable combined results through dashboards and APIs.

The result is a civic signal exchange: a place where individuals, communities, researchers, municipalities, advocacy organizations, and companies can ask legitimate public questions and receive clear, method-labeled answers from the people who choose to participate.

## Thesis

Online discourse has a measurement problem. Social platforms measure attention, not consent. Pollsters measure samples, but their methods are often opaque to ordinary participants. Prediction markets produce crisp prices, but they attach civic questions to financial upside, loss, and regulatory risk.

Popular Consensus proposes a different starting point:

Public questions should become first-class civic objects.

Each question should have a transparent lifecycle, public wording history, clear answer format, quality flags, participation rules, identity assumptions, demographic limitations, discussion context, and tamper-evident combined results.

The platform should answer questions such as:

- What do verified residents of a city think about a proposed zoning change?
- Which climate adaptation projects should a neighborhood prioritize?
- How do members of a professional association rank proposed standards?
- What policy tradeoffs do users support after reading the same source material?
- Which questions deserve public attention this week?

The platform should not answer those questions by turning them into financial games.

## Design Commitments

Popular Consensus should be built around the following commitments:

- No event-contract rewards. Users do not earn money for choosing the eventual correct answer.
- No speculative-price-as-entertainment framing. Results are displayed as civic opinion signals, not as price-like probabilities.
- One verified person, one vote by default. Demo stake may help review questions, but should not dominate answers.
- Privacy by design. Individual responses should be private unless a user explicitly chooses to publish them.
- Method labels over false universality. Results must identify the population, sample, verification level, weighting method, and limitations.
- Open question history. Wording changes, flags, sponsorship, governance decisions, and final results should be checkable.
- Public-interest governance first. The initial operating entity should be mission-bound, with a credible path toward community governance only after the system is safe and understandable.
- Minimize speculative token economics. The token system should support access, deposits, governance, and anti-spam mechanics without promising profit.

## Non-Goals

Popular Consensus is not:

- A prediction market.
- A sportsbook.
- A derivatives venue.
- An immediate or unauthorized replacement for elections.
- A platform that certifies a single authoritative public will.
- A black-box social feed optimized for maximum engagement.
- A place where wealthy actors can buy public consensus by buying answer weight.

In the short term, the platform should inform decisions and earn legitimacy before claiming authority. It should not pretend to replace constitutional, municipal, organizational, or community decision-making processes before those communities have formally adopted it.

## Long-Term North Star

The long-term ambition is more radical: Popular Consensus should become decentralized public decision infrastructure.

In the best case, governments, municipalities, organizations, online communities, unions, cooperatives, standards bodies, and civic movements can voluntarily migrate more of their decision-making processes onto a shared public utility because it is more transparent, more participatory, more auditable, and more privacy-preserving than the systems it replaces.

The platform should centralize civic information without centralizing civic power. That means creating a common public layer where questions, proposals, deliberation records, voting methods, sponsorship disclosures, participation assumptions, result histories, and audit trails are easy to find across institutions and communities. At the same time, control over identity, communities, registries, governance rules, and participation should remain decentralized, federated, and forkable.

This transition should be phased:

- First, the platform measures opinion and improves public discourse.
- Then, communities use it for advisory polls, participatory budgeting, internal governance, and standards ratification.
- Next, institutions formally recognize certain Popular Consensus processes as binding under their own rules.
- Ultimately, the protocol becomes a civic operating layer that can replace legacy decision workflows where communities choose to adopt it.

The north star is not "one app controls democracy." The north star is a shared, privacy-preserving civic protocol that communities can use to govern themselves more directly.

## Why Blockchain

The platform does not need blockchain for every interaction. It uses blockchain where public auditability and shared ownership matter.

Useful blockchain roles:

- Timestamping question versions and final result commitments.
- Holding proposal and challenge bonds.
- Enforcing transparent registry membership.
- Recording governance decisions.
- Publishing cryptographic commitments to poll results.
- Supporting portable credentials and pseudonymous participation.
- Creating an accountable public API for civic data.

Less useful blockchain roles:

- Storing long-form discussion content.
- Publishing personally identifiable data.
- Ranking every feed item.
- Running heavy analytics.
- Moderating every comment.

The design should be hybrid: critical commitments and settlement logic on-chain; large content, private data, search, and analytics off-chain with public hashes and reproducible exports.

## Product Overview

Popular Consensus has five primary surfaces.

## Mechanic Translation

The platform can borrow the legibility of prediction-market products without borrowing their financial structure.

| Prediction-market primitive | Popular Consensus equivalent |
| --- | --- |
| Market | Public question page |
| Event outcome | Opinion signal or community decision result |
| Yes/no shares | Answer options |
| Buy/sell | Respond, rank, support, oppose, or abstain |
| Order book or automated market maker | No trading layer; visibility comes from registry status, topic follows, and sponsor disclosure |
| Price as probability | Response distribution with methodology labels |
| Liquidity | Participation depth, credential quality, and discussion quality |
| Oracle resolution | Poll close, aggregation, audit hash, and result challenge window |
| Trader profit/loss | No answer profit/loss; rewards are for civic work such as curation, juror service, translation, and participation |
| Market creation fee | Question bond |
| Disputed outcome | Registry, wording, eligibility, or aggregation challenge |
| Leaderboard | Reputation for useful public work, not for profitable speculation |

This translation is the heart of the design. Popular Consensus should feel as clear as a market page while behaving like a transparent civic polling and registry protocol.

### 1. Question Exchange

The Question Exchange is the main civic interface. Users browse live, pending, and archived questions across topics, locations, organizations, and communities.

Each question page includes:

- Plain-language question text.
- Answer type, such as yes/no, multiple choice, ranked choice, approval, Likert scale, budget allocation, or free-response summary.
- Eligibility rules.
- Poll duration.
- Sponsorship and funding disclosure.
- Methodology label.
- Challenge history.
- Wording history.
- Discussion threads.
- Source and context panels.
- Aggregate results.
- API endpoint.

The interface can borrow the information density of a market page, but it should avoid trading language. It should say "respond," "support," "oppose," "rank," "deliberate," "challenge wording," and "sponsor a sample," not financial-position language.

### 2. Question Registry

The Question Registry is a Token Curated Registry that determines which questions are eligible for wider visibility, reward pools, official API inclusion, and archived public status.

Registry inclusion means:

- The question is not spam.
- The wording is understandable.
- The answer options are reasonably complete.
- The question is categorized correctly.
- The sponsorship is disclosed.
- The question meets platform rules.
- The methodology label is honest.

Registry inclusion does not mean:

- The question is morally endorsed.
- The platform agrees with a premise.
- The results are representative of all people.
- The question is legally binding.

### 3. Civic Profiles

Users have pseudonymous profiles that can show:

- Communities joined.
- Topics followed.
- Registry work performed.
- Public comments.
- Voluntary credentials, such as resident, student, organization member, professional role, or age band.
- Reputation badges.
- Delegations received.
- Governance participation.

Private poll responses are not shown by default.

### 4. Deliberation Layer

Every question can host structured discussion:

- Pro arguments.
- Con arguments.
- Clarifying questions.
- Source submissions.
- Proposed amendments.
- Local context.
- Expert statements.
- Community notes.
- Moderator rulings.

Discussion is not merely a comment stream. It should make the best arguments easier to inspect, preserve minority concerns, and separate evidence from opinion.

### 5. Public Signal API

Popular Consensus should act like a civic data utility. The API exposes:

- Question metadata.
- Registry status.
- Aggregate results.
- Methodology labels.
- Turnout and response counts.
- Confidence intervals where statistically appropriate.
- Demographic breakdowns only when privacy thresholds are met.
- Full audit trail hashes.
- Exportable datasets for approved public-interest and commercial use cases.

## User Roles

### Respondents

Respondents answer questions. They may be anonymous to the public, pseudonymous to the platform, and verified for eligibility through privacy-preserving credentials.

### Proposers

Proposers draft questions and deposit a bond. They can be individuals, communities, organizations, researchers, municipalities, journalists, nonprofits, or companies.

### Curators

Curators review questions, challenge poor submissions, classify topics, improve wording, and maintain registry quality.

### Sponsors

Sponsors fund a question, outreach campaign, respondent reward pool, or representative panel. Sponsorship must be disclosed prominently.

### Moderators

Moderators enforce content rules in discussion spaces. Moderation should be appealable, logged, and separated from answer aggregation.

### Jurors

Jurors resolve registry challenges and disputes. Jurors are selected from qualified reputation pools and are rewarded for coherent, rule-based rulings.

### Delegates

Delegates receive temporary governance authority from users who want help voting on platform policy, treasury allocation, or registry standards.

### Researchers and Integrators

Researchers and integrators consume the API, run studies, publish analyses, and build third-party dashboards.

## Question Lifecycle

### 1. Draft

A proposer drafts a question with:

- Title.
- Exact wording.
- Answer format.
- Eligibility criteria.
- Target population.
- Geographic scope.
- Topic tags.
- Context summary.
- Source links.
- Sponsor disclosure.
- Proposed duration.
- Privacy level.
- Whether results should be open, embargoed, or client-specific.

The drafting UI should warn about leading wording, double-barreled questions, incomplete answer choices, unclear terms, legal sensitivity, and missing context.

### 2. Bonded Submission

The proposer posts a bond. The bond discourages spam and low-effort submissions. Bonds can be denominated in a stable collateral asset or platform credits rather than a speculative governance token.

Submission creates an on-chain record:

- Question content hash.
- Proposer address.
- Bond amount.
- Submission timestamp.
- Requested registry.
- Challenge window.

### 3. Challenge Window

Curators can challenge the question for reasons such as:

- Spam.
- Duplicate.
- Misleading wording.
- Missing answer option.
- Wrong category.
- Undisclosed sponsorship.
- Unsafe personal data request.
- Illegal instruction or content.
- Methodology mismatch.
- Harassment or targeted abuse.

The challenger posts a bond. If the challenge succeeds, the proposer bond is partially redistributed to the challenger, jurors, and registry treasury. If the challenge fails, the challenger bond is redistributed.

### 4. Amendment

Before launch, the proposer can accept amendments:

- Wording edits.
- Answer-option edits.
- Topic corrections.
- Methodology label changes.
- Eligibility changes.
- Context additions.

All accepted amendments create a new content hash and visible version history.

### 5. Registry Acceptance

If unchallenged or successfully defended, the question enters the registry and becomes eligible for:

- Public discovery.
- Official aggregate result publication.
- Reward pools.
- API inclusion.
- Archival status.
- Governance visibility.

### 6. Polling Period

Eligible respondents submit encrypted or private responses. The system records:

- Nullifier proving one eligible response per credential set.
- Ballot commitment.
- Question ID.
- Timestamp range.
- Optional delegation proof.

Individual responses should not be publicly linkable to wallet addresses.

### 7. Aggregation

After close, results are aggregated. Depending on poll type, the system publishes:

- Raw counts.
- Weighted counts, if declared in advance.
- Turnout.
- Eligible population assumptions.
- Methodology caveats.
- Privacy threshold checks.
- Hashes of result artifacts.

If free responses are allowed, the first version should publish raw user-approved excerpts and structured tags created through human curation, not automated summaries.

### 8. Challenge of Results

After results are published, users may challenge:

- Eligibility errors.
- Duplicate voting failures.
- Incorrect aggregation.
- Missing disclosure.
- Data integrity issues.
- Privacy leakage.

Result challenges should have a short deadline and clear remedies, such as correction, annotation, re-aggregation, or invalidation.

### 9. Archive

Archived questions remain public with:

- Final wording.
- Full version history.
- Result commitments.
- Methodology label.
- Known limitations.
- Challenge outcomes.
- Sponsorship record.
- API endpoint.

The archive is one of the platform's main public goods.

## Question Types

Popular Consensus should support multiple question formats, each with explicit use cases.

### Choose One Side

Example: "Do you support the proposed transit fare change?"

Useful for simple support/opposition. Use carefully for complex tradeoffs.

### Choose One Option

Example: "Which of these library hours should the city prioritize?"

Useful when options are mutually exclusive.

### Choose All That Fit

Example: "Which of these safety improvements would you support funding?"

Useful when multiple options can be acceptable.

### Rank Your Choices

Example: "Rank these budget priorities."

Useful for preference ordering and reducing false binary framing.

### Agreement Scale

Example: "How strongly do you agree that this rule is fair?"

Useful for sentiment intensity.

### Split 100 Points

Example: "Allocate 100 points across these public projects."

Useful for tradeoff visibility.

### Deliberative Poll

Respondents answer once before reading shared context, then again after deliberation. Results show opinion movement.

### Community Ratification

Used by communities, associations, and DAOs to ratify internal standards, proposals, or governance decisions.

### Registry Priority Poll

Users vote on which questions deserve visibility or funded sampling.

## Token and Incentive Model

The token model should be conservative. Its purpose is coordination, not speculation.

### Recommended MVP: Three-Layer Model

#### 1. Stable Bond Collateral

Question submissions, challenges, appeals, and sponsorships use stable collateral. This avoids tying question quality to a volatile token price.

Use cases:

- Proposal bonds.
- Challenge bonds.
- Appeal bonds.
- Sponsor budgets.
- Service fees.

#### 2. Non-Transferable Reputation

Reputation is earned by useful participation and cannot be sold.

Reputation sources:

- Verified participation.
- Accurate registry challenges.
- Helpful amendments accepted by proposers.
- Juror service aligned with final outcomes.
- Moderation work upheld on appeal.
- Research contributions.
- Governance participation.

Reputation uses:

- Juror eligibility.
- Governance weight caps.
- Moderator eligibility.
- Reduced bond requirements.
- Delegation credibility.
- Anti-spam throttling.

Reputation should decay or require continued activity so early users do not permanently dominate.

#### 3. Platform Credits

Credits can pay for premium platform services:

- Commissioning questions.
- Sponsoring outreach.
- Accessing advanced analytics.
- Registering organizational workspaces.
- Requesting high-assurance credential checks.

Credits should be sold and redeemed for functionality, not marketed as an investment.

### Later Option: Transferable Governance Token

A transferable governance token should be considered only after legal review, community testing, and clear evidence that non-transferable governance is insufficient.

If introduced, it should follow strict constraints:

- No promise of price appreciation.
- No revenue-sharing claim.
- No dividend or profit right.
- No marketing as an investment.
- Broad functional use at launch.
- Governance caps to prevent plutocracy.
- Lockups for insiders and service providers.
- Public disclosures.
- Jurisdiction-specific compliance review.

### Incentive Principles

Users should earn for work, not for being "right" about the future.

Rewardable work:

- Proposing valuable questions.
- Improving question wording.
- Identifying duplicates.
- Challenging misleading questions.
- Participating in verified polls.
- Serving as a juror.
- Maintaining source registries.
- Translating and localizing questions.
- Building public-interest analyses.

Not rewardable:

- Choosing an answer that later becomes correct.
- Manipulating turnout.
- Buying answer weight.
- Driving outrage engagement.
- Coordinated harassment.

## Token Curated Registries

Popular Consensus should not have one registry. It should have several specialized registries.

### Question Registry

The canonical list of accepted public questions.

### Topic Registry

A controlled taxonomy of issue areas, locations, institutions, communities, and tags.

### Methodology Registry

Approved polling methods, weighting standards, privacy thresholds, and result labels.

### Credential Issuer Registry

Organizations or protocols allowed to issue eligibility credentials, such as residency, membership, age band, professional affiliation, or student status.

### Source Registry

High-quality public sources linked to questions. Inclusion does not require ideological neutrality, but it does require accurate metadata and disclosure.

### Community Registry

Public communities that can host their own question spaces, rules, moderators, and credential requirements.

### Delegate Registry

Delegates who publicly disclose governance positions, conflicts, voting history, and areas of expertise.

## Governance

Governance should evolve in stages.

### Stage 0: Founding Stewardship

A founding nonprofit or public-benefit entity controls the first deployment, legal compliance, grants, hiring, and emergency response.

Key documents:

- Charter.
- Bylaws.
- Conflict policy.
- Moderation policy.
- Privacy policy.
- Registry rules.
- Treasury policy.
- Security disclosure policy.
- Data access policy.

### Stage 1: Community Councils

Create elected or sortition-based councils for:

- Registry standards.
- Privacy and safety.
- Research ethics.
- Local communities.
- Technical upgrades.
- Treasury grants.

Councils should have narrow authority and public minutes.

### Stage 2: On-Chain Governance

Token or reputation-weighted governance can control:

- Registry parameters.
- Fee schedules.
- Treasury grants.
- Delegate rules.
- Protocol upgrades after timelock.
- Dispute framework changes.

Sensitive powers should require:

- Quorum.
- Supermajority.
- Timelock.
- Emergency veto by a safety council during the early period.
- Sunset dates for founder privileges.

### Stage 3: Federated Public Utility

Long-term, Popular Consensus should become a federated civic data network:

- Local communities can run their own registries.
- Municipal and institutional deployments can use shared standards.
- Independent frontends can read the same public question graph.
- The core protocol remains neutral infrastructure.

## Identity and Privacy

The platform needs Sybil resistance without turning civic speech into permanent public dossiers.

### Principles

- Separate identity verification from public identity.
- Minimize personal data collection.
- Use credentials only for eligibility.
- Publish aggregate results, not response histories.
- Allow pseudonymous social participation.
- Provide account recovery without centralizing full identity dossiers.
- Make privacy limitations understandable to ordinary users.

### Credential Flow

1. A user proves eligibility to a credential issuer.
2. The issuer grants a signed credential.
3. The user stores the credential locally or in a privacy-preserving wallet.
4. For a poll, the user generates a proof that they hold a valid credential.
5. The proof emits a nullifier unique to the poll so the user cannot vote twice.
6. The ballot is counted without revealing the user's underlying identity.

Examples of credentials:

- Unique human.
- Resident of a city.
- Member of an organization.
- Age band.
- Student status.
- Professional license category.
- Attendance at a deliberation event.

### Privacy Tiers

#### Public Poll

Anyone can respond. Useful for open sentiment, not representative claims.

#### Verified Human Poll

Only unique verified humans can respond.

#### Credentialed Poll

Only eligible credential holders can respond.

#### Panel Poll

A recruited sample responds under a disclosed sampling method.

#### Private Client Poll

A sponsor receives results under strict disclosure and consent rules. Aggregate metadata should still be logged for accountability when feasible.

### Data Minimization

On-chain:

- Question ID.
- Content hashes.
- Bond movements.
- Registry decisions.
- Credential schema IDs.
- Ballot commitments.
- Aggregated result hashes.

Off-chain encrypted:

- Raw ballot material.
- Sensitive eligibility evidence.
- Private messages.
- Moderation evidence.

Public API:

- Aggregates.
- Methodology.
- Turnout.
- Challenge outcomes.
- Sponsor disclosure.
- Privacy-safe breakdowns.

## Moderation and Safety

Popular Consensus should distinguish between question curation, discussion moderation, and result integrity.

### Question Curation

Question curation asks whether a question belongs in the registry.

Standards:

- Clear wording.
- Disclosed sponsor.
- No direct harassment.
- No unlawful instructions.
- No deceptive framing.
- No collection of unnecessary sensitive data.
- No impersonation.
- Methodology label matches the actual poll.

### Discussion Moderation

Discussion moderation governs behavior in comments and deliberation spaces.

Rules should cover:

- Threats.
- Doxxing.
- Targeted harassment.
- Spam.
- Impersonation.
- Illegal content.
- Coordinated manipulation.
- Graphic or exploitative material.
- Repeated bad-faith disruption.

### Result Integrity

Result integrity focuses on:

- Duplicate response prevention.
- Credential issuer reliability.
- Bribery and coercion reporting.
- Bot resistance.
- Coordinated astroturf campaigns.
- Sponsor manipulation.
- Aggregation errors.

## Technical Blueprint

### Architecture

Popular Consensus should be implemented as a modular protocol with a web/mobile client, smart contracts, indexers, credential services, storage services, and analytics workers.

### Smart Contract Modules

| Module | Purpose |
| --- | --- |
| QuestionRegistry | Tracks accepted questions, versions, statuses, and archive hashes. |
| BondManager | Escrows proposer, challenger, juror, and appeal bonds. |
| ChallengeCourt | Handles challenge creation, juror selection, votes, rulings, and appeals. |
| PollFactory | Deploys or registers poll instances with configured answer formats. |
| BallotBox | Accepts ballot commitments and nullifiers. |
| ResultCommitter | Publishes aggregate result commitments and correction history. |
| CredentialSchemaRegistry | Lists accepted credential schemas and issuer requirements. |
| ReputationLedger | Records non-transferable reputation events. |
| Governance | Manages parameter changes, treasury votes, and upgrade approvals. |
| Treasury | Holds grants, sponsorship balances, and operating reserves. |

### Off-Chain Services

| Service | Purpose |
| --- | --- |
| Content Storage | Stores question text, source links, discussion content, and archive artifacts. |
| Indexer | Builds searchable question, user, registry, and result views from chain events. |
| Credential Service | Integrates with credential issuers and proof systems. |
| Notification Service | Alerts users about challenges, poll openings, result publication, and appeals. |
| Moderation Console | Allows transparent enforcement workflows and appeal tracking. |
| Analytics Pipeline | Produces aggregate results, privacy checks, and methodology exports. |
| API Gateway | Provides public and permissioned data access. |

### Data Model

#### Question

- `question_id`
- `current_version_hash`
- `title`
- `body`
- `answer_format`
- `answer_options`
- `topic_ids`
- `geo_scope`
- `eligibility_schema`
- `methodology_label`
- `sponsor_disclosure`
- `created_by`
- `bond_id`
- `status`
- `challenge_window`
- `poll_open`
- `poll_close`
- `result_hash`
- `archive_hash`

#### Challenge

- `challenge_id`
- `question_id`
- `reason_code`
- `challenger`
- `bond_id`
- `evidence_hash`
- `juror_pool`
- `ruling`
- `appeal_status`
- `resolution_hash`

#### Ballot Commitment

- `poll_id`
- `nullifier`
- `credential_schema_id`
- `encrypted_ballot_hash`
- `timestamp_bucket`
- `proof_hash`

#### Result Artifact

- `poll_id`
- `question_version_hash`
- `aggregation_method`
- `raw_count_summary`
- `weighted_count_summary`
- `turnout`
- `privacy_thresholds`
- `limitations`
- `data_export_hash`
- `published_at`

### Chain Selection

The first version should deploy on a low-cost, widely supported EVM-compatible chain or appchain. Selection criteria:

- Low transaction cost.
- Stable developer tooling.
- Account abstraction support.
- Mature multisig and governance tooling.
- Reliable indexer ecosystem.
- Support for privacy-preserving proof verification.
- Strong bridge and custody options.
- Credible decentralization roadmap.

The MVP can batch many events through rollup-style commitments rather than writing every interaction on-chain.

### Storage

Recommended pattern:

- Store canonical public artifacts on IPFS, Arweave, or equivalent content-addressed storage.
- Store private ballots encrypted in controlled storage with deletion and retention policies.
- Store hashes on-chain for auditability.
- Maintain reproducible public exports for archived questions.

### Security Model

Core threats:

- Sybil attacks.
- Vote buying or coercion.
- Credential issuer compromise.
- Proposer spam.
- Question wording manipulation.
- Curator cartels.
- Juror bribery.
- Moderator abuse.
- Result tampering.
- Privacy leakage through small demographic slices.
- Sponsor influence concealment.
- Smart contract exploits.

Mitigations:

- Proof-of-personhood or credential-based nullifiers.
- Minimum privacy thresholds for breakdowns.
- Randomized juror selection from qualified pools.
- Staked challenges and appeals.
- Transparent sponsor records.
- Public version history.
- Timelocked governance changes.
- Emergency pause with public postmortems.
- Independent audits.
- Bug bounty.
- Rate limits.
- Reputation decay.
- Conflict disclosures for delegates and jurors.

### UX Requirements

The product succeeds only if ordinary users understand what they are seeing.

Every result page should show:

- Who was eligible.
- Who actually responded.
- How many responded.
- Whether respondents were verified.
- Whether responses were weighted.
- Who sponsored the question.
- Whether the question was challenged.
- Whether the result is representative, self-selected, or community-only.
- What changed from prior versions.

Result labels should be plain:

- "Open internet response."
- "Verified human response."
- "Verified city resident response."
- "Organization member response."
- "Representative panel."
- "Sponsored research."
- "Small sample: interpret carefully."

## Legal and Regulatory Posture

This section is a design risk map, not legal advice. It should be reviewed by counsel before implementation.

### Avoiding Prediction-Market Classification

U.S. regulators describe event contracts as financial products tied to event outcomes, often with fixed settlement rewards and expiration. The CFTC also notes that regulated prediction markets can be used for hedging or speculation and involve financial risk. Popular Consensus should be designed to avoid those characteristics.

Design constraints:

- No fixed financial reward for answering correctly.
- No trading of yes/no positions.
- No order book for opinions.
- No mark-to-market answer positions.
- No ability to exit a position for profit.
- No "risk capital" framing.
- No event-resolution oracle that pays winners.
- No sports, election, assassination, disaster, or celebrity-death markets.
- No UI that displays answer prices as probabilities.

Question curation bonds are not answer positions. They are anti-spam and quality-control deposits tied to rule compliance.

Sources: CFTC, "Understanding Prediction Markets and Event Contracts"; CFTC release 9183-26 on prediction-market jurisdiction.

### Securities and Digital Asset Risk

The SEC and CFTC issued a 2026 interpretation addressing how federal securities laws apply to crypto assets and transactions. The central design lesson is to avoid selling tokens with investment expectations, profit rights, managerial-effort dependence, or speculative marketing.

Design constraints:

- Launch without a transferable governance token if possible.
- Use non-transferable reputation for governance and service eligibility.
- Use stable collateral for bonds.
- Sell credits only for consumptive use.
- Avoid revenue share, dividends, buybacks, burn-for-price mechanics, or "number go up" language.
- Avoid promising secondary-market liquidity.
- Avoid insider allocations that create public expectation of founder-driven appreciation.
- Ensure any token has present utility before distribution.

Source: SEC Release Nos. 33-11412 and 34-105020, "Application of the Federal Securities Laws to Certain Types of Crypto Assets and Certain Transactions Involving Crypto Assets."

### Money Transmission and AML Risk

If the platform transmits, exchanges, administers, or redeems convertible virtual currency, money services business rules may apply. FinCEN has long treated some virtual currency businesses as MSBs depending on activity.

Design constraints:

- Avoid custody where possible.
- Use non-custodial wallets.
- Use third-party regulated payment processors for fiat onramps.
- Keep platform credits limited to platform functionality.
- Do not operate an exchange.
- Review sanctions screening, suspicious activity, recordkeeping, and state money-transmission laws before handling funds.

Source: FinCEN, "Application of FinCEN's Regulations to Persons Administering, Exchanging, or Using Virtual Currencies."

### Privacy Law

The platform will process political opinions, location credentials, and potentially sensitive affiliations. Privacy must be treated as a core product requirement.

Design constraints:

- Collect only what is needed.
- Keep identity proofs separate from public profiles.
- Provide access, deletion, correction, and opt-out workflows where required.
- Treat demographic breakdowns as privacy-sensitive.
- Avoid public release of small cell sizes.
- Maintain data retention schedules.
- Use explicit consent for sponsored research and commercial data products.
- Publish a clear privacy notice.

Relevant regimes may include GDPR for people in the EU, CCPA/CPRA for California residents, and additional state, national, biometric, children's privacy, research ethics, and electoral laws.

Sources: European Commission GDPR data protection explanations; California Attorney General CCPA page.

### Nonprofit and Public Utility Structure

The operating entity could begin as a U.S. nonprofit, public-benefit corporation, cooperative, foundation, or hybrid structure.

A 501(c)(3) may fit educational, scientific, or charitable research purposes, but lobbying and political activity limits may constrain some use cases. A 501(c)(4) may fit civic betterment and social welfare, with different tax and political constraints. A public-benefit company may offer operational flexibility but weaker nonprofit signaling.

Recommended path:

1. Form a mission-bound nonprofit or public-benefit entity for the protocol steward.
2. Keep political campaign activity out of the core entity unless counsel designs for it.
3. Create a separate commercial services entity only if needed for enterprise analytics or software services.
4. Publish conflict-of-interest policies.
5. Move protocol governance gradually, not theatrically.

Sources: IRS 501(c)(3) exempt purposes; IRS 501(c)(4) social welfare guidance.

### Polling, Elections, and Political Law

Popular Consensus can become politically sensitive even if it does not run official elections.

Issues to review:

- Electioneering and campaign finance disclosures.
- Ballot measure advocacy.
- Foreign participation in domestic political questions.
- Municipal procurement rules.
- Lobbying registration.
- Public records laws for government clients.
- Research ethics for academic partnerships.
- Age restrictions and parental consent for minors.

The platform should not advertise poll results as official election results or legally binding votes unless a government or organization has formally adopted the process under applicable law.

### Content Liability

The social layer creates ordinary platform risks:

- Defamation.
- Harassment.
- Copyright.
- Illegal content.
- Doxxing.
- Misinformation.
- Impersonation.
- Targeted abuse.

The platform needs clear terms, DMCA workflows where applicable, moderation logs, appeals, and emergency handling.

## Business and Funding Model

Popular Consensus should operate as public-interest infrastructure with revenue streams aligned to trust.

### Revenue Sources

- Grants for civic technology, democracy, research, and public-interest data.
- Philanthropic donations.
- Municipal and institutional deployments.
- Sponsored public-interest questions with disclosure.
- Organizational workspaces.
- Premium analytics for approved customers.
- API subscriptions for high-volume users.
- Research partnerships.
- Protocol service fees.

### Prohibited or Restricted Revenue

- Selling identifiable response data.
- Undisclosed sponsored questions.
- Pay-for-boost manipulation.
- Gambling-style revenue share.
- Political dark-money influence.
- Data brokerage without consent.

### Data Union Option

A user-consented data union can exist later, but it must be opt-in, transparent, revocable where legally required, and limited to privacy-safe aggregate products. Users should never need to sell personal data to participate in civic life.

## Impact Metrics

The platform should measure whether it improves discourse and public understanding.

### Participation

- Verified active users.
- Returning respondents.
- First-time civic participants.
- Geographic coverage.
- Community coverage.
- Accessibility participation.

### Question Quality

- Challenge rate.
- Successful challenge rate.
- Amendment acceptance rate.
- Duplicate reduction.
- Sponsor disclosure compliance.
- User comprehension scores.

### Representativeness

- Self-selected vs verified vs panel result proportions.
- Demographic coverage where voluntarily and lawfully measured.
- Nonresponse patterns.
- Weighting transparency.

### Trust

- User trust surveys.
- Result correction frequency.
- Credential issuer incidents.
- Privacy complaints.
- Successful appeals.
- Public API reproducibility.

### Deliberation

- Argument diversity.
- Source quality.
- Civility reports.
- Opinion movement after deliberation.
- Minority viewpoint preservation.

### Financial Sustainability

- Runway.
- Revenue by source.
- Grant dependence.
- Operating cost per question.
- Cost per verified response.
- Treasury transparency.

## Roadmap

### Phase 0: Research and Legal Design, 0-3 Months

- Finalize mission and non-goals.
- Retain legal counsel.
- Interview civic groups, researchers, municipalities, pollsters, and online communities.
- Draft registry rules.
- Define data protection architecture.
- Select initial chain and credential approach.
- Produce prototype wireframes.

### Phase 1: Off-Chain Prototype, 3-6 Months

- Build question drafting UI.
- Build registry workflow without real funds.
- Build basic verified participation.
- Build discussion pages.
- Run closed pilots with partner communities.
- Test wording challenges and juror workflows.
- Publish first methodology guide.

### Phase 2: On-Chain Testnet, 6-12 Months

- Deploy QuestionRegistry, BondManager, ChallengeCourt, PollFactory, BallotBox, and ResultCommitter to testnet.
- Use play-money bonds.
- Integrate content-addressed storage.
- Publish API v0.
- Run security review.
- Run privacy threat model.
- Run community governance simulation.

### Phase 3: Public Beta, 12-18 Months

- Launch with limited jurisdictions and question types.
- Use stable collateral or credits, not a speculative token.
- Start with public-interest questions and partner communities.
- Publish transparency reports.
- Add credential issuer registry.
- Add formal appeals.
- Open bug bounty.

### Phase 4: Institutional Pilots, 18-30 Months

- Municipal pilots.
- University research pilots.
- Nonprofit coalition pilots.
- Participatory budgeting pilots.
- Standards-body pilots.
- Public API partnerships.

### Phase 5: Federated Governance, 30+ Months

- Launch community councils.
- Decentralize registry parameters.
- Expand credential issuer diversity.
- Support independent frontends.
- Formalize long-term treasury governance.
- Consider whether a transferable token is necessary; default answer should remain no unless evidence changes.

### Phase 6: Recognized Decision Infrastructure, 48+ Months

- Let communities designate specific question types as binding under their own rules.
- Support municipal, cooperative, union, DAO, nonprofit, and association governance workflows.
- Publish adoption playbooks for institutions that want to replace legacy surveys, town halls, member votes, consultations, and participatory budgeting processes.
- Build formal handoff patterns between Popular Consensus results and existing legal decision bodies.
- Maintain public archives that allow constituents to inspect the full history of decisions across institutions.
- Preserve the right of communities to fork registries, frontends, and governance rules if the shared utility fails them.

## MVP Scope

The smallest serious MVP should include:

- Pseudonymous accounts.
- Question drafting.
- Question registry.
- Stable or play-credit bonds.
- Challenge workflow.
- Human juror workflow.
- Three poll types: binary, multiple choice, ranked choice.
- Public discussion threads.
- Sponsor disclosure.
- Basic proof-of-personhood or invite-based uniqueness.
- Private response storage.
- Public aggregate results.
- Methodology labels.
- Archive.
- API endpoint per question.

Do not include at MVP:

- Transferable governance token.
- Complex financial markets.
- Unlimited political ads.
- Fully automated moderation.
- Sensitive demographic targeting.
- Binding public elections.
- Open-ended global launch.

## Example Question Pages

### Civic Policy

Title: Should the City of Vancouver pilot car-free Sundays on Commercial Drive?

Eligibility: Verified residents of Vancouver.  
Format: Approval plus comment.  
Sponsor: Local transportation nonprofit.  
Methodology: Verified resident response, self-selected sample.  
Result label: Not representative of all residents.

### Participatory Budgeting

Title: Allocate 100 points across proposed neighborhood safety projects.

Eligibility: Verified residents of the neighborhood.  
Format: Budget allocation.  
Sponsor: City innovation office.  
Methodology: Credentialed resident poll.  
Result label: Advisory input for council review.

### Platform Governance

Title: Should misleading question wording be challengeable after launch but before close?

Eligibility: Users with governance reputation above threshold.  
Format: Ranked choice among policy options.  
Sponsor: Protocol steward.  
Methodology: Reputation-governance vote.  
Result label: Binding if quorum and supermajority are reached.

### Public Research

Title: Which tradeoffs would users accept to reduce housing costs?

Eligibility: Verified humans.  
Format: Deliberative poll with before-and-after answers.  
Sponsor: University research lab.  
Methodology: Verified human response, self-selected sample with disclosed limitations.  
Result label: Research dataset subject to consent.

## Open Design Questions

- Which proof-of-personhood system provides enough Sybil resistance without unacceptable exclusion?
- Should residents prove location through government ID, utility bills, mobile attestations, community validation, or multiple optional paths?
- How should the platform prevent vote buying when responses are private?
- What is the minimum privacy threshold for demographic breakdowns?
- Should reputation decay by time, inactivity, or poor challenge outcomes?
- How are jurors selected for politically charged questions?
- What questions are categorically prohibited?
- Should sponsors be allowed to target invitations to specific demographic groups?
- What methods should qualify a poll as "representative"?
- How should local laws shape geographically scoped deployments?
- When can a community fork its registry?
- Can public-interest API access remain free while the platform becomes sustainable?
- What conditions must be met before a community can safely treat a Popular Consensus process as binding?

## North Star Summary

Popular Consensus should become a public question layer for the internet and, over time, a decentralized public utility for direct democratic decision-making.

Its promise is not that every result is perfect. Its promise is that every result is inspectable: who asked, who answered, who was eligible, how the question changed, who paid, what rules applied, what challenges happened, whether the result is advisory or binding, and what the result can and cannot claim.

The platform succeeds if it makes public opinion harder to fake, civic questions easier to ask well, disagreement easier to understand, and legitimate collective decisions easier to make without turning democracy into a casino.

## Source Notes

The following sources informed the regulatory and compliance posture in this draft:

- CFTC, "Understanding Prediction Markets and Event Contracts": https://www.cftc.gov/LearnandProtect/PredictionMarkets
- CFTC Release 9183-26, "CFTC Reaffirms Exclusive Jurisdiction over Prediction Markets in U.S. Circuit Court Filing": https://www.cftc.gov/PressRoom/PressReleases/9183-26
- SEC Release Nos. 33-11412 and 34-105020, "Application of the Federal Securities Laws to Certain Types of Crypto Assets and Certain Transactions Involving Crypto Assets": https://www.sec.gov/rule-release/33-11412
- FinCEN, "FinCEN Issues Guidance on Virtual Currencies and Regulatory Responsibilities": https://www.fincen.gov/news/news-releases/fincen-issues-guidance-virtual-currencies-and-regulatory-responsibilities
- California Attorney General, "California Consumer Privacy Act": https://www.oag.ca.gov/privacy/ccpa
- European Commission, "Data protection explained": https://commission.europa.eu/law/law-topic/data-protection/data-protection-explained_en
- IRS, "Exempt purposes - Internal Revenue Code Section 501(c)(3)": https://www.irs.gov/charities-non-profits/charitable-organizations/exempt-purposes-internal-revenue-code-section-501c3
- IRS, "Social welfare organizations": https://www.irs.gov/charities-non-profits/other-non-profits/social-welfare-organizations
