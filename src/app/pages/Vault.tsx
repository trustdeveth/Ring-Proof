import { useState } from 'react'
import { Link } from 'react-router'
import { useOwner } from '../wallet'
import { getAsset } from '../client'
import { useWalletState } from '../store'
import { useBalances } from '../hooks'
import { claimText } from '../client'
import { PageHead, timeAgo, timeLeft } from '../ui'
import { short } from '../tokens'

export default function Vault() {
  const { owner } = useOwner()
  const st = useWalletState(owner)
  const { rows, error, refresh } = useBalances(owner)
  const now = Date.now()
  const active = st.proofs.filter((p) => p.expiresAt > now)

  return (
    <div className="vault">
      <PageHead
        num="01"
        label="Vault"
        title={
          <>
            Your <em>bag.</em>
          </>
        }
        lead="What the world can see about this wallet — and the proofs that let you show less."
        aside={
          <div className="phead__actions">
            <Link className="btn btn--ink" to="/app/prove">
              <span className="btn__label">Generate proof →</span>
            </Link>
            <Link className="btn btn--line" to="/app/verify">
              <span className="btn__label">Verify a proof</span>
            </Link>
          </div>
        }
      />

      <div className="vault__grid">
        <section className="sheet ledger-card ledger-card--public" data-anim>
          <div className="sheet__head">
            <span className="label">Public wallet</span>
            <span className="tagline tagline--red">● visible to everyone on-chain</span>
          </div>
          <table className="balances">
            <tbody>
              {rows === null && !error && (
                <tr>
                  <th>Loading</th>
                  <td>
                    <span className="muted mono small-p">reading Solana…</span>
                  </td>
                </tr>
              )}
              {rows?.map((b) => (
                <tr key={b.asset}>
                  <th>
                    {b.symbol}
                    {b.name && <small className="mono">{b.name}</small>}
                  </th>
                  <td>{Number(b.amount).toLocaleString('en-US', { maximumFractionDigits: b.asset === 'SOL' ? 4 : 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {error && <p className="form-error">{error}</p>}
          <div className="ring-actions">
            <button className="btn btn--line btn--sm" onClick={refresh}>
              <span className="btn__label">Refresh</span>
            </button>
            <span className="fine mono">{owner && short(owner, 6)} · live from Solana mainnet</span>
          </div>
        </section>

        <RingCard owner={owner} />
      </div>

      <section className="sheet activity" data-anim>
        <div className="sheet__head">
          <span className="label">Active proofs · {active.length}</span>
          <Link className="fine mono linkish" to="/app/proofs">
            All proofs →
          </Link>
        </div>
        {active.length === 0 ? (
          <p className="empty-line muted">
            No active proofs. <Link className="linkish" to="/app/prove">Generate your first one</Link>.
          </p>
        ) : (
          <table className="act">
            <tbody>
              {active.slice(0, 6).map((p) => (
                <tr key={p.id}>
                  <td className="mono act__kind">#{p.id}</td>
                  <td>
                    {claimText(p)}
                    {p.gateName && <span className="muted"> · {p.gateName}</span>}
                  </td>
                  <td className="mono muted act__sig">{timeLeft(p.expiresAt)}</td>
                  <td className="mono muted act__at">{timeAgo(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

type RingRow = { mint: string; symbol: string; amount: string }

/** Privacy Ring balances, decrypted in this tab after one wallet signature. Nothing is sent to Parhelion. */
function RingCard({ owner }: { owner: string | null }) {
  const { signMessage, signMessageDetailed, walletName } = useOwner()
  const [rows, setRows] = useState<RingRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const unlock = async () => {
    if (!owner) return
    setBusy(true)
    setError(null)
    try {
      const ring = await import('../ring')
      const s = await ring.openRing(owner, signMessage, signMessageDetailed, walletName)
      await ring.syncRing(s)
      const out: RingRow[] = []
      for (const b of ring.ringBalances(s)) {
        const a = await getAsset(b.mint).catch(() => null)
        const dec = a?.decimals ?? 0
        const whole = b.amount / 10n ** BigInt(dec)
        const frac = dec ? (b.amount % 10n ** BigInt(dec)).toString().padStart(dec, '0').slice(0, 4).replace(/0+$/, '') : ''
        out.push({ mint: b.mint, symbol: a?.symbol ?? b.mint.slice(0, 4), amount: `${whole.toLocaleString('en-US')}${frac ? `.${frac}` : ''}` })
      }
      setRows(out)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read your Privacy Ring.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="sheet ledger-card ledger-card--ring" data-anim>
      <div className="sheet__head">
        <span className="label">Privacy Ring</span>
        <span className="tagline">● encrypted on-chain · decrypted only here</span>
      </div>
      {rows === null ? (
        <>
          <p className="ring-next">
            Balances you hold in a Helius Privacy Ring are encrypted on-chain. Unlock to read them in this tab, then prove them
            privately, or with zero-knowledge so not even Parhelion sees the notes.
          </p>
          <button className="btn btn--ink btn--sm" onClick={unlock} disabled={busy || !owner}>
            <span className="btn__label">{busy ? 'Decrypting…' : 'Unlock Privacy Ring'}</span>
          </button>
        </>
      ) : rows.length === 0 ? (
        <p className="ring-next">No private balance in your Privacy Ring yet.</p>
      ) : (
        <table className="balances">
          <tbody>
            {rows.map((r) => (
              <tr key={r.mint}>
                <th>{r.symbol}</th>
                <td>{r.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {error && <p className="form-error">{error}</p>}
      <ul className="ring-list mono">
        <li>
          <span>Ring</span> Prove a private balance — checked once, nothing stored.
        </li>
        <li>
          <span>ZK</span> Your browser proves it; Parhelion sees only the proof.
        </li>
      </ul>
      <Link className="fine mono linkish" to="/app/prove">
        Prove from your Ring →
      </Link>
    </section>
  )
}
