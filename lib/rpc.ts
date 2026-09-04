import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import type { StatusState } from "@/lib/status-state";

/**
 * Typed wrappers over the write API.
 *
 * Every mutation in the product goes through one of these. Nothing inserts
 * into status_updates or nudges directly — those tables have no write policy,
 * so a direct insert would fail anyway, which is the point.
 *
 * The RPCs raise distinct SQLSTATEs so failures can say what happened and what
 * to do about it. A toast must never read "Something went wrong".
 */

export type Client = SupabaseClient<Database>;

/** SQLSTATE -> what the person should read, and what they can do next. */
export const RPC_MESSAGES: Record<string, string> = {
  WS001: "You're not on a team yet. Join one with a code, or create one.",
  WS002:
    "You already nudged them in the last hour. Message them directly instead.",
  WS003: "That's all your nudges for this hour. Message them directly instead.",
  WS004: "They have nudges paused. Message them directly instead.",
  WS005: "That person isn't on your team.",
  WS006: "That nudge was already handled.",
  WS007: "A nudge carries at most 80 characters. Trim it and send again.",
  WS008: "You're already on a team.",
  WS009: "That join code doesn't match a team. Check it with whoever sent it.",
  WS010: "A duration must be 1, 15, 30, 45 or 60 minutes.",
  WS011: "Tell us what you're on — an Other status needs a label.",
  WS012: "You're already on that team.",
  WS013: "Details run to at most 2000 characters. Trim them and post again.",
  // Raised by the one-open-status-per-person index if two writes race.
  "23505": "That update collided with another one. Try posting it again.",
};

export class RpcError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "RpcError";
    this.code = code;
  }
}

interface PostgrestLike {
  code?: string;
  message?: string;
  details?: string | null;
}

/**
 * Turn a Postgrest error into something worth reading. Falls back to the
 * database's own message rather than a generic apology, because a specific
 * wrong-sounding message is still more actionable than a vague one.
 */
export function messageForError(error: PostgrestLike | null): string {
  if (!error) return "That didn't go through. Try again.";
  if (error.code && RPC_MESSAGES[error.code]) return RPC_MESSAGES[error.code];
  if (error.message) return error.message;
  return "That didn't go through. Try again.";
}

function unwrap<T>(data: T | null, error: PostgrestLike | null): T {
  if (error) throw new RpcError(messageForError(error), error.code);
  if (data === null) {
    throw new RpcError("The server returned nothing. Try again.");
  }
  return data;
}

// ---------------------------------------------------------------------------

export interface SetStatusInput {
  state: StatusState;
  note?: string | null;
  ticketRef?: string | null;
  /** How long they expect to be on this. One of 1/15/30/45/60, or null. */
  durationMinutes?: number | null;
  /**
   * State to switch to automatically when the duration elapses. Only meaningful
   * alongside a duration; null means the status just ages in place.
   */
  autoSwitchTo?: StatusState | null;
  /** Free-text label for the 'other' state. Ignored for every other state. */
  customLabel?: string | null;
  /**
   * The long half. Up to 2000 characters, never drawn on the card — it is what
   * the preview opens to show.
   */
  details?: string | null;
}

/**
 * Post a status. Closes the previous row, inserts the new one, resolves any
 * open system nudge and records the quick pick — one transaction, server side.
 */
export async function setStatus(client: Client, input: SetStatusInput) {
  // Omitted rather than null: PostgREST drops absent keys and Postgres applies
  // the function's own DEFAULT null, which is what the generated Args type
  // expects.
  const { data, error } = await client.rpc("set_status", {
    p_state: input.state,
    p_note: input.note ?? undefined,
    p_ticket_ref: input.ticketRef ?? undefined,
    p_duration_minutes: input.durationMinutes ?? undefined,
    p_auto_switch_to: input.autoSwitchTo ?? undefined,
    p_custom_label: input.customLabel ?? undefined,
    p_details: input.details ?? undefined,
  });
  return unwrap(data, error);
}

/** A signpost, not a message: 80 chars and a link out. */
export async function sendPeerNudge(
  client: Client,
  input: { recipientId: string; note?: string | null; link?: string | null },
) {
  const { data, error } = await client.rpc("send_peer_nudge", {
    p_recipient_id: input.recipientId,
    p_note: input.note ?? undefined,
    p_link: input.link ?? undefined,
  });
  return unwrap(data, error);
}

/** One tap. No status required. */
export async function acknowledgeNudge(client: Client, nudgeId: string) {
  const { data, error } = await client.rpc("acknowledge_nudge", {
    p_nudge_id: nudgeId,
  });
  return unwrap(data, error);
}

/** Answer a system nudge by posting a status. */
export async function respondToNudge(
  client: Client,
  input: SetStatusInput & { nudgeId: string },
) {
  const { data, error } = await client.rpc("respond_to_nudge", {
    p_nudge_id: input.nudgeId,
    p_state: input.state,
    p_note: input.note ?? undefined,
    p_ticket_ref: input.ticketRef ?? undefined,
  });
  return unwrap(data, error);
}

export async function createTeam(client: Client, name: string) {
  const { data, error } = await client.rpc("create_team", { p_name: name });
  return unwrap(data, error);
}

/** The other half of onboarding: join with the code the head shared. */
export async function joinTeam(client: Client, code: string) {
  const { data, error } = await client.rpc("join_team", {
    p_code: code.trim().toUpperCase(),
  });
  return unwrap(data, error);
}

/**
 * Move to another team in one step.
 *
 * Not leaveTeam() followed by joinTeam(): the RPC resolves the code before it
 * releases the current membership, so a typo fails with WS009 and leaves you
 * exactly where you were. Two calls would strand you between teams.
 *
 * A head who moves hands the team to its longest-standing member on the way
 * out — ask the server who that is (getTeamMembership) before offering this.
 */
export async function switchTeam(client: Client, code: string) {
  const { data, error } = await client.rpc("switch_team", {
    p_code: code.trim().toUpperCase(),
  });
  return unwrap(data, error);
}

/**
 * Leave without arriving anywhere. team_id goes null and the app layout routes
 * to /onboarding. Returns nothing, so it checks the error and not the payload —
 * unwrap() would reject the legitimate null.
 */
export async function leaveTeam(client: Client) {
  const { error } = await client.rpc("leave_team");
  if (error) throw new RpcError(messageForError(error), error.code);
}

/** Head only. Invalidates the old code. */
export async function rotateJoinCode(client: Client) {
  const { data, error } = await client.rpc("rotate_join_code");
  return unwrap(data, error);
}

/** Marking read is the only write the client may make to notifications. */
export async function markNotificationRead(client: Client, id: string) {
  const { error } = await client
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new RpcError(messageForError(error), error.code);
}
