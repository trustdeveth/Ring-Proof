/**
 * Parhelion Telegram bot — webhook + one-time setup, all on Vercel.
 *
 * Group admins: add the bot as admin (permission "Invite users via link"), then send `/gate rg1_…` in the group.
 * The bot replies with a join-request invite link. Anyone who uses it gets a DM asking for a Parhelion proof;
 * a valid, unexpired, never-used proof that meets the gate is approved automatically. No wallets are stored.
 *
 * GET  /api/telegram            → status
 * GET  /api/telegram?setup=1    → registers this deployment's webhook + commands (idempotent)
 * POST /api/telegram            → Telegram updates (checked with the secret token header)
 */
import { json } from './_lib/http.js'
import { b64u, hasSecret, hmac } from './_lib/seal.js'
import { hasKv, kvCreate, kvDel, kvGet, kvSet } from './_lib/kv.js'
import { checkProof, claim, meetsGate, openGate } from './_lib/proof.js'
import { TgError, botUsername, esc, hasBot, send, siteOrigin, tg, webhookSecret } from './_lib/telegram.js'
import type { GatePayload, ProofPayload } from './_lib/types.js'

type User = { id: number; is_bot?: boolean; first_name?: string; username?: string }
type Chat = { id: number; type: 'private' | 'group' | 'supergroup' | 'channel'; title?: string }
type Message = { message_id: number; from?: User; chat: Chat; text?: string }
type JoinRequest = { chat: Chat; from: User; user_chat_id: number; date: number }
type Update = { update_id: number; message?: Message; chat_join_request?: JoinRequest }

type Binding = { token: string; gateId: string; invite: string; title: string; by: number; at: number }
type Pending = Record<string, { title: string; exp: number }>

const PENDING_TTL = 48 * 3600_000
const chatKey = (chatId: number) => `tg/chat/${chatId}.json`
const usedKey = (chatId: number | string, proofId: string) => `tg/used/${chatId}/${proofId}.json`
const pendKey = async (userId: number) => `tg/pend/${b64u(await hmac('tg-pending', String(userId))).slice(0, 32)}.json`

const COMMANDS = [
  { command: 'start', description: 'How Parhelion works' },
  { command: 'verify', description: 'Check a proof: /verify rp2_…' },
  { command: 'gate', description: 'Admins: gate this group with /gate rg1_…' },
  { command: 'status', description: 'Show this group’s gate' },
  { command: 'ungate', description: 'Admins: remove this group’s gate' },
]

// ---------------------------------------------------------------- HTTP

export async function GET(req: Request) {
  const url = new URL(req.url)
  if (!hasBot()) return json({ ok: false, error: 'TELEGRAM_BOT_TOKEN is not set' }, 503)
  try {
    if (url.searchParams.get('setup')) {
      const hook = `${siteOrigin(req)}/api/telegram`
      await tg('setWebhook', {
        url: hook,
        secret_token: await webhookSecret(),
        allowed_updates: ['message', 'chat_join_request'],
        drop_pending_updates: true,
      })
      await tg('setMyCommands', { commands: COMMANDS })
      await tg('setMyDescription', { description: 'Private holder proofs on Solana. Prove you hold the bag — your wallet stays hidden.' })
      return json({ ok: true, bot: `@${await botUsername()}`, webhook: hook })
    }
    const info = await tg<{ url: string; pending_update_count: number; last_error_message?: string }>('getWebhookInfo')
    return json({ ok: true, bot: `@${await botUsername()}`, webhook: info.url || null, pending: info.pending_update_count, lastError: info.last_error_message ?? null, storage: hasKv() ? 'vercel-blob' : 'memory (dev only)' })
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'error' }, 502)
  }
}

export async function POST(req: Request) {
  if (!hasBot() || !hasSecret()) return json({ ok: false }, 503)
  if (req.headers.get('x-telegram-bot-api-secret-token') !== (await webhookSecret())) return json({ ok: false }, 401)
  let update: Update
  try {
    update = (await req.json()) as Update
  } catch {
    return json({ ok: true })
  }
  try {
    await handle(update, siteOrigin(req))
  } catch (e) {
    // never make Telegram retry the same update forever
    console.error('telegram update failed', e)
  }
  return json({ ok: true })
}

// ---------------------------------------------------------------- routing

