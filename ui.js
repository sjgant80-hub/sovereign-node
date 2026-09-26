/* FallKard — the front-door wiring. Everything here runs on the REAL gated kernels concatenated above
   this in the module (kard.mjs + flow.mjs): mintKard / attachSignature / kardSignable / verifyKard /
   spendGate / openKard / cheapVerdict. Real Ed25519 via WebCrypto. The locker uses the real Konomi
   Skins renderer (structure × skin, restyle-never-remove). No mocks presented as real; the spine is live,
   the "cheap" figure is a counted measurement, the locker is a clearly-labelled sample workspace.
   Wrapped in one IIFE so no name here collides with the kernels' module scope. */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt !== undefined) e.textContent = txt; return e; };
  const now = () => new Date().toISOString();
  const short = (h) => (typeof h === 'string' && h.length > 20) ? h.slice(0, 8) + '…' + h.slice(-6) : String(h);
  const hexOf = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const unhex = (s) => Uint8Array.from(s.match(/../g).map((x) => parseInt(x, 16)));

  // ── the "for builders" gate line + provenance (real witness figures from the kernels) ─────────────
  const GATE = 'kard 54/55 · flow 15/15';
  const chip = $('#gateChipInline'); if (chip) chip.textContent = GATE + ', mutation-proven';
  const prov = $('#gateProv');
  if (prov) prov.textContent = 'Kernel-backed: this page inlines kard.mjs (witness ' +
    '54/55, 1 argued equivalent) + flow.mjs (witness 15/15) — the logic you run is the logic the gate proves. ' +
    'CI re-runs both suites, both mutation gates and the page fixpoint on GitHub’s runner.';

  // ── the sigil: a deterministic emblem drawn from the kard's own fingerprint (honest, unique art) ───
  function sigil(hashHex) {
    const b = hashHex.match(/../g).map((h) => parseInt(h, 16));
    const grid = 5, pad = 13, span = 100 - pad * 2, cw = span / grid, gap = 2.6;
    let cells = '';
    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < 3; x++) {                    // left half + centre column, mirrored
        const idx = y * 3 + x;
        const on = ((b[idx] >> 2) & 1) === 1;
        if (!on) continue;
        const near = 1 - (Math.abs(2 - x) + Math.abs(2 - y)) / 4; // brighter toward centre
        const op = (0.55 + near * 0.45).toFixed(2);
        const rx = (pad + x * cw + gap / 2).toFixed(1), ry = (pad + y * cw + gap / 2).toFixed(1);
        const sz = (cw - gap).toFixed(1);
        cells += '<rect x="' + rx + '" y="' + ry + '" width="' + sz + '" height="' + sz + '" rx="1.4" fill="#f2d58a" opacity="' + op + '"/>';
        if (x !== 2) {
          const mx = (pad + (grid - 1 - x) * cw + gap / 2).toFixed(1);
          cells += '<rect x="' + mx + '" y="' + ry + '" width="' + sz + '" height="' + sz + '" rx="1.4" fill="#f2d58a" opacity="' + op + '"/>';
        }
      }
    }
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<circle cx="50" cy="50" r="46" fill="none" stroke="#ceae33" stroke-opacity="0.35" stroke-width="1.2"/>' +
      '<circle cx="50" cy="50" r="40" fill="none" stroke="#ceae33" stroke-opacity="0.18" stroke-width="0.8"/>' +
      cells +
      '<circle cx="50" cy="50" r="4.4" fill="#fff6d8"/></svg>';
  }

  const CAP_LABEL = { 'render:structure': 'render', 'load:memory': 'memory', 'net:none': 'offline' };
  const friendlyCap = (c) => CAP_LABEL[c] || c;

  // ── paint a minted kard into a card shell (hero + spine share this) ────────────────────────────────
  function paintKard(card, kard, pub) {
    const q = (slot) => card.querySelector('[data-slot="' + slot + '"]');
    card.classList.remove('is-empty');
    q('art').innerHTML = sigil(kard.hash);
    q('name').textContent = kard.label || 'sovereign node';
    q('serial').textContent = 'owner ' + short(pub);
    const aff = q('affixes'); aff.innerHTML = '';
    kard.capabilities.forEach((c) => aff.appendChild(el('span', null, friendlyCap(c))));
    q('budget').textContent = kard.budgetCap;
    q('seal').innerHTML = 'signed <span class="ok">✓</span> · fingerprint ' + short(kard.hash);
    requestAnimationFrame(() => { const bar = q('bar'); if (bar) bar.style.width = '100%'; });
  }

  async function forge(label) {
    const keypair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const pub = hexOf(await crypto.subtle.exportKey('raw', keypair.publicKey));
    const m = mintKard({
      owner: pub, skinRef: 'skin:exotic@1', structureRef: 'struct:workspace@1',
      capabilities: ['render:structure', 'load:memory'], budgetCap: 100, label, createdAt: now(),
    });
    if (!m.ok) throw new Error(m.why);
    const s = kardSignable(m.kard);
    const sig = hexOf(await crypto.subtle.sign({ name: 'Ed25519' }, keypair.privateKey, new TextEncoder().encode(s.payload)));
    const signed = attachSignature(m.kard, pub, sig);
    if (!signed.ok) throw new Error(signed.why);
    return { keypair, pub, kard: signed.kard };
  }

  async function verifySig(kard) {
    if (!kard.signature) return false;
    try {
      const s = kardSignable(kard);
      const key = await crypto.subtle.importKey('raw', unhex(kard.signature.pub), { name: 'Ed25519' }, false, ['verify']);
      return await crypto.subtle.verify({ name: 'Ed25519' }, key, unhex(kard.signature.sig), new TextEncoder().encode(s.payload));
    } catch (_) { return false; }
  }

  // ── the hero card: auto-forge a real kard on load, purely as a showcase ────────────────────────────
  (async function heroPull() {
    const hero = $('#heroKard'); if (!hero) return;
    if (!(crypto && crypto.subtle && crypto.subtle.generateKey)) return; // leave the empty slot
    try {
      const { pub, kard } = await forge('sovereign node');
      paintKard(hero, kard, pub);
      hero.classList.add('pull');
    } catch (_) { /* leave the empty slot */ }
  })();

  // ══════════════════════ THE LIVE SPINE (the ritual) ══════════════════════
  const spineCard = $('#kard');
  if (spineCard) {
    let keypair = null, myKard = null;
    let hasOpened = false;
    const NODE = { capabilities: ['render:structure', 'load:memory', 'net:none'] }; // this browser as the opening node
    const setStep = (id, cls) => { const s = $('#' + id); if (!s) return; s.classList.remove('locked', 'on', 'done'); if (cls) s.classList.add(cls); };

    const noCrypto = !(crypto && crypto.subtle && crypto.subtle.generateKey);

    $('#mintBtn').addEventListener('click', async () => {
      if (noCrypto) { spineCard.querySelector('.kard__empty p').textContent = 'this browser has no WebCrypto Ed25519'; return; }
      try {
        const forged = await forge('my sovereign node');
        keypair = forged.keypair; myKard = forged.kard;
        paintKard(spineCard, myKard, forged.pub);
        spineCard.classList.remove('summon', 'refuse'); void spineCard.offsetWidth; spineCard.classList.add('pull');
        $('#openBtn').disabled = false; $('#tamperBtn').disabled = false; $('#downloadKard').disabled = false;
        setStep('step-mint', 'done'); setStep('step-open', 'on');
        $('#openView').innerHTML = ''; $('#spendView').innerHTML = ''; $('#cheapView').innerHTML = '';
      } catch (e) {
        spineCard.querySelector('.kard__empty p').textContent = String(e.message || e);
      }
    });

    $('#downloadKard').addEventListener('click', () => {
      if (!myKard) return;
      const blob = new Blob([JSON.stringify(myKard, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'my.kard.json'; a.click(); URL.revokeObjectURL(a.href);
    });

    async function doOpen(kard, isTamper) {
      const box = $('#openView');
      const v = verifyKard(kard);
      const sigOk = await verifySig(kard);
      const r = openKard(kard, NODE);
      if (r.ok && r.opened && v.valid && sigOk) {
        box.innerHTML =
          '<div class="verdict"><span class="vd bg-ok"></span><span class="vs ok">NODE ONLINE</span></div>' +
          '<div class="meta" style="margin-top:8px">signature verified · owner ' + short(kard.owner) + '<br>building <b>' + kard.structureRef + '</b> in <b>' + kard.skinRef + '</b> — your structure, your face, your metal.</div>';
        spineCard.classList.remove('refuse'); void spineCard.offsetWidth; spineCard.classList.add('summon');
        hasOpened = true;
        setStep('step-open', 'done'); setStep('step-spend', 'on'); setStep('step-cheap', 'on');
        $('#spendOk').disabled = false; $('#spendOver').disabled = false; $('#cheapBtn').disabled = false;
      } else {
        const why = (!sigOk && v.valid) ? 'the signature does not verify' : (v.valid ? r.why : v.why);
        box.innerHTML = '<div class="verdict"><span class="vd bg-no"></span><span class="vs no">REFUSED</span></div>' +
          '<div class="meta" style="margin-top:8px">' + (isTamper ? 'tampered kard — ' : '') + why + '</div>';
        spineCard.classList.remove('summon'); void spineCard.offsetWidth; spineCard.classList.add('refuse');
      }
    }
    $('#openBtn').addEventListener('click', () => { if (myKard) doOpen(myKard, false); });
    $('#tamperBtn').addEventListener('click', () => {
      if (!myKard) return;
      doOpen({ ...myKard, budgetCap: 999999 }, true); // try to raise the ceiling after signing
    });

    function renderSpend(res, attemptedPct, cls, headline, note) {
      const wallPct = 100; // the cap is the wall
      $('#spendView').innerHTML =
        '<div class="verdict"><span class="vd bg-' + cls + '"></span><span class="vs ' + cls + '">' + headline + '</span>' +
        '<span class="meta" style="margin-left:auto">' + note + '</span></div>' +
        '<div class="gbar' + (cls === 'no' ? ' hit' : '') + '"><span class="wall" style="left:' + wallPct + '%"></span><i class="fill-' + cls + '"></i></div>' +
        '<div class="meta" style="margin-top:8px">' + res.why + '</div>';
      requestAnimationFrame(() => { const f = $('#spendView .gbar i'); if (f) f.style.width = Math.min(100, attemptedPct) + '%'; });
    }
    $('#spendOk').addEventListener('click', () => {
      if (!myKard) return;
      const r = spendGate(myKard, 40, 30); // 70 of 100
      renderSpend(r, 70, 'ok', 'ALLOWED', '70 / ' + myKard.budgetCap + ' · ' + r.remaining + ' left');
    });
    $('#spendOver').addEventListener('click', () => {
      if (!myKard) return;
      const r = spendGate(myKard, 90, 40); // 130 of 100 → refused
      renderSpend(r, 130, 'no', 'WALL HOLDS', 'attempted 130 · cap ' + myKard.budgetCap);
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
        '<div style="display:flex;align-items:flex-end;gap:14px;margin-top:4px">' +
        '<span class="bignum" id="cheapNum">0%</span>' +
        '<span class="meta">fewer render operations<br>over a real usage path (' + v.verdict + ')</span></div>' +
        '<div class="cheapbars">' +
        '<div class="cb full"><span class="lab">without</span><span class="track"><i></i></span><span class="n">' + v.full + '</span></div>' +
        '<div class="cb cheap"><span class="lab">with</span><span class="track"><i></i></span><span class="n">' + v.cheap + '</span></div></div>' +
        '<div class="meta" style="margin-top:8px">' + v.why + '</div>';
      requestAnimationFrame(() => {
        $('#cheapView .cb.full .track i').style.width = '100%';
        $('#cheapView .cb.cheap .track i').style.width = Math.max(3, v.cheap / v.full * 100) + '%';
      });
      // count-up the headline number
      const numEl = $('#cheapNum'); const target = v.savedPct; const t0 = performance.now(), dur = 850;
      (function tick(t) {
        const p = Math.min(1, (t - t0) / dur);
        numEl.textContent = (target * (p * (2 - p))).toFixed(1) + '%'; // easeOut
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }

  // ══════════════════════ THE LOCKER — one node, any look (real Konomi Skins renderer) ══════════════════════
  (function locker() {
    if (!$('#faceA')) return;

    function h(tag, attrs, kids) {
      const node = document.createElement(tag);
      attrs = attrs || {};
      for (const k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        const v = attrs[k]; if (v === undefined || v === null) continue;
        if (k === 'class') node.className = v;
        else if (k === 'style' && typeof v === 'object') { for (const sk in v) node.style[sk] = v[sk]; }
        else if (k === 'dataset' && typeof v === 'object') { for (const dk in v) node.dataset[dk] = v[dk]; }
        else if (k.indexOf('on') === 0 && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else node.setAttribute(k, v);
      }
      const list = kids === undefined ? [] : (Array.isArray(kids) ? kids : [kids]);
      list.forEach((c) => { if (c === null || c === undefined) return; node.appendChild((typeof c === 'string' || typeof c === 'number') ? document.createTextNode(String(c)) : c); });
      return node;
    }
    const clone = (o) => JSON.parse(JSON.stringify(o));
    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

    // the SAME workspace structure for every skin (Konomi describes what it IS; the skin decides how it looks)
    const STRUCTURE = {
      root: 'shell',
      components: [
        { id: 'shell', type: 'shell', children: ['nav', 'content'] },
        { id: 'nav', type: 'navigation', props: { brand: 'Your Node', items: [
          { id: 'a', label: 'Home', target: 'stats' }, { id: 'b', label: 'Work', target: 'data' },
          { id: 'c', label: 'Chat', target: 'chat' }, { id: 'd', label: 'Setup', target: 'form' } ] } },
        { id: 'content', type: 'container', children: ['stats', 'data', 'chat', 'form'] },
        { id: 'stats', type: 'panel-grid', props: { title: 'Overview', cards: [
          { id: 'c1', label: 'Nodes', value: '1' }, { id: 'c2', label: 'Budget', value: '100' },
          { id: 'c3', label: 'Files', value: 'yours', trend: 'on device', trendDir: '' },
          { id: 'c4', label: 'Uptime', value: 'own metal' } ] } },
        { id: 'data', type: 'data-view', props: { title: 'This week', dataset: [
          { id: 'd1', label: 'Mon', value: 42, group: 'Work' }, { id: 'd2', label: 'Tue', value: 61, group: 'Work' },
          { id: 'd3', label: 'Wed', value: 38, group: 'Work' }, { id: 'd4', label: 'Thu', value: 74, group: 'Home' },
          { id: 'd5', label: 'Fri', value: 55, group: 'Home' } ] } },
        { id: 'chat', type: 'conversation', props: { title: 'Assistant', messages: [
          { id: 'm1', role: 'assistant', text: 'Scripted demo — no live model here.' },
          { id: 'm2', role: 'user', text: 'Same workspace, different skin?' },
          { id: 'm3', role: 'assistant', text: 'Exactly. One node, any look.' } ] } },
        { id: 'form', type: 'form', props: { title: 'Quick add', fields: [
          { id: 't', label: 'Title', type: 'text', placeholder: 'New task' },
          { id: 'g', label: 'Tag', type: 'text', placeholder: 'work / home' } ] } },
      ],
      flows: [
        { id: 'f1', from: 'nav', event: 'select', to: 'content', action: 'highlight-section' },
        { id: 'f2', from: 'form', event: 'submit', to: 'chat', action: 'append-message' },
      ],
    };

    // ── the skins: five elite worlds, same structure ────────────────────────────────────────────────
    const SKINS = [
      { id: 'neoncyber', name: 'Neon-Cyber', world: 'neoncyber', font: "var(--mono)",
        tokens: { color: { bg: '#0a0a12', surface: '#0f0f1e', surfaceAlt: '#16162a', text: '#e7e6ff', textMuted: '#8a8ab5', accent: '#00FFFF', accentText: '#06121a', border: '#2a2a4a', success: '#33ffc7', danger: '#ff003c', terminalBg: '#05050a', terminalFg: '#00ffcc' } },
        layout: { mode: 'dark', density: 'compact', navStyle: 'dock', panelOrder: ['stats', 'data', 'chat', 'form'] },
        componentMap: { navigation: 'dock', conversation: 'terminal', 'data-view': 'radial', 'panel-grid': 'bento', form: 'card' } },
      { id: 'arcane', name: 'Arcane', world: 'arcane', font: "var(--serif)",
        tokens: { color: { bg: '#1a0f1e', surface: '#24131c', surfaceAlt: '#301722', text: '#f3e6db', textMuted: '#b79a86', accent: '#e6a919', accentText: '#1a0f1e', border: '#43312a', success: '#7fce8f', danger: '#d0563a' } },
        layout: { mode: 'dark', density: 'comfortable', navStyle: 'sidebar', panelOrder: ['stats', 'data', 'chat', 'form'] },
        componentMap: { navigation: 'sidebar', conversation: 'cards', 'data-view': 'list', 'panel-grid': 'grid', form: 'card' } },
      { id: 'tactical', name: 'Tactical', world: 'tactical', font: "var(--tech)",
        tokens: { color: { bg: '#0E2A47', surface: '#0b2038', surfaceAlt: '#123052', text: '#ece8e1', textMuted: '#8fa6bd', accent: '#ff4655', accentText: '#ffffff', border: '#1c3e60', success: '#3fd07a', danger: '#ff4655' } },
        layout: { mode: 'dark', density: 'comfortable', navStyle: 'topbar', panelOrder: ['stats', 'data', 'chat', 'form'] },
        componentMap: { navigation: 'topbar', conversation: 'cards', 'data-view': 'bars', 'panel-grid': 'grid', form: 'stacked' } },
      { id: 'vapor', name: 'Vaporwave', world: 'vapor', font: "var(--disp)",
        tokens: { color: { bg: '#1a0b2e', surface: '#2a1147', surfaceAlt: '#38195c', text: '#ffe6ff', textMuted: '#c79fd6', accent: '#ff71ce', accentText: '#1a0b2e', border: '#6a2f8a', success: '#05ffa1', danger: '#ff5470' } },
        layout: { mode: 'dark', density: 'comfortable', navStyle: 'dock', panelOrder: ['stats', 'chat', 'data', 'form'] },
        componentMap: { navigation: 'dock', conversation: 'bubbles', 'data-view': 'radial', 'panel-grid': 'bento', form: 'inline' } },
      { id: 'terminal', name: 'Terminal', world: 'terminal', font: "var(--mono)",
        tokens: { color: { bg: '#020402', surface: '#030603', surfaceAlt: '#061006', text: '#33ff66', textMuted: '#2aa347', accent: '#33ff66', accentText: '#020402', border: '#12331a', success: '#7CFC8C', danger: '#ff5f56', terminalBg: '#010301', terminalFg: '#33ff66' } },
        layout: { mode: 'dark', density: 'compact', navStyle: 'command-k', panelOrder: ['stats', 'data', 'chat', 'form'] },
        componentMap: { navigation: 'command-k', conversation: 'terminal', 'data-view': 'list', 'panel-grid': 'stack', form: 'inline' } },
    ];
    const BASE_MAP = { navigation: 'sidebar', conversation: 'bubbles', 'data-view': 'list', 'panel-grid': 'grid', form: 'stacked' };
    const findSkin = (id) => SKINS.find((s) => s.id === id) || SKINS[0];

    const RENDERERS = {
      navigation: { sidebar: navSidebar, topbar: navTopbar, dock: navDock, 'command-k': navCommandK },
      conversation: { bubbles: convoBubbles, terminal: convoTerminal, cards: convoCards },
      'data-view': { list: dataList, bars: dataBars, radial: dataRadial, tree: dataTree },
      'panel-grid': { grid: cardsGrid, bento: cardsBento, masonry: cardsMasonry, stack: cardsStack },
      form: { stacked: formStacked, inline: formInline, card: formCard },
    };
    function resolveVariant(type, skin) {
      const want = skin.componentMap && skin.componentMap[type];
      if (want && RENDERERS[type] && RENDERERS[type][want]) return want;
      return BASE_MAP[type]; // restyle, never remove
    }
    const densityScale = (d) => d === 'compact' ? 0.72 : (d === 'spacious' ? 1.45 : 1);

    function collect(structure) {
      const byId = {}; structure.components.forEach((c) => { byId[c.id] = c; });
      const order = []; let nav = null;
      (function visit(id) {
        const c = byId[id]; if (!c) return;
        if (c.type === 'navigation' && !nav) nav = c; else if (RENDERERS[c.type]) order.push(c);
        (c.children || []).forEach(visit);
      })(structure.root);
      return { nav, content: order };
    }
    function orderContent(comps, panelOrder) {
      if (!Array.isArray(panelOrder) || !panelOrder.length) return comps;
      const byId = {}; comps.forEach((c) => { byId[c.id] = c; });
      const out = []; panelOrder.forEach((id) => { if (byId[id]) { out.push(byId[id]); delete byId[id]; } });
      for (const k in byId) if (Object.prototype.hasOwnProperty.call(byId, k)) out.push(byId[k]);
      return out;
    }
    function findFlow(structure, from, event) { return (structure.flows || []).find((f) => f.from === from && f.event === event) || null; }
    function appendMessage(structure, convoId, msg) {
      const c = structure.components.find((x) => x.id === convoId && x.type === 'conversation');
      if (!c) return; c.props = c.props || {}; c.props.messages = c.props.messages || []; c.props.messages.push(msg);
    }

    function brandEl(text, skin) {
      if (skin.world === 'neoncyber') return h('span', { class: 'knm-name-glitch knm-nav-brand', 'data-t': text }, text);
      return h('div', { class: 'knm-nav-brand' }, text);
    }

    function renderStructure(structure, skin, container, ctx) {
      const col = skin.tokens.color, t = { radius: { sm: '4px', md: '8px', lg: '16px' } };
      const scale = densityScale(skin.layout.density);
      container.innerHTML = '';
      const app = h('div', { class: 'rendered-app world-' + skin.world + ' layout-' + (skin.layout.navStyle === 'command-k' ? 'commandk' : skin.layout.navStyle) });
      const set = (k, v) => v !== undefined && app.style.setProperty(k, v);
      set('--knm-bg', col.bg); set('--knm-surface', col.surface); set('--knm-surface-alt', col.surfaceAlt);
      set('--knm-text', col.text); set('--knm-text-muted', col.textMuted); set('--knm-accent', col.accent);
      set('--knm-accent-text', col.accentText); set('--knm-border', col.border);
      set('--knm-success', col.success); set('--knm-danger', col.danger);
      set('--knm-radius-sm', t.radius.sm); set('--knm-radius-md', t.radius.md); set('--knm-radius-lg', t.radius.lg);
      set('--knm-elevation-sm', '0 1px 2px rgba(0,0,0,0.35)'); set('--knm-elevation-md', '0 8px 22px rgba(0,0,0,0.5)');
      set('--knm-space', (8 * scale) + 'px'); set('--knm-font-family', skin.font);
      set('--knm-font-size', '14px'); set('--knm-heading-weight', '700');
      if (col.terminalBg) set('--knm-terminal-bg', col.terminalBg);
      if (col.terminalFg) set('--knm-terminal-fg', col.terminalFg);

      const picked = collect(structure);
      const rctx = Object.assign({ structure, skin, resolved: col }, ctx);
      const navEl = picked.nav ? renderComponent(picked.nav, skin, rctx) : null;

      const contentWrap = h('div', { class: 'knm-content' });
      const inner = h('div', { class: 'knm-content-inner' });
      orderContent(picked.content, skin.layout.panelOrder).forEach((comp) => {
        const section = h('div', { class: 'knm-section', dataset: { panel: comp.id } });
        section.appendChild(renderComponent(comp, skin, rctx));
        inner.appendChild(section);
      });
      contentWrap.appendChild(inner);

      if (skin.layout.navStyle === 'dock') { app.appendChild(contentWrap); if (navEl) app.appendChild(navEl); }
      else { if (navEl) app.appendChild(navEl); app.appendChild(contentWrap); }
      container.appendChild(app);
    }
    function renderComponent(component, skin, ctx) {
      const variant = resolveVariant(component.type, skin);
      const root = RENDERERS[component.type][variant](component, skin, ctx);
      root.dataset.componentType = component.type;
      return root;
    }

    /* nav */
    function navItem(item, ctx) {
      const active = ctx.active === item.target;
      return h('button', { type: 'button', class: 'knm-navitem' + (active ? ' active' : ''),
        onclick: () => { ctx.setActive(item.target || null); ctx.navigate(item.target); ctx.rerender(); } }, item.label);
    }
    function navSidebar(c, skin, ctx) { const w = h('div', { class: 'knm-nav knm-nav--sidebar' }); if (c.props && c.props.brand) w.appendChild(brandEl(c.props.brand, skin)); (c.props.items || []).forEach((i) => w.appendChild(navItem(i, ctx))); return w; }
    function navTopbar(c, skin, ctx) { const w = h('div', { class: 'knm-nav knm-nav--topbar' }); if (c.props && c.props.brand) { const b = brandEl(c.props.brand, skin); b.style.marginRight = '8px'; w.appendChild(b); } (c.props.items || []).forEach((i) => w.appendChild(navItem(i, ctx))); return w; }
    function navDock(c, skin, ctx) { const inner = h('div', { class: 'knm-dock-inner' }); (c.props.items || []).forEach((i) => inner.appendChild(navItem(i, ctx))); return h('div', { class: 'knm-nav knm-nav--dock' }, inner); }
    function navCommandK(c, skin, ctx) {
      const items = c.props.items || [];
      const panel = h('div', { class: 'knm-commandk-panel' }); items.forEach((i) => panel.appendChild(navItem(i, ctx)));
      const trigger = h('button', { type: 'button', class: 'knm-commandk-trigger', onclick: () => panel.classList.toggle('open') },
        (c.props.brand ? c.props.brand + ' — ' : '') + 'Open navigation (' + items.length + ')');
      return h('div', { class: 'knm-nav knm-nav--commandk' }, [trigger, panel]);
    }

    /* conversation */
    const REPLIES = ['Noted — scripted demo reply, no live model.', 'This just shows the append-message flow.', 'Still demo text — but the layout above is real and interactive.'];
    function submitMsg(component, ctx, text) {
      if (!text || !text.trim()) return;
      appendMessage(ctx.structure, component.id, { id: 'm' + Date.now(), role: 'user', text: text.trim() }); ctx.rerender();
      setTimeout(() => { appendMessage(ctx.structure, component.id, { id: 'm' + (Date.now() + 1), role: 'assistant', text: REPLIES[Math.floor(Math.random() * REPLIES.length)] }); ctx.rerender(); }, 420);
    }
    function inputRow(component, ctx) {
      const input = h('input', { class: 'knm-input', type: 'text', placeholder: 'Type a message…' });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { submitMsg(component, ctx, input.value); input.value = ''; } });
      const send = h('button', { class: 'knm-btn', type: 'button', onclick: () => { submitMsg(component, ctx, input.value); input.value = ''; } }, 'Send');
      return h('div', { class: 'knm-input-row' }, [input, send]);
    }
    function convoBubbles(c, skin, ctx) { const list = h('div', { class: 'msg-list' }); (c.props.messages || []).forEach((m) => list.appendChild(h('div', { class: 'bubble ' + m.role }, m.text))); return h('div', { class: 'knm-convo knm-convo--bubbles' }, [h('div', { class: 'knm-panel-heading' }, c.props.title || 'Conversation'), list, inputRow(c, ctx)]); }
    function convoTerminal(c, skin, ctx) { const list = h('div', { class: 'msg-list' }); (c.props.messages || []).forEach((m) => list.appendChild(h('div', { class: 'line ' + m.role }, m.text))); return h('div', { class: 'knm-convo knm-convo--terminal' }, [h('div', { class: 'knm-panel-heading', style: { color: 'inherit', opacity: '0.7' } }, c.props.title || 'Conversation'), list, inputRow(c, ctx)]); }
    function convoCards(c, skin, ctx) { const list = h('div', { class: 'msg-list' }); (c.props.messages || []).forEach((m) => list.appendChild(h('div', { class: 'msg-card' }, [h('div', { class: 'role' }, m.role), h('div', {}, m.text)]))); return h('div', { class: 'knm-convo knm-convo--cards' }, [h('div', { class: 'knm-panel-heading' }, c.props.title || 'Conversation'), list, inputRow(c, ctx)]); }

    /* data-view */
    function dataList(c, skin) { const data = c.props.dataset || []; const max = Math.max.apply(null, data.map((d) => d.value).concat([1])); const w = h('div', { class: 'knm-dataview knm-dataview--list' }, h('div', { class: 'knm-panel-heading' }, c.props.title || 'Data')); data.forEach((d) => { w.appendChild(h('div', { class: 'row-item' }, [h('div', { class: 'row-label' }, d.label), h('div', { class: 'row-bar-track' }, h('div', { class: 'row-bar-fill', style: { width: clamp(d.value / max * 100, 2, 100) + '%' } })), h('div', { class: 'row-value' }, String(d.value))])); }); return w; }
    function dataBars(c, skin) { const data = c.props.dataset || []; const max = Math.max.apply(null, data.map((d) => d.value).concat([1])); const bars = h('div', { class: 'knm-dataview--bars' }); data.forEach((d) => bars.appendChild(h('div', { class: 'bar-col' }, [h('div', { class: 'bar', style: { height: clamp(d.value / max * 100, 4, 100) + '%' }, title: d.label + ': ' + d.value }), h('div', { class: 'bar-label' }, d.label)]))); return h('div', { class: 'knm-dataview' }, [h('div', { class: 'knm-panel-heading' }, c.props.title || 'Data'), bars]); }
    function dataRadial(c, skin, ctx) { const data = c.props.dataset || []; const total = data.reduce((s, d) => s + d.value, 0) || 1; const col = ctx.resolved; const palette = [col.accent, col.success, col.danger, col.textMuted, col.border]; let acc = 0; const stops = data.map((d, i) => { const start = acc / total * 360; acc += d.value; const end = acc / total * 360; return palette[i % palette.length] + ' ' + start.toFixed(1) + 'deg ' + end.toFixed(1) + 'deg'; }).join(', '); const ring = h('div', { class: 'ring', style: { background: 'conic-gradient(' + stops + ')' } }); const legend = h('div', { class: 'legend' }); data.forEach((d, i) => legend.appendChild(h('div', { class: 'legend-item' }, [h('span', { class: 'dot', style: { background: palette[i % palette.length] } }), h('span', {}, d.label + ' — ' + d.value)]))); return h('div', { class: 'knm-dataview knm-dataview--radial' }, [h('div', { class: 'knm-panel-heading', style: { width: '100%' } }, c.props.title || 'Data'), h('div', { style: { display: 'flex', gap: '18px', alignItems: 'center', flexWrap: 'wrap' } }, [ring, legend])]); }
    function dataTree(c, skin) { const data = c.props.dataset || []; const groups = {}; const order = []; data.forEach((d) => { const g = d.group || 'Other'; if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(d); }); const root = h('ul', {}); order.forEach((g) => { const li = h('li', { style: { display: 'block' } }); li.appendChild(h('div', { class: 'group-label' }, g)); const sub = h('ul', {}); groups[g].forEach((d) => sub.appendChild(h('li', {}, [h('span', {}, d.label), h('span', {}, String(d.value))]))); li.appendChild(sub); root.appendChild(li); }); return h('div', { class: 'knm-dataview knm-dataview--tree' }, [h('div', { class: 'knm-panel-heading' }, c.props.title || 'Data'), root]); }

    /* panel-grid */
    function statCard(card) { const tc = card.trendDir === 'up' ? 'up' : (card.trendDir === 'down' ? 'down' : ''); const kids = [h('div', { class: 'label' }, card.label), h('div', { class: 'value' }, card.value)]; if (card.trend) kids.push(h('div', { class: 'trend ' + tc }, card.trend)); return h('div', { class: 'knm-card' }, kids); }
    function cards(c, cls) { const grid = h('div', { class: cls }); (c.props.cards || []).forEach((x) => grid.appendChild(statCard(x))); return h('div', { class: 'knm-cards' }, [h('div', { class: 'knm-panel-heading' }, c.props.title || 'Stats'), grid]); }
    function cardsGrid(c) { return cards(c, 'knm-cards--grid'); }
    function cardsBento(c) { return cards(c, 'knm-cards--bento'); }
    function cardsMasonry(c) { return cards(c, 'knm-cards--masonry'); }
    function cardsStack(c) { return cards(c, 'knm-cards--stack'); }

    /* form */
    function buildFields(fields) { return fields.map((f) => h('div', { class: 'field' }, [h('label', {}, f.label), h('input', { class: 'knm-input', type: f.type || 'text', placeholder: f.placeholder || '' })])); }
    function submitFormFn(component, ctx, fieldEls, statusEl) {
      const parts = [];
      fieldEls.forEach((fw) => { const inp = fw.querySelector('input'); const lab = fw.querySelector('label'); if (inp && inp.value) parts.push(lab.textContent + ': ' + inp.value); if (inp) inp.value = ''; });
      const flow = findFlow(ctx.structure, component.id, 'submit');
      if (flow && flow.action === 'append-message') appendMessage(ctx.structure, flow.to, { id: 'm' + Date.now(), role: 'system', text: parts.length ? ('Added — ' + parts.join(', ')) : 'Added (no details).' });
      statusEl.textContent = 'Submitted.'; statusEl.classList.add('ok');
      if (flow) setTimeout(() => ctx.rerender(), 460);
    }
    function formWrap(component, ctx, cls) {
      const fieldEls = buildFields(component.props.fields || []);
      const status = h('div', { class: 'knm-form-note' }, '');
      const form = h('form', { class: 'knm-form', onsubmit: (e) => { e.preventDefault(); submitFormFn(component, ctx, fieldEls, status); } }, [h('div', { class: cls }, fieldEls), h('button', { class: 'knm-btn', type: 'submit' }, 'Submit'), status]);
      return h('div', { class: 'knm-form-wrap' }, [h('div', { class: 'knm-panel-heading' }, component.props.title || 'Form'), form]);
    }
    function formStacked(c, s, ctx) { return formWrap(c, ctx, 'knm-form--stacked'); }
    function formInline(c, s, ctx) { return formWrap(c, ctx, 'knm-form--inline'); }
    function formCard(c, s, ctx) { return formWrap(c, ctx, 'knm-form--card'); }

    // ── the two faces ────────────────────────────────────────────────────────────────────────────────
    const faces = {
      A: { skin: 'neoncyber', structure: clone(STRUCTURE), active: null, container: $('#faceA'), name: $('#faceAName'), chips: $('#skinsA') },
      B: { skin: 'arcane', structure: clone(STRUCTURE), active: null, container: $('#faceB'), name: $('#faceBName'), chips: $('#skinsB') },
    };
    function paintFace(key) {
      const f = faces[key]; const skin = findSkin(f.skin);
      f.name.textContent = skin.name;
      renderStructure(f.structure, skin, f.container, {
        active: f.active,
        setActive: (t) => { f.active = t; },
        rerender: () => paintFace(key),
        navigate: (target) => {
          if (!target) return;
          const node = f.container.querySelector('[data-panel="' + target + '"]');
          if (node) { node.classList.add('knm-highlight'); setTimeout(() => node.classList.remove('knm-highlight'), 1000); }
        },
      });
      [...f.chips.children].forEach((c) => c.classList.toggle('active', c.dataset.skin === f.skin));
    }
    function buildChips(key) {
      const f = faces[key]; f.chips.innerHTML = '';
      SKINS.forEach((s) => {
        const c = el('button', 'skinchip', s.name); c.dataset.skin = s.id; c.type = 'button';
        if (s.id === f.skin) c.classList.add('active');
        c.addEventListener('click', () => { f.skin = s.id; f.active = null; f.structure = clone(STRUCTURE); paintFace(key); });
        f.chips.appendChild(c);
      });
    }
    ['A', 'B'].forEach((k) => { buildChips(k); paintFace(k); });

    // shuffle both worlds to two distinct skins
    $('#shuffleFaces').addEventListener('click', () => {
      let i = Math.floor(Math.random() * SKINS.length);
      let j = Math.floor(Math.random() * SKINS.length); while (j === i) j = Math.floor(Math.random() * SKINS.length);
      faces.A.skin = SKINS[i].id; faces.B.skin = SKINS[j].id;
      faces.A.active = null; faces.B.active = null;
      faces.A.structure = clone(STRUCTURE); faces.B.structure = clone(STRUCTURE);
      buildChips('A'); buildChips('B'); paintFace('A'); paintFace('B');
    });
  })();

})();
