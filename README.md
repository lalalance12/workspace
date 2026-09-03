# Workspace

An ambient status board that replaces the daily standup. Everyone posts what
they're working on; two shared views show the whole team at a glance.

Workspace is an **attention layer, not a chat app.** It never carries
conversation — when someone needs a teammate, it produces a nudge that sends
them to Slack, Discord, or wherever the team actually talks.

## Stack

| | |
|---|---|
| Next.js | 15.5.22, App Router |
| React | 19.1 |
| Tailwind | v4, tokens via `@theme` in `app/globals.css` |
| Supabase | Postgres + RLS + Realtime + pg_cron |
| Auth | `@supabase/ssr` (never `auth-helpers-nextjs`) |
| Animation | `motion`, imported from `motion/react` |
| Tests | Vitest, Playwright, pgTAP |

The whole backend is Postgres. No Edge Functions, no third-party services.

## Environment

Three variables. That's the whole file.

```bash
cp .env.example .env.local
```

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Dashboard → Project Settings → Data API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Dashboard → Project Settings → API Keys → Publishable key |
| `NEXT_PUBLIC_SITE_URL` | The domain this deployment answers on. Blank locally. |

The **publishable key** is the new name for the anon key (`sb_publishable_…`
rather than a JWT). They are interchangeable and both are safe in the browser —
they carry no privileges of their own, RLS decides everything.

### There is no service-role key here

Deliberately. Non-negotiable #4 forbids bypassing RLS, and nothing in this app
needs to:

- every write goes through a **security-definer RPC executed as the signed-in
  user**, so the tables have no insert policies at all;
- notifications are written by **triggers**;
- the scheduler runs **inside Postgres** on pg_cron.

If a feature ever seems to need the secret key, that's a signal the fix belongs
in a policy or an RPC instead.

## Running locally

Requires Docker.

```bash
pnpm install
pnpm exec supabase start        # first run pulls several GB
pnpm exec supabase db reset     # replay migrations + seed
pnpm dev
```

`supabase start` prints a local API URL and anon key — put those in
`.env.local` to develop against the local stack instead of the hosted project.

| Service | URL |
|---|---|
| API | http://127.0.0.1:54321 |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Studio | http://127.0.0.1:54323 |
| Mail (Mailpit) | http://127.0.0.1:54324 |

The seed creates a **Product** team with five people deliberately spread across
the staleness ladder, so every decay tier is visible the first time you open
`/board`. All of them sign in at `/login` by magic link; the email lands in
Mailpit.

### Getting onto a team

A fresh signup has a profile but no team, and nothing works until they have one,
so the `(app)` layout sends anyone without a `team_id` to **`/onboarding`**. It
offers both paths side by side: enter a **join code**, or name a team and become
its head. The code is eight characters with no ambiguous glyphs, shown on
`/settings/team`. Anyone holding it can join, so the head can rotate it.

`/onboarding` sits outside the `(app)` group on purpose — there is no board and
no nudge policy to navigate to until you belong somewhere, so there is no top
bar either.

## Running against the hosted project

```bash
pnpm exec supabase link --project-ref <your-project-ref>
pnpm exec supabase db push
```

Then enable **pg_cron** (Dashboard → Database → Extensions) and re-run
`db push` — `20260805090600_scheduler.sql` skips scheduling with a notice if the
extension isn't available, rather than failing the whole migration.

### Sign-in in production

Two ways in, no OAuth providers: an emailed **magic link**, or **email and
password**. They are two credentials on one identity, not two kinds of user —
someone who started with a link sets a password from `/settings/me`, and the
link keeps working afterwards. There is no password reset flow on purpose: the
email link already is one.

The link half is the fragile half. Three things have to agree, or it fails
*after* someone clicks rather than before:

1. **`NEXT_PUBLIC_SITE_URL`** on the host (Vercel → Settings → Environment
   Variables) set to the production domain. `lib/site-url.ts` builds
   `emailRedirectTo` from it. Give it type **Config**, not Secret — anything
   named `NEXT_PUBLIC_*` is inlined into the browser bundle by design, and
   Vercel refuses to mark a public-prefixed variable write-only.
2. **Supabase → Authentication → URL Configuration**
   - *Site URL*: `https://your-app.vercel.app`
   - *Redirect URLs*: `https://your-app.vercel.app/**`, plus
     `https://*-<your-team>.vercel.app/**` if preview deploys should sign in too.

   An origin missing from this allowlist is silently dropped and the person is
   returned to the Site URL instead, which looks exactly like a broken link.
3. **Authentication → Emails → Magic Link.** Leave the body on
   `{{ .ConfirmationURL }}`. It already carries the redirect through the auth
   server's verify endpoint and back to `/auth/callback` with the `?code=` that
   `exchangeCodeForSession()` expects. Hardcoding a host there breaks every
   environment but one.

The login screen says the link expires in an hour, which matches the default
*Email OTP expiry*. Change one and change the other.

**Before a real team uses this, configure custom SMTP.** Supabase's built-in
email sender only delivers to your own project members and is rate-limited to a
handful of messages an hour — fine for testing, useless the moment a colleague
tries to sign in.

## Commands

```bash
pnpm dev
pnpm typecheck
pnpm lint
pnpm test                              # vitest: decay + RPC wrappers
pnpm test:e2e                          # playwright: log in, post, see the note
pnpm exec supabase test db             # pgTAP: the scheduler guard
pnpm db:reset                          # replay migrations locally
pnpm db:types                          # regenerate lib/database.types.ts
```

**Regenerate types after every migration.** A stale `database.types.ts` is the
most common source of confusing type errors in this project.

## Where things live

```
app/
  (app)/            authenticated shell — top bar, drafting grid
    board/          corkboard of sticky notes (server shell + client realtime)
    office/         floor-plan view                        [shell]
    me/             set my status — the most important screen
    timeline/       today's history
    settings/team/  head-only: nudge policy, members, desks [read-only]
    settings/me/    nudge preferences, pause, message link
  login/            Google OAuth + magic link
  auth/callback/    code -> session cookie
components/
  status-note.tsx   the sticky note, including the decay treatment
lib/
  staleness.ts      the decay thresholds — single source, unit tested
  rpc.ts            typed wrappers over the write API
  supabase/         browser / server / middleware clients
supabase/
  migrations/       ground truth. Never invent a table or column.
  tests/            pgTAP
```

## The two kinds of nudge

They share the `nudges` table and are otherwise different features. Don't
collapse them into one UI.

| | **Peer nudge** | **System nudge** |
|---|---|---|
| Sent by | a teammate, from the board | `pg_cron`, on staleness |
| Asks for | attention — go look at your DMs | a status update |
| Resolves via | `acknowledge_nudge()` | `respond_to_nudge()` or any `set_status()` |
| Can stack | yes | no, one open at a time |
| Visibility | whole team, on purpose | recipient and head only |

Peer nudges are public because nudging in the open keeps it social; covert
nudging turns the feature into a management cudgel. System nudges are private
because a stale status shouldn't be a public scolding.

A peer nudge is a **signpost, not a message** — 80 characters and a link out.
Never let it grow a reply field.
