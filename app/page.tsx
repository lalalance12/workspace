import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Wordmark } from "@/components/brand-mark";
import { DecayDemo } from "@/components/decay-demo";
import { createClient } from "@/lib/supabase/server";

/**
 * The one page on this domain worth indexing.
 *
 * Everything else is behind auth and carries the root layout's noindex; this
 * overrides it, which is the whole reason the page exists rather than the
 * redirect that used to live here. A signed-out visitor previously landed on a
 * sign-in form, which tells someone who has never heard of Workspace nothing
 * about whether they want an account.
 *
 * Signed-in people never see it — they are sent to their board, same as before.
 */
export const metadata: Metadata = {
  title: {
    absolute: "Workspace — an ambient status board for your team",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/board");

  const now = Date.now();

  return (
    <div className="canvas-ambient min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-6">
        <span className="flex items-center gap-2.5">
          <Wordmark />
        </span>

        <nav className="ml-auto flex items-center gap-2">
          <Link href="/login" className="btn btn-ghost text-sm">
            Sign in
          </Link>
          <Link href="/signup" className="btn btn-primary text-sm">
            Create account
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="rise-in max-w-3xl pt-12 pb-16 sm:pt-20">
          <p className="annotation">Replaces the daily standup</p>
          <h1 className="mt-4 text-4xl leading-[1.08] sm:text-6xl">
            What everyone is working on,{" "}
            <span className="gradient-text">at a glance</span>.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-[var(--ink-soft)]">
            Everyone posts what they are on. Two shared views show the whole
            team. Nobody sits through a meeting to find out who is blocked.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="btn btn-primary">
              Start a team
            </Link>
            <Link href="/login" className="btn btn-quiet">
              I have a join code
            </Link>
          </div>
        </section>

        <section aria-labelledby="decay" className="border-t pt-12" style={{ borderColor: "var(--line)" }}>
          <h2 id="decay" className="annotation mb-5">
            A status ages in public
          </h2>
          <DecayDemo now={now} />
          <p className="mt-6 max-w-xl text-[var(--ink-soft)]">
            A board that hides stale data is lying. Fresh notes hold their
            colour; old ones drain towards the paper until only the age is left,
            so a board that has gone quiet looks like it. Blockers are exempt —
            they hold full colour until somebody resolves them.
          </p>
        </section>

        <section className="mt-20 grid gap-10 border-t pt-12 sm:grid-cols-3" style={{ borderColor: "var(--line)" }}>
          <Step
            n="01"
            title="Post what you're on"
            body="One line, a ticket if there is one, and how long you expect to be. Details go underneath for anyone who wants them."
          />
          <Step
            n="02"
            title="Watch the board"
            body="Every teammate, current status, colour draining by the hour. Who is here comes from live presence, not a heartbeat row."
          />
          <Step
            n="03"
            title="Nudge, don't message"
            body="Gone quiet on something? A nudge asks a real question and points at Slack. Workspace never carries the conversation."
          />
        </section>

        <section
          className="panel mt-20 p-8 sm:p-10"
          style={{
            backgroundImage:
              "linear-gradient(160deg, color-mix(in oklab, var(--violet) 7%, var(--surface)) 0%, var(--surface) 62%)",
          }}
        >
          <h2 className="text-2xl">It is not a chat app, on purpose.</h2>
          <p className="mt-3 max-w-2xl text-[var(--ink-soft)]">
            There is no inbox, no DMs, no thread under a status. The moment a
            status board grows a reply field it stops being glanceable and
            starts competing with the tool your team already talks in. Workspace
            is the attention layer: it tells you where to look, then sends you
            somewhere else to talk.
          </p>
          <div className="mt-7">
            <Link href="/signup" className="btn btn-primary">
              Create an account
            </Link>
          </div>
        </section>
      </main>

      <footer
        className="border-t"
        style={{ borderColor: "var(--line)" }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8">
          <span className="annotation">Workspace</span>
          <nav className="flex gap-5 text-sm text-[var(--ink-soft)]">
            <Link href="/login" className="hover:text-[var(--ink)]">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-[var(--ink)]">
              Create account
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <span className="annotation">{n}</span>
      <h3 className="mt-2 text-xl">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
        {body}
      </p>
    </div>
  );
}
