import { useLayoutEffect, useRef } from 'react'
import { gsap, reducedMotion } from '../lib/smooth'
import { PixelShades } from './icons'

/** Count to 100, then the shades drop: "deal with it". Calls onReveal as the curtain lifts. */
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
    const state = { p: 0 }
    const ctx = gsap.context(() => {
      gsap
        .timeline()
        .from('.pre__tag', { y: 30, opacity: 0, duration: 0.5, ease: 'back.out(2)' })
        .to(
          state,
          {
            p: 1,
            duration: 1.3,
            ease: 'power2.inOut',
            onUpdate() {
              num.textContent = String(Math.round(state.p * 100))
              gsap.set('.pre__fill', { scaleX: state.p })
            },
          },
          0.1,
        )
        .fromTo('.pre__shades', { y: -260, opacity: 1 }, { y: 0, duration: 0.55, ease: 'bounce.out' })
        .from('.pre__deal', { scale: 0, rotate: -12, duration: 0.4, ease: 'back.out(3)' }, '-=0.15')
        .add(reveal, '+=0.25')
        .to(el, { yPercent: -100, duration: 0.85, ease: 'expo.inOut' }, '+=0.05')
        .set(el, { display: 'none' })
    }, el)
    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="pre" ref={root} aria-hidden="true">
      <div className="pre__center">
        <span className="pre__tag">loading anon mode</span>
        <div className="pre__numwrap">
          <span className="pre__num">0</span>
          <span className="pre__pct">%</span>
          <span className="pre__shades">
            <PixelShades width={300} />
          </span>
        </div>
        <div className="pre__bar">
          <span className="pre__fill" />
        </div>
        <span className="pre__deal">deal with it.</span>
      </div>
    </div>
  )
}
