/**
 * Builds the $PRHL gate-fee transaction in the browser. One transaction, signed by the user's wallet:
 *   1. create the treasury's token account if it does not exist yet (idempotent, paid by the user)
 *   2. transferChecked: fee − burn  → treasury
 *   3. burnChecked:     burn share  → destroyed on-chain
 *   4. memo "Parhelion gate fee"
 * Written against the raw SPL Token instruction layouts (same for Token and Token-2022), no extra dependency.
 */
import { Buffer } from 'buffer'
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js'

export type FeeQuote = {
  enabled: true
  mint: string
  symbol: string
  decimals: number
  tokenProgram: string
  treasury: string
  fee: string
  burn: string
  toTreasury: string
  feeUi: string
  burnBps: number
  blockhash: string
  lastValidBlockHeight: number
}

const ATA_PROGRAM = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

export const ata = (owner: PublicKey, mint: PublicKey, tokenProgram: PublicKey) =>
  PublicKey.findProgramAddressSync([owner.toBuffer(), tokenProgram.toBuffer(), mint.toBuffer()], ATA_PROGRAM)[0]

function amountIx(tag: number, amount: bigint, decimals: number) {
  const data = new Uint8Array(10)
  data[0] = tag
  new DataView(data.buffer).setBigUint64(1, amount, true)
  data[9] = decimals
  return data
}

export function buildFeeTx(payer: PublicKey, q: FeeQuote): Transaction {
  const mint = new PublicKey(q.mint)
  const program = new PublicKey(q.tokenProgram)
  const treasury = new PublicKey(q.treasury)
  const from = ata(payer, mint, program)
  const to = ata(treasury, mint, program)
  const tx = new Transaction({ feePayer: payer, blockhash: q.blockhash, lastValidBlockHeight: q.lastValidBlockHeight })

  // CreateIdempotent (ATA instruction 1)
  tx.add(
    new TransactionInstruction({
      programId: ATA_PROGRAM,
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: to, isSigner: false, isWritable: true },
        { pubkey: treasury, isSigner: false, isWritable: false },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: program, isSigner: false, isWritable: false },
      ],
      data: Buffer.from([1]),
    }),
  )
  const toTreasury = BigInt(q.toTreasury)
  if (toTreasury > 0n)
    // TransferChecked (12): source, mint, destination, owner
    tx.add(
      new TransactionInstruction({
        programId: program,
        keys: [
          { pubkey: from, isSigner: false, isWritable: true },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: to, isSigner: false, isWritable: true },
          { pubkey: payer, isSigner: true, isWritable: false },
        ],
        data: Buffer.from(amountIx(12, toTreasury, q.decimals)),
      }),
    )
  const burn = BigInt(q.burn)
  if (burn > 0n)
    // BurnChecked (15): account, mint, owner
    tx.add(
      new TransactionInstruction({
        programId: program,
        keys: [
          { pubkey: from, isSigner: false, isWritable: true },
          { pubkey: mint, isSigner: false, isWritable: true },
          { pubkey: payer, isSigner: true, isWritable: false },
        ],
        data: Buffer.from(amountIx(15, burn, q.decimals)),
      }),
    )
  tx.add(new TransactionInstruction({ programId: MEMO_PROGRAM, keys: [{ pubkey: payer, isSigner: true, isWritable: false }], data: Buffer.from('Parhelion gate fee') }))
  return tx
}
