"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";
import { useChat } from "./ChatProvider";
import { cn } from "@/lib/utils";

const MAX_LENGTH = 32_000;

export function Composer({ autoFocus = false }: { autoFocus?: boolean }) {
  const { send, stop, isStreaming, isStreamingHere, activeId } = useChat();
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea up to a max height.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [value]);

  // Focus the input when switching chats (desktop only, so mobile keyboards don't pop up).
  useEffect(() => {
    if (autoFocus || window.matchMedia("(min-width: 768px)").matches) ref.current?.focus();
  }, [activeId, autoFocus]);

  const canSend = value.trim().length > 0 && !isStreaming;

  const submit = () => {
    if (!canSend) return;
    send(value);
    setValue("");
  };

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-end gap-2 rounded-[28px] border border-border bg-bg p-2.5 pl-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)] focus-within:border-subtle dark:bg-elev dark:shadow-none"
      >
        <textarea
          ref={ref}
          value={value}
          rows={1}
          maxLength={MAX_LENGTH}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask anything"
          aria-label="Message NexaGPT"
          className="max-h-60 flex-1 resize-none self-center bg-transparent py-1.5 text-base leading-6 outline-none placeholder:text-subtle"
        />
        {isStreamingHere ? (
          <button
            type="button"
            onClick={stop}
            aria-label="Stop generating"
            title="Stop generating"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fg text-bg hover:opacity-80"
          >
            <Square className="size-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send message"
            title={isStreaming ? "Wait for the current reply to finish" : "Send message"}
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full transition",
              canSend ? "bg-fg text-bg hover:opacity-80" : "bg-active text-subtle",
            )}
          >
            <ArrowUp className="size-5" strokeWidth={2.5} />
          </button>
        )}
      </form>
    </div>
  );
}
