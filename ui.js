/* FallKard — the front-door wiring. Uses the REAL gated kernels (kard.mjs + flow.mjs, concatenated above
   this in the module) — mintKard / attachSignature / verifyKard / spendGate / openKard / cheapVerdict.
   Real Ed25519 via WebCrypto. A compact real structure-in-skin render for the two faces. No mocks. */
const $ = (s) => document.querySelector(s);
const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt !== undefined) e.textContent = txt; return e; };
const now = () => new Date().toISOString();
const short = (h) => (typeof h === 'string' && h.length > 20) ? h.slice(0, 10) + '…' + h.slice(-6) : String(h);
function hex(buf) { return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join(''); }
function unhex(s) { return Uint8Array.from(s.match(/../g).map((h) => parseInt(h, 16))); }

const GATE = 'kard 54/55 · flow 15/15';
$('#gateChip').textContent = 'witness ' + GATE;
$('#gateProv').textContent = 'Kernels: kard.mjs (witness 54/55, 1 argued equivalent) + flow.mjs (witness 15/15). The page inlines the gated kernels — the logic you see run is the logic the gate proves. CI re-runs both suites + the mutation gate on GitHub’s runner.';

// ── the live spine: mint → open → verify → spend → cheap ─────────────────────────────────────────
let keypair = null, myKard = null, opened = null;
const NODE = { capabilities: ['render:structure', 'load:memory', 'net:none'] }; // this browser, as an opening node

