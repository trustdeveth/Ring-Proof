/**
 * Parhelion Discord bot — slash commands over HTTP interactions, all on Vercel (no always-on gateway).
 *
 * Admins: /gate token:<rg1_…> role:@Role  → binds a Parhelion gate to a role and posts a "get your proof" panel.
 * Members: /verify proof:<rp2_…>          → a valid, unexpired proof that meets the gate gets the role.
 * Roles are removed again when the proof expires (daily cron: /api/discord-cron). No wallets are stored.
 *
 * GET  /api/discord           → status + install link
 * GET  /api/discord?setup=1   → registers slash commands and this deployment's interactions endpoint
 * POST /api/discord           → interactions (ed25519-signed by Discord)
 */
import { waitUntil } from '@vercel/functions'
import { json } from '../_lib/http.js'
import { hasKv, kvCreate, kvDel, kvGet, kvKeys, kvSet } from '../_lib/kv.js'
import { checkProof, claim, meetsGate, openGate } from '../_lib/proof.js'
import { DcError, PERM, canManage, dc, hasDiscord, installUrl, verifyInteraction } from '../_lib/discord.js'
import { siteOrigin } from '../_lib/telegram.js'
import type { GatePayload, ProofPayload } from '../_lib/types.js'

type Opt = { name: string; type: number; value: string }
type Interaction = {
  type: number
  token: string
  application_id: string
  guild_id?: string
  member?: { user: { id: string }; permissions?: string }
  data?: { name: string; options?: Opt[]; resolved?: { roles?: Record<string, { name: string; managed?: boolean }> } }
}
type GuildDoc = { gates: Record<string, { token: string; gateId: string; roleName: string; at: number }> }

const EPHEMERAL = 64
const NO_PINGS = { parse: [] as string[] }
const guildKey = (g: string) => `dc/guild/${g}.json`
const usedKey = (g: string, proofId: string) => `dc/used/${g}/${proofId}.json`
const grantPrefix = (g: string, u: string, r: string) => `dc/grant/${g}_${u}_${r}_`

const STR = 3
const ROLE = 8
const COMMANDS = [
  {
    name: 'verify',
    description: 'Paste your Parhelion proof to get the holder role',
    options: [{ type: STR, name: 'proof', description: 'Your proof code (rp2_…)', required: true, max_length: 6000 }],
  },
  {
    name: 'check',
    description: 'Check any Parhelion proof and show its claim',
    options: [{ type: STR, name: 'proof', description: 'Proof code (rp2_…)', required: true, max_length: 6000 }],
  },
  { name: 'gates', description: 'Show this server’s holder roles and how to get them' },
  {
    name: 'gate',
    description: 'Admins: give a role to holders who prove a Parhelion gate',
    default_member_permissions: String(PERM.MANAGE_ROLES),
    options: [
      { type: STR, name: 'token', description: 'Gate code from the Parhelion app (rg1_…)', required: true, max_length: 6000 },
      { type: ROLE, name: 'role', description: 'Role to give verified holders', required: true },
    ],
  },
  {
    name: 'ungate',
    description: 'Admins: stop managing a role',
    default_member_permissions: String(PERM.MANAGE_ROLES),
    options: [{ type: ROLE, name: 'role', description: 'Role to remove from Parhelion', required: true }],
  },
].map((c) => ({ ...c, contexts: [0], integration_types: [0] }))

// ---------------------------------------------------------------- HTTP

export async function GET(req: Request) {
  if (!hasDiscord()) return json({ ok: false, error: 'Set DISCORD_APP_ID, DISCORD_PUBLIC_KEY and DISCORD_BOT_TOKEN' }, 503)
  const app = process.env.DISCORD_APP_ID!
  try {
    if (new URL(req.url).searchParams.get('setup')) {
      const endpoint = `${siteOrigin(req)}/api/discord`
      const cmds = await dc<unknown[]>('PUT', `/applications/${app}/commands`, COMMANDS)
      let endpointSet: string | true = true
      try {
        // Discord pings the endpoint (signed) before accepting it.
        await dc('PATCH', '/applications/@me', {
          interactions_endpoint_url: endpoint,
          description: 'Private holder proofs on Solana. Prove you hold the bag — your wallet stays hidden.',
        })
      } catch (e) {
        endpointSet = e instanceof Error ? e.message : 'failed'
      }
      return json({ ok: endpointSet === true, commands: cmds.length, endpoint, endpointSet, install: installUrl() })
    }
    const cmds = await dc<{ name: string }[]>('GET', `/applications/${app}/commands`)
    return json({ ok: true, commands: cmds.map((c) => c.name), install: installUrl(), storage: hasKv() ? 'vercel-blob' : 'memory (dev only)' })
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'error' }, 502)
  }
}

