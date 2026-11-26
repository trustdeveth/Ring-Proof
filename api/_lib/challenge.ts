import { createPublicKey, verify } from 'node:crypto'
import { b58decode } from './b58.js'
import { b64u, hmac } from './seal.js'

/**
 * Sign-in-style ownership challenge. Stateless: the nonce is an HMAC of (owner, domain, ts),
 * so the server can re-derive and check it without storing anything. Valid for 5 minutes.
 */

export const CHALLENGE_TTL_MS = 5 * 60_000

export async function makeNonce(owner: string, domain: string, ts: number) {
  return b64u(await hmac('nonce', `${owner}|${domain}|${ts}`)).slice(0, 24)
}

export function challengeMessage(owner: string, domain: string, nonce: string, ts: number) {
  return [
    `${domain} wants you to prove you control this Solana wallet.`,
    '',
    `Wallet: ${owner}`,
    'Purpose: issue a Parhelion holder proof',
    `Nonce: ${nonce}`,
    `Issued At: ${new Date(ts).toISOString()}`,
    '',
    'This is not a transaction. It costs nothing and moves no funds.',
  ].join('\n')
}

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

export function verifyWalletSignature(owner: string, message: string, signatureB64: string): boolean {
  try {
    const pub = b58decode(owner)
    const sig = Buffer.from(signatureB64, 'base64')
    if (pub.length !== 32 || sig.length !== 64) return false
    const key = createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(pub)]), format: 'der', type: 'spki' })
    return verify(null, Buffer.from(message, 'utf8'), key, sig)
  } catch {
    return false
  }
}

/** Domain the message is bound to — the host the request was sent to. */
export function domainOf(req: Request) {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'parhelion'
  return host.split(',')[0].trim().slice(0, 100)
}
