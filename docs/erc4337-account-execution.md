# ERC-4337 Account Execution MVP

Popular Consensus is moving from MVP account identifiers to real account-abstraction execution. The first completed slice is the local ERC-4337-style contract path that can deploy a counterfactual smart account through a factory, validate a controller signature, and execute protocol calls through an EntryPoint.

## Standards Boundary

The contract surface follows the ERC-4337 shape described in the standard: `PackedUserOperation`, `EntryPoint.handleOps`, account `validateUserOp`, factory-backed `initCode`, and optional paymaster validation. See the ERC-4337 reference at <https://eips.ethereum.org/EIPS/eip-4337>.

Passkey controller validation uses the P-256 verification shape expected by RIP-7212: `hash`, `r`, `s`, public key `x`, and public key `y`. Public testnets can point at the RIP-7212 precompile address when available. Local deployments default to the repo's `PopularConsensusP256Verifier`, which speaks the same five-word verifier shape and checks real secp256r1 ECDSA signatures. See the RIP-7212 reference at <https://github.com/ethereum/RIPs/blob/master/RIPS/rip-7212.md>.

## Implemented Contract Slice

- `PopularConsensusEntryPoint`: local `handleOps` runner, UserOperation hash helper, factory `initCode` deployment, account validation, execution, and paymaster hooks.
- `PopularConsensusAccount`: smart account with `execute`, `executeBatch`, nonce enforcement, wallet/secp256k1 signature validation over `userOpHash`, and passkey/WebAuthn P-256 validation through the configured verifier. The passkey payload binds `clientDataJSON.challenge` to the UserOperation hash before verifying the authenticator signature.
- `PopularConsensusAccountFactory`: CREATE2 account factory with `getAddress`, `createAccount`, `saltForWallet`, and `saltForPasskey`.
- `PopularConsensusP256Verifier`: local verifier fallback for chains without RIP-7212. It validates secp256r1 public keys and ES256 signatures while preserving the same call shape the account would use against the precompile.
- `PopularConsensusPaymaster`: local sponsor allowlist for accounts that should execute without a prefunded account balance during the MVP.
- `packages/contracts/scripts/deploy-local.mjs`: local deployment now writes `entryPoint`, `accountFactory`, `paymaster`, and `p256Verifier` beside the existing protocol contracts.
- `GET /auth/aa/config`: exposes the local AA deployment addresses to the client when `data/local-deployment.json` or explicit `PC_AA_*` environment variables are present.
- Wallet auth challenge/verify: new wallet accounts receive a prepared deployment UserOperation, the web client signs the UserOperation hash with `personal_sign`, and the API can submit the signed operation through the local EntryPoint with paymaster sponsorship.
- Passkey deployment bridge: passkey signup can return a deployment challenge whose WebAuthn assertion challenge is the UserOperation hash. The API verifies the assertion, DER-decodes `r`/`s`, attaches the authenticator data and client data to the UserOperation, and submits it through the same local EntryPoint/paymaster path.
- Bundler path: `POST /auth/aa/bundler` accepts `eth_sendUserOperation` JSON-RPC locally and relays through the local EntryPoint/paymaster submitter. `PC_AA_BUNDLER_URL` can also switch signed UserOperation submission to an external ERC-4337 bundler RPC. Without that URL, auth flows keep using the built-in EntryPoint submitter and local paymaster sponsorship.

The focused Foundry tests prove:

- CREATE2 prediction equals the deployed account address.
- A wallet-signed UserOperation deploys a counterfactual account and executes a target call.
- Invalid wallet signatures are rejected.
- A sponsored UserOperation passes through the local paymaster.
- A passkey/WebAuthn P-256 UserOperation validates through the configured verifier.
- Invalid passkey signatures are rejected.
- `PopularConsensusP256Verifier` accepts a real generated P-256 signature fixture and rejects a mutated signature.
- Opt-in local-chain smoke test: with Anvil running and `data/local-deployment.json` present, `pnpm test:aa:local-chain` deploys fresh wallet and passkey smart accounts through the API helper and verifies bytecode at the predicted CREATE2 addresses. It also sends a wallet deployment through the local `eth_sendUserOperation` JSON-RPC endpoint. The passkey smoke preflights the configured P-256 verifier with a generated WebAuthn ES256 signature before submitting the UserOperation.

## Remaining Sub-Goals

1. Production adapter hardening: choose and document the real public-testnet bundler/paymaster endpoints, deposits/stakes, and simulation failure reporting once the public testnet operator stack exists.
2. Stronger completion tests: add public-bundler compatibility checks once a bundler is selected for the public testnet stack.
3. Passkey deployment UX hardening: expose retry/status in account settings and decide whether production signup must defer account creation until the deployment assertion succeeds.

## Privacy Boundary

This account-execution layer authenticates social and public-record actions. It must not become the identity key for private vote choices. Voting-pass proofs, duplicate-vote blockers, encrypted ballot payloads, and combined result receipts remain separate from wallet, passkey, and smart-account metadata.
