/** Minimal Telegram Bot API client (fetch only). */
import { b64u, hmac } from './seal.js'

export const hasBot = () => !!process.env.TELEGRAM_BOT_TOKEN

const base = () => (process.env.TELEGRAM_API_BASE ?? 'https://api.telegram.org').replace(/\/$/, '')

export class TgError extends Error {
  constructor(public method: string, public description: string) {
    super(`Telegram ${method}: ${description}`)
  }
}

export async function tg<T = unknown>(method: string, body: Record<string, unknown> = {}): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new TgError(method, 'TELEGRAM_BOT_TOKEN is not set')
  const res = await fetch(`${base()}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => null)) as { ok: boolean; result?: T; description?: string } | null
  if (!data?.ok) throw new TgError(method, data?.description ?? `HTTP ${res.status}`)
  return data.result as T
}

/** Secret Telegram must echo in X-Telegram-Bot-Api-Secret-Token. Derived from PROOF_SECRET, so no extra env var. */
export async function webhookSecret() {
  return b64u(await hmac('tg-webhook', 'v1')).slice(0, 48)
}

let me: Promise<{ username: string } | null> | null = null
export function botUsername() {
  if (!hasBot()) return Promise.resolve(null)
  me ??= tg<{ username: string }>('getMe').catch(() => {
    me = null
    return null
  })
  return me.then((m) => m?.username ?? null)
}

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function send(chatId: number | string, html: string, extra: Record<string, unknown> = {}) {
  return tg('sendMessage', { chat_id: chatId, text: html, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...extra })
}

/** Public origin of the site, for links the bot sends. */
export function siteOrigin(req: Request) {
  const explicit = process.env.PUBLIC_SITE_URL?.replace(/\/$/, '')
  if (explicit) return explicit
  if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost').split(',')[0].trim()
  const proto = (req.headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https')).split(',')[0]
  return `${proto}://${host}`
}
