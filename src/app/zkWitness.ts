/**
 * Pure helpers shared by the browser prover (zk.ts) and the circuit test (zk/test.mjs):
 * field conversions, Rust `hash_bytes`, a sparse Poseidon Merkle tree, and the circuit's witness layout.
 * No SDK import here — callers pass Poseidon in.
 */
export const P = 21888242871839275222246405745257275088548364400416034343698204186575808495617n

export const field = (b: Uint8Array) => b.reduce((acc, x) => (acc << 8n) | BigInt(x), 0n)
export function fieldBytes(n: bigint): Uint8Array {
  const out = new Uint8Array(32)
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(n & 0xffn)
    n >>= 8n
  }
  return out
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
export function b58bytes(s: string): Uint8Array {
  let n = 0n
  for (const c of s) {
    const v = B58.indexOf(c)
    if (v < 0) throw new Error('bad base58')
    n = n * 58n + BigInt(v)
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
export function b58field32(s: string) {
  const b = b58bytes(s)
  const out = new Uint8Array(32)
  out.set(b, 32 - b.length)
  return field(out)
}

type Poseidon = (inputs: Uint8Array[]) => Uint8Array

/** Rust `hash_bytes_32(mint)` as a field; SOL is the all-zero address. */
export function hashBytesField(poseidon: Poseidon, mintOrSol: string): bigint {
  const bytes = mintOrSol === 'SOL' || mintOrSol === '11111111111111111111111111111111' ? new Uint8Array(32) : b58bytes(mintOrSol)
  const packed = (c: Uint8Array) => {
    const f = new Uint8Array(32)
    f.set(c, 32 - c.length)
    return f
  }
  let acc = packed(bytes.subarray(0, 31))
  for (let o = 31; o < bytes.length; o += 31) acc = poseidon([acc, packed(bytes.subarray(o, o + 31))]) as Uint8Array<ArrayBuffer>
  return field(acc)
}

/** Sparse Merkle tree with zero leaves; node = H(left, right); index bit i = 1 → right child at level i. */
export function sparseTree(H: (xs: bigint[]) => bigint, height: number, leaves: Map<bigint, bigint>) {
  const zeros = [0n]
  for (let i = 0; i < height; i++) zeros.push(H([zeros[i], zeros[i]]))
  const levels: Map<bigint, bigint>[] = [new Map(leaves)]
  for (let l = 0; l < height; l++) {
    const next = new Map<bigint, bigint>()
    for (const idx of levels[l].keys()) {
      const parent = idx >> 1n
      if (next.has(parent)) continue
      const left = levels[l].get(parent << 1n) ?? zeros[l]
      const right = levels[l].get((parent << 1n) | 1n) ?? zeros[l]
      next.set(parent, H([left, right]))
    }
    levels.push(next)
  }
  return {
    root: levels[height].get(0n) ?? zeros[height],
    path(index: bigint) {
      const out: bigint[] = []
      for (let l = 0; l < height; l++) out.push(levels[l].get((index >> BigInt(l)) ^ 1n) ?? zeros[l])
      return out
    },
  }
}

/** Recomputes a root from a leaf and its path, with the same ordering the circuit uses. */
export function rootFromPath(H: (xs: bigint[]) => bigint, leaf: bigint, index: bigint, path: bigint[]) {
  let cur = leaf
  path.forEach((sib, l) => {
    cur = (index >> BigInt(l)) & 1n ? H([sib, cur]) : H([cur, sib])
  })
  return cur
}

export type NoteWitness = {
  amount: bigint
  blinding: bigint
  dataHash: bigint
  ringHash: bigint
  leafIndex: bigint
  statePath: bigint[]
  lowValue: bigint
  nextValue: bigint
  lowIndex: bigint
  nullifierPath: bigint[]
}
export type WitnessInput = {
  utxoRoot: bigint
  nullifierRoot: bigint
  treeId: bigint
  asset: bigint
  minAmount: bigint
  scope: bigint
  ownerId: bigint
  nullifierSecret: bigint
  notes: NoteWitness[]
}

const STATE_H = 32
const NULL_H = 40

/** The circuit's input JSON (decimal strings), padding unused slots with inert zeros. */
export function buildWitness(w: WitnessInput, n: number) {
  if (w.notes.length > n) throw new Error(`at most ${n} notes per proof`)
  const pad: NoteWitness = {
    amount: 0n,
    blinding: 0n,
    dataHash: 0n,
    ringHash: 0n,
    leafIndex: 0n,
    statePath: Array(STATE_H).fill(0n),
    lowValue: 0n,
    nextValue: 0n,
    lowIndex: 0n,
    nullifierPath: Array(NULL_H).fill(0n),
  }
  const notes = [...w.notes, ...Array(n - w.notes.length).fill(pad)] as NoteWitness[]
  const s = (x: bigint) => x.toString()
  return {
    utxoRoot: s(w.utxoRoot),
    nullifierRoot: s(w.nullifierRoot),
    treeId: s(w.treeId),
    asset: s(w.asset),
    minAmount: s(w.minAmount),
    scope: s(w.scope),
    ownerId: s(w.ownerId),
    nullifierSecret: s(w.nullifierSecret),
    isReal: notes.map((_, i) => (i < w.notes.length ? '1' : '0')),
    amount: notes.map((x) => s(x.amount)),
    blinding: notes.map((x) => s(x.blinding)),
    dataHash: notes.map((x) => s(x.dataHash)),
    ringHash: notes.map((x) => s(x.ringHash)),
    leafIndex: notes.map((x) => s(x.leafIndex)),
    statePath: notes.map((x) => x.statePath.map(s)),
    lowValue: notes.map((x) => s(x.lowValue)),
    nextValue: notes.map((x) => s(x.nextValue)),
    lowIndex: notes.map((x) => s(x.lowIndex)),
    nullifierPath: notes.map((x) => x.nullifierPath.map(s)),
  }
}
