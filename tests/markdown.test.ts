import { describe, expect, it } from 'vitest';
import { markdownToSafeHtml } from '../lib/markdown';

describe('markdownToSafeHtml', () => {
  it('Gemini 답변의 제목, 굵게, 목록, 링크를 HTML로 렌더링한다', () => {
    const html = markdownToSafeHtml('## 추천 요약\n\n- **정보** 과목\n- [CareerNet](https://www.career.go.kr) 근거');

    expect(html).toContain('<h2>추천 요약</h2>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<strong>정보</strong>');
    expect(html).toContain('<a href="https://www.career.go.kr" target="_blank" rel="noreferrer">CareerNet</a>');
  });

  it('원본 HTML과 javascript 링크를 이스케이프해 안전하게 표시한다', () => {
    const html = markdownToSafeHtml('<script>alert(1)</script>\n[나쁜 링크](javascript:alert(1))');

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('[나쁜 링크](javascript:alert(1))');
  });
});
