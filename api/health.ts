import { json } from './_lib/http.js'
import { hasSecret } from './_lib/seal.js'
import { rpcKind } from './_lib/solana.js'

/** GET /api/health — deployment check. `ready` must be true before launch. */
export function GET() {
  const secret = hasSecret()
  const rpc = rpcKind()
  return json({
    ready: secret && rpc !== 'public',
    secret: secret ? 'set' : 'MISSING — set PROOF_SECRET (32+ chars)',
    rpc: rpc === 'public' ? 'public (rate-limited) — set SOLANA_RPC_URL to your Helius URL' : rpc,
    proofMint: process.env.PROOF_MINT ? 'set' : 'not set (token not launched)',
  })
}
