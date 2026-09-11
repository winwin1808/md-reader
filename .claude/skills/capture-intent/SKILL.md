---
name: capture-intent
description: Use when a new PHASE of md-reader is starting and needs an intent document, kicking off the auto-chained pipeline. Runs once per phase (not per sub-phase). Do NOT use to start a sub-phase — that's plan-from-design; do NOT use for design or implementation on their own.
---

# Capture Intent

Turn a phase of md-reader into an `intent.md` file — stage 1 of this repo's auto-chained SDLC pipeline (stage 0, `brainstorm-intent`, is optional and only runs when the idea started out rough). This is one of two stages that need your human partner's actual input (the other is `brainstorm-intent`); every stage after this runs automatically in this same session until `ship-and-handover` finishes or `review-before-ship` hits a blocker.

**Runs once per phase.** Sub-phases do not get their own intent — they are enumerated in `docs/DESIGN.md` §4 and are picked up by `plan-from-design` one at a time.

## If called with a brainstorm file path

`brainstorm-intent` may hand you the path to an already-approved
`*-brainstorm.md` file. When that happens:

- Read it first. Its "Hướng đề xuất" (recommended direction) becomes the
  starting point for **Proposed outcome**; its "Nhu cầu người dùng" and
  research inform **Problem**.
- Skip re-asking anything the brainstorm file already answers clearly. Only
  ask about what's still missing or ambiguous — usually **Affected
  packages**, **Constraints**, and confirming the sub-phase list.
- Still confirm the phase number and sub-phase list back to your partner
  (step 2 below) — that check doesn't get skipped.

When called without a brainstorm file (the normal case), proceed as below.

## Procedure

1. **Read `docs/DESIGN.md` §4** — the phase table and its sub-phase table. This is the authority on what the phase contains. `CLAUDE.md` is only a summary.
2. **Ask which phase** (1-6). Confirm back the sub-phase list from §4 and ask whether it still looks right — this is your partner's chance to re-cut it before any work happens.
3. **Fill each section**, asking one question at a time for anything the brainstorm file (if any) didn't already answer:
   - **Problem** — what's missing today, in the user's own words.
   - **Proposed outcome** — what "shipped" looks like for this phase, from a user's point of view.
   - **Affected packages** — which of `packages/core`, `packages/ui`, `apps/extension` (later `apps/api`, `apps/web`).
   - **Constraints** — anything beyond what `DESIGN.md` already locks. The locked constraints always apply; only record *additions* here.
   - **Open questions** — fine to leave items; stage 2 resolves them.
4. **Create the phase branch**: `git checkout -b phase-<n>` from `main`. If it already exists, check it out and say so.
5. **Write the file** to `docs/superpowers/intent/YYYY-MM-DD-phase-<n>-<slug>.md`:

```markdown
# Intent: Phase <n> — <phase name>
Author: <name>. Status: draft. Phase: <n>

## Problem
## Proposed outcome
## Affected packages
## Constraints
## Open questions

## Sub-phases
<the table from DESIGN.md §4, as confirmed in step 2>
```

6. **Auto-chain.** Report the intent path in one line, then immediately invoke `Skill` with `skill: design-from-intent`, passing this file's path. Do not wait for another message.

## Self-check before writing

- Every section has real content — nothing left as "TBD".
- The `Sub-phases` table matches `DESIGN.md` §4 (or the correction agreed in step 2 — in which case say that DESIGN.md needs updating too, and do it).
- `Status: draft` and `Phase: <n>` present exactly as shown.
