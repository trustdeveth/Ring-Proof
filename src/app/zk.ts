/**
 * Phase 4: zero-knowledge proof of a Privacy Ring balance, generated in the browser.
 *
 * The prover (circuit zk/ring_balance.circom, Groth16 / BN254) shows that up to two unspent Ring notes of the
 * asset, owned by the user's Ring key, sum to at least the claim — against the Ring's current state and
 * nullifier roots. Parhelion receives only the proof and its public signals: no wallet, no notes, no amounts,
 * no signature. A per-scope tag (one per gate) lets bots admit each holder once without learning who it is.
 *
 * Before proving we re-derive every value the circuit will check from the indexer's data with the SDK's own
 * Poseidon, so a format change on Helius's side fails here with a clear message instead of a bad proof.
 */
import * as snarkjs from 'snarkjs'
import { ShieldedPublicKey, poseidon } from '@heliuslabs/spr/keypair'
import { getTreeAddress } from '@heliuslabs/spr/addresses'
import { PublicKey } from '@solana/web3.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { ClientError, api, recordProof, type ProofPayload } from './client'
import type { ProofRecord } from './store'
import { openRing, pickNotes, syncRing, toBase, unspentNotes, type DetailedSigner } from './ring'
import { buildWitness, field, fieldBytes, hashBytesField, rootFromPath, type NoteWitness } from './zkWitness'

const NOTES_PER_PROOF = 2
const WASM = '/zk/ring_balance.wasm'
const ZKEY = '/zk/ring_balance.zkey'

const H = (xs: bigint[]) => field(poseidon(xs.map(fieldBytes) as never))

/** Scope of the anti-reuse tag. Same on the server (api/_lib/zk.ts). */
export function scopeField(label: string) {
  const d = sha256(new TextEncoder().encode(`parhelion/zk-scope/v1:${label}`))
  d[0] = 0
  return field(d)
}

export const ZK_STEPS = [
  { label: 'Unlock Privacy Ring', detail: 'one wallet signature · keys stay in this tab' },
  { label: 'Read & decrypt your notes', detail: 'decrypted locally' },
  { label: 'Fetch Ring tree paths', detail: 'Merkle + non-inclusion witnesses' },
  { label: 'Generate zero-knowledge proof', detail: 'in your browser · ~5–20 s' },
  { label: 'Verify & seal', detail: 'Parhelion sees the proof only' },
]

