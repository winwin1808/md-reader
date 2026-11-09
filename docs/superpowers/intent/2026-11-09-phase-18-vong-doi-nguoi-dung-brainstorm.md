# Brainstorm: Phase 18 — Các luồng vòng đời người dùng

## Ý tưởng thô ban đầu

> "Tôi muốn làm các luồng như cài mới (hướng dẫn), gỡ (xin lí do gỡ),... các luồng mà SAAS cần."

Đã chốt với người làm sản phẩm (2026-11-09): **chỉ dùng form tự nguyện, không
telemetry**. Giữ nguyên cam kết "Không tài khoản, không theo dõi" trên store và
"Không phân tích, không theo dõi" trong privacy policy.

Bổ sung cùng ngày: "Với cài xong có hướng dẫn, update thì mỗi lần mở chrome lên có
trang whatsnew,..."

Hiện trạng trong repo:

- `chrome.runtime.onInstalled` chỉ gọi `onBoot` (`apps/extension/src/worker/index.ts:181`),
  không phân biệt `install` và `update`. Chưa có welcome, chưa có `setUninstallURL`.
- Đã có `FileAccessHint`: nhắc bật "Cho phép truy cập URL tệp", nhưng chỉ hiện
  sau khi người dùng đã vào app page.
- Quyền hiện tại: `storage`, `activeTab`, `alarms`, host giới hạn theo đuôi `.md`.
  Luồng vòng đời không cần thêm quyền.
- `site/` là trang tĩnh trên GitHub Pages (`winwin1808.github.io/md-reader`),
  đã có `privacy.html`. Đây là nơi phù hợp để đặt trang sau gỡ.
- `apps/api` đã có mẫu `POST /api/report`, có thể tham khảo cho endpoint nhận góp ý.
- Tìm theo từ khoá `exportAll|backupAll|bulkExport|sao lưu` không thấy chức năng
  sao lưu hàng loạt. Cần xác minh ở bước design.

## Nghiên cứu thị trường

**API và chính sách Chrome (nguồn chính thức)**

