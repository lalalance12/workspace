# Workspace

Ambient status board that replaces the daily standup. Everyone posts what
they're working on; two shared views show the whole team at a glance.

Workspace is an **attention layer, not a chat app.** It never carries
conversation. When someone needs a teammate, Workspace produces a nudge that
sends them to Slack, Discord, or wherever the team actually talks. Resist every
temptation to add messaging — the moment it has a DM inbox it stops being
glanceable and starts competing with tools that do it better.

See `README.md` for setup and commands.

## Non-negotiables

1. **The database schema in `supabase/migrations/` is ground truth.** Never
   invent a table or column. If something you need isn't there, stop and say
   so — don't work around it with client-side state or a new table.
2. **Use `@supabase/ssr`.** `@supabase/auth-helpers-nextjs` is deprecated. If
   you find yourself importing `createClientComponentClient` or
   `createServerComponentClient`, you've used the wrong package.
3. **`SUPABASE_SERVICE_ROLE_KEY` never appears in client code.** Not in a
   component, not in a hook, not behind a `typeof window` check. Server-side
   route handlers only. In practice this project reads it nowhere at all.
4. **Never bypass RLS.** All app queries go through the anon/publishable key as
   the signed-in user. If a query returns nothing, the fix is a policy, not the
   service key.
5. **Status writes go through the `set_status` RPC.** Never
   `insert into status_updates` directly from the app — the RPC closes the
   previous row, records the quick pick, and resolves open nudges in one
   transaction.
6. **Presence is not in Postgres.** Who is online comes from Supabase Realtime
   Presence. Postgres stores what people are *doing*, Presence tracks whether
   they're *there*. Never write a heartbeat row.
7. **The animation package is `motion`, imported from `motion/react`.** Framer
   Motion was renamed; `framer-motion` still installs but is no longer actively
   developed.
8. **Notifications are written by database triggers only.** There is no insert
   policy on `notifications` and there must never be one. Client code reads them
   and marks them read; it never creates them.
9. **No email, no SMS, no push provider, no Edge Functions.** Notifications are
   in-app only. Supabase Realtime plus the `notifications` table *is* the
   delivery mechanism.

Rules 5 and 8 are enforced by the database, not by convention: `status_updates`,
`quick_picks` and `nudges` have **no write policies at all**, and
`notifications` has no insert policy. A direct write fails under RLS. Don't
"fix" that by adding a policy.

They are enforced twice, in fact. A policy *filters* rows; it does not *grant*
access. The bottom of `20260805090300_rls.sql` issues explicit table GRANTs to
`authenticated`, and withholds `INSERT` everywhere plus `UPDATE` on
`status_updates` / `quick_picks` / `nudges`. So even a mistakenly added policy
still can't write.

If a query fails with `permission denied for table …`, that's a missing GRANT,
not a missing policy — the two are separate layers and you need both.

## Schema map

Ground truth is `supabase/migrations/`. This is the index, not the definition.

| Table | Purpose |
|---|---|
| `teams` | team + `join_code` + nudge policy (staleness, re-nudge, peer rate limits) |
| `profiles` | one per `auth.users`, role `head`/`member`, message link, pause |
| `status_updates` | append-only; current status is the row with `ended_at is null` |
| `quick_picks` | what you posted before, offered back on `/me` |
| `desks` | the `/office` floor plan grid |
| `nudges` | peer **and** system, distinguished by `kind` |
| `notifications` | trigger-written only |

### Write API — all `security definer`

| Function | Does |
|---|---|
| `set_status(state, note, ticket_ref)` | close old row, insert new, resolve open system nudge, save quick pick |
| `send_peer_nudge(recipient, note, link)` | rate-limited by team policy |
| `acknowledge_nudge(id)` | peer only, one tap |
| `respond_to_nudge(id, state, …)` | validates, then delegates to `set_status` |
| `create_team(name)` | onboarding; caller becomes head |
| `join_team(code)` | onboarding; caller becomes member |
| `rotate_join_code()` | head only; invalidates the old code |
| `enqueue_due_nudges()` | pg_cron, every minute; **not** callable by clients |

Membership is by **shared join code** — 8 characters, no ambiguous glyphs, shown
on `/settings/team`. Anyone holding it can join, which is why it rotates.

### Error codes

RPCs raise distinct SQLSTATEs so the UI can say what failed and what to do.
`lib/rpc.ts` maps them. A toast must never read "Something went wrong."

`WS001` no team · `WS002` already nudged them this hour · `WS003` hourly limit ·
`WS004` recipient paused · `WS005` not on your team · `WS006` nudge already
handled · `WS007` note over 80 chars · `WS008` already on a team · `WS009` bad
join code

### The four notification triggers

`peer_nudge` · `system_nudge` · `nudge_acknowledged` · `teammate_blocked`

`teammate_blocked` goes to the head only, and fires only on the **transition
into** blocked — editing the note on an existing blocker doesn't re-alert, and
the head is never told about their own. Nothing else writes a notification.

## Two kinds of nudge

They share the `nudges` table and are otherwise different features. Don't
collapse them into one UI.

