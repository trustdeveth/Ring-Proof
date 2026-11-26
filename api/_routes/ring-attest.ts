/**
 * POST /api/ring-attest — Phase 3: a holder proof over a Helius Privacy Ring balance.
 *
 * The browser derives the user's Ring keys from a wallet signature, syncs and decrypts the user's own notes
 * locally, and sends only:
 *   - the usual signed challenge (proves control of the wallet),
 *   - the openings of the unspent notes it wants counted (amount, blinding, tree position),
 *   - the 31-byte nullifier secret (lets us check a note is unspent; it cannot authorize a spend).
 * For every note we recompute its commitment with the Helius SDK, check it is a leaf of the Ring's state tree,
 * derive its nullifier and check that nullifier is absent from the nullifier tree. If the unspent total meets
 * the claim we seal the same rp2 proof as a public-balance proof (src: "ring"). Nothing is stored; the
 * nullifier secret is wiped before we respond. Spending keys never leave the wallet.
 */
import { NullifierKey, ShieldedPublicKey } from '@heliuslabs/spr/keypair'
import { SOL_MINT, Utxo } from '@heliuslabs/spr/transaction'
import type { Address } from '@heliuslabs/spr'
import { json, readJson } from '../_lib/http.js'
import { b58decode, isAddress } from '../_lib/b58.js'
import { checkOwnership, type SignedChallenge } from '../_lib/ownership.js'
import { open, randomId, seal } from '../_lib/seal.js'
import { InvalidParamError, RpcError, SOL, assetInfo, toBaseUnits } from '../_lib/solana.js'
import { EXPIRY_DAYS, type GatePayload, type ProofPayload } from '../_lib/types.js'
import { SprError, bytesToHex, hexToBytes, poseidonReady, spr, treeIdOf } from '../_lib/spr.js'

export type RingNote = {
  tree: string // state tree account
  leafIndex: string
  hash: string // hex 32: the commitment as indexed
  amount: string // base units
  blinding: string // hex 32
  dataHash?: string // hex 32
  ringDataHash?: string // hex 32
  ringProgramId?: string
}

type Body = SignedChallenge & {
  asset: string
  min: string
  expiryDays: number
  gate?: string
  nullifierSecret: string // hex 31
  notes: RingNote[]
}

const MAX_NOTES = 32

