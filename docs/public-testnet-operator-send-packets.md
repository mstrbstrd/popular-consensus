# Public Testnet Operator Send Packets

These packets are the send-ready layer on top of the outreach queue. They are for recruiting real independent operators for the final public-testnet gate.

This file is not completion evidence. It does not assign operators, prove independence, create attestations, or close the roadmap item. The gate stays open until accepted operators publish valid attestation JSON files, maintainers complete independence review, `docs/public-testnet-launch-summary.md` records `Decision: GO`, and `pnpm mvp:audit` reports `Ready`.

Before sending any packet:

1. Create or identify a public tracking issue from `docs/public-testnet-operator-issue-bodies/<slot>.md`.
2. Record the issue URL on `docs/public-testnet-operator-roster.md` with the per-slot commands in `docs/public-testnet-operator-issue-bodies/README.md`.
3. Replace `<public repo URL>` with the repository URL that operators can access.
4. Replace `<tracking issue URL>` with the public tracking issue for the slot.
5. Record the send with `pnpm testnet:record-outreach`.
6. Run `pnpm testnet:audit-outreach`.
7. Move a slot to `docs/public-testnet-operator-roster.md` only after a real operator accepts and provides the assignment-intake fields.

## First-Wave Send Recording

Do not run these commands until the matching message has actually been sent. They read the public tracking issue from the roster, so record the issue URL on `docs/public-testnet-operator-roster.md` first. The helper records today's UTC date by default; add `--last-contact <YYYY-MM-DD>` only when backfilling an earlier send.

```sh
pnpm testnet:record-outreach -- --candidate "Dappnode community or partner route" --pool "Home-node and decentralization communities" --contact "https://dappnode.com/en-us/pages/contact" --slot deployer-1 --status contacted --tracking-issue-from-roster --notes "Sent deployer packet."
pnpm testnet:record-outreach -- --candidate "EthStaker community" --pool "Ethereum solo-staker communities" --contact "https://ethstaker.org/" --slot replay-1 --status contacted --tracking-issue-from-roster --notes "Sent replay-1 packet."
pnpm testnet:record-outreach -- --candidate "Dappnode community or app-store builder route" --pool "Home-node and decentralization communities" --contact "https://dappnode.com/" --slot indexer-1 --status contacted --tracking-issue-from-roster --notes "Sent indexer-1 packet."
pnpm testnet:record-outreach -- --candidate "Open Source Collective hosted-project community" --pool "Open-source fiscal-hosted projects" --contact "https://oscollective.org/" --slot indexer-2 --status contacted --tracking-issue-from-roster --notes "Sent indexer-2 packet."
pnpm testnet:record-outreach -- --candidate "Open Collective open-source project directory" --pool "Open-source/public-goods collectives" --contact "https://opencollective.com/search?hostname=opencollective.com" --slot replay-2 --status contacted --tracking-issue-from-roster --notes "Sent replay-2 packet."
pnpm testnet:record-outreach -- --candidate "EthStaker allied-community route" --pool "Ethereum solo-staker communities" --contact "https://ethstaker.org/" --slot replay-3 --status contacted --tracking-issue-from-roster --notes "Sent replay-3 packet."
pnpm testnet:record-outreach -- --candidate "Open Fresno civic-tech volunteer community" --pool "Local civic-tech volunteer groups" --contact "https://openfresno.org/" --slot steward-1 --status contacted --tracking-issue-from-roster --notes "Sent steward-1 packet."
pnpm testnet:record-outreach -- --candidate "SF Civic Tech volunteer community" --pool "Local civic-tech volunteer groups" --contact "https://www.sfcivictech.org/" --slot steward-2 --status contacted --tracking-issue-from-roster --notes "Sent steward-2 packet."
pnpm testnet:audit-outreach
```

## deployer-1

Target route: Dappnode community or partner route, https://dappnode.com/en-us/pages/contact

Subject: Independent public-testnet deployer request for Popular Consensus

```text
Hello,

We are preparing the Popular Consensus MVP public testnet and are looking for one independent deployer who can help verify that the protocol can be deployed and replayed outside the maintainer environment.

Would someone from your community be willing to run the deployer role for roster slot deployer-1?

Runbook: <public repo URL>/docs/public-testnet-operator-runbook.md
Tracking issue: <tracking issue URL>
Issue body: <public repo URL>/docs/public-testnet-operator-issue-bodies/deployer-1.md

The output we need is a public-testnet operator attestation JSON file with an operator id, contact or public key, organization or independent-individual marker, independence statement, tested commit, chain/RPC details, and deployment hash.

The final MVP gate does not require a perfect launch. If the operator finds issues, they should record observations in the attestation and we will include them in the launch summary.
```

