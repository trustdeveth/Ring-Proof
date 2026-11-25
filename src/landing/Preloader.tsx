import { useLayoutEffect, useRef } from 'react'
import { gsap, reducedMotion } from '../lib/smooth'

const STEPS = ['Locating whale', 'Reading balances', 'Encrypting notes', 'Generating proof', 'Access granted']

/** "Decrypting the file" intro. Calls onReveal as the panel starts lifting. */
export default function Preloader({ onReveal }: { onReveal: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const done = useRef(false)

  useLayoutEffect(() => {
    const el = root.current!
    const reveal = () => {
      if (done.current) return
      done.current = true
      onReveal()
    }
    if (reducedMotion) {
      el.style.display = 'none'
      reveal()
      return
    }
    const num = el.querySelector<HTMLElement>('.pre__num')!
    const step = el.querySelector<HTMLElement>('.pre__step')!
    const arc = el.querySelector<SVGCircleElement>('.pre__arc')!
    const len = arc.getTotalLength()
    const state = { p: 0 }
    const ctx = gsap.context(() => {
      gsap.set(arc, { strokeDasharray: len, strokeDashoffset: len })
      const tl = gsap.timeline()
      tl.from('.pre__meta > *', { yPercent: 120, duration: 0.6, stagger: 0.06, ease: 'expo.out' })
        .to(
          state,
          {
            p: 1,
            duration: 1.9,
            ease: 'power2.inOut',
            onUpdate() {
              const v = Math.round(state.p * 100)
              num.textContent = String(v).padStart(3, '0')
              arc.style.strokeDashoffset = String(len * (1 - state.p))
              step.textContent = STEPS[Math.min(STEPS.length - 1, Math.floor(state.p * (STEPS.length - 0.01)))]
            },
          },
          0.1,
        )
        .to('.pre__bar', { scaleX: 1, duration: 0.45, ease: 'expo.inOut' })
        .to('.pre__inner', { yPercent: -12, opacity: 0, duration: 0.6, ease: 'expo.in' }, '+=0.05')
        .add(reveal, '-=0.15')
        .to(el, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.0, ease: 'expo.inOut' }, '-=0.25')
        .set(el, { display: 'none' })
    }, el)
    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="pre" ref={root} aria-hidden="true">
      <div className="pre__inner">
        <div className="pre__meta mono">
          <span>RingProof</span>
          <span>File No. 001</span>
          <span>Classified</span>
        </div>
        <div className="pre__center">
          <svg className="pre__ring" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" className="pre__track" />
            <circle cx="60" cy="60" r="52" className="pre__arc" />
          </svg>
          <div className="pre__num">000</div>
        </div>
        <div className="pre__foot mono">
          <span className="pre__step">Locating whale</span>
          <span className="pre__barwrap">
            <span className="pre__bar" />
          </span>
        </div>
      </div>
    </div>
  )
}
