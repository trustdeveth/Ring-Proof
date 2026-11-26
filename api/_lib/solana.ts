/**
 * Minimal Solana JSON-RPC client. SOLANA_RPC_URL should be a Helius mainnet URL with your key,
 * e.g. https://mainnet.helius-rpc.com/?api-key=… (never exposed to the browser).
 */

export const SOL = 'SOL'

export function rpcUrl() {
  return process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
}
export const rpcKind = () => (/helius/i.test(rpcUrl()) ? 'helius' : process.env.SOLANA_RPC_URL ? 'custom' : 'public')

/** Transport / availability problem (502). */
export class RpcError extends Error {}
/** The RPC rejected our input — e.g. the address is not a token mint (4xx). */
export class InvalidParamError extends Error {}

export async function rpc<T>(method: string, params: unknown): Promise<T> {
  let r: Response
  try {
    r = await fetch(rpcUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(9000),
    })
  } catch {
    throw new RpcError('Solana RPC unreachable')
  }
  if (r.status === 429) throw new RpcError('Solana RPC rate limit hit — try again in a moment')
  const data = (await r.json().catch(() => null)) as { result?: T; error?: { message: string } } | null
  if (data?.error && /invalid param|not a token mint|could not find|invalid account/i.test(data.error.message))
    throw new InvalidParamError(data.error.message)
  if (!data || data.error || data.result === undefined) throw new RpcError(data?.error?.message ?? 'Solana RPC error')
  return data.result
}

export type AssetInfo = { asset: string; decimals: number; symbol: string; name?: string }

/** Validates a mint and returns decimals + best-effort metadata (Helius DAS when available). */
export async function assetInfo(asset: string): Promise<AssetInfo> {
  if (asset === SOL) return { asset: SOL, decimals: 9, symbol: 'SOL', name: 'Solana' }
  const supply = await rpc<{ value: { decimals: number } }>('getTokenSupply', [asset])
  const info: AssetInfo = { asset, decimals: supply.value.decimals, symbol: `${asset.slice(0, 4)}…${asset.slice(-4)}` }
  if (process.env.PROOF_MINT && asset === process.env.PROOF_MINT) info.symbol = '$PRHL'
  try {
    const a = await rpc<{ content?: { metadata?: { symbol?: string; name?: string } } }>('getAsset', { id: asset })
    const sym = a.content?.metadata?.symbol?.trim()
    if (sym && info.symbol !== '$PRHL') info.symbol = sym.slice(0, 16)
    if (a.content?.metadata?.name) info.name = a.content.metadata.name.slice(0, 40)
  } catch {
    /* DAS not available on this RPC — keep the short mint */
  }
  return info
}

/** Total holding in base units (lamports for SOL), across all token accounts of the mint. */
export async function holding(owner: string, asset: string): Promise<bigint> {
  if (asset === SOL) {
    const r = await rpc<{ value: number }>('getBalance', [owner, { commitment: 'confirmed' }])
    return BigInt(r.value)
  }
  const r = await rpc<{
    value: { account: { data: { parsed: { info: { tokenAmount: { amount: string }; state?: string } } } } }[]
  }>('getTokenAccountsByOwner', [owner, { mint: asset }, { encoding: 'jsonParsed', commitment: 'confirmed' }])
  let total = 0n
  for (const acc of r.value) {
    const info = acc.account.data.parsed.info
    if (info.state === 'frozen') continue
    total += BigInt(info.tokenAmount.amount)
  }
  return total
}

/** "1,000,000.5" → base units. Returns null on bad input or too many decimals. */
export function toBaseUnits(ui: string, decimals: number): bigint | null {
  const s = String(ui).replace(/,/g, '').trim()
  const m = s.match(/^(\d{1,20})(?:\.(\d+))?$/)
  if (!m) return null
  const frac = m[2] ?? ''
  if (frac.length > decimals) return null
  return BigInt(m[1]) * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, '0') || '0')
}

export function fromBaseUnits(v: bigint, decimals: number): string {
  const d = 10n ** BigInt(decimals)
  const int = v / d
  const frac = (v % d).toString().padStart(decimals, '0').replace(/0+$/, '')
  return frac ? `${int}.${frac}` : `${int}`
}
