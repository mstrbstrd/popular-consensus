# Public Testnet Operator Outreach Queue

This queue turns the broad recruitment pools into concrete first-contact routes for filling the final public-testnet operator slots.

This file is prospecting support only. A row here is not an assignment, not an evidence file, and not completion evidence for the roadmap gate. Move a slot into `docs/public-testnet-operator-roster.md` only after a real operator accepts and provides the fields in `docs/public-testnet-operator-assignment-intake.md`.

Use `docs/public-testnet-operator-send-packets.md` for per-slot messages with the slot ids and issue-body paths already filled in.

Source links were checked on 2026-05-09.

## First Outreach Pass

| Priority | Slot | Role | Outreach Target | Public Route | Message Draft | Acceptance Data Needed |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | deployer-1 | deployer | Dappnode community or partner route | https://dappnode.com/en-us/pages/contact | Infrastructure Operator | operator id, contact/public key, organization/individual marker, independence statement, target chain/RPC, deployment hash plan |
| 2 | replay-1 | replay-verifier | EthStaker community | https://ethstaker.org/ | Infrastructure Operator | operator id, contact/public key, independence statement, replay environment, planned testnet window |
| 3 | indexer-1 | api-indexer | Dappnode community or app-store builder route | https://dappnode.com/ | Infrastructure Operator | operator id, contact/public key, public API base URL plan, independence statement |
| 4 | indexer-2 | api-indexer | Open Source Collective hosted-project community | https://oscollective.org/ | Open-Source Maintainer | operator id, contact/public key, organization/individual marker, public API base URL plan, independence statement |
| 5 | replay-2 | replay-verifier | Open Collective open-source project directory | https://opencollective.com/search?hostname=opencollective.com | Open-Source Maintainer | operator id, contact/public key, independence statement, replay environment |
| 6 | replay-3 | replay-verifier | EthStaker allied-community route | https://ethstaker.org/ | Infrastructure Operator | operator id, contact/public key, independence statement, replay environment |
| 7 | steward-1 | community-steward | Open Fresno civic-tech volunteer community | https://openfresno.org/ | Civic Or Community Guide | operator id, contact/public key, organization/individual marker, governance-drill availability, independence statement |
| 8 | steward-2 | community-steward | SF Civic Tech volunteer community | https://www.sfcivictech.org/ | Civic Or Community Guide | operator id, contact/public key, organization/individual marker, governance-drill availability, independence statement |

## Contact Notes

- Dappnode publishes a Discord route for technical questions and a partner route for collaboration; use the collaboration route for `deployer-1` and the community route for operator volunteers.
- EthStaker lists Discord, Reddit, Farcaster, Twitter, and allied communities from its community navigation; ask for one solo-staker or infrastructure operator per slot rather than treating the community itself as the operator.
- Open Source Collective and Open Collective are discovery paths for maintainers of independent open-source projects; any accepted operator still needs a named operator id and maintainer-reviewed independence.
- Open Fresno and SF Civic Tech are community-governance prospects for community-guide slots; use the community-guide draft and emphasize governance/safety drills over chain operation.

## Outreach Packet

For each row:

1. Confirm the slot has a public tracking issue recorded in `docs/public-testnet-operator-roster.md`; if it is still `open`, regenerate issue drafts and create a tracking issue first.
2. Send the matching message from `docs/public-testnet-operator-send-packets.md`.
3. Record the attempt with `pnpm testnet:record-outreach` and `status` set to `contacted`.
4. Audit the prospect log with `pnpm testnet:audit-outreach`.
5. If a real operator accepts, fill `docs/public-testnet-operator-assignment-intake.md`.
6. Update the roster with `pnpm testnet:update-roster-slot`.
7. Keep `independenceReview` as `pending` until the evidence file exists and maintainer review passes.

## Source References

- Dappnode describes home and DIY node operation, a community of node runners, and collaboration routes at https://dappnode.com/ and https://dappnode.com/en-us/pages/contact.
- EthStaker describes a large staking community focused on decentralization and links official community channels at https://ethstaker.org/.
- Open Fresno describes a civic-tech volunteer community and meetup/project routes at https://openfresno.org/.
- Open Source Collective describes support for thousands of open-source projects and public contact/community routes at https://oscollective.org/ and https://docs.oscollective.org/about-osc/contact.
- Open Collective provides a public discovery/search route for collectives and projects at https://opencollective.com/search?hostname=opencollective.com.
- SF Civic Tech describes a volunteer civic-tech community, remote weekly hack nights, Slack, and onboarding routes at https://www.sfcivictech.org/ and https://www.sfcivictech.org/get-started.
