/**
 * POST /api/spr/<method> — read-only proxy to the Helius Privacy Rings indexer, so the browser SDK can sync the
 * user's own encrypted notes without the Helius API key. Decryption happens in the browser; this only forwards
 * ciphertext. Only the read methods in SPR_READ_METHODS are allowed.
 */
import { json } from '../_lib/http.js'
import { SPR_READ_METHODS, sprIndexerUrl } from '../_lib/spr.js'

export async function POST(req: Request) {
  const method = new URL(req.url).pathname.split('/').pop() ?? ''
  if (!SPR_READ_METHODS.has(method)) return json({ error: 'Method not allowed.' }, 404)
  const body = await req.text()
  if (body.length > 256_000) return json({ error: 'Request too large.' }, 413)
  const base = sprIndexerUrl()
  const url = new URL(base.href)
  url.pathname = `${base.pathname.replace(/\/+$/, '')}/${method}`
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body, signal: AbortSignal.timeout(20_000) })
    return new Response(await r.text(), { status: r.status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
  } catch {
    return json({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'Privacy Rings indexer unreachable' } }, 502)
  }
}
