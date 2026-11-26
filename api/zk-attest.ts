/**
 * POST /api/zk-attest — Phase 4: verify a zero-knowledge Privacy Ring balance proof and seal the claim.
 *
 * Body: { proof, publicSignals, asset, min, expiryDays, gate? } — no wallet, no signature, no notes.
 * Public signals: [tag, utxoRoot, nullifierRoot, treeId, asset, minAmount, scope].
 * We check the Groth16 proof, that it is about THIS asset and amount (and this gate's scope), and that both roots
 * are real roots of the Ring's tree account (present in its on-chain root history). The proof id is derived from
 * the tag, so one holder gets one id per gate — bots admit it once — while different gates can't link holders.
 */
import * as snarkjs from 'snarkjs'
import { json, readJson } from './_lib/http.js'
import { isAddress } from './_lib/b58.js'
import { b64u, hmac, open, randomId, seal } from './_lib/seal.js'
import { InvalidParamError, RpcError, SOL, assetInfo, rpc, toBaseUnits } from './_lib/solana.js'
import { EXPIRY_DAYS, type GatePayload, type ProofPayload } from './_lib/types.js'
import { assetField, bigIntToBytes32, poseidonReady } from './_lib/spr.js'
import { getTreeAddress } from '@heliuslabs/spr/addresses'
import { VERIFICATION_KEY, scopeField } from './_lib/zk.js'

type Body = { proof: unknown; publicSignals: string[]; asset: string; min: string; expiryDays: number; gate?: string }

const P = 21888242871839275222246405745257275088548364400416034343698204186575808495617n

export async function POST(req: Request) {
  const b = await readJson<Body>(req, 32_000)
  if (!b || !Array.isArray(b.publicSignals) || b.publicSignals.length !== 7 || typeof b.proof !== 'object' || !b.proof)
    return json({ error: 'Invalid proof.' }, 400)
  if (b.asset !== SOL && !isAddress(b.asset)) return json({ error: 'Invalid token mint.' }, 400)
  if (!EXPIRY_DAYS.includes(b.expiryDays as 1 | 7 | 30)) return json({ error: 'Expiry must be 1, 7 or 30 days.' }, 400)
  let sig: bigint[]
  try {
    sig = b.publicSignals.map((x) => BigInt(x))
    if (sig.some((x) => x < 0n || x >= P)) throw new Error()
  } catch {
    return json({ error: 'Invalid proof.' }, 400)
  }
  const [tag, utxoRoot, nullifierRoot, treeId, asset, minAmount, scope] = sig

  let gate: GatePayload | null = null
  if (b.gate) {
    gate = await open<GatePayload>('rg1', b.gate)
    if (!gate) return json({ error: 'This gate link is invalid.' }, 400)
  }

  try {
    // 1 — the statement is the one being claimed
    await poseidonReady()
    const info = await assetInfo(b.asset)
    const min = toBaseUnits(b.min, info.decimals)
    if (min === null || min <= 0n) return json({ error: `Invalid amount for a token with ${info.decimals} decimals.` }, 400)
    if (gate) {
      const gateMin = toBaseUnits(gate.m, info.decimals)
      if (gate.a !== b.asset || gateMin === null || min < gateMin) return json({ error: `This gate needs a proof of at least ${gate.m} ${gate.s}.` }, 400)
      if (scope !== scopeField(`gate:${gate.id}`)) return json({ error: 'This proof was made for a different gate.' }, 400)
    }
    if (asset !== assetField(b.asset)) return json({ error: 'This proof is about a different token.' }, 400)
    if (minAmount !== min) return json({ error: 'This proof is for a different amount.' }, 400)
    if (treeId > 0xffffn) return json({ error: 'Invalid proof.' }, 400)

    // 2 — the zero-knowledge proof itself
    const ok = await snarkjs.groth16.verify(VERIFICATION_KEY, b.publicSignals, b.proof as never)
    if (!ok) return json({ error: 'The zero-knowledge proof is invalid.' }, 400)

    // 3 — both roots are real, recent roots of the Ring tree (they live in the tree account's root history)
    const tree = getTreeAddress(Number(treeId))
    const acct = await rpc<{ value: { data: [string, string] } | null }>('getAccountInfo', [tree, { encoding: 'base64', commitment: 'confirmed' }])
    if (!acct.value) return json({ error: 'Unknown Privacy Ring tree.' }, 400)
    const data = Buffer.from(acct.value.data[0], 'base64')
    const has = (n: bigint) => {
      const be = Buffer.from(bigIntToBytes32(n))
      return data.includes(be) || data.includes(Buffer.from(be).reverse())
    }
    if (!has(utxoRoot) || !has(nullifierRoot))
      return json({ error: 'This proof uses an outdated Privacy Ring state. Generate a fresh one.' }, 409)

    // 4 — seal the claim; id is stable per holder per scope
    const now = Date.now()
    const payload: ProofPayload = {
      v: 2,
      id: gate ? b64u(await hmac('zk-id', `${tag}:${scope}`)).slice(0, 12) : randomId(),
      a: b.asset,
      s: info.symbol,
      m: b.min.replace(/,/g, ''),
      iat: now,
      exp: now + b.expiryDays * 86_400_000,
      src: 'zk',
      ...(gate ? { g: gate.id, gn: gate.name } : {}),
    }
    return json({ code: await seal('rp2', payload), proof: payload })
  } catch (e) {
    if (e instanceof InvalidParamError) return json({ error: 'That address is not a token mint.' }, 400)
    if (e instanceof RpcError) return json({ error: e.message }, 502)
    throw e
  }
}
