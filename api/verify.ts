import { json, readJson } from './_lib/http.js'
import { open } from './_lib/seal.js'
import type { ProofPayload } from './_lib/types.js'

/** POST /api/verify { code } — returns the claim only, never a wallet or balance. */
export async function POST(req: Request) {
  const b = await readJson<{ code?: string }>(req)
  if (!b || typeof b.code !== 'string' || b.code.length > 6000) return json({ error: 'Send { code }.' }, 400)
  const code = b.code.trim()
  if (!code.startsWith('rp2_')) return json({ ok: false, reason: 'Not a RingProof proof. It should start with rp2_.' })
  const p = await open<ProofPayload>('rp2', code)
  if (!p) return json({ ok: false, reason: 'Signature check failed. This proof was altered or forged.' })
  if (p.v !== 2) return json({ ok: false, reason: 'Unsupported proof version.' })
  if (p.exp < Date.now()) return json({ ok: false, reason: 'This proof has expired.' })
  return json({ ok: true, ...p })
}
