import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { gsap } from 'gsap'
import type { Step } from './client'
import { SOL, SOL_ASSET, type Asset } from './tokens'
import { useDefaultAssets, useMintLookup } from './hooks'

/* ---------- page header ---------- */
export function PageHead({ num, label, title, lead, aside }: { num: string; label: string; title: ReactNode; lead?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="phead" data-anim>
      <div className="phead__main">
        <p className="label">
          § {num} — {label}
        </p>
        <h1 className="phead__title">{title}</h1>
        {lead && <p className="phead__lead">{lead}</p>}
      </div>
      {aside && <div className="phead__aside">{aside}</div>}
    </header>
  )
}

/* ---------- segmented control ---------- */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value))
  return (
    <div className="seg" role="radiogroup" aria-label={label} style={{ ['--n' as string]: options.length, ['--i' as string]: idx }}>
      <span className="seg__thumb" aria-hidden="true" />
      {options.map((o) => (
        <button key={String(o.value)} role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Pick SOL / $PRHL, or paste any SPL mint. Calls onChange(null) while a pasted mint is unresolved.
 */
export function AssetPicker({ value, onChange, lockedTo }: { value: Asset | null; onChange: (a: Asset | null) => void; lockedTo?: Asset }) {
  const defaults = useDefaultAssets()
  const [mode, setMode] = useState<string>(value && value.asset !== SOL && !defaults.some((d) => d.asset === value.asset) ? 'other' : value?.asset ?? SOL)
  const [mint, setMint] = useState(mode === 'other' && value ? value.asset : '')
  const lookup = useMintLookup(mode === 'other' ? mint : '')

  useEffect(() => {
    if (mode === 'other') onChange(lookup.asset)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookup.asset, mode])

  if (lockedTo)
    return (
      <div className="asset-locked mono">
        <b>{lockedTo.symbol}</b> <span className="muted">set by the gate</span>
      </div>
    )

  return (
    <div className="asset-picker">
      <Segmented
        label="Token"
        value={mode}
        onChange={(m) => {
          setMode(m)
          if (m !== 'other') onChange(defaults.find((d) => d.asset === m) ?? SOL_ASSET)
          else onChange(lookup.asset)
        }}
        options={[...defaults.map((d) => ({ value: d.asset, label: d.symbol })), { value: 'other', label: 'Other token' }]}
      />
      {mode === 'other' && (
        <div className="mint">
          <input
            className="input mono"
            placeholder="Paste token mint address"
            spellCheck={false}
            value={mint}
            onChange={(e) => setMint(e.target.value.trim())}
            aria-label="Token mint address"
          />
          <p className="mint__status mono">
            {lookup.loading
              ? 'Looking up mint…'
              : lookup.error
                ? <span className="bad">{lookup.error}</span>
                : lookup.asset
                  ? <span className="good">✓ {lookup.asset.symbol}{lookup.asset.name ? ` · ${lookup.asset.name}` : ''} · {lookup.asset.decimals} decimals</span>
                  : 'Any SPL or Token-2022 mint.'}
          </p>
        </div>
      )}
    </div>
  )
}

/* ---------- amount ---------- */
/** "5000000.5" → "5,000,000.5" for display; the raw value stays comma-free. */
function withCommas(v: string) {
  if (!v) return v
  const [int, dec] = v.split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return dec !== undefined ? `${grouped}.${dec}` : grouped
}

export function AmountInput({
  value,
  onChange,
  suffix,
  max,
  presets,
  id,
}: {
  value: string
  onChange: (v: string) => void
  suffix: string
  max?: number
  presets?: number[]
  id: string
}) {
  return (
    <div className="amount">
      <div className="amount__row">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={withCommas(value)}
          onChange={(e) => {
            const v = e.target.value.replace(/,/g, '')
            if (/^\d*\.?\d*$/.test(v) && v.length <= 18) onChange(v)
          }}
        />
        <span className="amount__suffix mono">{suffix}</span>
      </div>
      {(presets || max !== undefined) && (
        <div className="chips">
          {presets?.map((p) => (
            <button key={p} className="chip" onClick={() => onChange(String(p))}>
              {p >= 1e6 ? `${p / 1e6}M` : p >= 1e3 ? `${p / 1e3}K` : p}
            </button>
          ))}
          {max !== undefined && (
            <button className="chip chip--ink" onClick={() => onChange(String(max))} disabled={max <= 0}>
              Max
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------- redaction ---------- */
export function Redacted({ children, revealed, className = '' }: { children: ReactNode; revealed: boolean; className?: string }) {
  return (
    <span className={`rd ${revealed ? 'is-open' : ''} ${className}`}>
      <span className="rd__v">{children}</span>
      <span className="rd__bar" aria-hidden="true" />
      {!revealed && <span className="sr-only">hidden</span>}
    </span>
  )
}

/** Press and hold to run an action (used for unlocking the ring view). */
export function HoldButton({ onDone, children, ms = 900, disabled }: { onDone: () => void; children: ReactNode; ms?: number; disabled?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null)
  const tw = useRef<gsap.core.Tween | null>(null)
  const start = () => {
    if (disabled) return
    tw.current?.kill()
    tw.current = gsap.to(ref.current, { '--p': 1, duration: ms / 1000, ease: 'none', onComplete: onDone })
  }
  const stop = () => {
    tw.current?.kill()
    gsap.to(ref.current, { '--p': 0, duration: 0.3, ease: 'power2.out' })
  }
  return (
    <button
      ref={ref}
      className="btn btn--ink hold"
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !e.repeat && start()}
      onKeyUp={stop}
      style={{ ['--p' as string]: 0 }}
    >
      <span className="hold__fill" aria-hidden="true" />
      <span className="btn__label">{children}</span>
    </button>
  )
}

/* ---------- progress steps ---------- */
export function Steps({ steps, current, failAt }: { steps: Step[]; current: number; failAt?: number }) {
  return (
    <ol className="steps-v">
      {steps.map((s, i) => {
        const state =
          failAt !== undefined && i === failAt ? 'fail' : failAt !== undefined && i > failAt ? 'todo' : i < current ? 'done' : i === current ? 'active' : 'todo'
        return (
          <li key={s.label} data-state={state}>
            <span className="steps-v__mark" aria-hidden="true">
              {state === 'done' ? '✓' : state === 'fail' ? '✕' : String(i + 1).padStart(2, '0')}
            </span>
            <span className="steps-v__txt">
              <b>{s.label}</b>
              {s.detail && <small>{s.detail}</small>}
            </span>
            {state === 'active' && failAt === undefined && <span className="spinner" aria-label="working" />}
          </li>
        )
      })}
    </ol>
  )
}

/* ---------- stamps ---------- */
export function Stamp({ kind, children }: { kind: 'valid' | 'invalid'; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    gsap.fromTo(ref.current, { scale: 2.4, rotate: kind === 'valid' ? -22 : 18, opacity: 0 }, { scale: 1, rotate: kind === 'valid' ? -7 : 6, opacity: 1, duration: 0.45, ease: 'power4.in' })
  }, [kind])
  return (
    <div ref={ref} className={`astamp astamp--${kind}`}>
      {children}
    </div>
  )
}

/* ---------- animated number ---------- */
export function Num({ value, digits = 2 }: { value: number; digits?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const last = useRef(0)
  useEffect(() => {
    const o = { v: last.current }
    const t = gsap.to(o, {
      v: value,
      duration: 1.1,
      ease: 'expo.out',
      onUpdate: () => {
        if (ref.current) ref.current.textContent = o.v.toLocaleString('en-US', { maximumFractionDigits: value >= 1000 ? 0 : digits })
      },
    })
    last.current = value
    return () => {
      t.kill()
    }
  }, [value, digits])
  return <span ref={ref} className="num">0</span>
}

/* ---------- copy ---------- */
export function CopyButton({ text, label = 'Copy', className = 'btn btn--line btn--sm' }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          toast('Copied to clipboard')
          setTimeout(() => setDone(false), 1500)
        } catch {
          toast('Copy failed — select and copy manually', 'error')
        }
      }}
    >
      <span className="btn__label">{done ? 'Copied ✓' : label}</span>
    </button>
  )
}

/* ---------- toasts ---------- */
type T = { id: number; msg: string; kind: 'ok' | 'error' }
let toasts: T[] = []
const tl = new Set<() => void>()
let tid = 0
export function toast(msg: string, kind: T['kind'] = 'ok') {
  const t = { id: ++tid, msg, kind }
  toasts = [...toasts, t]
  tl.forEach((l) => l())
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id)
    tl.forEach((l) => l())
  }, 3200)
}
export function Toasts() {
  const list = useSyncExternalStore(
    (l) => {
      tl.add(l)
      return () => tl.delete(l)
    },
    () => toasts,
  )
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}

export function timeAgo(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function timeLeft(ts: number) {
  const s = Math.round((ts - Date.now()) / 1000)
  if (s <= 0) return 'expired'
  if (s < 3600) return `${Math.ceil(s / 60)}m left`
  if (s < 86400) return `${Math.floor(s / 3600)}h left`
  return `${Math.floor(s / 86400)}d left`
}
