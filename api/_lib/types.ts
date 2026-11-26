/** Proof payload (prefix rp2). Contains the claim only — never a wallet address or balance. */
export type ProofPayload = {
  v: 2
  id: string
  a: string // 'SOL' or mint address
  s: string // symbol at issue time
  m: string // minimum, UI units ("1000000")
  iat: number
  exp: number
  g?: string // gate id
  gn?: string // gate name
  src?: 'ring' | 'zk' // balance source: absent = public wallet, ring = Privacy Ring (attested), zk = zero-knowledge
}

/** Gate config (prefix rg1). A gate is just a signed rule: no storage needed. */
export type GatePayload = {
  v: 1
  id: string
  name: string
  a: string
  s: string
  m: string
  platform: 'telegram' | 'discord'
  room: string
  iat: number
}

export const EXPIRY_DAYS = [1, 7, 30] as const
