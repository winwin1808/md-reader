---
name: plan-from-design
description: Use when an md-reader phase spec is ready and the NEXT pending sub-phase needs an ordered task plan — auto-chained stage 3. Runs once per sub-phase, not per phase. Auto-chains into build-from-plan. Do NOT use to write code.
---

# Plan From Design

Turn **one sub-phase** of a phase spec into an ordered task plan — stage 3 of the auto-chained pipeline. You break work into agent-sized tasks; you do not write application code.

**Run this in the main loop.** Like stage 2, it needs the locked constraints in context.

## Procedure

1. **Load the spec file** and the sub-phase id — both passed in, or ask. If no id was passed, take the first `pending` entry in the spec's `## Sub-phase queue`.
2. **Gate check:** if the spec's `Status:` is not `designed`, `approved` or `in-progress`, stop and report it.
3. **Confirm the locked stack**: pnpm workspaces · Vite · React · TypeScript · Chrome MV3 · vitest · yjs + y-indexeddb (+ y-codemirror.next from phase 5) · unified/remark. `packages/core` pure TS (yjs allowed; no react / `chrome.*` / `document` / **no Yjs provider**), `packages/ui` React (no `chrome.*`), `apps/extension` the only `chrome.*` layer. Never propose a different stack, parser or CRDT.
4. **Create the sub-phase branch**: `git checkout -b phase-<n>/<sub-id>-<slug>` from `phase-<n>`. Record the branch point SHA in the plan — `review-before-ship` diffs against it.
5. **Decompose into tasks.** Every task must satisfy, or it gets split further:
   - ≤ 5 files touched
   - ≤ 300 lines expected diff
   - ≤ 1 new test file
   - one coherent behavior, testable on its own
   Prefer `packages/core` tasks first so the interfaces the UI consumes already exist.
6. **Scope gate:** nothing outside this sub-phase. Work that belongs to a later sub-phase goes under a `## Deferred` heading naming the sub-phase — never smuggled in.
7. **Write each task as a `builder` envelope**, ready to hand over verbatim. This is the core of the plan, not a summary of it:

```
### [ ] <id> — <title>
FILES       <exact paths, ≤5>
INTERFACES  <exact signatures consumed / produced>
INVARIANTS  <3-6 lines COPIED from DESIGN.md — the builder is forbidden from reading it>
TEST        <exact command, e.g. pnpm --filter core test src/doc/schema.test.ts>
COMMIT      <type(scope): summary>
```

   The `INVARIANTS` block is the whole point: it is what lets a builder run without loading `DESIGN.md`. Copy the 3-6 lines that actually bind this task. Generic boilerplate pasted into every task is a failure of this step.

8. **Mark parallel groups.** Default is sequential. Add `parallel-group: <name>` only to tasks that share no file and no interface — those are the only ones the coordinator may spawn together.
9. **Spike tasks** are exempt from TDD but not from evidence: a `SPIKE` task states the question, the probe, where the throwaway code lives, and what observed output counts as the answer. Its result must be written back into the plan (and into `DESIGN.md` if it settles a risk) before any dependent task starts.
10. **Write the plan** to `docs/superpowers/plans/YYYY-MM-DD-phase-<n>-<sub-id>-plan.md`, header: `Author: <name>. Status: planned. Phase: <n>. Sub-phase: <sub-id>`, plus `Spec:` and `BranchPoint:` lines.
11. **Update the spec**: set this sub-phase to `planned` in the `## Sub-phase queue`.
12. **Self-review**: every spec requirement for this sub-phase maps to a task; no placeholders; no signature drift between tasks; every task passes the size gate.
13. **Auto-chain.** Report the plan path in one line, then invoke `Skill` with `skill: build-from-plan`, passing the plan path.

## Self-check before writing

- Every task lists exact file paths, never "the relevant module".
- No step reads "add appropriate error handling" or "write tests for the above".
- Every `INVARIANTS` block is specific to its task.
- No task belongs to a later sub-phase.
- `Status:` reads exactly `planned`.
