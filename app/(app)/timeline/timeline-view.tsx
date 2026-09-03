"use client";

import { useMemo, useState } from "react";

import { StatusNote, type NoteStatus } from "@/components/status-note";
import { EmptyState } from "@/components/ui/page";
import { decayFor } from "@/lib/staleness";
import { STATUS_STATES, presentationFor, type StatusState } from "@/lib/status-state";

/**
 * Today, three ways.
 *
 *   Cards    — everything that happened, newest first. The default, because
 *              "what just changed" is the question people actually arrive with.
 *   People   — one lane per person, so you can read a single day as a story
 *              rather than reconstructing it from an interleaved feed.
 *   Hours    — bucketed by clock hour, which is the view that shows shape:
 *              when the team started, where the quiet stretch was.
 *
 * Filtering is client-side on purpose. A day of one team's statuses is a few
 * dozen rows; a round trip per checkbox would be slower and would lose the
 * instant feel that makes filters worth having.
 */
type View = "cards" | "people" | "hours";

const VIEWS: Array<{ id: View; label: string }> = [
  { id: "cards", label: "Cards" },
  { id: "people", label: "People" },
  { id: "hours", label: "Hours" },
];

export interface TimelineRow extends NoteStatus {
  profile_id: string;
}

export interface TimelinePerson {
  id: string;
  display_name: string;
}

