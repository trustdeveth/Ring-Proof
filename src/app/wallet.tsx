import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react'
import { WalletReadyState, type WalletName } from '@solana/wallet-adapter-base'
import { short } from './tokens'

/**
 * Wallet Standard wallets (Phantom, Solflare, Backpack, …) register themselves,
 * so no adapter list is needed. The connection endpoint is only used by the adapter;
 * the app reads balances through /api so an RPC key never ships to the browser.
 */
const ENDPOINT = 'https://api.mainnet-beta.solana.com'

type ModalCtx = { open: () => void; close: () => void }
const Ctx = createContext<ModalCtx>({ open: () => {}, close: () => {} })
export const useWalletModal = () => useContext(Ctx)

export function WalletProviders({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false)
  const ctx = useMemo(() => ({ open: () => setShown(true), close: () => setShown(false) }), [])
  return (
    <ConnectionProvider endpoint={ENDPOINT}>
      {/* errors (e.g. the user declining) are shown where they happen; keep the console quiet */}
      <WalletProvider wallets={[]} autoConnect onError={(e) => console.debug('[wallet]', e.name)}>
        <Ctx.Provider value={ctx}>
          {children}
          {shown && <WalletModal onClose={ctx.close} />}
        </Ctx.Provider>
      </WalletProvider>
    </ConnectionProvider>
  )
}

const INSTALL = [
  { name: 'Phantom', url: 'https://phantom.com/download' },
  { name: 'Solflare', url: 'https://solflare.com/download' },
  { name: 'Backpack', url: 'https://backpack.app/download' },
]

function WalletModal({ onClose }: { onClose: () => void }) {
  const { wallets, select, connect, wallet, connecting, connected } = useWallet()
  const [picked, setPicked] = useState<WalletName | null>(null)
  const [error, setError] = useState<string | null>(null)

  const installed = wallets.filter(
    (w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable,
  )

  // select() is async in state; connect once the chosen wallet is the active one
  useEffect(() => {
    if (!picked || wallet?.adapter.name !== picked || connected || connecting) return
    connect().catch((e: Error) => setError(e?.message || 'Connection was rejected.'))
  }, [picked, wallet, connect, connected, connecting])

  useEffect(() => {
    if (connected) onClose()
  }, [connected, onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Connect a wallet" onMouseDown={onClose}>
      <div className="modal__sheet sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <span className="label">Connect · step 1 of 1</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <h2 className="modal__title">Choose a wallet</h2>
        <p className="muted small-p">
          Connecting shares your public address with this app. Proofs you create never contain it — the groups that
          check them can’t see which wallet you are.
        </p>
        {installed.length > 0 ? (
          <ul className="wallet-list">
            {installed.map((w) => (
              <li key={w.adapter.name}>
                <button
                  className="wallet-item"
                  disabled={connecting}
                  onClick={() => {
                    setError(null)
                    setPicked(w.adapter.name)
                    select(w.adapter.name)
                  }}
                >
                  <img src={w.adapter.icon} alt="" width={28} height={28} />
                  <span>{w.adapter.name}</span>
                  <span className="wallet-item__state mono">
                    {connecting && picked === w.adapter.name ? 'Connecting…' : 'Detected'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty">
            <p>No Solana wallet found in this browser.</p>
            <div className="install">
              {INSTALL.map((i) => (
                <a key={i.name} className="btn btn--line btn--sm" href={i.url} target="_blank" rel="noreferrer">
                  Get {i.name}
                </a>
              ))}
            </div>
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
      </div>
    </div>
  )
}

/** Connected address + helpers used across pages. */
export function useOwner() {
  const { publicKey, connected, disconnect, signMessage, signTransaction, wallet } = useWallet()
  const owner = connected && publicKey ? publicKey.toBase58() : null
  /** Like signMessage, but also returns the bytes the wallet says it signed (Wallet Standard), for diagnostics. */
  const signMessageDetailed = async (message: Uint8Array): Promise<{ signature: Uint8Array; signedMessage: Uint8Array }> => {
    type Std = { features?: Record<string, { signMessage?: (i: { account: unknown; message: Uint8Array }) => Promise<{ signature: Uint8Array; signedMessage: Uint8Array }[]> }>; accounts?: { address: string }[] }
    const std = (wallet?.adapter as unknown as { wallet?: Std } | undefined)?.wallet
    const feature = std?.features?.['solana:signMessage']
    const account = std?.accounts?.find((a) => a.address === owner)
    if (feature?.signMessage && account) {
      const [out] = await feature.signMessage({ account, message })
      return { signature: out.signature, signedMessage: out.signedMessage ?? message }
    }
    if (!signMessage) throw new Error('This wallet cannot sign messages.')
    return { signature: await signMessage(message), signedMessage: message }
  }
  return {
    owner,
    label: owner ? short(owner) : null,
    walletName: wallet?.adapter.name,
    walletIcon: wallet?.adapter.icon,
    disconnect,
    signMessage,
    signMessageDetailed: signMessage ? signMessageDetailed : undefined,
    signTransaction,
  }
}
