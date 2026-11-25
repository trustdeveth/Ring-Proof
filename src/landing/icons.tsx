export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg className="logo" viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <path d="M25.9 13.2A11 11 0 1 1 19.1 5.4" fill="none" stroke="currentColor" strokeWidth="3.5" />
      <path d="m12 14.5 4.5 4.5L28 7.5" fill="none" stroke="var(--red, #e23a1e)" strokeWidth="3.5" strokeLinejoin="miter" />
    </svg>
  )
}

export function Arrow() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  )
}
