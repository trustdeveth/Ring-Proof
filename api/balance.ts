import { json } from './_lib/http.js'
import { isAddress } from './_lib/b58.js'
import { RpcError, SOL, assetInfo, fromBaseUnits, holding } from './_lib/solana.js'

/**
 * GET /api/balance?owner=<address>[&asset=<mint>] — public balances for the user's own dashboard:
 * SOL, plus $PROOF when PROOF_MINT is set, plus one extra mint if asked. Read-only, not an RPC proxy.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const owner = url.searchParams.get('owner') ?? ''
  const extra = url.searchParams.get('asset')
  if (!isAddress(owner)) return json({ error: 'Invalid address.' }, 400)
  const assets = [SOL]
  if (process.env.PROOF_MINT && isAddress(process.env.PROOF_MINT)) assets.push(process.env.PROOF_MINT)
  if (extra && isAddress(extra) && !assets.includes(extra)) assets.push(extra)
  try {
    const rows = await Promise.all(
      assets.map(async (a) => {
        const [info, amt] = await Promise.all([assetInfo(a), holding(owner, a)])
        return { ...info, amount: fromBaseUnits(amt, info.decimals) }
      }),
    )
    return json({ balances: rows }, 200, { 'cache-control': 'private, max-age=10' })
  } catch (e) {
    if (e instanceof RpcError) return json({ error: e.message }, 502)
    return json({ error: 'Could not read balances.' }, 502)
  }
}
