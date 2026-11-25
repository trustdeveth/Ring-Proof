import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Logo, Arrow } from './icons'
import ProofReceipt from './ProofReceipt'
import Preloader from './Preloader'
import Cursor from './Cursor'
import { gsap, ScrollTrigger, SplitText, initSmoothScroll, getLenis, getVelocity, reducedMotion } from '../lib/smooth'
import { scroll } from '../three/scroll'

const Scene = lazy(() => import('../three/Scene'))

const TICKER = '$PROOF'
const pad = (n: number) => String(n).padStart(2, '0')

/* ------------------------------------------------------------------ */
/* small pieces                                                        */
/* ------------------------------------------------------------------ */

function Line({ children }: { children: ReactNode }) {
  return (
    <span className="line">
      <span className="line__in">{children}</span>
    </span>
  )
}

function Redact({ children, note, className = '' }: { children: ReactNode; note?: string; className?: string }) {
  return (
    <span className={`redact ${className}`} data-cursor="Reveal">
      <span className="redact__word">{children}</span>
      <span className="redact__bar" />
      {note && <span className="redact__note">{note}</span>}
    </span>
  )
}

function Btn({ href, children, kind = 'ink', cursor }: { href: string; children: ReactNode; kind?: 'ink' | 'line'; cursor?: string }) {
  return (
    <a className={`btn btn--${kind}`} href={href} data-magnetic data-cursor={cursor}>
      <span className="btn__label">{children}</span>
    </a>
  )
}

/* ------------------------------------------------------------------ */
/* sections                                                            */
/* ------------------------------------------------------------------ */

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
      <a className="btn btn--ink btn--sm" href="/app" data-magnetic>
        <span className="btn__label">
          Launch app
        </span>
      </a>
      <span className="nav__progress" aria-hidden="true" />
    </header>
  )
}

