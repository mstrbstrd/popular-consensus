# Local Appchain Devnet Runbook

This runbook describes the current Popular Consensus MVP devnet. In plain terms, it starts every local service needed to ask questions, vote privately, count results, and check the public records on your machine. It is a local appchain-style stack made of:

- An Anvil chain running the MVP protocol modules in `packages/contracts`.
- Postgres as the local indexer/application database.
- The API as the civic indexer/client layer.
- Content-addressed artifacts written under `data/artifacts`.
- Explicit `devnet-commitment-v0` records that mirror the minimum public commitment set until lifecycle actions are fully replaced by live contract event ingestion.

The goal is not to claim production decentralization. The goal is to make the local MVP reproducible, inspectable, and ready for the next step: replacing local commitment writes with canonical appchain transactions and event ingestion.

## Prerequisites

- Node and pnpm matching `package.json`.
- Docker for Postgres.
- Foundry tools on the path: `forge` and `anvil`.

Install dependencies once:

```bash
pnpm install
```

Optional local environment file:

```bash
cp infra/dev.env.example .env
```

Important environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://pc:pc@localhost:5432/popular_consensus` | API and Prisma database connection. |
| `ARTIFACT_DIR` | `./data/artifacts` from the API package root | Content-addressed artifact storage. |
| `PC_DEV_MODE` | `true` unless set to `false` | Enables local reset/dev-only routes. |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Web app API base URL. |
| `RPC_URL` | `http://127.0.0.1:8545` | Contract deployment RPC target. |
| `DEPLOYER_PRIVATE_KEY` | Anvil account 0 private key | Local deployment account. |

## Start The Devnet

Use separate terminals for long-running services.

1. Start Postgres.

```bash
docker compose up -d postgres
```

2. Generate the Prisma client and apply the schema.

```bash
pnpm db:generate
pnpm db:migrate
```

3. Start the local appchain RPC.

```bash
pnpm dev:chain
```

Expected chain:

- RPC: `http://127.0.0.1:8545`
- Chain id: `31337`
- Default deployer: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

4. Deploy the MVP protocol modules.

```bash
pnpm contracts:deploy:local
```

This writes `data/local-deployment.json` with deployed addresses for:

- `PCToken`
- `StakeManager`
- `QuestionRegistry`
- `ChallengeCourt`
- `CredentialRegistry`
- `PollManager` (`pollAdapter` is kept as a deployment alias for older local tooling)
- `TallyManager`
- `ResultArchive`
- `AdoptionRegistry`
- `PopularConsensusEntryPoint`
- `PopularConsensusAccountFactory`
- `PopularConsensusPaymaster`
- configured P-256 verifier address (`p256Verifier`)

By default, local deployment creates `PopularConsensusP256Verifier` and points the account factory at it. Set `P256_VERIFIER_ADDRESS` or `PC_AA_P256_VERIFIER` when you want to use a chain-native RIP-7212 verifier instead, such as `0x0000000000000000000000000000000000000100` on networks that expose the precompile.

If Anvil is restarted, redeploy before using the devnet. Anvil state is ephemeral.

By default the API submits signed UserOperations directly to the local `PopularConsensusEntryPoint`. It also exposes `POST /auth/aa/bundler` as a local JSON-RPC endpoint for `eth_sendUserOperation`; the opt-in AA smoke uses that endpoint to verify the local bundler-style path. To test against an external ERC-4337 bundler, set `PC_AA_BUNDLER_URL` before starting the API; signed operations will be sent with `eth_sendUserOperation` instead.

To replay the direct local smart-account deployment path as a committed integration check, keep Anvil running after deployment and run:

```bash
pnpm test:aa:local-chain
```

This smoke exercises wallet, passkey, and local bundler-style controller paths. The passkey path first verifies that the configured P-256 verifier accepts a generated WebAuthn ES256 signature, then submits the passkey UserOperation through the same local EntryPoint path.

5. Start the API and web app.

```bash
pnpm dev
```

Local URLs:

- Web app: `http://localhost:3000`
- API: `http://localhost:4000`
- Anvil RPC: `http://127.0.0.1:8545`
- Postgres: `localhost:5432`

The API runs `ensureSeedData()` on startup, so a fresh database gets demo accounts, communities, credentials, questions, registry events, artifacts, and commitment records.

## Public Audit Checks

Health check:

```bash
curl http://localhost:4000/health
```

Minimum commitment set:

```bash
curl http://localhost:4000/public/protocol/commitments
```

Registry events with indexed commitments:

```bash
curl "http://localhost:4000/registry/events?pageSize=10"
```

Commitment index:

```bash
curl "http://localhost:4000/registry/commitments?pageSize=10"
```

Question civic record:

```bash
curl "http://localhost:4000/public/questions/<question-id>/civic-record"
```

Replay check for a question:

```bash
curl "http://localhost:4000/public/questions/<question-id>/replay-check"
```

A healthy replay check should report `verified: true` and all checks passing. A healthy civic record should include events, artifact hashes, archive metadata when archived, and a `commitments` array whose hashes match emitted registry events.

## Reset And Rerun

Reset demo data without stopping services:

```bash
curl -X POST http://localhost:4000/dev/reset
```

Full local reset:

```bash
docker compose down -v
docker compose up -d postgres
pnpm db:migrate
pnpm contracts:deploy:local
pnpm dev
```

Only use `docker compose down -v` when you intentionally want to remove the local Postgres volume.

## Verification Commands

Run these before marking a devnet change ready:

```bash
pnpm --filter @pc/contracts test
pnpm --filter @pc/shared test
pnpm --filter @pc/api typecheck
pnpm test:api:db
pnpm typecheck
```

For a full product smoke test after building the web app:

```bash
pnpm e2e
```

## Current Boundary

Today, contract deployment is verified and local API lifecycle actions emit protocol transaction results plus explicit `devnet-commitment-v0` records for the minimum commitment set. The API exposes those records through `/registry/protocol-transactions`, `/registry/protocol-transactions/replay`, `/registry/commitments`, `/registry/events`, and each public civic record.

The next decentralization step is to run the same public response contracts on a public testnet with independent operators. Operator launch and evidence requirements are tracked in `docs/public-testnet-operator-runbook.md`.
