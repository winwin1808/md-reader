# Intent: Phase 8 — Chia sẻ & cộng tác
Author: Hao Nguyen. Status: draft. Phase: 8

## Problem

MD Reader hiện là ứng dụng một máy: tài liệu, lịch sử và cài đặt chỉ nằm trong
IndexedDB của trình duyệt. Không có cách nào gửi một tài liệu cho người khác
xem ngoài việc export file rồi gửi tay; không có cách để hai người cùng sửa;
và dù `Y.Array "history"` đã lưu checkpoint kèm `clientIds` từ phase 6, chưa
có giao diện nào cho thấy ai sửa chỗ nào hay tua lại được một mốc.

Ngoài ra còn hai món nợ hoãn từ phase trước mà phase 8 phải trả:
- **7o** — đọc tại chỗ trong content script. Spike 7n đo 152.9 KB gz vì core
  import tĩnh katex / highlight / parse5 / yaml; cần core inject plugin và
  yaml lazy rồi đo lại dưới 50 KB.
- **Race import** — hai tab cùng mở một URL mới lần đầu có thể cùng import,
  tạo hai bản.

## Proposed outcome

Ba lần ship nhỏ, theo đúng câu trong DESIGN.md: *gửi link cho người khác xem
→ cho họ sửa → xem ai sửa chỗ nào.*

1. **Link xem.** Trên app page có nút Chia sẻ. Bấm ra một link `apps/web`
   (trang tĩnh, render phía client bằng `@md-reader/ui`); người nhận mở là
   đọc được, không cần cài extension, không cần tài khoản. Link có hạn dùng
   và thu hồi được.
2. **Cùng sửa.** Link có quyền *edit*: người nhận gõ tên hiển thị rồi sửa
   ngay trên web, extension của chủ tài liệu thấy thay đổi theo thời gian
   thực, có con trỏ và presence của từng người. Y.Doc vẫn là nguồn sự thật;
   provider WebSocket chạy song song `y-indexeddb`.
3. **Trace.** Gutter blame theo ký tự từ `clientID` + tên tự khai; timeline
   checkpoint tua lại được từng mốc.

Kèm theo: content script đọc tại chỗ dưới 50 KB gz (7o); hai tab không còn
import trùng; store listing và privacy policy nói rõ "dữ liệu chỉ rời máy khi
bạn bấm Chia sẻ".

Backend: **Cloudflare Workers**, chạy trong gói Workers Free. Quyết định này
thay cho NestJS + Postgres ở bản DESIGN.md trước:
- **Durable Objects (SQLite)** — một object mỗi `docId`, là hub WebSocket và
  giữ trạng thái nóng; dùng `y-partyserver` cho giao thức y-websocket +
  awareness. Log Y update gộp định kỳ thành snapshot + đuôi.
- **R2** — snapshot bền `docs/<docId>/snapshot.bin` ghi khi client cuối ngắt
  hoặc sau N update; checkpoint lịch sử đẩy ra đây cho 8g.
- **D1** — share token, quyền (view / edit), hạn dùng, thu hồi. Không dùng KV
  vì thu hồi trễ tới một phút.

## Affected packages

- `packages/core` — mới: `share/` (mã hoá token, kiểu quyền), `blame/`
  (map clientID → đoạn), hỗ trợ inject plugin + yaml lazy cho 7o. Vẫn thuần
  TS, vẫn nhận `Y.Doc` đã bind, không biết provider.
- `packages/ui` — `ShareModal`, `PresenceBar`, con trỏ awareness trong
  Editor, `BlameGutter`, `HistoryTimeline`, ô "Server đồng bộ" trong Settings.
- `apps/extension` — gắn provider WebSocket cạnh `y-indexeddb`, nút Chia sẻ
  trên TopToolbar (chỉ app page), content script đọc tại chỗ, khoá import.
- `apps/api` — **mới**, Worker + wrangler: Durable Object `DocRoom`, D1
  migration, R2 binding, endpoint snapshot/token.
- `apps/web` — **mới**, trang tĩnh deploy bằng Workers static assets, render
  bằng `@md-reader/ui`, bind provider WebSocket.
