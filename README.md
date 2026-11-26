# Parhelion

Private holder proofs for Solana. Landing page at `/`, app at `/app`, backend in `api/` — one Vercel project, no other hosting or database.

## How a proof works (production)

1. The app asks `/api/challenge` for a one-time message (bound to the site's domain, valid 5 minutes).
2. The user signs it with their wallet — free, not a transaction.
3. `/api/attest` checks the signature, reads the wallet's **real on-chain balance** (SOL or any SPL / Token-2022 mint) and, if it meets the claim, seals a proof with `PROOF_SECRET`.
4. The proof (`rp2_…`) contains the token, threshold, expiry and optional gate — **never the wallet or balance**. Anyone can check it at `/app/verify` or `POST /api/verify`.

The Parhelion server sees the wallet during step 3 and stores nothing. Zero-knowledge proofs over Helius Privacy Rings — where not even Parhelion sees the balance — are the next milestone.

Gates are signed rules (`rg1_…`), also stateless: a project creates one, shares the holder link, and proofs issued through it are bound to that gate.

## Run locally

```sh
npm install
# create .env.local (gitignored):
#   SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
#   PROOF_SECRET=<32+ random characters>
npm run dev     # site, app and /api on http://localhost:5173
```

## Deploy to Vercel

1. Push to GitHub, import the repo in Vercel (framework: Vite, detected automatically).
2. Project → Settings → Environment Variables (Production):

| Variable | Required | Value |
| --- | --- | --- |
| `PROOF_SECRET` | **yes** | 32+ random characters, e.g. `openssl rand -base64 48`. In production the API refuses to issue proofs without it. **Changing it invalidates every issued proof and gate link.** |
| `SOLANA_RPC_URL` | **yes** | Your Helius mainnet URL `https://mainnet.helius-rpc.com/?api-key=…`. Server-side only. |
| `PROOF_MINT` | after launch | The $PRHL mint address. Adds $PRHL to the app's token picker and balances. |
| `GATE_FEE` | for fees | Gate fee in $PRHL, e.g. `50000`. With `PROOF_MINT` and `TREASURY_WALLET` set, creating a gate requires paying it. |
| `TREASURY_WALLET` | for fees | Wallet that receives the non-burned share. |
| `GATE_FEE_BURN_BPS` | optional | Share of each fee burned on-chain, in basis points. Default `5000` (50%). |
| `TELEGRAM_BOT_TOKEN` | for the bot | Token from @BotFather. Turns on the Telegram bot. |
| `BLOB_READ_WRITE_TOKEN` | for the bot | Added automatically when you connect a **private** Vercel Blob store (Storage → Create → Blob → Private) to the project. |
| `DISCORD_APP_ID` | for Discord | Application ID (Discord Developer Portal → General Information). |
| `DISCORD_PUBLIC_KEY` | for Discord | Public key (same page). Used to verify every interaction. |
| `DISCORD_BOT_TOKEN` | for Discord | Bot token (Bot → Reset Token). |
| `CRON_SECRET` | optional | If set, Vercel Cron sends it and `/api/discord-cron` requires it. |
| `PUBLIC_SITE_URL` | optional | Your custom domain, e.g. `https://parhelion.fun`, used in links the bot sends. Defaults to the production domain. |

3. Deploy, then open `https://<your-domain>/api/health` — it must say `"ready": true`.
4. Recommended: Vercel → Firewall → add a rate-limit rule for `/api/attest` and `/api/challenge`.

### $PRHL gate fees + burn

Set `PROOF_MINT`, `GATE_FEE` and `TREASURY_WALLET` (plus the Blob store, which records used payments). The Gates page then shows the fee and asks the creator's wallet to sign one transaction: treasury share via `transferChecked`, burn share via `burnChecked`, memo "Parhelion gate fee". `/api/gate` verifies it on-chain (confirmed, < 24 h old, amounts, never reused) before issuing the gate. No server key holds tokens; every burn is public on Solscan.

### Telegram bot

1. In Telegram, open @BotFather → `/newbot` → copy the token. Optional: `/setjoingroups` → Enable, and set a profile picture.
2. In Vercel: add `TELEGRAM_BOT_TOKEN`, and connect a private Blob store to the project. Redeploy.
3. Open `https://<your-domain>/api/telegram?setup=1` once. It registers the webhook (secured with a secret derived from `PROOF_SECRET`) and the bot's commands. `GET /api/telegram` shows the webhook status.
4. `/api/health` must show `"telegram": "ready"`.

### Discord bot

1. https://discord.com/developers/applications → New Application. Copy the **Application ID** and **Public Key**; under **Bot**, reset and copy the **token**.
2. In Vercel: add `DISCORD_APP_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN` (and the private Blob store, shared with Telegram). Redeploy.
3. Open `https://<your-domain>/api/discord?setup=1` once. It registers the slash commands and sets the Interactions Endpoint URL; the response includes the bot's install link (also shown on the Gates page).
4. `/api/health` must show `"discord": "ready"`. The daily cron (`vercel.json`) removes roles whose proof expired.

Server admins add the bot (Manage Roles only), move its role above the holder role, and run `/gate` with the gate code and the role. Members tap **Get my proof** and run `/verify`.

### How the Telegram bot works

Group admins then add the bot as admin ("Invite users via link"), create a gate in the app, and paste `/gate rg1_…` in the group. The bot answers with a join-request invite link; members who use it are asked for a proof in DM and approved automatically. Each proof works once per group. The bot stores only gate bindings, used proof IDs and 48-hour hashed join requests — never wallets.

## API

| Route | |
| --- | --- |
| `GET /api/health` | Deployment check |
| `GET /api/config` | Public config (`proofMint`) |
| `GET /api/asset?id=<mint\|SOL>` | Decimals + symbol (Helius DAS) |
| `GET /api/balance?owner=…[&asset=…]` | Public balances for the dashboard |
| `POST /api/challenge` | `{ owner }` → message to sign |
| `POST /api/attest` | `{ owner, ts, nonce, signature, asset, min, expiryDays, gate? }` → proof |
| `POST /api/verify` | `{ code }` → claim only |
| `POST /api/gate` | `{ name, asset, min, platform, room }` → gate token |
| `POST /api/telegram` | Telegram webhook · `GET ?setup=1` registers it |
| `POST /api/discord` | Discord interactions · `GET ?setup=1` registers commands + endpoint |
| `GET /api/fee` · `POST /api/fee` | Gate fee quote · relays the wallet-signed fee transaction |
| `GET /api/discord-cron` | Daily: removes Discord roles whose proof expired |

## Zero-knowledge circuit (Phase 4)

- Circuit: `zk/ring_balance.circom` — Groth16 / BN254, ~43k constraints, up to 2 Privacy Ring notes per proof.
- `npm run zk:test` — 17 checks: commitments/nullifiers match the Helius SDK, valid proofs verify, cheating inputs are rejected.
- `npm run zk:build` — compiles the circuit, runs Groth16 phase 2 on the PSE Perpetual Powers of Tau (`ppot_0080`, 2^16), and writes `public/zk/ring_balance.{wasm,zkey}` + `api/_lib/zk-vk.ts`.

### Trusted-setup ceremony (status: 1 contribution — not yet public)

The current proving key has one phase-2 contribution (Parhelion, contribution hash `815887b6 18065513 … 5135d3ea`). The setup is secure if **any one** contributor destroyed their randomness, so before the ZK proofs leave testing, run a public ceremony:

1. Contributor *k* downloads the latest `ring_balance.zkey`, then runs
   `npx snarkjs zkey contribute in.zkey out.zkey --name="<their name>" -e="<their own random text>"` and publishes `out.zkey` + the printed contribution hash.
2. After the last contributor, apply a public random beacon (e.g. a future Solana block hash):
   `npx snarkjs zkey beacon out.zkey final.zkey <beacon-hex> 10 -n="Final beacon"`.
3. Anyone can check the whole chain: `npx snarkjs zkey verify zk/build/ring_balance.r1cs zk/.deps/pot16.ptau final.zkey` (lists every contribution).
4. Copy `final.zkey` to `public/zk/ring_balance.zkey`, export the key (`npx snarkjs zkey export verificationkey final.zkey zk/build/verification_key.json`), regenerate `api/_lib/zk-vk.ts`, and publish the transcript.

## Known limits

- A proof can be passed on by whoever holds it. Each has a unique ID and an expiry; the Telegram and Discord bots accept each ID once per group/server, elsewhere admit each ID once.
- The balance is checked when the proof is issued, not continuously — pick short expiries for strict gates.
- “Held for N days” claims and Privacy Ring balances are not supported yet.

## Next

1. Helius Privacy Rings (`@heliuslabs/spr`) — shielding, encrypted balances; test on devnet first.
2. Parhelion zero-knowledge circuit over ring notes, then an external audit.
