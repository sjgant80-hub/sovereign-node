// make-page.mjs — assemble index.html from the PROVEN kernels + the UI + the template.
// The page inlines kard.mjs + flow.mjs verbatim, so the gated logic IS the live logic. CI regenerates
// and runs `git diff --exit-code index.html` — if the page drifts from the kernels, the build fails.
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

const B = 'https://sjgant80-hub.github.io/';
const WEAVE = [
  { n: '00', tag: 'backbone', spine: false, title: 'Prove', desc: 'Nothing is trusted unless it is re-runnable proof — never an opinion from a model. This trust rail runs underneath every stage below.',
    organs: [['kar-hub · the verifier shelf', B + 'kar-hub/'], ['kar-warden', B + 'kar-warden/'], ['kar-citelock', B + 'kar-citelock/']] },
  { n: '01', tag: 'spine', spine: true, title: 'Acquire — mint your kard', desc: 'A kard is you-as-a-system: a portable, signed identity carrying your structure, your skin, your capabilities and an uncrossable budget. Forge it into a shareable card.',
    organs: [['fallkard-forge · a real build in a PNG', B + 'fallkard-forge/']] },
  { n: '02', tag: 'spine', spine: true, title: 'Instantiate — your node appears', desc: 'Opening the kard builds your node: Konomi assembles the structure, your skin renders it (same build, your face), your own memory loads — on your metal.',
    organs: [['konomi-skins · own your look', B + 'konomi-skins/'], ['fallforgemint · own your model', B + 'fallforgemint/'], ['kar-mind · your memory', B + 'kar-mind/']] },
  { n: '03', tag: 'spine', spine: true, title: 'Run cheap — measured', desc: 'Render only your point of view; hold what you keep looking at; recycle what you leave. Counted, with vs without — a real number, not a claim.',
    organs: [['kar-foldcycle · recycle state', B + 'kar-foldcycle/']] },
  { n: '04', tag: 'spine', spine: true, title: 'Join the mesh', desc: 'Each kard is a node. A million kards is a personalised sovereign mesh — the chord, not the merge — entered one kard at a time. FallKard is the on-ramp.',
    organs: [['assemble a whole node · fallkit', B + 'fallkit/']] },
];
const weaveHtml = WEAVE.map((s) =>
  '<div class="stagecard"><div class="n">' + s.n + '</div>' +
  '<div><h3>' + s.title + '</h3><p>' + s.desc + '</p><div class="organs">' +
  s.organs.map(([label, href]) => '<a href="' + href + '" target="_blank" rel="noopener">' + label + ' →</a>').join('') +
  '</div></div><div class="spine' + (s.tag === 'backbone' ? ' backbone' : '') + '">' + (s.spine ? 'spine' : 'backbone') + '</div></div>'
).join('\n');

const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication', name: 'FallKard', applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Any (runs in the browser)', url: B + 'fallkard/', isAccessibleForFree: true,
      description: 'FallKard is the entry point that weaves the FallForge estate into one flow: mint a signed kard, open it to instantiate your own sovereign node — your structure, your look, your memory, on your metal — run it cheap, and join the mesh.',
      creator: { '@type': 'Organization', name: 'FallForge estate (Kar / karma-didy)' },
      featureList: ['Signed, self-sovereign kard identity (Ed25519)', 'Uncrossable per-kard budget wall', 'Measured render-on-observation + state-recycling (cheap is counted, not claimed)', 'Own your look — structure/skin split', 'Runs client-side, nothing sent anywhere'],
    },
    {
      '@type': 'FAQPage', mainEntity: [
        { '@type': 'Question', name: 'What is a kard?', acceptedAnswer: { '@type': 'Answer', text: 'A portable, signed identity — an Ed25519 owner key plus a skin reference, a structure reference, a capability set and an uncrossable budget. Opening it instantiates your sovereign node. Only the identity it names can sign it.' } },
        { '@type': 'Question', name: 'How is "cheap" measured?', acceptedAnswer: { '@type': 'Answer', text: 'By counting render operations over a real usage path, with render-on-observation + state-recycling vs rendering everything every step. The number on the page is that count — reproducible, no LLM judge.' } },
        { '@type': 'Question', name: 'Can a node spend past its budget?', acceptedAnswer: { '@type': 'Answer', text: 'No. The budget wall is enforced in the gated kernel — no capability, no signature, no caller can raise the ceiling a kard was minted with. Selling kards or skins waits behind counsel.' } },
      ],
    },
  ],
};

tmpl = tmpl.replace('<!--SCHEMA-->', '<script type="application/ld+json">\n' + JSON.stringify(schema, null, 2) + '\n</script>');
tmpl = tmpl.replace('<!--WEAVE_CARDS-->', weaveHtml);
tmpl = tmpl.replace('//<!--KERNEL_AND_UI-->', kard + '\n\n/* ── flow.mjs ── */\n' + flow + '\n\n/* ── UI ── */\n' + ui);

writeFileSync(new URL('./index.html', import.meta.url), tmpl);
console.log('index.html written · kard', kard.length, '· flow', flow.length, '· ui', ui.length, '· total', tmpl.length, 'bytes');
