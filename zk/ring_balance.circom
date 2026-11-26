pragma circom 2.1.6;

// Parhelion — Phase 4: zero-knowledge proof of a Helius Privacy Ring balance.
//
// Statement: "I know the nullifier secret of a Privacy Ring owner, and up to N notes of `asset` owned by that
// owner that are leaves of the state tree with root `utxoRoot` and whose nullifiers are NOT in the indexed
// nullifier tree with root `nullifierRoot`, and their amounts sum to at least `minAmount`."
// Public `tag = Poseidon(nullifierSecret, scope)` lets a verifier admit each holder once per scope (gate)
// without learning who they are. Nothing else about the wallet, the notes or the amounts is revealed.
//
// Commitment layout mirrors @heliuslabs/spr 0.9.0-alpha (transaction/utxo.js):
//   nullifier_pk   = Poseidon(nullifier_secret)
//   owner_hash     = Poseidon(owner_id, nullifier_pk)            owner_id = hash_bytes_33(0x53 || ed25519_pk)
//   owner_utxo     = Poseidon(owner_hash, blinding)
//   ring_hash      = Poseidon(ring_data_hash, ring_program_field) (both 0 for the default ring)
//   utxo_hash      = Poseidon(3, tree_id, asset, amount, data_hash, ring_hash, owner_utxo)
//   nullifier      = Poseidon(utxo_hash, blinding, nullifier_secret)
// State tree: height 32, node = Poseidon(left, right). Nullifier tree: indexed, height 40,
// leaf = Poseidon(low_value, next_value). Poseidon = circomlib (== light-poseidon / @lightprotocol/hasher.rs).

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";

template MerkleRoot(levels) {
    signal input leaf;
    signal input index;
    signal input path[levels];
    signal output root;

    component bits = Num2Bits(levels);
    bits.in <== index;

    component h[levels];
    signal cur[levels + 1];
    signal left[levels];
    signal right[levels];
    cur[0] <== leaf;
    for (var i = 0; i < levels; i++) {
        // bit = 1 → current node is the right child
        left[i] <== cur[i] + bits.out[i] * (path[i] - cur[i]);
        right[i] <== path[i] + bits.out[i] * (cur[i] - path[i]);
        h[i] = Poseidon(2);
        h[i].inputs[0] <== left[i];
        h[i].inputs[1] <== right[i];
        cur[i + 1] <== h[i].out;
    }
    root <== cur[levels];
}

// a < b for arbitrary BN254 field elements (canonical 254-bit decomposition, two 127-bit limbs).
template FieldLessThan() {
    signal input a;
    signal input b;
    signal output out;

    component ab = Num2Bits_strict();
    component bb = Num2Bits_strict();
    ab.in <== a;
    bb.in <== b;

    var aHi = 0; var aLo = 0; var bHi = 0; var bLo = 0;
    var e = 1;
    for (var i = 0; i < 127; i++) {
        aLo += ab.out[i] * e;
        bLo += bb.out[i] * e;
        e = e + e;
    }
    e = 1;
    for (var i = 127; i < 254; i++) {
        aHi += ab.out[i] * e;
        bHi += bb.out[i] * e;
        e = e + e;
    }
    component hiLt = LessThan(128);
    hiLt.in[0] <== aHi;
    hiLt.in[1] <== bHi;
    component hiEq = IsEqual();
    hiEq.in[0] <== aHi;
    hiEq.in[1] <== bHi;
    component loLt = LessThan(128);
    loLt.in[0] <== aLo;
    loLt.in[1] <== bLo;

    signal eqAndLo;
    eqAndLo <== hiEq.out * loLt.out;
    out <== hiLt.out + eqAndLo; // mutually exclusive
}

