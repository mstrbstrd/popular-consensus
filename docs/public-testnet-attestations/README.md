# Public Testnet Attestations

Place one `public-testnet-operator-attestation-v0` JSON file per independent operator in this directory when the public testnet is running.

Operators can generate a correctly shaped attestation from a live API/indexer endpoint:

```sh
pnpm testnet:collect-attestation -- \
  --operator-id operator-name-or-public-key \
  --operator-contact contact-url-email-handle-or-public-key \
  --independence-statement "Independent operator not controlled by the maintainers or sibling operators." \
  --role replay-verifier \
  --git-commit <commit> \
  --chain-id <chain-id> \
  --rpc-url <public-testnet-rpc-url> \
  --api-base-url <api-base-url> \
  --community-id <community-id> \
  --checks-preset complete \
  --out docs/public-testnet-attestations/operator-name.json
```

Run the verifier from the repository root:

```sh
pnpm testnet:verify-attestations
```

During preparation, this pending-mode command is useful because it reports missing evidence without failing the shell:

```sh
pnpm testnet:verify-attestations:pending
```

When the attestation set is complete, draft the maintainer launch summary:

```sh
pnpm testnet:write-launch-summary -- --decision GO --independence-reviewed --testnet-window "start to end"
```

The final roadmap gate is complete only after the verifier is ready, maintainers confirm operator independence, and the launch summary records the operator list, attestation hashes, unresolved issues, and go/no-go decision.

When submitting attestations or launch-summary evidence through GitHub, use `.github/PULL_REQUEST_TEMPLATE/public-testnet-attestation.md`.
