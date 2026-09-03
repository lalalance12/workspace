import { LoginForm } from "./login-form";
import { StatusNote, type NoteStatus } from "@/components/status-note";
import { ErrorNote } from "@/components/ui/field";

/**
 * The hero is the product's one real idea, not a screenshot of it: three cards
 * at three ages, so the first thing anyone sees is a fresh status glowing and a
 * six-hour-old one curling at the corner. Nothing else on the page has to
 * explain what "ambient" means.
 *
 * now is computed once on the server and passed down, so the cards render
 * identically on both sides of hydration.
 */
const HOUR = 3_600_000;

function demoCards(now: number): Array<{ status: NoteStatus; name: string }> {
  const at = (hoursAgo: number) => new Date(now - hoursAgo * HOUR).toISOString();

  return [
    {
      name: "Dana",
      status: {
        id: "demo-1",
        profile_id: "demo-1",
        state: "working",
        note: "Rewriting the checkout retry",
        ticket_ref: "WS-118",
        started_at: at(0.3),
      },
    },
    {
      name: "Ravi",
      status: {
        id: "demo-2",
        profile_id: "demo-2",
        state: "blocked",
        note: "Waiting on the staging key",
        ticket_ref: "WS-121",
        started_at: at(1.4),
      },
    },
    {
      name: "Mei",
      status: {
        id: "demo-3",
        profile_id: "demo-3",
        state: "reviewing",
        note: "Reading the migration diff",
        ticket_ref: "WS-104",
        started_at: at(7.5),
      },
    },
  ];
}

/**
 * A failed code exchange used to redirect here with ?error=auth and say
 * nothing, which looks identical to arriving normally. Name what happened.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const now = Date.now();
  const cards = demoCards(now);

  return (
    <div className="canvas-ambient min-h-dvh">
      <div className="mx-auto grid min-h-dvh max-w-6xl items-center gap-16 px-6 py-16 lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)]">
        <div className="rise-in w-full max-w-sm">
          <div className="mb-10 flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="size-5 rounded-md"
              style={{ backgroundImage: "var(--gradient-brand)" }}
            />
            <span className="gradient-text font-[family-name:var(--font-display)] text-base font-bold tracking-tight">
              Workspace
            </span>
          </div>

          <h1 className="text-4xl leading-[1.1]">
            What everyone is <span className="gradient-text">working on</span>.
          </h1>
          <p className="mt-4 mb-10 text-[var(--ink-soft)]">
            An ambient status board that replaces the standup. Post once, and the
            team can see it without asking. Not a chat app.
          </p>

          {error === "auth" && (
            <div className="mb-5">
              <ErrorNote>
                That sign-in link didn&rsquo;t work. It may have expired or
                already been used — send yourself a new one.
              </ErrorNote>
            </div>
          )}

          <LoginForm />
        </div>

        {/* The demonstration. Hidden on small screens: it is the argument for
            the product, not a control, and it needs room to read. */}
        <div className="hidden lg:block">
          <p className="annotation mb-5">A status ages in public</p>
          <div className="grid gap-5 sm:grid-cols-3">
            {cards.map(({ status, name }, i) => (
              <div
                key={status.id}
                className="rise-in"
                style={{ animationDelay: `${120 + i * 90}ms` }}
              >
                <StatusNote status={status} name={name} now={now} />
              </div>
            ))}
          </div>
          <p className="mt-5 max-w-md text-sm text-[var(--ink-soft)]">
            Fresh notes hold their colour. Old ones lose it and curl at the
            corner, so a board that has gone quiet looks like it. Blockers never
            fade.
          </p>
        </div>
      </div>
    </div>
  );
}
