import { update, type GateRecord, type ProofRecord } from './store'
import type { Asset } from './tokens'

/**
 * RingProof client — production.
 *
 * Proofs are attestations: the wallet signs a one-time challenge, the RingProof server reads
 * the wallet's real on-chain balance and, if it meets the claim, seals a proof that names the
 * claim only. Verifiers never learn the wallet. (The server sees it during the check and stores
 * nothing.) Zero-knowledge proofs over Helius Privacy Rings replace this step later.
 */

export type Step = { label: string; detail?: string }
export type ProgressFn = (stepIndex: number) => void

export const PROOF_STEPS: Step[] = [
  { label: 'Request challenge', detail: 'one-time, expires in 5 minutes' },
  { label: 'Sign in wallet', detail: 'not a transaction · free' },
  { label: 'Check on-chain balance', detail: 'read live from Solana' },
  { label: 'Seal proof', detail: 'claim only — no wallet inside' },
]

export class ClientError extends Error {
  constructor(
    public code: 'INSUFFICIENT' | 'REJECTED' | 'NO_SIGN' | 'BAD_INPUT' | 'NETWORK',
    message: string,
  ) {
    super(message)
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let r: Response
  try {
    r = await fetch(path, { ...init, headers: { 'content-type': 'application/json', ...init?.headers } })
  } catch {
    throw new ClientError('NETWORK', 'Could not reach the RingProof server. Check your connection.')
  }
  const data = (await r.json().catch(() => ({}))) as { error?: string; code?: string }
  if (!r.ok) {
    if (data.code === 'INSUFFICIENT') throw new ClientError('INSUFFICIENT', data.error ?? 'Balance too low.')
    throw new ClientError(r.status >= 500 ? 'NETWORK' : 'BAD_INPUT', data.error ?? `Server error (${r.status}).`)
  }
  return data as T
}

/* ------------------------------------------------------------------ */
/* config, assets, balances                                            */
/* ------------------------------------------------------------------ */

export type AppConfig = { proofMint: string | null; network: string }
let configPromise: Promise<AppConfig> | null = null
export const getConfig = () => (configPromise ??= api<AppConfig>('/api/config').catch(() => ({ proofMint: null, network: 'mainnet' })))

const assetCache = new Map<string, Promise<Asset>>()
export function getAsset(id: string): Promise<Asset> {
  let p = assetCache.get(id)
  if (!p) {
    p = api<Asset>(`/api/asset?id=${encodeURIComponent(id)}`)
    p.catch(() => assetCache.delete(id))
    assetCache.set(id, p)
  }
  return p
}

export type Balance = Asset & { amount: string }
export async function getBalances(owner: string, extra?: string): Promise<Balance[]> {
  const q = new URLSearchParams({ owner })
  if (extra) q.set('asset', extra)
  return (await api<{ balances: Balance[] }>(`/api/balance?${q}`)).balances
}

/* ------------------------------------------------------------------ */
/* proofs                                                              */
/* ------------------------------------------------------------------ */

export type ProofRequest = { asset: Asset; min: string; expiryDays: 1 | 7 | 30; gateToken?: string }

type ProofPayload = { id: string; a: string; s: string; m: string; iat: number; exp: number; g?: string; gn?: string }

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))

export async function generateProof(
  owner: string,
  signMessage: ((m: Uint8Array) => Promise<Uint8Array>) | undefined,
  req: ProofRequest,
  onStep: ProgressFn,
): Promise<ProofRecord> {
  if (!signMessage) throw new ClientError('NO_SIGN', 'This wallet cannot sign messages. Try Phantom, Solflare or Backpack.')
  if (!(Number(req.min) > 0)) throw new ClientError('BAD_INPUT', 'Pick an amount above zero.')

  onStep(0)
  const ch = await api<{ ts: number; nonce: string; message: string }>('/api/challenge', {
    method: 'POST',
    body: JSON.stringify({ owner }),
  })

  onStep(1)
  let signature: Uint8Array
  try {
    signature = await signMessage(new TextEncoder().encode(ch.message))
  } catch {
    throw new ClientError('REJECTED', 'Signature request was declined in your wallet.')
  }

  onStep(2)
  const res = await api<{ code: string; proof: ProofPayload }>('/api/attest', {
    method: 'POST',
    body: JSON.stringify({
      owner,
      ts: ch.ts,
      nonce: ch.nonce,
      signature: toB64(signature),
      asset: req.asset.asset,
      min: req.min,
      expiryDays: req.expiryDays,
      gate: req.gateToken,
    }),
  })

  onStep(3)
  const p = res.proof
  const rec: ProofRecord = {
    id: p.id,
    code: res.code,
    asset: p.a,
    symbol: p.s,
    min: p.m,
    createdAt: p.iat,
    expiresAt: p.exp,
    gateId: p.g,
    gateName: p.gn,
  }
  update(owner, (st) => ({ ...st, proofs: [rec, ...st.proofs].slice(0, 100) }))
  onStep(PROOF_STEPS.length)
  return rec
}

export function forgetProof(owner: string, proofId: string) {
  update(owner, (st) => ({ ...st, proofs: st.proofs.filter((p) => p.id !== proofId) }))
}

export type VerifyResult =
  | ({ ok: true } & ProofPayload)
  | { ok: false; reason: string }

export async function verifyProof(code: string): Promise<VerifyResult> {
  const [res] = await Promise.all([
    api<VerifyResult>('/api/verify', { method: 'POST', body: JSON.stringify({ code: code.trim() }) }),
    new Promise((r) => setTimeout(r, 700)),
  ])
  return res
}

export function claimText(p: { symbol: string; min: string }) {
  return `Holds ≥ ${Number(p.min).toLocaleString('en-US', { maximumFractionDigits: 9 })} ${p.symbol}`
}

/* ------------------------------------------------------------------ */
/* gates                                                               */
/* ------------------------------------------------------------------ */

type GatePayload = { id: string; name: string; a: string; s: string; m: string; platform: 'telegram' | 'discord'; room: string; iat: number }

export async function createGate(
  owner: string,
  g: { name: string; asset: Asset; min: string; platform: 'telegram' | 'discord'; room: string },
): Promise<GateRecord> {
  const res = await api<{ token: string; gate: GatePayload }>('/api/gate', {
    method: 'POST',
    body: JSON.stringify({ name: g.name, asset: g.asset.asset, min: g.min, platform: g.platform, room: g.room }),
  })
  const rec: GateRecord = {
    id: res.gate.id,
    token: res.token,
    name: res.gate.name,
    asset: res.gate.a,
    symbol: res.gate.s,
    min: res.gate.m,
    platform: res.gate.platform,
    room: res.gate.room,
    createdAt: res.gate.iat,
  }
  update(owner, (st) => ({ ...st, gates: [rec, ...st.gates] }))
  return rec
}

export function forgetGate(owner: string, id: string) {
  update(owner, (st) => ({ ...st, gates: st.gates.filter((g) => g.id !== id) }))
}

/** Reads a gate token's rule for display. The server re-checks the signature when a proof is issued. */
export function peekGate(token: string): GatePayload | null {
  const m = token.match(/^rg1_([A-Za-z0-9_-]+)\./)
  if (!m) return null
  try {
    const json = atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = Uint8Array.from(json, (c) => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

export const gateLink = (token: string) => `${window.location.origin}/app/prove?gate=${encodeURIComponent(token)}`

export const BOT_HANDLE = 'RingProofBot'
export const botLink = (payload: string) => `https://t.me/${BOT_HANDLE}?start=${payload.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64)}`
