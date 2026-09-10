---
name: plan-from-design
description: Use when an md-reader design spec (from design-from-intent) is ready to become an ordered, task-by-task implementation plan — auto-chained stage 3 of the intent→design→plan→build→review→ship pipeline. Auto-chains into build-from-plan. Do NOT use if the spec's Status isn't designed/approved yet, or to write code directly — that's build-from-plan's job.
---

# Plan From Design

Turn a design spec into an ordered implementation plan for md-reader, following this repo's locked stack — stage 3 of the auto-chained pipeline. You break work into reviewable tasks — you do not write application code.

## Procedure

1. **Load the spec file** — use the path passed in, or ask if not given. Read the `Status:` and `Phase:` lines.
2. **Gate check:** if `Status:` is not `designed` or `approved`, stop and report the current status.
3. **Confirm the locked stack applies unchanged**: pnpm workspaces, Vite, React, TypeScript, Chrome MV3, vitest; `packages/core` (pure TS — no react, no `chrome.*`, no `document`), `packages/ui` (React, no `chrome.*`), `apps/extension` (the only layer that may use `chrome.*`). Parser is `unified`/`remark`. Doc model is CodeMirror 6 `ChangeSet` ops. Never propose a different stack, framework or parser.
4. **Phase gate:** every task must fall inside the spec's declared `Phase:`. If a task would only make sense together with a later phase's work, drop it and note it under a "Deferred to phase N" heading at the end of the plan — do not smuggle it in.
5. **Decompose into tasks** organized by which package each touches. A task may touch more than one package only when they must ship together — prefer splitting, and prefer `packages/core` tasks first so the interfaces the UI consumes already exist.
6. **For each task**, define: files to create/modify (exact paths), interfaces consumed/produced (exact names/types so later tasks can reference them), and a TDD step sequence (failing test → run to confirm fail → minimal implementation → run to confirm pass → commit). Name the exact test command (`pnpm --filter core test`, `--filter ui`, `--filter extension`).
7. **Spike tasks are exempt from TDD** but not from evidence: a task marked `SPIKE` states the question, what will be tried, and what observed output counts as the answer. Its result must be written back into the plan before any task that depends on it starts.
8. **Write the plan** to `docs/superpowers/plans/YYYY-MM-DD-<topic>-plan.md` (same `<topic>` slug), header: `Author: <name>. Status: planned. Phase: <n> — <phase name>`, with a `Spec: docs/superpowers/specs/<spec-filename>.md` line.
9. **Update the spec file**: change its `Status:` to `planned`.
10. **Self-review**: every spec requirement maps to a task (list gaps if any and fix), no placeholders, no type/signature drift between tasks.
11. **Auto-chain.** Report the plan path in one line, then immediately invoke the `Skill` tool with `skill: build-from-plan`, passing this plan's path. The pipeline continues automatically.

## Self-check before writing the plan file

- Every task lists exact file paths, not descriptions like "the relevant module".
- No step reads "add appropriate error handling" or "write tests for the above" without actual specifics.
- No task places code in a package that would force a forbidden import.
- No task belongs to a later phase.
- The plan's `Status:` line reads exactly `planned`.
