import { useState } from 'react'
import { useOwner } from '../wallet'
import { useWalletState, type GateRecord } from '../store'
import { BOT_HANDLE, ClientError, claimText, createGate, forgetGate, gateLink } from '../client'
import { AmountInput, AssetPicker, CopyButton, PageHead, Segmented, timeAgo, toast } from '../ui'
import { SOL_ASSET, presetsFor, type Asset } from '../tokens'

function botCommand(g: GateRecord) {
  return `/gate ${g.token}`
}

export default function Gates() {
  const { owner } = useOwner()
  const st = useWalletState(owner)
  const [name, setName] = useState('')
  const [asset, setAsset] = useState<Asset | null>(SOL_ASSET)
  const [min, setMin] = useState('10')
  const [platform, setPlatform] = useState<GateRecord['platform']>('telegram')
  const [room, setRoom] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid = name.trim().length >= 2 && !!asset && Number(min) > 0 && room.trim().length >= 2

  const submit = async () => {
    if (!owner || !asset || !valid) return
    setError(null)
    setBusy(true)
    try {
      await createGate(owner, { name: name.trim(), asset, min, platform, room: room.trim() })
      toast('Gate created — share the holder link')
      setName('')
      setRoom('')
    } catch (e) {
      setError(e instanceof ClientError ? e.message : 'Could not create the gate.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="gates">
      <PageHead
        num="04"
        label="Gates"
        title={
          <>
            Gate your <em>community.</em>
          </>
        }
        lead="Set the rule once and share the link. Holders prove it privately; you only ever see “valid”."
      />

      <div className="split-2">
        <section className="sheet form" data-anim>
          <div className="field">
            <label className="field__label label" htmlFor="gname">
              Gate name
            </label>
            <input id="gname" className="input" placeholder="Whale room" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <span className="field__label label">Token</span>
            <AssetPicker
              value={asset}
              onChange={(a) => {
                setAsset(a)
                if (a) setMin(String(presetsFor(a)[1]))
              }}
            />
          </div>
          <div className="field">
            <label className="field__label label" htmlFor="gmin">
              Minimum held
            </label>
            <AmountInput id="gmin" value={min} onChange={setMin} suffix={asset?.symbol ?? ''} presets={asset ? presetsFor(asset) : undefined} />
          </div>
          <div className="field-row">
            <div className="field">
              <span className="field__label label">Platform</span>
              <Segmented
                label="Platform"
                value={platform}
                onChange={setPlatform}
                options={[
                  { value: 'telegram', label: 'Telegram' },
                  { value: 'discord', label: 'Discord' },
                ]}
              />
            </div>
            <div className="field">
              <label className="field__label label" htmlFor="groom">
                {platform === 'telegram' ? 'Group' : 'Role'}
              </label>
              <input
                id="groom"
                className="input"
                placeholder={platform === 'telegram' ? '@whale_room' : '@Whale'}
                value={room}
                maxLength={60}
                onChange={(e) => setRoom(e.target.value)}
              />
            </div>
          </div>
          <div className="fee mono">
            <span>Gate fee</span>
            <b>
              Free <small>· $PRHL fee starts at token launch</small>
            </b>
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn--ink btn--block" disabled={!valid || busy} onClick={submit}>
            <span className="btn__label">{busy ? 'Creating…' : 'Create gate'}</span>
          </button>
          <p className="fine mono">
            A gate is a signed rule — nothing is stored on our side. Until @{BOT_HANDLE} is live, check proofs on the
            Verify page.
          </p>
        </section>

        <aside className="gate-list" data-anim>
          <span className="label">Your gates · {st.gates.length}</span>
          {st.gates.length === 0 ? (
            <div className="sheet empty-sheet">
              <p className="empty-sheet__big">No gates yet.</p>
              <p className="muted small-p">Create one and post its holder link in your community.</p>
            </div>
          ) : (
            st.gates.map((g) => (
              <article key={g.id} className="sheet gate">
                <div className="gate__head">
                  <h3>{g.name}</h3>
                  <span className="mono muted">{timeAgo(g.createdAt)}</span>
                </div>
                <p className="gate__rule">{claimText({ symbol: g.symbol, min: g.min })}</p>
                <dl className="kv mono">
                  <dt>Platform</dt>
                  <dd>
                    {g.platform} · {g.room}
                  </dd>
                  <dt>Gate ID</dt>
                  <dd>#{g.id}</dd>
                </dl>
                <div className="gate__how mono">
                  <span>1. Post the holder link</span>
                  <span>2. Members open it, sign, and send you their proof</span>
                  <span>3. Paste proofs into Verify — it shows this gate’s name</span>
                </div>
                <div className="gate__actions">
                  <CopyButton text={gateLink(g.token)} label="Copy holder link" className="btn btn--ink btn--sm" />
                  <CopyButton text={botCommand(g)} label="Copy bot command" />
                  <button
                    className="linkish mono forget"
                    onClick={() => {
                      if (owner && confirm(`Remove “${g.name}” from this device? Links you already shared keep working.`)) forgetGate(owner, g.id)
                    }}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))
          )}
        </aside>
      </div>
    </div>
  )
}
