import type { ReactNode } from 'react'

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <img className="logo" src="/parhelion-token.png?v=orbit2" width={size} height={size} alt="" aria-hidden="true" style={{ borderRadius: "50%", flexShrink: 0, objectFit: "cover" }} />
  )
}

export function Arrow() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  )
}

/** The "deal with it" pixel shades, as crisp SVG pixels. */
export function PixelShades({ width = 120 }: { width?: number }) {
  const rows = ['111111111111111111', '111ww11111111ww111', '11ww11111..1ww1111', '.111111....111111.']
  return (
    <svg viewBox="0 0 18 4" width={width} height={(width / 18) * 4} shapeRendering="crispEdges" aria-hidden="true">
      {rows.flatMap((r, y) =>
        [...r].map((c, x) => (c === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill={c === 'w' ? '#fff' : '#000'} />)),
      )}
    </svg>
  )
}

const S = ({ children, size = 26 }: { children: ReactNode; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

export const Ico = {
  Eye: () => <S><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></S>,
  Bolt: () => <S><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></S>,
  Target: () => <S><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" /></S>,
  Link: () => <S><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></S>,
  Chat: () => <S><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></S>,
  Gift: () => <S><rect x="3" y="8" width="18" height="4" /><path d="M5 12v9h14v-9M12 8v13M12 8S10.5 3 8 4s0 4 4 4zm0 0s1.5-5 4-4 0 4-4 4z" /></S>,
  List: () => <S><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" /></S>,
  Coins: () => <S><ellipse cx="9" cy="7" rx="6" ry="2.5" /><path d="M3 7v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V7" /><path d="M9 16.5c3.3 0 6-1.1 6-2.5" /><ellipse cx="16" cy="15" rx="5" ry="2" /><path d="M11 15v3c0 1.1 2.2 2 5 2s5-.9 5-2v-3" /></S>,
  Vault: () => <S><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="12" cy="12" r="4" /><path d="M12 8v1M12 15v1M8 12h1M15 12h1" /></S>,
  Clock: () => <S><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></S>,
  Check: ({ size = 20 }: { size?: number }) => <S size={size}><path d="M5 12.5l4.5 4.5L19 7.5" /></S>,
  Plus: () => <S><path d="M12 5v14M5 12h14" /></S>,
  X: () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z" />
    </svg>
  ),
  Telegram: () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M21.9 4.3l-3.1 14.8c-.2 1-.8 1.3-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.8 8.8-7.9c.4-.3-.1-.5-.6-.2L6.7 13l-4.6-1.4c-1-.3-1-1 .2-1.5L20.5 3c.8-.3 1.6.2 1.4 1.3z" />
    </svg>
  ),
}
