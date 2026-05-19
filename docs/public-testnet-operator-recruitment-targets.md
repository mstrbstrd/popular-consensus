# Public Testnet Operator Recruitment Targets

This guide lists public communities and directories that maintainers can use to find independent operators for the final public-testnet gate.

Use `docs/public-testnet-operator-outreach-messages.md` for candidate-pool-specific outreach drafts.

Do not copy any name from this guide into `docs/public-testnet-operator-roster.md` as assigned. A roster slot can move only after a real operator accepts, provides contact and independence information, runs the relevant role, publishes an evidence file, and passes maintainer independence review.

## Selection Criteria

Prefer operators who can satisfy at least one of these signals:

- They are not controlled by the Popular Consensus maintainers.
- They can run a node, API/indexer, replay check, or governance drill independently.
- They can publish a durable contact, public key, organization, or independent-individual marker.
- They are comfortable with public evidence files and issue-based coordination.
- They understand that rehearsal evidence does not close the final gate.

## Candidate Pools

| Pool | Why It Fits | Best-Fit Roles | Source |
| --- | --- | --- | --- |
| Home-node and decentralization communities | Operators are already oriented around running independent infrastructure and public verification workflows. | deployer, api-indexer, replay checker | Dappnode describes a community of home node runners and decentralized infrastructure operators: https://dappnode.com |
| Ethereum solo-staker communities | These communities already have operational literacy around independent nodes, keys, uptime, and verifiable infrastructure. | deployer, replay checker | EthStaker describes itself as an Ethereum staking community with tens of thousands of members: https://ethstaker.org |
| Local civic-tech volunteer groups | These groups are closer to the community-governance and public-interest side of the protocol. | community guide, replay checker | Open Fresno describes a volunteer civic-tech community focused on open data and local public-interest technology: https://openfresno.org |
| Open-source/public-goods collectives | These directories can surface independent project maintainers and community groups that understand transparent public-good operations. | api-indexer, replay checker, community guide | Open Collective Discover lists public collectives across open-source, education, mutual-aid, and community categories: https://opencollective.com/discover |
| Open-source fiscal-hosted projects | Maintainers may find technically mature, independent open-source teams with public governance norms. | api-indexer, replay checker | Open Source Collective describes supporting thousands of open-source projects through fiscal hosting: https://www.oscollective.org |

## Suggested Outreach Order

1. Fill `deployer-1` first with a technically comfortable operator who can publish chain id, RPC URL, deployment hash, and commit hash.
2. Fill `indexer-1` and `indexer-2` with two independent operators from different organizations or communities.
3. Fill `replay-1`, `replay-2`, and `replay-3` with operators who can independently verify transaction and event stream hashes.
4. Fill `steward-1` and `steward-2` with civic/community operators who can run governance and safety drills and explain the public-interest review. These are community-guide slots; the `steward-*` ids are kept only for existing tooling.

## Screening Questions

Ask each candidate:

```text
Which role can you run?
What public operator id should appear in the evidence file?
What contact or public key should maintainers use for independence review?
Are you acting as an organization or independent individual?
Why are you independent from the project maintainers and sibling operators?
Can you publish or submit a public-testnet operator evidence JSON file?
Can you complete the role during the proposed testnet window?
```

## Recording An Accepted Operator

After a real operator accepts, capture the assignment with `docs/public-testnet-operator-assignment-intake.md`, then update the roster:

```sh
pnpm testnet:update-roster-slot -- \
  --slot <slot-id> \
  --tracking-issue <issue-url-or-number> \
  --operator-id <operator-id> \
  --contact <contact-or-public-key> \
  --organization <organization-or-independent-individual> \
  --status accepted \
  --notes "<short-maintainer-note>"
```

Then run:

```sh
pnpm testnet:audit-roster
pnpm mvp:audit
```
