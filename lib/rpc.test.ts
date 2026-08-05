import { describe, expect, it, vi } from "vitest";

import {
  RpcError,
  acknowledgeNudge,
  messageForError,
  sendPeerNudge,
  setStatus,
  type Client,
} from "./rpc";

/** A Supabase client stubbed down to the one method these wrappers use. */
function clientReturning(result: { data?: unknown; error?: unknown }) {
  const rpc = vi.fn().mockResolvedValue({
    data: result.data ?? null,
    error: result.error ?? null,
  });
  return { client: { rpc } as unknown as Client, rpc };
}

describe("setStatus", () => {
  it("passes the RPC the parameter names the migration declares", async () => {
    const { client, rpc } = clientReturning({ data: { id: "s1" } });

    await setStatus(client, {
      state: "working",
      note: "Fixing the checkout bug",
      ticketRef: "WS-92",
    });

    expect(rpc).toHaveBeenCalledWith("set_status", {
      p_state: "working",
      p_note: "Fixing the checkout bug",
      p_ticket_ref: "WS-92",
    });
  });

  it("omits absent fields so Postgres applies the function's own defaults", async () => {
    const { client, rpc } = clientReturning({ data: { id: "s1" } });

    await setStatus(client, { state: "break" });

    expect(rpc).toHaveBeenCalledWith("set_status", {
      p_state: "break",
      p_note: undefined,
      p_ticket_ref: undefined,
    });
  });

  it("surfaces a collision on the one-open-status index as something actionable", async () => {
    const { client } = clientReturning({
      error: { code: "23505", message: "duplicate key value" },
    });

    await expect(setStatus(client, { state: "working" })).rejects.toThrow(
      /try posting it again/i,
    );
  });
});

describe("sendPeerNudge", () => {
  it("names the rate limit that stopped it, and what to do instead", async () => {
    const { client } = clientReturning({
      error: { code: "WS002", message: "rate limited" },
    });

    await expect(
      sendPeerNudge(client, { recipientId: "p2", note: "got a sec?" }),
    ).rejects.toThrow(/message them directly/i);
  });

  it("keeps the SQLSTATE on the error so callers can branch on it", async () => {
    const { client } = clientReturning({
      error: { code: "WS004", message: "paused" },
    });

    await expect(
      sendPeerNudge(client, { recipientId: "p2" }),
    ).rejects.toMatchObject({ code: "WS004" });
  });
});

describe("acknowledgeNudge", () => {
  it("explains an already-handled nudge instead of failing blankly", async () => {
    const { client } = clientReturning({
      error: { code: "WS006", message: "not open" },
    });

    await expect(acknowledgeNudge(client, "n1")).rejects.toBeInstanceOf(
      RpcError,
    );
    await expect(acknowledgeNudge(client, "n1")).rejects.toThrow(
      /already handled/i,
    );
  });
});

describe("messageForError", () => {
  it("maps every SQLSTATE the migrations raise", () => {
    const raised = [
      "WS001", "WS002", "WS003", "WS004",
      "WS005", "WS006", "WS007", "WS008", "WS009",
    ];
    for (const code of raised) {
      expect(messageForError({ code })).not.toMatch(/something went wrong/i);
      expect(messageForError({ code }).length).toBeGreaterThan(10);
    }
  });

  it("falls back to the database's own message, not a generic apology", () => {
    expect(messageForError({ message: "permission denied for table nudges" })).toBe(
      "permission denied for table nudges",
    );
  });

  it("never returns a bare 'Something went wrong'", () => {
    expect(messageForError(null)).not.toMatch(/something went wrong/i);
    expect(messageForError({})).not.toMatch(/something went wrong/i);
  });
});
