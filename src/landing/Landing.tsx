import { lazy, Suspense, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useReveal } from '../lib/fx'
import { Logo, Arrow } from './icons'
import ProofReceipt from './ProofReceipt'

const Scene = lazy(() => import('../three/Scene'))

const TICKER = '$PROOF'

function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useReveal<HTMLDivElement>()
  return (
    <div ref={ref} className={`reveal ${className}`}>
      {children}
    </div>
  )
}

function Nav() {
  return (
    <header className="nav">
      <a href="#top" className="brand" aria-label="RingProof home">
        <Logo /> RingProof
      </a>
      <nav className="nav__links">
        <a href="#problem">Problem</a>
        <a href="#how">Method</a>
        <a href="#uses">Uses</a>
        <a href="#token">{TICKER}</a>
        <a href="#faq">FAQ</a>
      </nav>
      <a className="btn btn--ink btn--sm" href="#app" aria-disabled="true">
        Launch app <span className="tag-soon">soon</span>
      </a>
    </header>
  )
}

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="docbar">
        <span>File No. 001</span>
        <span>Solana · Helius Privacy Rings</span>
        <span className="docbar__status">
          <i /> Status: open
        </span>
      </div>
      <div className="hero__body">
        <h1 className="display">
          Prove you’re
          <br />a whale.
          <br />
          Stay{' '}
          <span className="redact" title="invisible">
            <span className="redact__word">invisible</span>
            <span className="redact__bar" />
            <span className="redact__note">[redacted]</span>
          </span>
          .
        </h1>
        <p className="hero__sub">
          Zero-knowledge holder proofs for Solana. Get into whale chats, airdrops and allowlists by proving you
          qualify — without ever showing what you hold.
        </p>
        <div className="actions">
          <a className="btn btn--ink" href="#app">
            Generate a proof <Arrow />
          </a>
          <a className="btn btn--line" href="#how">
            Read the method
          </a>
        </div>
        <dl className="ca">
          <dt>Contract</dt>
          <dd>Launching soon on Solana</dd>
        </dl>
      </div>
      <div className="stamp stamp--hero" aria-hidden="true">
        No wallet
        <br />
        connect
      </div>
      <div className="hero__hint mono" aria-hidden="true">
        Scroll — follow the whale ↓
      </div>
    </section>
  )
}

function Strip() {
  const items = ['Balance ████████', 'Proof valid', `≥ 1,000,000 ${TICKER}`, 'Wallets hidden', 'Amounts encrypted', 'Copy-traders blind']
  const row = [...items, ...items, ...items]
  return (
    <div className="strip" aria-hidden="true">
      <div className="strip__track">
        {row.map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
    </div>
  )
}

function Problem() {
  const threats = [
    ['Copy-traders', 'mirror every move you make.'],
    ['Front-runners', 'see your size before you trade.'],
    ['Scammers', 'and worse target known whales.'],
    ['Clustering tools', 'tie your alts back to you.'],
  ]
  return (
    <section className="section problem" id="problem">
      <Reveal className="problem__text">
        <p className="label">§ 01 — The problem</p>
        <h2 className="h2">
          Right now, your wallet is a <em>billboard.</em>
        </h2>
        <p className="lead">
          Every holder check asks you to connect a wallet. One click and anyone can read your bags, your history and
          every wallet you’ve ever linked.
        </p>
        <ol className="threats">
          {threats.map(([a, b], i) => (
            <li key={a}>
              <span className="threats__n">{String(i + 1).padStart(2, '0')}</span>
              <span>
                <b>{a}</b> {b}
              </span>
            </li>
          ))}
        </ol>
      </Reveal>
    </section>
  )
}

function useHowProgress(ref: RefObject<HTMLElement | null>) {
  const [p, setP] = useState(0)
  useEffect(() => {
    let raf = 0
    const on = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = ref.current
        if (!el) return
        const vh = window.innerHeight
        const r = el.getBoundingClientRect()
        const total = el.offsetHeight - vh
        const v = (-r.top - vh * 0.15) / Math.max(1, total - vh * 0.25)
        setP(Math.max(0, Math.min(1, v)))
      })
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
    }
  }, [ref])
  return p
}

