/** Minimal Discord REST client + interaction signature check (fetch + node:crypto only). */
import { createPublicKey, verify } from 'node:crypto'

export const hasDiscord = () => !!(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_APP_ID && process.env.DISCORD_PUBLIC_KEY)
const base = () => (process.env.DISCORD_API_BASE ?? 'https://discord.com/api/v10').replace(/\/$/, '')

export class DcError extends Error {
  constructor(public status: number, public detail: string) {
    super(`Discord ${status}: ${detail}`)
  }
}

export async function dc<T = unknown>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    method,
    headers: {
      ...(auth ? { authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      'user-agent': 'ParhelionBot (https://parhelion, 1.0)',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new DcError(res.status, (data as { message?: string } | null)?.message ?? res.statusText)
  return data as T
}

const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

/** Discord signs every interaction with the app's ed25519 key; anything else is rejected. */
export function verifyInteraction(body: string, signature: string | null, timestamp: string | null) {
  const pub = process.env.DISCORD_PUBLIC_KEY
  if (!pub || !signature || !timestamp || !/^[0-9a-f]{64}$/i.test(pub) || !/^[0-9a-f]{128}$/i.test(signature)) return false
  try {
    const key = createPublicKey({ key: Buffer.concat([SPKI_PREFIX, Buffer.from(pub, 'hex')]), format: 'der', type: 'spki' })
    return verify(null, Buffer.from(timestamp + body), key, Buffer.from(signature, 'hex'))
  } catch {
    return false
  }
}

/** Bot invite URL: bot + slash commands, with only the Manage Roles permission. */
export const installUrl = () =>
  process.env.DISCORD_APP_ID
    ? `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_APP_ID}&scope=bot+applications.commands&permissions=268435456`
    : null

export const PERM = { ADMINISTRATOR: 1n << 3n, MANAGE_GUILD: 1n << 5n, MANAGE_ROLES: 1n << 28n }
export const canManage = (perms: string | undefined) => {
  const p = BigInt(perms ?? '0')
  return (p & PERM.ADMINISTRATOR) !== 0n || (p & PERM.MANAGE_ROLES) !== 0n
}
