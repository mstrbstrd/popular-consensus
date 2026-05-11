# Public Testnet Attestation PR

Use this template for changes that add public testnet operator attestations, roster updates, or the launch summary.

Follow `docs/public-testnet-maintainer-checklist.md` before opening a final public-testnet launch PR.

## Evidence Added

- [ ] Added or updated operator attestation JSON in `docs/public-testnet-attestations`.
- [ ] Updated `docs/public-testnet-operator-roster.md`.
- [ ] Updated `docs/public-testnet-operator-outreach-log.md` for real outreach attempts.
- [ ] Added or updated `docs/public-testnet-launch-summary.md`.
- [ ] Listed every operator id and attestation hash in the launch summary when applicable.
- [ ] Recorded unresolved issues or explicitly stated that none are known.

## Independence Review

- [ ] Every operator has a contact or public key.
- [ ] Every operator has an independence statement.
- [ ] Maintainer independence review is recorded for reviewed slots.
- [ ] No duplicate contacts are used across different operator ids unless explicitly explained.

## Required Commands

```sh
pnpm testnet:audit-outreach
pnpm testnet:audit-roster
pnpm testnet:verify-attestations:pending
pnpm mvp:audit
```

For a final launch PR, also run:

```sh
pnpm testnet:verify-attestations
pnpm mvp:audit:strict
```

## Results

Roster audit:

```text
paste command output here
```

Outreach audit:

```text
paste command output here
```

Attestation verifier:

```text
paste command output here
```

MVP audit:

```text
paste command output here
```
