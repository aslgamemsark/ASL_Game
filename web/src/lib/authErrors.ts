// Supabase's signUp() error message is an account-enumeration oracle: an already-registered,
// confirmed email returns a distinctly-worded error while a fresh email succeeds, letting an
// attacker probe arbitrary addresses to learn which ones have accounts. AuthContext's
// signUpWithEmail uses this to detect that case and report the same generic success it would for
// a brand-new signup, instead of leaking the distinction.
export function isAlreadyRegisteredError(message: string): boolean {
  return /already registered|already exists/i.test(message);
}