export function TimelineView({
  rows,
  people,
  serverNow,
}: {
  rows: TimelineRow[];
  people: TimelinePerson[];
  serverNow: number;
}) {
  const [view, setView] = useState<View>("cards");
  const [person, setPerson] = useState<string | null>(null);
  const [state, setState] = useState<StatusState | null>(null);
  const [fromHour, setFromHour] = useState(0);
  const [toHour, setToHour] = useState(23);

  const nameFor = useMemo(
    () => new Map(people.map((p) => [p.id, p.display_name])),
    [people],
  );

  const visible = useMemo(
    () =>
      rows.filter((r) => {
        const hour = new Date(r.started_at).getHours();
        return (
          (person === null || r.profile_id === person) &&
          (state === null || r.state === state) &&
          hour >= fromHour &&
          hour <= toHour
        );
      }),
    [rows, person, state, fromHour, toHour],
  );

  // Only offer filters that would actually match something. A chip that
  // guarantees an empty result is a trap.
  const statesPresent = useMemo(
    () => new Set(rows.map((r) => r.state)),
    [rows],
  );
  const peoplePresent = useMemo(
    () => people.filter((p) => rows.some((r) => r.profile_id === p.id)),
    [people, rows],
  );

  const hoursPresent = useMemo(() => {
    const hours = rows.map((r) => new Date(r.started_at).getHours());
    return { first: Math.min(...hours), last: Math.max(...hours) };
  }, [rows]);

  const wholeDay = fromHour === 0 && toHour === 23;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="annotation mr-1">View</span>
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={view === v.id}
              onClick={() => setView(v.id)}
              className="chip"
            >
              {v.label}
            </button>
          ))}
        </div>

        {peoplePresent.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="annotation mr-1">Who</span>
            <button
              type="button"
              aria-pressed={person === null}
              onClick={() => setPerson(null)}
              className="chip"
            >
              Everyone
            </button>
            {peoplePresent.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={person === p.id}
                onClick={() => setPerson(person === p.id ? null : p.id)}
                className="chip"
              >
                {p.display_name}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="annotation mr-1">State</span>
          <button
            type="button"
            aria-pressed={state === null}
            onClick={() => setState(null)}
            className="chip"
          >
            Any
          </button>
          {STATUS_STATES.filter((s) => statesPresent.has(s)).map((s) => {
            const look = presentationFor(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={state === s}
                onClick={() => setState(state === s ? null : s)}
                className="chip"
                style={
                  {
                    "--state": look.accent,
                    "--chip-ink": look.onAccent,
                  } as React.CSSProperties
                }
              >
                <span className="state-dot" aria-hidden="true" />
                {look.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="annotation mr-1">Hours</span>

          <HourSelect
            label="From"
            value={fromHour}
            onChange={(h) => {
              setFromHour(h);
              // Dragging the start past the end would silently empty the list.
              if (h > toHour) setToHour(h);
            }}
          />
          <span className="text-sm text-[var(--ink-soft)]">to</span>
          <HourSelect
            label="To"
            value={toHour}
            onChange={(h) => {
              setToHour(h);
              if (h < fromHour) setFromHour(h);
            }}
          />

          {/* Snap to the hours that actually contain something — on a normal
              day that trims the empty small hours off both ends. */}
          {Number.isFinite(hoursPresent.first) && (
            <button
              type="button"
              onClick={() => {
                setFromHour(hoursPresent.first);
                setToHour(hoursPresent.last);
              }}
              className="chip"
            >
              Active hours
            </button>
          )}

          {!wholeDay && (
            <button
              type="button"
              onClick={() => {
                setFromHour(0);
                setToHour(23);
              }}
              className="chip"
            >
              Whole day
            </button>
          )}
        </div>
      </div>

      <hr className="rule-brand" />

      {visible.length === 0 ? (
        <EmptyState
          title="Nothing matches that"
          hint="Loosen a filter, or pick Everyone and Any."
        />
      ) : view === "cards" ? (
        <CardsView rows={visible} nameFor={nameFor} now={serverNow} />
      ) : view === "people" ? (
        <PeopleView
          rows={visible}
          people={peoplePresent}
          nameFor={nameFor}
          now={serverNow}
        />
      ) : (
        <HoursView rows={visible} nameFor={nameFor} now={serverNow} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */

/** A bare hour picker. 24 options, labelled in the viewer's own clock format. */
function HourSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (hour: number) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="input w-auto py-1.5 text-sm"
    >
      {Array.from({ length: 24 }, (_, h) => (
        <option key={h} value={h}>
          {formatHour(h)}
        </option>
      ))}
    </select>
  );
}

type NameFor = Map<string, string>;

function CardsView({
  rows,
  nameFor,
  now,
}: {
  rows: TimelineRow[];
  nameFor: NameFor;
  now: number;
}) {
  return (
    <ol className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-6">
      {rows.map((row, i) => (
        <li
          key={row.id}
          className="rise-in"
          style={{ animationDelay: `${Math.min(i * 30, 240)}ms` }}
        >
          <StatusNote
            status={row}
            name={nameFor.get(row.profile_id) ?? "Someone"}
            now={now}
          />
        </li>
      ))}
    </ol>
  );
}

/** One lane per person: their day, in order, as a row of stops. */
function PeopleView({
  rows,
  people,
  nameFor,
  now,
}: {
  rows: TimelineRow[];
  people: TimelinePerson[];
  nameFor: NameFor;
  now: number;
}) {
  return (
    <div className="flex flex-col gap-8">
      {people
        .map((p) => ({
          person: p,
          // Oldest first inside a lane — a day reads forwards.
          items: rows
            .filter((r) => r.profile_id === p.id)
            .slice()
            .reverse(),
        }))
        .filter((lane) => lane.items.length > 0)
        .map(({ person, items }) => (
          <section key={person.id} className="flex flex-col gap-3">
            <div className="flex items-baseline gap-3">
              <h2 className="text-lg">{nameFor.get(person.id) ?? "Someone"}</h2>
              <span className="annotation">
                {items.length} update{items.length === 1 ? "" : "s"}
              </span>
            </div>

            <ol className="flex flex-col">
              {items.map((row) => (
                <StopRow key={row.id} row={row} now={now} />
              ))}
            </ol>
          </section>
        ))}
    </div>
  );
}

/** Bucketed by clock hour, so the shape of the day is visible. */
function HoursView({
  rows,
  nameFor,
  now,
}: {
  rows: TimelineRow[];
  nameFor: NameFor;
  now: number;
}) {
  const buckets = useMemo(() => {
    const byHour = new Map<number, TimelineRow[]>();
    for (const row of rows) {
      const hour = new Date(row.started_at).getHours();
      const list = byHour.get(hour);
      if (list) list.push(row);
      else byHour.set(hour, [row]);
    }
    return [...byHour.entries()].sort((a, b) => b[0] - a[0]);
  }, [rows]);

  const busiest = Math.max(...buckets.map(([, list]) => list.length), 1);

  return (
    <div className="flex flex-col gap-6">
      {buckets.map(([hour, list]) => (
        <section key={hour} className="grid gap-3 sm:grid-cols-[5rem_1fr]">
          <div className="flex items-baseline gap-2 sm:flex-col sm:items-end sm:gap-1">
            <span className="annotation">{formatHour(hour)}</span>
            {/* A bar, so the quiet hours look quiet. */}
            <span
              aria-hidden="true"
              className="block h-1 rounded-full"
              style={{
                width: `${Math.max((list.length / busiest) * 100, 12)}%`,
                minWidth: "0.75rem",
                backgroundImage: "var(--gradient-brand)",
                opacity: 0.35 + 0.65 * (list.length / busiest),
              }}
            />
          </div>

          <ol className="flex flex-col">
            {list.map((row) => (
              <StopRow
                key={row.id}
                row={row}
                now={now}
                who={nameFor.get(row.profile_id) ?? "Someone"}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

/**
 * One entry in a lane: a coloured stop, the time, the sentence.
 *
 * Rows rather than cards here on purpose — the decay treatment is the point of
 * a card, and in a chronological list every entry's age is already given by its
 * position. Repeating it as a curl would be noise.
 */
function StopRow({
  row,
  now,
  who,
}: {
  row: TimelineRow;
  now: number;
  who?: string;
}) {
  const look = presentationFor(row.state);
  const decay = decayFor({ startedAt: row.started_at, state: row.state, now });

  return (
    <li
      className="flex items-start gap-3 border-l py-2.5 pl-4"
      style={{ borderColor: "var(--line)" }}
    >
      <span
        aria-hidden="true"
        className="mt-1.5 size-2.5 shrink-0 rounded-full ring-2"
        style={{
          background: look.accent,
          ["--tw-ring-color" as string]: "var(--canvas)",
          marginLeft: "-1.3125rem",
        }}
      />

      <span className="annotation mt-0.5 w-14 shrink-0 tabular-nums">
        {formatTime(row.started_at)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm">
          {who && <span className="font-medium">{who} · </span>}
          {row.note ?? look.label}
        </span>
        <span className="annotation mt-0.5 block">
          {look.label}
          {row.ticket_ref ? ` · ${row.ticket_ref}` : ""}
          {` · ${decay.age} ago`}
        </span>
      </span>
    </li>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatHour(hour: number) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric" });
}
