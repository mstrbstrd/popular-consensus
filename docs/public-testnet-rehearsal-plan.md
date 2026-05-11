# Public Testnet Rehearsal Plan

This plan is for practicing the public-testnet operator workflow before real independent operators are available.

Rehearsal evidence must not be used to close the final roadmap item. The final gate requires real independent operators, public attestations, maintainer independence review, and `pnpm testnet:verify-attestations` reporting `Ready` against the real evidence directory.

## Rehearsal Goals

- Confirm maintainers understand the operator roster flow.
- Confirm each role can generate a correctly shaped attestation.
- Confirm the launch-summary writer refuses unsafe `GO` decisions.
- Confirm `pnpm mvp:audit` still reports `Pending` until real evidence exists.
- Identify unclear runbook or command-reference steps before inviting operators.

## Rehearsal Setup

Use a temporary directory outside the real evidence path:

```sh
mkdir -p /tmp/popular-consensus-public-testnet-rehearsal/attestations
```

Do not write rehearsal attestations to `docs/public-testnet-attestations`.

## Rehearsal Steps

1. Pick one maintainer to play each public-testnet role.
2. Use `docs/public-testnet-role-command-reference.md` to generate temporary attestations with manual hashes.
3. Run the pending verifier against the temporary directory:

```sh
pnpm testnet:verify-attestations:pending -- \
  --dir /tmp/popular-consensus-public-testnet-rehearsal/attestations \
  --summary /tmp/popular-consensus-public-testnet-rehearsal/launch-summary.md
```

4. Try to write a `NO-GO` rehearsal summary:

```sh
pnpm testnet:write-launch-summary -- \
  --dir /tmp/popular-consensus-public-testnet-rehearsal/attestations \
  --out /tmp/popular-consensus-public-testnet-rehearsal/launch-summary.md \
  --decision NO-GO \
  --testnet-window "rehearsal window" \
  --force
```

5. Confirm strict completion still fails against the real repo evidence:

```sh
pnpm mvp:audit:strict
```

That failure is expected during rehearsal.

## Rehearsal Review

After rehearsal, record:

- Which role commands were unclear.
- Which endpoint or hash values operators will need from maintainers.
- Which roster fields were hard to fill.
- Which launch-summary sections need real-world judgment.
- Any changes needed before inviting operators.

The latest rehearsal report lives at `docs/public-testnet-rehearsal-report.md`.

## Completion Boundary

The rehearsal is successful only if maintainers understand the process and the real MVP gate remains open. Do not copy rehearsal attestations or rehearsal launch summaries into the real evidence paths.
