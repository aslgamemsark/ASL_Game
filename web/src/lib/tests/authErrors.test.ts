import { describe, expect, it } from 'vitest';
import { isAlreadyRegisteredError } from '@/lib/authErrors';

describe('isAlreadyRegisteredError', () => {
  it('matches Supabase\'s classic "User already registered" message', () => {
    expect(isAlreadyRegisteredError('User already registered')).toBe(true);
  });

  it('matches the newer "already exists" wording, case-insensitively', () => {
    expect(isAlreadyRegisteredError('a user with this email ALREADY EXISTS')).toBe(true);
  });

  it('does not match unrelated signup errors', () => {
    expect(isAlreadyRegisteredError('Password should be at least 6 characters')).toBe(false);
    expect(isAlreadyRegisteredError('Unable to validate email address: invalid format')).toBe(false);
    expect(isAlreadyRegisteredError('Email rate limit exceeded')).toBe(false);
  });
});
