/**
 * GET /api/discord-cron — daily (vercel.json "crons"). Removes Parhelion holder roles whose proof has expired,
 * so a role always reflects a current proof. Idempotent: running it early only removes already-expired roles.
 */
import { json } from './_lib/http.js'
import { kvDel, kvKeys } from './_lib/kv.js'
import { DcError, dc, hasDiscord } from './_lib/discord.js'

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) return json({ ok: false }, 401)
  if (!hasDiscord()) return json({ ok: true, skipped: 'discord not configured' })

  const now = Date.now()
  let removed = 0
  let kept = 0
  const errors: string[] = []
  for (const key of await kvKeys('dc/grant/')) {
    const m = key.match(/^dc\/grant\/(\d+)_(\d+)_(\d+)_(\d+)\.json$/)
    if (!m) continue
    const [, guild, user, role, exp] = m
    if (Number(exp) > now) {
      kept++
      continue
    }
    try {
      await dc('DELETE', `/guilds/${guild}/members/${user}/roles/${role}`)
    } catch (e) {
      // 404 = member left or role deleted: nothing to undo. Anything else: retry tomorrow.
      if (!(e instanceof DcError && e.status === 404)) {
        errors.push(e instanceof Error ? e.message : 'error')
        continue
      }
    }
    await kvDel(key)
    removed++
  }
  return json({ ok: errors.length === 0, removed, active: kept, errors: errors.slice(0, 10) })
}
