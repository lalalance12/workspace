import { describe, expect, it, vi } from "vitest";

import {
  RpcError,
  acknowledgeNudge,
  leaveTeam,
  messageForError,
  sendPeerNudge,
  setStatus,
  switchTeam,
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

  it("sends details under the name the migration declares", async () => {
    const { client, rpc } = clientReturning({ data: { id: "s1" } });

    await setStatus(client, {
      state: "blocked",
      note: "Waiting on the staging key",
      details: "Asked in #platform at 09:40.\n\nNo reply yet.",
    });

    expect(rpc.mock.calls[0][1]).toMatchObject({
      p_details: "Asked in #platform at 09:40.\n\nNo reply yet.",
    });
  });

  it("omits details rather than sending null, so the column default applies", async () => {
    const { client, rpc } = clientReturning({ data: { id: "s1" } });

    await setStatus(client, { state: "working", details: null });

    expect(rpc.mock.calls[0][1].p_details).toBeUndefined();
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

describe("switchTeam", () => {
  it("normalises the code, because join codes are an uppercase alphabet", async () => {
    const { client, rpc } = clientReturning({ data: { id: "t2" } });

    await switchTeam(client, "  k7qm4rxp ");

    expect(rpc).toHaveBeenCalledWith("switch_team", { p_code: "K7QM4RXP" });
  });

  it("says so when you are already on that team", async () => {
    const { client } = clientReturning({
      error: { code: "WS012", message: "already on that team" },
    });

    await expect(switchTeam(client, "K7QM4RXP")).rejects.toThrow(
      /already on that team/i,
    );
  });

  it("reports a bad code without releasing anything — the RPC is atomic", async () => {
    const { client } = clientReturning({
      error: { code: "WS009", message: "no such code" },
    });

    await expect(switchTeam(client, "NOPE")).rejects.toMatchObject({
      code: "WS009",
    });
  });
});

describe("leaveTeam", () => {
  // Returns void, so it must check the error and not the payload. unwrap()
  // would reject the legitimate null and report a failure that did not happen.
  it("resolves on the null payload a void function returns", async () => {
    const { client } = clientReturning({ data: null, error: null });

    await expect(leaveTeam(client)).resolves.toBeUndefined();
  });

  it("still throws when the database refuses", async () => {
    const { client } = clientReturning({
      error: { code: "WS001", message: "not on a team" },
    });

    await expect(leaveTeam(client)).rejects.toBeInstanceOf(RpcError);
  });
});

describe("messageForError", () => {
  it("maps every SQLSTATE the migrations raise", () => {
    const raised = [
      "WS001", "WS002", "WS003", "WS004",
      "WS005", "WS006", "WS007", "WS008", "WS009",
      "WS010", "WS011", "WS012", "WS013",
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
