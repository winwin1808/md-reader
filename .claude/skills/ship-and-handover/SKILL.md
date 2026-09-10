---
name: ship-and-handover
description: Use when every sub-phase of an md-reader phase is done and the phase branch is ready to become an MR — stage 6, the terminal stage of the auto-chain. Opens the MR, reconciles CLAUDE.md Status and docs/SESSION_HANDOVER.md. Do NOT merge the MR yourself.
---

# Ship And Handover

Close out a **phase**: open its MR and reconcile the two living state documents so the next session starts accurate. Stage 6 — terminal; nothing invokes another skill after this. You do not re-run tests or re-review; that happened per sub-phase.

## Procedure

1. **Load the spec file** — path passed in, or ask. Read `Phase:` and the `## Sub-phase queue`.
2. **Gate check:** every sub-phase in the queue must read `done`. If any is not, stop and name it.
3. **Verify the phase branch state**: `git log --oneline main..phase-<n>` and `git status`. Nothing uncommitted should remain. Commit anything left in this repo's style (`type(scope): summary`).
4. **Open the MR** for `phase-<n>` → `main` (`gh pr create`, or report the exact command if `gh` is unavailable). Title: `Phase <n> — <phase name>`. Body: what shipped per sub-phase, final test counts, and anything deliberately deferred.
   **Do not merge it.** Merging is the human's decision.
5. **Update `CLAUDE.md`'s `## Status`**: add a dated line — what phase shipped, what is now true, what is still open — in the same terse style as existing entries. Name the next phase. Never touch the locked-constraint sections; changing those is its own intent.
6. **Update `docs/DESIGN.md`** only if a sub-phase settled something the document still records as unknown (a spike answer, a re-cut sub-phase list). Nothing else.
7. **Update `docs/SESSION_HANDOVER.md`**: what shipped, current test counts, the MR link, what the next session picks up, what is now stale.
8. **Set the spec's `Status:` to `shipped`.**
9. **Report the full pipeline summary**: intent → spec → each sub-phase plan → MR link. Confirm the living docs are reconciled. Stop — invoke nothing further.

## Self-check

- `CLAUDE.md` Status and `docs/SESSION_HANDOVER.md` do not contradict each other after the edit.
- The MR actually contains the commits being described — verify with `git log --oneline main..phase-<n>` before claiming done.
- The locked sections of `DESIGN.md` and `CLAUDE.md` are unchanged unless an intent explicitly changed them.
- The MR is open, not merged.
