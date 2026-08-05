import { TopBar } from "@/components/top-bar";
import { getViewer } from "@/lib/queries";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewer();

  // Deliberately not a redirect to /login. Middleware has already established
  // there is a session, and middleware sends signed-in users at /login back
  // here — so redirecting on a missing profile row would just ping-pong.
  if (!viewer) {
    return (
      <div className="drafting-grid grid min-h-dvh place-items-center px-6">
        <div className="max-w-sm text-center">
          <p className="text-lg">You&rsquo;re signed in, but you have no profile.</p>
          <p className="annotation mt-2">
            A profile is created on signup by a database trigger. Ask an admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="drafting-grid min-h-dvh">
      <TopBar
        profileId={viewer.profile.id}
        displayName={viewer.profile.display_name}
        isHead={viewer.profile.role === "head"}
      />
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
