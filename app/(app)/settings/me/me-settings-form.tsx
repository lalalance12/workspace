"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ErrorNote, Field, Input, Toggle } from "@/components/ui/field";
import { Panel } from "@/components/ui/page";
import { messageForError } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  id: string;
  team_id: string | null;
  display_name: string;
  message_link: string | null;
  peer_nudges_enabled: boolean;
  system_nudges_enabled: boolean;
  nudges_paused_until: string | null;
}

/**
 * Nudge preferences, pause, and the message link a peer nudge points at.
 *
 * Joining and creating teams used to live here too. It moved to /onboarding —
 * this page is for someone who already has a board and wants to change how it
 * reaches them.
 */
export function MeSettingsForm({ profile }: { profile: Profile }) {
  const router = useRouter();

  const [messageLink, setMessageLink] = useState(profile.message_link ?? "");
  const [peer, setPeer] = useState(profile.peer_nudges_enabled);
  const [system, setSystem] = useState(profile.system_nudges_enabled);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setPending(true);

    const { error: err } = await createClient()
      .from("profiles")
      .update({
        message_link: messageLink.trim() || null,
        peer_nudges_enabled: peer,
        system_nudges_enabled: system,
      })
      .eq("id", profile.id);

    setPending(false);
    if (err) setError(messageForError(err));
    else {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSave} className="flex max-w-lg flex-col gap-6">
      <Panel className="flex flex-col gap-6 p-6">
        <Field
          label="Where a nudge sends people"
          hint="Workspace never carries the conversation. This is where it points."
        >
          <Input
            type="url"
            value={messageLink}
            onChange={(e) => setMessageLink(e.target.value)}
            placeholder="https://slack.com/app_redirect?channel=you"
          />
        </Field>

        <div className="flex flex-col gap-4">
          <span className="annotation">Interruptions</span>
          <Toggle checked={peer} onChange={setPeer}>
            Let teammates nudge me
          </Toggle>
          <Toggle checked={system} onChange={setSystem}>
            Ask me when my status goes stale
          </Toggle>
        </div>
      </Panel>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save preferences"}
        </Button>
        {saved && <span className="annotation">Saved</span>}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
    </form>
  );
}
