export const SOL = 'SOL'

/** A provable asset: native SOL or an SPL / Token-2022 mint. */
export type Asset = { asset: string; symbol: string; decimals: number; name?: string }

export const SOL_ASSET: Asset = { asset: SOL, symbol: 'SOL', decimals: 9, name: 'Solana' }

export const isAddress = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)

/** Quick-pick thresholds per asset. */
export function presetsFor(a: Asset): number[] {
  if (a.asset === SOL) return [1, 10, 100]
  if (a.symbol === '$PROOF') return [100_000, 1_000_000, 10_000_000]
  return [100, 1_000, 10_000]
}

export function fmt(n: number | string, max = 4) {
  const v = typeof n === 'string' ? Number(n) : n
  if (!Number.isFinite(v)) return String(n)
  const digits = v >= 1000 ? 0 : v >= 1 ? Math.min(2, max) : max
  return v.toLocaleString('en-US', { maximumFractionDigits: digits })
}

export function short(addr: string, n = 4) {
  return addr.length > n * 2 + 1 ? `${addr.slice(0, n)}…${addr.slice(-n)}` : addr
}