function How() {
  const ref = useRef<HTMLElement>(null)
  const p = useHowProgress(ref)
  const active = p < 0.34 ? 0 : p < 0.67 ? 1 : 2
  const steps = [
    ['Shield', 'Move tokens into a Helius Privacy Ring. Your balance becomes ciphertext on-chain. Your keys, always.'],
    ['Prove', 'Your browser decrypts locally and builds a zero-knowledge range proof: “holds ≥ X” or “held since slot N”.'],
    ['Pass', 'Hand the proof to the Telegram or Discord bot. It verifies in milliseconds. Amount, wallets, history: hidden.'],
  ]
  return (
    <section className="how" id="how" ref={ref}>
      <div className="how__sticky">
        <div className="how__panel">
          <p className="label">§ 02 — The method</p>
          <h2 className="h2">
            Shield. Prove. <em>Pass.</em>
          </h2>
          <ol className="steps">
            {steps.map(([t, d], i) => (
              <li key={t} className={i === active ? 'is-on' : i < active ? 'is-done' : ''}>
                <span className="steps__n">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="meter" aria-hidden="true">
            <span style={{ transform: `scaleX(${p})` }} />
          </div>
          <div className="meter__labels mono" aria-hidden="true">
            <span>exposed</span>
            <span>{Math.round(p * 100)}% encrypted</span>
          </div>
        </div>
        <div className={`stamp stamp--valid ${p > 0.92 ? 'is-on' : ''}`} aria-hidden="true">
          Proof valid
          <small>≥ 1,000,000 {TICKER}</small>
        </div>
      </div>
    </section>
  )
}

function Receipt() {
  return (
    <section className="section receipt-sec">
      <Reveal className="receipt-sec__text">
        <p className="label">§ 03 — What leaves your device</p>
        <h2 className="h2">
          One fact. <em>Nothing else.</em>
        </h2>
        <p className="lead">
          The proof says exactly one thing: you meet the threshold. Not by how much. Not from which wallets. Not since
          when — unless you choose to prove that too.
        </p>
        <table className="ledger">
          <tbody>
            <tr><th>Verifier learns</th><td>Token, threshold, valid / invalid</td></tr>
            <tr><th>Stays with you</th><td>Amount, wallets, history, viewing key</td></tr>
            <tr><th>Custody</th><td>Never leaves your keys</td></tr>
          </tbody>
        </table>
      </Reveal>
      <Reveal className="receipt-sec__paper">
        <ProofReceipt ticker={TICKER} />
      </Reveal>
    </section>
  )
}

function Uses() {
  const uses = [
    ['Whale chats', 'Holder-gated Telegram & Discord rooms. Prove the tier, never the bag.'],
    ['Private airdrops', 'Drop to real holders only. Recipients and amounts stay encrypted.'],
    ['Allowlists', 'Mint and presale access by proof — no wallet connect, no screenshot farming.'],
    ['Diamond hands', '“Held since slot N” proofs. Reward conviction without doxxing it.'],
    ['Proof of funds', 'Show an OTC desk you can cover the block without opening your books.'],
    ['Anti-sybil', 'One proof per ring note. 400 farmer wallets get one seat, not 400.'],
  ]
  return (
    <section className="section" id="uses">
      <Reveal>
        <p className="label">§ 04 — Uses</p>
        <h2 className="h2">
          One proof. <em>Every door.</em>
        </h2>
      </Reveal>
      <Reveal>
        <ul className="index">
          {uses.map(([t, d], i) => (
            <li key={t}>
              <span className="index__n">{String(i + 1).padStart(2, '0')}</span>
              <span className="index__t">{t}</span>
              <span className="index__d">{d}</span>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  )
}

function Projects() {
  return (
    <section className="section projects">
      <Reveal>
        <p className="label">§ 05 — For projects</p>
        <h2 className="h2">
          Gate your community in <em>sixty seconds.</em>
        </h2>
        <p className="lead">
          Add the bot, pick a token and a threshold. Your holders keep their privacy; you get real holders instead of
          farmers. Gates are paid in {TICKER}.
        </p>
      </Reveal>
      <Reveal className="memo">
        <div className="memo__head mono">
          <span>To: @RingProofBot</span>
          <span>Re: new gate</span>
        </div>
        <pre className="memo__body">
{`/gate create
  token  = <your mint>
  min    = 1,000,000
  held   = 30d
  room   = #whale-room`}
        </pre>
        <div className="memo__foot mono">
          <span className="ok">Gate live.</span> Fee paid in {TICKER}, half of it burned.
        </div>
      </Reveal>
    </section>
  )
}

function Token() {
  const rows = [
    ['Pay to gate', `Projects pay in ${TICKER} to create holder gates and private airdrops.`],
    ['Buyback & burn', 'A share of every fee buys back and burns supply. More gates, less supply.'],
    ['Hold for free proofs', `Holding ${TICKER} unlocks free proofs and premium tiers.`],
  ]
  return (
    <section className="section token" id="token">
      <Reveal>
        <p className="label">§ 06 — Token</p>
        <h2 className="token__big">{TICKER}</h2>
        <p className="lead">The fuel for every proof. Utility first, meme always.</p>
      </Reveal>
      <Reveal>
        <table className="ledger ledger--big">
          <tbody>
            {rows.map(([a, b], i) => (
              <tr key={a}>
                <td className="mono">{String(i + 1).padStart(2, '0')}</td>
                <th>{a}</th>
                <td>{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
    </section>
  )
}

function Faq() {
  const qs = [
    ['Is my balance really hidden?', 'Inside a Privacy Ring, balances and transfer amounts are encrypted on-chain. RingProof decrypts only on your device to build the proof. The proof itself reveals one fact: you meet the threshold.'],
    ['What does the verifier learn?', 'Only that the proof is valid for token X and threshold Y. Note: Privacy Rings encrypt amounts, but the ring wallet address itself is visible on-chain.'],
    ['Do I give up custody?', 'Never. Your tokens sit in a Privacy Ring under your own keys. RingProof never touches funds and never asks for a private key.'],
    ['Is it audited?', "Helius reports that the Privacy Rings core programs and ZK circuits were audited by Certora, ZK Security and OtterSec. RingProof's own circuits will be audited before mainnet."],
    ['Which wallets work?', 'Any Solana wallet that can sign messages — Phantom, Solflare, Backpack and more.'],
  ]
  return (
    <section className="section faq" id="faq">
      <Reveal>
        <p className="label">§ 07 — Questions</p>
        <h2 className="h2">Asked & answered.</h2>
      </Reveal>
      <div className="faq__list">
        {qs.map(([q, a]) => (
          <details key={q}>
            <summary>
              {q}
              <span className="faq__x" aria-hidden="true" />
            </summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="footer" id="footer">
      <div className="footer__top">
        <h2 className="footer__big">
          Go <span className="redact redact--static"><span className="redact__word">dark</span><span className="redact__bar" /></span>.
        </h2>
        <div className="actions">
          <a className="btn btn--ink" href="#app">
            Launch app <span className="tag-soon">soon</span>
          </a>
          <a className="btn btn--line" href="#" aria-label="X (Twitter)">X / Twitter</a>
          <a className="btn btn--line" href="#" aria-label="Telegram">Telegram</a>
        </div>
      </div>
      <div className="footer__bottom mono">
        <span className="brand"><Logo size={18} /> RingProof</span>
        <span>Not affiliated with Helius. {TICKER} is a memecoin with utility, not an investment. DYOR.</span>
      </div>
    </footer>
  )
}

export default function Landing() {
  return (
    <>
      <div className="stage" aria-hidden="true">
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </div>
      <div className="grain" aria-hidden="true" />
      <Nav />
      <main className="content">
        <Hero />
        <Strip />
        <Problem />
        <How />
        <Receipt />
        <Uses />
        <Projects />
        <Token />
        <Faq />
      </main>
      <Footer />
    </>
  )
}
