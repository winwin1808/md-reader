import { EXTENSION_VERSION } from '../shared/version'

/**
 * PLACEHOLDER — 1h1 phải THAY TRỌN thân file này, không thêm
 * code bên cạnh. Nó chỉ tồn tại để bundle không bị tree-shake
 * về 0 byte, nhờ đó cổng ngân sách gz ở 1h2 đo được thật.
 *
 * Tên marker `mdReaderPlaceholder` là cố ý: cổng ở 1h2 grep
 * chuỗi đó trong `dist/content.js` và FAIL nếu còn, nên dòng
 * này không thể lọt vào bản ship một cách im lặng.
 */
document.documentElement.dataset.mdReaderPlaceholder = EXTENSION_VERSION
