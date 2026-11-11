# FallKard

**Live:** https://sjgant80-hub.github.io/sovereign-node/

The one entry point that weaves the FallForge estate into a single flow — the sovereign node, made
personal and cheap.

**Open a kard → become a sovereign node → run cheap → join the mesh.** A kard is you-as-a-system: a
portable, signed identity carrying your structure, your skin, your capabilities and an *uncrossable
budget*. Open it and your own node instantiates — your structure, your look, your memory, on your metal.

Everything in the estate is an organ of this flow: the trust rail (kar-hub) runs underneath; the kard is
the spine; each stage opens its own live organ. The page runs client-side; nothing is sent anywhere.

## The spine is real, and gated
The page inlines two witness-gated kernels (kernel-backed: the logic you see run is the logic the gate proves):
- **`kard.mjs`** — `mintKard` / `attachSignature` (self-sovereign Ed25519 — only the identity a kard names can sign it) / `verifyKard` / `canOpen` / **`spendGate`** (the uncrossable budget wall). Witness **54/55**, 1 argued equivalent.
- **`flow.mjs`** — `openKard` + **`cheapVerdict`**, which *counts* render operations over a real usage path (render-on-observation + state-recycling) with vs without. Cheap is measured, not claimed. Witness **15/15**.

CI re-runs both test suites, both mutation gates, and the page fixpoint on GitHub's runner.

## Honest scope
The budget wall is real and enforced. Selling kards or skins waits behind counsel. Full node-to-node
mesh federation is the next layer being built on top.

## Provenance & credit
**Konomi** (the structure system) — **Thomas Frumkin**. The estate's mind and cost model build on the
**Generalized Entropy Principle (GEP)** — **Gary W. Floyd**, Lumiea Systems Research Division /
ThunderStruck Service LLC. Built by **Kar** for AI Native Solutions.
