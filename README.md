# RingProof

Private holder proofs for Solana. Landing page at `/`, app at `/app`, backend in `api/` — one Vercel project, no other hosting or database.

## How a proof works (production)

1. The app asks `/api/challenge` for a one-time message (bound to the site's domain, valid 5 minutes).
2. The user signs it with their wallet — free, not a transaction.
3. `/api/attest` checks the signature, reads the wallet's **real on-chain balance** (SOL or any SPL / Token-2022 mint) and, if it meets the claim, seals a proof with `PROOF_SECRET`.
4. The proof (`rp2_…`) contains the token, threshold, expiry and optional gate — **never the wallet or balance**. Anyone can check it at `/app/verify` or `POST /api/verify`.

The RingProof server sees the wallet during step 3 and stores nothing. Zero-knowledge proofs over Helius Privacy Rings — where not even RingProof sees the balance — are the next milestone.

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
| `PROOF_MINT` | after launch | The $PROOF mint address. Adds $PROOF to the app's token picker and balances. |

3. Deploy, then open `https://<your-domain>/api/health` — it must say `"ready": true`.
4. Recommended: Vercel → Firewall → add a rate-limit rule for `/api/attest` and `/api/challenge`.

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

## Known limits

- A proof can be passed on by whoever holds it. Each has a unique ID and an expiry; groups should admit each ID once. The Telegram bot (next) will enforce this.
- The balance is checked when the proof is issued, not continuously — pick short expiries for strict gates.
- “Held for N days” claims and Privacy Ring balances are not supported yet.

## Next

1. Telegram bot — webhook at `/api/telegram`, one-time proof IDs stored in Vercel Blob.
2. Helius Privacy Rings (`@heliuslabs/spr`) — shielding, encrypted balances; test on devnet first.
3. RingProof zero-knowledge circuit over ring notes, then an external audit.
