import { describe, it, expect } from 'vitest';
import { nextTabIndex } from '../src/lib/tabListNav';

describe('nextTabIndex', () => {
  it('advances and wraps on ArrowRight', () => {
    expect(nextTabIndex('ArrowRight', 0, 3)).toBe(1);
    expect(nextTabIndex('ArrowRight', 2, 3)).toBe(0);
  });

  it('retreats and wraps on ArrowLeft', () => {
    expect(nextTabIndex('ArrowLeft', 1, 3)).toBe(0);
    expect(nextTabIndex('ArrowLeft', 0, 3)).toBe(2);
  });

  it('jumps to the ends on Home/End', () => {
    expect(nextTabIndex('Home', 2, 3)).toBe(0);
    expect(nextTabIndex('End', 0, 3)).toBe(2);
  });

  it('returns null for keys it does not handle', () => {
    expect(nextTabIndex('Enter', 0, 3)).toBeNull();
    expect(nextTabIndex('ArrowDown', 0, 3)).toBeNull();
  });
});
