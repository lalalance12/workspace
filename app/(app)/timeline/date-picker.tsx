"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Picks the day the timeline shows.
 *
 * This replaced previous/next buttons. Stepping one day at a time is fine for
 * "what did yesterday look like" and useless for anything further back — three
 * weeks ago was twenty-one clicks. A calendar makes every day one click and, as
 * a side effect, shows which month you are actually in.
 *
 * The day is pushed into the URL rather than held in state: the page reads
 * ?date on the server and re-queries, so the choice survives a reload and can
 * be shared.
 */
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function TimelineDatePicker({
  selected,
  isToday,
}: {
  /** ISO day string, so the server and client agree without passing a Date. */
  selected: string;
  isToday: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [y, m, d] = selected.split("-").map(Number);
  const selectedDate = new Date(y, m - 1, d);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function choose(next: Date | undefined) {
    if (!next) return;
    setOpen(false);
    const day = isoDay(next);
    // Today is the default, so it gets the bare URL rather than a redundant
    // query string.
    router.push(day === isoDay(today) ? "/timeline" : `/timeline?date=${day}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="btn btn-quiet gap-2" aria-label="Choose a day">
          <CalendarGlyph />
          <span>
            {isToday
              ? "Today"
              : selectedDate.toLocaleDateString([], {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
          </span>
          <ChevronGlyph />
        </PopoverTrigger>

        <PopoverContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate}
            onSelect={choose}
            autoFocus
            // Nothing has happened tomorrow. Offering it only produces an empty
            // page and a moment of doubt about whether the app is working.
            disabled={{ after: today }}
          />
        </PopoverContent>
      </Popover>

      {!isToday && (
        <button
          type="button"
          onClick={() => router.push("/timeline")}
          className="chip"
        >
          Jump to today
        </button>
      )}

      <span className="annotation ml-auto">{selected}</span>
    </div>
  );
}

function CalendarGlyph() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function ChevronGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="opacity-60"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
