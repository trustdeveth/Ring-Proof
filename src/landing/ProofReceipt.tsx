import { useEffect, useRef, useState } from 'react'

type Line = { t: string; cls?: string; pause?: number }

/** A receipt that prints out of a slot, line by line, when scrolled into view. */
export default function ProofReceipt({ ticker }: { ticker: string }) {
  const script: Line[] = [
    { t: 'RINGPROOF / HOLDER PROOF', cls: 'r-head', pause: 200 },
    { t: '--------------------------------', cls: 'r-rule', pause: 80 },
    { t: `TOKEN ............ ${ticker}`, pause: 120 },
    { t: 'CLAIM ............ HOLDS >= 1,000,000', pause: 260 },
    { t: '--------------------------------', cls: 'r-rule', pause: 80 },
    { t: 'wallet signature ........... OK', pause: 200 },
    { t: 'balance read on-chain ...... OK', pause: 200 },
    { t: 'balance >= threshold ....... OK', pause: 200 },
    { t: 'proof sealed ............... OK', pause: 260 },
    { t: '--------------------------------', cls: 'r-rule', pause: 80 },
    { t: 'WALLET ........... ██████████', pause: 120 },
    { t: 'BALANCE .......... ██████████', pause: 120 },
    { t: 'HISTORY .......... ██████████', pause: 260 },
    { t: '--------------------------------', cls: 'r-rule', pause: 80 },
    { t: 'PROOF  rp2_9f3a...c21e', cls: 'r-strong', pause: 200 },
    { t: 'RESULT VALID', cls: 'r-valid', pause: 3800 },
  ]
  const [n, setN] = useState(0) // fully printed lines
  const [partial, setPartial] = useState('')
  const [started, setStarted] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setStarted(true), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!started) return
    let cancelled = false
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
    ;(async () => {
      while (!cancelled) {
        setN(0)
        setPartial('')
        await sleep(500)
        for (let i = 0; i < script.length; i++) {
          const l = script[i]
          for (let c = 2; c <= l.t.length + 1; c += 2) {
            if (cancelled) return
            setPartial(l.t.slice(0, c))
            await sleep(11)
          }
          setN(i + 1)
          setPartial('')
          await sleep(l.pause ?? 200)
        }
        // tear off and print a fresh one
        if (cancelled) return
        box.current?.classList.add('is-tear')
        await sleep(700)
        box.current?.classList.remove('is-tear')
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started])

  const shown = n + (partial ? 1 : 0)
  const progress = shown / script.length

  // the paper rises out of a slot at the bottom, so the first line leads
  return (
    <div className="printer" ref={box}>
      <div className="printer__clip">
        <div className="receipt" style={{ transform: `translateY(${((1 - progress) * 100).toFixed(2)}%)` }}>
          <div className="receipt__edge" aria-hidden="true" />
          <div className="receipt__paper">
            {script.map((l, i) => (
              <div key={i} className={`receipt__line ${l.cls ?? ''}`}>
                {i < n ? l.t : i === n ? partial || ' ' : ' '}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="printer__slot" aria-hidden="true">
        <span className="printer__led" data-on={partial ? '1' : '0'} />
        <span className="mono">RP-01 · proof printer</span>
      </div>
    </div>
  )
}