async function handle(u: Update, origin: string) {
  if (u.chat_join_request) return onJoinRequest(u.chat_join_request, origin)
  const m = u.message
  if (!m?.text || !m.from || m.from.is_bot) return
  const text = m.text.trim()
  const [rawCmd, ...rest] = text.split(/\s+/)
  const cmd = rawCmd.startsWith('/') ? rawCmd.slice(1).split('@')[0].toLowerCase() : ''
  const arg = rest.join(' ')
  const isGroup = m.chat.type === 'group' || m.chat.type === 'supergroup'

  if (cmd === 'verify') return onVerify(m, arg)
  if (isGroup) {
    if (cmd === 'gate') return onGate(m, arg, origin)
    if (cmd === 'ungate') return onUngate(m)
    if (cmd === 'status') return onStatus(m)
    return
  }
  if (m.chat.type !== 'private') return
  const code = text.match(/rp2_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0]
  if (code) return onProof(m, code)
  if (cmd === 'start' || cmd === 'help' || !cmd) return onStart(m, origin)
}

// ---------------------------------------------------------------- admins

async function isAdmin(chatId: number, userId: number) {
  const mem = await tg<{ status: string }>('getChatMember', { chat_id: chatId, user_id: userId }).catch(() => null)
  return mem?.status === 'creator' || mem?.status === 'administrator'
}

async function onGate(m: Message, arg: string, origin: string) {
  if (!(await isAdmin(m.chat.id, m.from!.id))) return send(m.chat.id, 'Only group admins can set the gate.')
  const token = arg.match(/rg1_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0]
  if (!token)
    return send(m.chat.id, `Create a gate at <a href="${origin}/app/gates">${esc(new URL(origin).host)}/app/gates</a>, then send <code>/gate rg1_…</code> here.`)
  const gate = await openGate(token)
  if (!gate) return send(m.chat.id, 'That gate code is invalid. Copy the bot command again from the Gates page.')

  let invite: { invite_link: string }
  try {
    invite = await tg('createChatInviteLink', { chat_id: m.chat.id, name: `Parhelion · ${gate.name}`.slice(0, 32), creates_join_request: true })
  } catch (e) {
    const why = e instanceof TgError ? e.description : 'unknown error'
    return send(m.chat.id, `I need to be an admin with the <b>Invite users via link</b> permission to gate this group.\n<i>${esc(why)}</i>`)
  }
  const b: Binding = { token, gateId: gate.id, invite: invite.invite_link, title: m.chat.title ?? 'this group', by: m.from!.id, at: Date.now() }
  await kvSet(chatKey(m.chat.id), b)
  return send(
    m.chat.id,
    [
      `🕶️ <b>${esc(b.title)} is now gated.</b>`,
      `Rule: <b>${esc(claim(gate))}</b>`,
      '',
      `Share this invite link — new members must send me a Parhelion proof before they’re let in:`,
      invite.invite_link,
      '',
      '<i>Tip: revoke older invite links so everyone joins through the gate.</i>',
    ].join('\n'),
  )
}

async function onUngate(m: Message) {
  if (!(await isAdmin(m.chat.id, m.from!.id))) return send(m.chat.id, 'Only group admins can remove the gate.')
  const b = await kvGet<Binding>(chatKey(m.chat.id))
  if (b) await tg('revokeChatInviteLink', { chat_id: m.chat.id, invite_link: b.invite }).catch(() => {})
  await kvDel(chatKey(m.chat.id))
  return send(m.chat.id, 'Gate removed. The gated invite link was revoked.')
}

async function onStatus(m: Message) {
  const b = await kvGet<Binding>(chatKey(m.chat.id))
  const gate = b && (await openGate(b.token))
  if (!b || !gate) return send(m.chat.id, 'This group is not gated. Admins: <code>/gate rg1_…</code>')
  return send(m.chat.id, `🕶️ Gate: <b>${esc(gate.name)}</b>\nRule: <b>${esc(claim(gate))}</b>\nInvite: ${b.invite}`)
}

// ---------------------------------------------------------------- members

async function onJoinRequest(r: JoinRequest, origin: string) {
  const b = await kvGet<Binding>(chatKey(r.chat.id))
  const gate = b && (await openGate(b.token))
  if (!b || !gate) return // not gated by us — leave it to the admins

  const key = await pendKey(r.from.id)
  const pend = prune((await kvGet<Pending>(key)) ?? {})
  pend[String(r.chat.id)] = { title: r.chat.title ?? b.title, exp: Date.now() + PENDING_TTL }
  await kvSet(key, pend)

  const link = `${origin}/app/prove?gate=${encodeURIComponent(b.token)}`
  await send(
    r.user_chat_id,
    [
      `👋 To join <b>${esc(r.chat.title ?? b.title)}</b>, prove you hold the bag:`,
      `<b>${esc(claim(gate))}</b>`,
      '',
      '1. Tap <b>Get my proof</b> and sign once with your wallet (free, not a transaction).',
      '2. Paste the proof code (<code>rp2_…</code>) here.',
      '',
      '<i>The group never sees your wallet or balance.</i>',
    ].join('\n'),
    { reply_markup: { inline_keyboard: [[{ text: '🕶️ Get my proof', url: link }]] } },
  )
}

