# Passkey And Wallet Login MVP

Popular Consensus lets people sign in with a passkey or a wallet. In plain terms, that means a user can prove "this is my account" before asking questions, joining communities, reviewing flags, or publishing records. Private votes stay separate from login, so signing in does not reveal how someone voted.

The technical login layer supports two controller types:

- Passkey controller: WebAuthn P-256 registration and login.
- Wallet controller: Ethereum wallet EIP-191 `personal_sign` registration and login.

Both controller types create or recover a deterministic counterfactual smart account address. When `data/local-deployment.json` or `PC_AA_*` environment variables provide an EntryPoint and account factory, the API predicts the address from the real CREATE2 factory inputs and records the account as `erc-4337-local-v1`. In local development without a configured factory, the API falls back to the older hash-derived identifier.

## API Surface

- `GET /auth/session`: returns the bearer-session user and AA account metadata.
- `GET /auth/aa/config`: returns the local ERC-4337 deployment addresses and configured bundler URL when available.
- `POST /auth/aa/bundler`: local JSON-RPC endpoint for `eth_sendUserOperation`; it relays through the built-in EntryPoint submitter and local paymaster sponsorship.
- `POST /auth/logout`: revokes the bearer session token.
- `POST /auth/passkey/register/options`: starts a passkey signup ceremony.
- `POST /auth/passkey/register/verify`: verifies WebAuthn attestation, creates the account/session, and returns a passkey deployment challenge when a local factory-backed smart account is available.
- `POST /auth/passkey/login/options`: starts passkey login for an existing username.
- `POST /auth/passkey/login/verify`: verifies WebAuthn assertion and creates the session.
- `POST /auth/passkey/deploy/options`: creates a retryable passkey smart-account deployment challenge for the authenticated session.
- `POST /auth/passkey/deploy/verify`: verifies the WebAuthn assertion over the UserOperation hash, attaches the passkey payload, and submits the operation through the local EntryPoint/paymaster path.
- `POST /auth/wallet/challenge`: creates a wallet auth challenge for signup or login. For new wallet accounts with a configured local factory, the response also includes a deployment UserOperation and UserOperation hash to sign.
- `POST /auth/wallet/verify`: verifies the signed wallet challenge, accepts an optional signed deployment UserOperation, submits it through the local EntryPoint/paymaster path when present, and creates the account/session.

The backing tables are `AuthController`, `AuthChallenge`, and `AuthSession`, with `UserAccount.smartAccountAddress` and `UserAccount.smartAccountKind` linking profile identity to the counterfactual account. Controllers store the EntryPoint, factory, paymaster, salt, initCode, and passkey P-256 coordinates when available.

## Where Login Is Required

When `PC_REQUIRE_AUTH=true` or the API is not in dev mode, actions that change public records require a bearer token for the same actor id in the request body. This includes community creation, membership changes, follows, question proposals, flags and review decisions, discussion and moderation, community-guide actions, vote-counting operations, rewards consent/report/customer actions, and emergency or next-step rule actions.

The `/users` local account endpoint is dev-only when auth is required. Demo coordinator close/count routes are also disabled when auth is required because they do not yet carry an authenticated community-guide or coordinator actor.

## Privacy Boundary

Account auth is not attached to private vote submission. Voting eligibility, signup, and voting continue to use the voting-pass proof path:

- wallet-held voting-pass import/export stays secret-based,
- voting-pass membership proofs derive duplicate-vote blockers,
- ballots are stored as encrypted payloads and commitments,
- no public result receipt links a wallet, passkey, or smart account to an answer.

This preserves the original privacy boundary: smart accounts authenticate social and public-record actions, while private voting remains voting-pass based.

## User-Facing Screens

The web app uses this login flow here:

- `/signup`: create an account with a passkey or wallet.
- `/login`: log in with a passkey or wallet.
- `/feed` and `/account`: keep the signed-in session and attach `Authorization: Bearer ...` to writes.
- `/testing`: remains the local demo hub for older test flows.

## ERC-4337 Execution Bridge

The contract package now includes `PopularConsensusEntryPoint`, `PopularConsensusAccountFactory`, `PopularConsensusAccount`, and `PopularConsensusPaymaster`. This proves the onchain path for CREATE2 counterfactual accounts, wallet controller validation, WebAuthn passkey/P-256 controller validation, UserOperation execution, and local paymaster sponsorship.

Wallet signup now has the local factory-backed UserOperation path. Passkey signup can now perform the same deployment path with a second WebAuthn assertion whose challenge is the UserOperation hash. Signed operations submit directly to the local EntryPoint by default, through the local `/auth/aa/bundler` JSON-RPC endpoint for `eth_sendUserOperation` smoke testing, or through an external bundler when `PC_AA_BUNDLER_URL` is configured. Local deployment includes `PopularConsensusP256Verifier` for Anvil instances without RIP-7212 support; public testnets can instead configure a chain-native verifier address. The remaining auth work is to choose real public-testnet bundler/paymaster endpoints and harden passkey deployment retry/status UX.
