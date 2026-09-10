import { EXTENSION_VERSION } from '../shared/version'

/**
 * 1h1 thay thân file này: shouldActivate → extractSource →
 * parseMarkdown → renderToHtml → mountReader + nút "Mở trong
 * MD Reader". Hiện chỉ đánh dấu để bundle không bị tree-shake
 * về 0 byte, nhờ đó cổng ngân sách gz đo được thật.
 */
document.documentElement.dataset.mdReader = EXTENSION_VERSION
