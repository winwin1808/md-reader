---
name: capture-intent
description: Use when a new phase, feature, or piece of infra work for md-reader needs to be captured as a starting-point intent document, kicking off the full auto-chained intent→design→plan→build→review→ship pipeline. Do NOT use for design (use design-from-intent directly), planning, or implementation on their own — this skill captures the problem then auto-chains into design-from-intent.
---

# Capture Intent

Turn a raw idea for md-reader into an `intent.md` file — stage 1 of this repo's auto-chained SDLC pipeline. This is the only stage that needs your human partner's actual input; every stage after this one runs automatically in this same session, no subagents, no parallelism — one skill invoking the next in sequence until `ship-and-handover` finishes or `review-before-ship` hits a blocker.

## Procedure

1. **Read `CLAUDE.md` first** — the locked architecture and the phase table live there. Everything captured here must fit inside one phase.
2. **Ask which phase this belongs to** (1 Core view / 2 Export / 3 Presentation / 4 Mindmap+Excalidraw / 5 Edit / 6 Share & collab), and **ask for the topic** — a short kebab-case slug (e.g. `core-viewer-and-theme`). The slug becomes the filename.
3. **Fill each section one question at a time** — do not ask multiple sections in one message:
   - **Problem** — what's broken or missing today, in the user's own words.
   - **Proposed outcome** — what "solved" looks like, not how to build it.
   - **Affected packages** — which of `packages/core`, `packages/ui`, `apps/extension` (or a later `apps/api`, `apps/web`) it touches.
   - **Constraints** — anything that must hold (deadline, compatibility, must not touch X). The locked architecture in `CLAUDE.md` is always a constraint; only record additions here.
   - **Open questions** — anything still unresolved; it's fine to leave items here.
4. **Write the file** to `docs/superpowers/intent/YYYY-MM-DD-<topic>.md`:

```markdown
# Intent: <topic>
Author: <name>. Status: draft. Phase: <n> — <phase name>

## Problem
<answer>

## Proposed outcome
<answer>

## Affected packages
<answer>

## Constraints
<answer>

## Open questions
<answer, or "None">
```

5. **Auto-chain.** Tell the user the intent file path in one line, then immediately invoke the `Skill` tool with `skill: design-from-intent`, passing this intent file's path. Do not wait for a further message — the pipeline continues automatically from here.

## Self-check before writing the file

- Every section has real content — no section left as `<answer>` or "TBD".
- `Status: draft` and a `Phase:` are present in the header exactly as shown.
- Nothing captured belongs to a later phase — if it does, say so and leave it out.
- Filename date is today's date (YYYY-MM-DD), slug is kebab-case and matches the topic.
