import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, Link } from 'react-router'
import { gsap } from 'gsap'
import { Logo } from '../landing/icons'
import { WalletProviders, useOwner, useWalletModal } from './wallet'
import { Toasts } from './ui'
import Vault from './pages/Vault'
import Prove from './pages/Prove'
import Proofs from './pages/Proofs'
import Gates from './pages/Gates'
import Verify from './pages/Verify'
import './app.css'

const MiniWhale = lazy(() => import('../three/MiniWhale'))

const NAV = [
  { to: '/app', end: true, n: '01', label: 'Vault', icon: 'M4 7h16v12H4zM8 7V5h8v2M12 12v3' },
  { to: '/app/prove', n: '02', label: 'Prove', icon: 'M5 12l4 4L19 6' },
  { to: '/app/proofs', n: '03', label: 'Proofs', icon: 'M6 3h9l3 3v15H6zM9 10h6M9 14h6' },
  { to: '/app/gates', n: '04', label: 'Gates', icon: 'M4 21V8l8-5 8 5v13M9 21v-7h6v7' },
  { to: '/app/verify', n: '05', label: 'Verify', icon: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5' },
]

function Ico({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

function WalletButton() {
  const { owner, label, walletIcon, disconnect } = useOwner()
  const { open } = useWalletModal()
  const [menu, setMenu] = useState(false)
  if (!owner)
    return (
      <button className="btn btn--ink btn--sm" onClick={open}>
        <span className="btn__label">Connect wallet</span>
      </button>
    )
  return (
    <div className="wbtn">
      <button className="wbtn__main" onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
        {walletIcon && <img src={walletIcon} alt="" width={18} height={18} />}
        <span className="mono">{label}</span>
        <span className="wbtn__caret" aria-hidden="true">▾</span>
      </button>
      {menu && (
        <div className="wbtn__menu sheet" onMouseLeave={() => setMenu(false)}>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(owner)
              setMenu(false)
            }}
          >
            Copy address
          </button>
          <a href={`https://solscan.io/account/${owner}`} target="_blank" rel="noreferrer">
            View on Solscan ↗
          </a>
          <button
            onClick={() => {
              setMenu(false)
              disconnect()
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}

function Connect() {
  const { open } = useWalletModal()
  return (
    <div className="connect">
      <div className="connect__whale" aria-hidden="true">
        <Suspense fallback={null}>
          <MiniWhale shades={false} />
        </Suspense>
      </div>
      <div className="connect__card sheet" data-anim>
        <p className="label">Anon mode</p>
        <h1 className="connect__title">
          Go <em>anon.</em>
        </h1>
        <p className="muted">
          Connect a Solana wallet to prove what you hold — without the group ever seeing which wallet is yours.
          Connecting sends no transaction.
        </p>
        <button className="btn btn--ink" onClick={open}>
          <span className="btn__label">Connect wallet →</span>
        </button>
        <p className="connect__alt mono">
          Checking someone’s proof? <Link to="/app/verify">Verify without a wallet →</Link>
        </p>
      </div>
    </div>
  )
}

function useRouteTransition() {
  const { pathname } = useLocation()
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!ref.current) return
    window.scrollTo(0, 0)
    const els = ref.current.querySelectorAll('[data-anim]')
    const ctx = gsap.context(() => {
      gsap.fromTo(els, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.06, ease: 'expo.out', clearProps: 'transform' })
    }, ref)
    return () => ctx.revert()
  }, [pathname])
  return ref
}

function Shell() {
  const { owner } = useOwner()
  const { pathname } = useLocation()
  const ref = useRouteTransition()
  const needsWallet = !pathname.startsWith('/app/verify')

  useEffect(() => {
    document.title = 'Parhelion — App'
  }, [])

  return (
    <div className="app">
      <header className="topbar">
        <a href="/" className="brand" aria-label="Parhelion home">
          <Logo size={26} /> Parhelion
        </a>
        <span className="netpill netpill--live mono" title="Balances are read live from Solana mainnet">
          <i /> Mainnet
        </span>
        <div className="topbar__right">
          <WalletButton />
        </div>
      </header>

      <nav className="rail" aria-label="App">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `rail__a ${isActive ? 'on' : ''}`}>
            <span className="rail__n mono">{n.n}</span>
            <Ico d={n.icon} />
            <span className="rail__l">{n.label}</span>
          </NavLink>
        ))}
        <div className="rail__foot mono">
          <a href="/">← Back to site</a>
        </div>
      </nav>

      <main className="page" ref={ref} key={pathname}>
        {needsWallet && !owner ? (
          <Connect />
        ) : (
          <Routes>
            <Route index element={<Vault />} />
            <Route path="prove" element={<Prove />} />
            <Route path="proofs" element={<Proofs />} />
            <Route path="gates" element={<Gates />} />
            <Route path="verify" element={<Verify />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        )}
      </main>
      <Toasts />
    </div>
  )
}

export default function AppRoot() {
  return (
    <WalletProviders>
      <Shell />
    </WalletProviders>
  )
}
