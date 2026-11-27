import type { Locale } from '@md-reader/ui';

export type Localized<T> = { vi: T; en: T } & Partial<Record<'it' | 'fr' | 'de', T>>;

export interface ReleaseNote {
  version: string;
  showOnUpdate: boolean;
  title: Localized<string>;
  items: Localized<string[]>;
}

export function noteText<T>(v: Localized<T>, locale: Locale): T {
  return v[locale] ?? v.en;
}

/** Mới nhất trước. */
export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    version: '1.7.0',
    showOnUpdate: true,
    title: {
      vi: 'Năm ngôn ngữ',
      en: 'Five languages',
      it: 'Cinque lingue',
      fr: 'Cinq langues',
      de: 'Fünf Sprachen',
    },
    items: {
      vi: [
        'MD Reader giờ có tiếng Việt, Anh, Ý, Pháp, Đức và tự theo ngôn ngữ của Chrome.',
        'Bạn có thể đổi ngôn ngữ bất cứ lúc nào ở Cài đặt → Chữ và màu.',
        'Trang chào, tài liệu mẫu, Có gì mới và tab đọc trên các trang .md cũng đã được dịch.',
        'Mở một tệp không phải Markdown hay văn bản giờ hiện thông báo rõ ràng thay vì lặng lẽ thất bại.',
      ],
      en: [
        'MD Reader now speaks Vietnamese, English, Italian, French and German, and follows your Chrome language automatically.',
        'Pick a different language any time in Settings → Fonts and colors.',
        'The welcome page, sample document, What\'s new and the reading tab on .md pages are translated too.',
        'Opening a file that isn\'t Markdown or text now shows a clear message instead of failing silently.',
      ],
      it: [
        'MD Reader ora parla vietnamita, inglese, italiano, francese e tedesco e segue automaticamente la lingua di Chrome.',
        'Puoi scegliere un\'altra lingua in qualsiasi momento in Impostazioni → Caratteri e colori.',
        'Anche la pagina di benvenuto, il documento di esempio, le Novità e la scheda di lettura nelle pagine .md sono tradotti.',
        'Aprire un file che non è Markdown o testo ora mostra un messaggio chiaro invece di fallire in silenzio.',
      ],
      fr: [
        'MD Reader parle désormais vietnamien, anglais, italien, français et allemand, et suit automatiquement la langue de Chrome.',
        'Vous pouvez choisir une autre langue à tout moment dans Paramètres → Polices et couleurs.',
        'La page d\'accueil, le document d\'exemple, les Nouveautés et l\'onglet de lecture des pages .md sont eux aussi traduits.',
        'L\'ouverture d\'un fichier qui n\'est ni Markdown ni texte affiche désormais un message clair au lieu d\'échouer en silence.',
      ],
      de: [
        'MD Reader spricht jetzt Vietnamesisch, Englisch, Italienisch, Französisch und Deutsch und folgt automatisch der Sprache von Chrome.',
        'Sie können die Sprache jederzeit unter Einstellungen → Schriften und Farben ändern.',
        'Auch die Willkommensseite, das Beispieldokument, die Neuigkeiten und der Lese-Tab auf .md-Seiten sind übersetzt.',
        'Beim Öffnen einer Datei, die weder Markdown noch Text ist, erscheint jetzt eine klare Meldung statt eines stillen Fehlers.',
      ],
    },
  },
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
