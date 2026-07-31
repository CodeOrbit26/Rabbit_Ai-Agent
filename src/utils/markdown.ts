import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';

const marked = new Marked(
  markedHighlight({
    emptyLangClass: 'hljs',
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    },
  })
);

marked.setOptions({
  breaks: true,
  gfm: true,
});

// Custom renderer to add copy buttons to code blocks
const renderer = new marked.Renderer();

renderer.code = function({ text, lang }: { text: string; lang?: string }) {
  const language = lang || '';
  const displayLang = language || 'text';
  const highlighted = hljs.getLanguage(language)
    ? hljs.highlight(text, { language }).value
    : text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<div class="code-block">
    <div class="code-block-header">
      <span class="code-block-lang">${displayLang}</span>
      <button class="code-copy-btn" onclick="(function(btn){var code=btn.closest('.code-block').querySelector('code').textContent;navigator.clipboard.writeText(code).then(function(){btn.innerHTML='Copied!';setTimeout(function(){btn.innerHTML='Copy code'},2000)});})(this)">Copy code</button>
    </div>
    <pre><code class="hljs language-${language}">${highlighted}</code></pre>
  </div>`;
};

renderer.table = function(token: any) {
  const headerHtml = typeof token.header === 'string' ? token.header : '';
  const bodyHtml = Array.isArray(token.rows) ? token.rows.join('') : (token.body || '');
  return `<div class="table-wrapper"><table><thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody></table></div>`;
};

marked.use({ renderer });

export function renderMarkdown(text: string): string {
  try {
    return marked.parse(text) as string;
  } catch {
    return text;
  }
}
