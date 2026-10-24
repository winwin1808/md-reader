export function getDefaultExportCss(): string {
  return `
body {
  margin: 0;
  padding: 32px 24px;
  background-color: #F1F3F2;
  color: #1B2422;
  font-family: Literata, Georgia, serif;
  font-size: 1.125rem;
  line-height: 1.62;
  box-sizing: border-box;
}

.md-viewer,
.markdown-body {
  max-width: 68ch;
  margin: 0 auto;
  color: #1B2422;
  word-wrap: break-word;
}

h1, h2, h3, h4, h5, h6 {
  margin-top: 1.6em;
  margin-bottom: 0.6em;
  font-weight: 600;
  line-height: 1.25;
  color: #1B2422;
}

h1 { font-size: 2em; }
h2 { font-size: 1.5em; padding-bottom: 0.2em; border-bottom: 1px solid #D3DAD7; }
h3 { font-size: 1.25em; }
h4 { font-size: 1em; }

p, ul, ol, dl, table, pre, details {
  margin-top: 0;
  margin-bottom: 1em;
}

a {
  color: #23568C;
  text-decoration: underline;
}

mark {
  background-color: #F3DE4A;
  color: #1B2422;
}

blockquote {
  margin: 0 0 1em 0;
  padding: 0 1em;
  color: #5E6A67;
  border-left: 3px solid #D3DAD7;
}

.markdown-alert {
  margin: 0 0 1em 0;
  padding: 0.5em 1em;
  float: none;
  background-color: #E5EAE7;
  color: #1B2422;
  border-left: 3px solid #23568C;
}

.markdown-alert-title {
  margin: 0 0 0.3em 0;
  font-family: "IBM Plex Sans", system-ui, sans-serif;
  font-size: 0.85em;
  font-weight: 600;
  color: #5E6A67;
}

code {
  padding: 0.15em 0.35em;
  font-size: 0.88em;
  font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  background-color: #E5EAE7;
  border-radius: 4px;
}

pre {
  padding: 1em;
  overflow: auto;
  font-size: 0.88em;
  line-height: 1.5;
  background-color: #E5EAE7;
  border: 1px solid #D3DAD7;
  border-radius: 4px;
}

pre code {
  padding: 0;
  font-size: 100%;
  white-space: pre;
  background: transparent;
}

.hljs-keyword, .hljs-selector-tag, .hljs-literal { color: #7A3E9D; }
.hljs-string, .hljs-regexp, .hljs-addition { color: #2F6B45; }
.hljs-comment, .hljs-quote { color: #5A6663; font-style: italic; }
.hljs-number { color: #8A500F; }
.hljs-title, .hljs-function, .hljs-title.function_ { color: #23568C; }
.hljs-type, .hljs-class .hljs-title, .hljs-title.class_ { color: #8C4A2F; }
.hljs-attr, .hljs-attribute { color: #5A6B1F; }
.hljs-meta, .hljs-built_in { color: #5E6A67; }

table {
  border-spacing: 0;
  border-collapse: collapse;
  display: table;
  width: 100%;
  table-layout: auto;
  box-sizing: border-box;
  margin-bottom: 1.5em;
  font-family: "IBM Plex Sans", system-ui, sans-serif;
  font-size: 0.9em;
}

table th,
table td {
  padding: 0.5em 0.8em;
  border: 1px solid #D3DAD7;
  vertical-align: middle;
  word-break: break-word;
}

table th {
  font-weight: 600;
  background-color: #E5EAE7;
}

hr {
  height: 1px;
  margin: 2em 0;
  background-color: #D3DAD7;
  border: 0;
}

img {
  max-width: 100%;
}

.katex-html {
  display: none;
}

.katex-display {
  text-align: center;
  margin: 1em 0;
}
`.trim()
}
