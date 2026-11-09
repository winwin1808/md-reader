export const WELCOME_ORIGIN = {
  vi: 'mdr://welcome/vi',
  en: 'mdr://welcome/en',
} as const;

const VI = `# Chào mừng đến MD Reader

MD Reader giúp bạn đọc, sửa và trình chiếu file Markdown ngay trong trình duyệt. Đây là tài liệu mẫu ngắn để bạn làm quen.

---

## Đọc

Mở một link \`.md\` là đọc đẹp ngay. Mục lục bám theo mục bạn đang đọc.

### Phím tắt

| Phím | Việc |
|---|---|
| Cmd/Ctrl + F | Tìm trong tài liệu |
| Cmd/Ctrl + M | Mở Sơ đồ |
| Cmd/Ctrl + S | Lưu |

---

## Sửa

Chuyển sang chế độ Sửa để gõ trực tiếp, dấu Markdown tự ẩn khi con trỏ đi chỗ khác.

### Mẹo

- Dán hoặc kéo ảnh vào tài liệu.
- Bảng sửa được từng ô.
- Ở chế độ Sửa, bấm nút Ngắt slide tại đây trên thanh định dạng để chèn chỗ cắt slide.

---

## Code

Khối code có tô màu và nút sao chép.

\`\`\`ts
function greet(name: string): string {
  return \`Xin chào, \${name}!\`;
}
\`\`\`

---

## Ghi chú

> [!TIP]
> Alert dùng để làm nổi một ghi chú trong tài liệu.

---

## Công thức

Công thức toán viết bằng KaTeX:

$$
E = mc^2
$$

---

## Sơ đồ

\`\`\`mermaid
flowchart LR
  A[Viết] --> B[Đọc]
  B --> C[Chia sẻ]
\`\`\`

---

## Trình chiếu

Bấm Trình chiếu để biến tài liệu thành slide, mở Sơ đồ để xem cấu trúc, hoặc xuất PDF để gửi đi.

<!-- note: Đây là ghi chú diễn giả, chỉ hiện ở chế độ speaker. -->
`;

const EN = `# Welcome to MD Reader

MD Reader lets you read, edit and present Markdown files right in your browser. This short sample document will get you started.

---

## Read

Open a \`.md\` link and it reads beautifully right away. The table of contents follows the section you are reading.

### Shortcuts

| Key | Action |
|---|---|
| Cmd/Ctrl + F | Search the document |
| Cmd/Ctrl + M | Open Mind map |
| Cmd/Ctrl + S | Save |

---

## Edit

Switch to Edit mode to type directly; Markdown marks hide when the cursor moves away.

### Tips

- Paste or drag images into the document.
- Tables are editable cell by cell.
- In Edit mode, press the Break slide here button on the formatting toolbar to insert a slide break.

---

## Code

Code blocks are highlighted and have a copy button.

\`\`\`ts
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

---

## Notes

> [!TIP]
> Alerts are used to make a note stand out in the document.

---

## Formulas

Math is written with KaTeX:

$$
E = mc^2
$$

---

## Diagrams

\`\`\`mermaid
flowchart LR
  A[Write] --> B[Read]
  B --> C[Share]
\`\`\`

---

## Present

Press Present to turn the document into slides, open Mind map to see its structure, or export to PDF to send it out.

<!-- note: This is a speaker note, only shown in speaker view. -->
`;

export function welcomeMarkdown(locale: 'vi' | 'en'): string {
  return locale === 'vi' ? VI : EN;
}
