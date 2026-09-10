---
name: design-from-intent
description: Use when an md-reader intent.md file (from capture-intent) is ready to become a design — auto-chained stage 2 of the intent→design→plan→build→review→ship pipeline. Picks the recommended approach itself (no per-section approval) and auto-chains into plan-from-design. Do NOT use if no intent.md exists yet (use capture-intent first), or once a spec already exists for this topic (use plan-from-design instead).
---

# Design From Intent

Turn an intent document into a written design spec for md-reader — stage 2 of the auto-chained pipeline. You decide the approach yourself and keep moving; you do not stop for section-by-section approval (that trade-off was chosen deliberately for pipeline speed — anyone reviewing later reads the spec's own written rationale). You do not write code or an implementation plan; that is `plan-from-design`'s job.

## Procedure

1. **Load the intent file** — use the path passed in, or ask if not given. Read the `Status:` and `Phase:` lines.
2. **Gate check:** if `Status:` is not `draft` or `ready-for-design`, stop and tell the user the current status and that this skill only runs on those two states.
3. **Re-read `CLAUDE.md`'s locked architecture.** The package boundaries, the parser choice, the doc-model/ops decision, the chart plan, the theme mechanism and the export mechanisms are already decided — design *within* them. If the intent genuinely cannot be satisfied without breaking one, do not quietly break it: stop, state which constraint is in conflict and why, and ask.
4. **Resolve open questions yourself** — for anything in the intent's `Open questions` section or otherwise unresolved, make the most plausible call given the intent's stated problem/outcome/constraints, and record the assumption in the spec's Open Questions section rather than asking. Do not block on asking the user.
5. **Consider 2-3 approaches internally**, pick the one you'd recommend, and write the spec directly in that approach — no back-and-forth.
6. **Write the design sections** (architecture, components, data flow, error handling, testing) at whatever depth the topic needs, without pausing for approval between them. State explicitly, per component, which package it lands in and why that respects the boundary rules.
7. **Write the spec** to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` (same `<topic>` slug as the intent file), following the structure Problem / Proposed outcome / sectioned design / Constraints / Open questions. Include a short "Approach chosen" note naming the 1-2 alternatives not picked and why, so a later human read still has that context.
   - Header: `Author: <name>. Status: designed. Phase: <n> — <phase name>`
   - Add a line under the header: `Intent: docs/superpowers/intent/<intent-filename>.md`
8. **Update the source intent file**: change its `Status:` to `designed`, add a line under its header: `Design: docs/superpowers/specs/<spec-filename>.md`.
9. **Self-review** the spec: no placeholders (TBD/TODO), no internal contradictions, focused enough for one implementation plan, no ambiguous requirement left un-picked.
10. **Auto-chain.** Report the spec path in one line, then immediately invoke the `Skill` tool with `skill: plan-from-design`, passing this spec's path. Do not wait for the user to review it first — the pipeline continues automatically.

## Self-check before writing the spec file

- Every design decision traces back to something stated in the intent file or in `CLAUDE.md` — not invented beyond them.
- No component is placed in a package that would force a forbidden import (`packages/core` never touches `chrome.*`, React or `document`; `packages/ui` never touches `chrome.*`).
- The spec's `Status:` line reads exactly `designed`.
- Both files (intent and spec) cross-reference each other's path.
