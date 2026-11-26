// Minimal types for the parts of snarkjs Parhelion uses (snarkjs ships no declarations).
declare module 'snarkjs' {
  export const groth16: {
    fullProve(
      input: Record<string, unknown>,
      wasm: string | Uint8Array,
      zkey: string | Uint8Array,
    ): Promise<{ proof: unknown; publicSignals: string[] }>
    verify(vk: unknown, publicSignals: readonly string[], proof: unknown): Promise<boolean>
  }
}
