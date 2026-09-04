# Popular Consensus MVP

Runnable local demo for the Popular Consensus civic signal protocol.

## Protocol foundation (v0.2 draft)

The [protocol foundation](docs/protocol-foundation/README.md) begins the privacy-first
digital town square and data-union work: a proposed constitution, decision register,
invariant catalog, model-migration plan, and isolated draft schemas with rejection
tests. These additions do not change demo behavior or establish production privacy,
authentication, compensation, or public-utility readiness.

## Local Run

```bash
pnpm install
docker compose up -d postgres
pnpm db:migrate
pnpm dev:chain
pnpm contracts:deploy:local
pnpm privacy:setup
pnpm dev
```

Local URLs:

- Web app: http://localhost:3000
- API: http://localhost:4000
- Anvil RPC: http://localhost:8545
- Postgres: localhost:5432

For the full local appchain/devnet workflow, including contract deployment, audit checks, reset steps, and verification commands, see `docs/local-appchain-devnet-runbook.md`. Community fork and exit expectations are documented in `docs/community-fork-and-exit.md`. Public testnet operator requirements are tracked in `docs/public-testnet-operator-runbook.md`; the maintainer launch path is summarized in `docs/public-testnet-maintainer-checklist.md`, with external input handoff in `docs/public-testnet-external-input-request.md`, operator coordination in `docs/public-testnet-operator-roster.md`, recruitment targets in `docs/public-testnet-operator-recruitment-targets.md`, first-contact slot mapping in `docs/public-testnet-operator-outreach-queue.md`, send-ready outreach packets in `docs/public-testnet-operator-send-packets.md`, outreach drafts in `docs/public-testnet-operator-outreach-messages.md`, prospect tracking in `docs/public-testnet-operator-outreach-log.md`, assignment intake in `docs/public-testnet-operator-assignment-intake.md`, GitHub issue handoff files in `docs/public-testnet-operator-issue-drafts.md` and `docs/public-testnet-operator-issue-bodies`, issue URL intake in `docs/public-testnet-operator-issue-url-intake.md`, and configuration starting from `infra/public-testnet.env.example`.

To check the current MVP completion state, run:

```bash
pnpm mvp:audit
```

That command combines the roadmap checkbox tracker with the public testnet attestation verifier. Use `pnpm mvp:audit:strict` for a CI-style check that exits non-zero until every roadmap item and the public testnet gate are ready. The current completion audit is recorded in `docs/mvp-completion-audit.md`.

For public-testnet coordination, use `pnpm testnet:record-issue-urls -- --dry-run` to validate public issue URLs from the intake sheet before writing them to the roster, `pnpm testnet:record-issue-urls` to record those URLs, `pnpm testnet:record-outreach` to record real outreach attempts, `pnpm testnet:audit-outreach` to check prospect-log consistency, `pnpm testnet:audit-outreach:strict` when every slot should have contacted-or-later outreach, and `pnpm testnet:update-roster-slot` only after a real operator accepts a slot. Use `pnpm testnet:audit-roster:strict` when every required slot should be reviewed with attestation evidence, and `pnpm testnet:operator-issue-drafts:check` to verify generated operator issue handoff files are current. If this workspace has no Git remote, regenerate operator issue commands with `pnpm testnet:operator-issue-drafts -- --body-dir docs/public-testnet-operator-issue-bodies --github-repo <owner/repo>`, or use `pnpm testnet:operator-issue-drafts -- --json` for authenticated GitHub connector issue creation after explicit approval.

The first demo is a Reddit-inspired civic community product with local account creation, public and private communities, community-scoped question proposals, proposal staking, role-gated challenge/amendment/ruling flow, explicit registry acceptance before polls open, single-issuance demo resident credentials, encrypted private voting, coordinator tallying, and public result artifacts.
Authority remains advisory by default. Communities can now propose, activate, and suspend explicit adoption policies; recognized or binding labels only apply through active policy metadata.

Playwright e2e tests run the web app on http://localhost:3001 so an active development server on port 3000 can stay open.

## Current Product Surface

- Create and switch between local demo accounts.
- Create public or private communities.
- Join communities in local development mode.
- Propose community-scoped advisory questions from the UI.
- Browse a community question feed.
- Challenge, amend, rule on challenges, accept questions into the registry, vote, close, tally, and inspect aggregate result artifacts.
- Challenge result artifacts, rule on result-integrity disputes, finalize results, and publish question archives.
- Post public discussion notes on question pages.
- Inspect proposal/challenge bond settlement and non-transferable curation reputation through the API.
- Register credential schemas and issuers through the local credential registry API.
- Propose, activate, list, and suspend community adoption policies through the API and local UI.
- Expose public civic-record API views for privacy-safe question, event, result, and archive metadata.
- Keep private community feeds gated to active members in the local API.

The product/protocol guardrails are listed in `docs/mvp-invariants.md`. The larger decentralization work is tracked in `docs/decentralized-protocol-roadmap.md`.

## Trust Model

The privacy layer is MACI-derived for the local MVP: ballots are encrypted before storage, duplicate participation is blocked with credential-derived nullifiers, and the coordinator publishes auditable aggregate artifacts. The coordinator remains a demo trust assumption until a threshold tally committee is implemented.

Local accounts are not production authentication. Private communities are membership-gated in the local API, not yet protected by cryptographic access credentials.
