import { json } from './http.js'
import { isAddress } from './b58.js'
import { CHALLENGE_TTL_MS, challengeMessage, domainOf, makeNonce, verifyWalletSignature } from './challenge.js'

export type SignedChallenge = { owner: string; ts: number; nonce: string; signature: string }

/** Checks the wallet signed our one-time challenge. Returns an error Response, or null when the owner is proven. */
export async function checkOwnership(req: Request, b: Partial<SignedChallenge>): Promise<Response | null> {
  if (!isAddress(b.owner)) return json({ error: 'Invalid wallet address.' }, 400)
  if (typeof b.ts !== 'number' || typeof b.nonce !== 'string' || typeof b.signature !== 'string')
    return json({ error: 'Missing signature.' }, 400)
  if (Date.now() - b.ts > CHALLENGE_TTL_MS || b.ts > Date.now() + 30_000) return json({ error: 'Signature request expired. Try again.' }, 401)
  const domain = domainOf(req)
  if ((await makeNonce(b.owner, domain, b.ts)) !== b.nonce) return json({ error: 'Invalid challenge.' }, 401)
  if (!verifyWalletSignature(b.owner, challengeMessage(b.owner, domain, b.nonce, b.ts), b.signature))
    return json({ error: 'Wallet signature check failed.' }, 401)
  return null
}
