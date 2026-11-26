import { json, readJson } from './_lib/http.js'
import { checkProof } from './_lib/proof.js'

/** POST /api/verify { code } — returns the claim only, never a wallet or balance. */
export async function POST(req: Request) {
  const b = await readJson<{ code?: string }>(req)
  if (!b || typeof b.code !== 'string' || b.code.length > 6000) return json({ error: 'Send { code }.' }, 400)
  const r = await checkProof(b.code)
  return r.ok ? json({ ok: true, ...r.proof }) : json({ ok: false, reason: r.reason })
}
