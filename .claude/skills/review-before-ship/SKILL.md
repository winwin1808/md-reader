---
name: review-before-ship
description: Use when an md-reader implementation plan has Status built and needs verification (full test suite + boundary check + scoped code review) before shipping — auto-chained stage 5 of the intent→design→plan→build→review→ship pipeline, and the pipeline's ONLY stop-and-ask point (only when a real blocker is found). Do NOT use to fix bugs found — report them and hand back to build-from-plan.
---

# Review Before Ship

Verify a built md-reader change is actually ready to ship: real test runs, not assertions, plus an architecture-boundary check and a scoped code review — stage 5 of the auto-chained pipeline, and its one deliberate stop point. You gate; you do not fix.

## Procedure

1. **Load the plan file** — use the path passed in, or ask if not given. Read the `Status:` line.
2. **Gate check:** if `Status:` is not `built`, stop and report the current status.
3. **Run the full test suite for every workspace touched by the plan**, at minimum those that exist:
   - `pnpm --filter core test`
   - `pnpm --filter ui test`
   - `pnpm --filter extension test`
   Paste the actual pass/fail counts from the command output — never state a count you did not just observe.
4. **Run typecheck and build** (`pnpm -r typecheck`, `pnpm -r build`, or the repo's current equivalent). A green test run over code that does not build is not green.
5. **Compare counts against what `build-from-plan` claimed** for each task; if they don't match, treat as a blocker.
6. **Boundary check — blocker if violated.** Grep the diff for forbidden imports:
   - `packages/core` importing `react`, `chrome.*`, or touching `document`/`window`
   - `packages/ui` importing `chrome.*`
   - anything importing across packages by relative path instead of the workspace package name
7. **Scoped code review** of the diff introduced by this plan (`git diff` against the branch point): check correctness (logic errors, unhandled edge cases actually reachable from the plan's stated inputs) and simplification/reuse (duplicated logic, dead code, opportunities to use something already in `packages/core`). Report findings, most severe first, each naming an exact file and line.
8. **Decide:**
   - All tests green, build green, no boundary violation, AND no unresolved correctness finding → set the plan's `Status:` to `reviewed`, report that in one line, then **auto-chain**: immediately invoke the `Skill` tool with `skill: ship-and-handover`, passing this plan's path.
   - Otherwise → leave `Status: built`, list every blocker explicitly, and **stop here — this is the pipeline's one deliberate halt**. Do not attempt fixes yourself, do not auto-chain. Tell the user the pipeline is paused and that re-running `build-from-plan` on this same plan file (still `Status: built`) is how it resumes once they've decided how to address the blockers.

## Self-check

- Every test count quoted came from a command actually run in this session.
- Every finding names the exact file and line.
