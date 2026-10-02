import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-[#10a37f] text-white",
        className ?? "size-7",
      )}
    >
      <svg viewBox="0 0 24 24" className="size-[60%]" fill="currentColor" aria-hidden>
        <path d="M12 2l2.4 6.6L21 11.5l-6.6 2.4L12 21l-2.4-7.1L3 11.5l6.6-2.9z" />
      </svg>
    </span>
  );
}