| | **Peer nudge** | **System nudge** |
|---|---|---|
| Sent by | a teammate, manually from the board | `pg_cron`, on staleness |
| Reads as | "Lance nudged you — check your messages" | "Still on the checkout bug?" |
| Asks for | attention. Go look at your DMs. | a status update |
| Resolves via | `acknowledge_nudge()` | `respond_to_nudge()` or any `set_status()` |
| Can stack | yes | no. One open at a time |
| Rate limit | 1/hour per recipient, 5/hour total | the interval itself |
| Visibility | whole team can see it happened | private to recipient and head |

A peer nudge is a **signpost, not a message.** At most an 80-char note and a
link out to the real conversation. Never let it grow a reply field.

Peer nudges are visible team-wide on purpose. Nudging in the open keeps it
social; covert nudging turns the feature into a management cudgel.

## Data flow: setting a status

```
/me form submit
  → optimistic local update (note flips immediately)
  → supabase.rpc('set_status', {...})
  → Postgres: close old row, insert new, resolve nudge, save quick pick
  → Realtime broadcasts INSERT on status_updates
  → every client patches its store by profile_id
  → board note animates, office bubble pops
```

Errors roll back the optimistic update and surface a toast that says what
failed and what to do — never a bare "Something went wrong."

## Design direction

**Lit and unlit.** The product is about attention over time: a status is worth
something when it is fresh and worth less every hour it sits there. So light is
the design language. A fresh card is lit — saturated tint, a coloured glow
underneath, full chroma. As it ages the light drains out until the card is
neutral, dim and curling at the corner.

The gradient is therefore never decoration. `--tint` is set by the decay tier
and every colour on a card is mixed against it with `color-mix()`, which makes
the palette itself the staleness signal. If you add a gradient that does not
encode something true, take it out.

Ground is an **off-white with a violet cast**, never pure white — a screen
people keep open all day should feel like paper under a warm lamp, not a
spreadsheet.

Tokens live in `app/globals.css` as Tailwind v4 `@theme` values, aliased in
`:root` to short names (`--canvas`, `--ink`, `--violet`, `--signal`, …) so both
spellings work.

State colours are one token each — `--color-state-working` (violet),
`reviewing` (blue), `blocked` (signal red), `meeting` (amber), `break` (mint),
`off` (quiet violet-grey) — matched in lightness and chroma so the board reads
as one system. A state contributes exactly one colour, `--state`; the tint, the
left edge, the dot and the glow are all mixed from it. Mapped in
`lib/status-state.ts`.

### Type

- **Bricolage Grotesque** — headings, and the status text people write. It has
  real quirks in the counters, so a card looks drawn rather than set.
- **Instrument Sans** — UI, labels, buttons. Character here would be noise.
- **IBM Plex Mono** — anything that is data: timestamps, ticket refs, join
  codes. `.annotation` sets it uppercase with generous letter-spacing.

### Signature element: staleness decay

A status card visibly ages, because a board that hides stale data is lying.
Thresholds live in `lib/staleness.ts` — one source for the CSS tier, the mono
age label, and the tests.

| Age | `--tint` | Treatment |
|---|---|---|
| < 1h | 1.0 | full tint, coloured glow, sits flat |
| 1–3h | 0.72 | glow starts to go |
| 3–6h | 0.42 | colour mostly gone, corner curls, tilts 1° |
| > 6h | 0.14 | neutral and dim, pronounced curl, reads `STALE · 7H` |

Blocked cards are exempt from decay — they hold full chroma, invert to white
ink, and breathe on a slow loop until resolved. A blocker should never fade
into the background.

### Restraint

Decay is where the boldness goes. The brand gradient appears in exactly three
places — the wordmark, the primary button, and the active nav underline. One
entrance animation (`.rise-in`), one hover (a 3px lift on cards), one loop (the
blocked breathe). No glassmorphism beyond the top bar's blur. Respect
`prefers-reduced-motion` — the mono age label is always in the DOM, so
staleness stays legible with every animation removed. Keyboard focus is always
visible and uses the brand colour.

Controls live as classes in `globals.css` (`.btn`, `.input`, `.chip`,
`.error-note`, `.panel`), not as long arbitrary-value strings, so a button's
look is one edit and every screen moves together. `components/ui/` wraps them:
`Button` takes a named `variant` union rather than boolean flags, and `Field`
takes its input as children.

## Copy voice

Plain and specific. Buttons name the action that happens: "Post update," not
"Submit." A nudge asks a real question — "Still on the checkout bug?" — built
from the person's actual current status by `compose_nudge_question()`, never a
generic "Please update your status." Empty states invite action: "Nothing
pinned yet. Post the first update."

## Testing

- Vitest for RPC wrappers and the staleness/decay calculation.
- One Playwright flow: log in → post status → assert the note appears on
  `/board` with the right state color. Signs in by magic link read out of
  Mailpit, so it exercises the real auth path.
- The scheduler is tested in SQL with pgTAP (`supabase/tests/scheduler.test.sql`):
  seed a member with a 2-hour-old status, run `select enqueue_due_nudges()`,
  assert exactly one row lands in `nudges`. Then run it again and assert zero —
  the no-double-nudge guard is the part most likely to break.

Regenerate types after every migration (`pnpm db:types`). A stale
`database.types.ts` is the most common source of confusing type errors.
