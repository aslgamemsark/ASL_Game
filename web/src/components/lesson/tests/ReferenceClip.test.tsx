import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReferenceClip } from '../ReferenceClip';

describe('ReferenceClip controls', () => {
  it('shows only enlarge while the clip is compact and restores all controls when it expands', () => {
    const html = renderToStaticMarkup(
      <ReferenceClip clipUrl="/clips/hello.mp4" signName="HELLO" compact />,
    );

    expect(html).not.toContain('controls=""');
    expect(html).toContain('aria-label="Enlarge reference clip"');
    expect(html).toMatch(/aria-label="Restart reference clip" class="[^"]*hidden/);
    expect(html).toMatch(/aria-label="Mirror reference clip" class="[^"]*hidden/);
    expect(html).toMatch(/<div class="[^"]*hidden[^"]*"><button[^>]*>0.5×/);
  });

  it('keeps the complete custom control set on full-size clips', () => {
    const html = renderToStaticMarkup(
      <ReferenceClip clipUrl="/clips/hello.mp4" signName="HELLO" />,
    );

    expect(html).toContain('aria-label="Restart reference clip"');
    expect(html).toContain('controls=""');
    expect(html).toContain('aria-label="Mirror reference clip"');
    expect(html).toContain('aria-label="Enlarge reference clip"');
    expect(html).toContain('0.5×');
    expect(html).toContain('0.75×');
    expect(html).toContain('1×');
    expect(html).toContain('pointer-events-none');
    expect(html).toContain('bottom-12');
  });
});
