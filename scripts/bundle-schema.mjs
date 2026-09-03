import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Concatenate supabase/migrations into one pasteable script.
 *
 * The CLI (supabase db push) is the right way to apply these. This exists for
 * the case where it is not available — no Docker, no database password to
 * hand, a locked-down machine — and someone needs to run the schema from the
 * dashboard's SQL editor instead. The migrations directory stays the source of
 * truth; this file is derived and should never be edited directly.
 */
const DIR = "supabase/migrations";
const OUT = "supabase/schema.sql";

const header = `-- ===========================================================================
-- Workspace — full schema, in one script.
--
-- Generated from supabase/migrations/ in filename order. Do not edit directly;
-- edit a migration and re-run: pnpm db:bundle
--
-- Safe to run on an empty project. Re-running is NOT generally safe: tables are
-- created with plain "create table", so a second run errors on the first one
-- that already exists. That is deliberate — silently re-running DDL over a live
-- database is worse than a loud failure.
--
-- After this completes, enable pg_cron (Database -> Extensions) if you want the
-- staleness scheduler; the scheduler migration skips scheduling with a notice
-- when the extension is absent rather than failing the whole script.
-- ===========================================================================

`;

const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();

const body = files
  .map((name) => {
    const sql = readFileSync(join(DIR, name), "utf8").trimEnd();
    const rule = "-".repeat(75);
    return `-- ${rule}\n-- ${name}\n-- ${rule}\n\n${sql}\n\n`;
  })
  .join("");

writeFileSync(OUT, header + body, "utf8");
console.log(`${OUT}: ${files.length} migrations, ${(header + body).split("\n").length} lines`);
