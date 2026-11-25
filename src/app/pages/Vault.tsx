import { Link } from 'react-router'
import { useOwner } from '../wallet'
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
            Your <em>file.</em>
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

        <section className="sheet ledger-card ledger-card--ring" data-anim>
          <div className="sheet__head">
            <span className="label">Privacy Rings</span>
            <span className="tagline">● integration in progress</span>
          </div>
          <p className="ring-next">
            Next: shield tokens into a Helius Privacy Ring so even your balance is encrypted on-chain — and prove it
            with zero-knowledge, so not even RingProof sees it.
          </p>
          <ul className="ring-list mono">
            <li>
              <span>Today</span> RingProof checks your public balance once, then issues a proof without your wallet in it.
            </li>
            <li>
              <span>Next</span> Shielding + zero-knowledge proofs over Privacy Ring balances.
            </li>
          </ul>
        </section>
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