export async function proveWithZk(
  owner: string,
  signMessage: ((m: Uint8Array) => Promise<Uint8Array>) | undefined,
  signDetailed: DetailedSigner | undefined,
  walletName: string | undefined,
  req: { asset: { asset: string; decimals: number }; min: string; expiryDays: 1 | 7 | 30; gateToken?: string; gateId?: string },
  onStep: (i: number) => void,
): Promise<ProofRecord> {
  onStep(0)
  const s = await openRing(owner, signMessage, signDetailed, walletName)
  onStep(1)
  await syncRing(s)
  const min = toBase(req.min, req.asset.decimals)
  const all = unspentNotes(s, req.asset.asset)
  const picked = pickNotes(all, min, NOTES_PER_PROOF)
  if (!picked) {
    const total = all.reduce((a, n) => a + n.utxo.amount, 0n)
    throw new ClientError(
      'INSUFFICIENT',
      total >= min
        ? `Your Ring balance is split across too many notes for one proof (max ${NOTES_PER_PROOF}). Merge it in your Privacy Ring wallet, then try again.`
        : 'Your unspent Privacy Ring balance is below this amount.',
    )
  }
  const tree = picked[0].outputContext.tree
  if (picked.some((n) => n.outputContext.tree !== tree)) throw new ClientError('BAD_INPUT', 'These notes are in different Ring trees. Merge them first.')
  let treeId = -1
  for (let id = 0; id < 16; id++) if (getTreeAddress(id) === tree) treeId = id
  if (treeId < 0) throw new ClientError('BAD_INPUT', 'Unknown Privacy Ring tree.')

  // ---- witnesses from the indexer (one call each, so all notes share one root)
  onStep(2)
  const [incl, nonIncl] = await Promise.all([
    s.client.getMerkleProofs(tree as never, picked.map((n) => n.outputContext.hash)),
    s.client.getNonInclusionProofs(tree as never, picked.map((n) => n.nullifier)),
  ]).catch((e) => {
    throw new ClientError('NETWORK', `Could not fetch Ring tree paths: ${e instanceof Error ? e.message : 'indexer error'}`)
  })
  const utxoRoot = field(incl.proofs[0].root)
  const nullifierRoot = field(nonIncl.proofs[0].root)
  const ownerId = field(ShieldedPublicKey.fromEd25519(new PublicKey(owner).toBytes() as never).ownerProofInputHash())
  const nullifierSecret = field(s.nullifierSecret)
  const nfPk = H([nullifierSecret])
  const asset = hashBytesField(poseidon as never, req.asset.asset)

  const notes: NoteWitness[] = picked.map((n, i) => {
    const m = incl.proofs.find((p) => field(p.leaf) === field(n.outputContext.hash)) ?? incl.proofs[i]
    const q = nonIncl.proofs.find((p) => field(p.leaf) === field(n.nullifier)) ?? nonIncl.proofs[i]
    const blinding = field(n.utxo.blinding)
    const dataHash = n.dataHash ? field(n.dataHash) : 0n
    const ringHash = H([n.ringDataHash ? field(n.ringDataHash) : 0n, 0n])
    const leaf = H([3n, BigInt(treeId), asset, n.utxo.amount, dataHash, ringHash, H([H([ownerId, nfPk]), blinding])])
    const nf = H([leaf, blinding, nullifierSecret])
    // self-checks against Helius data — each names the assumption that broke
    if (leaf !== field(n.outputContext.hash)) throw new ClientError('NETWORK', 'ZK self-check failed: note commitment format differs from the Ring (commitment).')
    if (nf !== field(n.nullifier)) throw new ClientError('NETWORK', 'ZK self-check failed: nullifier format differs from the Ring (nullifier).')
    if (field(m.root) !== utxoRoot || field(q.root) !== nullifierRoot) throw new ClientError('NETWORK', 'The Ring tree moved while reading. Try again.')
    const statePath = m.path.map(field)
    if (rootFromPath(H, leaf, m.leafIndex, statePath) !== utxoRoot)
      throw new ClientError('NETWORK', 'ZK self-check failed: state-tree path does not reproduce the root (state tree hashing).')
    const lowValue = field(q.lowElement)
    const nextValue = field(q.highElement)
    const nullifierPath = q.path.map(field)
    if (rootFromPath(H, H([lowValue, nextValue]), q.lowElementIndex, nullifierPath) !== nullifierRoot)
      throw new ClientError('NETWORK', 'ZK self-check failed: nullifier-tree path does not reproduce the root (indexed leaf hashing).')
    if (!(lowValue < nf && nf < nextValue)) throw new ClientError('NETWORK', 'ZK self-check failed: nullifier is not between its low and next elements.')
    if (statePath.length !== 32 || nullifierPath.length !== 40) throw new ClientError('NETWORK', 'ZK self-check failed: unexpected tree height.')
    return { amount: n.utxo.amount, blinding, dataHash, ringHash, leafIndex: m.leafIndex, statePath, lowValue, nextValue, lowIndex: q.lowElementIndex, nullifierPath }
  })

  // ---- prove (in this tab)
  onStep(3)
  const scope = req.gateId ? scopeField(`gate:${req.gateId}`) : scopeField(`open:${crypto.randomUUID()}`)
  const input = buildWitness({ utxoRoot, nullifierRoot, treeId: BigInt(treeId), asset, minAmount: min, scope, ownerId, nullifierSecret, notes }, NOTES_PER_PROOF)
  let proof: unknown
  let publicSignals: string[]
  try {
    ;({ proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY))
  } catch (e) {
    throw new ClientError('NETWORK', `Proof generation failed: ${e instanceof Error ? e.message.slice(0, 120) : 'prover error'}`)
  }

  // ---- Parhelion verifies the proof; no wallet is sent
  onStep(4)
  const res = await api<{ code: string; proof: ProofPayload }>('/api/zk-attest', {
    method: 'POST',
    body: JSON.stringify({ proof, publicSignals, asset: req.asset.asset, min: req.min, expiryDays: req.expiryDays, gate: req.gateToken }),
  })
  const rec = recordProof(owner, res.code, res.proof)
  onStep(5)
  return rec
}
