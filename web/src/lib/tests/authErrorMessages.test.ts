import { describe, it, expect } from 'vitest';
import { friendlyAuthError } from '../authErrorMessages';

describe('friendlyAuthError', () => {
  it('returns null for null/undefined input (success path)', () => {
    expect(friendlyAuthError(null)).toBeNull();
    expect(friendlyAuthError(undefined)).toBeNull();
    expect(friendlyAuthError('')).toBeNull();
  });

  it('maps invalid credentials to a clear, non-blaming message', () => {
    expect(friendlyAuthError('Invalid login credentials')).toBe('Incorrect email or password.');
  });

  it('maps unconfirmed email to the confirmation recovery path', () => {
    const out = friendlyAuthError('Email not confirmed');
    expect(out).toContain('confirm your email');
  });

  it('maps rate limiting to a wait instruction', () => {
    expect(
      friendlyAuthError('Rate limit exceeded')
    ).toContain('Too many attempts');
    expect(
      friendlyAuthError('For security purposes, you can only request this once every 60 seconds')
    ).toContain('Too many attempts');
  });

  it('maps network failures to a connection message', () => {
    expect(friendlyAuthError('Failed to fetch')).toContain('Connection problem');
    expect(friendlyAuthError('NetworkError when attempting to fetch resource.')).toContain('Connection problem');
  });

  it('maps password policy errors to the concrete requirement', () => {
    expect(friendlyAuthError('Password should be at least 8 characters.')).toContain('at least 8 characters');
  });

  it('never weakens enumeration protections (no existence hints introduced)', () => {
    // The mapper is response-shape based; feeding it an already-registered-style message that
    // upstream code intercepts BEFORE calling this must fall through untouched.
    expect(friendlyAuthError('User already registered')).toBe('User already registered');
  });

  it('passes unknown messages through unchanged rather than hiding specifics', () => {
    expect(friendlyAuthError('Some brand new GoTrue error text')).toBe('Some brand new GoTrue error text');
  });
});