Acceptance fields to collect:

```text
slot: deployer-1
tracking issue:
operator id:
contact or public key:
organization or independent individual:
independence statement:
status: invited
notes:
```

## replay-1

Target route: EthStaker community, https://ethstaker.org/

Subject: Independent replay-verifier request for Popular Consensus MVP

```text
Hello,

We are preparing the Popular Consensus MVP public testnet and need an independent replay verifier who can confirm that public protocol records can be rebuilt outside the maintainer environment.

Would a solo-staker or infrastructure operator from your community be willing to run roster slot replay-1?

Runbook: <public repo URL>/docs/public-testnet-operator-runbook.md
Tracking issue: <tracking issue URL>
Issue body: <public repo URL>/docs/public-testnet-operator-issue-bodies/replay-1.md

The key output is a public-testnet operator attestation JSON file. Replay verifiers independently report transaction and event stream hashes for the same testnet window so maintainers can confirm the hashes match across operators.

The final MVP gate does not require a perfect launch. If the operator finds issues, they should record observations in the attestation and we will include them in the launch summary.
```

Acceptance fields to collect:

```text
slot: replay-1
tracking issue:
operator id:
contact or public key:
organization or independent individual:
independence statement:
status: invited
notes:
```

## indexer-1

Target route: Dappnode community or app-store builder route, https://dappnode.com/

Subject: Independent API/indexer operator request for Popular Consensus

```text
Hello,

We are preparing the Popular Consensus MVP public testnet and need independently operated API/indexer endpoints for the testnet window.

Would someone from your community be willing to run roster slot indexer-1?

Runbook: <public repo URL>/docs/public-testnet-operator-runbook.md
Tracking issue: <tracking issue URL>
Issue body: <public repo URL>/docs/public-testnet-operator-issue-bodies/indexer-1.md

The output we need is a public API base URL plus a public-testnet operator attestation JSON file with an operator id, contact or public key, organization or independent-individual marker, independence statement, tested commit, chain/RPC details, and replay hashes.

The final MVP gate does not require a perfect launch. If the operator finds issues, they should record observations in the attestation and we will include them in the launch summary.
```

Acceptance fields to collect:

```text
slot: indexer-1
tracking issue:
operator id:
contact or public key:
organization or independent individual:
independence statement:
status: invited
notes:
```

## indexer-2

Target route: Open Source Collective hosted-project community, https://oscollective.org/

Subject: Independent API/indexer check for Popular Consensus MVP

```text
Hello,

We are preparing the Popular Consensus MVP public testnet and need a second independently operated API/indexer endpoint from a different operator community.

Would an open-source maintainer in your network be willing to run roster slot indexer-2?

Runbook: <public repo URL>/docs/public-testnet-operator-runbook.md
Tracking issue: <tracking issue URL>
Issue body: <public repo URL>/docs/public-testnet-operator-issue-bodies/indexer-2.md

The output we need is a public API base URL plus a public-testnet operator attestation JSON file with an operator id, contact or public key, organization or independent-individual marker, independence statement, tested commit, chain/RPC details, and replay hashes.

The final MVP gate does not require a perfect launch. If the operator finds issues, they should record observations in the attestation and we will include them in the launch summary.
```

Acceptance fields to collect:

```text
slot: indexer-2
tracking issue:
operator id:
contact or public key:
organization or independent individual:
independence statement:
status: invited
notes:
```

## replay-2

Target route: Open Collective open-source project directory, https://opencollective.com/search?hostname=opencollective.com

Subject: Independent replay check for Popular Consensus public testnet

```text
Hello,

We are preparing the Popular Consensus MVP public testnet and need independent open-source maintainers to verify that public protocol records can be replayed outside the maintainer environment.

Would a maintainer from your network be willing to run roster slot replay-2?

Runbook: <public repo URL>/docs/public-testnet-operator-runbook.md
Tracking issue: <tracking issue URL>
Issue body: <public repo URL>/docs/public-testnet-operator-issue-bodies/replay-2.md

The key output is a public-testnet operator attestation JSON file. Replay verifiers independently report transaction and event stream hashes for the same testnet window so maintainers can confirm the hashes match across operators.

The final MVP gate does not require a perfect launch. If the operator finds issues, they should record observations in the attestation and we will include them in the launch summary.
```

