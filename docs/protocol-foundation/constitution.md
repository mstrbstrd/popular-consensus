# PopCon constitution: proposed v0.2 baseline

## Purpose

Popular Consensus is open infrastructure through which people form communities,
deliberate, express perspectives, curate shared knowledge, preserve verifiable
records of collective expression over time, and collectively govern and share in
the value their contributions create.

People give the process legitimacy and authority. Software records the question,
participation conditions, observations, and disputes. It does not establish truth,
represent nonparticipants by default, or create legal or institutional authority.

The destination is a decentralized digital town square, not one indispensable
website. Social applications, community-curated registries, and a participant-
governed data union are in scope. Public infrastructure must not turn private
contributions into public property or make commercial consent a condition of
ordinary civic participation.

## Participant and community commitments

The following requirements govern the proposed baseline. They are design
obligations, not claims that the current demo enforces them. The catalog records
which have only structural coverage and which still have no implementation here.

| ID | Requirement and forbidden outcome |
| --- | --- |
| PUR-01 | Record expression at a disclosed time under disclosed conditions. Never manufacture community, institutional, or legal authority. |
| AUT-01 | Derive a caller's authority from verified evidence outside business intent. Never let a request nominate an actor merely by supplying an account ID. Private participation may use anonymous eligibility evidence rather than a public principal. |
| PRV-01 | Privacy is first-class across collection, computation, publication, logs, exports, recovery, and compensation. Never silently downgrade promised protection or expose a private answer to obtain payment. |
| PRV-02 | Keep reusable holder secrets, raw private identity evidence, and complete production tally keys out of public records and ordinary protocol requests/projections. A hash or encryption label alone proves no privacy property. |
| USE-01 | Optional commercial use requires the individual's applicable permission, collective authorization, and a valid privacy release policy. None substitutes for either of the others. Participation is not blanket permission. |
| USE-02 | Respect withdrawal from future optional uses and disclose retention and publication consequences before contribution. Never promise recall of already published copies outside our control. |
| ECO-01 | Compensate contribution and agreed civic work, not an answer, majority agreement, outrage, or the sponsor's preferred conclusion. Money, reputation, and authority are separate concepts. |
| ECO-02 | Secure the declared funding before requesting paid participation. Do not cancel already earned compensation because a sponsor dislikes findings or privacy rules prevent publication. Provide a declared dispute process. |
| ECO-03 | Reconcile every asset journal, prevent duplicate claims/settlements, and make issuance explicit. Appeals use append-only corrections, not rewritten accounting. |
| REC-01 | New opinions and corrections create successor records with explicit lineage. Never overwrite the conditions or meaning of an earlier observation. Immutable public evidence must minimize private material. |
| TIM-01 | Validate explicit canonical time and transition windows. Never let processing-server time, a late request, or an emergency silently rewrite a participant's deadline. Precise acceptance/finality rules still require a deployment decision. |
| MTH-01 | Preserve methodology, eligibility assumptions, sponsorship, turnout, limitations, disagreement, and minority concerns. Never label a convenience sample as representative without justification. |
| CIV-01 | Curation determines inclusion under declared rules, not truth. Buying stake must not silently buy answer weight or exclusive control of the civic agenda. Support alternative registries and accessible challenges. |
| GOV-01 | Bound roles, disclose conflicts, make moderation and compensation disputes appealable, and sunset emergency/founder powers. Never permit unilateral retroactive policy changes. |
| EXT-01 | Enable independent verification, export, recovery, and community continuation. Exit does not transfer every member's private data, consent, membership, or economic liability automatically. |
| PUB-01 | Separate software openness, protocol verifiability, and deployment continuity. Never claim a trust assumption retired without tests, independent evidence, recovery, and a public change in the readiness record. |

Private profiles and social relationships are not automatically public protocol
state. Publishing provenance must not establish an identity-to-ballot or
payout-to-answer join. A public name is not required for every valid action.

Free participation remains valid. A data union should enable income from funded
participation and civic work, but no income guarantee follows from issuing tokens.
A transferable token is neither required nor prohibited by this baseline; its
need, distribution, risks, and relationship to governance remain open decisions.

## Layering

The protocol owns shared validity rules, versioned evidence, and continuation.
Cooperative policy extensions define portable consent, use permissions, and
contributor entitlements. Applications provide feeds, discovery, interfaces,
reporting workflows, and payment-provider integrations. Operational stores hold
sessions, secrets, caches, and restricted material under separate access rules.

Applications may depend on protocol semantics. Protocol validity must not depend
on one application database, frontend, payment provider, founder, or domain.
Not all application data is a replayable public projection: private account data
and secrets require their own retention, recovery, and deletion design.

## Threat model to complete before public deployment

Include malicious or colluding participants, issuers, moderators, jurors,
sponsors, report customers, guardians, relays, sequencers, indexers, storage
providers, release maintainers, and compromised clients. State separately which
integrity/privacy properties survive compromise and which availability properties
fail. A second relay does not bypass a refusing shared sequencer; two machines
controlled by the same operator do not establish independent governance.

An initial paid pilot must be bounded, pre-funded, independently reviewed, and
clear about limitations. Its success includes a useful community response,
accessible participation, compensation paid as agreed, privacy protection, and
independent verification, not engagement volume or unanimity.

## Change control

Keep immutable versions of policies and submitted questions. Apply material
policy changes prospectively unless the original policy explicitly defines a
lawful correction process. Protocol changes need a public proposal, compatibility
classification, threat/privacy review, conformance vectors, an activation rule,
and exit/recovery consequences. Editing a schema is not community ratification.

This PR does not choose a legal steward or license, adopt a consensus mechanism,
launch a currency, move custody, or qualify PopCon for elections or other binding
uses. Those require explicit decisions and independent evidence.
