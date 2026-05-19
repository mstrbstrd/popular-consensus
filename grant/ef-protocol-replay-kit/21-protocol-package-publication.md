# Protocol Package Publication Status

## Purpose

This note explains the current package-publication boundary for the protocol slice. The protocol packages are MIT-licensed and reusable from source in this repository, but the workspace package manifests still use `private: true` as a no-publish guard. That flag prevents accidental npm publication; it is not a claim that the protocol source is proprietary.

## Command

Run:

```bash
pnpm grant:protocol-publication
```

The command writes:

- `artifacts/grant-demo/protocol-publication-report.json`
- `artifacts/grant-demo/protocol-publication-transcript.txt`

## Current Status

| Question | Current answer |
| --- | --- |
| Can reviewers inspect and reuse the protocol source under MIT terms? | Yes |
| Do protocol package manifests declare MIT? | Yes |
| Do protocol package manifests currently block accidental npm publish? | Yes |
| Is npm publication readiness claimed? | No |

## Before NPM Publication

Before publishing protocol packages to a registry, maintainers should remove the no-publish guards intentionally, decide package names and access, add stable build outputs, confirm workspace dependency rewriting, and run the full review gate from a clean checkout.

## Non-Claims

This packet does not claim the protocol packages are ready for npm publication. It claims they are source-reviewable, license-scoped, and independent of platform imports for external grant review.

## What Other Builders Can Reuse

Other builders can reuse this pattern to distinguish open-source source availability from registry publication readiness while a monorepo still contains both protocol and product code.
