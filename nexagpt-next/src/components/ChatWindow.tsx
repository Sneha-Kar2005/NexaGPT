"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, Code2, GraduationCap, Lightbulb, PenLine } from "lucide-react";
import { useChat } from "./ChatProvider";
import { Composer } from "./Composer";
import { MessageItem } from "./MessageItem";

const SUGGESTIONS = [
  { icon: Code2, label: "Write code", prompt: "Write a TypeScript function that debounces another function, with an explanation." },
  { icon: Lightbulb, label: "Brainstorm", prompt: "Brainstorm 10 creative names for a coffee shop that also sells books." },
  { icon: GraduationCap, label: "Explain", prompt: "Explain how vaccines train the immune system, in simple terms." },
  { icon: PenLine, label: "Help me write", prompt: "Help me write a polite email asking my manager for a day off next Friday." },
];

const Disclaimer = () => (
  <p className="px-4 py-2 text-center text-xs text-subtle">NexaGPT can make mistakes. Check important info.</p>
);

export function ChatWindow() {
  const { messages, threadLoading, activeId, isStreaming, editMessage, regenerate, send } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const prevCount = useRef(0);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    atBottomRef.current = near;
    setShowScrollButton(!near);
  };

  // Jump to the bottom when opening a chat.
  useEffect(() => {
    atBottomRef.current = true;
    prevCount.current = 0;
  }, [activeId]);

  // New message added -> always scroll; streaming text -> follow only if already at the bottom.
  useLayoutEffect(() => {
    if (messages.length !== prevCount.current || atBottomRef.current) {
      scrollToBottom();
      atBottomRef.current = true;
      setShowScrollButton(false);
    }
    prevCount.current = messages.length;
  }, [messages, scrollToBottom]);

  if (threadLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-border border-t-fg" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 pb-[10vh]">
          <h1 className="mb-8 text-center text-2xl font-medium md:text-3xl">What can I help with?</h1>
          <Composer autoFocus />
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map(({ icon: Icon, label, prompt }) => (
              <button
                key={label}
                onClick={() => send(prompt)}
                disabled={isStreaming}
                className="flex items-center gap-2 rounded-full border border-border px-3.5 py-2 text-sm text-muted hover:bg-hover hover:text-fg disabled:opacity-50"
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
        <Disclaimer />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-4 pb-10 md:px-6">
          {messages.map((m, i) => (
            <MessageItem
              key={m.id}
              message={m}
              isLast={i === messages.length - 1}
              busy={isStreaming}
              onEdit={editMessage}
              onRegenerate={regenerate}
            />
          ))}
        </div>
      </div>

      {showScrollButton && (
        <button
          onClick={() => scrollToBottom("smooth")}
          aria-label="Scroll to bottom"
          className="absolute bottom-32 left-1/2 z-10 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-bg shadow-md hover:bg-hover"
        >
          <ArrowDown className="size-4" />
        </button>
      )}

      <div className="mx-auto w-full max-w-3xl px-3 md:px-6">
        <Composer />
      </div>
      <Disclaimer />
    </div>
  );
}
