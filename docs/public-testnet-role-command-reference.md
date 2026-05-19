# Public Testnet Role Command Reference

This reference gives each public-testnet role a concrete evidence-file command shape. Operators should still read `docs/public-testnet-operator-runbook.md` first.

Replace the example values with real public-testnet values before generating evidence.

## Shared Required Checks

Every operator should run:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm --filter @pc/shared test
pnpm --filter @pc/contracts test
pnpm test:api:db
```

Every operator evidence file must include:

- `--operator-id`
- `--operator-contact`
- `--independence-statement`
- `--git-commit`
- `--chain-id`
- `--rpc-url`
- replay hashes from a verified endpoint or manual hash arguments
- `--out docs/public-testnet-attestations/operator-name.json`

## Deployer

Use this after publishing deployment output:

```sh
pnpm testnet:collect-attestation -- \
  --operator-id deployer-name-or-public-key \
  --operator-contact contact-url-email-handle-or-public-key \
  --operator-organization organization-or-independent-individual \
  --independence-statement "Independent deployer not controlled by the maintainers or sibling operators." \
  --role deployer \
  --git-commit commit-hash \
  --chain-id public-testnet-chain-id \
  --rpc-url public-testnet-rpc-url \
  --deployment-json path-to-deployment-json \
  --transaction-stream-hash sha256:64-hex-transaction-stream-hash \
  --event-stream-hash sha256:64-hex-event-stream-hash \
  --upgrade-safety-model-hash sha256:64-hex-upgrade-safety-model-hash \
  --checks-preset required \
  --out docs/public-testnet-attestations/deployer-name.json
```

## API/Indexer

Use this after the API/indexer endpoint is public and replay is verified:

```sh
pnpm testnet:collect-attestation -- \
  --operator-id indexer-name-or-public-key \
  --operator-contact contact-url-email-handle-or-public-key \
  --operator-organization organization-or-independent-individual \
  --independence-statement "Independent API indexer not controlled by the maintainers or sibling operators." \
  --role api-indexer \
  --git-commit commit-hash \
  --chain-id public-testnet-chain-id \
  --rpc-url public-testnet-rpc-url \
  --api-base-url public-api-base-url \
  --community-id public-testnet-community-id \
  --checks-preset required \
  --out docs/public-testnet-attestations/indexer-name.json
```

## Replay Checker

Use this after independently checking replay output:

```sh
pnpm testnet:collect-attestation -- \
  --operator-id replay-checker-name-or-public-key \
  --operator-contact contact-url-email-handle-or-public-key \
  --operator-organization organization-or-independent-individual \
  --independence-statement "Independent replay checker not controlled by the maintainers or sibling operators." \
  --role replay-verifier \
  --git-commit commit-hash \
  --chain-id public-testnet-chain-id \
  --rpc-url public-testnet-rpc-url \
  --api-base-url public-api-base-url \
  --community-id public-testnet-community-id \
  --checks-preset required \
  --out docs/public-testnet-attestations/replay-checker-name.json
```

## Community Guide

Use this after completing governance and safety drills:

```sh
pnpm testnet:collect-attestation -- \
  --operator-id community-guide-name-or-public-key \
  --operator-contact contact-url-email-handle-or-public-key \
  --operator-organization organization-or-independent-individual \
  --independence-statement "Independent community guide not controlled by the maintainers or sibling operators." \
  --role community-steward \
  --git-commit commit-hash \
  --chain-id public-testnet-chain-id \
  --rpc-url public-testnet-rpc-url \
  --api-base-url public-api-base-url \
  --community-id public-testnet-community-id \
  --checks-preset complete \
  --out docs/public-testnet-attestations/community-guide-name.json
```

## Maintainer Verification

After collecting evidence files:

```sh
pnpm testnet:audit-roster
pnpm testnet:verify-attestations:pending
pnpm mvp:audit
```

For the final launch PR:

```sh
pnpm testnet:write-launch-summary -- --decision GO --independence-reviewed --testnet-window "start to end"
pnpm testnet:verify-attestations
pnpm mvp:audit:strict
```