- [`chrome.runtime`](https://developer.chrome.com/docs/extensions/reference/api/runtime):
  `setUninstallURL` chỉ nhận `http:`/`https:`, tối đa 1023 ký tự, mục đích được nêu
  gồm dọn dữ liệu phía server, analytics và khảo sát. `onInstalled` có các lý do
  `install` · `update` · `chrome_update` · `shared_module_update`; `previousVersion`
  chỉ có khi `update`. Vì `chrome_update` cũng kích hoạt sự kiện, mọi logic mở tab
  phải kiểm tra `reason`.
- [Thảo luận Chromium](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/EAD7ojOgdlc/m/Ycm7-5WKGQAJ):
  URL gỡ chạy cả khi extension đang tắt, nhưng thao tác chỉ tắt extension thì không
  mở URL, nên nhóm người tắt mà không gỡ sẽ không được hỏi.
- [Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use):
  không nhắc riêng tới form góp ý, nhưng dữ liệu thu thập vẫn phải được công bố và
  chỉ giới hạn ở mức cần thiết; con người chỉ được đọc dữ liệu người dùng khi có
  đồng ý rõ ràng hoặc thuộc các ngoại lệ. Góp ý do người dùng tự bấm gửi khớp với
  yêu cầu này, nhưng privacy policy vẫn phải nêu.

**Hướng dẫn cho nhà phát triển**

- [Firefox Extension Workshop](https://extensionworkshop.com/documentation/develop/onboard-upboard-offboard-users):
  chia vòng đời thành onboard / upboard / offboard. Đây là khung tham chiếu cho phase này.
- [Plasmo](https://www.plasmo.com/blog/posts/ux-best-practices-that-will-make-your-browser-extension-successful):
  chỉ xin quyền vào lúc người dùng cần tới tính năng.
- [Matt Frisbie](https://mattfrisbie.substack.com/p/10-things-every-chrome-extension-needs)
  và [các hướng dẫn onboarding](https://theluckystrike.github.io/chrome-extension-guide/docs/guides/extension-onboarding)
  (blog thứ cấp, độ tin cậy vừa): welcome phải ngắn, dẫn tới một hành động đầu tiên;
  khảo sát gỡ 1–3 câu, chủ yếu trắc nghiệm.

**Sản phẩm cùng loại**

- [Zettlr](https://docs.zettlr.com/en/first-time-users/first-steps.html) mở sẵn tài liệu
  "Welcome to Zettlr". Đây là cách rất hợp với app đọc Markdown: tài liệu mẫu vừa là
  hướng dẫn vừa là bản trình diễn.
- [Obsidian](https://www.macdrifter.com/2021/07/obsidian-onboarding.html) bắt tạo vault
  ngay từ đầu và [bị chê là khó với người không chuyên](https://forum.obsidian.md/t/autopsy-of-a-notion-obsidian-app-and-how-to-improve-obsidian-after-it/110438).
- [Typora](https://support.typora.io/Quick-Start) chỉ trỏ tới tài liệu trong menu Help.

**Điều người dùng phàn nàn**

- Tab tự mở khi cập nhật là phàn nàn lặp lại nhiều năm:
  [Delicious Quick Tour](https://groups.google.com/g/chrome-delicious/c/2sc0-UJcs7E),
  [Firefox addon annoyances](https://connect.mozilla.org/t5/discussions/addon-update-annoyances/m-p/10544),
  [Grammarly mở tab](https://support.google.com/chrome/thread/94926810/google-chrome-is-opening-a-new-tab-of-grammarly-every-time-i-open-a-new-chrome-window-on-windows-10?hl=en).
  [Một developer trên r/chrome_extensions](https://reddit.birdcat.cafe/r/chrome_extensions/comments/1jzpmfz/this_is_how_i_notify_users_of_new_features)
  chỉ báo khi đổi phiên bản minor và báo trong popup thay vì mở tab.

**Chưa tìm được:** số liệu tỉ lệ phản hồi khảo sát gỡ, tài liệu chính thức về việc
ghim icon, và thời điểm xin đánh giá tối ưu. Các phần liên quan bên dưới là phán đoán,
không phải kết luận từ số liệu.

## Nhu cầu người dùng

Theo từng thời điểm trong vòng đời:

| Thời điểm | Người dùng cần | Người làm sản phẩm cần |
|---|---|---|
| Vừa cài | Biết làm gì tiếp, thấy kết quả ngay | Người dùng đọc được tài liệu đầu tiên |
| Mở file trên máy lần đầu | Hiểu vì sao phải bật "URL tệp" trước khi gặp lỗi | Giảm bỏ cuộc ở bước này |
| Vừa cập nhật | Biết có gì mới, không bị làm phiền lặp lại | Tính năng mới được biết đến |
| Đang dùng đều | Báo lỗi, góp ý dễ dàng | Tín hiệu định tính, đánh giá trên store |
| Sắp gỡ | Không mất tài liệu ngoài ý muốn | Biết lý do gỡ |
| Đã gỡ | Biết dữ liệu của mình đi đâu, xoá thế nào | Cơ hội sửa lỗi, mời quay lại |

Rủi ro thật ở luồng gỡ, theo chính privacy policy: **gỡ extension xoá toàn bộ dữ liệu
trong trình duyệt**, trong khi phòng đã chia sẻ vẫn nằm trên máy chủ. Sau khi gỡ, người
dùng mất luôn nút "Xoá dữ liệu trên máy chủ", và dữ liệu chỉ tự xoá sau 90 ngày không
ai mở. Link đã gửi đi vẫn hoạt động trong thời gian đó. Trang sau gỡ phải nói rõ điều này.

## Các hướng đã cân nhắc

### A. Tối thiểu: Welcome + form gỡ

Mở trang chào khi `reason === 'install'`, đặt `setUninstallURL` trỏ tới form trên `site/`.

- Được: nhỏ, 1–2 phase con, ra nhanh.
- Mất: không xử lý cảnh báo mất dữ liệu, cập nhật, hay kênh góp ý. Người dùng cũ không
  có đường báo lỗi ngoài lúc gỡ.

### B. Vòng đời đầy đủ, không tài khoản (đề xuất)

Năm luồng, tất cả chạy cục bộ, chỉ gửi đi khi người dùng tự bấm gửi:

1. **Cài mới:** mở tab app page với tài liệu mẫu song ngữ (kiểu Zettlr) trình diễn đọc,
   sơ đồ, slide; kèm checklist ngắn: ghim icon, bật URL tệp, mở file đầu tiên, kết nối AI
   (tuỳ chọn).
2. **Cập nhật (theo yêu cầu người làm sản phẩm, chỉ big update):** danh sách ghi chú phát
   hành đóng gói trong extension, mỗi mục có cờ do người phát hành đặt, ví dụ
   `{ version: '1.5.0', showOnUpdate: true, ... }`. Lần mở Chrome sau khi cập nhật, nếu có
   mục **bật cờ và mới hơn phiên bản đã xem** thì mở tab "Có gì mới" đúng **một lần**
   (phiên bản đã xem lưu trong `chrome.storage.local`). Không bật cờ thì không mở tab, chỉ
   hiện chấm báo nhỏ trong app page. Cờ không suy ra từ số phiên bản, nên người phát hành
   quyết định bản nào là "big update". Bỏ qua `chrome_update`; có công tắc "Không tự mở khi
   cập nhật"; xem lại được trong Cài đặt.
3. **Trợ giúp và góp ý:** mục trong Cài đặt: báo lỗi (điền sẵn phiên bản và trình duyệt,
   người dùng xem trước rồi mới gửi), trang trợ giúp, quyền riêng tư.
4. **Xin đánh giá:** chỉ sau khi đã dùng đủ nhiều, bộ đếm chỉ nằm trong `chrome.storage.local`,
   hỏi một lần, có "Không hỏi nữa".
5. **Gỡ và rời đi:** trang trên `site/`: 1 câu trắc nghiệm + ô góp ý tự do + email tuỳ chọn;
   nói rõ dữ liệu cục bộ đã mất và phòng chia sẻ còn tồn tại bao lâu; hướng dẫn cài lại.
   Thêm trong Cài đặt: mục "Trước khi gỡ" (sao lưu tài liệu, xoá dữ liệu máy chủ).

- Được: bao phủ các thời điểm người dùng thật sự gặp, không phá cam kết riêng tư, không
  cần thêm quyền.
- Mất: khoảng 6–9 phase con; không đo được phễu, chỉ có tín hiệu định tính và số liệu
  sẵn có của Developer Dashboard trên Chrome Web Store.

### C. Bộ SaaS đầy đủ: tài khoản, email vòng đời, thanh toán

Thêm đăng ký, chuỗi email kích hoạt, nâng cấp gói, nhắc gia hạn, huỷ gói, win-back.

- Được: đúng nghĩa SaaS, sẵn hạ tầng thu phí.
- Mất: mâu thuẫn trực tiếp với "không tài khoản"; hiện chưa có gói trả phí nào để nâng cấp
  hay huỷ; `ROADMAP.md` đặt Lề sách Cloud sau mốc vài trăm người dùng thật; tài khoản và
  thanh toán thuộc repo private `md-reader-cloud`, không vào repo MIT này.

## Hướng đề xuất

**Chọn B.** Mọi luồng trong B đều cần thiết ngay cả khi chưa có doanh thu, và không đóng
đường đi tới C: khi Cloud ra mắt, các luồng tài khoản và thanh toán sẽ cắm vào cùng các
điểm đã dựng. Thứ tự ưu tiên: cài mới và gỡ trước (đúng hai luồng bạn nêu), sau đó tới cập
nhật, góp ý, xin đánh giá.

Hoãn sang Lề sách Cloud: đăng ký/đăng nhập, email vòng đời, thanh toán, nâng cấp/huỷ gói,
win-back.

Ràng buộc phải giữ:

- Không telemetry, không định danh bản cài trong URL gỡ. **Không dùng lại khoá `x-mdr-install`**.
- Luồng mới thuộc `apps/extension` (`chrome.*`); UI dùng chung nằm ở `packages/ui`, không `chrome.*`.
- Content script không phình; toàn bộ phần mới nằm ở app page, worker và `site/`.
- Có song ngữ Việt / Anh; `site/` đã có `lang.js`.
- Tab welcome không được làm hỏng e2e và test `worker/index.test.ts` đang chạy qua `onInstalled`.

## Câu hỏi mở cho intent

1. Form gỡ gửi về đâu? Đề xuất endpoint mới trên `apps/api`, theo mẫu `/api/report`, tự vận
   hành, không qua bên thứ ba; đổi lại có thêm bề mặt phải chống spam (giới hạn theo băm IP).
   Phương án rẻ hơn là `mailto:` hoặc Google Form.
2. Có cần sao lưu hàng loạt không? Nếu chưa có, mục "Trước khi gỡ" chỉ làm được khi thêm
   chức năng xuất mọi tài liệu ra `.zip`, có thể tốn một phase con riêng.
3. Tài liệu mẫu nên mở trong app page như tài liệu thường (người dùng sửa/xoá được) hay ở
   chế độ chỉ đọc, tách khỏi danh sách tài liệu?
4. Người dùng hiện tại khi cập nhật lên bản này có nhận `setUninstallURL` không? Đề xuất có:
   gọi ở mọi lần khởi động, không chỉ khi `install`. Chỉ mở welcome với `install`.
5. Góp ý tự do và email là dữ liệu mới, phải cập nhật privacy policy (`docs/store/privacy-policy.md`,
   `site/privacy.html`) và form Data usage. Câu "không theo dõi" vẫn đúng, nhưng cần nêu rõ
   ngoại lệ tự nguyện này. Giữ góp ý bao lâu?
6. Bản Firefox: có giữ đồng nhất các luồng này không, hay chỉ làm Chrome trước?
7. Trang "Có gì mới" nằm trong app page (dùng được offline, theo giao diện Lề sách) hay trên
   `site/` (sửa nội dung không cần ra bản mới)? Đề xuất app page.
