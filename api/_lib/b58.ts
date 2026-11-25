const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const MAP = new Map([...ALPHABET].map((c, i) => [c, BigInt(i)]))

/** Base58 decode (Solana addresses and signatures). Throws on invalid input. */
export function b58decode(s: string): Uint8Array<ArrayBuffer> {
  if (!s || s.length > 128) throw new Error('bad base58')
  let n = 0n
  for (const c of s) {
    const v = MAP.get(c)
    if (v === undefined) throw new Error('bad base58')
    n = n * 58n + v
  }
  const bytes: number[] = []
  while (n > 0n) {
    bytes.unshift(Number(n & 0xffn))
    n >>= 8n
  }
  for (const c of s) {
    if (c !== '1') break
    bytes.unshift(0)
  }
  return Uint8Array.from(bytes)
}

export const isAddress = (s: unknown): s is string => {
  if (typeof s !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)) return false
  try {
    return b58decode(s).length === 32
  } catch {
    return false
  }
}