export async function POST(req: Request) {
  if (!hasDiscord()) return json({ error: 'not configured' }, 503)
  const body = await req.text()
  if (!verifyInteraction(body, req.headers.get('x-signature-ed25519'), req.headers.get('x-signature-timestamp')))
    return new Response('invalid request signature', { status: 401 })
  const i = JSON.parse(body) as Interaction
  if (i.type === 1) return json({ type: 1 }) // PING
  if (i.type !== 2 || !i.data) return json({ type: 4, data: { content: 'Unsupported interaction.', flags: EPHEMERAL } })
  if (!i.guild_id || !i.member) return reply('Use Parhelion commands inside a server.')

  const origin = siteOrigin(req)
  const opt = (n: string) => i.data!.options?.find((o) => o.name === n)?.value ?? ''
  switch (i.data.name) {
    case 'check':
      return onCheck(opt('proof'))
    case 'gates':
      return onGates(i.guild_id, origin)
    case 'gate':
      return onGate(i, opt('token'), opt('role'), origin)
    case 'ungate':
      return onUngate(i, opt('role'))
    case 'verify': {
      // role changes + storage can exceed Discord's 3s window → acknowledge now, finish in the background
      waitUntil(
        onVerify(i, opt('proof'), origin)
          .catch((e) => ({ content: `Something went wrong. Try again in a minute.${e instanceof DcError ? `\n-# ${e.detail}` : ''}` }))
          .then((msg) => dc('PATCH', `/webhooks/${i.application_id}/${i.token}/messages/@original`, { allowed_mentions: NO_PINGS, ...msg }, false))
          .catch((e) => console.error('discord verify follow-up failed', e)),
      )
      return json({ type: 5, data: { flags: EPHEMERAL } })
    }
  }
  return reply('Unknown command.')
}

// ---------------------------------------------------------------- commands

const reply = (content: string, extra: Record<string, unknown> = {}, ephemeral = true) =>
  json({ type: 4, data: { content, allowed_mentions: NO_PINGS, ...(ephemeral ? { flags: EPHEMERAL } : {}), ...extra } })

const proveButton = (origin: string, token: string, label = 'Get my proof') => ({
  type: 2,
  style: 5,
  label,
  emoji: { name: '🕶️' },
  url: `${origin}/app/prove?gate=${encodeURIComponent(token)}`,
})
const rows = (buttons: object[]) => {
  const out = []
  for (let k = 0; k < Math.min(buttons.length, 25); k += 5) out.push({ type: 1, components: buttons.slice(k, k + 5) })
  return out
}

function onCheck(code: string) {
  return checkProof(code).then((r) =>
    r.ok
      ? reply(card(r.proof), {}, false)
      : reply(`❌ **Invalid.** ${r.reason}`),
  )
}

const card = (p: ProofPayload) =>
  [
    '✅ **Valid Parhelion proof**',
    `**${claim(p)}**`,
    p.gn ? `Gate: ${p.gn}` : '',
    `Expires <t:${Math.floor(p.exp / 1000)}:R> · ID \`${p.id}\``,
    '-# Wallet: hidden.',
  ]
    .filter(Boolean)
    .join('\n')

async function onGates(guild: string, origin: string) {
  const doc = await kvGet<GuildDoc>(guildKey(guild))
  const entries = Object.entries(doc?.gates ?? {})
  if (!entries.length) return reply('No holder roles yet. Admins: `/gate token:rg1_… role:@Role`')
  const lines: string[] = []
  const buttons: object[] = []
  for (const [roleId, g] of entries) {
    const gate = await openGate(g.token)
    if (!gate) continue
    lines.push(`<@&${roleId}> — **${claim(gate)}**`)
    buttons.push(proveButton(origin, g.token, `${gate.name}`.slice(0, 80)))
  }
  return reply(['🕶️ **Holder roles**', ...lines, '', 'Get a proof, then run `/verify` and paste it. Your wallet stays hidden.'].join('\n'), { components: rows(buttons) })
}

async function onGate(i: Interaction, token: string, roleId: string, origin: string) {
  if (!canManage(i.member!.permissions)) return reply('You need the **Manage Roles** permission.')
  const gate = await openGate(token.trim())
  if (!gate) return reply('That gate code is invalid. Copy it again from the Gates page in the Parhelion app.')
  const role = i.data!.resolved?.roles?.[roleId]
  if (!role || roleId === i.guild_id || role.managed) return reply('Pick a normal role (not @everyone or a bot role).')

  const doc = (await kvGet<GuildDoc>(guildKey(i.guild_id!))) ?? { gates: {} }
  doc.gates[roleId] = { token: token.trim(), gateId: gate.id, roleName: role.name, at: Date.now() }
  await kvSet(guildKey(i.guild_id!), doc)
  return reply(
    [
      `🕶️ **<@&${roleId}> is now a Parhelion holder role**`,
      `Rule: **${claim(gate)}**`,
      '',
      '**How to get it**',
      '1. Tap **Get my proof** and sign once with your wallet (free, not a transaction).',
      '2. Run `/verify` here and paste the proof.',
      '',
      '-# The server never sees your wallet or balance. The role is removed when your proof expires.',
      '-# Admins: make sure the Parhelion bot’s role is **above** this role in Server Settings → Roles.',
    ].join('\n'),
    { components: rows([proveButton(origin, token.trim())]) },
    false,
  )
}

async function onUngate(i: Interaction, roleId: string) {
  if (!canManage(i.member!.permissions)) return reply('You need the **Manage Roles** permission.')
  const doc = await kvGet<GuildDoc>(guildKey(i.guild_id!))
  if (!doc?.gates[roleId]) return reply('That role is not managed by Parhelion.')
  delete doc.gates[roleId]
  await kvSet(guildKey(i.guild_id!), doc)
  return reply(`Parhelion no longer manages <@&${roleId}>. Members keep the role until you remove it.`)
}

async function onVerify(i: Interaction, code: string, origin: string): Promise<Record<string, unknown>> {
  const guild = i.guild_id!
  const user = i.member!.user.id
  const r = await checkProof(code)
  if (!r.ok) return { content: `❌ ${r.reason}` }
  const p = r.proof

  const doc = await kvGet<GuildDoc>(guildKey(guild))
  const gates: [string, GatePayload, string][] = []
  for (const [roleId, g] of Object.entries(doc?.gates ?? {})) {
    const gate = await openGate(g.token)
    if (gate) gates.push([roleId, gate, g.token])
  }
  if (!gates.length) return { content: `✅ Valid proof: **${claim(p)}**\nThis server has no holder roles yet.` }

  const matched = gates.filter(([, gate]) => meetsGate(p, gate))
  if (!matched.length)
    return {
      content: [`❌ Your proof says **${claim(p)}**, which doesn’t meet any holder role here:`, ...gates.map(([rid, g]) => `<@&${rid}> needs **${claim(g)}**`)].join('\n'),
      components: rows(gates.map(([, g, t]) => proveButton(origin, t, g.name.slice(0, 80)))),
    }

  if (!(await kvCreate(usedKey(guild, p.id), { at: Date.now() })))
    return { content: '⚠️ This proof was already used in this server. Generate a fresh one with **Get my proof**.' }

  const given: string[] = []
  const failed: string[] = []
  for (const [roleId] of matched) {
    try {
      await dc('PUT', `/guilds/${guild}/members/${user}/roles/${roleId}`)
      given.push(roleId)
      for (const k of await kvKeys(grantPrefix(guild, user, roleId))) await kvDel(k)
      await kvSet(`${grantPrefix(guild, user, roleId)}${p.exp}.json`, {})
    } catch (e) {
      failed.push(roleId)
      console.error('discord role assign failed', e)
    }
  }
  if (!given.length) {
    await kvDel(usedKey(guild, p.id)) // nothing happened — let the proof be used again
    return { content: '⚠️ Your proof is valid, but I couldn’t give the role. An admin needs to move the **Parhelion** bot role above the holder role (Server Settings → Roles).' }
  }
  return {
    content: [
      `✅ **Verified.** You now have ${given.map((r) => `<@&${r}>`).join(', ')}.`,
      `Proof: ${claim(p)} · role expires <t:${Math.floor(p.exp / 1000)}:R> with your proof.`,
      failed.length ? `-# Couldn’t give ${failed.map((r) => `<@&${r}>`).join(', ')} — ask an admin to check the bot’s role position.` : '',
      '-# Your wallet stays hidden. 🕶️',
    ]
      .filter(Boolean)
      .join('\n'),
  }
}
