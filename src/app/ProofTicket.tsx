import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { botLink, claimText } from './client'
import type { ProofRecord } from './store'
import { CopyButton, Stamp, timeLeft } from './ui'

/** The issued proof, printed as a ticket. It carries the claim and nothing about the wallet. */
export default function ProofTicket({ proof, animate = true, compact = false }: { proof: ProofRecord; animate?: boolean; compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!animate || !ref.current) return
    const ctx = gsap.context(() => {
      gsap.from(ref.current, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.1, ease: 'expo.inOut' })
      gsap.from('.ticket__row', { opacity: 0, x: -10, stagger: 0.06, duration: 0.6, delay: 0.5, ease: 'expo.out' })
    }, ref)
    return () => ctx.revert()
  }, [animate])

  const expired = proof.expiresAt < Date.now()
  return (
    <div className={`ticket ${compact ? 'ticket--compact' : ''} ${expired ? 'is-expired' : ''}`} ref={ref}>
      <div className="ticket__top">
        <span className="mono">RingProof · holder proof</span>
        <span className="mono">#{proof.id}</span>
      </div>
      <div className="ticket__claim">{claimText(proof)}</div>
      <dl className="ticket__meta mono">
        <div className="ticket__row">
          <dt>Issued</dt>
          <dd>{new Date(proof.createdAt).toLocaleString()}</dd>
        </div>
        <div className="ticket__row">
          <dt>Expires</dt>
          <dd>
            {new Date(proof.expiresAt).toLocaleDateString()} · {timeLeft(proof.expiresAt)}
          </dd>
        </div>
        {proof.gateName && (
          <div className="ticket__row">
            <dt>Gate</dt>
            <dd>
              {proof.gateName} · #{proof.gateId}
            </dd>
          </div>
        )}
        <div className="ticket__row">
          <dt>Wallet</dt>
          <dd>
            <span className="bar">██████████</span> not included
          </dd>
        </div>
        <div className="ticket__row">
          <dt>Exact balance</dt>
          <dd>
            <span className="bar">██████████</span> not included
          </dd>
        </div>
      </dl>
      <div className="ticket__perf" aria-hidden="true" />
      <code className="ticket__code" title={proof.code}>
        {proof.code}
      </code>
      <div className="ticket__actions">
        <CopyButton text={proof.code} label="Copy proof" className="btn btn--ink btn--sm" />
        <a className="btn btn--line btn--sm" href={botLink(`p_${proof.id}`)} target="_blank" rel="noreferrer">
          <span className="btn__label">Open Telegram bot ↗</span>
        </a>
      </div>
      {!compact && (
        <div className="ticket__stamp">
          <Stamp kind={expired ? 'invalid' : 'valid'}>{expired ? 'Expired' : 'Proof valid'}</Stamp>
        </div>
      )}
    </div>
  )
}
