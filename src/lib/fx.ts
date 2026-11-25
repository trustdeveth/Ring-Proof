import { useEffect, useRef, useState } from 'react'

const GLYPHS = '█▓▒░#%&$@01ΞΔΣ<>/\\=+*'

/** Scramble text towards a target string. Re-runs whenever `target` changes. */
export function useScramble(target: string, { duration = 900, delay = 0 } = {}) {
  const [out, setOut] = useState(target)
  useEffect(() => {
    let raf = 0
    let start = 0
    const tick = (now: number) => {
      if (!start) start = now + delay
      const p = Math.max(0, Math.min(1, (now - start) / duration))
      let s = ''
      for (let i = 0; i < target.length; i++) {
        const ch = target[i]
        if (ch === ' ') s += ' '
        else if (i / target.length < p) s += ch
        else s += GLYPHS[(Math.random() * GLYPHS.length) | 0]
      }
      setOut(s)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, delay])
  return out
}

/** Adds data-in="1" when the element scrolls into view (once). */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.dataset.in = '1'
          io.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
}

/** True while the element is on screen (used to pause the 3D canvas). */
export function useOnScreen<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [on, setOn] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, on] as const
}
