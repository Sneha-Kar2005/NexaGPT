import type { ThreadSummary } from "./types";

/** RFC 4122 v4 UUID; falls back for insecure contexts (e.g. LAN IP over http). */
export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function initialTitle(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 50 ? `${oneLine.slice(0, 50)}…` : oneLine;
}

const DAY = 24 * 60 * 60 * 1000;

/** Groups threads the way ChatGPT's sidebar does. Input must be sorted newest first. */
export function groupThreads(threads: ThreadSummary[]): { label: string; threads: ThreadSummary[] }[] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.getTime();

  const groups = new Map<string, ThreadSummary[]>();
  for (const t of threads) {
    const time = new Date(t.updatedAt).getTime();
    let label: string;
    if (time >= today) label = "Today";
    else if (time >= today - DAY) label = "Yesterday";
    else if (time >= today - 7 * DAY) label = "Previous 7 days";
    else if (time >= today - 30 * DAY) label = "Previous 30 days";
    else label = new Date(time).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(t);
  }
  return Array.from(groups, ([label, threads]) => ({ label, threads }));
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for insecure contexts.
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    el.remove();
    return ok;
  }
}

/** gemini-2.5-flash-lite was retired for new API keys; 3.5 Flash-Lite is Google's replacement. */
export const DEFAULT_MODEL = "gemini-3.5-flash-lite";

/** "gemini-3.5-flash-lite" -> "Gemini 3.5 Flash-Lite" */
export function modelLabel(model: string): string {
  return model
    .replace(/^models\//, "")
    .split("-")
    .map((part) => (part === "lite" ? "Lite" : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ")
    .replace(/ Lite$/, "-Lite");
}