template RingBalance(N, STATE_H, NULL_H) {
    // ---- public
    signal input utxoRoot;
    signal input nullifierRoot;
    signal input treeId;
    signal input asset;
    signal input minAmount;
    signal input scope;
    signal output tag;

    // ---- private: owner
    signal input ownerId;
    signal input nullifierSecret;

    // ---- private: notes
    signal input isReal[N];
    signal input amount[N];
    signal input blinding[N];
    signal input dataHash[N];
    signal input ringHash[N];
    signal input leafIndex[N];
    signal input statePath[N][STATE_H];
    signal input lowValue[N];
    signal input nextValue[N];
    signal input lowIndex[N];
    signal input nullifierPath[N][NULL_H];

    component nfPk = Poseidon(1);
    nfPk.inputs[0] <== nullifierSecret;
    component ownerHash = Poseidon(2);
    ownerHash.inputs[0] <== ownerId;
    ownerHash.inputs[1] <== nfPk.out;

    component ownerUtxo[N];
    component utxo[N];
    component stateRoot[N];
    component nullifier[N];
    component idxLeaf[N];
    component nullRoot[N];
    component above[N];
    component below[N];
    component amountBits[N];
    signal total[N + 1];
    total[0] <== 0;

    for (var i = 0; i < N; i++) {
        isReal[i] * (isReal[i] - 1) === 0;
        amountBits[i] = Num2Bits(64);
        amountBits[i].in <== amount[i];
        amount[i] * (1 - isReal[i]) === 0; // padding slots carry nothing

        ownerUtxo[i] = Poseidon(2);
        ownerUtxo[i].inputs[0] <== ownerHash.out;
        ownerUtxo[i].inputs[1] <== blinding[i];

        utxo[i] = Poseidon(7);
        utxo[i].inputs[0] <== 3;
        utxo[i].inputs[1] <== treeId;
        utxo[i].inputs[2] <== asset;
        utxo[i].inputs[3] <== amount[i];
        utxo[i].inputs[4] <== dataHash[i];
        utxo[i].inputs[5] <== ringHash[i];
        utxo[i].inputs[6] <== ownerUtxo[i].out;

        // inclusion in the state tree
        stateRoot[i] = MerkleRoot(STATE_H);
        stateRoot[i].leaf <== utxo[i].out;
        stateRoot[i].index <== leafIndex[i];
        for (var j = 0; j < STATE_H; j++) stateRoot[i].path[j] <== statePath[i][j];
        isReal[i] * (stateRoot[i].root - utxoRoot) === 0;

        // unspent: low < nullifier < next, and (low, next) is a leaf of the nullifier tree
        nullifier[i] = Poseidon(3);
        nullifier[i].inputs[0] <== utxo[i].out;
        nullifier[i].inputs[1] <== blinding[i];
        nullifier[i].inputs[2] <== nullifierSecret;

        idxLeaf[i] = Poseidon(2);
        idxLeaf[i].inputs[0] <== lowValue[i];
        idxLeaf[i].inputs[1] <== nextValue[i];
        nullRoot[i] = MerkleRoot(NULL_H);
        nullRoot[i].leaf <== idxLeaf[i].out;
        nullRoot[i].index <== lowIndex[i];
        for (var j = 0; j < NULL_H; j++) nullRoot[i].path[j] <== nullifierPath[i][j];
        isReal[i] * (nullRoot[i].root - nullifierRoot) === 0;

        above[i] = FieldLessThan();
        above[i].a <== lowValue[i];
        above[i].b <== nullifier[i].out;
        isReal[i] * (1 - above[i].out) === 0;
        below[i] = FieldLessThan();
        below[i].a <== nullifier[i].out;
        below[i].b <== nextValue[i];
        isReal[i] * (1 - below[i].out) === 0;

        total[i + 1] <== total[i] + amount[i];
    }

    // no note may be counted twice
    component same[N][N];
    signal both[N][N];
    for (var i = 0; i < N; i++) {
        for (var j = i + 1; j < N; j++) {
            same[i][j] = IsEqual();
            same[i][j].in[0] <== nullifier[i].out;
            same[i][j].in[1] <== nullifier[j].out;
            both[i][j] <== isReal[i] * isReal[j];
            both[i][j] * same[i][j].out === 0;
        }
    }

    // sum ≥ min (both < 2^70)
    component minBits = Num2Bits(70);
    minBits.in <== minAmount;
    component enough = LessEqThan(70);
    enough.in[0] <== minAmount;
    enough.in[1] <== total[N];
    enough.out === 1;

    component t = Poseidon(2);
    t.inputs[0] <== nullifierSecret;
    t.inputs[1] <== scope;
    tag <== t.out;
}

component main { public [utxoRoot, nullifierRoot, treeId, asset, minAmount, scope] } = RingBalance(2, 32, 40);
