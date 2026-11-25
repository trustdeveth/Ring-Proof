import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { claimText, verifyProof, type VerifyResult } from '../client'
import { PageHead, Stamp, Steps, timeLeft } from '../ui'
import { short } from '../tokens'

const VERIFY_STEPS = [{ label: 'Decode proof' }, { label: 'Check RingProof seal' }, { label: 'Check expiry' }]

export default function Verify() {
  const { hash } = useLocation()
  const [code, setCode] = useState(() => (hash.startsWith('#rp2_') ? decodeURIComponent(hash.slice(1)) : ''))
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(-1)
  const [res, setRes] = useState<VerifyResult | null>(null)
  const [netError, setNetError] = useState<string | null>(null)

  const run = async () => {
    setBusy(true)
    setRes(null)
    setNetError(null)
    setStep(0)
    const t1 = setTimeout(() => setStep(1), 300)
    const t2 = setTimeout(() => setStep(2), 650)
    try {
      setRes(await verifyProof(code))
    } catch (e) {
      setNetError((e as Error).message)
    } finally {
      clearTimeout(t1)
      clearTimeout(t2)
      setStep(3)
      setBusy(false)
    }
  }

  // auto-run when opened with a proof in the URL
  useEffect(() => {
    if (code) run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="verify">
      <PageHead
        num="05"
        label="Verify"
        title={
          <>
            Check a proof. <em>Learn one fact.</em>
          </>
        }
        lead="Paste a RingProof proof. You'll see the claim and whether it's valid — never the wallet, amount or history behind it."
      />
      <div className="split-2">
        <section className="sheet form" data-anim>
          <label className="field__label label" htmlFor="code">
            Proof
          </label>
          <textarea
            id="code"
            className="input textarea mono"
            placeholder="rp2_…"
            spellCheck={false}
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              setRes(null)
            }}
          />
          <button className="btn btn--ink btn--block" disabled={busy || code.trim().length < 10} onClick={run}>
            <span className="btn__label">{busy ? 'Verifying…' : 'Verify proof'}</span>
          </button>
          {step >= 0 && (
            <Steps
              steps={VERIFY_STEPS}
              current={step}
              failAt={
                res && !res.ok
                  ? res.reason.includes('Signature') || res.reason.includes('version')
                    ? 1
                    : res.reason.includes('expired') || res.reason.includes('revoked')
                      ? 2
                      : 0
                  : netError
                    ? 0
                    : undefined
              }
            />
          )}
        </section>

        <aside className="sheet side verdict" data-anim>
          {!res && !netError && (
            <div className="side__idle">
              <span className="label">Verdict</span>
              <p className="verdict__wait">Awaiting a proof.</p>
              <p className="muted small-p">Verification runs on the RingProof server and needs no wallet.</p>
            </div>
          )}
          {netError && <p className="form-error">{netError}</p>}
          {res?.ok && (
            <div className="verdict__ok">
              <Stamp kind="valid">Valid</Stamp>
              <p className="verdict__claim">{claimText({ symbol: res.s, min: res.m })}</p>
              <dl className="kv mono">
                <dt>Token</dt>
                <dd>{res.a === 'SOL' ? 'SOL (native)' : short(res.a, 6)}</dd>
                {res.g && (
                  <>
                    <dt>Gate</dt>
                    <dd>
                      {res.gn} · #{res.g}
                    </dd>
                  </>
                )}
                <dt>Proof ID</dt>
                <dd>#{res.id}</dd>
                <dt>Checked on-chain</dt>
                <dd>{new Date(res.iat).toLocaleString()}</dd>
                <dt>Expires</dt>
                <dd>{timeLeft(res.exp)}</dd>
              </dl>
              <div className="not-revealed">
                <span className="label">Not revealed</span>
                <ul className="mono">
                  <li>Wallet address <span className="bar">████████████</span></li>
                  <li>Exact balance <span className="bar">████████</span></li>
                  <li>Other wallets <span className="bar">██████████</span></li>
                  <li>History <span className="bar">███████████</span></li>
                </ul>
              </div>
              <p className="fine mono">
                The balance was true when the proof was issued. One proof can be shared by its holder — admit each
                proof ID once.
              </p>
            </div>
          )}
          {res && !res.ok && (
            <div className="verdict__bad">
              <Stamp kind="invalid">Invalid</Stamp>
              <p className="verdict__reason">{res.reason}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
