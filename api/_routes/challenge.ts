import { json, readJson } from '../_lib/http.js'
import { isAddress } from '../_lib/b58.js'
import { challengeMessage, domainOf, makeNonce } from '../_lib/challenge.js'

/** POST /api/challenge { owner } → the exact message the wallet must sign. */
export async function POST(req: Request) {
  const b = await readJson<{ owner?: string }>(req)
  if (!b || !isAddress(b.owner)) return json({ error: 'Send a valid wallet address.' }, 400)
  const ts = Date.now()
  const domain = domainOf(req)
  const nonce = await makeNonce(b.owner, domain, ts)
  return json({ ts, nonce, message: challengeMessage(b.owner, domain, nonce, ts) })
}
