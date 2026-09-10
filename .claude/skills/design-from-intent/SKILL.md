---
name: design-from-intent
description: Use when an md-reader phase intent (from capture-intent) is ready to become a phase design spec — auto-chained stage 2. Runs once per phase, covering all its sub-phases. Resolves open questions itself and auto-chains into plan-from-design for the FIRST sub-phase.
---

# Design From Intent

Turn a phase intent into a written design spec covering **all sub-phases of that phase** — stage 2 of the auto-chained pipeline. You decide the approach yourself and keep moving; you do not stop for section-by-section approval. You do not write code or task plans.

**Run this in the main loop, not a subagent.** You need all of `DESIGN.md` in context to avoid breaking a locked constraint — that is the work, not overhead to delegate away.

## Procedure

1. **Load the intent file** — path passed in, or ask. Read `Status:` and `Phase:`.
2. **Gate check:** if `Status:` is not `draft` or `ready-for-design`, stop and report the current status.
3. **Read `docs/DESIGN.md` in full.** §2 (locked architecture), §4 (this phase's sub-phases), §5 (risks), §7 (agent/context model). Design *within* these. If the intent genuinely cannot be satisfied without breaking one, do not quietly break it — stop, name the conflicting constraint, and ask.
4. **Resolve every open question yourself.** Make the most plausible call from the intent's problem/outcome/constraints, and record it as a stated assumption in the spec. Do not block on asking.
5. **Consider 2-3 approaches internally**, pick one, write directly in it.
6. **Write one design section per sub-phase**, each covering: what it builds, exact interfaces it produces (names and types — later sub-phases will consume these verbatim), what it consumes from earlier sub-phases, error handling, and what its tests must prove. State which package each piece lands in and why that respects §2.4.
7. **Check each sub-phase against the §4 sizing rule** (≤5 files, ≤300 diff lines, ≤1 new test file). Any sub-phase that clearly exceeds it must be split here, in the spec, and `DESIGN.md` §4 updated to match. Do not push an oversized sub-phase downstream — it will blow the context budget in `build-from-plan`.
8. **Write the spec** to `docs/superpowers/specs/YYYY-MM-DD-phase-<n>-design.md`:
   - Header: `Author: <name>. Status: designed. Phase: <n>`
   - `Intent: docs/superpowers/intent/<file>.md`
   - A `## Sub-phase queue` list with a status per sub-phase, all starting `pending`. This list is what drives the loop in later stages.
   - An `## Approach chosen` note naming the 1-2 alternatives rejected and why.
9. **Update the intent file**: `Status: designed`, add `Design: docs/superpowers/specs/<file>.md`.
10. **Self-review**: no placeholders, no contradictions, no ambiguous requirement left un-picked, no interface named two different ways in two sections.
11. **Auto-chain.** Report the spec path in one line, then invoke `Skill` with `skill: plan-from-design`, passing the spec path and the **first `pending` sub-phase id**.

## Self-check before writing

- Every decision traces to the intent or to `DESIGN.md` — not invented past them.
- No component sits in a package that would force a forbidden import (§2.4).
- Interfaces are written as real signatures, not prose descriptions.
- `Status:` reads exactly `designed`.
