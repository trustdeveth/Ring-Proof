/**
 * HMAC-sealed tokens (proofs, gates, challenge nonces). Stateless: nothing is stored.
 * Key comes from PROOF_SECRET. In production a missing secret is a hard error.
 */

const enc = new TextEncoder()
type Bytes = Uint8Array<ArrayBuffer>

export function hasSecret() {
  return !!process.env.PROOF_SECRET && process.env.PROOF_SECRET.length >= 32
}

function secret(): string {
  const s = process.env.PROOF_SECRET
  if (s && s.length >= 32) return s
  if (process.env.VERCEL_ENV === 'production') throw new Error('PROOF_SECRET is missing or shorter than 32 characters')
  return 'ringproof-local-dev-secret-not-for-production-use'
}

export const b64u = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export const unb64u = (s: string): Bytes => Uint8Array.from(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64'))

async function key(purpose: string) {
  // domain-separate each token type so a gate can never be replayed as a proof
  return crypto.subtle.importKey('raw', enc.encode(`${purpose}:${secret()}`), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])
}

export async function hmac(purpose: string, data: string): Promise<Bytes> {
  return new Uint8Array(await crypto.subtle.sign('HMAC', await key(purpose), enc.encode(data)))
}

export async function seal<T extends object>(prefix: string, payload: T): Promise<string> {
  const body = enc.encode(JSON.stringify(payload))
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await key(prefix), body))
  return `${prefix}_${b64u(body)}.${b64u(sig)}`
}

export async function open<T>(prefix: string, token: string): Promise<T | null> {
  const m = token.trim().match(new RegExp(`^${prefix}_([A-Za-z0-9_-]{8,6000})\\.([A-Za-z0-9_-]{20,100})$`))
  if (!m) return null
  const body = unb64u(m[1])
  const ok = await crypto.subtle.verify('HMAC', await key(prefix), unb64u(m[2]), body)
  if (!ok) return null
  try {
    return JSON.parse(new TextDecoder().decode(body)) as T
  } catch {
    return null
  }
}

export const randomId = (bytes = 6) => b64u(crypto.getRandomValues(new Uint8Array(bytes)))
