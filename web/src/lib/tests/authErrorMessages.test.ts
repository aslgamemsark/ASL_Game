import { describe, expect, it } from 'vitest';
import { friendlyAuthError } from '../authErrorMessages';

describe('friendlyAuthError', () => {
  it('maps known Supabase failures and preserves unknown details', () => {
    expect(friendlyAuthError('Invalid login credentials')).toBe('Incorrect email or password.');
    expect(friendlyAuthError('Rate limit exceeded')).toContain('Too many attempts');
    expect(friendlyAuthError('Failed to fetch')).toContain('Connection problem');
    expect(friendlyAuthError('A new error')).toBe('A new error');
  });
});
