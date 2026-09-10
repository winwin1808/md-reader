---
name: ship-and-handover
description: Use when an md-reader implementation plan has Status reviewed and is ready to ship — commits, updates CLAUDE.md's Status section and docs/SESSION_HANDOVER.md. This is stage 6, the terminal stage of the intent→design→plan→build→review→ship auto-chain pipeline. Do NOT use before review-before-ship has set Status to reviewed.
---

# Ship And Handover

Close out an md-reader change: commit, and reconcile the two living state documents (`CLAUDE.md`'s `## Status` section, `docs/SESSION_HANDOVER.md`) so the next session starts accurate. Stage 6 — the terminal stage of the auto-chained pipeline; nothing invokes another skill after this. You do not re-run tests or re-review — that already happened.

## Procedure

1. **Load the plan file** — use the path passed in, or ask if not given. Read the `Status:` and `Phase:` lines.
2. **Gate check:** if `Status:` is not `reviewed`, stop and report the current status.
3. **Commit any remaining uncommitted changes** from the build stage, following this repo's commit message style (`type(scope): summary`, e.g. `feat(core):`, `feat(ui):`, `docs:`).
4. **Update `CLAUDE.md`'s `## Status` section**: add a dated line describing what shipped, in the same terse style as the existing entries (what package, what's now true, what's still open). Do not rewrite unrelated parts of the file — in particular, never edit the locked-architecture sections here; a change to those is its own intent.
5. **If the phase is now complete**, say so explicitly in that Status line and name the next phase from the phase table.
6. **Update `docs/SESSION_HANDOVER.md`**: what shipped, current test counts, what the next session should pick up, and anything now stale in the handover doc.
7. **Set the plan's `Status:` to `shipped`.**
8. **Report the full pipeline summary**: intent path → spec path → plan path → final commit hash(es), confirm both living docs are reconciled, and state that the pipeline is complete. Stop — do not invoke any further skill.

## Self-check

- `CLAUDE.md`'s Status section and `docs/SESSION_HANDOVER.md` do not contradict each other after the edit.
- The commit(s) actually contain the changes being described as shipped — verify with `git show --stat` before claiming done.
- The locked-architecture sections of `CLAUDE.md` are byte-identical to before unless an intent explicitly changed them.
