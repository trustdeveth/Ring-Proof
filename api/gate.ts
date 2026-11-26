import { json, readJson } from './_lib/http.js'
import { isAddress } from './_lib/b58.js'
import { randomId, seal } from './_lib/seal.js'
import { RpcError, SOL, assetInfo, toBaseUnits } from './_lib/solana.js'
import type { GatePayload } from './_lib/types.js'
import { checkFeeTx, feeConfig, feesOn } from './_lib/fees.js'
import { kvCreate, kvDel } from './_lib/kv.js'

type Body = { name: string; asset: string; min: string; platform: 'telegram' | 'discord'; room: string; feeTx?: string }

const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max) : '')

/** POST /api/gate — returns a signed gate token (the gate's rule). No storage. */
export async function POST(req: Request) {
  const b = await readJson<Body>(req)
  if (!b) return json({ error: 'Invalid request.' }, 400)
  const name = clean(b.name, 40)
  const room = clean(b.room, 60)
  if (name.length < 2) return json({ error: 'Give the gate a name.' }, 400)
  if (room.length < 2) return json({ error: 'Add the group or role.' }, 400)
  if (b.platform !== 'telegram' && b.platform !== 'discord') return json({ error: 'Unknown platform.' }, 400)
  if (b.asset !== SOL && !isAddress(b.asset)) return json({ error: 'Invalid token mint.' }, 400)
  // $PRHL gate fee: one on-chain payment (treasury share + burn), each transaction usable once
  let fee: { tx: string; burned: string } | null = null
  if (feesOn()) {
    if (typeof b.feeTx !== 'string') return json({ error: 'This gate needs the $PRHL gate fee.', code: 'FEE_REQUIRED' }, 402)
    try {
      const cfg = await feeConfig()
      const chk = cfg ? await checkFeeTx(b.feeTx, cfg) : ({ ok: false, reason: 'Fee config error.' } as const)
      if (!chk.ok) return json({ error: chk.reason, code: 'pending' in chk && chk.pending ? 'FEE_PENDING' : 'FEE_INVALID' }, 'pending' in chk && chk.pending ? 409 : 402)
      if (!(await kvCreate(`fee/tx/${b.feeTx}.json`, { at: Date.now() })))
        return json({ error: 'This fee payment was already used for a gate.', code: 'FEE_INVALID' }, 402)
      fee = { tx: b.feeTx, burned: chk.burned.toString() }
    } catch (e) {
      if (e instanceof RpcError) return json({ error: e.message }, 502)
      throw e
    }
  }
  try {
    const info = await assetInfo(b.asset)
    const min = toBaseUnits(b.min, info.decimals)
    if (min === null || min <= 0n) return json({ error: 'Invalid minimum.' }, 400)
    const g: GatePayload = {
      v: 1,
      id: randomId(5),
      name,
      a: b.asset,
      s: info.symbol,
      m: String(b.min).replace(/,/g, ''),
      platform: b.platform,
      room,
      iat: Date.now(),
    }
    return json({ token: await seal('rg1', g), gate: g, fee })
  } catch (e) {
    if (fee) await kvDel(`fee/tx/${fee.tx}.json`) // gate not created: the payment can be reused for a retry
    if (e instanceof RpcError) return json({ error: e.message }, 502)
    return json({ error: 'That address is not a token mint.' }, 400)
  }
}
