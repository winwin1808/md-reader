---
name: build-from-plan
description: Use when an md-reader implementation plan (from plan-from-design) has Status planned and its tasks need to be implemented with TDD — auto-chained stage 4 of the intent→design→plan→build→review→ship pipeline. Auto-chains into review-before-ship. Do NOT use to design or plan — only to execute an already-written plan task-by-task.
---

# Build From Plan

Execute an md-reader implementation plan task-by-task with TDD — stage 4 of the auto-chained pipeline. You implement exactly what the plan specifies — you do not redesign or re-scope.

## Procedure

1. **Load the plan file** — use the path passed in, or ask if not given. Read the `Status:` line.
2. **Gate check:** if `Status:` is not `planned` (first run), `building` (resuming mid-run), or `built` (resuming after `review-before-ship` sent it back with blockers — see step 3), stop and report the current status.
3. **Set `Status: building`** on first run (skip if already `building`). If resuming from `built` because of a blocker, first uncheck the box(es) for the task(s) the blocker report named — those are the ones to redo — before continuing.
4. **For each unchecked task, in order:**
   a. Write the failing test(s) exactly as specified in the task.
   b. Run the task's test command; confirm it fails for the stated reason.
   c. Write the minimal implementation to pass.
   d. Run the test command again; confirm it passes — paste the real output, never assert without it.
   e. Commit using the message given in the task (or a conventional equivalent if none given).
   f. Check the task's box in the plan file.
   g. Report the task as done before moving to the next one — this is a checkpoint, not a silent batch.
5. **For a task marked `SPIKE`**: run the probe, paste the real observed output, write the answer back into the plan file under that task, check its box, and report it. No test is required, but an unrun spike may never be marked done.
6. **When every task is checked**, set the plan's `Status:` to `built`, report that in one line, then **auto-chain**: immediately invoke the `Skill` tool with `skill: review-before-ship`, passing this plan's path.

## Self-check per task

- The test written in step (a) actually exercises the behavior the task describes, not a trivial always-pass assertion.
- No task is marked done without both a failing-then-passing run actually observed in this session.
- No import added crosses a package boundary `CLAUDE.md` forbids. If the task as written cannot be done without crossing one, stop and report it as a blocker rather than crossing it.
