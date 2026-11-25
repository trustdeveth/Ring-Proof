import { json } from './_lib/http.js'
import { isAddress } from './_lib/b58.js'

/** GET /api/config — public app config. */
export function GET() {
  const mint = process.env.PROOF_MINT
  return json(
    { proofMint: mint && isAddress(mint) ? mint : null, network: 'mainnet' },
    200,
    { 'cache-control': 'public, max-age=60' },
  )
}
