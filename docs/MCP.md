# MD Reader MCP cục bộ

Bản tiếng Anh: [MCP.en.md](MCP.en.md)

## 1. MCP cục bộ là gì

`le-sach-mcp` là một máy chủ MCP (Model Context Protocol) chạy **ngay trên máy bạn**, nói chuyện với client AI (Claude Desktop, Claude Code, Cursor...) qua stdio. Nó nối với extension MD Reader trong Chrome qua một cầu nối WebSocket chỉ lắng nghe trên `127.0.0.1`. Không có máy chủ trung gian: tài liệu nằm trong Chrome của bạn và không được tải lên đâu cả, trừ khi bạn tự chia sẻ.

Cầu nối **tắt mặc định**. Bạn phải bật trong Cài đặt thì extension mới nhận kết nối.

> Remote MCP (kết nối từ xa) và OAuth **chưa có**, đã hoãn sang giai đoạn sau. Hiện chỉ có MCP cục bộ.

## 2. Cài đặt

Yêu cầu Node ≥ 20. Không cần cài sẵn, client sẽ chạy bản `le-sach-mcp@1.3.3` bằng:

```
npx -y le-sach-mcp@1.3.3
```

## 3. Cấu hình client

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "md-reader": {
      "command": "npx",
      "args": ["-y", "le-sach-mcp@1.3.3"]
    }
  }
}
```

**Claude Code**:

```
claude mcp add md-reader -- npx -y le-sach-mcp@1.3.3
```

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "md-reader": {
      "command": "npx",
      "args": ["-y", "le-sach-mcp@1.3.3"]
    }
  }
}
```

Biến môi trường tuỳ chọn:

- `MDR_PAIR_FILE`: đường dẫn file ghép cặp (mặc định `~/.config/md-reader/mcp.json`; Windows dùng `%APPDATA%\md-reader\mcp.json`; nếu có `XDG_CONFIG_HOME` thì dùng thư mục đó).
- `MDR_EXTENSION_ID`: ID extension được phép kết nối (nhiều ID thì cách nhau bằng dấu phẩy). Mặc định gồm ID bản Chrome Web Store (`eolclccibhickmpbpbdodbhopnddcdog`) và ID bản cài từ mã nguồn (`ojcemoafaibjfghljkbagnkbgljakbji`).

## 4. Bật và ghép cặp

