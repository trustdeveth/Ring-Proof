import { json } from './_lib/http.js'
import { isAddress } from './_lib/b58.js'
import { botUsername } from './_lib/telegram.js'
import { hasDiscord, installUrl } from './_lib/discord.js'

/** GET /api/config — public app config. */
export async function GET() {
  const mint = process.env.PROOF_MINT
  return json(
    { proofMint: mint && isAddress(mint) ? mint : null, network: 'mainnet', telegramBot: await botUsername(), discordInstall: hasDiscord() ? installUrl() : null },
    200,
    { 'cache-control': 'public, max-age=60' },
  )
}
