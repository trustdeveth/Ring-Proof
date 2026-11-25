import { useSyncExternalStore } from 'react'

/**
 * What this browser remembers for a wallet: the proofs it issued and the gates it created.
 * Balances are never stored — they are read live from Solana.
 */

export type ProofRecord = {
  id: string
  code: string
  asset: string
  symbol: string
  min: string
  createdAt: number
  expiresAt: number
  gateId?: string
  gateName?: string
}

export type GateRecord = {
  id: string
  token: string
  name: string
  asset: string
  symbol: string
  min: string
  platform: 'telegram' | 'discord'
  room: string
  createdAt: number
}

export type WalletState = { proofs: ProofRecord[]; gates: GateRecord[] }

const fresh = (): WalletState => ({ proofs: [], gates: [] })
const KEY = (owner: string) => `ringproof.v2.${owner}`
const cache = new Map<string, WalletState>()
const listeners = new Set<() => void>()

function load(owner: string): WalletState {
  const hit = cache.get(owner)
  if (hit) return hit
  let s = fresh()
  try {
    const raw = localStorage.getItem(KEY(owner))
    if (raw) {
      const parsed = JSON.parse(raw)
      s = { proofs: Array.isArray(parsed.proofs) ? parsed.proofs : [], gates: Array.isArray(parsed.gates) ? parsed.gates : [] }
    }
  } catch {
    /* storage unavailable: memory only */
  }
  cache.set(owner, s)
  return s
}

export function update(owner: string, fn: (s: WalletState) => WalletState) {
  const next = fn(load(owner))
  cache.set(owner, next)
  try {
    localStorage.setItem(KEY(owner), JSON.stringify(next))
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

const EMPTY = fresh()
export function useWalletState(owner: string | null): WalletState {
  return useSyncExternalStore(subscribe, () => (owner ? load(owner) : EMPTY))
}
