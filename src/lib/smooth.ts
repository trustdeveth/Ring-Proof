import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText)

export const reducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

let lenis: Lenis | null = null

/** Smooth scrolling driven by GSAP's ticker so ScrollTrigger and Lenis stay in sync. */
export function initSmoothScroll() {
  if (lenis || reducedMotion) return lenis
  lenis = new Lenis({ autoRaf: false, anchors: { offset: 0 }, lerp: 0.1 })
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((time) => lenis?.raf(time * 1000))
  gsap.ticker.lagSmoothing(0)
  return lenis
}

export const getLenis = () => lenis

/** Scroll velocity in px/frame-ish units (0 when idle). Used by the 3D whale. */
export const getVelocity = () => lenis?.velocity ?? 0

export { gsap, ScrollTrigger, SplitText }
