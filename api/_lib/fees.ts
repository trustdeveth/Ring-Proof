/**
 * $PRHL gate fees. When PROOF_MINT, GATE_FEE and TREASURY_WALLET are set, creating a gate costs GATE_FEE $PRHL,
 * paid in ONE wallet transaction that sends part to the treasury and burns the rest on-chain (GATE_FEE_BURN_BPS,
 * default 50%). The burn happens in the payer's own transaction, so no server key ever holds or moves tokens.
 */
import { isAddress } from './b58.js'
import { assetInfo, rpc, toBaseUnits } from './solana.js'

export const TOKEN_PROGRAMS = {
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: 'spl-token',
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: 'spl-token-2022',
} as const

export type FeeConfig = {
  mint: string
  symbol: string
  decimals: number
  tokenProgram: string
  treasury: string
  fee: bigint
  burn: bigint
  toTreasury: bigint
  feeUi: string
  burnBps: number
}

const burnBps = () => {
  const n = Number(process.env.GATE_FEE_BURN_BPS ?? 5000)
  return Number.isInteger(n) && n >= 0 && n <= 10000 ? n : 5000
}

export function feesOn() {
  const { PROOF_MINT: mint, GATE_FEE: fee, TREASURY_WALLET: t } = process.env
  return !!(mint && isAddress(mint) && t && isAddress(t) && fee && Number(fee.replace(/,/g, '')) > 0)
}

let cached: { at: number; cfg: FeeConfig } | null = null
export async function feeConfig(): Promise<FeeConfig | null> {
  if (!feesOn()) return null
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.cfg
  const mint = process.env.PROOF_MINT!
  const [info, acct] = await Promise.all([
    assetInfo(mint),
    rpc<{ value: { owner: string } | null }>('getAccountInfo', [mint, { encoding: 'base64', dataSlice: { offset: 0, length: 0 } }]),
  ])
  const tokenProgram = acct.value?.owner ?? ''
  if (!(tokenProgram in TOKEN_PROGRAMS)) throw new Error('PROOF_MINT is not an SPL token mint')
  const fee = toBaseUnits(process.env.GATE_FEE!, info.decimals)
  if (!fee || fee <= 0n) throw new Error('GATE_FEE is invalid for this mint')
  const bps = burnBps()
  const burn = (fee * BigInt(bps)) / 10000n
  const cfg: FeeConfig = {
    mint,
    symbol: info.symbol,
    decimals: info.decimals,
    tokenProgram,
    treasury: process.env.TREASURY_WALLET!,
    fee,
    burn,
    toTreasury: fee - burn,
    feeUi: process.env.GATE_FEE!.replace(/,/g, ''),
    burnBps: bps,
  }
  cached = { at: Date.now(), cfg }
  return cfg
}

type ParsedIx = { program?: string; programId: string; parsed?: { type: string; info: Record<string, unknown> } }
type ParsedTx = {
  blockTime: number | null
  meta: { err: unknown; postTokenBalances?: { accountIndex: number; mint: string; owner?: string }[] } | null
  transaction: { message: { accountKeys: { pubkey: string }[]; instructions: ParsedIx[] } }
}

export type FeeCheck = { ok: true; burned: bigint } | { ok: false; pending?: boolean; reason: string }

/** Confirms a fee transaction on-chain: succeeded, recent, paid the treasury share, burned the burn share. */
export async function checkFeeTx(signature: string, cfg: FeeConfig): Promise<FeeCheck> {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(signature)) return { ok: false, reason: 'Invalid fee transaction.' }
  const tx = await rpc<ParsedTx | null>('getTransaction', [
    signature,
    { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 },
  ])
  if (!tx) return { ok: false, pending: true, reason: 'Fee transaction not confirmed yet.' }
  if (tx.meta?.err) return { ok: false, reason: 'The fee transaction failed on-chain.' }
  if (!tx.blockTime || Date.now() / 1000 - tx.blockTime > 24 * 3600) return { ok: false, reason: 'Fee transaction is too old.' }

  const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey)
  const ownerOf = new Map<string, string | undefined>()
  for (const b of tx.meta?.postTokenBalances ?? []) if (b.mint === cfg.mint) ownerOf.set(keys[b.accountIndex], b.owner)

  let paid = 0n
  let burned = 0n
  for (const ix of tx.transaction.message.instructions) {
    if (ix.programId !== cfg.tokenProgram || !ix.parsed) continue
    const { type, info } = ix.parsed
    const amount = BigInt(String((info.tokenAmount as { amount?: string } | undefined)?.amount ?? info.amount ?? '0'))
    if (info.mint !== undefined && info.mint !== cfg.mint) continue
    if ((type === 'transferChecked' || type === 'transfer') && ownerOf.get(String(info.destination)) === cfg.treasury) paid += amount
    if ((type === 'burnChecked' || type === 'burn') && (info.mint === cfg.mint || ownerOf.has(String(info.account)))) burned += amount
  }
  if (paid < cfg.toTreasury) return { ok: false, reason: 'The fee payment to the treasury is missing or too small.' }
  if (burned < cfg.burn) return { ok: false, reason: 'The fee burn is missing or too small.' }
  return { ok: true, burned }
}