Acceptance fields to collect:

```text
slot: replay-2
tracking issue:
operator id:
contact or public key:
organization or independent individual:
independence statement:
status: invited
notes:
```

## replay-3

Target route: EthStaker allied-community route, https://ethstaker.org/

Subject: Third independent replay-verifier request for Popular Consensus

```text
Hello,

We are preparing the Popular Consensus MVP public testnet and need a third independent replay verifier so the final evidence is not controlled by the maintainers or a single operator group.

Would a solo-staker or infrastructure operator from your community be willing to run roster slot replay-3?

Runbook: <public repo URL>/docs/public-testnet-operator-runbook.md
Tracking issue: <tracking issue URL>
Issue body: <public repo URL>/docs/public-testnet-operator-issue-bodies/replay-3.md

The key output is a public-testnet operator attestation JSON file. Replay verifiers independently report transaction and event stream hashes for the same testnet window so maintainers can confirm the hashes match across operators.

The final MVP gate does not require a perfect launch. If the operator finds issues, they should record observations in the attestation and we will include them in the launch summary.
```

Acceptance fields to collect:

```text
slot: replay-3
tracking issue:
operator id:
contact or public key:
organization or independent individual:
independence statement:
status: invited
notes:
```

## steward-1

Target route: Open Fresno civic-tech volunteer community, https://openfresno.org/

Subject: Community-steward request for Popular Consensus public testnet

```text
Hello,

We are preparing the Popular Consensus MVP public testnet for a community-governed opinion polling protocol. We need independent community stewards to run governance and safety drills so the final MVP evidence is not maintained only by the project team.

Would someone from your civic-tech community be willing to run roster slot steward-1?

Runbook: <public repo URL>/docs/public-testnet-operator-runbook.md
Tracking issue: <tracking issue URL>
Issue body: <public repo URL>/docs/public-testnet-operator-issue-bodies/steward-1.md

The steward role focuses on governance-process review, emergency/safety drill checks, fork/export review, and a public attestation explaining what was tested. We will also ask for a contact or public key and a short independence statement.

The final MVP gate does not require a perfect launch. If the steward finds issues, they should record observations in the attestation and we will include them in the launch summary.
```

Acceptance fields to collect:

```text
slot: steward-1
tracking issue:
operator id:
contact or public key:
organization or independent individual:
independence statement:
status: invited
notes:
```

## steward-2

Target route: SF Civic Tech volunteer community, https://www.sfcivictech.org/

Subject: Independent community-steward request for Popular Consensus

```text
Hello,

We are preparing the Popular Consensus MVP public testnet for a community-governed opinion polling protocol. We need a second independent community steward so governance and safety drills are reviewed by more than one civic/community operator.

Would someone from your civic-tech community be willing to run roster slot steward-2?

Runbook: <public repo URL>/docs/public-testnet-operator-runbook.md
Tracking issue: <tracking issue URL>
Issue body: <public repo URL>/docs/public-testnet-operator-issue-bodies/steward-2.md

The steward role focuses on governance-process review, emergency/safety drill checks, fork/export review, and a public attestation explaining what was tested. We will also ask for a contact or public key and a short independence statement.

The final MVP gate does not require a perfect launch. If the steward finds issues, they should record observations in the attestation and we will include them in the launch summary.
```

Acceptance fields to collect:

```text
slot: steward-2
tracking issue:
operator id:
contact or public key:
organization or independent individual:
independence statement:
status: invited
notes:
```

## After Acceptance

For every accepted operator:

```sh
pnpm testnet:record-outreach -- \
  --candidate <candidate-or-community> \
  --pool <candidate-pool> \
  --contact <contact-route> \
  --slot <slot-id> \
  --status accepted \
  --tracking-issue-from-roster \
  --notes "Accepted public-testnet operator slot."

pnpm testnet:audit-outreach

pnpm testnet:update-roster-slot -- \
  --slot <slot-id> \
  --operator-id <operator-id> \
  --contact <contact-or-public-key> \
  --organization <organization-or-independent-individual> \
  --status accepted \
  --notes "<short-maintainer-note>"

pnpm testnet:audit-roster
pnpm mvp:audit
```

Do not mark `independenceReview` as reviewed until the attestation exists and maintainer review confirms the operator is independent from maintainers and sibling operators.
