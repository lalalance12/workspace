/**
 * Reading the magic link out of the local mail catcher.
 *
 * `supabase start` runs Mailpit on 54324 and every auth email lands there, so
 * the e2e flow can sign in the same way a person does rather than forging a
 * session cookie.
 */

const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";

interface MailpitSummary {
  ID: string;
  To: { Address: string }[];
  Created: string;
}

export async function clearMailbox() {
  await fetch(`${MAILPIT}/api/v1/messages`, { method: "DELETE" });
}

/** Poll until an email addressed to `email` shows up, then return its body. */
async function latestMessageBody(email: string, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT}/api/v1/messages?limit=50`);
    if (res.ok) {
      const { messages } = (await res.json()) as { messages: MailpitSummary[] };
      const match = messages.find((m) =>
        m.To.some((t) => t.Address.toLowerCase() === email.toLowerCase()),
      );

      if (match) {
        const detail = await fetch(`${MAILPIT}/api/v1/message/${match.ID}`);
        const body = (await detail.json()) as { Text?: string; HTML?: string };
        return `${body.Text ?? ""}\n${body.HTML ?? ""}`;
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  throw new Error(`No sign-in email arrived for ${email} within ${timeoutMs}ms`);
}

/** The /auth/v1/verify URL from the most recent sign-in email. */
export async function magicLinkFor(email: string): Promise<string> {
  const body = await latestMessageBody(email);

  const match =
    body.match(/https?:\/\/[^\s"'<>]*\/auth\/v1\/verify[^\s"'<>]*/) ?? [];
  if (!match[0]) {
    throw new Error(`Could not find a verify link in the email to ${email}`);
  }

  return match[0].replaceAll("&amp;", "&");
}
