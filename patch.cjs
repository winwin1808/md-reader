const fs = require('fs')
let content = fs.readFileSync('docs/DESIGN.md', 'utf8')
content = content.replace(
  /### Phase 2 — Export[\s\S]*?### Phase 3/,
`### Phase 2 — Export & Themes

Ship: *giao diện typography đẹp (5 themes), một tài liệu bất kỳ ra được HTML, PDF, Word.*

| # | Phase con | Xong nghĩa là |
|---|---|---|
| 2a | Typography & Themes | Bổ sung typography cho Viewer, UI chọn 5 theme màu, lưu trạng thái theme. |
| 2b | HTML self-contained | Inline CSS, SVG đã render, ảnh base64; mở offline vẫn đúng |
| 2c | mdast → docx | Heading, đoạn, list, table, code, link, ảnh |
| 2d | SVG → PNG | Raster hoá chart để nhúng docx |
| 2e | Print CSS + PDF | \`@page\`, ngắt trang, \`window.print()\` |
| 2f | \`ExportDialog\` | Nối đường trên vào UI có nút Export |
| 2g | E2E khói | Playwright: mở file → xuất đủ 3 định dạng |

### Phase 3`
)
fs.writeFileSync('docs/DESIGN.md', content)
