/**
 * Scroll choreography. Each keyframe is a scroll position (measured from the DOM)
 * paired with a pose for the whale + ring. The scene evaluates these every frame
 * against a smoothed scroll value.
 */

export type Pose = {
  x: number // lane position
  y: number
  z: number
  ry: number // lane yaw
  s: number // lane scale
  wx: number // whale offset along the lane (ring sits at 0)
  split: number // whale-local x of the redaction plane (>2.3 = fully exposed, <-2.1 = fully redacted)
  ring: number // ring scale 0..1
  tags: number // exposed-data tags opacity 0..1
}

const WHALE_SCALE = 1.2
export { WHALE_SCALE }

// crossing: whale offset must equal -split * WHALE_SCALE so the redaction plane sits on the ring
const crossing = (split: number) => ({ split, wx: -split * WHALE_SCALE })

const DESKTOP: Pose[] = [
  /* hero      */ { x: 2.35, y: -0.2, z: 0, ry: -0.35, s: 0.84, wx: 0, split: 3, ring: 0, tags: 0 },
  /* problem   */ { x: -2.75, y: -0.15, z: 0, ry: 2.85, s: 0.8, wx: 0, split: 3, ring: 0, tags: 1 },
  /* how start */ { x: 2.7, y: -0.25, z: -1, ry: -0.6, s: 0.9, ...crossing(2.5), ring: 1, tags: 1 },
  /* how end   */ { x: 2.7, y: -0.25, z: -1, ry: -0.6, s: 0.9, ...crossing(-2.6), ring: 1, tags: 1 },
  /* exit      */ { x: 12, y: -0.25, z: -1, ry: -0.6, s: 0.9, ...crossing(-2.6), ring: 0, tags: 0 },
  // teleport (1px apart, both off-screen) then wait off-screen left until the footer
  /* re-enter  */ { x: -12, y: -1.05, z: 0, ry: -0.15, s: 0.78, wx: 0, split: -3, ring: 0, tags: 0 },
  /* hold      */ { x: -12, y: -1.05, z: 0, ry: -0.15, s: 0.78, wx: 0, split: -3, ring: 0, tags: 0 },
  /* footer    */ { x: 0, y: -1.05, z: 0, ry: -0.15, s: 0.78, wx: 0, split: -3, ring: 0, tags: 0 },
]

const toMobile = (p: Pose, i: number): Pose => ({
  ...p,
  x: p.x * (Math.abs(p.x) > 8 ? 1 : 0.15),
  y: i >= 5 ? -1.6 : i >= 2 ? 1.85 : 1.35,
  s: p.s * 0.5,
})
const MOBILE = DESKTOP.map(toMobile)

export const scroll = {
  smooth: 0,
  keys: [0, 1, 2, 3, 4, 5, 6, 7] as number[],
}

/** Measure keyframe scroll positions from section anchors. */
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
    howTop + vh * 0.15,
    howEnd - vh * 0.1,
    howEnd + vh * 0.7,
    howEnd + vh * 0.7 + 1,
    Math.min(footTop - vh * 0.6, max - 2),
    max,
  ]
  // keep strictly increasing
  for (let i = 1; i < scroll.keys.length; i++) {
    if (scroll.keys[i] <= scroll.keys[i - 1]) scroll.keys[i] = scroll.keys[i - 1] + 1
  }
}

const ease = (t: number) => t * t * (3 - 2 * t)

export function poseAt(y: number, mobile: boolean): Pose {
  const poses = mobile ? MOBILE : DESKTOP
  const k = scroll.keys
  if (y <= k[0]) return poses[0]
  for (let i = 0; i < k.length - 1; i++) {
    if (y <= k[i + 1]) {
      const raw = (y - k[i]) / (k[i + 1] - k[i])
      // the crossing itself should feel linear to the scrollbar; the rest eases
      const t = i === 2 ? raw : ease(raw)
      const a = poses[i]
      const b = poses[i + 1]
      const out = {} as Pose
      for (const key of Object.keys(a) as (keyof Pose)[]) out[key] = a[key] + (b[key] - a[key]) * t
      return out
    }
  }
  return poses[poses.length - 1]
}
