---
name: brainstorm-intent
description: Use when a new PHASE of md-reader starts from a rough one-line idea that needs exploring, market research, and refining before it becomes a formal intent — stage 0 of the auto-chained pipeline, before capture-intent. Do NOT use for a sub-phase (that's plan-from-design) or when the phase's problem/outcome is already clear enough to fill intent.md directly — in that case call capture-intent straight away.
---

# Brainstorm Intent

Turn a rough idea for a new md-reader phase into a `brainstorm.md` file — stage
0 of this repo's auto-chained SDLC pipeline, one step before `capture-intent`.
This is the second (and last) stage that needs your human partner's actual
input; `capture-intent` is the other one.

**Runs once per phase, only when the idea is still rough.** If the phase's
problem/outcome is already clear, skip straight to `capture-intent`.

## Procedure

1. **Read `docs/DESIGN.md` §4** — the phase table, for context on what phase
   this idea belongs to.
2. **Ask which phase + the rough idea**, one line from your human partner.
3. **Ask 1-2 clarifying questions, one at a time** — target user, core pain
   point. Don't ask everything `capture-intent` will ask later; just enough
   to search well.
4. **Research the market for real** — use WebSearch/WebFetch to find
   comparable apps or features (e.g. other Markdown readers, note apps,
   presentation tools — whatever fits the idea) and what users say they need.
   Cite what you found; don't invent sources.
5. **Synthesize 2-3 directions** the phase could take, with trade-offs, and
   say which one you'd recommend and why.
6. **Write the file** to
   `docs/superpowers/intent/YYYY-MM-DD-phase-<n>-<slug>-brainstorm.md`:

```markdown
# Brainstorm: Phase <n> — <topic>

## Ý tưởng thô ban đầu
## Nghiên cứu thị trường
<app/nguồn tham khảo + insight, với link>

## Nhu cầu người dùng
## Các hướng đã cân nhắc
<mỗi hướng: mô tả + đánh đổi>

## Hướng đề xuất
## Câu hỏi mở cho intent
```

7. **Stop and wait for approval.** Summarize the file in chat and ask your
   human partner to review it — same hard stop as `capture-intent`'s intent
   file. Do not proceed on assumed approval.
8. **Auto-chain.** Once approved, invoke `Skill` with `skill: capture-intent`,
   passing this brainstorm file's path. Do not wait for another message.

## Self-check before writing

- Every section has real content — nothing left as "TBD".
- Market research cites real, specific things found via WebSearch/WebFetch —
  not generic claims.
- At least 2 directions are presented, not just the recommended one.
