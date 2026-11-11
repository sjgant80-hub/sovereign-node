// make-page.mjs — assemble index.html from the PROVEN kernels + the UI + the template.
// The page inlines kard.mjs + flow.mjs verbatim, so the gated logic IS the live logic. CI regenerates
// and runs `git diff --exit-code index.html` — if the page drifts from the kernels, the build fails.
// All placeholder substitutions use FUNCTION replacements so a `$&`/`$1` in the payload is never
// interpreted as a replacement pattern (the ui-gate lesson).
import { readFileSync, writeFileSync } from 'node:fs';

const kard = readFileSync(new URL('./kard.mjs', import.meta.url), 'utf8');
// flow.mjs imports from kard.mjs; kard is concatenated above it, so drop the import (same module scope).
const flow = readFileSync(new URL('./flow.mjs', import.meta.url), 'utf8')
  .replace(/^import\s*\{[^}]*\}\s*from\s*'\.\/kard\.mjs';\s*$/m, '/* kard.mjs inlined above */')
  // strip helpers that kard.mjs already declares in the shared module scope (avoid re-declaration)
  .replace(/^const isStr = \(v\) => typeof v === 'string';\s*$/m, '/* isStr from kard.mjs */')
  .replace(/^const isArr = \(v\) => Array\.isArray\(v\);\s*$/m, '/* isArr from kard.mjs */');
const ui = readFileSync(new URL('./ui.js', import.meta.url), 'utf8');
let tmpl = readFileSync(new URL('./page.template.html', import.meta.url), 'utf8');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const B = 'https://sjgant80-hub.github.io/';
const WEAVE = [
  { n: '00', tag: 'rail', spine: false, title: 'Prove it', desc: 'Nothing here is taken on trust — every claim is re-runnable proof, checked by a machine, not an opinion from a model. This rail runs under every stage below.',
    organs: [['kar-hub · the verifier shelf', B + 'kar-hub/'], ['kar-warden', B + 'kar-warden/'], ['kar-citelock', B + 'kar-citelock/']] },
  { n: '01', tag: 'flow', spine: true, title: 'Get a kard', desc: 'Your kard is you-as-a-tool: a portable, signed pass carrying your look, your workspace and a hard spending cap. Forge it into a shareable card.',
    organs: [['fallkard-forge · a real build in a PNG', B + 'fallkard-forge/']] },
  { n: '02', tag: 'flow', spine: true, title: 'Open it → your space appears', desc: 'Opening the kard builds your workspace: Konomi assembles what it is, your skin decides how it looks, your own memory loads — all on your machine.',
    organs: [['konomi-skins · own your look', B + 'konomi-skins/'], ['fallforgemint · own your model', B + 'fallforgemint/'], ['kar-mind · your memory', B + 'kar-mind/']] },
  { n: '03', tag: 'flow', spine: true, title: 'Run it light', desc: 'It draws only what you are looking at and reuses what stays on screen. Counted, with vs without — a real number, not a claim.',
    organs: [['kar-foldcycle · recycle state', B + 'kar-foldcycle/']] },
  { n: '04', tag: 'flow', spine: true, title: 'Join up', desc: 'Each kard is a node. Many kards make a personal network you enter one kard at a time. FallKard is the on-ramp.',
    organs: [['assemble a whole node · fall-architect', B + 'fall-architect/']] },
];
const weaveHtml = WEAVE.map((s) =>
  '<div class="stagecard"><div class="n">' + s.n + '</div>' +
  '<div><h3>' + esc(s.title) + '</h3><p>' + esc(s.desc) + '</p><div class="organs">' +
  s.organs.map(([label, href]) => '<a href="' + href + '" target="_blank" rel="noopener">' + esc(label) + ' →</a>').join('') +
  '</div></div><div class="tag' + (s.spine ? '' : ' backbone') + '">' + (s.spine ? 'flow' : 'trust rail') + '</div></div>'
).join('\n');

// ── ONE SOURCE for the FAQ: the visible section AND the FAQPage schema (Google requires an exact match) ──
const FAQ = [
  ['What is FallKard, in plain terms?', 'A kard is like a save file for a tool that is yours. You get one, open it, and your own workspace appears — on your machine, in a look you choose. No account, no monthly rent, and nothing leaves your device.'],
  ['What does it replace?', 'The expensive half of software: the bespoke front-end rebuilt per client, per-tenant white-label theming, per-seat hosted subscriptions, the stack of monthly tools, and per-customer hosting. One build, skinned per person, hosted by the owner.'],
  ['Who is it for?', 'Agencies and solo builders who rebuild the same tool for every client — build once, hand each client a skinned copy, no re-host — and individuals who want tools that look like theirs and outlive any vendor.'],
  ['Is my data sent anywhere?', 'No. Everything runs client-side in your browser: every keypair and every render happens on your device. There is no backend and no account.'],
  ['What is a kard, technically?', 'A portable, signed identity: an Ed25519 owner key plus a skin reference, a structure reference, a capability set and an uncrossable budget. Opening it instantiates your node, and only the identity it names can sign it.'],
  ['How is "runs light" measured?', 'By counting render operations over a real usage path — rendering only what is in view and reusing what stays, versus rendering everything every step. The number on the page is that count: reproducible, with no LLM judge.'],
  ['Can a node spend past its budget?', 'No. The budget wall is enforced in the witness-gated kernel — no capability, no signature and no caller can raise the ceiling a kard was minted with. Selling kards or skins waits behind counsel.'],
];
const faqHtml = FAQ.map(([q, a], i) =>
  '<details' + (i === 0 ? ' open' : '') + '><summary>' + esc(q) + '</summary><div class="a">' + esc(a) + '</div></details>'
).join('\n');

const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication', name: 'FallKard', applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Any (runs in the browser)', url: B + 'sovereign-node/', isAccessibleForFree: true,
      description: 'FallKard turns the tools you use into something you own: get a signed kard, open it, and your own workspace appears — on your machine, in a look you choose. No account, no monthly rent; everything runs client-side. Pick your look from a locker of skins; the spending cap is enforced in a witness-gated kernel.',
      creator: { '@type': 'Organization', name: 'AI Native Solutions (Kar)' },
      featureList: [
        'You own your copy — a signed, self-sovereign identity (Ed25519)',
        'Opens on your own machine; nothing sent anywhere',
        'Pick your look — one workspace, many skins (structure/skin split)',
        'Uncrossable per-kard spending cap, enforced in the gated kernel',
        'Runs light — render-on-observation + state-recycling, measured not claimed',
        'An alternative to per-client rebuilds, white-label theming and per-seat hosted SaaS',
      ],
    },
    { '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ],
};

tmpl = tmpl.replace('<!--SCHEMA-->', () => '<script type="application/ld+json">\n' + JSON.stringify(schema, null, 2) + '\n</script>');
tmpl = tmpl.replace('<!--WEAVE_CARDS-->', () => weaveHtml);
tmpl = tmpl.replace('<!--FAQ-->', () => faqHtml);
tmpl = tmpl.replace('//<!--KERNEL_AND_UI-->', () => kard + '\n\n/* ── flow.mjs ── */\n' + flow + '\n\n/* ── UI ── */\n' + ui);

writeFileSync(new URL('./index.html', import.meta.url), tmpl);
console.log('index.html written · kard', kard.length, '· flow', flow.length, '· ui', ui.length, '· total', tmpl.length, 'bytes');
