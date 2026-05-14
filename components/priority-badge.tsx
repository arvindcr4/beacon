import { cn } from "@/lib/utils";

export function PriorityBadge({
  priority,
  className,
}: {
  priority?: "high" | "medium" | "low";
  className?: string;
}) {
  if (!priority) return null;
  const dot = {
    high: "bg-[var(--color-priority-high)]",
    medium: "bg-[var(--color-priority-med)]",
    low: "bg-[var(--color-priority-low)]",
  }[priority];
  const label = { high: "Now", medium: "Soon", low: "Later" }[priority];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface-elevated)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-fg-muted)]",
        className,
      )}
      aria-label={`Priority: ${priority}`}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {label}
    </span>
  );
}
