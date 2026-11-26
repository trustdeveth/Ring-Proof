import { useEffect, useState, type ReactNode } from 'react'
import { Logo, PixelShades } from '../landing/icons'
import './docs.css'

const TICKER = '$PRHL'

const NAV: { group: string; items: [id: string, label: string][] }[] = [
  { group: 'Start here', items: [['introduction', 'Introduction'], ['how-it-works', 'How it works'], ['get-a-proof', 'Get a proof']] },
  { group: 'Using Parhelion', items: [['verify', 'Verify a proof'], ['ring', 'Privacy Ring & ZK proofs'], ['gates', 'Gates for projects'], ['telegram', 'Telegram bot'], ['discord', 'Discord bot'], ['privacy', 'What stays private']] },
  { group: 'Technical', items: [['security', 'Security model'], ['api', 'API reference'], ['limits', 'Known limits']] },
  { group: 'Project', items: [['token', TICKER], ['roadmap', 'Roadmap'], ['faq', 'FAQ']] },
]
const IDS = NAV.flatMap((g) => g.items.map(([id]) => id))

type Item = [state: 'done' | 'active' | 'next', text: string]
const PHASES: { n: string; title: string; status: 'live' | 'active' | 'planned'; label: string; goal: string; items: Item[] }[] = [
  {
    n: '01', title: 'Launch', status: 'live', label: 'Live',
    goal: 'Private holder proofs on Solana mainnet.',
    items: [
      ['done', 'Wallet-signed holder proofs, wallet never in the proof'],
      ['done', 'SOL, SPL and Token-2022 support with live on-chain balances'],
      ['done', 'Public verification, no wallet needed'],
      ['done', 'Gates with shareable holder links'],
      ['done', 'Documentation and public API'],
    ],
  },
  {
    n: '02', title: 'Enforcement', status: 'live', label: 'Live',
    goal: 'Gates that enforce themselves, no admin in the loop.',
    items: [
      ['done', 'Telegram bot: proof-checked join requests, approved automatically'],
      ['done', 'One-time proof IDs per group, so proofs cannot be replayed'],
      ['done', 'Discord bot: holder roles by proof, removed when the proof expires'],
      ['done', `${TICKER} gate fees with on-chain burn`],
    ],
  },
  {
    n: '03', title: 'Private balances', status: 'live', label: 'Live',
    goal: 'Prove holdings that live inside Helius Privacy Rings.',
    items: [
      ['done', 'Privacy Rings integration: keys derived, notes synced and decrypted in your browser'],
      ['done', 'Proofs over Ring balances: owner, inclusion and unspent status checked on-chain'],
      ['done', 'Tested on Solana mainnet'],
    ],
  },
  {
    n: '04', title: 'Zero-knowledge', status: 'live', label: 'Live',
    goal: 'Proofs nobody has to trust, not even Parhelion.',
    items: [
      ['done', 'Zero-knowledge balance circuit (Groth16), proven in the browser'],
      ['done', 'Verifier: proof + live Ring roots, one admission per holder per gate'],
      ['done', 'Public trusted-setup ceremony'],
      ['done', 'Independent security audit'],
    ],
  },
]