- `docs/store` — listing + privacy policy.

## Constraints

Ngoài 8 ràng buộc khoá cứng trong CLAUDE.md / DESIGN.md:

1. **Toàn bộ phải chạy trong gói Workers Free**: ≤ 100k request/ngày,
   ≤ 5 GB DO storage/tài khoản, D1 trả lỗi khi vượt hạn mức đọc/ghi ngày.
   Hệ quả: client gộp update trước khi gửi (message gửi lên tính là
   request); đọc token phải có index và cache theo kết nối.
2. **`apps/api` và `apps/web` chỉ import core qua `@md-reader/core`**, không
   `chrome.*`, không `document` trong `apps/api`.
3. **Danh tính = tên tự khai**, lưu local và gửi qua awareness; không OAuth,
   không bảng user.
4. **Server URL cấu hình được** trong Settings, mặc định trỏ workers.dev của
   chủ dự án; ai muốn tự host thì đổi.
5. **Nút Chia sẻ chỉ ở app page**; content script không gọi server, ngân
   sách 60 KB gz vẫn áp dụng cho content script kể cả sau 7o.
6. **Kết nối view** bị server bỏ qua mọi message update gửi lên; quyền kiểm
   tra lúc nâng cấp WebSocket, không tin client.
7. **Không ship bước 2 trước khi 8a0 (spike) có bảng kết quả thật** ghi vào
   DESIGN.md §5: y-partyserver chạy trên DO, hai client đồng bộ, số liệu
   bundle, xác nhận gói Free đủ.
8. Chia sẻ là **opt-in theo từng tài liệu**; không có gì rời máy cho tới khi
   người dùng bấm Chia sẻ. Privacy policy phải nói đúng điều này.

## Open questions

- Chiến lược gộp update trên DO: theo số update hay theo byte? Ngưỡng nào
  giữ ổn định trong giới hạn Free?
- Khi chủ tài liệu offline, người có quyền edit vẫn sửa trên web; lúc chủ
  mở lại extension, `originHash` trên đĩa và `remoteHash` đều lệch — hộp
  thoại conflict hiện tại đủ chưa hay cần nhánh thứ ba "từ server"?
- Token nằm trong path hay fragment của URL? Fragment không tới server nên
  không log được, nhưng cần JS mới đọc.
- Hạn dùng mặc định của link: 7 ngày, 30 ngày hay vô hạn?
- 7o: bundle `rehype-katex` lazy hay thay bằng placeholder "mở trong app"
  cho công thức trong content script?
- `apps/web` deploy chung Worker với `apps/api` (static assets) hay tách?

## Sub-phases

| # | Phase con | Xong nghĩa là |
|---|---|---|
| 8a0 | Spike y-partyserver trên Durable Object | Hai client đồng bộ thật qua DO; đo bundle Worker; bảng kết quả + xác nhận gói Free ghi vào DESIGN.md §5 |
| 8a | `apps/api` scaffold | Worker + wrangler, DO `DocRoom`, D1 migration, R2 binding, deploy được lên workers.dev |
| 8b | Share link read-only | Token D1 + hạn dùng + thu hồi; `apps/web` tĩnh render snapshot bằng `@md-reader/ui`; nút Chia sẻ trên app page |
| 8c | WebSocket provider | Đồng bộ hai chiều thật extension ↔ web, chạy cạnh `y-indexeddb`; URL server cấu hình được |
| 8d | Awareness | Con trỏ + presence với tên tự khai |
| 8e | Phân quyền | view / edit theo từng link; server chặn update từ kết nối view |
| 8f | `BlameGutter` | Blame theo ký tự từ `clientID` + tên |
| 8g | `HistoryTimeline` | Feed checkpoint, tua lại được từng mốc, snapshot từ R2 |
| 8h | Đọc tại chỗ trong content script (nợ 7o) | Core inject plugin + yaml lazy; content script render tại chỗ < 50 KB gz |
| 8i | Khoá import | Hai tab cùng mở một URL mới chỉ tạo một doc |
| 8j | Store kit | Listing + privacy policy nói đúng về chia sẻ; bump version |