function Hero() {
  return (
    <section className="hero" id="top" data-hud="Cover">
      <div className="docbar">
        <span data-intro="meta">File No. 001</span>
        <span data-intro="meta">Solana · Helius Privacy Rings</span>
        <span className="docbar__status" data-intro="meta">
          <i /> Status: open
        </span>
      </div>
      <div className="hero__body">
        <h1 className="display" aria-label="Prove you're a whale. Stay invisible.">
          <Line>Prove you’re</Line>
          <Line>a whale.</Line>
          <Line>
            Stay <Redact note="[redacted]">invisible</Redact>.
          </Line>
        </h1>
        <p className="hero__sub" data-intro="fade">
          Private holder proofs for Solana. Get into whale chats and allowlists by proving you qualify — without the
          group ever seeing your wallet.
        </p>
        <div className="actions" data-intro="fade">
          <Btn href="/app/prove" cursor="Open">
            Generate a proof <Arrow />
          </Btn>
          <Btn href="#how" kind="line">
            Read the method
          </Btn>
        </div>
      </div>
      <dl className="hero__meta">
        {[
          ['Revealed', '1 claim'],
          ['Custody', 'Yours'],
          ['Wallet shown', 'Never'],
          ['Contract', 'Soon'],
        ].map(([k, v]) => (
          <div key={k} data-intro="meta-row">
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="stamp stamp--hero" aria-hidden="true">
        Wallet
        <br />
        not shown
      </div>
    </section>
  )
}

function Strip() {
  const items = ['Balance ████████', 'Proof valid', `≥ 1,000,000 ${TICKER}`, 'Wallets hidden', 'Claim only', 'Copy-traders blind']
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
    <section className="section problem" id="problem" data-hud="§ 01 — Problem">
      <div className="problem__text">
        <p className="label" data-scramble>
          § 01 — The problem
        </p>
        <h2 className="h2" data-split>
          Right now, your wallet is a <em>billboard.</em>
        </h2>
        <p className="lead" data-fade>
          Every holder check asks you to connect a wallet. One click and anyone can read your bags, your history and
          every wallet you’ve ever linked.
        </p>
        <ol className="threats" data-stagger>
          {threats.map(([a, b], i) => (
            <li key={a}>
              <span className="threats__n">{pad(i + 1)}</span>
              <span>
                <b>{a}</b> {b}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function useHowProgress(ref: RefObject<HTMLElement | null>) {
  const [p, setP] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const st = ScrollTrigger.create({
      trigger: el,
      start: () => `top+=${window.innerHeight * 0.15} top`,
      end: () => `bottom-=${window.innerHeight * 1.1} top`,
      onUpdate: (self) => setP(self.progress),
    })
    return () => st.kill()
  }, [ref])
  return p
}

function How() {
  const ref = useRef<HTMLElement>(null)
  const p = useHowProgress(ref)
  const active = p < 0.34 ? 0 : p < 0.67 ? 1 : 2
  const steps = [
    ['Sign', 'Connect a wallet and sign a free message. It proves the wallet is yours — no transaction, nothing moves.'],
    ['Prove', 'RingProof reads your balance on-chain once and seals a proof of the claim only: “holds ≥ X”. Your wallet is not in it.'],
    ['Pass', 'Hand the proof to the group. It checks in milliseconds. Wallet, exact balance, history: hidden.'],
  ]
  return (
    <section className="how" id="how" ref={ref} data-hud="§ 02 — Method">
      <div className="how__sticky">
        <div className="how__panel">
          <div className="how__top">
            <p className="label" data-scramble>
              § 02 — The method
            </p>
            <span className="how__pct mono">{pad(Math.round(p * 100)).padStart(3, '0')}%</span>
          </div>
          <h2 className="h2" data-split>
            Sign. Prove. <em>Pass.</em>
          </h2>
          <ol className="steps">
            {steps.map(([t, d], i) => (
              <li key={t} className={i === active ? 'is-on' : i < active ? 'is-done' : ''}>
                <span className="steps__n">{pad(i + 1)}</span>
                <div>
                  <h3>{t}</h3>
                  <div className="steps__body">
                    <p>{d}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div className="meter" aria-hidden="true">
            <span style={{ transform: `scaleX(${p})` }} />
            {[0.34, 0.67].map((m) => (
              <i key={m} style={{ left: `${m * 100}%` }} />
            ))}
          </div>
          <div className="meter__labels mono" aria-hidden="true">
            <span>Exposed</span>
            <span>Private</span>
          </div>
        </div>
        <div className={`stamp stamp--valid ${p > 0.94 ? 'is-on' : ''}`} aria-hidden="true">
          Proof valid
          <small>≥ 1,000,000 {TICKER}</small>
        </div>
      </div>
    </section>
  )
}

function Receipt() {
  return (
    <section className="section receipt-sec" data-hud="§ 03 — Disclosure">
      <div className="receipt-sec__text">
        <p className="label" data-scramble>
          § 03 — What the group learns
        </p>
        <h2 className="h2" data-split>
          One fact. <em>Nothing else.</em>
        </h2>
        <p className="lead" data-fade>
          The proof says exactly one thing: you meet the threshold. Not by how much. Not from which wallet. Not what
          else you hold.
        </p>
        <table className="ledger" data-stagger>
          <tbody>
            <tr>
              <th>Group learns</th>
              <td>Token, threshold, valid / invalid, expiry</td>
            </tr>
            <tr>
              <th>RingProof checks</th>
              <td>Your balance, once, when the proof is issued — nothing stored</td>
            </tr>
            <tr>
              <th>Custody</th>
              <td>Your tokens never move</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="receipt-sec__paper" data-fade>
        <ProofReceipt ticker={TICKER} />
      </div>
    </section>
  )
}

function Uses() {
  const uses = [
    ['Whale chats', 'Holder-gated Telegram & Discord rooms. Prove the tier, never the bag.'],
    ['Holder perks', 'Discounts, roles and early access for real holders — without collecting a list of their wallets.'],
    ['Allowlists', 'Mint and presale access by proof — no wallet connect, no screenshot farming.'],
    ['Any token', 'SOL, $PROOF or any SPL token. A project picks the mint and the threshold.'],
    ['Proof of funds', 'Show an OTC desk you can cover the block without opening your books.'],
    ['Fresh proofs', 'Every proof is checked on-chain when issued and expires in 1–30 days. No stale screenshots.'],
  ]
  return (
    <section className="section" id="uses" data-hud="§ 04 — Uses">
      <div className="sec-head">
        <p className="label" data-scramble>
          § 04 — Uses
        </p>
        <h2 className="h2" data-split>
          One proof. <em>Every door.</em>
        </h2>
      </div>
      <ul className="index" data-stagger>
        {uses.map(([t, d], i) => (
          <li key={t} data-cursor="Use">
            <span className="index__n">{pad(i + 1)}</span>
            <span className="index__t">{t}</span>
            <span className="index__d">{d}</span>
            <span className="index__arrow" aria-hidden="true">
              <Arrow />
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Projects() {
  return (
    <section className="section projects" data-hud="§ 05 — Projects">
      <div>
        <p className="label" data-scramble>
          § 05 — For projects
        </p>
        <h2 className="h2" data-split>
          Gate your community in <em>sixty seconds.</em>
        </h2>
        <p className="lead" data-fade>
          Add the bot, pick a token and a threshold. Your holders keep their privacy; you get real holders instead of
          farmers. Gates are free now and paid in {TICKER} after launch.
        </p>
        <div className="actions" data-fade>
          <Btn href="/app/gates" cursor="Open">
            Create a gate <Arrow />
          </Btn>
        </div>
      </div>
      <div className="memo" data-tilt>
        <div className="memo__head mono">
          <span>To: @RingProofBot</span>
          <span>Re: new gate</span>
        </div>
        <pre className="memo__body" data-type>
{`/gate create
  token  = <your mint>
  min    = 1,000,000
  held   = 30d
  room   = #whale-room`}
        </pre>
        <div className="memo__foot mono">
          <span className="ok">● Gate live.</span> After launch: fee in {TICKER}, half burned.
        </div>
      </div>
    </section>
  )
}

function Token() {
  const rows = [
    ['Pay to gate', `After launch, projects pay in ${TICKER} to create holder gates.`],
    ['Buyback & burn', 'A share of every fee buys back and burns supply. More gates, less supply.'],
    ['Hold for free proofs', `Holding ${TICKER} unlocks free proofs and premium tiers.`],
  ]
  return (
    <section className="section token" id="token" data-hud="§ 06 — Token">
      <p className="label" data-scramble>
        § 06 — Token · declassified
      </p>
      <h2 className="token__big" aria-label={TICKER}>
        {TICKER.split('').map((c, i) => (
          <span className="dl" key={i}>
            <span className="dl__c">{c}</span>
            <span className="dl__bar" />
          </span>
        ))}
      </h2>
      <p className="lead" data-fade>
        The fuel for every proof. Utility first, meme always.
      </p>
      <table className="ledger ledger--big" data-stagger>
        <tbody>
          {rows.map(([a, b], i) => (
            <tr key={a}>
              <td className="mono">{pad(i + 1)}</td>
              <th>{a}</th>
              <td>{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function Accordion({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`acc ${open ? 'is-open' : ''}`}>
      <button className="acc__q" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>{q}</span>
        <span className="acc__x" aria-hidden="true" />
      </button>
      <div className="acc__a">
        <div>
          <p>{a}</p>
        </div>
      </div>
    </div>
  )
}

function Faq() {
  const qs = [
    ['Is my wallet really hidden?', 'From the group, yes: the proof only says you meet the threshold. To issue it, RingProof reads your public balance once and stores nothing. Next on the roadmap: Helius Privacy Rings with zero-knowledge proofs, so not even RingProof sees your balance.'],
    ['What does the group learn?', 'Only that a RingProof proof is valid for token X and threshold Y, and when it expires. Not your wallet, not your exact balance, not your history.'],
    ['Do I give up custody?', 'Never. Your tokens never move. You sign a free message — not a transaction — and RingProof never asks for a private key.'],
    ['Can someone reuse my proof?', 'A proof can be shared by whoever holds it, so each one has a one-time ID and an expiry. Groups should admit each proof ID once.'],
    ['Is it audited?', "Not yet — RingProof has not had an external audit. Helius reports its Privacy Rings programs were audited by Certora, ZK Security and OtterSec; RingProof's zero-knowledge circuits will be audited before they ship."],
    ['Which wallets work?', 'Any Solana wallet that can sign messages — Phantom, Solflare, Backpack and more.'],
  ]
  return (
    <section className="section faq" id="faq" data-hud="§ 07 — Questions">
      <div className="sec-head">
        <p className="label" data-scramble>
          § 07 — Questions
        </p>
        <h2 className="h2" data-split>
          Asked & answered.
        </h2>
      </div>
      <div className="faq__list" data-stagger>
        {qs.map(([q, a]) => (
          <Accordion key={q} q={q} a={a} />
        ))}
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="footer" id="footer" data-hud="End of file">
      <div className="footer__top">
        <p className="label" data-scramble>
          End of file
        </p>
        <h2 className="footer__big" aria-label="Go dark.">
          <span className="footer__go">Go</span> <Redact className="redact--footer">dark</Redact>
          <span className="footer__dot">.</span>
        </h2>
        <div className="actions" data-fade>
          <Btn href="/app" cursor="Open">
            Launch app
          </Btn>
          <Btn href="#" kind="line">
            X / Twitter
          </Btn>
          <Btn href="#" kind="line">
            Telegram
          </Btn>
        </div>
      </div>
      <div className="footer__bottom mono">
        <span className="brand">
          <Logo size={18} /> RingProof
        </span>
        <span>Not affiliated with Helius. {TICKER} is a memecoin with utility, not an investment. DYOR.</span>
      </div>
    </footer>
  )
}

function Hud() {
  return (
    <div className="hud mono" aria-hidden="true">
      <div className="hud__left">
        <span className="hud__file">File 001</span>
        <span className="hud__sec" id="hud-sec">
          Cover
        </span>
      </div>
      <div className="hud__right">
        <span>Subject: whale</span>
        <span className="hud__status" id="hud-status" data-state="exposed">
          Exposed
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* choreography                                                        */
/* ------------------------------------------------------------------ */

const GLYPHS = '█▓▒░<>/\\#%01'
function scramble(el: HTMLElement, duration = 0.9) {
  const final = (el.dataset.text ??= el.textContent ?? '')
  const s = { p: 0 }
  return gsap.to(s, {
    p: 1,
    duration,
    ease: 'none',
    onUpdate() {
      let out = ''
      for (let i = 0; i < final.length; i++) {
        const ch = final[i]
        out += ch === ' ' || i / final.length < s.p ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0]
      }
      el.textContent = out
    },
    onComplete() {
      el.textContent = final
    },
  })
}

function useChoreography(ready: boolean) {
  // everything that is hidden until the preloader lifts gets its start state now
  useLayoutEffect(() => {
    const lenis = initSmoothScroll()
    lenis?.stop()
    window.scrollTo(0, 0)
    if (reducedMotion) {
      scroll.intro = 1
      return
    }
    gsap.set('.hero .line__in', { yPercent: 115 })
    gsap.set('.hero .redact__bar', { scaleX: 0 })
    gsap.set('.hero .redact__note', { opacity: 0 })
    gsap.set('[data-intro]', { opacity: 0, y: 18 })
    gsap.set('.stamp--hero', { opacity: 0 })
    gsap.set('.nav > *:not(.nav__progress)', { yPercent: -140, opacity: 0 })
  }, [])

  useLayoutEffect(() => {
    if (!ready) return
    const lenis = getLenis()
    const ctx = gsap.context(() => {
      /* ---- hero intro ---- */
      const intro = { v: 0 }
      const tl = gsap.timeline({ onComplete: () => lenis?.start() })
      tl.to('.nav > *:not(.nav__progress)', { yPercent: 0, opacity: 1, duration: 1.1, stagger: 0.08, ease: 'expo.out' }, 0.1)
        .to(intro, { v: 1, duration: 2.2, ease: 'expo.out', onUpdate: () => (scroll.intro = intro.v) }, 0)
        .to('.hero .line__in', { yPercent: 0, duration: 1.25, stagger: 0.1, ease: 'expo.out' }, 0.05)
        .to('[data-intro="meta"]', { opacity: 1, y: 0, duration: 0.8, stagger: 0.06, ease: 'expo.out' }, 0.2)
        .to('.hero .redact__bar', { scaleX: 1, duration: 0.9, ease: 'expo.inOut' }, 0.55)
        .to('.hero .redact__note', { opacity: 1, duration: 0.3 }, 1.25)
        .to('[data-intro="fade"]', { opacity: 1, y: 0, duration: 1, stagger: 0.1, ease: 'expo.out' }, 0.6)
        .to('[data-intro="meta-row"]', { opacity: 1, y: 0, duration: 0.9, stagger: 0.07, ease: 'expo.out' }, 0.8)
        .fromTo(
          '.stamp--hero',
          { opacity: 0, scale: 2.6, rotate: 22 },
          { opacity: 0.92, scale: 1, rotate: 8, duration: 0.5, ease: 'power4.in' },
          1.15,
        )
        .fromTo('.hero__body', { x: -6 }, { x: 0, duration: 0.5, ease: 'elastic.out(1.2, 0.25)' }, 1.65)
      if (reducedMotion) tl.progress(1)

      /* ---- headings: masked line reveal ---- */
      gsap.utils.toArray<HTMLElement>('[data-split]').forEach((el) => {
        SplitText.create(el, {
          type: 'lines',
          linesClass: 'sl',
          autoSplit: true,
          onSplit(self) {
            self.lines.forEach((line) => {
              const mask = document.createElement('span')
              mask.className = 'sl-mask'
              line.parentNode!.insertBefore(mask, line)
              mask.appendChild(line)
            })
            return gsap.from(self.lines, {
              yPercent: 110,
              rotate: 2,
              duration: 1.2,
              stagger: 0.09,
              ease: 'expo.out',
              scrollTrigger: { trigger: el, start: 'top 85%', once: true },
            })
          },
        })
      })

      /* ---- labels scramble in ---- */
      gsap.utils.toArray<HTMLElement>('[data-scramble]').forEach((el) => {
        ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => scramble(el) })
      })

      /* ---- fades & staggers ---- */
      gsap.utils.toArray<HTMLElement>('[data-fade]').forEach((el) => {
        gsap.from(el, {
          y: 36,
          opacity: 0,
          duration: 1.1,
          ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        })
      })
      gsap.utils.toArray<HTMLElement>('[data-stagger]').forEach((el) => {
        const kids = el.querySelectorAll(':scope > li, :scope > div, :scope tr')
        gsap.from(kids, {
          y: 26,
          opacity: 0,
          duration: 0.9,
          stagger: 0.07,
          ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        })
        gsap.from(el, {
          '--rule-x': 0,
          duration: 1.2,
          ease: 'expo.inOut',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        })
      })

      /* ---- memo: tilt in + type ---- */
      gsap.from('[data-tilt]', {
        rotate: -6,
        y: 80,
        opacity: 0,
        duration: 1.3,
        ease: 'expo.out',
        scrollTrigger: { trigger: '[data-tilt]', start: 'top 85%', once: true },
      })
      const typeEl = document.querySelector<HTMLElement>('[data-type]')
      if (typeEl) {
        const full = typeEl.textContent ?? ''
        const s = { n: 0 }
        typeEl.textContent = ''
        gsap.to(s, {
          n: full.length,
          duration: 1.6,
          ease: 'none',
          scrollTrigger: { trigger: typeEl, start: 'top 80%', once: true },
          onUpdate: () => (typeEl.textContent = full.slice(0, Math.round(s.n))),
          onComplete: () => document.querySelector('.memo__foot')?.classList.add('is-on'),
        })
      }

      /* ---- token: declassify letters with scroll ---- */
      gsap.to('.dl__bar', {
        scaleX: 0,
        stagger: 0.12,
        ease: 'power2.inOut',
        scrollTrigger: { trigger: '.token__big', start: 'top 80%', end: 'top 30%', scrub: 0.6 },
      })
      gsap.from('.dl__c', {
        yPercent: 18,
        stagger: 0.12,
        ease: 'power2.out',
        scrollTrigger: { trigger: '.token__big', start: 'top 80%', end: 'top 30%', scrub: 0.6 },
      })

      /* ---- footer: the page goes dark ---- */
      const darkEl = document.querySelector<HTMLElement>('.stage__dark')!
      ScrollTrigger.create({
        trigger: '#footer',
        start: 'top bottom',
        end: 'top 15%',
        scrub: true,
        onUpdate: (self) => {
          scroll.dark = self.progress
          darkEl.style.setProperty('--r', self.progress.toFixed(4))
          document.body.classList.toggle('is-dark', self.progress > 0.7)
        },
      })
      gsap.set('.footer .redact__bar', { scaleX: 0 })
      const ftl = gsap.timeline({ scrollTrigger: { trigger: '.footer__big', start: 'top 75%', once: true } })
      ftl
        .from('.footer__go', { yPercent: 60, opacity: 0, duration: 1.1, ease: 'expo.out' })
        .to('.footer .redact__bar', { scaleX: 1, duration: 1, ease: 'expo.inOut' }, 0.25)
        .from('.footer__dot', { scale: 0, duration: 0.6, ease: 'back.out(3)' }, 0.9)

      /* ---- nav: hide on scroll down, progress line, HUD section ---- */
      const nav = document.querySelector<HTMLElement>('.nav')!
      const bar = document.querySelector<HTMLElement>('.nav__progress')!
      ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: (self) => {
          bar.style.transform = `scaleX(${self.progress.toFixed(4)})`
          nav.classList.toggle('is-hidden', self.direction === 1 && self.scroll() > 240)
        },
      })
      // HUD only between the cover and the footer
      ScrollTrigger.create({
        trigger: '.strip',
        start: 'top 80%',
        endTrigger: '#footer',
        end: 'top 70%',
        toggleClass: { targets: '.hud', className: 'is-on' },
      })
      const hudSec = document.getElementById('hud-sec')
      gsap.utils.toArray<HTMLElement>('[data-hud]').forEach((el) => {
        ScrollTrigger.create({
          trigger: el,
          start: 'top 55%',
          end: 'bottom 55%',
          onToggle: (self) => {
            if (self.isActive && hudSec && hudSec.dataset.text !== el.dataset.hud) {
              hudSec.dataset.text = el.dataset.hud!
              hudSec.textContent = el.dataset.hud!
              scramble(hudSec, 0.5)
            }
          },
        })
      })

      /* ---- strip: marquee that reacts to scroll velocity ---- */
      const track = document.querySelector<HTMLElement>('.strip__track')!
      let x = 0
      let skew = 0
      const tick = () => {
        const v = getVelocity()
        x -= 0.6 + Math.min(14, Math.abs(v) * 0.35)
        const third = track.scrollWidth / 3
        if (-x >= third) x += third
        skew += (Math.max(-8, Math.min(8, v * 0.25)) - skew) * 0.1
        track.style.transform = `translate3d(${x.toFixed(2)}px,0,0) skewX(${skew.toFixed(2)}deg)`
      }
      gsap.ticker.add(tick)

      /* ---- magnetic buttons ---- */
      const cleanups: (() => void)[] = []
      if (window.matchMedia('(pointer: fine)').matches) {
        gsap.utils.toArray<HTMLElement>('[data-magnetic]').forEach((el) => {
          const label = el.querySelector('.btn__label') ?? el
          const qx = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' })
          const qy = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' })
          const lx = gsap.quickTo(label, 'x', { duration: 0.5, ease: 'power3' })
          const ly = gsap.quickTo(label, 'y', { duration: 0.5, ease: 'power3' })
          const move = (e: PointerEvent) => {
            const r = el.getBoundingClientRect()
            const dx = e.clientX - (r.left + r.width / 2)
            const dy = e.clientY - (r.top + r.height / 2)
            qx(dx * 0.28)
            qy(dy * 0.35)
            lx(dx * 0.12)
            ly(dy * 0.15)
          }
          const leave = () => {
            gsap.to([el, label], { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' })
          }
          el.addEventListener('pointermove', move)
          el.addEventListener('pointerleave', leave)
          cleanups.push(() => {
            el.removeEventListener('pointermove', move)
            el.removeEventListener('pointerleave', leave)
          })
        })
      }

      ScrollTrigger.refresh()
      return () => {
        gsap.ticker.remove(tick)
        cleanups.forEach((c) => c())
      }
    })
    return () => ctx.revert()
  }, [ready])
}

export default function Landing() {
  const [ready, setReady] = useState(false)
  useChoreography(ready)
  return (
    <>
      <Preloader onReveal={() => setReady(true)} />
      <div className="stage" aria-hidden="true">
        <div className="stage__dark" />
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </div>
      <div className="grain" aria-hidden="true" />
      <Cursor />
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
      <Hud />
    </>
  )
}
