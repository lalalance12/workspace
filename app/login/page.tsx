import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="drafting-grid grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-sm">
        <p className="annotation">Workspace</p>
        <h1 className="mt-2 mb-1 text-2xl tracking-tight">
          What everyone is working on.
        </h1>
        <p className="mb-8 text-sm text-[var(--ink-soft)]">
          An ambient status board. Not a chat app.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
