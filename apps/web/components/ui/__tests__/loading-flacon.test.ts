import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LoadingFlacon } from '../loading-flacon';

describe('LoadingFlacon', () => {
  it('announces its label once and hides the drawing from screen readers', () => {
    const html = renderToStaticMarkup(createElement(LoadingFlacon, { label: 'Choosing today’s picks…' }));
    expect(html).toContain('role="status"');
    expect(html).toContain('Choosing today’s picks…');
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(html.match(/role="status"/g)).toHaveLength(1);
  });
  it('compact variant for inline use', () => {
    const html = renderToStaticMarkup(createElement(LoadingFlacon, { label: 'Updating', size: 'sm' }));
    expect(html).toContain('width="22"');
  });
});
