/**
 * GET  /api/fee  → current gate fee + a fresh blockhash, so the app can build the fee transaction.
 * POST /api/fee  { tx } → relays the wallet-signed fee transaction to Solana (only transactions that pay this fee).
 */
import { json, readJson } from './_lib/http.js'
import { feeConfig } from './_lib/fees.js'
import { RpcError, rpc } from './_lib/solana.js'
import { b58decode } from './_lib/b58.js'

export async function GET() {
  try {
    const cfg = await feeConfig()
    if (!cfg) return json({ enabled: false })
    const bh = await rpc<{ value: { blockhash: string; lastValidBlockHeight: number } }>('getLatestBlockhash', [{ commitment: 'confirmed' }])
    return json({
      enabled: true,
      mint: cfg.mint,
      symbol: cfg.symbol,
      decimals: cfg.decimals,
      tokenProgram: cfg.tokenProgram,
      treasury: cfg.treasury,
      fee: cfg.fee.toString(),
      burn: cfg.burn.toString(),
      toTreasury: cfg.toTreasury.toString(),
      feeUi: cfg.feeUi,
      burnBps: cfg.burnBps,
      blockhash: bh.value.blockhash,
      lastValidBlockHeight: bh.value.lastValidBlockHeight,
    })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Fee config error' }, 502)
  }
}

const contains = (hay: Uint8Array, needle: Uint8Array) => {
  outer: for (let i = 0; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer
    return true
  }
  return false
}

export async function POST(req: Request) {
  const b = await readJson<{ tx?: string }>(req)
  if (!b || typeof b.tx !== 'string' || b.tx.length > 2400) return json({ error: 'Send { tx }.' }, 400)
  const cfg = await feeConfig().catch(() => null)
  if (!cfg) return json({ error: 'Gate fees are not enabled.' }, 400)
  const raw = Uint8Array.from(Buffer.from(b.tx, 'base64'))
  // relay only transactions that touch the $PRHL mint and the treasury — not a general-purpose RPC proxy
  if (!contains(raw, b58decode(cfg.mint)) || !contains(raw, b58decode(cfg.treasury))) return json({ error: 'Not a gate fee transaction.' }, 400)
  try {
    const signature = await rpc<string>('sendTransaction', [b.tx, { encoding: 'base64', preflightCommitment: 'confirmed', maxRetries: 5 }])
    return json({ signature })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'send failed'
    const insufficient = /insufficient (funds|lamports)|0x1\b/i.test(msg)
    return json({ error: insufficient ? `Not enough ${cfg.symbol} (or SOL for the network fee) in this wallet.` : `Transaction rejected: ${msg}` }, e instanceof RpcError ? 422 : 502)
  }
}
