import { createHash } from 'node:crypto'
import { VERIFICATION_KEY } from './zk-vk.js'

export { VERIFICATION_KEY }

/** Scope of the anti-reuse tag. Must match src/app/zk.ts scopeField. */
export function scopeField(label: string): bigint {
  const d = createHash('sha256').update(`parhelion/zk-scope/v1:${label}`).digest()
  d[0] = 0
  return BigInt(`0x${d.toString('hex')}`)
}
