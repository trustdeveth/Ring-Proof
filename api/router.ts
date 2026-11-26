/**
 * The one Vercel Function behind every /api/* route (the Hobby plan allows 12 functions per deployment).
 * vercel.json rewrites /api/<path> → /api/router?__p=<path>; we rebuild the original URL and dispatch to the
 * route module in api/_routes, so each route keeps its own GET/POST handlers and its original URL.
 */
import { json } from './_lib/http.js'
import * as asset from './_routes/asset.js'
import * as attest from './_routes/attest.js'
import * as balance from './_routes/balance.js'
import * as challenge from './_routes/challenge.js'
import * as config from './_routes/config.js'
import * as discord from './_routes/discord.js'
import * as discordCron from './_routes/discord-cron.js'
import * as fee from './_routes/fee.js'
import * as gate from './_routes/gate.js'
import * as health from './_routes/health.js'
import * as ringAttest from './_routes/ring-attest.js'
import * as spr from './_routes/spr.js'
import * as telegram from './_routes/telegram.js'
import * as verify from './_routes/verify.js'
import * as zkAttest from './_routes/zk-attest.js'

type Handler = (req: Request) => Response | Promise<Response>
type Route = { GET?: Handler; POST?: Handler }

const ROUTES: Record<string, Route> = {
  asset,
  attest,
  balance,
  challenge,
  config,
  discord,
  'discord-cron': discordCron,
  fee,
  gate,
  health,
  'ring-attest': ringAttest,
  spr, // spr/<method>
  telegram,
  verify,
  'zk-attest': zkAttest,
}

async function dispatch(req: Request): Promise<Response> {
  const url = new URL(req.url)
  // path from the rewrite (__p), or from the URL itself when called as /api/<route> directly (local dev)
  const path = (url.searchParams.get('__p') ?? url.pathname.replace(/^\/api\/?/, '')).replace(/^\/+|\/+$/g, '')
  url.searchParams.delete('__p')
  url.pathname = `/api/${path}`
  const route = ROUTES[path.split('/')[0]]
  if (!route) return json({ error: 'Not found' }, 404)
  const handler = route[req.method as 'GET' | 'POST']
  if (!handler) return json({ error: 'Method not allowed' }, 405)
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer()
  return handler(new Request(url, { method: req.method, headers: req.headers, body }))
}

export const GET = dispatch
export const POST = dispatch
