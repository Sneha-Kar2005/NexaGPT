"use client";

import { memo, useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Copy, Images, Pencil, RefreshCw } from "lucide-react";
import { Markdown } from "./Markdown";
import { ImageGallery } from "./ImageGallery";
import type { UIMessage } from "./ChatProvider";
import { copyToClipboard } from "@/lib/utils";

interface Props {
  message: UIMessage;
  isLast: boolean;
  busy: boolean;
  onEdit: (id: string, content: string) => void;
  onRegenerate: () => void;
}

function ActionButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-lg p-1.5 text-muted hover:bg-hover hover:text-fg"
    >
      {children}
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <ActionButton
      label={copied ? "Copied" : "Copy"}
      onClick={async () => {
        if (await copyToClipboard(text)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </ActionButton>
  );
}

export const MessageItem = memo(function MessageItem({ message, isLast, busy, onEdit, onRegenerate }: Props) {
  const [editing, setEditing] = useState(false);

  if (message.role === "user") {
    if (editing) {
      return (
        <EditBox
          initial={message.content}
          onCancel={() => setEditing(false)}
          onSubmit={(text) => {
            setEditing(false);
            if (text.trim() && text.trim() !== message.content) onEdit(message.id, text);
          }}
        />
      );
    }
    return (
      <div className="group flex flex-col items-end">
        <div className="max-w-[85%] rounded-3xl bg-elev px-5 py-2.5 break-words whitespace-pre-wrap md:max-w-[70%]">
          {message.content}
        </div>
        <div className="mt-1 flex gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
          <CopyButton text={message.content} />
          {!busy && (
            <ActionButton label="Edit message" onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
            </ActionButton>
          )}
        </div>
      </div>
    );
  }

  const streaming = message.status === "streaming";
  return (
    <div className="group">
      {message.images?.length ? <ImageGallery images={message.images} /> : null}
      {message.content ? <Markdown content={message.content} /> : null}
      {streaming &&
        (message.activity ? (
          <div className="flex items-center gap-2 py-1.5 text-sm text-muted">
            <Images className="size-4 animate-pulse" />
            <span className="animate-pulse">{message.activity}</span>
          </div>
        ) : (
          <div className={message.content || message.images?.length ? "mt-2" : "py-1.5"}>
            <span className="streaming-dot" aria-label="NexaGPT is typing" />
          </div>
        ))}
      {message.status === "error" && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
          <AlertCircle className="size-4 shrink-0 text-danger" />
          <span className="flex-1">{message.error}</span>
          {isLast && !busy && (
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1.5 rounded-full border border-border bg-bg px-3 py-1 font-medium hover:bg-hover"
            >
              <RefreshCw className="size-3.5" /> Retry
            </button>
          )}
        </div>
      )}
      {!streaming && message.content && (
        <div
          className={`mt-1 -ml-1.5 flex gap-0.5 transition-opacity ${
            isLast ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
          }`}
        >
          <CopyButton text={message.content} />
          {isLast && !busy && (
            <ActionButton label="Regenerate response" onClick={onRegenerate}>
              <RefreshCw className="size-4" />
            </ActionButton>
          )}
        </div>
      )}
    </div>
  );
});

function EditBox({
  initial,
  onCancel,
  onSubmit,
}: {
  initial: string;
  onCancel: () => void;
  onSubmit: (text: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 400)}px`;
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  return (
    <div className="ml-auto w-full rounded-3xl bg-elev p-4 md:max-w-[85%]">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onSubmit(value);
          }
        }}
        className="w-full resize-none bg-transparent leading-6 outline-none"
      />
      <div className="mt-2 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-full border border-border bg-bg px-4 py-1.5 text-sm font-medium hover:bg-hover">
          Cancel
        </button>
        <button
          onClick={() => onSubmit(value)}
          disabled={!value.trim()}
          className="rounded-full bg-fg px-4 py-1.5 text-sm font-medium text-bg hover:opacity-80 disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
