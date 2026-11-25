import { json, readJson } from './_lib/http.js'
import { isAddress } from './_lib/b58.js'
import { CHALLENGE_TTL_MS, challengeMessage, domainOf, makeNonce, verifyWalletSignature } from './_lib/challenge.js'
import { open, randomId, seal } from './_lib/seal.js'
import { InvalidParamError, RpcError, SOL, assetInfo, holding, toBaseUnits } from './_lib/solana.js'
import { EXPIRY_DAYS, type GatePayload, type ProofPayload } from './_lib/types.js'

type Body = {
  owner: string
  ts: number
  nonce: string
  signature: string // base64
  asset: string // 'SOL' or mint
  min: string // UI units
  expiryDays: number
  gate?: string // rg1_ token
}

/**
 * POST /api/attest — issue a holder proof.
 * 1. check the wallet signed our challenge (proves control of `owner`)
 * 2. read the wallet's real on-chain balance
 * 3. if it meets the claim, seal a proof that names the claim only
 * Nothing is stored or logged.
 */
export async function POST(req: Request) {
  const b = await readJson<Body>(req)
  if (!b) return json({ error: 'Invalid request.' }, 400)
  if (!isAddress(b.owner)) return json({ error: 'Invalid wallet address.' }, 400)
  if (b.asset !== SOL && !isAddress(b.asset)) return json({ error: 'Invalid token mint.' }, 400)
  if (!EXPIRY_DAYS.includes(b.expiryDays as 1 | 7 | 30)) return json({ error: 'Expiry must be 1, 7 or 30 days.' }, 400)
  if (typeof b.ts !== 'number' || typeof b.nonce !== 'string' || typeof b.signature !== 'string')
    return json({ error: 'Missing signature.' }, 400)

  // 1 — ownership
  if (Date.now() - b.ts > CHALLENGE_TTL_MS || b.ts > Date.now() + 30_000)
    return json({ error: 'Signature request expired. Try again.' }, 401)
  const domain = domainOf(req)
  if ((await makeNonce(b.owner, domain, b.ts)) !== b.nonce) return json({ error: 'Invalid challenge.' }, 401)
  if (!verifyWalletSignature(b.owner, challengeMessage(b.owner, domain, b.nonce, b.ts), b.signature))
    return json({ error: 'Wallet signature check failed.' }, 401)

  // optional gate: proof must satisfy the gate's rule
  let gate: GatePayload | null = null
  if (b.gate) {
    gate = await open<GatePayload>('rg1', b.gate)
    if (!gate) return json({ error: 'This gate link is invalid.' }, 400)
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

    // 2 — real balance
    const held = await holding(b.owner, b.asset)
    if (held < min) return json({ error: `This wallet holds less than ${b.min} ${info.symbol}.`, code: 'INSUFFICIENT' }, 422)

    // 3 — seal
    const now = Date.now()
    const payload: ProofPayload = {
      v: 2,
      id: randomId(),
      a: b.asset,
      s: info.symbol,
      m: b.min.replace(/,/g, ''),
      iat: now,
      exp: now + b.expiryDays * 86_400_000,
      ...(gate ? { g: gate.id, gn: gate.name } : {}),
    }
    return json({ code: await seal('rp2', payload), proof: payload })
  } catch (e) {
    if (e instanceof InvalidParamError) return json({ error: 'That address is not a token mint.' }, 400)
    if (e instanceof RpcError) return json({ error: e.message }, 502)
    throw e
  }
}
