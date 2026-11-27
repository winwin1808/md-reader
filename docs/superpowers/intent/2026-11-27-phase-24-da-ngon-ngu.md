# Intent: Phase 24 — Đa ngôn ngữ (vi · en · it · fr · de)
Author: winwin1808. Status: designed. Phase: 24

Design: docs/superpowers/specs/2026-11-27-phase-24-design.md

Người dùng giao trực tiếp (2026-11-27): "chrome ngôn ngữ gì thì nhận ngôn ngữ đó, làm 5 ngôn ngữ phổ biến
nhất — user là người Việt, Anh, Ý, Pháp, Đức", kèm "rà lại các chỗ thiếu i18n". Tự chạy pipeline, không hỏi lại.

Ghi chú đánh số: brainstorm phase 23 từng gọi "phase 24" cho XLSX / xuất từng hình / Graphviz. Phần đó chưa
bắt đầu và lùi sang phase sau; số 24 dùng cho đa ngôn ngữ.

## Problem

Extension chỉ có tiếng Việt và tiếng Anh. Người dùng Ý, Pháp, Đức (nhóm đông sau Việt/Anh trên store) mở
extension thấy tiếng Anh. Quy tắc `auto` hiện chỉ nhìn ngôn ngữ **đầu tiên** của trình duyệt và chỉ phân biệt
"vi hay không": Chrome tiếng Pháp → tiếng Anh. Ngoài catalog còn nhiều chuỗi cứng (thông báo lỗi tiếng Anh
trong `useDocSession`, chuỗi content script, tiêu đề alert trong core, tài liệu mẫu, release notes, định dạng
ngày `vi-VN`/`en-US`, `lang: 'vi'` trong editor) nên kể cả vi/en cũng còn chỗ lệch ngôn ngữ.

## Proposed outcome

- Mặc định (`Tự động`): giao diện theo ngôn ngữ Chrome. Duyệt `navigator.languages` theo thứ tự, lấy ngôn ngữ
  đầu tiên thuộc {vi, en, it, fr, de} (so theo mã chính: `fr-CA` → fr, `de-AT` → de); không khớp → tiếng Anh.
- Cài đặt → Hiển thị → Ngôn ngữ có 6 lựa chọn: Tự động, Tiếng Việt, English, Italiano, Français, Deutsch
  (mỗi tên viết bằng chính ngôn ngữ đó). Lựa chọn áp ngay cho app page, content script, trang chào, "Có gì mới".
- Mọi chữ người dùng thấy trên app page, content script (đọc tại chỗ + tab mép phải), web `/s/:token`, tên và
  mô tả extension trong Chrome (`_locales`) đều có đủ 5 ngôn ngữ.
- Ngày giờ, số theo đúng locale (`it-IT`, `fr-FR`, `de-DE`…). Tiêu đề alert GitHub trong tài liệu theo ngôn ngữ giao diện.
- Rà sạch chuỗi cứng: mọi chữ hiển thị đi qua catalog; có test chặn quay lại (catalog đủ khoá cho cả 5 ngôn
  ngữ, placeholder `{x}` khớp với bản tiếng Anh).

## Affected packages

- `packages/ui` — kiểu `Locale`, `resolveLocale`, catalog it/fr/de, bộ chọn ngôn ngữ, định dạng ngày/số, live preview.
- `packages/core` — tiêu đề alert GitHub theo 5 ngôn ngữ (và nhãn export nếu rà thấy chuỗi cứng).
- `apps/extension` — `LocaleRoot`, content script strings, `_locales/{it,fr,de}`, tài liệu mẫu, release notes,
  tour, thông báo lỗi trong `useDocSession`, lifecycle, feedback.
- `apps/web` — `webLocale` nhận `?lang=` 5 giá trị.
- `apps/api` — trường `locale` của góp ý nhận 5 giá trị (không đổi schema D1: cột đã là TEXT).

## Constraints

Ngoài 8 ràng buộc khoá cứng trong DESIGN.md:

- Không thêm thư viện i18n (giữ `createT`/`format` hiện có). Không đổi schema Y.Doc.
- Fallback một chiều: khoá thiếu ở it/fr/de rơi về **en**, không phải vi.
- Content script ≤ 60 KB gz vẫn là trần cứng; chuỗi content script chỉ là bảng nhỏ, không kéo catalog ui vào.
- App page chunk chính không tăng quá ~25 KB gz vì catalog mới (cân nhắc nạp lười catalog không dùng).
- Bản dịch do AI soạn, giọng gọn và tự nhiên như bản tiếng Anh; giữ nguyên tên riêng (LeSach, MD Reader,
  Markdown, MCP, Claude…), phím tắt và placeholder.
- Ngoài phạm vi: trang `site/` (landing, changelog, uninstall), listing store, chuỗi CLI `le-sach-mcp`,
  ngôn ngữ thứ 6 trở đi, RTL.

## Open questions

1. Nạp catalog: gộp cả 5 vào chunk chính hay `import()` lười theo locale (ảnh hưởng render đầu tiên + test).
2. Release notes và tài liệu mẫu: dịch đủ 3 ngôn ngữ mới hay rơi về tiếng Anh.
3. Cách chia bản dịch thành phase con vừa ngưỡng ≤ 300 dòng diff.

## Sub-phases

Bảng chính thức do `design-from-intent` chốt và ghi vào DESIGN.md §4. Khung dự kiến: nền locale 5 ngôn ngữ →
rà và đưa chuỗi cứng vào catalog → catalog it / fr / de (mỗi ngôn ngữ chia nhiều phần) → chuỗi ngoài catalog
(content script, core alert, `_locales`, tài liệu mẫu, release notes) → khoá đủ khoá + kiểm placeholder + phiên bản.
