---
name: build-from-plan
description: Use when an md-reader sub-phase plan has Status planned and its tasks need implementing — auto-chained stage 4. Spawns one builder subagent per task to keep coordinator context flat. Auto-chains into review-before-ship. Do NOT design or re-scope here.
---

# Build From Plan

Execute one sub-phase plan by **delegating each task to a fresh `builder` subagent**, and keep your own context flat while doing it — stage 4 of the auto-chained pipeline.

You are the coordinator. You implement nothing yourself.

## Your context budget — this is the reason the skill works this way

1. **Never `Read` a file under `packages/` or `apps/`.** Not to check, not to verify, not "quickly". Need code truth? Spawn `guard` (haiku) with one specific question.
2. Read only: the plan file, and subagent reports.
3. Never run the full test suite — the builder runs its own task's test, `review-before-ship` runs the suite.
4. Never run a full `git diff`. `git diff --stat` only.
5. A subagent report over its line limit is that agent's failure — ask it to compress, do not absorb it.

Violating these is not a style slip; it is how the coordinator's window fills up and the run dies mid-sub-phase.

## Procedure

1. **Load the plan file** — path passed in, or ask. Read `Status:`.
2. **Gate check:** proceed only on `planned` (first run), `building` (resuming), or `built` (returning from `review-before-ship` with blockers). Anything else — stop and report.
3. **Set `Status: building`** on first run. If returning from a blocker, first uncheck the boxes for exactly the tasks the review named — those get redone.
4. **Confirm the sub-phase branch is checked out** (`BranchPoint:` in the plan names it). If not, check it out.
5. **For each unchecked task, in plan order:**
   a. Spawn a subagent — `subagent_type: "builder"`, `model: "sonnet"` (`spiker` for a `SPIKE` task) — passing the task's envelope **verbatim from the plan**. Do not summarize it, do not add context from your own head, do not tell it to read `DESIGN.md`.
   b. Wait for its ≤30-line report.
   c. `DONE` → verify the report contains real test output with real counts. Tick the task's box, append its `NOTES` to a running handoff block in the plan, report the task to the user in one line.
   d. `BLOCKED` → **stop the run.** A block means the plan is wrong (usually a missing path in `FILES`). Report which task, the reason, and what the plan needs. Do not fix it by loosening the builder's limits; do not do the task yourself.
   e. Tasks sharing a `parallel-group` may be spawned together in one message — only those.
6. **`SPIKE` tasks**: write the `spiker`'s evidence table and answer back into the plan, and into `docs/DESIGN.md` if it settles a documented risk. Then tick the box. An unrun spike may never be marked done.
7. **When every box is ticked**, set `Status: built`, report in one line, then **auto-chain**: invoke `Skill` with `skill: review-before-ship`, passing the plan path.

## Self-check

- Every envelope you sent was copied from the plan, not paraphrased.
- Every `model:` was pinned explicitly — never left to default to yours.
- No task was ticked without real failing-then-passing output in its report.
- You did not read a single source file this whole run.
