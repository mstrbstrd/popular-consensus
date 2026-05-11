Use this issue to coordinate an independent public testnet operator. The completion gate still requires a valid attestation JSON file, maintainer independence review, and a launch summary.

## Operator Role

replay-verifier

## Roster Slot

replay-3

## Operator Identity

- Operator id: needs-operator-id
- Contact or public key: needs-contact-or-public-key
- Organization: independent individual or organization name
- Independence statement: explain why this operator is independent from maintainers and sibling operators

## Testnet Environment

- Testnet window: needs-testnet-window
- Chain id: needs-chain-id
- RPC URL: needs-rpc-url
- API base URL: only required for API/indexer operators
- Community id: needs-community-id

## Attestation Command Shape

```sh
pnpm testnet:collect-attestation -- \
  --operator-id needs-operator-id \
  --operator-contact needs-contact-or-public-key \
  --operator-organization "independent individual or organization name" \
  --independence-statement "explain operator independence from maintainers and sibling operators" \
  --role replay-verifier \
  --git-commit needs-git-commit \
  --chain-id needs-chain-id \
  --rpc-url needs-rpc-url \
  --community-id needs-community-id \
  --checks-preset complete \
  --out docs/public-testnet-attestations/needs-operator-id.json
```

## Operator Checklist

- [ ] Operator has read docs/public-testnet-operator-runbook.md.
- [ ] Operator can provide the required contact or public key.
- [ ] Operator can provide an independence statement.
- [ ] Operator will publish or provide a public-testnet operator attestation JSON file.
- [ ] Maintainer independence review is complete.

## Attestation Output

- Attestation file: docs/public-testnet-attestations/needs-operator-id.json
- Attestation hash: pending
- Observations: pending

## Maintainer Notes

Verifies transaction and event stream hashes.
