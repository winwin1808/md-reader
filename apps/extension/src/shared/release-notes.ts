export interface ReleaseNote {
  version: string;
  showOnUpdate: boolean;
  title: { vi: string; en: string };
  items: { vi: string[]; en: string[] };
}

/** Mới nhất trước. */
export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    version: '1.5.0',
    showOnUpdate: true,
    title: { vi: 'Có gì mới ở bản 1.5', en: "What's new in 1.5" },
    items: {
      vi: [
        'PDF trình chiếu không còn cắt chữ, slide dài tự chia',
        'Dấu <!-- slide-break --> và nút "Ngắt slide tại đây" khi Sửa',
        'Trang chào và tài liệu mẫu cho người mới',
        'Sao lưu mọi tài liệu ra file .zip',
        'Gửi góp ý ngay trong Cài đặt',
      ],
      en: [
        'Slide PDFs no longer clip text; long slides split automatically',
        'The <!-- slide-break --> marker and a "Break slide here" button while editing',
        'A welcome page and sample document for new users',
        'Back up all your documents to a .zip file',
        'Send feedback right from Settings',
      ],
    },
  },
];