export async function POST(req: Request) {
  const b = await readJson<Body>(req, 64_000)
  if (!b) return json({ error: 'Invalid request.' }, 400)
  if (b.asset !== SOL && !isAddress(b.asset)) return json({ error: 'Invalid token mint.' }, 400)
  if (!EXPIRY_DAYS.includes(b.expiryDays as 1 | 7 | 30)) return json({ error: 'Expiry must be 1, 7 or 30 days.' }, 400)
  if (!Array.isArray(b.notes) || b.notes.length === 0) return json({ error: 'No private notes for this token in your Privacy Ring.', code: 'INSUFFICIENT' }, 422)
  if (b.notes.length > MAX_NOTES) return json({ error: `Too many notes (max ${MAX_NOTES}). Merge your Ring balance first.` }, 400)

  const denied = await checkOwnership(req, b)
  if (denied) return denied

  let gate: GatePayload | null = null
  if (b.gate) {
    gate = await open<GatePayload>('rg1', b.gate)
    if (!gate) return json({ error: 'This gate link is invalid.' }, 400)
  }

  let secret: Uint8Array
  try {
    secret = hexToBytes(b.nullifierSecret)
    if (secret.length !== 31) throw new Error()
  } catch {
    return json({ error: 'Invalid Ring key.' }, 400)
  }

  try {
    const info = await assetInfo(b.asset)
    const min = toBaseUnits(b.min, info.decimals)
    if (min === null || min <= 0n) return json({ error: `Invalid amount for a token with ${info.decimals} decimals.` }, 400)
    if (gate) {
      const gateMin = toBaseUnits(gate.m, info.decimals)
      if (gate.a !== b.asset || gateMin === null || min < gateMin)
        return json({ error: `This gate needs a proof of at least ${gate.m} ${gate.s}.` }, 400)
    }

    await poseidonReady()
    const nk = NullifierKey.fromSecret(secret as never)
    secret.fill(0)
    const nullifierPk = nk.publicKey()
    const owner = ShieldedPublicKey.fromEd25519(b58decode(b.owner) as never)
    const asset = (b.asset === SOL ? SOL_MINT : b.asset) as Address

    // 1 — every opening must reproduce its commitment under THIS wallet + nullifier key
    type Checked = { note: RingNote; treeId: number; hash: Uint8Array; nullifier: Uint8Array; amount: bigint }
    const checked: Checked[] = []
    const seen = new Set<string>()
    for (const n of b.notes) {
      const treeId = treeIdOf(n.tree)
      if (treeId === null) return json({ error: 'A note is in an unknown Privacy Ring tree.' }, 400)
      const amount = BigInt(n.amount)
      if (amount <= 0n || amount > 0xffffffffffffffffn) return json({ error: 'Invalid note amount.' }, 400)
      const utxo = new Utxo({
        owner,
        asset,
        amount,
        blinding: hexToBytes(n.blinding) as never,
        ...(n.ringProgramId ? { ringProgramId: n.ringProgramId as Address } : {}),
      })
      const hash = utxo.hash(
        nullifierPk,
        treeId,
        n.dataHash ? (hexToBytes(n.dataHash) as never) : undefined,
        n.ringDataHash ? (hexToBytes(n.ringDataHash) as never) : undefined,
      )
      if (bytesToHex(hash) !== n.hash.replace(/^0x/, '').toLowerCase())
        return json({ error: 'A private note does not belong to this wallet, or its opening is wrong.' }, 400)
      if (seen.has(n.hash)) return json({ error: 'The same note was sent twice.' }, 400)
      seen.add(n.hash)
      checked.push({ note: n, treeId, hash, nullifier: utxo.nullifier(hash, nk), amount })
    }
    nk.destroy()

    // 2 — inclusion: each commitment is a leaf of its state tree
    const bs58 = b58encode
    const byTree = new Map<string, Checked[]>()
    for (const c of checked) byTree.set(c.note.tree, [...(byTree.get(c.note.tree) ?? []), c])
    let total = 0n
    for (const [tree, notes] of byTree) {
      const incl = await spr<{ proofs: { leaf: string; leafIndex: number | string }[] }>('getMerkleProofs', {
        treeAccount: tree,
        leaves: notes.map((c) => bs58(c.hash)),
      }).catch((e) => {
        if (e instanceof SprError && /unreachable|HTTP 5/.test(e.message)) throw e
        return null
      })
      if (!incl || incl.proofs.length !== notes.length) return json({ error: 'A private note is not in the Privacy Ring tree.' }, 400)

      // 3 — unspent: the nullifier must be absent from the nullifier tree (the call fails if any is used/queued)
      for (const c of notes) {
        const unspent = await spr('getNonInclusionProofs', { treeAccount: tree, leaves: [bs58(c.nullifier)] }).then(
          () => true,
          () => false,
        )
        if (unspent) total += c.amount
      }
    }
    if (total < min)
      return json({ error: `Your unspent Privacy Ring balance is below ${b.min} ${info.symbol}.`, code: 'INSUFFICIENT' }, 422)

    // 4 — seal the claim only
    const now = Date.now()
    const payload: ProofPayload = {
      v: 2,
      id: randomId(),
      a: b.asset,
      s: info.symbol,
      m: b.min.replace(/,/g, ''),
      iat: now,
      exp: now + b.expiryDays * 86_400_000,
      src: 'ring',
      ...(gate ? { g: gate.id, gn: gate.name } : {}),
    }
    return json({ code: await seal('rp2', payload), proof: payload })
  } catch (e) {
    if (e instanceof InvalidParamError) return json({ error: 'That address is not a token mint.' }, 400)
    if (e instanceof RpcError || e instanceof SprError) return json({ error: e.message }, 502)
    throw e
  }
}

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
function b58encode(bytes: Uint8Array) {
  let n = 0n
  for (const x of bytes) n = n * 256n + BigInt(x)
  let s = ''
  while (n > 0n) {
    s = ALPHABET[Number(n % 58n)] + s
    n /= 58n
  }
  for (const x of bytes) {
    if (x !== 0) break
    s = '1' + s
  }
  return s
}
