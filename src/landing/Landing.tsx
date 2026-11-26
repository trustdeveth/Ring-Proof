import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Logo, Arrow, PixelShades, Ico } from './icons'
import ProofReceipt from './ProofReceipt'
import Preloader from './Preloader'
import { gsap, ScrollTrigger, SplitText, initSmoothScroll, getLenis, getVelocity, reducedMotion } from '../lib/smooth'
import { scroll } from '../three/scroll'

const Scene = lazy(() => import('../three/Scene'))

const TICKER = '$PRHL'
const pad = (n: number) => String(n).padStart(2, '0')

/* ------------------------------------------------------------------ */
/* bits                                                                */
/* ------------------------------------------------------------------ */

function Btn({ href, children, kind = 'ink', size }: { href: string; children: ReactNode; kind?: 'ink' | 'yellow' | 'white' | 'pink'; size?: 'sm' }) {
  return (
    <a
      className={`btn btn--${kind} ${size ? 'btn--sm' : ''}`}
      href={href}
      data-magnetic
      {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      <span className="btn__label">{children}</span>
    </a>
  )
}

function Chip({ children, tone = 'white' }: { children: ReactNode; tone?: string }) {
  return <span className={`chip chip--${tone}`}>{children}</span>
}

/** Rotating circular text badge. */
function SpinBadge({ text, children, tone = 'yellow' }: { text: string; children?: ReactNode; tone?: string }) {
  return (
    <div className={`spin spin--${tone}`} aria-hidden="true">
      <svg viewBox="0 0 200 200" className="spin__ring">
        <defs>
          <path id={`c-${text.length}`} d="M100,100 m-74,0 a74,74 0 1,1 148,0 a74,74 0 1,1 -148,0" />
        </defs>
        <text>
          <textPath href={`#c-${text.length}`} startOffset="0">
            {text}
          </textPath>
        </text>
      </svg>
      <div className="spin__core">{children}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* sections                                                            */
/* ------------------------------------------------------------------ */

function Nav() {
  return (
    <header className="nav">
      <div className="nav__pill">
        <a href="#top" className="brand" aria-label="Parhelion home">
          <Logo size={26} /> Parhelion
        </a>
        <nav className="nav__links">
          <a href="#problem">Why</a>
          <a href="#how">How</a>
          <a href="#uses">Uses</a>
          <a href="#token">{TICKER}</a>
          <a href="#faq">FAQ</a>
        </nav>
        <a className="btn btn--ink btn--sm" href="/app" data-magnetic>
          <span className="btn__label">Launch app</span>
        </a>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="hero" id="top" data-theme="aqua">
      <div className="hero__inner">
        <div className="hero__chips" data-intro="pop">
          <Chip tone="white">
            <i className="live" /> Live on Solana
          </Chip>
          <Chip tone="yellow">Holder proofs · no dox</Chip>
        </div>
        <h1 className="hero__title" aria-label="Prove you're a whale. Stay invisible.">
          <span className="line">
            <span className="line__in">Prove you’re</span>
          </span>
          <span className="line">
            <span className="line__in">
              a <span className="hl hl--blue">whale.</span>
            </span>
          </span>
          <span className="line">
            <span className="line__in">
              Stay <span className="ghost">invisible.</span>
            </span>
          </span>
        </h1>
        <p className="hero__sub" data-intro="fade">
          Private holder proofs for Solana. Get into whale chats and allowlists by proving you hold the bag —{' '}
          <b>without the group ever seeing your wallet.</b>
        </p>
        <div className="hero__cta" data-intro="fade">
          <Btn href="/app/prove" kind="ink">
            Get your proof <Arrow />
          </Btn>
          <Btn href="#how" kind="white">
            How it works
          </Btn>
        </div>
        <div className="ca" data-intro="fade">
          <span className="ca__k">CA</span>
          <span className="ca__v">coming soon</span>
          <span className="ca__socials">
            <a href="https://x.com/parhelioninwork" target="_blank" rel="noopener noreferrer" aria-label="Parhelion on X">
              <Ico.X />
            </a>
          </span>
        </div>
      </div>
      <div className="hero__badge" data-intro="pop" data-parallax="0.6">
        <SpinBadge text="NO DOX • NO KYC • NO CAP • STAY ANON • " tone="yellow">
          <PixelShades width={74} />
        </SpinBadge>
      </div>
      <div className="sticker sticker--pink hero__s1" data-intro="pop" data-parallax="1.2">
        100% anon
      </div>
      <div className="sticker sticker--yellow hero__s2" data-intro="pop" data-parallax="0.9">
        {TICKER}
      </div>
    </section>
  )
}

function Tapes() {
  const a = ['Prove the bag', 'Hide the wallet', 'Deal with it', 'Whales only', 'No screenshots', 'Stay anon']
  const b = ['Copy-traders hate this', 'Wallet not found', '1 claim · 0 dox', 'Built on Solana', 'Proof valid']
  const row = (items: string[]) => [...items, ...items, ...items, ...items]
  return (
    <div className="tapes" aria-hidden="true">
      <div className="tape tape--ink">
        <div className="tape__track" data-dir="1">
          {row(a).map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
      </div>
      <div className="tape tape--yellow">
        <div className="tape__track" data-dir="-1">
          {row(b).map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

function Problem() {
  const threats = [
    { t: 'Copy-traders', d: 'mirror every move you make.', i: <Ico.Eye />, tone: 'yellow' },
    { t: 'Front-runners', d: 'see your size before you trade.', i: <Ico.Bolt />, tone: 'aqua' },
    { t: 'Scammers', d: 'and worse target known whales.', i: <Ico.Target />, tone: 'pink' },
    { t: 'Clustering tools', d: 'tie your alts back to you.', i: <Ico.Link />, tone: 'mint' },
  ]
  return (
    <section className="section problem" id="problem" data-theme="pink">
      <div className="problem__text">
        <Chip tone="ink">The problem</Chip>
        <h2 className="h2" data-split>
          Your wallet is a <span className="hl hl--yellow">billboard.</span>
        </h2>
        <p className="lead" data-fade>
          Every holder check says “connect your wallet”. One click and anyone can read your bags, your history and
          every wallet you’ve ever linked.
        </p>
        <div className="threats" data-stagger>
          {threats.map((x, i) => (
            <div key={x.t} className={`threat card tilt-${i % 2 ? 'r' : 'l'}`}>
              <span className={`threat__ico bg-${x.tone}`}>{x.i}</span>
              <div>
                <b>{x.t}</b>
                <span>{x.d}</span>
              </div>
            </div>
          ))}
        </div>
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
      start: () => `top+=${window.innerHeight * 0.12} top`,
      end: () => `bottom-=${window.innerHeight * 1.08} top`,
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
    ['Sign', 'Connect a wallet and sign a free message. No transaction, nothing moves.'],
    ['Prove', 'Parhelion reads your balance on-chain once and seals a proof of the claim only: “holds ≥ X”.'],
    ['Pass', 'Drop the proof in the group. Valid in milliseconds. Wallet, balance, history: hidden.'],
  ]
  return (
    <section className="how" id="how" ref={ref} data-theme="cream">
      <div className="how__sticky">
        <div className="how__panel card">
          <div className="how__top">
            <Chip tone="ink">How it works</Chip>
            <span className="how__pct">{Math.round(p * 100)}%</span>
          </div>
          <h2 className="h2 h2--sm" data-split>
            Sign. Prove. <span className="hl hl--pink">Pass.</span>
          </h2>
          <ol className="steps">
            {steps.map(([t, d], i) => (
              <li key={t} className={i === active ? 'is-on' : i < active ? 'is-done' : ''}>
                <span className="steps__n">{i < active ? <Ico.Check size={18} /> : pad(i + 1)}</span>
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
          </div>
          <div className="meter__labels" aria-hidden="true">
            <span>doxxed</span>
            <span>anon</span>
          </div>
        </div>
        <div className={`slam ${p > 0.93 ? 'is-on' : ''}`} aria-hidden="true">
          <Ico.Check size={34} />
          <div>
            <b>Proof valid</b>
            <small>holds ≥ 1,000,000 {TICKER}</small>
          </div>
        </div>
        <p className="how__hint" aria-hidden="true">
          scroll to jump the hoop ↓
        </p>
      </div>
    </section>
  )
}

function Disclosure() {
  return (
    <section className="section disclosure" data-theme="mint">
      <div className="disclosure__text">
        <Chip tone="ink">What the group sees</Chip>
        <h2 className="h2" data-split>
          One fact. <span className="hl hl--white">Nothing else.</span>
        </h2>
        <p className="lead" data-fade>
          The proof says exactly one thing: you meet the threshold. Not by how much. Not from which wallet. Not what
          else you hold.
        </p>
        <div className="facts" data-stagger>
          <div className="fact card">
            <span className="fact__k">Group learns</span>
            <span className="fact__v">Token · threshold · valid · expiry</span>
          </div>
          <div className="fact card">
            <span className="fact__k">Parhelion checks</span>
            <span className="fact__v">Your balance, once — nothing stored</span>
          </div>
          <div className="fact card">
            <span className="fact__k">Custody</span>
            <span className="fact__v">Your tokens never move</span>
          </div>
        </div>
      </div>
      <div className="disclosure__paper" data-fade>
        <ProofReceipt ticker={TICKER} />
      </div>
    </section>
  )
}

function Uses() {
  const uses = [
    { t: 'Whale chats', d: 'Holder-only Telegram & Discord. Prove the tier, never the bag.', i: <Ico.Chat />, tone: 'yellow' },
    { t: 'Allowlists', d: 'Mint and presale access by proof. No wallet connect, no screenshot farming.', i: <Ico.List />, tone: 'pink' },
    { t: 'Holder perks', d: 'Roles, drops and early access for real holders — without a list of their wallets.', i: <Ico.Gift />, tone: 'aqua' },
    { t: 'Proof of funds', d: 'Show an OTC desk you can cover the block without opening your books.', i: <Ico.Vault />, tone: 'mint' },
    { t: 'Any token', d: 'SOL, $PRHL or any SPL token. Projects pick the mint and the threshold.', i: <Ico.Coins />, tone: 'lilac' },
    { t: 'Fresh proofs', d: 'Checked on-chain when issued, expires in 1–30 days. No stale screenshots.', i: <Ico.Clock />, tone: 'orange' },
  ]
  return (
    <section className="section" id="uses" data-theme="cream">
      <div className="sec-head">
        <Chip tone="ink">Use cases</Chip>
        <h2 className="h2" data-split>
          One proof. <span className="hl hl--yellow">Every door.</span>
        </h2>
      </div>
      <div className="uses" data-stagger>
        {uses.map((u) => (
          <article key={u.t} className={`use card bg-${u.tone}`}>
            <span className="use__ico">{u.i}</span>
            <h3>{u.t}</h3>
            <p>{u.d}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function Projects() {
  return (
    <section className="section projects" data-theme="blue">
      <div>
        <Chip tone="yellow">For projects</Chip>
        <h2 className="h2" data-split>
          Gate your group in <span className="hl hl--yellow">60 seconds.</span>
        </h2>
        <p className="lead" data-fade>
          Create a gate, share the link. Holders keep their privacy; you get real holders instead of farmers. Free now —
          paid in {TICKER} after launch.
        </p>
        <div className="hero__cta" data-fade>
          <Btn href="/app/gates" kind="yellow">
            Create a gate <Arrow />
          </Btn>
        </div>
      </div>
      <div className="chat card" data-chat>
        <div className="chat__head">
          <span className="chat__avatar">
            <PixelShades width={30} />
          </span>
          <div>
            <b>Whale Room</b>
            <small>4,207 members · gated by Parhelion</small>
          </div>
        </div>
        <div className="chat__body">
          <div className="bubble bubble--me" data-msg>
            <span className="bubble__proof">
              <Ico.Check size={16} /> rp2_9f3a…c21e
            </span>
            <small>anon_42 · just now</small>
          </div>
          <div className="bubble bubble--bot" data-msg>
            <b>ParhelionBot</b>
            <span>
              Proof valid: holds ≥ 1,000,000 {TICKER}. Wallet: hidden. Welcome in.
            </span>
          </div>
          <div className="bubble bubble--sys" data-msg>
            anon_42 joined the group
          </div>
        </div>
      </div>
    </section>
  )
}

function Token() {
  const rows = [
    { t: 'Pay to gate', d: `After launch, projects pay in ${TICKER} to create gates.`, tone: 'yellow' },
    { t: 'Buyback & burn', d: 'A share of every fee buys back and burns supply.', tone: 'pink' },
    { t: 'Hold = free proofs', d: `Holding ${TICKER} unlocks free proofs and premium tiers.`, tone: 'aqua' },
  ]
  return (
    <section className="section token" id="token" data-theme="ink">
      <Chip tone="yellow">The token</Chip>
      <h2 className="token__big" aria-label={TICKER}>
        {TICKER.split('').map((c, i) => (
          <span className="tl" key={i}>
            {c}
          </span>
        ))}
      </h2>
      <p className="lead" data-fade>
        The fuel for every proof. Utility first, meme always.
      </p>
      <div className="token__cards" data-stagger>
        {rows.map((r, i) => (
          <article key={r.t} className={`tcard card bg-${r.tone}`}>
            <span className="tcard__n">{pad(i + 1)}</span>
            <h3>{r.t}</h3>
            <p>{r.d}</p>
          </article>
        ))}
      </div>
      <div className="ca ca--dark" data-fade>
        <span className="ca__k">CA</span>
        <span className="ca__v">coming soon — never trust a CA from DMs</span>
      </div>
    </section>
  )
}

function Accordion({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`acc card ${open ? 'is-open' : ''}`}>
      <button className="acc__q" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>{q}</span>
        <span className="acc__x" aria-hidden="true">
          <Ico.Plus />
        </span>
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
    ['Is my wallet really hidden?', 'From the group, yes: the proof only says you meet the threshold. To issue it, Parhelion reads your public balance once and stores nothing. Next on the roadmap: Helius Privacy Rings with zero-knowledge proofs, so not even Parhelion sees your balance.'],
    ['What does the group learn?', 'Only that a Parhelion proof is valid for token X and threshold Y, and when it expires. Not your wallet, not your exact balance, not your history.'],
    ['Do I give up custody?', 'Never. Your tokens never move. You sign a free message — not a transaction — and Parhelion never asks for a private key.'],
    ['Can someone reuse my proof?', 'A proof can be shared by whoever holds it, so each one has a one-time ID and an expiry. Groups should admit each proof ID once.'],
  ]
  return (
    <section className="section faq" id="faq" data-theme="cream">
      <div className="sec-head">
        <Chip tone="ink">FAQ</Chip>
        <h2 className="h2" data-split>
          Asked by <span className="hl hl--aqua">anons.</span>
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
    <footer className="footer" id="footer" data-theme="yellow">
      <div className="footer__top">
        <h2 className="footer__big" aria-label="Go anon.">
          <span className="fw">Go</span> <span className="fw fw--pink">anon.</span>
        </h2>
        <div className="hero__cta center" data-fade>
          <Btn href="/app" kind="ink">
            Launch app <Arrow />
          </Btn>
          <Btn href="https://x.com/parhelioninwork" kind="white">
            <Ico.X /> Follow
          </Btn>
        </div>
      </div>
      <div className="footer__bottom">
        <span className="brand">
          <Logo size={22} /> Parhelion
        </span>
        <span>Built on Helius · Powered by Solana</span>
      </div>
    </footer>
  )
}

/* ------------------------------------------------------------------ */
/* choreography                                                        */
/* ------------------------------------------------------------------ */

function useChoreography(ready: boolean) {
  useLayoutEffect(() => {
    const lenis = initSmoothScroll()
    lenis?.stop()
    window.scrollTo(0, 0)
    document.body.dataset.theme = 'aqua'
    if (reducedMotion) {
      scroll.intro = 1
      return
    }
    gsap.set('.hero .line__in', { yPercent: 120, rotate: 4 })
    gsap.set('[data-intro="fade"]', { opacity: 0, y: 24 })
    gsap.set('[data-intro="pop"]', { opacity: 0, scale: 0.4 })
    gsap.set('.nav__pill', { yPercent: -160 })
  }, [])

  useLayoutEffect(() => {
    if (!ready) return
    const lenis = getLenis()
    const ctx = gsap.context(() => {
      /* ---- intro ---- */
      const intro = { v: 0 }
      const tl = gsap.timeline({ onComplete: () => lenis?.start() })
      tl.to('.nav__pill', { yPercent: 0, duration: 0.9, ease: 'back.out(1.6)' }, 0)
        .to(intro, { v: 1, duration: 1.8, ease: 'elastic.out(1, 0.6)', onUpdate: () => void (scroll.intro = intro.v) }, 0.1)
        .to('.hero .line__in', { yPercent: 0, rotate: 0, duration: 1.0, stagger: 0.09, ease: 'back.out(1.4)' }, 0.05)
        .to('[data-intro="fade"]', { opacity: 1, y: 0, duration: 0.8, stagger: 0.08, ease: 'power3.out' }, 0.45)
        .to('[data-intro="pop"]', { opacity: 1, scale: 1, duration: 0.7, stagger: 0.08, ease: 'back.out(2.4)' }, 0.6)
      if (reducedMotion) tl.progress(1)

      /* ---- page colour follows the section in view ---- */
      gsap.utils.toArray<HTMLElement>('[data-theme]').forEach((el) => {
        ScrollTrigger.create({
          trigger: el,
          start: 'top 55%',
          end: 'bottom 55%',
          onToggle: (self) => {
            if (self.isActive) document.body.dataset.theme = el.dataset.theme!
          },
        })
      })

      /* ---- headings: words pop up ---- */
      gsap.utils.toArray<HTMLElement>('[data-split]').forEach((el) => {
        SplitText.create(el, {
          type: 'words',
          wordsClass: 'sw',
          autoSplit: true,
          onSplit(self) {
            return gsap.from(self.words, {
              yPercent: 90,
              opacity: 0,
              rotate: () => gsap.utils.random(-8, 8),
              duration: 0.8,
              stagger: 0.06,
              ease: 'back.out(2)',
              scrollTrigger: { trigger: el, start: 'top 85%', once: true },
            })
          },
        })
      })

      /* ---- fades & staggered cards ---- */
      gsap.utils.toArray<HTMLElement>('[data-fade]').forEach((el) => {
        gsap.from(el, { y: 40, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } })
      })
      gsap.utils.toArray<HTMLElement>('[data-stagger]').forEach((el) => {
        gsap.from(el.children, {
          y: 60,
          opacity: 0,
          rotate: () => gsap.utils.random(-6, 6),
          scale: 0.92,
          duration: 0.8,
          stagger: 0.08,
          ease: 'back.out(1.7)',
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        })
      })

      /* ---- telegram chat plays out ---- */
      gsap.from('[data-msg]', {
        y: 20,
        opacity: 0,
        scale: 0.9,
        transformOrigin: 'left bottom',
        stagger: 0.55,
        duration: 0.5,
        ease: 'back.out(2)',
        scrollTrigger: { trigger: '[data-chat]', start: 'top 70%', once: true },
      })

      /* ---- $PRHL letters bounce as you scroll ---- */
      gsap.fromTo(
        '.tl',
        { yPercent: 40, rotate: (i) => (i % 2 ? 10 : -10) },
        { yPercent: -10, rotate: 0, stagger: 0.08, ease: 'none', scrollTrigger: { trigger: '.token__big', start: 'top 90%', end: 'top 30%', scrub: 0.6 } },
      )

      /* ---- footer headline ---- */
      gsap.from('.fw', {
        yPercent: 110,
        rotate: (i) => (i ? 8 : -8),
        stagger: 0.12,
        duration: 1,
        ease: 'back.out(1.6)',
        scrollTrigger: { trigger: '.footer__big', start: 'top 80%', once: true },
      })

      /* ---- nav hides on scroll down ---- */
      const nav = document.querySelector<HTMLElement>('.nav')!
      ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: (self) => nav.classList.toggle('is-hidden', self.direction === 1 && self.scroll() > 240),
      })

      /* ---- tapes react to scroll speed ---- */
      const tracks = gsap.utils.toArray<HTMLElement>('.tape__track')
      const xs = tracks.map(() => 0)
      const tick = () => {
        const vel = getVelocity()
        tracks.forEach((tr, i) => {
          const dir = Number(tr.dataset.dir)
          xs[i] -= (0.7 + Math.min(16, Math.abs(vel) * 0.4)) * dir
          const quarter = tr.scrollWidth / 4
          if (xs[i] <= -quarter) xs[i] += quarter
          if (xs[i] > 0) xs[i] -= quarter
          tr.style.transform = `translate3d(${xs[i].toFixed(1)}px,0,0)`
        })
      }
      gsap.ticker.add(tick)

      /* ---- stickers drift with the mouse ---- */
      const parallax = gsap.utils.toArray<HTMLElement>('[data-parallax]').map((el) => ({
        k: Number(el.dataset.parallax),
        x: gsap.quickTo(el, 'x', { duration: 0.8, ease: 'power3' }),
        y: gsap.quickTo(el, 'y', { duration: 0.8, ease: 'power3' }),
      }))
      const onMove = (e: PointerEvent) => {
        const mx = e.clientX / window.innerWidth - 0.5
        const my = e.clientY / window.innerHeight - 0.5
        parallax.forEach((p) => {
          p.x(mx * 40 * p.k)
          p.y(my * 30 * p.k)
        })
      }
      window.addEventListener('pointermove', onMove, { passive: true })

      /* ---- magnetic buttons ---- */
      const cleanups: (() => void)[] = []
      if (window.matchMedia('(pointer: fine)').matches) {
        gsap.utils.toArray<HTMLElement>('[data-magnetic]').forEach((el) => {
          const qx = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' })
          const qy = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' })
          const move = (e: PointerEvent) => {
            const r = el.getBoundingClientRect()
            qx((e.clientX - (r.left + r.width / 2)) * 0.22)
            qy((e.clientY - (r.top + r.height / 2)) * 0.3)
          }
          const leave = () => gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' })
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
        window.removeEventListener('pointermove', onMove)
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
    <div className="landing">
      <Preloader onReveal={() => setReady(true)} />
      <div className="stage" aria-hidden="true">
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </div>
      <Nav />
      <main className="content">
        <Hero />
        <Tapes />
        <Problem />
        <How />
        <Disclosure />
        <Uses />
        <Projects />
        <Token />
        <Faq />
      </main>
      <Footer />
    </div>
  )
}
