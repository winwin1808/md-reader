export interface ReleaseNote {
  version: string;
  showOnUpdate: boolean;
  title: { vi: string; en: string };
  items: { vi: string[]; en: string[] };
}

/** Mới nhất trước. */
export const RELEASE_NOTES: readonly ReleaseNote[] = [
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
