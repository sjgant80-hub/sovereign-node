// FallKard — the kard kernel: a sovereign node's portable, signed identity.
//
// A KARD is a person-as-a-system: a portable record that says WHO the node is (an Ed25519 public key),
// WHAT it carries (a skin reference + a structure reference + a node config), and WHAT it may do (a
// capability set) up to an UNCROSSABLE BUDGET. Opening a kard instantiates a sovereign node — its own
// structure, its own look, its own memory, on its own metal. The kard travels as a file; anyone can
// verify it, no one can forge it, and no capability can spend past the budget the kard was minted with.
//
// The signature bytes are made and checked at the edge (WebCrypto Ed25519); this kernel pins exactly WHAT
// is signed and enforces the identity + capability + budget invariants. No I/O. Pure and total: garbage
// in -> { ok:false, why }, never a throw.

export const KARD_KIND = 'fallkard-v1';
export const MAX_CAPS = 64;
export const MAX_REF = 512;        // a skin/structure reference (a hash, id, or short URL)
export const MAX_LABEL = 120;

const isStr = (v) => typeof v === 'string';
const isInt = (v) => Number.isInteger(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isArr = (v) => Array.isArray(v);
const HEX = /^[0-9a-f]+$/;
const isPub = (v) => isStr(v) && v.length === 64 && HEX.test(v);   // Ed25519 public key = 32 bytes
const isSig = (v) => isStr(v) && v.length === 128 && HEX.test(v);  // Ed25519 signature = 64 bytes
const isSpend = (v) => isNum(v) && v >= 0;                          // a spend/cost is a finite amount, zero or more

// ── SHA-256 + canonical JSON (the estate's proven pair — the same bytes the gate runs on) ─────────
const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256(text) {
  if (!isStr(text)) return { ok: false, why: 'sha256 takes a string' };
  const data = new TextEncoder().encode(text);
  const len = data.length;
  const padded = new Uint8Array((((len + 8) >> 6) << 6) + 64);
  padded.set(data);
  padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  const bitLen = len * 8;
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296));
  dv.setUint32(padded.length - 4, bitLen >>> 0);
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Uint32Array(64);
  for (let i = 0; i < padded.length; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
    for (let t = 16; t < 64; t++) {
      const x = w[t - 15], y = w[t - 2];
      const s0 = (((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)) >>> 0;
      const s1 = (((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10)) >>> 0;
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, hh = h7;
    for (let t = 0; t < 64; t++) {
      const S1 = (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const t1 = (hh + S1 + ch + K256[t] + w[t]) >>> 0;
      const S0 = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + hh) >>> 0;
  }
  const hex = (n) => n.toString(16).padStart(8, '0');
  return { ok: true, hash: hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4) + hex(h5) + hex(h6) + hex(h7) };
}

export function canon(v) {
  if (v === null || typeof v === 'number' || typeof v === 'boolean') return JSON.stringify(v);
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return '"?"';
}

// ── the kard body: what a node IS + carries + may do ──────────────────────────────────────────────
function validCaps(caps) {
  if (!isArr(caps)) return { ok: false, why: 'capabilities must be an array of strings' };
  if (caps.length > MAX_CAPS) return { ok: false, why: 'more than ' + MAX_CAPS + ' capabilities' };
  const seen = new Set();
  for (const [i, c] of caps.entries()) {
    if (!isStr(c) || c.trim().length === 0) return { ok: false, why: 'capability ' + i + ' must be a non-empty string' };
    if (seen.has(c)) return { ok: false, why: 'duplicate capability: ' + c };
    seen.add(c);
  }
  return { ok: true };
}

/** mintKard(input) — assemble a node's identity into a canonical, self-hashed kard body (unsigned).
 *  input: { owner (Ed25519 pubkey hex), skinRef, structureRef, capabilities[], budgetCap, createdAt, label? } */
export function mintKard(input) {
  if (!isObj(input)) return { ok: false, why: 'mintKard takes an object' };
  const { owner, skinRef, structureRef, capabilities, budgetCap, createdAt, label } = input;
  if (!isPub(owner)) return { ok: false, why: 'owner must be an Ed25519 public key (64 hex characters)' };
  for (const [name, val] of [['skinRef', skinRef], ['structureRef', structureRef]]) {
    if (!isStr(val) || val.trim().length === 0) return { ok: false, why: name + ' must be a non-empty string (a hash, id or short URL)' };
    if (val.length > MAX_REF) return { ok: false, why: name + ' exceeds ' + MAX_REF + ' characters' };
  }
  const cv = validCaps(capabilities);
  if (!cv.ok) return cv;
  if (!isNum(budgetCap)) return { ok: false, why: 'budgetCap must be a number (the uncrossable spend ceiling)' };
  if (budgetCap < 0) return { ok: false, why: 'budgetCap cannot be negative' };
  if (!isStr(createdAt) || createdAt.trim().length === 0) return { ok: false, why: 'a kard needs a createdAt timestamp' };
  if (label !== undefined) {
    if (!isStr(label)) return { ok: false, why: 'label must be a string when present' };
    if (label.length > MAX_LABEL) return { ok: false, why: 'label exceeds ' + MAX_LABEL + ' characters' };
  }
  const body = {
    v: 1,
    kind: KARD_KIND,
    owner,
    skinRef, structureRef,
    capabilities: capabilities.slice(),
    budgetCap,
    label: label === undefined ? '' : label,
    createdAt,
    scope: 'A kard is a sovereign node: its own structure, its own look, its own memory, on its own metal. Capabilities are exercisable only up to budgetCap; nothing signed can raise that ceiling.',
  };
  const h = sha256(canon(body));
  if (!h.ok) return { ok: false, why: h.why };
  return { ok: true, kard: { ...body, hash: h.hash } };
}

/** kardSignable(kard) — the EXACT canonical bytes an Ed25519 signature covers: the kard minus its
 *  signature. Used to sign AND to verify, so both sides canonicalise identically. */
export function kardSignable(kard) {
  if (!isObj(kard) || kard.kind !== KARD_KIND || !isStr(kard.hash)) return { ok: false, why: 'not a fallkard' };
  const body = { ...kard };
  delete body.signature;
  return { ok: true, payload: canon(body) };
}

/** attachSignature(kard, pubHex, sigHex) — bind the owner's Ed25519 signature. The signing key MUST be
 *  the kard's declared owner (self-sovereign: a kard is signed by the identity it names, no one else). */
export function attachSignature(kard, pubHex, sigHex) {
  const s = kardSignable(kard);
  if (!s.ok) return s;
  if (!isPub(pubHex)) return { ok: false, why: 'public key must be an Ed25519 key (64 hex characters)' };
  if (pubHex !== kard.owner) return { ok: false, why: 'the signing key is not the kard owner — a kard is signed by the node it names' };
  if (!isSig(sigHex)) return { ok: false, why: 'an Ed25519 signature is 128 hex chars' };
  return { ok: true, kard: { ...kard, signature: { alg: 'Ed25519', pub: pubHex, sig: sigHex } } };
}

/** verifyKard(kard) — internal consistency: the facts match their own hash, the owner is well-formed,
 *  and (if signed) the signature names the owner. The signature BYTES are checked at the edge over
 *  kardSignable(); this kernel pins what is signed and enforces the identity invariant. */
export function verifyKard(kard) {
  if (!isObj(kard) || kard.kind !== KARD_KIND || !isStr(kard.hash)) return { ok: false, why: 'not a fallkard' };
  const body = { ...kard };
  delete body.hash;
  delete body.signature;
  const h = sha256(canon(body));
  if (!h.ok) return { ok: false, why: h.why };
  if (h.hash !== kard.hash) return { ok: true, valid: false, why: 'the kard does not match its own fingerprint — it was changed after it was minted' };
  if (!isPub(kard.owner)) return { ok: true, valid: false, why: 'the kard owner is not a well-formed Ed25519 key' };
  if (kard.signature !== undefined) {
    if (!isObj(kard.signature) || kard.signature.alg !== 'Ed25519') return { ok: true, valid: false, why: 'malformed signature block' };
    if (kard.signature.pub !== kard.owner) return { ok: true, valid: false, why: 'the signature key is not the kard owner' };
  }
  return { ok: true, valid: true, signed: kard.signature !== undefined, owner: kard.owner, why: 'kard intact' };
}

// ── the uncrossable budget wall (the money-rail boundary, real — not a stub) ───────────────────────
/** spendGate(kard, priorSpent, cost) — a node may exercise a capability only if the running spend
 *  stays at or under the kard's budgetCap. This is the wall the estate's money-rail sits behind:
 *  no capability, no signature, no caller can spend past the ceiling the kard was minted with. */
export function spendGate(kard, priorSpent, cost) {
  const v = verifyKard(kard);
  if (!v.ok) return { ok: false, why: v.why };
  if (!v.valid) return { ok: true, allowed: false, why: 'the kard is not valid: ' + v.why };
  if (!isSpend(priorSpent)) return { ok: false, why: 'priorSpent must be a finite number, zero or more' };
  if (!isSpend(cost)) return { ok: false, why: 'cost must be a finite number, zero or more' };
  const total = priorSpent + cost;
  if (total > kard.budgetCap) {
    return { ok: true, allowed: false, remaining: Math.max(0, kard.budgetCap - priorSpent), why: 'refused — this would spend ' + total + ' past the kard budget of ' + kard.budgetCap };
  }
  return { ok: true, allowed: true, remaining: kard.budgetCap - total, why: 'within budget' };
}

/** canOpen(kard, node) — a node can open a kard when the kard is valid and the node presents the
 *  capabilities the kard requires to instantiate (its structure + skin). Opening never exceeds budget. */
export function canOpen(kard, node) {
  const v = verifyKard(kard);
  if (!v.ok) return { ok: false, why: v.why };
  if (!v.valid) return { ok: true, canOpen: false, why: 'the kard is not valid: ' + v.why };
  if (!isObj(node)) return { ok: false, why: 'node must be an object { capabilities }' };
  if (!isArr(node.capabilities)) return { ok: false, why: 'node.capabilities must be an array' };
  const held = new Set(node.capabilities);
  const missing = [];
  for (const c of kard.capabilities) {
    if (!held.has(c)) missing.push(c);
  }
  if (missing.length > 0) return { ok: true, canOpen: false, missing, why: 'the opening node lacks required capabilities: ' + missing.join(', ') };
  return { ok: true, canOpen: true, skinRef: kard.skinRef, structureRef: kard.structureRef, why: 'ready to instantiate the node' };
}
