# Intent: Phase 18 — Các luồng vòng đời người dùng
Author: haonq. Status: designed. Phase: 18
Design: docs/superpowers/specs/2026-11-09-phase-18-design.md
Brainstorm: docs/superpowers/intent/2026-11-09-phase-18-vong-doi-nguoi-dung-brainstorm.md

## Problem
Extension đã lên Chrome Web Store nhưng chưa có luồng nào quanh vòng đời người dùng. Cài xong không có hướng dẫn: người dùng không biết
làm gì tiếp, và chỉ biết phải bật "Cho phép truy cập URL tệp" sau khi đã vào app page. Bản lớn ra mắt thì không ai biết có gì mới. Không có
kênh góp ý trong sản phẩm. Người gỡ rời đi mà không để lại lý do, và không được báo rằng gỡ sẽ xoá toàn bộ tài liệu cục bộ, trong khi phòng
đã chia sẻ vẫn còn trên máy chủ mà họ không còn nút xoá.

## Proposed outcome
- **Cài mới:** mở tab hướng dẫn với tài liệu mẫu song ngữ trình diễn đọc, sơ đồ, slide, kèm checklist ngắn: ghim icon, bật URL tệp, mở file đầu tiên, kết nối AI (tuỳ chọn).
- **Cập nhật:** ghi chú phát hành đóng gói trong extension, mỗi mục có cờ `showOnUpdate` do người phát hành đặt. Lần mở Chrome sau khi cập nhật, nếu có mục bật cờ và mới hơn phiên bản đã xem thì mở tab "Có gì mới" đúng một lần. Không bật cờ thì chỉ hiện chấm báo trong app page. Có công tắc tắt tự mở; xem lại được trong Cài đặt.
- **Trợ giúp, góp ý:** mục trong Cài đặt để báo lỗi (điền sẵn phiên bản và trình duyệt, xem trước rồi mới gửi), tới trợ giúp và quyền riêng tư.
- **Xin đánh giá:** hỏi một lần sau khi đã dùng đủ nhiều; bộ đếm chỉ ở máy người dùng; có "Không hỏi nữa".
- **Trước khi gỡ:** trong Cài đặt, xuất mọi tài liệu ra `.zip` và dẫn tới xoá dữ liệu trên máy chủ.
- **Gỡ:** Chrome mở trang trên `site/`: một câu trắc nghiệm lý do, ô góp ý tự do, email tuỳ chọn; nói rõ dữ liệu cục bộ đã bị xoá, phòng chia sẻ còn tồn tại bao lâu; có link cài lại.

## Affected packages
`apps/extension` (worker, app page, tab hướng dẫn và Có gì mới, sao lưu) · `packages/ui` (mục Cài đặt, component, i18n) · `apps/api` (endpoint nhận góp ý + migration D1) ·
`site/` (trang sau gỡ, `privacy.html`) · docs: `docs/store/privacy-policy.md`, `docs/ROADMAP.md`, `docs/ROADMAP.en.md`. `packages/core` chỉ chạm nếu cần dùng lại logic thuần.

## Constraints
- 8 ràng buộc khoá cứng. Không thêm quyền manifest cho các luồng này.
- **Không telemetry.** Dữ liệu chỉ rời máy khi người dùng tự bấm gửi. URL gỡ không chứa định danh bản cài, không dùng lại khoá `x-mdr-install`. Cam kết "Không tài khoản, không theo dõi" giữ nguyên.
- Tab chỉ tự mở với `reason === 'install'` hoặc khi có cờ `showOnUpdate`; `chrome_update` và `shared_module_update` không bao giờ mở tab. Mỗi phiên bản mở tối đa một lần.
- Cờ `showOnUpdate` do người phát hành đặt, không suy ra từ số phiên bản.
- Không tăng content script; phần mới nằm ở worker, app page, `site/`.
- i18n vi + en cùng tập khoá. Không phá e2e và `worker/index.test.ts` đang chạy qua `onInstalled`.
- Không thêm tài khoản, email vòng đời, thanh toán: các phần đó thuộc Lề sách Cloud, repo private.
- Không chạm `docs/store/listing.md` và các file promo chưa commit của người dùng.
- Người dùng cũ khi cập nhật lên bản này cũng được đặt URL gỡ.

## Open questions
- Endpoint góp ý: lược đồ D1, giới hạn theo băm IP, thời gian giữ, cách người vận hành đọc góp ý. Hướng đã chọn là tự vận hành trên `apps/api`, theo mẫu `/api/report`.
- Máy chủ tự dựng: góp ý luôn gửi về máy chủ mặc định hay theo máy chủ đang cấu hình.
- Tài liệu mẫu là tài liệu thường trong danh sách, hay chỉ đọc và tách riêng.
- Trang "Có gì mới" nằm trong app page (hướng đề xuất) hay trên `site/`.
- Ngưỡng "đã dùng đủ nhiều" để xin đánh giá.
- Thư viện tạo `.zip` trong ngân sách app page; xử lý ảnh nhúng và tài liệu trùng tên.
- Bản Firefox: dùng chung hay ghi Deferred.

## Sub-phases
| # | Phase con | Xong nghĩa là |
|---|---|---|
| 18a | Móc vòng đời | Worker phân biệt `install`/`update`/các lý do khác; `setUninstallURL` được đặt ở mọi lần khởi động; trạng thái vòng đời lưu trong `chrome.storage.local`; test cho từng `reason` |
| 18b | Cài mới | Cài mới mở tab hướng dẫn với tài liệu mẫu vi/en và checklist; `chrome_update` không mở tab; đánh dấu đã xong theo trạng thái thật (quyền URL tệp) |
| 18c | Có gì mới | Ghi chú phát hành có cờ `showOnUpdate`; bật cờ → mở một lần ở lần mở Chrome kế tiếp; không cờ → chấm báo; công tắc tắt; xem lại trong Cài đặt |
| 18d | Endpoint góp ý | `apps/api` nhận góp ý không định danh, validate, giới hạn tần suất, có migration; có test |
| 18e | Trang sau gỡ | Trang vi/en trên `site/`, form lý do gửi được tới 18d, nói rõ số phận dữ liệu, link cài lại, vẫn dùng được khi gửi lỗi |
| 18f | Trợ giúp, góp ý, đánh giá | Mục trong Cài đặt, báo lỗi có xem trước; lời mời đánh giá hỏi một lần, nhớ "Không hỏi nữa" |
| 18g | Trước khi gỡ | Xuất mọi tài liệu ra `.zip` từ Cài đặt, có ảnh nhúng và không mất tài liệu trùng tên; dẫn tới xoá dữ liệu máy chủ |
| 18h | Quyền riêng tư và tài liệu | `docs/store/privacy-policy.md`, `site/privacy.html` nêu góp ý tự nguyện và thời gian giữ; `ROADMAP` vi/en có P18; ghi danh sách việc người làm khi phát hành |
