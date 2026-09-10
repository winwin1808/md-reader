# Session Handover — md-reader

Cập nhật lần cuối: 2026-09-10

## Trạng thái hiện tại

Repo mới dựng khung. Chưa có phase nào chạy, chưa có dòng code sản phẩm nào.

Đã có:

- **`docs/DESIGN.md`** (493 dòng) — design end-to-end, approved. Nguồn chân lý
  về kiến trúc. §4 chia 38 phase con, §7 mô hình agent + ngân sách context,
  §8 mô hình git/MR.
- `CLAUDE.md` — 8 ràng buộc khoá cứng + luật agent + luật git, tóm tắt từ DESIGN.md.
- `.claude/skills/` — 6 skill, pipeline dạng **vòng lặp** phase/phase con.
- `.claude/agents/` — `builder` · `spiker` · `reviewer` · `guard`.
- `docs/superpowers/{intent,specs,plans}/` — rỗng.
- `pnpm-workspace.yaml`, `package.json` (pnpm 10.10.0), `.gitignore`.

Chưa có: `packages/`, `apps/`, `node_modules`, `tsconfig.base.json`.
Phase con 1b tạo chúng.

## Test counts

Chưa có test nào.

## Việc tiếp theo

```
git checkout -b phase-1
claude
/capture-intent      → chọn phase 1
```

Pipeline tự chạy: design cả phase 1 → rồi lặp plan→build→review qua 9 phase
con 1a…1i → hết thì mở MR `phase-1` → `main`.

**Phase con 1a là spike CSP/mermaid, chạy TRƯỚC cả scaffold.** Nó dùng harness
vứt đi ở `spike/csp-mermaid/` (~30 dòng, không build, không test), thử mermaid
trên ≥5 trang có CSP khác nhau, ghi bảng kết quả thẳng vào DESIGN.md §5.1, rồi
bị xoá ở 1b. Lý do đặt trước: câu trả lời định hình content script, đợi tới lúc
có extension thật thì đã viết theo hướng có thể sai.

## Điểm dễ làm sai nhất

1. **Y.Doc schema phải đúng ngay phase con 1d** (DESIGN §2.1) kể cả khi phase 1
   chưa có editor và Yjs lúc này thuần overhead. Gồm `originHash` và
   `formatVersion` — cả hai chỉ *dùng* ở phase 5 nhưng phải *tồn tại* từ 1d.
2. **Coordinator đọc file source là hỏng ngân sách context.** `build-from-plan`
   và `review-before-ship` không được `Read` gì dưới `packages/` hay `apps/`.
3. **Envelope gửi builder phải copy nguyên văn từ plan**, đặc biệt khối
   `INVARIANTS` — builder bị cấm đọc DESIGN.md nên đó là toàn bộ ràng buộc nó
   có. `INVARIANTS` chung chung dán vào mọi task là plan viết sai.

## Điểm cần nhớ

- `review-before-ship` là chỗ dừng duy nhất, và chỉ dừng khi có blocker thật.
- Blocker cứng, không phải góp ý: vi phạm ranh giới package · content script
  vượt 60KB gz hoặc dính yjs/mermaid/excalidraw · đổi Y.Doc schema mà thiếu
  migration + fixture test.
- MR cuối phase **không tự merge**.
