/**
 * Configuration for which sign-in methods are offered.
 */

/**
 * Whether NEW accounts can be created with email + password.
 *
 * Disabled 2026-07-27. Email signup requires the user to invent a username, invent a password,
 * leave the app to find a confirmation mail, and come back — and half of them never came back:
 * of 4 email signups in `auth.users`, 2 were never confirmed. Meanwhile 17 of 21 total accounts
 * arrived via Google, so the path costs far more than it contributes.
 *
 * NOT the cause, despite the initial theory: Supabase's hourly mail rate limit. Those 4 signups
 * landed on 2026-07-16, 07-24, 07-25 and 07-26 — days apart, never clustered — `confirmation_sent_at`
 * is populated within ~0.1s in every case, and the two who did confirm took 1.7 min and 0.23 min.
 * Delivery works. The loss is the context switch out of the app, which is why configuring custom
 * SMTP would not have fixed anything and removing the round-trip does.
 *
 * Existing email accounts are unaffected — email SIGN-IN and password reset stay available so the
 * accounts already created can still get back in. Only account CREATION via email is withdrawn.
 *
 * Re-enable only with a mail provider AND a reason why Google + guest is insufficient. Revisit
 * rate limits above roughly 50 signups/day, where they genuinely would start to bite.
 */
export const EMAIL_SIGNUP_ENABLED = false;
