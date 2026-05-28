function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function renderInline(markdown: string): string {
  const escaped = escapeHtml(markdown);
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label: string, href: string) => {
      if (!isSafeHttpUrl(href)) return `[${label}](${href})`;
      return `<a href="${href}" target="_blank" rel="noreferrer">${label}</a>`;
    });
}

function flushList(html: string[], listItems: string[], ordered: boolean): void {
  if (!listItems.length) return;
  const tag = ordered ? 'ol' : 'ul';
  html.push(`<${tag}>${listItems.map((item) => `<li>${item}</li>`).join('')}</${tag}>`);
  listItems.length = 0;
}

export function markdownToSafeHtml(markdown: string): string {
  const html: string[] = [];
  const listItems: string[] = [];
  let orderedList = false;

  for (const rawLine of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushList(html, listItems, orderedList);
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.+)$/);
    const orderedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (unorderedMatch || orderedMatch) {
      const isOrdered = Boolean(orderedMatch);
      if (listItems.length && orderedList !== isOrdered) flushList(html, listItems, orderedList);
      orderedList = isOrdered;
      listItems.push(renderInline((unorderedMatch ?? orderedMatch)![1]));
      continue;
    }

    flushList(html, listItems, orderedList);

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    html.push(`<p>${renderInline(trimmed)}</p>`);
  }

  flushList(html, listItems, orderedList);
  return html.join('');
}
