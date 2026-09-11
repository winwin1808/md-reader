export function getDefaultExportCss(): string {
  return `
:root {
  --md-bg: #ffffff;
  --md-fg: #1f2328;
  --md-fg-muted: #656d76;
  --md-border: #d0d7de;
  --md-code-bg: #f6f8fa;
  --md-link: #0969da;
  --md-quote-border: #d0d7de;
  --md-table-alt: #f6f8fa;
}

@media (prefers-color-scheme: dark) {
  :root {
    --md-bg: #0d1117;
    --md-fg: #e6edf3;
    --md-fg-muted: #848d97;
    --md-border: #30363d;
    --md-code-bg: #161b22;
    --md-link: #4493f8;
    --md-quote-border: #30363d;
    --md-table-alt: #161b22;
  }
}

body {
  margin: 0;
  padding: 32px 24px;
  background-color: var(--md-bg);
  color: var(--md-fg);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
  font-size: 17px;
  line-height: 1.7;
  display: flex;
  justify-content: center;
  box-sizing: border-box;
}

.markdown-body {
  width: 100%;
  max-width: 740px;
  font-size: 17px;
  line-height: 1.7;
  color: var(--md-fg);
  background-color: transparent;
  word-wrap: break-word;
}

h1, h2, h3, h4, h5, h6 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
  color: var(--md-fg);
}

h1 {
  font-size: 2em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--md-border);
}

h2 {
  font-size: 1.5em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--md-border);
}

h3 {
  font-size: 1.25em;
}

h4 {
  font-size: 1em;
}

p, ul, ol, dl, table, pre, details {
  margin-top: 0;
  margin-bottom: 16px;
}

a {
  color: var(--md-link);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

blockquote {
  margin: 0 0 16px 0;
  padding: 0 1em;
  color: var(--md-fg-muted);
  border-left: 0.25em solid var(--md-quote-border);
}

code {
  padding: 0.2em 0.4em;
  margin: 0;
  font-size: 85%;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  background-color: var(--md-code-bg);
  border-radius: 6px;
}

pre {
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: var(--md-code-bg);
  border-radius: 6px;
}

pre code {
  padding: 0;
  margin: 0;
  font-size: 100%;
  word-break: normal;
  white-space: pre;
  background: transparent;
  border: 0;
}

table {
  border-spacing: 0;
  border-collapse: collapse;
  display: block;
  width: max-content;
  max-width: 100%;
  overflow: auto;
  margin-top: 0;
  margin-bottom: 16px;
}

table th,
table td {
  padding: 6px 13px;
  border: 1px solid var(--md-border);
}

table th {
  font-weight: 600;
  background-color: var(--md-code-bg);
}

table tr:nth-child(2n) {
  background-color: var(--md-table-alt);
}

hr {
  height: 0.25em;
  padding: 0;
  margin: 24px 0;
  background-color: var(--md-border);
  border: 0;
}

img {
  max-width: 100%;
  box-sizing: content-box;
}
`.trim()
}
