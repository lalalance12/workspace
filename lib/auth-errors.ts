/**
 * Supabase's auth errors are terse, and a couple of them blame the wrong thing
 * entirely — "Invalid login credentials" is what you get for a wrong password
 * AND for an address that has no account at all.
 *
 * Same rule as lib/rpc.ts: say what happened and what to do about it. Never a
 * bare apology, and never the raw string when a better one exists.
 *
 * The context matters for one case. Hitting the email quota while signing in is
 * a wait; hitting it while signing UP means the project is still configured to
 * send a confirmation, which is a setting somebody can switch off in a minute.
 * Telling that person to "use your password instead" is useless — they are
 * trying to create the account that would have one.
 */
export type AuthContext = "signin" | "signup";

export function readableAuthError(
  message: string,
  context: AuthContext = "signin",
): string {
  if (/invalid login credentials/i.test(message)) {
    return "That email and password don't match an account. Check both, or create an account if you don't have one yet.";
  }
  if (/email not confirmed/i.test(message)) {
    return "This account was created while email confirmation was on, and never confirmed. Turn confirmation off in Supabase and sign up again, or open the link that was sent.";
  }
  if (/user already registered|already been registered/i.test(message)) {
    return "That address already has an account. Sign in instead.";
  }
  if (/password should be at least|weak password/i.test(message)) {
    return "That password is too short. Use at least 8 characters.";
  }

  // Two different limits, two very different waits, and Supabase words them
  // almost identically. Collapsing them into one "try again shortly" is how
  // someone ends up refreshing for an hour.

  // Per-address cooldown, seconds. The message carries the number; use it.
  const cooldown = message.match(/after (\d+) seconds?/i);
  if (cooldown) {
    return context === "signup"
      ? `Another email to this address is allowed in ${cooldown[1]} seconds. Signup should not be sending email at all — turn off Confirm email in Supabase (Authentication → Sign In / Providers → Email).`
      : `Another email to this address is allowed in ${cooldown[1]} seconds. Or sign in with your password now.`;
  }

  // Project-wide cap. The built-in sender allows a couple of emails an hour,
  // full stop — waiting a minute achieves nothing.
  const quota = /email rate limit exceeded|over_email_send_rate_limit/i.test(
    message,
  );
  if (quota || /rate limit|too many requests|for security purposes/i.test(message)) {
    return context === "signup"
      ? "This project still sends a confirmation email on signup, and has used its hourly allowance of two. Turn off Confirm email in Supabase — Authentication → Sign In / Providers → Email → Confirm email — and signup stops needing email at all."
      : "This project has used its hourly allowance of sign-in emails. Sign in with your password instead, or wait an hour.";
  }

  if (/schema cache|does not exist/i.test(message)) {
    return "This project has no database schema yet. The migrations in supabase/migrations need to be applied.";
  }

  return message;
}
