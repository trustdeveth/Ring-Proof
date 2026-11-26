// End-to-end circuit test against the real Helius SDK hashing.
//   node zk/test.mjs        (from the project root, after `npm run zk:build`)
// 1. builds two real SDK notes (Utxo.hash / Utxo.nullifier) for a random owner,
// 2. checks our in-circuit formulas reproduce the SDK's commitment, nullifier key and nullifier,
// 3. places them in a height-32 state tree and proves their nullifiers absent from a height-40 indexed tree,
// 4. proves + verifies with snarkjs, then checks that cheating inputs are rejected.
import { webcrypto } from 'node:crypto'
import * as snarkjs from 'snarkjs'
import { initializePoseidon, poseidon, NullifierKey, ShieldedPublicKey } from '@heliuslabs/spr/keypair'
import { Utxo } from '@heliuslabs/spr/transaction'
import { buildWitness, P, field, fieldBytes, hashBytesField, sparseTree } from '../src/app/zkWitness.ts'

await initializePoseidon()
const H = (xs) => field(poseidon(xs.map(fieldBytes)))
const rand = (n) => webcrypto.getRandomValues(new Uint8Array(n))
const results = []
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`)

// ---- an owner and two notes, hashed by the SDK
const secret = rand(31)
const nk = NullifierKey.fromSecret(secret)
const nfPk = field(nk.publicKey())
check('nullifier_pk = Poseidon(secret)', nfPk === H([field(secret)]))
const edPk = rand(32)
const owner = ShieldedPublicKey.fromEd25519(edPk)
const ownerId = field(owner.ownerProofInputHash())
const mint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const asset = hashBytesField(poseidon, mint)
const blind = () => {
  const b = rand(32)
  b[0] = 0 // keep it a canonical field element, as the SDK's blindings are
  return b
}
const notes = [700_000_000n, 400_000_000n].map((amount) => {
  const u = new Utxo({ owner, asset: mint, amount, blinding: blind() })
  const hash = u.hash(nk.publicKey(), 0)
  return { u, hash: field(hash), nullifier: field(u.nullifier(hash, nk)), amount, blinding: field(u.blinding) }
})
for (const [i, n] of notes.entries()) {
  const ownerHash = H([ownerId, nfPk])
  const mine = H([3n, 0n, asset, n.amount, 0n, H([0n, 0n]), H([ownerHash, n.blinding])])
  check(`note ${i}: circuit commitment == SDK Utxo.hash`, mine === n.hash)
  check(`note ${i}: circuit nullifier == SDK nullifier`, H([n.hash, n.blinding, field(secret)]) === n.nullifier)
}

// ---- trees
const leafIdx = [5n, 9n]
const state = sparseTree(H, 32, new Map(leafIdx.map((ix, i) => [ix, notes[i].hash])))
const sorted = [...notes.map((n) => n.nullifier)].sort((a, b) => (a < b ? -1 : 1))
// an indexed tree holding {0, a, b, P-1} where a < nf0 < nf1 < b etc.: choose neighbours around both nullifiers
const low0 = sorted[0] - 1000n
const mid = (sorted[0] + sorted[1]) / 2n
const high1 = sorted[1] + 1000n
// elements: 0 → low0 → mid → high1 → P-1 ; leaf = H(value, next)
const elems = [0n, low0, mid, high1]
const nexts = [low0, mid, high1, P - 1n]
const idxLeaves = new Map(elems.map((v, i) => [BigInt(i), H([v, nexts[i]])]))
const nullTree = sparseTree(H, 40, idxLeaves)
const lowFor = (nf) => elems.findIndex((v, i) => v < nf && nf < nexts[i])

const scope = 1234567n
const base = {
  utxoRoot: state.root,
  nullifierRoot: nullTree.root,
  treeId: 0n,
  asset,
  minAmount: 1_000_000_000n,
  scope,
  ownerId,
  nullifierSecret: field(secret),
  notes: notes.map((n, i) => {
    const li = lowFor(n.nullifier)
    return {
      amount: n.amount,
      blinding: n.blinding,
      dataHash: 0n,
      ringHash: H([0n, 0n]),
      leafIndex: leafIdx[i],
      statePath: state.path(leafIdx[i]),
      lowValue: elems[li],
      nextValue: nexts[li],
      lowIndex: BigInt(li),
      nullifierPath: nullTree.path(BigInt(li)),
    }
  }),
}

const wasm = 'zk/build/ring_balance_js/ring_balance.wasm'
const zkey = 'zk/build/rb_final.zkey'
const vk = JSON.parse(await (await import('node:fs/promises')).readFile('zk/build/verification_key.json', 'utf8'))

const t0 = Date.now()
const { proof, publicSignals } = await snarkjs.groth16.fullProve(buildWitness(base, 2), wasm, zkey)
check('proof generated', !!proof, `${((Date.now() - t0) / 1000).toFixed(1)}s`)
check('proof verifies', await snarkjs.groth16.verify(vk, publicSignals, proof))
check('public tag = Poseidon(secret, scope)', BigInt(publicSignals[0]) === H([field(secret), scope]))
check('public signals order [tag, utxoRoot, nullifierRoot, treeId, asset, min, scope]',
  publicSignals.slice(1).map(BigInt).join() === [state.root, nullTree.root, 0n, asset, 1_000_000_000n, scope].join())

const mustFail = async (name, mutate) => {
  const w = structuredClone(base)
  mutate(w)
  try {
    await snarkjs.groth16.fullProve(buildWitness(w, 2), wasm, zkey)
    check(name, false, 'witness was accepted')
  } catch {
    check(name, true)
  }
}
await mustFail('rejects: total below min', (w) => (w.minAmount = 1_100_000_001n))
await mustFail('rejects: inflated amount', (w) => (w.notes[0].amount += 1n))
await mustFail('rejects: wrong owner key', (w) => (w.nullifierSecret += 1n))
await mustFail('rejects: note not in state tree', (w) => (w.notes[1].leafIndex = 6n))
await mustFail('rejects: spent note (nullifier in tree)', (w) => {
  // claim the nullifier sits above an element equal to itself
  w.notes[0].lowValue = notes[0].nullifier
})
await mustFail('rejects: same note counted twice', (w) => (w.notes[1] = structuredClone(w.notes[0])))
await mustFail('rejects: forged asset', (w) => (w.asset += 1n))
// a single real note + padding is allowed
const one = structuredClone(base)
one.minAmount = 700_000_000n
one.notes = [one.notes[0]]
const p1 = await snarkjs.groth16.fullProve(buildWitness(one, 2), wasm, zkey)
check('one real note + padding slot verifies', await snarkjs.groth16.verify(vk, p1.publicSignals, p1.proof))

console.log(results.join('\n'))
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0)
