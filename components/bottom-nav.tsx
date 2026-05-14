"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, PenSquare, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/compose", label: "Compose", icon: PenSquare },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="glass fixed bottom-0 left-0 right-0 z-30 grid grid-cols-3 border-t border-[var(--color-border)] px-2 pt-2"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
    >
      {tabs.map((t) => {
        const active = pathname?.startsWith(t.href);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex flex-col items-center gap-1 rounded-md py-1.5 text-xs font-medium",
              active ? "text-[var(--color-accent)]" : "text-[var(--color-fg-muted)]",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.75} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
