import { cn } from "@/lib/utils";

export interface SessionUser {
  name: string;
  email: string;
}

const COLORS = ["#339cff", "#10a37f", "#ab68ff", "#f97316", "#e11d74", "#0ea5e9", "#84cc16"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Circle with the user's initials; the color is derived from the email so it's stable. */
export function Avatar({ user, className }: { user: SessionUser; className?: string }) {
  let hash = 0;
  for (const ch of user.email) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none",
        className ?? "size-8 text-xs",
      )}
      style={{ backgroundColor: COLORS[Math.abs(hash) % COLORS.length] }}
      aria-hidden
    >
      {initials(user.name)}
    </span>
  );
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  window.location.assign("/login");
}
