export interface ReleaseNote {
  version: string;
  showOnUpdate: boolean;
  title: { vi: string; en: string };
  items: { vi: string[]; en: string[] };
}

/** Mới nhất trước. */
export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    version: '1.6.0',
    showOnUpdate: true,
    title: { vi: 'Bình luận trên tài liệu', en: 'Comments on documents' },
    items: {
      vi: [
        'Chọn chữ rồi bấm Bình luận (hoặc Cmd/Ctrl+Shift+M), ở cả chế độ Đọc và Sửa.',
        'Người có link xem hoặc link sửa cũng bình luận, trả lời được ngay trên trang web.',
        'AI qua le-sach-mcp 1.4.0 đọc bình luận, trả lời và đánh dấu Xong.',
        'Kiểu tài liệu Kinh doanh / Học thuật / Kỹ thuật (Cài đặt → Hiển thị), áp cả khi xuất HTML, PDF, Word.',
        'Xem rộng ~80% màn hình bằng một nút trên thanh công cụ; panel Lịch sử dễ đọc hơn.',
      ],
      en: [
        'Select text and press Comment (or Cmd/Ctrl+Shift+M), in both Read and Edit modes.',
        'People with a view or edit link can comment and reply right on the web page.',
        'AI through le-sach-mcp 1.4.0 reads comments, replies and marks them Done.',
        'Business / Academic / Technical document styles (Settings → Display), also applied to HTML, PDF and Word export.',
        'Wide view (~80% of the screen) with one toolbar button; an easier-to-read History panel.',
      ],
    },
  },
  {
    version: '1.5.1',
    showOnUpdate: false,
    title: { vi: 'Kết nối AI gọn hơn', en: 'Tidier AI connection' },
    items: {
      vi: [
        'Không còn mở lặp tab hỏi cho phép khi có nhiều profile Chrome — mỗi ứng dụng AI chỉ hỏi một lần.',
        'Cài đặt → Kết nối AI hiện ứng dụng AI đang chạy và nút Kết nối để tự kết nối khi cần.',
        'Bấm Cho phép luôn có kết quả rõ: kết nối được, hoặc báo lý do.',
        'Muốn chuyển sang profile khác: chạy `npx le-sach-mcp unpair`.',
      ],
      en: [
        'No more repeated permission tabs when several Chrome profiles are open — each AI app asks once.',
        'Settings → AI connection lists AI apps running on this machine with a Connect button.',
        'Allow always ends with a clear result: connected, or the reason why not.',
        'To move to another profile: run `npx le-sach-mcp unpair`.',
      ],
    },
  },
  {
    version: '1.5.0',
    showOnUpdate: true,
    title: { vi: 'Có gì mới ở bản 1.5', en: "What's new in 1.5" },
    items: {
      vi: [
        'PDF trình chiếu không còn cắt chữ, slide dài tự chia',
        'Dấu <!-- slide-break --> và nút "Ngắt slide tại đây" khi Sửa',
        'Trang chào mới, tài liệu mẫu và hướng dẫn từng bước',
        'Sao lưu mọi tài liệu ra file .zip',
        'Gửi góp ý ngay trong Cài đặt',
      ],
      en: [
        'Slide PDFs no longer clip text; long slides split automatically',
        'The <!-- slide-break --> marker and a "Break slide here" button while editing',
        'A new welcome page, sample document and step-by-step tour',
        'Back up all your documents to a .zip file',
        'Send feedback right from Settings',
      ],
    },
  },
];
