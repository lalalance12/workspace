import { expect, test } from "@playwright/test";

import { clearMailbox, magicLinkFor } from "./mail";

/**
 * The one end-to-end flow: log in, post a status, assert the note lands on the
 * board in the right state colour.
 *
 * Runs against the local stack with supabase/seed.sql applied, so dana@ exists
 * and is already on the Product team.
 */

const EMAIL = "dana@example.com";
const SIGNAL = "rgb(192, 71, 60)"; // --signal, the only alarming colour

test("log in, post a status, see it on the board", async ({ page }) => {
  await clearMailbox();

  await page.goto("/login");
  await page.getByPlaceholder("you@company.com").fill(EMAIL);
  await page.getByRole("button", { name: "Send sign-in link" }).click();
  await expect(page.getByText(`Check ${EMAIL}`)).toBeVisible();

  await page.goto(await magicLinkFor(EMAIL));
  await expect(page).toHaveURL(/\/board$/);

  // Post a blocked status — the state with the most distinct treatment.
  const note = `Waiting on review ${Date.now()}`;
  await page.goto("/me");
  await page.getByRole("button", { name: "Blocked" }).click();
  await page.getByPlaceholder("Fixing the checkout bug").fill(note);
  await page.getByPlaceholder("WS-118").fill("WS-500");
  await page.getByTestId("post-update").click();

  await expect(page.getByTestId("status-error")).toHaveCount(0);

  await page.goto("/board");
  const card = page
    .getByTestId("status-note")
    .filter({ hasText: note });

  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("data-state", "blocked");

  // Blocked renders in --signal and is exempt from staleness decay.
  await expect(card).toHaveCSS("background-color", SIGNAL);
  await expect(card).toHaveAttribute("data-blocked", "true");
  await expect(card).toHaveAttribute("data-decay", "fresh");
});
