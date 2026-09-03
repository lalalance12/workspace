/**
 * Supabase's auth errors are terse, and a couple of them blame the wrong thing
 * entirely — "Invalid login credentials" is what you get for a wrong password
 * AND for an address that has no account at all.
 *
 * Same rule as lib/rpc.ts: say what happened and what to do about it. Never a
 * bare apology, and never the raw string when a better one exists.
 */
export function readableAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return "That email and password don't match an account. Check both, or create an account if you don't have one yet.";
  }
  if (/email not confirmed/i.test(message)) {
    return "Confirm your email first — open the link we sent when you signed up.";
  }
  if (/user already registered|already been registered/i.test(message)) {
    return "That address already has an account. Sign in instead.";
  }
  if (/password should be at least|weak password/i.test(message)) {
    return "That password is too short. Use at least 8 characters.";
  }
  if (/rate limit|too many requests|for security purposes/i.test(message)) {
    return "That's a few attempts in a short window. Wait a minute, then try again.";
  }
  if (/schema cache|does not exist/i.test(message)) {
    return "This project has no database schema yet. The migrations in supabase/migrations need to be applied.";
  }
  return message;
}
