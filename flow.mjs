// FallKard — the open-flow + the measured cheap-run kernel.
//
// OPEN: opening a verified kard, on a node that holds its required capabilities, yields an instantiation
// plan — which structure to build, which skin to render it in. (The structure is rendered by the reused
// Konomi Skins renderer; the memory loads from the node's own store; this kernel decides WHAT opens.)
//
// CHEAP: two mechanisms, and a REAL counted measurement of them — not a claim.
//   · render-on-observation: render only the components currently in view, not the whole structure.
//   · state-recycling: when a component is already rendered and still in view, keep it — do not re-render.
// runCost counts render operations over a real usage sequence WITH both vs WITHOUT (render everything,
// every step); cheapVerdict reports the measured saving and WIN / LEARN. The numbers come from counting
// what actually happens, so anyone re-running the same sequence gets the same verdict.
//
// No I/O. Pure and total: garbage in -> { ok:false, why }, never a throw.

import { verifyKard, canOpen } from './kard.mjs';

const isStr = (v) => typeof v === 'string';
const isArr = (v) => Array.isArray(v);

export const MAX_COMPONENTS = 2000;
export const MAX_STEPS = 5000;

/** openKard(kard, node) — the open-flow: a valid kard opened by a capable node yields its instantiation
 *  plan. Refuses a tampered kard or a node that lacks the kard's required capabilities. */
export function openKard(kard, node) {
  const v = verifyKard(kard);
  if (!v.ok) return { ok: false, why: v.why };
  if (!v.valid) return { ok: true, opened: false, why: 'the kard is not valid: ' + v.why };
  const c = canOpen(kard, node);
  if (!c.ok) return { ok: false, why: c.why };
  if (!c.canOpen) return { ok: true, opened: false, missing: c.missing, why: c.why };
  return {
    ok: true,
    opened: true,
    node: { owner: kard.owner, structureRef: kard.structureRef, skinRef: kard.skinRef, budgetCap: kard.budgetCap },
    why: 'node instantiated — build ' + kard.structureRef + ' in ' + kard.skinRef,
  };
}

// ── the cheap-run measurement (render-on-observation + state-recycling), counted ───────────────────
function validSequence(componentIds, steps) {
  if (!isArr(componentIds) || componentIds.length === 0) return { ok: false, why: 'componentIds must be a non-empty array' };
  if (componentIds.length > MAX_COMPONENTS) return { ok: false, why: 'more than ' + MAX_COMPONENTS + ' components' };
  const known = new Set();
  for (const [i, id] of componentIds.entries()) {
    if (!isStr(id) || id.length === 0) return { ok: false, why: 'component id ' + i + ' must be a non-empty string' };
    if (known.has(id)) return { ok: false, why: 'duplicate component id: ' + id };
    known.add(id);
  }
  if (!isArr(steps) || steps.length === 0) return { ok: false, why: 'steps must be a non-empty array of visible-id lists' };
  if (steps.length > MAX_STEPS) return { ok: false, why: 'more than ' + MAX_STEPS + ' steps' };
  for (const [i, step] of steps.entries()) {
    if (!isArr(step)) return { ok: false, why: 'step ' + i + ' must be an array of visible component ids' };
    for (const id of step) {
      if (!known.has(id)) return { ok: false, why: 'step ' + i + ' references unknown component ' + id };
    }
  }
  return { ok: true, known };
}

/** runCost(componentIds, steps, mode) — count render operations over a usage sequence.
 *  steps[i] = the ids visible at step i.
 *  mode 'full'         : render every component every step (no POV, no recycling).
 *  mode 'pov+recycle'  : render a component at a step only if it is visible AND was not already rendered
 *                        and still-held from the previous step (a component leaving view drops its hold). */
export function runCost(componentIds, steps, mode) {
  const v = validSequence(componentIds, steps);
  if (!v.ok) return { ok: false, why: v.why };
  if (mode !== 'full' && mode !== 'pov+recycle') return { ok: false, why: "mode must be 'full' or 'pov+recycle'" };
  const total = componentIds.length;
  if (mode === 'full') {
    return { ok: true, ops: total * steps.length, mode, steps: steps.length };
  }
  let ops = 0;
  let held = new Set();
  for (const step of steps) {
    const visible = new Set(step);
    const nextHeld = new Set();
    for (const id of visible) {
      if (!held.has(id)) ops += 1; // render only the newly-visible-and-not-held
      nextHeld.add(id);            // now rendered and held while it stays in view
    }
    held = nextHeld;               // components no longer visible drop their hold (must re-render if they return)
  }
  return { ok: true, ops, mode, steps: steps.length };
}

/** cheapVerdict(componentIds, steps) — the measured with-vs-without result. */
export function cheapVerdict(componentIds, steps) {
  const full = runCost(componentIds, steps, 'full');
  if (!full.ok) return { ok: false, why: full.why };
  const cheap = runCost(componentIds, steps, 'pov+recycle');
  if (!cheap.ok) return { ok: false, why: cheap.why };
  const savedPct = full.ops === 0 ? 0 : Math.round(((full.ops - cheap.ops) / full.ops) * 1000) / 10;
  const cheaper = cheap.ops < full.ops;
  return {
    ok: true,
    full: full.ops,
    cheap: cheap.ops,
    savedPct,
    verdict: cheaper ? 'WIN' : 'LEARN',
    why: cheaper
      ? 'measured ' + savedPct + '% fewer render operations rendering only what is in view and holding it while it stays'
      : 'no measured saving on this sequence — the overhead did not net out',
  };
}
