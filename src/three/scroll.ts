/**
 * Scroll choreography for the Anon Whale.
 * Keyframe scroll positions are measured from section anchors; poses are interpolated between them.
 * During the method section the whale follows a jump arc through the hoop (driven by `jump`).
 */

export type Pose = {
  x: number
  y: number
  z: number
  ry: number // yaw (nose direction)
  rx: number // camera-facing tilt (shows the back)
  s: number
  hoop: number // hoop scale 0..1 — also the weight of the jump path
  jump: number // -1 (before hoop) .. +1 (through)
  shades: number
  coins: number
  tags: number
}

const BASE = { z: 0, hoop: 0, jump: -1, shades: 0, coins: 0, tags: 0 }

const DESKTOP: Pose[] = [
  /* hero      */ { ...BASE, x: 2.75, y: -0.35, ry: -2.35, rx: 0.3, s: 1.0, coins: 1 },
  /* problem   */ { ...BASE, x: -2.85, y: -0.25, ry: -0.8, rx: 0.32, s: 0.92, coins: 1, tags: 1 },
  /* method in */ { ...BASE, x: -0.8, y: -0.6, ry: -0.45, rx: 0.25, s: 0.74, hoop: 1, jump: -1, coins: 1, tags: 1 },
  /* method out*/ { ...BASE, x: 3.1, y: -0.6, ry: -1.95, rx: 0.25, s: 0.8, hoop: 1, jump: 0.6, coins: 0, tags: 1, shades: 1 },
  /* exit      */ { ...BASE, x: 12, y: 0.2, ry: -0.9, rx: 0.25, s: 0.8, hoop: 0, jump: 0.6, shades: 1 },
  // teleport (1px apart, both off-screen), then wait off-screen left until the footer
  /* re-enter  */ { ...BASE, x: -12, y: -1.6, ry: -1.6, rx: 0.22, s: 0.82, shades: 1, jump: 1 },
  /* hold      */ { ...BASE, x: -12, y: -1.6, ry: -1.6, rx: 0.22, s: 0.82, shades: 1, jump: 1 },
  /* footer    */ { ...BASE, x: 0, y: -1.6, ry: -1.75, rx: 0.22, s: 0.82, shades: 1, jump: 1 },
]

const toMobile = (p: Pose, i: number): Pose => ({
  ...p,
  x: Math.abs(p.x) > 8 ? p.x : p.x * 0.18,
  y: i >= 5 ? -0.85 : i >= 2 ? 1.55 : 1.25,
  s: p.s * 0.52,
})
const MOBILE = DESKTOP.map(toMobile)

/** Where the hoop sits and which way it faces (desktop / mobile). */
export const HOOP = {
  desktop: { x: 1.75, y: -0.35, z: -0.6, yaw: -0.45, s: 1, span: 2.7, arc: 0.9 },
  mobile: { x: 0.2, y: 1.55, z: -0.6, yaw: -0.45, s: 0.55, span: 1.5, arc: 0.5 },
}

export const scroll = {
  smooth: 0,
  intro: 0,
  keys: [0, 1, 2, 3, 4, 5, 6, 7] as number[],
}

export function measure() {
  const vh = window.innerHeight
  const top = (id: string) => {
    const el = document.getElementById(id)
    return el ? el.getBoundingClientRect().top + window.scrollY : 0
  }
  const max = Math.max(1, document.documentElement.scrollHeight - vh)
  const how = document.getElementById('how')
  const howTop = top('how')
  const howEnd = howTop + (how ? how.offsetHeight : vh) - vh
  const footTop = top('footer')
  scroll.keys = [
    0,
    top('problem') - vh * 0.05,
    howTop + vh * 0.12,
    howEnd - vh * 0.08,
    howEnd + vh * 0.7,
    howEnd + vh * 0.7 + 1,
    Math.min(footTop - vh * 0.55, max - 2),
    max,
  ]
  for (let i = 1; i < scroll.keys.length; i++) if (scroll.keys[i] <= scroll.keys[i - 1]) scroll.keys[i] = scroll.keys[i - 1] + 1
}

const ease = (t: number) => t * t * (3 - 2 * t)

export function poseAt(y: number, mobile: boolean): Pose {
  const poses = mobile ? MOBILE : DESKTOP
  const k = scroll.keys
  if (y <= k[0]) return poses[0]
  for (let i = 0; i < k.length - 1; i++) {
    if (y <= k[i + 1]) {
      const raw = (y - k[i]) / (k[i + 1] - k[i])
      const t = i === 2 ? raw : ease(raw) // the jump tracks the scrollbar 1:1
      const a = poses[i]
      const b = poses[i + 1]
      const out = {} as Pose
      for (const key of Object.keys(a) as (keyof Pose)[]) out[key] = a[key] + (b[key] - a[key]) * t
      return out
    }
  }
  return poses[poses.length - 1]
}
