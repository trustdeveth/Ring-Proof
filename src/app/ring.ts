/**
 * Helius Privacy Rings in the browser (Phase 3). Loaded lazily — only when the user picks a Ring source.
 *
 * 1. The wallet signs the SDK's key-derivation message (Solana off-chain message v0, "TSPP/derive/v1").
 *    The 64-byte signature is the derivation seed: it never leaves this tab and is wiped after use.
 * 2. The SDK derives the Ring viewing + nullifier keys locally and syncs the user's encrypted notes through
 *    Parhelion's read-only indexer proxy (/api/spr/*), decrypting them here.
 * 3. For a proof, only the openings of the unspent notes needed + the nullifier secret are sent to
 *    /api/ring-attest. The spending key stays in the wallet; the nullifier secret cannot authorize a spend.
 */
import { SprClient } from '@heliuslabs/spr/client'
import { getPrivateTokenBalances, syncWallet } from '@heliuslabs/spr/wallet'
import { LocalShieldedKeys, SOL_MINT, Wallet } from '@heliuslabs/spr/transaction'
import { NullifierKey, ed25519DerivationMessage, initializePoseidon } from '@heliuslabs/spr/keypair'
import type { Address } from '@heliuslabs/spr'
import { hkdf } from '@noble/hashes/hkdf.js'
import { ed25519 } from '@noble/curves/ed25519.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { PublicKey } from '@solana/web3.js'
import { ClientError, api, recordProof, signChallenge, type ProofPayload } from './client'
import type { ProofRecord } from './store'

/** A wallet signer that also reports the exact bytes it signed (Wallet Standard `signedMessage`). */
export type DetailedSigner = (m: Uint8Array) => Promise<{ signature: Uint8Array; signedMessage: Uint8Array }>

export type RingSession = {
  owner: string
  client: SprClient
  wallet: Wallet
  keys: LocalShieldedKeys
  /** 31 bytes, derived from the seed exactly as the SDK does: HKDF(seed) → "TSPP/nf_key/ed25519/v1". */
  nullifierSecret: Uint8Array
  syncedAt: number
}

export type RingBalance = { mint: string; amount: bigint }

export type RingNoteOpening = {
  tree: string
  leafIndex: string
  hash: string
  amount: string
  blinding: string
  dataHash?: string
  ringDataHash?: string
  ringProgramId?: string
}

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
const enc = new TextEncoder()
let session: RingSession | null = null

function makeClient() {
  const origin = window.location.origin
  return new SprClient({
    // sync never sends Solana transactions; the public endpoint is only a required placeholder
    solanaRpcUrl: 'https://api.mainnet-beta.solana.com',
    indexerUrl: `${origin}/api/spr`,
    proverUrl: `${origin}/api/spr`,
    allowInsecureHttp: origin.startsWith('http://'),
  } as ConstructorParameters<typeof SprClient>[0])
}

/** Opens (or reuses) the Ring session for this wallet. Asks the wallet for one signature the first time. */
export async function openRing(
  owner: string,
  signMessage: ((m: Uint8Array) => Promise<Uint8Array>) | undefined,
  signDetailed?: DetailedSigner,
  walletName?: string,
): Promise<RingSession> {
  if (session?.owner === owner) return session
  if (!signMessage && !signDetailed) throw new ClientError('NO_SIGN', 'This wallet cannot sign messages. Try Phantom, Solflare or Backpack.')
  await initializePoseidon()
  const pub = new PublicKey(owner).toBytes()
  const message = ed25519DerivationMessage(pub as never)
  let seed: Uint8Array
  let signed: Uint8Array = message
  try {
    if (signDetailed) {
      const out = await signDetailed(message)
      seed = out.signature
      signed = out.signedMessage
    } else seed = await signMessage!(message)
  } catch (e) {
    const who = walletName ?? 'Your wallet'
    const raw = e instanceof Error ? e.message : String(e ?? '')
    const code = (e as { code?: number; error?: { code?: number } })?.code ?? (e as { error?: { code?: number } })?.error?.code
    if (code === 4001 || /reject|denied|declined|cancel/i.test(raw))
      throw new ClientError('REJECTED', 'The Privacy Ring key request was declined in your wallet.')
    throw new ClientError(
      'NO_SIGN',
      `${who} refused to sign the Ring key message${raw ? `: "${raw.slice(0, 160)}"` : ''}. It is a Solana off-chain message (first byte 0xFF), which this wallet treats as a transaction and blocks.`,
    )
  }
  const who = walletName ?? 'This wallet'
  if (seed.length !== 64) throw new ClientError('NO_SIGN', `${who} returned a ${seed.length}-byte signature for the Ring key; 64 bytes are required.`)

  // The SDK only accepts a signature over these exact bytes. Find out what the wallet did instead.
  if (!ed25519.verify(seed, message, pub)) {
    const same = signed.length === message.length && signed.every((b, i) => b === message[i])
    const wrapped = !same && ed25519.verify(seed, signed, pub)
    seed.fill(0)
    if (wrapped)
      throw new ClientError(
        'NO_SIGN',
        `${who} changed the Ring key message before signing it (it signed ${signed.length} bytes instead of ${message.length}; first bytes ${hex(signed.subarray(0, 8))} vs ${hex(message.subarray(0, 8))}). Helius Privacy Rings needs a wallet that signs Solana off-chain messages exactly as given.`,
      )
    throw new ClientError(
      'NO_SIGN',
      `${who}'s signature does not match the Ring key message (the wallet signed something else). Helius Privacy Rings needs a wallet that signs Solana off-chain messages exactly as given.`,
    )
  }

  let keys: LocalShieldedKeys
  try {
    keys = LocalShieldedKeys.fromDerivationSeed({ solanaPublicKey: owner as Address, derivationSeed: seed })
  } catch (e) {
    seed.fill(0)
    const code = (e as { code?: string })?.code
    throw new ClientError('NO_SIGN', `The Privacy Rings SDK rejected the Ring key${code ? ` (${code})` : ''}: ${e instanceof Error ? e.message : 'unknown error'}`)
  }
  const prk = hkdf(sha256, seed, new Uint8Array(0), enc.encode('TSPP/nf_key/ed25519/v1'), 31)
  seed.fill(0)
  // self-check: our nullifier secret must match the key the SDK derived
  const nk = NullifierKey.fromSecret(prk as never)
  const same = hex(nk.publicKey()) === hex(keys.address().nullifierPublicKey)
  nk.destroy()
  if (!same) {
    prk.fill(0)
    throw new ClientError('NETWORK', 'Ring key self-check failed (SDK derivation changed). Please update Parhelion.')
  }

  const client = makeClient()
  const wallet = new Wallet({ identity: keys.address() })
  session = { owner, client, wallet, keys, nullifierSecret: prk, syncedAt: 0 }
  return session
}

