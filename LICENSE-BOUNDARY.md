# License Boundary

This monorepo contains both public-good protocol infrastructure and product/platform code. The presence of protocol license files does not license the entire monorepo under a single open-source license.

## Protocol Source Code

The MIT license in `LICENSE-PROTOCOL-MIT` applies to the grant-facing protocol source code in:

- `packages/shared`
- `packages/artifacts`
- `packages/privacy`
- `packages/protocol-slice`
- `packages/replay`
- `packages/contracts`
- `scripts/check-protocol-boundaries.ts`
- `scripts/grant`

Solidity files that already contain `SPDX-License-Identifier: MIT` remain MIT-licensed.

## Grant Packet

The EF grant packet in `grant/ef-protocol-replay-kit` is licensed under CC BY 4.0 as described in `grant/ef-protocol-replay-kit/LICENSE-CC-BY-4.0.md`.

## Demo Artifacts

Generated grant-demo artifacts in `artifacts/grant-demo` are dedicated under CC0 1.0 as described in `artifacts/grant-demo/LICENSE-CC0.md`.

## Platform Code

Unless a file says otherwise, this license boundary does not apply to platform/product code under `apps`, data-union product workflows, social UX, rewards/reporting workflows, or other commercial application surfaces.
