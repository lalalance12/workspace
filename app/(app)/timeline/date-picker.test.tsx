import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TimelineDatePicker } from "./date-picker";

/**
 * The picker's whole job is to turn a click on a day into the right URL, so
 * that is what these assert. Rendering it is also the only way this component
 * gets exercised at all right now: /timeline needs a session, and the local
 * Supabase stack cannot start on this machine.
 */
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

// Fixed clock. "Today" has to mean the same day inside the component and inside
// the assertions, or a test written at 23:59 fails at 00:01.
const NOW = new Date(2026, 8, 3, 10, 0, 0); // 3 September 2026, local time

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  push.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function openCalendar() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

/**
 * Days are addressed by data-day rather than by their visible number.
 * react-day-picker gives each button an aria-label like "Friday, September 4th,
 * 2026", so a name query for "4" matches nothing — and matching the long form
 * would tie these assertions to the runner's locale.
 */
function day(grid: HTMLElement, iso: string): HTMLButtonElement {
  const button = grid.querySelector<HTMLButtonElement>(
    `[data-day="${iso}"] button`,
  );
  if (!button) throw new Error(`no day button for ${iso}`);
  return button;
}

describe("TimelineDatePicker", () => {
  it("labels the trigger 'Today' on the current day", () => {
    render(<TimelineDatePicker selected="2026-09-03" isToday />);
    expect(screen.getByLabelText("Choose a day")).toHaveTextContent("Today");
  });

  it("spells out the date when it is not today", () => {
    render(<TimelineDatePicker selected="2026-09-01" isToday={false} />);
    const trigger = screen.getByLabelText("Choose a day");
    expect(trigger).toHaveTextContent("September");
    expect(trigger).not.toHaveTextContent("Today");
  });

  it("opens the calendar and pushes the chosen day into the URL", async () => {
    const user = openCalendar();
    render(<TimelineDatePicker selected="2026-09-03" isToday />);

    await user.click(screen.getByLabelText("Choose a day"));

    const grid = await screen.findByRole("grid");
    await user.click(day(grid, "2026-09-01"));

    expect(push).toHaveBeenCalledWith("/timeline?date=2026-09-01");
  });

  it("pushes the bare route for today, not a redundant query string", async () => {
    const user = openCalendar();
    render(<TimelineDatePicker selected="2026-09-01" isToday={false} />);

    await user.click(screen.getByLabelText("Choose a day"));
    const grid = await screen.findByRole("grid");
    await user.click(day(grid, "2026-09-03"));

    expect(push).toHaveBeenCalledWith("/timeline");
  });

  it("disables days after today — nothing has happened tomorrow", async () => {
    const user = openCalendar();
    render(<TimelineDatePicker selected="2026-09-03" isToday />);

    await user.click(screen.getByLabelText("Choose a day"));
    const grid = await screen.findByRole("grid");

    expect(day(grid, "2026-09-04")).toBeDisabled();
    expect(day(grid, "2026-09-03")).toBeEnabled();
  });

  it("offers a way back to today only when you are not on it", async () => {
    const { rerender } = render(
      <TimelineDatePicker selected="2026-09-03" isToday />,
    );
    expect(screen.queryByText("Jump to today")).not.toBeInTheDocument();

    rerender(<TimelineDatePicker selected="2026-09-01" isToday={false} />);
    const user = openCalendar();
    await user.click(screen.getByText("Jump to today"));

    expect(push).toHaveBeenCalledWith("/timeline");
  });
});