/** Forgets the Ring session (keys wiped). */
export function closeRing() {
  session?.nullifierSecret.fill(0)
  session = null
}

export async function syncRing(s: RingSession) {
  try {
    await syncWallet({ client: s.client, wallet: s.wallet, keys: s.keys })
  } catch (e) {
    throw new ClientError('NETWORK', `Could not read your Privacy Ring: ${e instanceof Error ? e.message : 'indexer error'}`)
  }
  s.syncedAt = Date.now()
}

export function ringBalances(s: RingSession): RingBalance[] {
  return getPrivateTokenBalances(s.wallet).map((b) => ({ mint: b.mint === SOL_MINT ? 'SOL' : b.mint, amount: b.amount }))
}

/** Unspent, default-ring notes of one asset, largest first. */
export function unspentNotes(s: RingSession, asset: string) {
  const mint = asset === 'SOL' ? SOL_MINT : asset
  return s.wallet
    .utxos()
    .filter((u) => !u.spent && u.utxo.asset === mint && !u.utxo.ringProgramId && u.utxo.amount > 0n)
    .sort((a, b) => (b.utxo.amount > a.utxo.amount ? 1 : b.utxo.amount < a.utxo.amount ? -1 : 0))
}

/** Picks the fewest largest notes that reach `min` (base units). */
export function pickNotes<T extends { utxo: { amount: bigint } }>(notes: T[], min: bigint, max: number): T[] | null {
  const out: T[] = []
  let sum = 0n
  for (const n of notes) {
    if (out.length === max) break
    out.push(n)
    sum += n.utxo.amount
    if (sum >= min) return out
  }
  return null
}

export function opening(u: ReturnType<typeof unspentNotes>[number]): RingNoteOpening {
  return {
    tree: u.outputContext.tree,
    leafIndex: u.outputContext.leafIndex.toString(),
    hash: hex(u.outputContext.hash),
    amount: u.utxo.amount.toString(),
    blinding: hex(u.utxo.blinding),
    ...(u.dataHash ? { dataHash: hex(u.dataHash) } : {}),
    ...(u.ringDataHash ? { ringDataHash: hex(u.ringDataHash) } : {}),
    ...(u.utxo.ringProgramId ? { ringProgramId: u.utxo.ringProgramId } : {}),
  }
}

export const toBase = (ui: string, decimals: number) => {
  const [i, f = ''] = ui.replace(/,/g, '').split('.')
  return BigInt(i || '0') * 10n ** BigInt(decimals) + BigInt((f + '0'.repeat(decimals)).slice(0, decimals) || '0')
}

/** Phase 3: attested proof over the Ring balance. */
export async function proveFromRing(
  owner: string,
  signMessage: ((m: Uint8Array) => Promise<Uint8Array>) | undefined,
  signDetailed: DetailedSigner | undefined,
  walletName: string | undefined,
  req: { asset: { asset: string; decimals: number }; min: string; expiryDays: 1 | 7 | 30; gateToken?: string },
  onStep: (i: number) => void,
): Promise<ProofRecord> {
  if (!signMessage) throw new ClientError('NO_SIGN', 'This wallet cannot sign messages. Try Phantom, Solflare or Backpack.')
  onStep(0)
  const s = await openRing(owner, signMessage, signDetailed, walletName)
  onStep(1)
  await syncRing(s)
  const need = toBase(req.min, req.asset.decimals)
  const picked = pickNotes(unspentNotes(s, req.asset.asset), need, 32)
  if (!picked) throw new ClientError('INSUFFICIENT', 'Your unspent Privacy Ring balance is below this amount.')
  onStep(2)
  const signed = await signChallenge(owner, signMessage)
  onStep(3)
  const res = await api<{ code: string; proof: ProofPayload }>('/api/ring-attest', {
    method: 'POST',
    body: JSON.stringify({
      ...signed,
      asset: req.asset.asset,
      min: req.min,
      expiryDays: req.expiryDays,
      gate: req.gateToken,
      nullifierSecret: hex(s.nullifierSecret),
      notes: picked.map(opening),
    }),
  })
  const rec = recordProof(owner, res.code, res.proof)
  onStep(4)
  return rec
}

export const RING_STEPS = [
  { label: 'Unlock Privacy Ring', detail: 'one wallet signature · keys stay in this tab' },
  { label: 'Read & decrypt your notes', detail: 'decrypted locally' },
  { label: 'Sign challenge', detail: 'proves this wallet · not a transaction' },
  { label: 'Check notes on-chain & seal', detail: 'unspent + in the Ring · claim only' },
]
