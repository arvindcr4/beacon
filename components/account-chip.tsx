import { cn } from "@/lib/utils";

export function AccountChip({
  name,
  color,
  className,
}: {
  name: string;
  color?: string | null;
  className?: string;
}) {
  const initial = (name?.[0] ?? "?").toUpperCase();
  const bg = color ?? hashColor(name);
  return (
    <span
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold text-black",
        className,
      )}
      style={{ background: bg }}
      title={name}
    >
      {initial}
    </span>
  );
}

function hashColor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const palette = ["#ffb84d", "#4ade80", "#60a5fa", "#f472b6", "#a78bfa", "#fb923c"];
  return palette[h % palette.length]!;
}
