import { useState } from 'react'
import { Link } from 'react-router'
import { useOwner } from '../wallet'
import { useWalletState } from '../store'
import { forgetProof } from '../client'
import { PageHead, Segmented, toast } from '../ui'
import ProofTicket from '../ProofTicket'

export default function Proofs() {
  const { owner } = useOwner()
  const st = useWalletState(owner)
  const [filter, setFilter] = useState<'active' | 'expired' | 'all'>('active')
  const now = Date.now()
  const list = st.proofs.filter((p) => (filter === 'all' ? true : filter === 'active' ? p.expiresAt > now : p.expiresAt <= now))
  const active = st.proofs.filter((p) => p.expiresAt > now).length

  return (
    <div className="proofs">
      <PageHead
        num="03"
        label="Proofs"
        title={
          <>
            Issued <em>proofs.</em>
          </>
        }
        lead={`${active} active on this device. Proofs expire on their own; nothing here links them to your wallet.`}
        aside={
          <Link className="btn btn--ink" to="/app/prove">
            <span className="btn__label">New proof →</span>
          </Link>
        }
      />
      <div className="toolbar" data-anim>
        <Segmented
          label="Filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'expired', label: 'Expired' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>
      {list.length === 0 ? (
        <div className="sheet empty-sheet" data-anim>
          <p className="empty-sheet__big">No {filter === 'all' ? '' : filter} proofs.</p>
          <Link to="/app/prove" className="btn btn--line btn--sm">
            <span className="btn__label">Generate one</span>
          </Link>
        </div>
      ) : (
        <div className="ticket-grid">
          {list.map((p) => (
            <div key={p.id} className="ticket-wrap" data-anim>
              <ProofTicket proof={p} animate={false} compact />
              <button
                className="linkish mono forget"
                onClick={() => {
                  if (owner) {
                    forgetProof(owner, p.id)
                    toast('Proof removed from this device')
                  }
                }}
              >
                Remove from this device
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
