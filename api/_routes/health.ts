import { json } from '../_lib/http.js'
import { hasSecret } from '../_lib/seal.js'
import { rpcKind } from '../_lib/solana.js'
import { hasKv } from '../_lib/kv.js'
import { hasBot } from '../_lib/telegram.js'
import { hasDiscord } from '../_lib/discord.js'
import { feesOn } from '../_lib/fees.js'

/** GET /api/health — deployment check. `ready` must be true before launch; `telegram` must be "ready" for the bot. */
export function GET() {
  const secret = hasSecret()
  const rpc = rpcKind()
  return json({
    ready: secret && rpc !== 'public',
    secret: secret ? 'set' : 'MISSING — set PROOF_SECRET (32+ chars)',
    rpc: rpc === 'public' ? 'public (rate-limited) — set SOLANA_RPC_URL to your Helius URL' : rpc,
    proofMint: process.env.PROOF_MINT ? 'set' : 'not set (token not launched)',
    gateFee: feesOn() ? (hasKv() ? 'on' : 'MISSING storage — connect a Vercel Blob store') : 'off — set PROOF_MINT, GATE_FEE, TREASURY_WALLET',
    telegram: !hasBot() ? 'off — set TELEGRAM_BOT_TOKEN' : !hasKv() ? 'MISSING storage — connect a Vercel Blob store' : 'ready',
    discord: !hasDiscord() ? 'off — set DISCORD_APP_ID, DISCORD_PUBLIC_KEY, DISCORD_BOT_TOKEN' : !hasKv() ? 'MISSING storage — connect a Vercel Blob store' : 'ready',
  })
}
