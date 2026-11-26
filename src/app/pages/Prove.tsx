import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useOwner } from '../wallet'
import type { ProofRecord } from '../store'
import { PROOF_STEPS, ClientError, claimText, generateProof, getAsset, getBalances, peekGate } from '../client'
import { AmountInput, AssetPicker, PageHead, Segmented, Steps, toast } from '../ui'
import ProofTicket from '../ProofTicket'
import { SOL_ASSET, presetsFor, type Asset } from '../tokens'

type Phase = { kind: 'idle' } | { kind: 'running'; step: number } | { kind: 'done'; proof: ProofRecord }

export default function Prove() {
  const { owner, signMessage } = useOwner()
  const [params] = useSearchParams()
  const gateToken = params.get('gate') ?? undefined
  const gate = useMemo(() => (gateToken ? peekGate(gateToken) : null), [gateToken])

  const [asset, setAsset] = useState<Asset | null>(SOL_ASSET)
  const [gateAsset, setGateAsset] = useState<Asset | null>(null)
  const [min, setMin] = useState(gate?.m ?? '1')
  const [expiry, setExpiry] = useState<1 | 7 | 30>(7)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [error, setError] = useState<string | null>(null)
  const [held, setHeld] = useState<string | null>(null)

  // a gate fixes the token and the minimum
  useEffect(() => {
    if (!gate) return
    getAsset(gate.a)
      .then((a) => {
        setGateAsset(a)
        setAsset(a)
      })
      .catch(() => setError('Could not load the token for this gate.'))
  }, [gate])

  // show the user their own balance for the chosen token (it's their data; never put in the proof)
  useEffect(() => {
    setHeld(null)
    if (!owner || !asset) return
    let live = true
    getBalances(owner, asset.asset === 'SOL' ? undefined : asset.asset)
      .then((rows) => live && setHeld(rows.find((r) => r.asset === asset.asset)?.amount ?? '0'))
      .catch(() => live && setHeld(null))
    return () => {
      live = false
    }
  }, [owner, asset])

  const n = Number(min) || 0
  const belowGate = gate ? n < Number(gate.m) : false
  const qualifies = held !== null ? Number(held) >= n : null
  const busy = phase.kind === 'running'

  const run = async () => {
    if (!owner || !asset) return
    setError(null)
    try {
      setPhase({ kind: 'running', step: 0 })
      const proof = await generateProof(owner, signMessage, { asset, min, expiryDays: expiry, gateToken }, (step) =>
        setPhase({ kind: 'running', step }),
      )
      setPhase({ kind: 'done', proof })
      toast('Proof issued')
    } catch (e) {
      setPhase({ kind: 'idle' })
      setError(e instanceof ClientError ? e.message : 'Proof generation failed.')
    }
  }

  return (
    <div className="prove">
      <PageHead
        num="02"
        label="Prove"
        title={
          <>
            Say one thing. <em>Nothing else.</em>
          </>
        }
        lead="Sign once with your wallet. Parhelion checks your balance on-chain and issues a proof that never mentions your wallet."
      />

      {gate && (
        <div className="gate-banner sheet" data-anim>
          <span className="label">Gate</span>
          <b>{gate.name}</b>
          <span className="mono">
            needs ≥ {Number(gate.m).toLocaleString('en-US')} {gate.s} · {gate.platform} {gate.room}
          </span>
        </div>
      )}

      <div className="split-2">
        <section className="sheet form" data-anim>
          <div className="field">
            <span className="field__label label">Token</span>
            <AssetPicker
              value={asset}
              lockedTo={gateAsset ?? undefined}
              onChange={(a) => {
                setAsset(a)
                setError(null)
                if (a && !gate) setMin(String(presetsFor(a)[0]))
              }}
            />
          </div>
          <div className="field">
            <label className="field__label label" htmlFor="thr">
              Holds at least
              <span className="field__hint mono">
                {held !== null && asset ? `your wallet: ${Number(held).toLocaleString('en-US', { maximumFractionDigits: 4 })} ${asset.symbol}` : ''}
              </span>
            </label>
            <AmountInput
              id="thr"
              value={min}
              onChange={(v) => {
                setMin(v)
                setError(null)
              }}
              suffix={asset?.symbol ?? ''}
              presets={asset ? presetsFor(asset) : undefined}
            />
          </div>
          <div className="field">
            <span className="field__label label">Expires in</span>
            <Segmented
              label="Expiry"
              value={expiry}
              onChange={setExpiry}
              options={[
                { value: 1, label: '24 hours' },
                { value: 7, label: '7 days' },
                { value: 30, label: '30 days' },
              ]}
            />
          </div>

          <div className="claim-preview" aria-live="polite">
            <span className="label">You will prove</span>
            <p className="claim-preview__text">{n > 0 && asset ? claimText({ symbol: asset.symbol, min }) : '—'}</p>
            <p className="claim-preview__elig mono">
              {belowGate ? (
                <span className="bad">✕ The gate needs at least {gate!.m} {gate!.s}.</span>
              ) : qualifies === null ? (
                'Checked on-chain when you sign.'
              ) : qualifies ? (
                <span className="good">✓ Your wallet qualifies</span>
              ) : (
                <span className="bad">✕ Your wallet holds less than this</span>
              )}
            </p>
          </div>

          {error && <p className="form-error">{error}</p>}
          <button className="btn btn--ink btn--block" disabled={busy || !asset || n <= 0 || belowGate || qualifies === false} onClick={run}>
            <span className="btn__label">{busy ? 'Working…' : qualifies === false ? 'Balance too low' : 'Sign & generate proof'}</span>
          </button>
          <p className="fine mono">Signing is free and is not a transaction. Nothing about your wallet is stored.</p>
        </section>

        <aside className="sheet side" data-anim>
          {phase.kind === 'idle' && (
            <div className="side__idle">
              <span className="label">How it works</span>
              <Steps steps={PROOF_STEPS} current={-1} />
              <p className="muted small-p">
                The proof states the claim and an expiry. Whoever checks it learns nothing about which wallet holds
                the tokens, or how many above the threshold.
              </p>
            </div>
          )}
          {phase.kind === 'running' && (
            <div>
              <span className="label">{phase.step === 1 ? 'Check your wallet' : 'Working'}</span>
              <Steps steps={PROOF_STEPS} current={phase.step} />
              <div className="noise-bar" aria-hidden="true" />
            </div>
          )}
          {phase.kind === 'done' && (
            <div className="side__done">
              <ProofTicket proof={phase.proof} />
              <div className="side__links mono">
                <Link to="/app/proofs">All proofs →</Link>
                <Link to={`/app/verify#${phase.proof.code}`}>Test it in Verify →</Link>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