function Roadmap() {
  return (
    <ol className="rm">
      {PHASES.map((ph) => {
        const done = ph.items.filter(([st]) => st === 'done').length
        return (
          <li key={ph.n} className={`rm__phase rm__phase--${ph.status}`}>
            <span className="rm__node" aria-hidden="true">{ph.status === 'live' ? '✓' : ph.n}</span>
            <div className="rm__card">
              <div className="rm__head">
                <span className="rm__n">Phase {ph.n}</span>
                <span className={`rm__pill rm__pill--${ph.status}`}>{ph.label}</span>
              </div>
              <h3>{ph.title}</h3>
              <p className="rm__goal">{ph.goal}</p>
              <div className="rm__bar" aria-label={`${done} of ${ph.items.length} delivered`}>
                <i style={{ width: `${(done / ph.items.length) * 100}%` }} />
              </div>
              <p className="rm__count">{done}/{ph.items.length} delivered</p>
              <ul className="rm__items">
                {ph.items.map(([st, t]) => (
                  <li key={t} className={`rm__item rm__item--${st}`}>
                    <span aria-hidden="true">{st === 'done' ? '✓' : st === 'active' ? '◐' : '○'}</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function useActiveSection() {
  const [active, setActive] = useState(IDS[0])
  useEffect(() => {
    const els = IDS.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (vis[0]) setActive(vis[0].target.id)
      },
      { rootMargin: '-90px 0px -65% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
  return active
}

function Section({ id, kicker, title, children }: { id: string; kicker: string; title: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="doc-sec">
      <p className="doc-kicker">{kicker}</p>
      <h2 className="doc-h2">
        <a href={`#${id}`}>{title}</a>
      </h2>
      {children}
    </section>
  )
}

const Note = ({ tone = 'yellow', title, children }: { tone?: string; title: string; children: ReactNode }) => (
  <div className={`doc-note doc-note--${tone}`}>
    <strong>{title}</strong>
    <div>{children}</div>
  </div>
)

const Code = ({ children }: { children: string }) => <pre className="doc-code">{children}</pre>

export default function Docs() {
  const active = useActiveSection()

  useEffect(() => {
    document.title = 'Parhelion Docs: private holder proofs on Solana'
    document.body.dataset.theme = 'cream'
    if (window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView()
  }, [])

  return (
    <div className="docs">
      <header className="docs-top">
        <a href="/" className="brand" aria-label="Parhelion home">
          <Logo size={28} /> Parhelion <span className="docs-top__tag">Docs</span>
        </a>
        <div className="docs-top__right">
          <a className="docs-top__link" href="/">Site</a>
          <a className="docs-top__link" href="https://x.com/parhelioninwork" target="_blank" rel="noopener noreferrer">X</a>
          <a className="btn btn--ink btn--sm" href="/app">
            <span className="btn__label">Launch app</span>
          </a>
        </div>
      </header>

      <div className="docs-layout">
        <nav className="docs-side" aria-label="Docs">
          {NAV.map((g) => (
            <div key={g.group} className="docs-side__group">
              <p>{g.group}</p>
              {g.items.map(([id, label]) => (
                <a key={id} href={`#${id}`} className={active === id ? 'on' : ''}>
                  {label}
                </a>
              ))}
            </div>
          ))}
        </nav>

        <main className="docs-main">
          <div className="docs-hero">
            <span className="chip chip--yellow">Documentation</span>
            <h1>
              Prove you’re a <span className="hl hl--blue">whale.</span> Stay invisible.
            </h1>
            <p>
              Parhelion issues private holder proofs on Solana. A proof says one thing, like “holds ≥ 1,000,000 {TICKER}”,
              and never says which wallet it came from.
            </p>
            <div className="docs-hero__shades" aria-hidden="true">
              <PixelShades width={120} />
            </div>
          </div>

          <Section id="introduction" kicker="Start here" title="Introduction">
            <p>
              On Solana every wallet is public. Joining a holder chat, an allowlist or a gated Discord usually means
              pasting your address or linking your wallet to your account. From then on, the admins, the bots and anyone
              they share that list with can see your balance, every token you hold, your trades and your linked wallets.
            </p>
            <p>
              Parhelion separates <b>the fact</b> from <b>the wallet</b>. You sign one message, Parhelion checks your
              balance on-chain, and you get a sealed proof of the claim only. Groups check the proof, not your wallet.
            </p>
            <div className="doc-cards">
              <div className="doc-card doc-card--aqua"><b>For holders</b><span>Get into whale chats and allowlists without doxxing your bag.</span></div>
              <div className="doc-card doc-card--pink"><b>For projects</b><span>Gate rooms by holdings without collecting a list of wallets.</span></div>
              <div className="doc-card doc-card--mint"><b>For anyone</b><span>Verify any proof in seconds. No wallet needed.</span></div>
            </div>
            <p className="doc-muted">
              Parhelion is built on Helius infrastructure and runs on Solana mainnet. The name comes from the parhelion,
              or sun dog: a bright spot of light that shines beside the sun.
            </p>
          </Section>

          <Section id="how-it-works" kicker="Start here" title="How it works">
            <ol className="doc-steps">
              <li>
                <b>Sign.</b> Connect any Solana wallet. Parhelion sends a one-time challenge message bound to the site’s domain and valid
                for 5 minutes. You sign it. It is not a transaction: no gas, no approvals, nothing moves.
              </li>
              <li>
                <b>Prove.</b> The server checks your signature, then reads your real balance live from Solana (SOL, any SPL token or
                Token-2022 token). If you meet the threshold, it seals a proof containing only the claim.
              </li>
              <li>
                <b>Pass.</b> Share the proof code or link. Anyone can verify it. The group learns that you qualify, and nothing else.
              </li>
            </ol>
            <Note title="What's inside a proof">
              The token, the threshold, the issue time, the expiry, a one-time proof ID and, if it was made for a gate, the gate’s
              ID and name. <b>No wallet address. No balance.</b>
            </Note>
          </Section>

          <Section id="get-a-proof" kicker="Start here" title="Get a proof">
            <ol className="doc-steps">
              <li>Open the <a href="/app">app</a> and connect your Solana wallet (Phantom, Solflare, Backpack and any Wallet Standard wallet).</li>
              <li>Go to <b>Prove</b>. Pick SOL, {TICKER} or paste any token mint address.</li>
              <li>Set the threshold you want to prove, for example 1,000,000. You can only prove amounts you actually hold.</li>
              <li>Choose an expiry: 1, 7 or 30 days.</li>
              <li>Press <b>Sign &amp; generate proof</b> and approve the message in your wallet.</li>
              <li>Copy the proof code (it starts with <code>rp2_</code>) or the share link, and send it to the group.</li>
            </ol>
            <Note tone="aqua" title="Tip">
              Prove a round threshold, not your exact balance. “Holds ≥ 1,000,000” reveals far less than “holds 1,284,227”.
            </Note>
          </Section>

          <Section id="verify" kicker="Using Parhelion" title="Verify a proof">
            <p>
              Anyone can check a proof at <a href="/app/verify">/app/verify</a> without connecting a wallet. Paste the code or open a
              share link. Parhelion checks three things:
            </p>
            <ul className="doc-list">
              <li><b>Seal:</b> the proof was issued by Parhelion and has not been changed by even one character.</li>
              <li><b>Expiry:</b> the proof is still within its 1, 7 or 30 day window.</li>
              <li><b>Format:</b> the proof version is supported.</li>
            </ul>
            <p>
              A valid result shows the claim, the expiry and the proof ID. An altered, forged or expired proof is rejected with
              the reason.
            </p>
            <Note tone="pink" title="For group admins">
              Admit each proof ID once. A proof is a bearer credential: whoever holds the code can show it, so record the ID when
              someone joins and refuse it if it appears again.
            </Note>
          </Section>

          <Section id="ring" kicker="Using Parhelion" title="Privacy Ring & ZK proofs">
            <p>
              Balances held in a Helius Privacy Ring are encrypted on-chain. Parhelion can prove them in two ways. Pick the
              source on the Prove page.
            </p>
            <div className="doc-table-wrap">
              <table className="doc-table">
                <thead><tr><th>Source</th><th>What Parhelion sees</th><th>How</th></tr></thead>
                <tbody>
                  <tr><td><b>Public wallet</b></td><td>Your public balance, once</td><td>Wallet signature + live on-chain read</td></tr>
                  <tr><td><b>Privacy Ring</b></td><td>The notes you choose to count, once</td><td>Your browser decrypts your notes; Parhelion checks each is yours, in the Ring and unspent</td></tr>
                  <tr><td><b>Zero-knowledge</b></td><td>Nothing but the proof</td><td>Your browser proves the balance with a Groth16 proof; Parhelion verifies it</td></tr>
                </tbody>
              </table>
            </div>
            <h3 className="doc-h3">How it works</h3>
            <ol className="doc-steps">
              <li><b>Unlock.</b> Your wallet signs the Privacy Rings key message. The Helius SDK derives your Ring viewing and nullifier keys in this tab. Your spending key never leaves the wallet.</li>
              <li><b>Decrypt.</b> Your encrypted notes are read through Parhelion’s read-only indexer relay and decrypted in your browser.</li>
              <li><b>Prove.</b> Ring mode sends the openings of the notes needed plus your nullifier key, which can check a note is unspent but cannot spend it. ZK mode proves the same facts in your browser and sends only the proof.</li>
            </ol>
            <Note tone="aqua" title="Zero-knowledge, precisely">
              The circuit proves: up to two unspent notes of the token, owned by your Ring key, are leaves of the Ring’s state tree, their
              nullifiers are absent from the nullifier tree, and they sum to at least the claim. Parhelion checks the proof and that both
              tree roots are live on-chain. A per-gate tag lets bots admit each holder once without learning who they are.
            </Note>
          </Section>

          <Section id="gates" kicker="Using Parhelion" title="Gates for projects">
            <p>
              A gate is a rule like “holds ≥ 5,000,000 {TICKER} to join @whale_room”. Create one under <b>Gates</b> in the app:
            </p>
            <ol className="doc-steps">
              <li>Name the gate, pick the token and set the minimum.</li>
              <li>Choose the platform (Telegram or Discord) and the room or role.</li>
              <li>Share the holder link. Holders who open it get the Prove form pre-filled with your rule.</li>
              <li>Proofs made through the link carry your gate’s ID and name, so you can tell they were made for your room.</li>
            </ol>
            <p>
              Gates are signed rules (<code>rg1_</code>), not database rows. Parhelion stores nothing about your gate or the people
              who use it, so there is no holder list to leak.
            </p>
          </Section>

          <Section id="telegram" kicker="Using Parhelion" title="Telegram bot">
            <p>
              The Parhelion bot enforces a gate inside Telegram. New members request to join, prove their holdings in a private chat
              with the bot, and are approved automatically. Admins never see a wallet.
            </p>
            <h3 className="doc-h3">For group admins</h3>
            <ol className="doc-steps">
              <li>Add the bot to your group and make it an <b>admin</b> with the <b>Invite users via link</b> permission.</li>
              <li>Create a gate in the app under <a href="/app/gates">Gates</a> and press <b>Copy bot command</b>.</li>
              <li>Paste the command (<code>/gate rg1_…</code>) in the group. The bot replies with a join-request invite link.</li>
              <li>Share that link and revoke older invite links, so everyone joins through the gate.</li>
            </ol>
            <h3 className="doc-h3">For members</h3>
            <ol className="doc-steps">
              <li>Open the group’s invite link and tap <b>Request to join</b>.</li>
              <li>The bot messages you. Tap <b>Get my proof</b>, sign once, and copy the proof.</li>
              <li>Paste the proof (<code>rp2_…</code>) in the chat with the bot. If it meets the gate, you’re in.</li>
            </ol>
            <div className="doc-table-wrap">
              <table className="doc-table">
                <thead><tr><th>Command</th><th>Where</th><th>What it does</th></tr></thead>
                <tbody>
                  <tr><td><code>/gate rg1_…</code></td><td>Group (admins)</td><td>Gates the group and creates the join-request link</td></tr>
                  <tr><td><code>/status</code></td><td>Group</td><td>Shows the group’s rule and link</td></tr>
                  <tr><td><code>/ungate</code></td><td>Group (admins)</td><td>Removes the gate and revokes its link</td></tr>
                  <tr><td><code>/verify rp2_…</code></td><td>Anywhere</td><td>Checks any proof and shows the claim</td></tr>
                </tbody>
              </table>
            </div>
            <Note tone="mint" title="What the bot remembers">
              Only three things, in private storage: which gate a group uses, the IDs of proofs already used in each group (so a proof
              works once), and open join requests under a one-way hashed user reference that expires after 48 hours. No wallets, no
              balances.
            </Note>
          </Section>

          <Section id="discord" kicker="Using Parhelion" title="Discord bot">
            <p>
              The Parhelion bot turns a gate into a Discord role. Members verify with a slash command, get the role, and lose it
              again when their proof expires, so the role always means a current holder.
            </p>
            <h3 className="doc-h3">For server admins</h3>
            <ol className="doc-steps">
              <li>Add the Parhelion bot to your server with the install link on the <a href="/app/gates">Gates</a> page. It only asks for <b>Manage Roles</b>.</li>
              <li>In Server Settings → Roles, drag the <b>Parhelion</b> role <b>above</b> the holder role it should give.</li>
              <li>Create a gate in the app, then run <code>/gate</code> in any channel: paste the gate code and pick the role.</li>
              <li>The bot posts a panel with a <b>Get my proof</b> button. Pin it.</li>
            </ol>
            <h3 className="doc-h3">For members</h3>
            <ol className="doc-steps">
              <li>Tap <b>Get my proof</b> on the panel, sign once, and copy the proof.</li>
              <li>Run <code>/verify</code> and paste it. Only you see the reply. If it meets the gate, you get the role.</li>
            </ol>
            <div className="doc-table-wrap">
              <table className="doc-table">
                <thead><tr><th>Command</th><th>Who</th><th>What it does</th></tr></thead>
                <tbody>
                  <tr><td><code>/verify proof</code></td><td>Members</td><td>Checks the proof and gives every holder role it meets</td></tr>
                  <tr><td><code>/gates</code></td><td>Anyone</td><td>Lists the server’s holder roles with proof buttons</td></tr>
                  <tr><td><code>/check proof</code></td><td>Anyone</td><td>Shows a proof’s claim in the channel</td></tr>
                  <tr><td><code>/gate token role</code></td><td>Manage Roles</td><td>Makes a role a Parhelion holder role</td></tr>
                  <tr><td><code>/ungate role</code></td><td>Manage Roles</td><td>Stops managing a role</td></tr>
                </tbody>
              </table>
            </div>
            <Note tone="mint" title="What the bot remembers">
              Which gate each role uses, the IDs of proofs already used in the server (a proof works once), and, for each role it gave,
              the member ID and the proof’s expiry so the role can be removed on time. No wallets, no balances.
            </Note>
          </Section>

          <Section id="privacy" kicker="Using Parhelion" title="What stays private">
            <div className="doc-table-wrap">
              <table className="doc-table">
                <thead>
                  <tr><th>Who</th><th>Sees</th><th>Never sees</th></tr>
                </thead>
                <tbody>
                  <tr><td><b>The group</b></td><td>Token, threshold, valid or not, expiry, proof ID</td><td>Your wallet, exact balance, other tokens, history, linked wallets</td></tr>
                  <tr><td><b>Anyone verifying</b></td><td>The same claim as the group</td><td>Everything else</td></tr>
                  <tr><td><b>Parhelion’s server</b></td><td>Your wallet and balance, once, while issuing the proof</td><td>Nothing is stored: no database, no logs of wallets</td></tr>
                </tbody>
              </table>
            </div>
            <Note tone="mint" title="Being precise">
              Parhelion hides your wallet from every group you join. With a public-wallet proof the server reads your public
              balance once to issue it. With a <a href="#ring">zero-knowledge proof</a> over a Privacy Ring balance, Parhelion
              receives only the proof and never sees your wallet, notes or amounts. (Zero-knowledge is in testing; see the{' '}
              <a href="#roadmap">roadmap</a>.)
            </Note>
          </Section>

          <Section id="security" kicker="Technical" title="Security model">
            <ul className="doc-list">
              <li><b>Wallet ownership.</b> Every proof needs an ed25519 signature from the wallet over a one-time challenge. The challenge names the site’s domain, expires after 5 minutes and is itself sealed, so it cannot be replayed or forged.</li>
              <li><b>Real balances.</b> Balances are read live from Solana mainnet through Helius at the moment of issue, never from user input.</li>
              <li><b>Tamper-proof proofs.</b> Proofs and gates are sealed with HMAC-SHA256 under a server-side secret, with a separate key per token type. Changing any byte breaks the seal.</li>
              <li><b>No wallet storage.</b> Proofs and gates are stateless. The bots keep only gate bindings, used proof IDs, short-lived join requests and role expiry times, never wallets or balances.</li>
              <li><b>Non-custodial.</b> Parhelion never asks for a private key, never sends a transaction and never touches funds.</li>
              <li><b>Short-lived.</b> Every proof expires in 1, 7 or 30 days, so a proof cannot outlive a sold bag for long.</li>
            </ul>
            <p className="doc-muted">Parhelion has not had an external audit yet. The zero-knowledge circuit and verifier will be audited, and its trusted setup re-run as a public ceremony, before they leave testing.</p>
          </Section>

          <Section id="api" kicker="Technical" title="API reference">
            <p>Bots and dashboards can verify proofs directly. All endpoints are JSON over HTTPS on the Parhelion domain.</p>
            <div className="doc-table-wrap">
              <table className="doc-table doc-table--api">
                <thead><tr><th>Endpoint</th><th>Purpose</th></tr></thead>
                <tbody>
                  <tr><td><code>POST /api/verify</code></td><td>Check a proof. Body <code>{'{ code }'}</code>. Returns the claim only.</td></tr>
                  <tr><td><code>POST /api/challenge</code></td><td>Get a one-time message for a wallet to sign. Body <code>{'{ owner }'}</code>.</td></tr>
                  <tr><td><code>POST /api/attest</code></td><td>Exchange a signed challenge for a proof.</td></tr>
                  <tr><td><code>POST /api/gate</code></td><td>Create a gate. Body <code>{'{ name, asset, min, platform, room }'}</code>.</td></tr>
                  <tr><td><code>POST /api/telegram</code></td><td>Telegram webhook, authenticated by Telegram’s secret token.</td></tr>
                  <tr><td><code>POST /api/discord</code></td><td>Discord interactions, authenticated by Discord’s ed25519 signature.</td></tr>
                  <tr><td><code>POST /api/ring-attest</code></td><td>Proof over a Privacy Ring balance (note openings + nullifier key).</td></tr>
                  <tr><td><code>POST /api/zk-attest</code></td><td>Verifies a zero-knowledge Ring balance proof. No wallet sent.</td></tr>
                  <tr><td><code>POST /api/spr/&lt;method&gt;</code></td><td>Read-only relay to the Privacy Rings indexer.</td></tr>
                  <tr><td><code>GET /api/fee</code></td><td>Current gate fee and burn share.</td></tr>
                  <tr><td><code>GET /api/asset?id=</code></td><td>Token decimals and symbol for a mint.</td></tr>
                  <tr><td><code>GET /api/health</code></td><td>Service status.</td></tr>
                </tbody>
              </table>
            </div>
            <p>Verify a proof:</p>
            <Code>{`curl -X POST https://<parhelion-domain>/api/verify \\
  -H "content-type: application/json" \\
  -d '{"code":"rp2_..."}'`}</Code>
            <p>Valid proof:</p>
            <Code>{`{
  "ok": true,
  "id": "9f3a2c21e",      // one-time proof ID: admit it once
  "a": "<mint or SOL>",   // token
  "s": "$PRHL",           // symbol at issue time
  "m": "1000000",         // proven minimum
  "iat": 1764115200000,   // issued at (ms)
  "exp": 1764720000000,   // expires at (ms)
  "g": "k2x9q", "gn": "Whale room"   // only for gate proofs
}`}</Code>
            <p>Invalid proof:</p>
            <Code>{`{ "ok": false, "reason": "This proof has expired." }`}</Code>
          </Section>

          <Section id="limits" kicker="Technical" title="Known limits">
            <ul className="doc-list">
              <li><b>Proofs can be passed on.</b> Whoever holds a code can show it. Each proof has a unique ID and an expiry. The Telegram and Discord bots accept each proof once per group or server; elsewhere, admit each ID once.</li>
              <li><b>Point-in-time balance.</b> The balance is checked when the proof is issued, not continuously. Use short expiries for strict gates.</li>
              <li><b>ZK proofs count up to two notes.</b> If your Ring balance is split across more, merge it in your Privacy Ring wallet first.</li>
              <li><b>Not yet supported:</b> “held for N days” claims.</li>
            </ul>
          </Section>

          <Section id="token" kicker="Project" title={TICKER}>
            <p>{TICKER} is the token that powers Parhelion.</p>
            <div className="doc-cards">
              <div className="doc-card doc-card--yellow"><b>Pay to gate</b><span>Projects pay a {TICKER} fee to create a gate.</span></div>
              <div className="doc-card doc-card--pink"><b>Burned on-chain</b><span>A share of every fee is burned in the same transaction.</span></div>
              <div className="doc-card doc-card--aqua"><b>Hold = free proofs</b><span>Holding {TICKER} unlocks free proofs and premium tiers.</span></div>
            </div>
            <h3 className="doc-h3">How the gate fee works</h3>
            <ol className="doc-steps">
              <li>When a project creates a gate, the app shows the fee and builds <b>one</b> transaction for the project’s wallet to sign.</li>
              <li>That transaction sends the treasury share to the Parhelion treasury and <b>burns</b> the rest with the SPL Token burn instruction, so the supply shrinks the moment the fee is paid.</li>
              <li>Parhelion checks the transaction on-chain (confirmed, recent, correct amounts, never used before) and only then issues the gate.</li>
            </ol>
            <Note tone="yellow" title="Verifiable by anyone">
              Burns happen in the payer’s own transaction. No server key ever holds or moves {TICKER}, and every burn is a public
              transaction on Solscan, with the memo “Parhelion gate fee”.
            </Note>
            <p className="doc-muted">Contract address: announced at launch on <a href="https://x.com/parhelioninwork" target="_blank" rel="noopener noreferrer">@parhelioninwork</a>. Only trust the address posted there and on this site.</p>
          </Section>

          <Section id="roadmap" kicker="Project" title="Roadmap">
            <p>Four phases, shipped in order. A phase is marked live only after it runs on mainnet.</p>
            <Roadmap />
          </Section>

          <Section id="faq" kicker="Project" title="FAQ">
            {[
              ['Does Parhelion cost gas?', 'No. You sign a message, not a transaction. Nothing is sent on-chain.'],
              ['Can Parhelion move my tokens?', 'No. It never asks for a private key and never requests a transaction. Your tokens stay in your wallet.'],
              ['Does Parhelion store my wallet?', 'No. The server reads your public balance once to issue the proof and keeps nothing about your wallet.'],
              ['Can I prove more than I hold?', 'No. The balance is read live from Solana. If it is below the threshold, no proof is issued.'],
              ['What if I sell after getting a proof?', 'The proof stays valid until it expires (1, 7 or 30 days). Groups that need fresh proofs should ask for short expiries.'],
              ['Which wallets work?', 'Any Solana wallet that supports message signing through Wallet Standard, including Phantom, Solflare and Backpack.'],
              ['Which tokens work?', 'SOL, any SPL token and Token-2022 tokens. Paste the mint address in the app.'],
            ].map(([q, a]) => (
              <details key={q} className="doc-faq">
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </Section>

          <footer className="docs-foot">
            <span className="brand"><Logo size={22} /> Parhelion</span>
            <span>Built on Helius · Powered by Solana</span>
          </footer>
        </main>
      </div>
    </div>
  )
}
