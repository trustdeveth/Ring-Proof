import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Serves ./api/*.ts during `npm run dev` with the same contract Vercel uses in production:
 * each file exports GET/POST(request: Request) => Response.
 */
function vercelApiDev(): Plugin {
  return {
    name: 'vercel-api-dev',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        const route = req.url.split('?')[0].replace(/^\/api\//, '').replace(/\/$/, '')
        let file = path.resolve(server.config.root, 'api', `${route}.ts`)
        // dynamic segment, like Vercel: api/spr/[method].ts serves /api/spr/<anything>
        if (!fs.existsSync(file) && route.includes('/')) {
          const dir = path.resolve(server.config.root, 'api', route.slice(0, route.lastIndexOf('/')))
          const dyn = fs.existsSync(dir) ? fs.readdirSync(dir).find((f) => /^\[[a-z]+\]\.ts$/i.test(f)) : undefined
          if (dyn) file = path.join(dir, dyn)
        }
        if (route.startsWith('_') || !fs.existsSync(file)) {
          res.statusCode = 404
          return res.end(JSON.stringify({ error: 'Not found' }))
        }
        try {
          const mod = await server.ssrLoadModule(file)
          const handler = mod[req.method ?? 'GET']
          if (typeof handler !== 'function') {
            res.statusCode = 405
            return res.end(JSON.stringify({ error: 'Method not allowed' }))
          }
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const hasBody = !['GET', 'HEAD'].includes(req.method ?? 'GET')
          const request = new Request(`http://${req.headers.host}${req.url}`, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: hasBody ? Buffer.concat(chunks) : undefined,
          })
          const response: Response = await handler(request)
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (e) {
          server.ssrFixStacktrace(e as Error)
          console.error(e)
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'Function crashed (see terminal)' }))
        }
      })
    },
  }
}


/**
 * @lightprotocol/hasher.rs (Helius Privacy Rings' Poseidon) loads its wasm with `new URL('x.wasm', import.meta.url)`,
 * which Vite leaves as-is. Ship those files next to the chunks so the URL resolves in production.
 */
function lightHasherWasm(): Plugin {
  const files = ['light_wasm_hasher_bg.wasm', 'hasher_wasm_simd_bg.wasm']
  return {
    name: 'light-hasher-wasm',
    apply: 'build',
    generateBundle() {
      for (const f of files) {
        const src = path.resolve('node_modules/@lightprotocol/hasher.rs/dist', f)
        if (fs.existsSync(src)) this.emitFile({ type: 'asset', fileName: `assets/${f}`, source: fs.readFileSync(src) })
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  // make server-only vars from .env / .env.local visible to api/ in dev, like Vercel does
  const env = loadEnv(mode, process.cwd(), '')
  for (const [k, v] of Object.entries(env)) if (!(k in process.env)) process.env[k] = v
  return {
    plugins: [react(), vercelApiDev(), lightHasherWasm()],
  }
})
