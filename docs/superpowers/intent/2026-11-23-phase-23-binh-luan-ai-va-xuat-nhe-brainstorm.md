# Brainstorm: Phase 23+ — Gom v1.4 + v1.5 còn lại, lọc bỏ thứ nặng/ít người dùng

## Ý tưởng thô ban đầu

Người dùng (2026-11-23): làm tiếp v1.4 và v1.5, **không** làm Cloud, 2.0, Edge Add-ons, Firefox AMO
(đã gỡ khỏi ROADMAP/README). Ứng viên:

- Sơ đồ: PlantUML, Graphviz, Vega-Lite, ECharts, draw.io, Infographic, OpenAPI/Swagger
- Xuất: EPUB, bảng ra XLSX, từng hình ra SVG/PNG
- Giao diện tài liệu (business / academic / technical), tài liệu lớn render dần, thêm ngôn ngữ giao diện
- Bình luận trên tài liệu chia sẻ, AI đọc được bình luận qua MCP và tự giải quyết

Yêu cầu: mục nào kỹ thuật phức tạp, build nhiều, ít người dùng thì loại.

## Nghiên cứu thị trường

- **docu.md / Markdown Viewer (xicilion)** — [Chrome Web Store](https://chromewebstore.google.com/detail/jekhhoflgcfoikceikgeenibinpojaoi),
  [GitHub](https://github.com/xicilion/markdown-viewer-extension): nguồn cảm hứng gốc của mục v1.4. Bán điểm
  "9 loại sơ đồ" (PlantUML, draw.io, ECharts, Infographic…) và xuất Word có sơ đồ dạng ảnh. Đây là cuộc
  đua đếm định dạng; ta đã có mermaid + excalidraw + KaTeX + Word OMML, đuổi theo danh sách này không tạo khác biệt.
- **MD Viewer** ([store](https://chromewebstore.google.com/detail/bpgiinhckegchpchoalkchkbaebeallo)) và
  **Markdown Diagrams** ([store](https://chrome.google.com/webstore/detail/markdown-diagrams/pmoglnmodacnbbofbgcagndelmgaclel/)):
  Graphviz + Vega phổ biến hơn trong nhóm extension; Markdown Diagrams render PlantUML/Graphviz/Vega thành ảnh.
  Không extension nào trong kết quả tìm kiếm có xuất EPUB.
- **Mermaid vs PlantUML** — [Wild & Free Tools](https://wildandfreetools.com/blog/plantuml-vs-mermaid-sequence-diagram-comparison/):
  PlantUML cần Java hoặc máy chủ render; Mermaid render gốc trên GitHub/GitLab/Notion.
  [DEV 2026](https://dev.to/levi_liu/mermaid-vs-plantuml-in-2026-which-to-pick-for-engineering-docs-59dm):
  phần lớn LLM mặc định sinh Mermaid khi được yêu cầu sơ đồ trong Markdown (ý kiến, không phải số liệu khảo sát).
  → Người dùng mục tiêu của ta (nhờ AI viết tài liệu) gần như luôn nhận Mermaid.
- **HackMD** — [A new era of commenting (02/2024)](https://hackmd.io/blog/2024/02/06/a-new-era-of-commenting),
  [Suggest Edit (04/2024)](https://hackmd.io/blog/2024/04/17/introducing-suggest-edit): bình luận inline +
  panel bên, thông báo, Resolve/Hide; trang chủ hiện quảng bá "[where teams and agents](https://homepage.hackmd.io/)"
  — đối thủ Markdown cộng tác đang đi đúng hướng "người + agent cùng duyệt".
- **MCP cho vòng duyệt bình luận** — [Strunk](https://mcpservers.org/servers/strunk-io-docs): đẩy bản nháp lên
  Google Docs, kéo bình luận về kèm đoạn chữ được neo, áp bản sửa đã duyệt, trả lời + resolve thread, hỏi người
  trước khi đổi. [gdocs-mcp (dasasian)](https://images.glama.ai/mcp/servers/dasasian/gdocs-mcp): đọc thread
  (tác giả, đoạn trích, trạng thái resolve), trả lời, resolve. [gdocs-comments-mcp](https://socket.dev/npm/package/gdocs-comments-mcp)
  ghi rõ API Google không tạo được bình luận neo theo vùng chữ.
  → Nhu cầu "AI đọc góp ý rồi sửa" có thật, nhưng hiện phải vòng qua Google Docs + OAuth đọc được cả Drive.
  Ta làm được vòng đó **trong chính tài liệu Markdown**, cục bộ, quyền hẹp — đây là khác biệt thật.

## Nhu cầu người dùng

Người dùng mục tiêu (ROADMAP): người nhờ AI viết Markdown (báo cáo, đề xuất, tài liệu kỹ thuật) rồi gửi link
cho đồng nghiệp/khách. Hiện người nhận chỉ xem hoặc sửa thẳng; góp ý phải gửi qua chat, rồi người viết chép lại
cho AI. Đau thật nằm ở **vòng góp ý**, không ở số loại sơ đồ.

Nhu cầu phụ, rẻ: lấy bảng trong báo cáo sang Excel; lấy một sơ đồ ra slide/chat; tài liệu gửi khách trông
"công sở" hơn giao diện Lề sách mặc định.

## Đánh giá từng mục

| Mục | Kỹ thuật | Công build | Người dùng | Kết luận |
|---|---|---|---|---|
| PlantUML | Cần Java hoặc gửi nội dung lên máy chủ plantuml.com (vỡ cam kết riêng tư); bản JS chạy CheerpJ nặng nhiều MB | Lớn | Thấp — AI sinh Mermaid | **Loại** |
| draw.io | Phải nạp `viewer.min.js` (~2 MB) từ diagrams.net — MV3 cấm script từ xa, đóng gói thì quá nặng | Lớn | Thấp | **Loại** |
| Infographic (AntV) | Thư viện ngách, cú pháp riêng | Vừa | Rất thấp | **Loại** |
| OpenAPI/Swagger | swagger-ui ~1 MB, CSS riêng đè Lề sách; spec API ít khi nằm trong `.md` | Lớn | Thấp | **Loại** |
| ECharts | ~300 KB gz, trùng vai Vega-Lite; option JSON phổ biến chủ yếu ở hệ sinh thái Trung Quốc | Vừa | Thấp | **Loại** (giữ một thư viện biểu đồ) |
| EPUB | Đóng gói OPF/XHTML, ảnh, sơ đồ → ảnh; ít ai đọc báo cáo bằng EPUB | Vừa | Rất thấp | **Loại** |
| Tài liệu lớn render dần | Đụng ràng buộc khoá cứng #5 (re-parse toàn bộ); virtual render vỡ ToC/tìm kiếm/cuộn đồng bộ/slide | Lớn | Chưa có ai phàn nàn | **Loại** (mở lại khi có báo cáo thật + số đo) |
| Thêm ngôn ngữ giao diện | Rẻ lúc đầu, nhưng mọi chuỗi mới về sau phải dịch N thứ tiếng | Nhỏ + nợ dài hạn | Chưa có dữ liệu | **Loại khỏi phase**; dịch listing store là đủ để kéo người dùng |
| Graphviz / dot | `@hpcc-js/wasm-graphviz` nạp lười ở app page, offline, CSP MV3 cho phép `wasm-unsafe-eval` | Nhỏ-vừa | Vừa (dev) | **Giữ, ưu tiên thấp** |
| Vega-Lite | `vega-embed` nạp lười; dùng `vega-interpreter` để không cần `eval` | Vừa | Vừa (báo cáo có số liệu) | **Giữ, ưu tiên thấp** |
| Xuất từng hình SVG/PNG | Đã có rasterizer + xuất SVG/PNG của mindmap — tái dùng | Nhỏ | Vừa | **Giữ** |
| Bảng ra XLSX | Viết SpreadsheetML tối thiểu + `fflate` (đã là dependency), không kéo SheetJS | Nhỏ | Vừa-cao (báo cáo) | **Giữ** |
| Giao diện tài liệu business/academic/technical | Bộ token CSS + áp vào export HTML/PDF/Word | Vừa | Vừa | **Giữ, gọn: 2–3 giao diện** |
| Bình luận + AI xử lý qua MCP | Đổi schema Y.Doc (migration + fixture), neo bằng `Y.RelativePosition`, peer-guard máy chủ, tool MCP mới, UI panel | Lớn | Cao — đúng đau của người dùng mục tiêu, khác biệt thật | **Giữ, là trọng tâm** |

## Các hướng đã cân nhắc

**A. Bình luận + AI trước, gói "xuất nhẹ" sau (hai phase).**
Phase 23: bình luận trên tài liệu chia sẻ + tool MCP đọc/trả lời/resolve. Phase 24: XLSX, xuất từng hình,
giao diện tài liệu, rồi Graphviz/Vega-Lite nếu còn sức.
Đánh đổi: phase 23 rủi ro cao nhất (schema + máy chủ + bảo mật) nên làm khi đầu còn tươi; người dùng chờ lâu
hơn một chút mới có các món nhỏ.

**B. Gói "xuất nhẹ" trước, bình luận sau.**
Ship nhanh vài thứ thấy ngay (XLSX, export hình, giao diện tài liệu), rồi mới bình luận.
Đánh đổi: an toàn, nhưng toàn món "có cũng được"; khác biệt chính (vòng góp ý với AI) bị đẩy lùi.

**C. Làm đủ danh sách v1.4 như docu.md.**
Đánh đổi: nhiều tháng, bundle app page phình (đã ~450 KB gz), cạnh tranh trên sân của đối thủ bằng
danh sách định dạng — đúng thứ người dùng yêu cầu loại.

## Hướng đề xuất

**Hướng A.** Phase 23 = **Bình luận + AI xử lý góp ý**, phạm vi gọn:

- Người có link (xem hoặc sửa — cần chốt) bình luận neo vào một đoạn chữ đã chọn; thread có trả lời và Resolve.
- Panel Bình luận ở app page và web `/s/:token`; mốc nhỏ ở lề đoạn có bình luận (hợp ngôn ngữ "ghi chú lề" của Lề sách).
- MCP: `list_comments` (kèm đoạn chữ được neo, trạng thái), `reply_comment`, `resolve_comment`. AI sửa nội dung
  bằng `update_doc` hiện có rồi resolve; tài liệu đang chia sẻ vẫn qua hộp xác nhận như phase 22.
- Không làm: đề xuất chỉnh sửa (suggestion mode), thông báo email, @mention.

Phase 24 = **Xuất & hiển thị nhẹ**: bảng ra XLSX, xuất từng hình SVG/PNG, 2–3 giao diện tài liệu; Graphviz + Vega-Lite
nạp lười cuối phase nếu ngân sách còn.

ROADMAP cập nhật: chuyển các mục bị loại sang mục "Đã cân nhắc, không làm" kèm lý do một dòng.

## Câu hỏi mở cho intent

1. Ai được bình luận: chỉ link sửa, hay cả link xem? (Link xem bình luận được thì peer-guard phải cho link xem
   ghi đúng một vùng `comments` — thay đổi mô hình quyền hiện tại.)
2. Bình luận có ở tài liệu **chưa chia sẻ** không (tự ghi chú cho mình / cho AI)? Nếu có, đây là đường ngắn nhất để
   AI dùng được ngay mà không cần máy chủ.
3. Bình luận lưu ở đâu: `Y.Map "comments"` trong cùng Y.Doc (đồng bộ sẵn, nhưng đổi schema → `formatVersion` 3
   + migration) hay tách subdoc?
4. Khi đoạn chữ được neo bị xoá: bình luận thành "mồ côi" hiển thị riêng hay tự resolve?
5. AI resolve có cần người xác nhận từng cái, hay chỉ xác nhận lần sửa nội dung (`update_doc`) là đủ?

## Quyết định của người dùng (2026-11-23)

- Chốt **hướng A**: phase 23 bình luận + AI; phase 24 XLSX, xuất từng hình, giao diện tài liệu, Graphviz/Vega-Lite.
- Câu 1: **cả link xem** được bình luận (máy chủ cho link xem ghi riêng vùng bình luận).
- Câu 2: **có** bình luận trên tài liệu chưa chia sẻ.
- Câu 5: **xác nhận lần sửa là đủ** — AI sửa qua `update_doc` (đã có hộp xác nhận với tài liệu chia sẻ), rồi tự trả lời + resolve, ghi tên AI.
- Câu 3, 4: để `design-from-intent` quyết.
