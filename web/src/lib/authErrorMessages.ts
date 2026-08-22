// Maps Supabase GoTrue's raw error messages to first-person, actionable copy.
//
// Why this exists (autonomous red-team round): AuthModal rendered `error.message` from
// signInWithEmail/signUpWithEmail verbatim, so real users saw GoTrue's machine voice —
// most commonly "Invalid API key" style internals on misconfig and the terse "Invalid login
// credentials" for a wrong password, with no recovery hint. The enumeration-protection rules in
// authErrors.ts are untouched: nothing here re-introduces an oracle (these classes are all
// response-shape based, not existence-based).
//
// Unknown messages fall through unchanged: showing the original string is strictly better than a
// generic "Something went wrong" that hides a specific, useful detail (e.g. rate-limit wording),
// and every mapped class below is one a real user can act on.

export function friendlyAuthError(rawMessage: string | null | undefined): string | null {
  if (!rawMessage) return null;
  const m = rawMessage.toLowerCase();

  if (m.includes('invalid login credentials')) {
    return 'Incorrect email or password.';
  }
  if (m.includes('email not confirmed')) {
    return 'Please confirm your email first — check your inbox for the confirmation link.';
  }
  if (m.includes('rate limit') || m.includes('too many requests') || m.includes('for security purposes')) {
    return 'Too many attempts — wait a minute and try again.';
  }
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed')) {
    return "Connection problem — check your internet and try again.";
  }
  if (m.includes('user not found') || m.includes('signup requires a valid password')) {
    // Shouldn't normally surface (form validation runs client-side first) but map defensively.
    return m.includes('password')
      ? 'Password must be at least 8 characters.'
      : 'Incorrect email or password.';
  }
  if (m.includes('password should be at least')) {
    return 'Password must be at least 8 characters.';
  }
  if (m.includes('invalid api key') || m.includes('supabase url')) {
    // Misconfiguration — developer-facing, keep technical but explain the user-visible effect.
    return 'Sign-in is temporarily unavailable. Try again shortly.';
  }
  return rawMessage;
}