async function onProof(m: Message, code: string) {
  const r = await checkProof(code)
  if (!r.ok) return send(m.chat.id, `❌ ${esc(r.reason)}`)
  const p = r.proof

  const key = await pendKey(m.from!.id)
  const pend = prune((await kvGet<Pending>(key)) ?? {})
  const chats = Object.keys(pend)
  if (!chats.length) return send(m.chat.id, `✅ Valid proof: <b>${esc(claim(p))}</b>\n\nTo join a gated group, request to join through its invite link first, then send the proof here.`)

  let shortfall: GatePayload | null = null
  for (const chatId of chats) {
    const b = await kvGet<Binding>(chatKey(Number(chatId)))
    const gate = b && (await openGate(b.token))
    if (!b || !gate) {
      delete pend[chatId]
      continue
    }
    if (!meetsGate(p, gate)) {
      shortfall = gate
      continue
    }
    if (!(await kvCreate(usedKey(chatId, p.id), { at: Date.now() })))
      return send(m.chat.id, '⚠️ This proof was already used to join this group. Generate a fresh one with the same link.')
    try {
      await tg('approveChatJoinRequest', { chat_id: Number(chatId), user_id: m.from!.id })
    } catch (e) {
      await kvDel(usedKey(chatId, p.id)) // give the proof back
      const why = e instanceof TgError ? e.description : ''
      delete pend[chatId]
      await kvSet(key, pend)
      return send(m.chat.id, `I couldn’t approve your request${why ? ` (<i>${esc(why)}</i>)` : ''}. It may have expired — request to join again.`)
    }
    const title = pend[chatId].title
    delete pend[chatId]
    if (Object.keys(pend).length) await kvSet(key, pend)
    else await kvDel(key)
    return send(m.chat.id, `✅ <b>Welcome to ${esc(title)}.</b>\nProof accepted: ${esc(claim(p))}. Your wallet stays hidden. 🕶️`)
  }
  await kvSet(key, pend)
  if (shortfall) return send(m.chat.id, `❌ This proof says <b>${esc(claim(p))}</b>, but the group needs <b>${esc(claim(shortfall))}</b>.\nUse the <b>Get my proof</b> button to make one for this gate.`)
  return send(m.chat.id, 'Your join request has expired. Request to join the group again.')
}

async function onVerify(m: Message, arg: string) {
  const code = arg.match(/rp2_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0]
  if (!code) return send(m.chat.id, 'Send <code>/verify rp2_…</code>')
  const r = await checkProof(code)
  if (!r.ok) return send(m.chat.id, `❌ <b>Invalid.</b> ${esc(r.reason)}`)
  return send(m.chat.id, proofCard(r.proof))
}

function onStart(m: Message, origin: string) {
  return send(
    m.chat.id,
    [
      '🕶️ <b>Parhelion</b> — private holder proofs on Solana.',
      '',
      '<b>Holders:</b> request to join a gated group, then paste your proof here. Your wallet stays hidden.',
      '<b>Admins:</b> add me to your group as admin, create a gate in the app, and send <code>/gate rg1_…</code> in the group.',
      '<b>Anyone:</b> <code>/verify rp2_…</code> checks a proof.',
      '',
      `App: ${origin}/app · Docs: ${origin}/docs`,
    ].join('\n'),
  )
}

const proofCard = (p: ProofPayload) =>
  [
    `✅ <b>Valid proof</b>`,
    `<b>${esc(claim(p))}</b>`,
    p.gn ? `Gate: ${esc(p.gn)}` : '',
    `Expires: ${new Date(p.exp).toUTCString().replace(' GMT', ' UTC')}`,
    `Proof ID: <code>${esc(p.id)}</code>`,
    '<i>Wallet: hidden.</i>',
  ]
    .filter(Boolean)
    .join('\n')

function prune(p: Pending) {
  const now = Date.now()
  for (const k of Object.keys(p)) if (p[k].exp < now) delete p[k]
  return p
}
