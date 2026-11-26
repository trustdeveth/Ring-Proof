import { open } from './seal.js'
import type { GatePayload, ProofPayload } from './types.js'

export type Checked = { ok: true; proof: ProofPayload } | { ok: false; reason: string }

/** Full check of a proof code: seal, version, expiry. Returns the claim only. */
export async function checkProof(code: string): Promise<Checked> {
  const c = code.trim()
  if (!c.startsWith('rp2_')) return { ok: false, reason: 'Not a Parhelion proof. It should start with rp2_.' }
  const p = await open<ProofPayload>('rp2', c)
  if (!p) return { ok: false, reason: 'Signature check failed. This proof was altered or forged.' }
  if (p.v !== 2) return { ok: false, reason: 'Unsupported proof version.' }
  if (p.exp < Date.now()) return { ok: false, reason: 'This proof has expired.' }
  return { ok: true, proof: p }
}

export const openGate = (token: string) => open<GatePayload>('rg1', token)

/** a >= b for non-negative decimal strings ("1000000", "0.5"). */
export function decGte(a: string, b: string) {
  const norm = (s: string) => {
    const [i = '0', f = ''] = s.replace(/,/g, '').split('.')
    return [i.replace(/^0+(?=\d)/, ''), f.replace(/0+$/, '')] as const
  }
  const [ai, af] = norm(a)
  const [bi, bf] = norm(b)
  if (ai.length !== bi.length) return ai.length > bi.length
  if (ai !== bi) return ai > bi
  const n = Math.max(af.length, bf.length)
  return af.padEnd(n, '0') >= bf.padEnd(n, '0')
}

/** Does this proof satisfy this gate? Proofs made through the gate link match by ID; others by token + amount. */
export const meetsGate = (p: ProofPayload, g: GatePayload) => p.g === g.id || (p.a === g.a && decGte(p.m, g.m))

export const claim = (p: { s: string; m: string }) => `holds ≥ ${Number(p.m).toLocaleString('en-US', { maximumFractionDigits: 9 })} ${p.s}`
