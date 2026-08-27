export function friendlyAuthError(rawMessage: string | null | undefined): string | null {
  if (!rawMessage) return null;
  const message = rawMessage.toLowerCase();
  if (message.includes('invalid login credentials')) return 'Incorrect email or password.';
  if (message.includes('email not confirmed')) return 'Please confirm your email first — check your inbox for the confirmation link.';
  if (message.includes('rate limit') || message.includes('too many requests') || message.includes('for security purposes')) return 'Too many attempts — wait a minute and try again.';
  if (message.includes('failed to fetch') || message.includes('networkerror') || message.includes('load failed')) return 'Connection problem — check your internet and try again.';
  if (message.includes('password should be at least') || message.includes('signup requires a valid password')) return 'Password must be at least 8 characters.';
  if (message.includes('invalid api key') || message.includes('supabase url')) return 'Sign-in is temporarily unavailable. Try again shortly.';
  return rawMessage;
}
