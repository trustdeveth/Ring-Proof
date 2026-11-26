/**
 * Helius Solana Privacy Rings (SPR) — server-side access to the indexer and the SDK's hashing.
 *
 * The indexer lives under the same Helius host as SOLANA_RPC_URL: https://<host>/v1/spr/<method>?api-key=…
 * (override with SPR_INDEXER_URL). The key never reaches the browser; the app reads through /api/spr/<method>.
 */
import { initializePoseidon, poseidon } from '@heliuslabs/spr/keypair'
import { getTreeAddress } from '@heliuslabs/spr/addresses'
import { b58decode } from './b58.js'
import { rpcUrl } from './solana.js'

/** Read-only indexer methods the app may call through the proxy. */
export const SPR_READ_METHODS = new Set([
  'getEncryptedUtxosByTags',
  'getShieldedTransactionsByTags',
  'getShieldedTransactionsByNullifiers',
  'getShieldedTransactionsBySignature',
  'getUserRecords',
  'getMerkleProofs',
  'getNonInclusionProofs',
])

/** Base indexer URL with the API key as a query parameter. */
export function sprIndexerUrl(): URL {
  if (process.env.SPR_INDEXER_URL) return new URL(process.env.SPR_INDEXER_URL)
  const rpc = new URL(rpcUrl())
  const u = new URL(`${rpc.origin}/v1/spr`)
  const key = rpc.searchParams.get('api-key')
  if (key) u.searchParams.set('api-key', key)
  return u
}

export class SprError extends Error {}

/** One JSON-RPC call to the SPR indexer. */
export async function spr<T>(method: string, params: unknown): Promise<T> {
  const base = sprIndexerUrl()
  const url = new URL(base.href)
  url.pathname = `${base.pathname.replace(/\/+$/, '')}/${method}`
  let r: Response
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new SprError('Privacy Rings indexer unreachable')
  }
  const data = (await r.json().catch(() => null)) as { result?: T; error?: { message?: string } } | null
  if (!data || data.error || data.result === undefined) throw new SprError(data?.error?.message ?? `Privacy Rings indexer error (HTTP ${r.status})`)
  return data.result
}

let ready: Promise<void> | null = null
export const poseidonReady = () => (ready ??= initializePoseidon())

export const hexToBytes = (h: string) => {
  const s = h.replace(/^0x/, '')
  if (!/^[0-9a-fA-F]*$/.test(s) || s.length % 2) throw new Error('bad hex')
  return Uint8Array.from(s.match(/../g) ?? [], (x) => parseInt(x, 16))
}
export const bytesToHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
export const bytesToBigInt = (b: Uint8Array) => b.reduce((acc, x) => (acc << 8n) | BigInt(x), 0n)
export const bigIntToBytes32 = (n: bigint) => {
  const out = new Uint8Array(32)
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(n & 0xffn)
    n >>= 8n
  }
  return out
}
/** Indexer values are base58 32-byte field elements. */
export const b58Field = (s: string) => bytesToBigInt(b58decode(s))

/** Rust `hash_bytes`: 31-byte big-endian chunks folded with Poseidon(acc, chunk). Requires poseidonReady(). */
export function hashBytes(bytes: Uint8Array): Uint8Array {
  const packed = (c: Uint8Array) => {
    const f = new Uint8Array(32)
    f.set(c, 32 - c.length)
    return f
  }
  let acc: Uint8Array = packed(bytes.subarray(0, 31))
  for (let o = 31; o < bytes.length; o += 31) acc = poseidon([acc, packed(bytes.subarray(o, o + 31))]) as Uint8Array<ArrayBuffer>
  return acc
}

/** The asset field a Ring commitment hashes: hash_bytes_32(mint), SOL = hash_bytes_32(Address::default()). */
export function assetField(mintOrSol: string): bigint {
  const bytes = mintOrSol === 'SOL' ? new Uint8Array(32) : b58decode(mintOrSol)
  return bytesToBigInt(hashBytes(bytes))
}

/** Tree id for a pool tree address (the live pool is id 0; ids are u16, we scan the first few). */
export function treeIdOf(tree: string): number | null {
  for (let id = 0; id < 16; id++) if (getTreeAddress(id) === tree) return id
  return null
}
