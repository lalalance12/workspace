import { expect, test } from "@playwright/test";

/**
 * The end-to-end flows, against the local stack with supabase/seed.sql applied.
 *
 * These used to sign in by magic link read out of Mailpit. That went away with
 * the magic link itself: Supabase's built-in sender rations emails by the hour
 * across the whole project, which makes it a poor thing to hang either a demo
 * or a test suite on. Password sign-in touches no email infrastructure, so
 * these run as fast as the browser and never flake on a rate limit.
 */

const SEEDED_EMAIL = "dana@example.com";
const SEEDED_PASSWORD = "password123"; // set by supabase/seed.sql

test("sign in, post a status, see it on the board", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("email").fill(SEEDED_EMAIL);
  await page.getByTestId("password").fill(SEEDED_PASSWORD);
  await page.getByTestId("sign-in").click();

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
  const card = page.getByTestId("status-note").filter({ hasText: note });

  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("data-state", "blocked");

  // Blocked is painted in the blocked state colour and is exempt from decay.
  // The expected value is read back from the token rather than hardcoded, so a
  // palette change moves the test with the design instead of breaking it.
  const blocked = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--color-state-blocked")
      .trim(),
  );
  expect(blocked).not.toBe("");
  await expect(card).toHaveCSS("background-color", blocked);
  await expect(card).toHaveAttribute("data-blocked", "true");
  await expect(card).toHaveAttribute("data-decay", "fresh");
});

/**
 * The path a new colleague actually walks on demo day: create an account, land
 * on the fork, start a team, arrive at an empty board. Requires "Confirm email"
 * to be off, which supabase/config.toml sets for local.
 */
test("create an account, start a team, land on the board", async ({ page }) => {
  const stamp = Date.now();
  const email = `new.hire.${stamp}@example.com`;

  await page.goto("/signup");
  await page.getByTestId("name").fill("New Hire");
  await page.getByTestId("email").fill(email);
  await page.getByTestId("password").fill("demo-password-2026");
  await page.getByTestId("create-account").click();

  // Straight to the fork, with no inbox in the way.
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByPlaceholder("Product").fill(`Demo team ${stamp}`);
  await page.getByTestId("create-team").click();

  await expect(page).toHaveURL(/\/board$/);
  await expect(page.getByText("Nothing pinned yet")).toBeVisible();

  // Team is in the nav for everyone now — members go there to leave or move —
  // so this asserts the bar rendered, not that the account is a head. What is
  // head-only is the join code and the nudge policy on the page itself.
  await expect(page.getByRole("link", { name: "Team" })).toBeVisible();
});
