import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openKard, runCost, cheapVerdict, MAX_COMPONENTS, MAX_STEPS } from './flow.mjs';
import { mintKard } from './kard.mjs';

const OWNER = 'ab'.repeat(32);
function kard(caps = ['render:structure', 'load:memory']) {
  return mintKard({
    owner: OWNER, skinRef: 'skin:cozy@1', structureRef: 'struct:workspace@1',
    capabilities: caps, budgetCap: 100, createdAt: '2026-09-26T00:00:00Z',
  }).kard;
}

// ── openKard ─────────────────────────────────────────────────────────────────────────────────────
test('openKard instantiates a node when the opener holds the required capabilities', () => {
  const r = openKard(kard(['render:structure']), { capabilities: ['render:structure', 'net:none'] });
  assert.equal(r.ok, true);
  assert.equal(r.opened, true);
  assert.equal(r.node.structureRef, 'struct:workspace@1');
  assert.equal(r.node.skinRef, 'skin:cozy@1');
  assert.equal(r.node.owner, OWNER);
});
test('openKard refuses a node missing a required capability, naming it', () => {
  const r = openKard(kard(['render:structure', 'load:memory']), { capabilities: ['render:structure'] });
  assert.equal(r.opened, false);
  assert.deepEqual(r.missing, ['load:memory']);
});
test('openKard refuses a tampered (invalid) kard', () => {
  const tampered = { ...kard(), budgetCap: 999999 };
  assert.equal(openKard(tampered, { capabilities: ['render:structure', 'load:memory'] }).opened, false);
});
test('openKard refuses a malformed node', () => {
  assert.equal(openKard(kard(), null).ok, false);
});

// ── runCost 'full' ──────────────────────────────────────────────────────────────────────────────
test("runCost 'full' renders every component every step", () => {
  const r = runCost(['a', 'b', 'c'], [['a'], ['b', 'c'], []], 'full');
  assert.equal(r.ok, true);
  assert.equal(r.ops, 9); // 3 components × 3 steps
  assert.equal(r.steps, 3);
});

// ── runCost 'pov+recycle' — the counted mechanism ─────────────────────────────────────────────────
test("runCost 'pov+recycle' renders only newly-visible-and-not-held components", () => {
  // steps: {a,b} -> {b,c} -> {a} : render a,b (2) ; c new (1) ; a returned+dropped (1) = 4
  const r = runCost(['a', 'b', 'c'], [['a', 'b'], ['b', 'c'], ['a']], 'pov+recycle');
  assert.equal(r.ops, 4);
});
test("pov+recycle holds a component across steps while it stays in view (no re-render)", () => {
  // {a} -> {a} -> {a} : render once, held thereafter = 1
  assert.equal(runCost(['a', 'b'], [['a'], ['a'], ['a']], 'pov+recycle').ops, 1);
});
test("pov+recycle DROPS the hold when a component leaves view, so its return re-renders", () => {
  // {a} -> {b} -> {a} : a(1), b(1), a-returned-after-leaving(1) = 3  (NOT 2 — the hold was dropped)
  assert.equal(runCost(['a', 'b'], [['a'], ['b'], ['a']], 'pov+recycle').ops, 3);
});
test('runCost refuses a bad mode and malformed sequences', () => {
  assert.equal(runCost(['a'], [['a']], 'nope').ok, false);
  assert.equal(runCost([], [['a']], 'full').ok, false);
  assert.equal(runCost(['a', 'a'], [['a']], 'full').ok, false);      // dup id
  assert.equal(runCost(['a'], [], 'full').ok, false);                 // no steps
  assert.equal(runCost(['a'], ['a'], 'full').ok, false);             // step not an array
  assert.equal(runCost(['a'], [['b']], 'full').ok, false);           // unknown id in a step
  assert.equal(runCost([''], [['']], 'full').ok, false);             // empty id
  assert.equal(runCost(null, [['a']], 'full').ok, false);            // componentIds not an array (stays total)
  assert.equal(runCost('x', [['a']], 'full').ok, false);
  assert.equal(runCost(['a'], null, 'full').ok, false);              // steps not an array
});
test('runCost boundary: exactly MAX_COMPONENTS / MAX_STEPS accepted', () => {
  const comps = Array.from({ length: MAX_COMPONENTS }, (_, i) => 'c' + i);
  assert.equal(runCost(comps, [[]], 'full').ok, true);
  const steps = Array.from({ length: MAX_STEPS }, () => []);
  assert.equal(runCost(['a'], steps, 'full').ok, true);
});

// ── cheapVerdict — the measured with-vs-without ───────────────────────────────────────────────────
test('cheapVerdict reports the measured saving and WIN when pov+recycle is cheaper', () => {
  const v = cheapVerdict(['a', 'b', 'c'], [['a', 'b'], ['b', 'c'], ['a']]);
  assert.equal(v.ok, true);
  assert.equal(v.full, 9);
  assert.equal(v.cheap, 4);
  assert.equal(v.savedPct, 55.6);
  assert.equal(v.verdict, 'WIN');
});
test('cheapVerdict reports LEARN honestly when there is no saving', () => {
  // one step, everything visible: full = cheap = 2 → no saving
  const v = cheapVerdict(['a', 'b'], [['a', 'b']]);
  assert.equal(v.full, 2);
  assert.equal(v.cheap, 2);
  assert.equal(v.savedPct, 0);
  assert.equal(v.verdict, 'LEARN');
});
test('cheapVerdict propagates a malformed sequence as not-ok', () => {
  assert.equal(cheapVerdict([], [['a']]).ok, false);
});
