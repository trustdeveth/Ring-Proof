import { useEffect, useRef, useState } from 'react'

type Line = { t: string; cls?: string; pause?: number }

/** A printed "proof receipt" that types itself out when scrolled into view. */
export default function ProofReceipt({ ticker }: { ticker: string }) {
  const script: Line[] = [
    { t: 'RINGPROOF / BROWSER PROVER', cls: 'r-head', pause: 200 },
    { t: '--------------------------------', cls: 'r-rule', pause: 100 },
    { t: `TOKEN ............ ${ticker}`, pause: 120 },
    { t: 'CLAIM ............ HOLDS >= 1,000,000', pause: 300 },
    { t: '--------------------------------', cls: 'r-rule', pause: 100 },
    { t: 'ring notes found ........... 7', pause: 220 },
    { t: 'decrypted locally .......... OK', pause: 220 },
    { t: 'witness: sum(notes) >= min . OK', pause: 220 },
    { t: 'zk range proof ............. 1.84s', pause: 300 },
    { t: '--------------------------------', cls: 'r-rule', pause: 100 },
    { t: 'AMOUNT ........... ██████████', cls: 'r-redact', pause: 120 },
    { t: 'WALLETS .......... ██████████', cls: 'r-redact', pause: 120 },
    { t: 'HISTORY .......... ██████████', cls: 'r-redact', pause: 300 },
    { t: '--------------------------------', cls: 'r-rule', pause: 100 },
    { t: 'PROOF  0x9f3a...c21e', cls: 'r-strong', pause: 200 },
    { t: 'RESULT VALID', cls: 'r-valid', pause: 3200 },
  ]
  const [lines, setLines] = useState<Line[]>([])
  const [started, setStarted] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setStarted(true), { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!started) return
    let cancelled = false
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
    ;(async () => {
      while (!cancelled) {
        setLines([])
        for (const l of script) {
          if (cancelled) return
          for (let i = 1; i <= l.t.length; i += 2) {
            if (cancelled) return
            const part = l.t.slice(0, i + 1)
            setLines((prev) => {
              const next = prev.slice()
              if (i === 1) next.push({ ...l, t: part })
              else next[next.length - 1] = { ...l, t: part }
              return next
            })
            await sleep(12)
          }
          await sleep(l.pause ?? 200)
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started])

  return (
    <div className="receipt" ref={box}>
      <div className="receipt__paper">
        {lines.map((l, i) => (
          <div key={i} className={`receipt__line ${l.cls ?? ''}`}>
            {l.t}
          </div>
        ))}
        {lines.length === 0 && <div className="receipt__line">&nbsp;</div>}
      </div>
      <div className="receipt__edge" aria-hidden="true" />
    </div>
  )
}
