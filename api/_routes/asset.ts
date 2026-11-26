import { json } from '../_lib/http.js'
import { isAddress } from '../_lib/b58.js'
import { RpcError, SOL, assetInfo } from '../_lib/solana.js'

/** GET /api/asset?id=<mint|SOL> — decimals + symbol for the UI. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id') ?? ''
  if (id !== SOL && !isAddress(id)) return json({ error: 'Invalid mint.' }, 400)
  try {
    return json(await assetInfo(id), 200, { 'cache-control': 'public, max-age=300' })
  } catch (e) {
    if (e instanceof RpcError) return json({ error: e.message }, 502)
    return json({ error: 'That address is not a token mint.' }, 404)
  }
}