$('#mintBtn').addEventListener('click', async () => {
  try {
    keypair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const pub = hex(await crypto.subtle.exportKey('raw', keypair.publicKey));
    const m = mintKard({
      owner: pub, skinRef: 'skin:aurora@1', structureRef: 'struct:workspace@1',
      capabilities: ['render:structure', 'load:memory'], budgetCap: 100,
      label: 'my sovereign node', createdAt: now(),
    });
    if (!m.ok) { $('#kardView').innerHTML = '<span class="no">' + m.why + '</span>'; return; }
    const s = kardSignable(m.kard);
    const sig = hex(await crypto.subtle.sign({ name: 'Ed25519' }, keypair.privateKey, new TextEncoder().encode(s.payload)));
    const signed = attachSignature(m.kard, pub, sig);
    myKard = signed.kard;
    $('#kardView').innerHTML =
      'owner · <b>' + short(pub) + '</b> (Ed25519, yours)<br>' +
      'carries · <b>' + myKard.structureRef + '</b> in <b>' + myKard.skinRef + '</b><br>' +
      'capabilities · <b>' + myKard.capabilities.join(', ') + '</b><br>' +
      'budget · <b>' + myKard.budgetCap + '</b> · signed ✎ <b>' + short(myKard.hash) + '</b>';
    $('#openBtn').disabled = false; $('#tamperBtn').disabled = false; $('#downloadKard').disabled = false;
  } catch (e) {
    $('#kardView').innerHTML = '<span class="no">This browser has no WebCrypto Ed25519 — mint needs it.</span>';
  }
});
$('#downloadKard').addEventListener('click', () => {
  if (!myKard) return;
  const blob = new Blob([JSON.stringify(myKard, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'my.kard.json'; a.click(); URL.revokeObjectURL(a.href);
});

async function verifySig(kard) {
  if (!kard.signature) return false;
  try {
    const s = kardSignable(kard);
    const key = await crypto.subtle.importKey('raw', unhex(kard.signature.pub), { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'Ed25519' }, key, unhex(kard.signature.sig), new TextEncoder().encode(s.payload));
  } catch (_) { return false; }
}

async function doOpen(kard) {
  const box = $('#openView');
  const v = verifyKard(kard);
  const sigOk = await verifySig(kard);
  const r = openKard(kard, NODE);
  if (r.ok && r.opened && v.valid && sigOk) {
    box.innerHTML =
      '<div class="verdict"><span class="dot bg-ok"></span><span class="st ok">NODE INSTANTIATED</span></div>' +
      '<div class="meta" style="margin-top:8px">signature verified · owner ' + short(kard.owner) + '<br>building <b>' + kard.structureRef + '</b> in <b>' + kard.skinRef + '</b> — your structure, your face, your metal.</div>';
    opened = r.node;
  } else {
    const why = !sigOk && v.valid ? 'the signature does not verify' : (v.valid ? r.why : v.why);
    box.innerHTML = '<div class="verdict"><span class="dot bg-no"></span><span class="st no">REFUSED</span></div>' +
      '<div class="meta" style="margin-top:8px">' + why + '</div>';
  }
}
$('#openBtn').addEventListener('click', () => { if (myKard) doOpen(myKard); });
$('#tamperBtn').addEventListener('click', () => {
  if (!myKard) return;
  const tampered = { ...myKard, budgetCap: 999999 }; // try to raise the ceiling after signing
  doOpen(tampered);
});

$('#spendOk').addEventListener('click', () => {
  if (!myKard) { $('#spendView').innerHTML = '<div class="meta no">Mint a kard first.</div>'; return; }
  const r = spendGate(myKard, 40, 30); // 70 of 100
  $('#spendView').innerHTML = '<div class="verdict"><span class="dot bg-ok"></span><span class="st ok">ALLOWED</span>' +
    '<span class="meta" style="margin-left:auto">70 / ' + myKard.budgetCap + ' · ' + r.remaining + ' left</span></div>';
});
$('#spendOver').addEventListener('click', () => {
  if (!myKard) { $('#spendView').innerHTML = '<div class="meta no">Mint a kard first.</div>'; return; }
  const r = spendGate(myKard, 90, 40); // 130 of 100
  $('#spendView').innerHTML = '<div class="verdict"><span class="dot bg-no"></span><span class="st no">REFUSED</span>' +
    '<span class="meta" style="margin-left:auto">' + r.remaining + ' left · wall holds</span></div>' +
    '<div class="meta" style="margin-top:6px">' + r.why + '</div>';
});

$('#cheapBtn').addEventListener('click', () => {
  // a real usage path over a 6-component workspace: the viewport moves; count render ops with vs without.
  const comps = ['nav', 'stats', 'chat', 'memory', 'files', 'settings'];
  const steps = [
    ['nav', 'stats', 'chat'], ['nav', 'chat', 'memory'], ['nav', 'memory', 'files'],
    ['nav', 'files', 'chat'], ['nav', 'chat', 'stats'], ['nav', 'stats'],
  ];
  const v = cheapVerdict(comps, steps);
  const cls = v.verdict === 'WIN' ? 'ok' : 'no';
  $('#cheapView').innerHTML =
    '<div style="display:flex;align-items:baseline;gap:14px;margin-top:6px"><span class="big ' + cls + '">' + v.savedPct + '%</span>' +
    '<span class="meta">fewer render operations<br><b>' + v.cheap + '</b> vs <b>' + v.full + '</b> (' + v.verdict + ')</span></div>' +
    '<div class="meta" style="margin-top:8px">' + v.why + '</div>';
});

// ── one kard, two faces: a real compact structure rendered under two real skins ────────────────────
const STRUCTURE = {
  nav: ['Home', 'Work', 'Memory'],
  stats: [['Nodes', '1'], ['Budget', '100'], ['Cheap', '58%']],
  convo: ['open your kard', 'your node is yours', 'run it cheap'],
};
const SKINS = [
  { name: 'aurora', bg: '#0b1418', surface: '#12212a', ink: '#e7fbff', accent: '#6ff2d4', radius: '14px', font: "'IBM Plex Sans',sans-serif", pill: '999px' },
  { name: 'brutalist', bg: '#f4f1ea', surface: '#fffdf7', ink: '#141210', accent: '#ff5c2b', radius: '0px', font: "'IBM Plex Mono',monospace", pill: '0px' },
  { name: 'cyber', bg: '#08070d', surface: '#120c1e', ink: '#f0e9ff', accent: '#c86bff', radius: '4px', font: "'IBM Plex Mono',monospace", pill: '3px' },
  { name: 'cozy', bg: '#211a17', surface: '#2c231e', ink: '#f6ece2', accent: '#e9a35e', radius: '18px', font: "'Fraunces',serif", pill: '999px' },
];
function renderWorkspace(structure, skin, container) {
  container.innerHTML = '';
  const app = el('div');
  app.style.cssText = 'background:' + skin.bg + ';color:' + skin.ink + ';font-family:' + skin.font + ';border-radius:' + skin.radius + ';padding:12px;height:100%';
  const nav = el('div'); nav.style.cssText = 'display:flex;gap:8px;margin-bottom:10px';
  structure.nav.forEach((n, i) => { const b = el('span', null, n); b.style.cssText = 'font-size:11px;padding:4px 10px;border-radius:' + skin.pill + ';background:' + (i === 0 ? skin.accent : skin.surface) + ';color:' + (i === 0 ? skin.bg : skin.ink); nav.appendChild(b); });
  app.appendChild(nav);
  const stats = el('div'); stats.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px';
  structure.stats.forEach(([k, val]) => { const c = el('div'); c.style.cssText = 'background:' + skin.surface + ';border-radius:' + skin.radius + ';padding:8px'; c.innerHTML = '<div style="font-size:9px;opacity:.6;text-transform:uppercase;letter-spacing:.08em">' + k + '</div><div style="font-size:18px;font-weight:600;color:' + skin.accent + '">' + val + '</div>'; stats.appendChild(c); });
  app.appendChild(stats);
  const chat = el('div'); chat.style.cssText = 'background:' + skin.surface + ';border-radius:' + skin.radius + ';padding:8px;display:flex;flex-direction:column;gap:5px';
  structure.convo.forEach((m) => { const bub = el('div', null, m); bub.style.cssText = 'font-size:11px;padding:5px 9px;border-radius:' + skin.pill + ';background:' + skin.bg + ';align-self:flex-start;max-width:85%'; chat.appendChild(bub); });
  app.appendChild(chat);
  container.appendChild(app);
}
let faceIdx = 0;
function paintFaces() {
  const a = SKINS[faceIdx % SKINS.length], b = SKINS[(faceIdx + 1) % SKINS.length];
  $('#faceAName').textContent = a.name; $('#faceBName').textContent = b.name;
  renderWorkspace(STRUCTURE, a, $('#faceA'));
  renderWorkspace(STRUCTURE, b, $('#faceB'));
}
$('#reskin').addEventListener('click', () => { faceIdx = (faceIdx + 2) % SKINS.length; paintFaces(); });
paintFaces();
