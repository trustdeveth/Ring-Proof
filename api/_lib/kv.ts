/**
 * Tiny key-value store on Vercel Blob (private access, uncached reads). Used only by the Telegram bot for:
 * one-time proof IDs, gate↔group bindings and pending join requests. No wallets are ever stored.
 * Without BLOB_READ_WRITE_TOKEN outside production it falls back to memory (local dev and tests).
 */
import { del, get, head, list, put } from '@vercel/blob'

const mem = new Map<string, string>()

export const hasKv = () => !!process.env.BLOB_READ_WRITE_TOKEN
function useMem() {
  if (hasKv()) return false
  if (process.env.VERCEL_ENV === 'production') throw new Error('Vercel Blob is not connected (BLOB_READ_WRITE_TOKEN missing)')
  return true
}

export async function kvGet<T>(key: string): Promise<T | null> {
  if (useMem()) return mem.has(key) ? (JSON.parse(mem.get(key)!) as T) : null
  const res = await get(key, { access: 'private', useCache: false })
  if (!res || !res.stream) return null
  return JSON.parse(await new Response(res.stream).text()) as T
}

export async function kvSet(key: string, value: unknown) {
  if (useMem()) return void mem.set(key, JSON.stringify(value))
  await put(key, JSON.stringify(value), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' })
}

/** Writes only if the key does not exist yet. Returns false when it already existed. */
export async function kvCreate(key: string, value: unknown): Promise<boolean> {
  if (useMem()) {
    if (mem.has(key)) return false
    mem.set(key, JSON.stringify(value))
    return true
  }
  try {
    await put(key, JSON.stringify(value), { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'application/json' })
    return true
  } catch (e) {
    const exists = await head(key).then(() => true, () => false)
    if (exists) return false
    throw e
  }
}

/** All keys under a prefix (paginated). */
export async function kvKeys(prefix: string): Promise<string[]> {
  if (useMem()) return [...mem.keys()].filter((k) => k.startsWith(prefix))
  const out: string[] = []
  let cursor: string | undefined
  do {
    const r = await list({ prefix, cursor, limit: 1000 })
    out.push(...r.blobs.map((b) => b.pathname))
    cursor = r.hasMore ? r.cursor : undefined
  } while (cursor)
  return out
}

export async function kvDel(key: string) {
  if (useMem()) return void mem.delete(key)
  await del(key).catch(() => {})
}
