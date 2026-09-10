---
name: review-before-ship
description: Use when an md-reader sub-phase plan has Status built and needs verification before merging into the phase branch — auto-chained stage 5, and the pipeline's ONLY stop-and-ask point. Loops back to plan-from-design for the next sub-phase, or chains to ship-and-handover when the phase is done. Do NOT fix what you find.
---

# Review Before Ship

Verify one built sub-phase is actually ready to merge: real test runs, mechanical guards, and a delegated code review — stage 5, and the pipeline's one deliberate stop point. You gate; you do not fix.

## Your context budget

Same rules as stage 4: **do not read source files, do not read the full diff.** The `reviewer` subagent holds the diff so you don't have to. You hold test counts and two short reports.

## Procedure

1. **Load the plan file** — path passed in, or ask. Read `Status:`, `Phase:`, `Sub-phase:`, `BranchPoint:`.
2. **Gate check:** if `Status:` is not `built`, stop and report it.
3. **Run the test suite** for every workspace this sub-phase touched, of those that exist:
   `pnpm --filter core test` · `pnpm --filter ui test` · `pnpm --filter extension test`
   Paste the actual pass/fail counts. Never state a count you did not just observe.
4. **Run typecheck and build**: `pnpm -r typecheck`, `pnpm -r build`. A green suite over code that does not build is not green.
5. **Compare counts against what the builders claimed** per task. Mismatch is a blocker.
6. **Spawn `guard`** (`model: "haiku"`) for the mechanical checks: forbidden imports, content-script bundle size against the 61440-byte budget, Y.Doc schema migration presence. Give it the branch point and the changed-file list.
7. **Spawn `reviewer`** (`model: "sonnet"`) with the sub-phase id, the branch name and the `BranchPoint:` SHA. It returns ≤40 lines of findings. Do not fetch the diff yourself to double-check it.
8. **Decide:**
   - Tests green **and** build green **and** `guard` PASS **and** no `CONFIRMED` correctness finding →
     a. Set `Status: reviewed`.
     b. `git checkout phase-<n>` and `git merge --no-ff` the sub-phase branch.
     c. Mark the sub-phase `done` in the spec's `## Sub-phase queue`.
     d. **Loop or finish:** if the queue still has a `pending` entry, invoke `Skill` with `skill: plan-from-design`, passing the spec path and that next sub-phase id. Otherwise invoke `Skill` with `skill: ship-and-handover`, passing the spec path.
   - Otherwise → leave `Status: built`, do **not** merge, list every blocker explicitly, and **stop here — this is the pipeline's one deliberate halt.** Do not fix anything, do not auto-chain. Tell the user that re-running `build-from-plan` on this same plan file is how it resumes once they have decided how to address the blockers.

## What counts as a blocker

- Any test failure, typecheck error or build failure.
- Any `guard` FAIL — a boundary violation or bundle overrun is a hard blocker, not a suggestion.
- Any `CONFIRMED` correctness finding from `reviewer`.
- A test count that contradicts what a builder reported.

A `SUSPECTED` finding is not a blocker on its own. Report it and let the user decide.

## Self-check

- Every test count quoted came from a command run in this session.
- You did not read the diff yourself.
- Every `model:` was pinned explicitly.