1. Mở Chrome có MD Reader, (cài MD Reader từ [Chrome Web Store](https://chromewebstore.google.com/detail/md-reader/eolclccibhickmpbpbdodbhopnddcdog)), vào **Cài đặt → Kết nối AI** và bật. Ngay dưới công tắc có sẵn lệnh/JSON cho Claude Code, Claude Desktop, Cursor để chép.
2. Khởi động (hoặc khởi động lại) client AI. Trong **10 phút** đầu sau khi `le-sach-mcp` chạy, extension hiện **hộp ghép cặp** gồm tên client (tối đa 40 ký tự) và **mã nhận dạng** dạng `ABCD-1234`. **Trước khi bấm Cho phép**, so mã này với dòng khởi động của `le-sach-mcp` trong log (stderr) của client AI: `le-sach-mcp 1.3.3 listening on 127.0.0.1:<cổng> · mã máy chủ ABCD-1234`. Hai mã phải giống nhau; khác nhau nghĩa là một chương trình khác đang nghe trên dải cổng đó — chọn Từ chối. (Dòng `đã ghép cặp với MD Reader …` in sau khi ghép là mã của **extension**, không dùng để so ở bước này.) Khớp thì chọn Cho phép.
3. Cách xác thực (giao thức v2): `le-sach-mcp` và extension mỗi bên giữ một cặp khoá ECDSA P-256 riêng. Mỗi lần nối, hai bên ký lên số ngẫu nhiên của bên kia kèm số cổng; không có bí mật nào đi qua kết nối. Extension chỉ chạy lệnh của máy chủ có khoá bạn đã duyệt; `le-sach-mcp` chỉ nhận extension đã ghép cặp đầu tiên (ghim lần đầu, chỉ trong 10 phút đầu).
   Khoá của máy chủ nằm trong `~/.config/md-reader/mcp.json` (quyền 600). Đừng chia sẻ file này. Muốn ghép cặp lại từ đầu: xoá file này, khởi động lại client AI, rồi duyệt lại trong extension. File hỏng hoặc từ phiên bản cũ sẽ được đổi tên thành `mcp.json.bak-…` và tạo khoá mới (log ghi rõ).
   Giới hạn còn lại: một chương trình khác trên cùng máy, chạy với cùng tài khoản và nối vào `le-sach-mcp` trước extension trong 10 phút đầu, có thể chiếm chỗ ghép cặp phía máy chủ. Khi đó extension thật sẽ bị từ chối (bạn sẽ thấy ghép cặp không thành) — xoá file ghép cặp và khởi động lại.
   Việc ghim-lần-đầu chỉ dựa vào chỗ kết nối đến từ chính máy này trong 10 phút đầu. Trên **máy nhiều người dùng**, hoặc khi có tiến trình sandbox / không tin cậy chạy cùng máy, một tài khoản khác cũng nối được vào cổng `127.0.0.1` và có thể chiếm chỗ ghim. Ở môi trường như vậy đừng bật Kết nối AI, hoặc kiểm tra ngay sau khi ghép rằng extension báo đã kết nối.
   Việc ghim khoá dùng khoá file (file lock), nên nhiều tiến trình `le-sach-mcp` khởi động cùng lúc (ví dụ nhiều cửa sổ client) vẫn an toàn. Bấm Cho phép hai lần liên tiếp trong hộp ghép cặp cũng không làm hỏng ghép cặp.
4. Thu hồi: vào Cài đặt → Kết nối AI để thu hồi client. Client bị thu hồi mà nối lại trong vòng 60 giây sẽ **không được hỏi lại**; muốn ghép lại, tắt rồi bật Kết nối AI sau 60 giây.

### Một ứng dụng AI, một profile Chrome

Mỗi `le-sach-mcp` chỉ ghép với **một** extension — tức một profile Chrome. Từ extension 1.5.1 và `le-sach-mcp` 1.3.3:

- Hộp ghép cặp tự mở **tối đa một lần** cho mỗi ứng dụng AI ở mỗi profile. Từ chối, đóng tab hay không trả lời đều được ghi nhớ; extension không hỏi lại.
- Profile khác với profile đã ghép **không tự mở tab nào**. Trong Cài đặt → Kết nối AI, mục **Ứng dụng AI đang chạy trên máy này** hiện ứng dụng đó kèm dòng "Đã ghép với một trình duyệt hoặc profile Chrome khác". (Với `le-sach-mcp` 1.3.2 trở về trước, extension không biết máy chủ đã ghép ở đâu nên vẫn hỏi một lần, rồi thôi.)
- Muốn kết nối sau: mở Cài đặt → Kết nối AI, bấm **Kết nối** cạnh ứng dụng đang ở trạng thái "Chưa kết nối". Hộp ghép cặp mở ra và vẫn cần bạn bấm Cho phép.
- Bấm Cho phép luôn có kết quả: kết nối được, hoặc hộp báo lý do (ứng dụng AI đã ghép với nơi khác, đã quá 10 phút từ lúc nó khởi động, hoặc không còn chạy).

**Chuyển một ứng dụng AI sang profile khác:**

1. Ở profile cũ: thu hồi ứng dụng AI đó trong Cài đặt → Kết nối AI (hoặc tắt Kết nối AI). Nếu bỏ qua bước này, profile cũ sẽ tự nối lại và chiếm chỗ ghép cặp trước.
2. Chạy `npx -y le-sach-mcp@1.3.3 unpair`. Lệnh này bỏ khoá extension đã ghim trong file ghép cặp và **giữ khoá của máy chủ**, nên mã nhận dạng không đổi. Lệnh in một dòng kết quả rồi thoát.
3. Khởi động lại ứng dụng AI (cửa sổ ghép cặp 10 phút tính từ lúc `le-sach-mcp` chạy).
4. Ở profile mới: Cài đặt → Kết nối AI → **Kết nối** → Cho phép.

## 5. Bảy tool

| Tool | Việc làm | Xác nhận |
|---|---|---|
| `publish_doc` | Tạo tài liệu mới trong MD Reader trên máy này và mở tab (`open` tuỳ chọn). Trả `docId`. | Không |
| `list_docs` | Liệt kê tài liệu (id, tiêu đề, lần mở cuối, đã chia sẻ hay chưa). | Không |
| `get_doc` | Đọc Markdown hiện tại, gồm cả sửa của người cộng tác. Trả `markdown` và `hash`. | Không |
| `update_doc` | Thay Markdown của tài liệu; chỉ phần thay đổi được ghi. Cần `baseHash` lấy từ `get_doc`; tài liệu đã đổi từ đó thì lỗi `CONFLICT`, gọi lại `get_doc` rồi thử lại. Lịch sử và blame ghi tác giả là tên client AI đã ghép cặp (ví dụ "Claude Code"), không phải "AI" chung chung; mọi lần sửa của cùng một client trên cùng máy dùng chung một tác giả. Thay đổi chỉ nằm trong MD Reader: **không tự ghi ra file trên đĩa** — thanh trạng thái hiện "AI đã sửa — chưa lưu" tới khi bạn bấm Lưu (⌘S) hoặc tự sửa tiếp. | **Có, khi tài liệu đang được chia sẻ** (người có link sẽ thấy thay đổi ngay); không hỏi với tài liệu chưa chia sẻ |
| `share_doc` | Xin tạo link chia sẻ (`role`: `view` hoặc `edit`, mặc định `view`; `expiresInDays`: 7, 30 hoặc `null`, mặc định 7). Trả URL. | **Luôn hỏi** |
| `list_links` | Liệt kê link chia sẻ của tài liệu (tiền tố, vai trò, hạn, đã thu hồi). | Không |
| `revoke_link` | Xin thu hồi link theo `tokenPrefix` (6 ký tự). | **Luôn hỏi** |

`share_doc` và `revoke_link` luôn hiện hộp xác nhận trong MD Reader; không bấm Cho phép thì không có gì xảy ra. Hộp tự đóng sau 100 giây và được tính là từ chối.

## 6. Prompt mẫu

- "Viết bản tóm tắt cuộc họp này thành tài liệu Markdown và mở trong MD Reader."
- "Đọc tài liệu 'Kế hoạch Q4' trong MD Reader, sửa lại phần rủi ro cho rõ hơn."
- "Liệt kê các tài liệu tôi đã mở gần đây."
- "Tạo link chỉ xem, hết hạn sau 7 ngày cho tài liệu này."
- "Biến tài liệu này thành bộ slide trình chiếu, mỗi ý chính một slide."

**Viết Markdown cho trình chiếu.** MD Reader tách slide theo dòng `---` (nếu tài liệu có) hoặc theo đề mục. Muốn ngắt slide ở một chỗ cụ thể mà không thêm đường kẻ hay đề mục, AI đặt một dòng riêng `<!-- slide-break -->`, có dòng trống trước và sau; dòng này không hiện khi đọc và bị bỏ khi xuất Word. Ghi chú diễn giả viết bằng `<!-- note: ... -->`. Slide quá dài vẫn được tự chia khi trình chiếu và xuất PDF, nên không cần ngắt thủ công chỉ để tránh tràn.

## 7. Giới hạn và xử lý sự cố

Giới hạn: Markdown tối đa 2.000.000 ký tự; khi tài liệu đã chia sẻ, mỗi message đồng bộ tối đa 16 MiB và mỗi phòng tối đa 64 MiB; tiêu đề 1–200 ký tự; tối đa 4 kết nối đồng thời; cầu nối dùng cổng `127.0.0.1` trong dải 47821–47830 (lấy cổng trống đầu tiên). Thời gian chờ mỗi lệnh: 30 giây, riêng `share_doc` và `revoke_link` 120 giây; chờ extension kết nối tối đa 35 giây.

| Lỗi | Nguyên nhân / cách xử lý |
|---|---|
| `NOT_CONNECTED` | Chrome chưa mở MD Reader hoặc Kết nối AI chưa bật. Mở Chrome, bật Cài đặt → Kết nối AI. |
| `NOT_PAIRED` | Client chưa được ghép cặp hoặc đã bị thu hồi. Chấp nhận hộp ghép cặp; nếu đã thu hồi, tắt rồi bật Kết nối AI sau 60 giây. |
| Tab "Cho phép ứng dụng AI kết nối?" mở lặp lại | Hai profile Chrome cùng bật Kết nối AI, bản extension cũ hơn 1.5.1. Cập nhật extension; hoặc tắt Kết nối AI ở profile không dùng. |
| `TIMEOUT` | Extension không phản hồi kịp (hoặc hộp xác nhận không được trả lời). Thử lại. |
| `CONFLICT` | `update_doc` với `baseHash` cũ. Gọi lại `get_doc`. |
| `INVALID_ARGS` | Tham số sai (ví dụ `baseHash` phải là 64 ký tự hex thường). |
| Cổng bận | Cả 10 cổng 47821–47830 đều bị chiếm: máy chủ báo `no free port`. Đóng tiến trình đang giữ cổng rồi chạy lại. |

## 8. Quyền riêng tư

Mọi lệnh đọc/ghi chạy giữa client AI trên máy bạn và Chrome của bạn. Chỉ khi bạn bấm Cho phép ở `share_doc` thì nội dung tài liệu đó mới được đưa lên máy chủ chia sẻ, giống như tự bấm Chia sẻ trong MD Reader. Client AI của bạn vẫn xử lý nội dung mà nó đọc theo chính sách của nhà cung cấp client đó.
