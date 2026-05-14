import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/inbox");

  async function action(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    await signIn("credentials", { email, redirectTo: "/inbox" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <BeaconMark />
          <h1 className="text-xl font-semibold">Welcome to Beacon</h1>
          <p className="text-sm text-[var(--color-fg-muted)]">
            One inbox. All your accounts. AI that actually triages.
          </p>
        </div>
        <form action={action} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </div>
          <Button type="submit" size="lg">
            Continue
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-[var(--color-fg-muted)]">
          We use this only to identify your Beacon account. Per-mailbox credentials are added later.
        </p>
      </div>
    </div>
  );
}

function BeaconMark() {
  return (
    <svg viewBox="0 0 64 64" className="h-12 w-12">
      <circle cx="32" cy="32" r="10" fill="#ffb84d" />
      <g fill="#ffb84d">
        <path d="M32 4 L37 14 L27 14 Z" opacity="0.7" />
        <path d="M60 32 L50 37 L50 27 Z" opacity="0.5" />
        <path d="M32 60 L27 50 L37 50 Z" opacity="0.7" />
        <path d="M4 32 L14 27 L14 37 Z" opacity="0.5" />
      </g>
    </svg>
  );
}