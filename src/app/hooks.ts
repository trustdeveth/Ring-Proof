import { useCallback, useEffect, useState } from 'react'
import { getAsset, getBalances, getConfig, type AppConfig, type Balance } from './client'
import { SOL_ASSET, isAddress, type Asset } from './tokens'

export function useConfig() {
  const [cfg, setCfg] = useState<AppConfig | null>(null)
  useEffect(() => {
    getConfig().then(setCfg)
  }, [])
  return cfg
}

/** Assets offered by default: SOL and $PRHL once its mint is configured. */
export function useDefaultAssets() {
  const cfg = useConfig()
  const [proof, setProof] = useState<Asset | null>(null)
  useEffect(() => {
    if (cfg?.proofMint) getAsset(cfg.proofMint).then(setProof).catch(() => setProof(null))
  }, [cfg?.proofMint])
  return proof ? [proof, SOL_ASSET] : [SOL_ASSET]
}

/** Resolve a pasted mint address into an Asset (validated on-chain). */
export function useMintLookup(mint: string) {
  const [state, setState] = useState<{ asset: Asset | null; error: string | null; loading: boolean }>({
    asset: null,
    error: null,
    loading: false,
  })
  useEffect(() => {
    const m = mint.trim()
    if (!m) return setState({ asset: null, error: null, loading: false })
    if (!isAddress(m)) return setState({ asset: null, error: 'That is not a valid Solana address.', loading: false })
    let live = true
    setState({ asset: null, error: null, loading: true })
    const t = setTimeout(() => {
      getAsset(m)
        .then((a) => live && setState({ asset: a, error: null, loading: false }))
        .catch((e: Error) => live && setState({ asset: null, error: e.message, loading: false }))
    }, 300)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [mint])
  return state
}

/** Live public balances for the connected wallet (SOL, $PRHL if configured). */
export function useBalances(owner: string | null) {
  const [rows, setRows] = useState<Balance[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const refresh = useCallback(async () => {
    if (!owner) return
    try {
      setRows(await getBalances(owner))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [owner])
  useEffect(() => {
    refresh()
  }, [refresh])
  return { rows, error, refresh }
}
