"use client";

import { DayPicker, type DayPickerProps } from "react-day-picker";

import { cn } from "@/lib/utils";

/**
 * shadcn's Calendar over react-day-picker v10.
 *
 * Every class is written against this project's tokens instead of shadcn's
 * defaults, so the calendar reads as part of the same interface: violet
 * selection, mono weekday headers, the same control radius as every input.
 *
 * react-day-picker ships a stylesheet; it is deliberately not imported. Its
 * class names collide with the ones set below and the result is two systems
 * fighting over the same elements.
 */
export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: DayPickerProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("select-none", className)}
      classNames={{
        months: "flex flex-col gap-4",
        month: "flex flex-col gap-3",
        month_caption: "flex h-8 items-center justify-center px-9",
        caption_label:
          "font-[family-name:var(--font-display)] text-sm font-semibold tracking-tight",

        nav: "absolute inset-x-0 top-0 flex h-8 items-center justify-between px-1",
        button_previous:
          "grid size-7 place-items-center rounded-[8px] text-[var(--ink-soft)] transition-colors hover:bg-[var(--sunken)] hover:text-[var(--ink)] disabled:pointer-events-none disabled:opacity-30",
        button_next:
          "grid size-7 place-items-center rounded-[8px] text-[var(--ink-soft)] transition-colors hover:bg-[var(--sunken)] hover:text-[var(--ink)] disabled:pointer-events-none disabled:opacity-30",
        chevron: "size-4 fill-current",

        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "annotation w-9 flex-none pb-1 text-center font-normal",
        week: "mt-0.5 flex w-full",

        day: "relative size-9 flex-none p-0 text-center text-sm",
        day_button:
          "size-9 cursor-pointer rounded-[8px] font-medium transition-colors hover:bg-[var(--sunken)] disabled:pointer-events-none",

        // Today is marked by a ring, so it stays legible when it is also the
        // selected day and the ground has gone violet.
        today:
          "[&>button]:ring-1 [&>button]:ring-[var(--violet)] [&>button]:ring-inset",
        selected:
          "[&>button]:bg-[image:var(--gradient-brand)] [&>button]:text-white [&>button]:hover:bg-[image:var(--gradient-brand)]",
        outside: "[&>button]:text-[var(--ink-faint)] [&>button]:opacity-60",
        disabled:
          "[&>button]:pointer-events-none [&>button]:text-[var(--ink-faint)] [&>button]:opacity-35",
        hidden: "invisible",

        ...classNames,
      }}
      {...props}
    />
  );
}
