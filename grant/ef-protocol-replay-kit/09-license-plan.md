# License Plan

This is a grant-review draft, not final legal advice. The purpose is to make the public-good boundary explicit before submission.

## Chosen Boundary

Grant-funded protocol work should be reusable without adopting the Popular Consensus social platform.

Current split:

| Area | Proposed license | Reason |
| --- | --- | --- |
| Protocol packages: `shared`, `artifacts`, `privacy`, `protocol-slice`, `replay`, `contracts` | MIT | Common open-source terms for reusable Ethereum infrastructure, aligned with existing Solidity SPDX headers |
| Grant packet and protocol specs | CC BY 4.0 | Allows reuse with attribution |
| Platform app code: `apps/web`, product UX, rewards/reporting workflows | Decide separately | May need a different product/commercial strategy |
| Generated demo artifacts and test vectors | CC0 1.0 | Easier for reviewers and builders to copy into tests |

## Implemented Files

- `LICENSE-BOUNDARY.md` defines the repo-level scope.
- `LICENSE-PROTOCOL-MIT` contains the protocol code license.
- `grant/ef-protocol-replay-kit/LICENSE-CC-BY-4.0.md` covers the grant packet.
- `artifacts/grant-demo/LICENSE-CC0.md` covers generated demo evidence and test vectors.
- Protocol package manifests include `"license": "MIT"`.
- Protocol package manifests currently keep `"private": true` as an accidental npm-publish guard. This is not a proprietary-license claim; npm publication readiness is tracked separately by `pnpm grant:protocol-publication`.

Do not imply that the whole monorepo is MIT licensed. The platform/product code remains outside this grant-facing license boundary unless a file says otherwise.

## What Other Builders Can Reuse

Other builders can reuse this license plan as a template for separating public-good protocol code from platform or product code in a single monorepo.
